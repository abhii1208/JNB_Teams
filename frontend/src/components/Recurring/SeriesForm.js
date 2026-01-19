import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Stack,
  Paper,
  Divider,
  Alert,
  CircularProgress,
  Autocomplete,
  Chip,
  Grid,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Tooltip,
  Avatar,
  FormGroup,
} from '@mui/material';
import {
  Save as SaveIcon,
  ArrowBack as BackIcon,
  ExpandMore as ExpandMoreIcon,
  HelpOutline as HelpOutlineIcon,
  Description as DescriptionIcon,
  Clear as ClearIcon,
  Add as AddIcon,
} from '@mui/icons-material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import apiClient from '../../apiClient';
import RecurrenceRuleBuilder from './RecurrenceRuleBuilder';
import { REMINDER_PRESETS } from '../../utils/recurrenceHelpers';

/**
 * SeriesForm Component
 * Create or edit a recurring series
 */
function SeriesForm({ workspace, series, onCancel, onSuccess }) {
  const workspaceId = workspace?.id;
  const mode = series?.id ? 'edit' : 'create';
  const seriesId = series?.id;

  const formatDateInput = (value) => {
    if (!value) return '';
    if (value instanceof Date) {
      if (Number.isNaN(value.valueOf())) return '';
      const year = value.getFullYear();
      const month = String(value.getMonth() + 1).padStart(2, '0');
      const day = String(value.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    if (typeof value === 'string') {
      if (value.includes('T')) return value.split('T')[0];
      if (value.includes(' ')) return value.split(' ')[0];
      return value;
    }
    return '';
  };

  const parseDateInput = (value) => {
    if (!value) return null;
    if (value instanceof Date) {
      return Number.isNaN(value.valueOf()) ? null : value;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      const datePart = trimmed.split('T')[0].split(' ')[0];
      const parts = datePart.split('-');
      if (parts.length === 3) {
        const [year, month, day] = parts;
        const parsed = new Date(
          Number.parseInt(year, 10),
          Number.parseInt(month, 10) - 1,
          Number.parseInt(day, 10)
        );
        return Number.isNaN(parsed.valueOf()) ? null : parsed;
      }
      const fallback = new Date(trimmed);
      return Number.isNaN(fallback.valueOf()) ? null : fallback;
    }
    return null;
  };

  const normalizeJsonValue = (value, fallback) => {
    if (value === undefined || value === null) return fallback;
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch (err) {
        return fallback !== undefined ? fallback : value;
      }
    }
    return value;
  };

  const [loading, setLoading] = useState(mode === 'edit');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);

  // Compact UI helpers
  const [showDescription, setShowDescription] = useState(Boolean(series?.description));
  const [showCustomReminder, setShowCustomReminder] = useState(false);
  const [customReminderValue, setCustomReminderValue] = useState(15);
  const [customReminderUnit, setCustomReminderUnit] = useState('minutes');

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    project_id: '',
    recurrence_rule: null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    start_date: formatDateInput(new Date()),
    end_date: '',
    end_type: 'never', // 'date', 'count', or 'never'
    end_count: 10,
    assignment_strategy: 'static',
    static_assignee_id: '',
    rotation_members: [],
    requires_approval: false,
    approver_id: '',
    auto_close_after_days: '',
    reminder_offsets: [],
    generation_mode: 'auto', // 'auto' or 'manual'
    generate_past: true,
    prevent_future: true,
    category: '',
    color: '#0f766e',
    template: {
      priority: 'Medium',
      status: 'Open',
      stage: 'Planned',
    },
  });

  // Fetch initial data (parallel + safe unmount)
  useEffect(() => {
    let alive = true;

    const fetchData = async () => {
      try {
        if (!workspaceId) throw new Error('Workspace is missing.');

        setError(null);

        const projectsReq = apiClient.get(`/api/projects/workspace/${workspaceId}`);
        const membersReq = apiClient.get(`/api/workspaces/${workspaceId}/members`);
        const seriesReq =
          mode === 'edit' && seriesId ? apiClient.get(`/api/recurring/${seriesId}`) : null;

        const [projectsRes, membersRes, seriesRes] = await Promise.all([
          projectsReq,
          membersReq,
          seriesReq,
        ]);

        if (!alive) return;

        setProjects(projectsRes?.data || []);
        setMembers(membersRes?.data || []);

        if (mode === 'edit' && seriesId) {
          const s = seriesRes?.data || {};
          const recurrenceRule = normalizeJsonValue(s.recurrence_rule, null);
          const reminderOffsets = normalizeJsonValue(s.reminder_offsets, []);
          const template = normalizeJsonValue(s.template, {
            priority: 'Medium',
            status: 'Open',
            stage: 'Planned',
          });

          // Handle end condition robustly: end_date OR recurrenceRule.until OR recurrenceRule.count
          const untilFromRule = recurrenceRule?.until;
          const hasEndDate = Boolean(s.end_date);
          const hasUntil = Boolean(untilFromRule);
          const hasCount = Boolean(recurrenceRule?.count);

          const endType = hasEndDate
            ? 'date'
            : hasUntil
            ? 'date'
            : hasCount
            ? 'count'
            : 'never';

          const endDateResolved = hasEndDate
            ? formatDateInput(s.end_date)
            : hasUntil
            ? formatDateInput(parseDateInput(untilFromRule))
            : '';

          setFormData({
            title: s.title || '',
            description: s.description || '',
            project_id: s.project_id || '',
            recurrence_rule: recurrenceRule,
            timezone: s.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
            start_date: formatDateInput(s.start_date),
            end_date: endDateResolved,
            end_type: endType,
            end_count: recurrenceRule?.count || 10,
            assignment_strategy: s.assignment_strategy || 'static',
            static_assignee_id: s.static_assignee_id || '',
            rotation_members: s.rotation_members?.map((m) => m.user_id || m.id) || [],
            requires_approval: s.requires_approval || false,
            approver_id: s.approver_id || '',
            auto_close_after_days: s.auto_close_after_days || '',
            reminder_offsets: reminderOffsets || [],
            generation_mode: s.generation_mode || 'auto',
            generate_past: s.generate_past !== false,
            prevent_future: s.prevent_future !== false,
            category: s.category || '',
            color: s.color || '#0f766e',
            template,
          });

          setShowDescription(Boolean(s.description));
        }
      } catch (err) {
        if (!alive) return;
        setError(err?.message || 'Failed to load form data');
      } finally {
        if (alive) setLoading(false);
      }
    };

    fetchData();
    return () => {
      alive = false;
    };
  }, [workspaceId, seriesId, mode]);

  // Handle form field changes
  const handleChange = useCallback((field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }, []);

  // Handle template changes
  const handleTemplateChange = useCallback((field, value) => {
    setFormData((prev) => ({
      ...prev,
      template: { ...prev.template, [field]: value },
    }));
  }, []);

  const handleRecurrenceRuleChange = useCallback((rule) => {
    setFormData((prev) => ({ ...prev, recurrence_rule: rule }));
  }, []);

  const projectOptions = useMemo(
    () => projects.map((p) => ({ id: p.id, name: p.name })),
    [projects]
  );

  const memberOptions = useMemo(
    () =>
      members.map((m) => ({
        ...m,
        label: `${m.first_name || ''} ${m.last_name || ''}`.trim() || m.email || 'Member',
      })),
    [members]
  );

  const selectedStaticAssignee = useMemo(() => {
    if (!formData.static_assignee_id) return null;
    return memberOptions.find((m) => m.id === formData.static_assignee_id) || null;
  }, [formData.static_assignee_id, memberOptions]);

  const selectedApprover = useMemo(() => {
    if (!formData.approver_id) return null;
    return memberOptions.find((m) => m.id === formData.approver_id) || null;
  }, [formData.approver_id, memberOptions]);

  const selectedRotationMembers = useMemo(() => {
    const ids = new Set(formData.rotation_members || []);
    return memberOptions.filter((m) => ids.has(m.id));
  }, [formData.rotation_members, memberOptions]);

  const presetSelected = useCallback(
    (preset) =>
      formData.reminder_offsets.some(
        (r) => r.value === preset.value && r.unit === preset.unit
      ),
    [formData.reminder_offsets]
  );

  const toggleReminderPreset = useCallback(
    (preset) => {
      const isSelected = presetSelected(preset);
      if (isSelected) {
        handleChange(
          'reminder_offsets',
          formData.reminder_offsets.filter(
            (r) => !(r.value === preset.value && r.unit === preset.unit)
          )
        );
      } else {
        handleChange('reminder_offsets', [
          ...formData.reminder_offsets,
          { value: preset.value, unit: preset.unit },
        ]);
      }
    },
    [formData.reminder_offsets, handleChange, presetSelected]
  );

  const addCustomReminder = useCallback(() => {
    const valueNum = Number.parseInt(customReminderValue, 10);
    if (!valueNum || valueNum < 1) return;

    const newReminder = { value: valueNum, unit: customReminderUnit };
    const exists = formData.reminder_offsets.some(
      (r) => r.value === newReminder.value && r.unit === newReminder.unit
    );
    if (exists) return;

    handleChange('reminder_offsets', [...formData.reminder_offsets, newReminder]);
  }, [customReminderUnit, customReminderValue, formData.reminder_offsets, handleChange]);

  // Handle submit
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);

    try {
      // Validate required fields
      if (!formData.title?.trim()) throw new Error('Title is required');
      if (!formData.recurrence_rule) throw new Error('Recurrence pattern is required');
      if (!formData.start_date) throw new Error('Start date is required');

      // End condition validation
      if (formData.end_type === 'date' && !formData.end_date) {
        throw new Error('End date is required when using "End by date" option');
      }
      if (formData.end_type === 'count' && (!formData.end_count || formData.end_count < 1)) {
        throw new Error('Valid occurrence count is required when using "End after occurrences" option');
      }

      // Date relationship validation
      if (formData.end_type === 'date') {
        const start = parseDateInput(formData.start_date);
        const end = parseDateInput(formData.end_date);
        if (start && end && end < start) {
          throw new Error('End date cannot be earlier than start date');
        }
      }

      // Build payload with end condition
      const recurrence_rule = { ...(formData.recurrence_rule || {}) };

      if (recurrence_rule) {
        // We store end_date separately; keep rule clean for backend expectations
        delete recurrence_rule.until;
        delete recurrence_rule.count;
      }

      if (formData.end_type === 'count') {
        recurrence_rule.count = Number.parseInt(formData.end_count, 10);
      }

      const payload = {
        ...formData,
        recurrence_rule,
        workspace_id: workspaceId,
        end_date: formData.end_type === 'date' ? formData.end_date : null,
        project_id: formData.project_id || null,
        static_assignee_id: formData.static_assignee_id || null,
        approver_id: formData.approver_id || null,
        auto_close_after_days: formData.auto_close_after_days
          ? Number.parseInt(formData.auto_close_after_days, 10)
          : null,
        generation_mode: formData.generation_mode,
        generate_past: formData.generate_past,
        prevent_future: formData.prevent_future,
        category: formData.category || null,
        color: formData.color || '#0f766e',
      };

      if (mode === 'create') {
        await apiClient.post('/api/recurring', payload);
      } else {
        await apiClient.put(`/api/recurring/${seriesId}`, payload);
      }

      onSuccess?.();
    } catch (err) {
      setError(err?.response?.data?.error || err?.message || 'Failed to save series');
    } finally {
      setSaving(false);
    }
  };

  const sectionPaperSx = {
    p: 2,
    borderRadius: 2,
  };

  const stickyHeaderSx = {
    position: 'sticky',
    top: 0,
    zIndex: 10,
    bgcolor: 'background.paper',
    borderBottom: '1px solid',
    borderColor: 'divider',
    py: 1,
    mb: 2,
  };

  const smallField = { size: 'small', fullWidth: true };

  const colorPresets = ['#0f766e', '#2563eb', '#7c3aed', '#db2777', '#ea580c', '#16a34a', '#0b1f3b'];

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Box component="form" onSubmit={handleSubmit} noValidate>
        {/* Sticky Header */}
        <Box sx={stickyHeaderSx}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, px: 1 }}>
            <Button startIcon={<BackIcon />} onClick={onCancel} size="small">
              Back
            </Button>

            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 700, lineHeight: 1.2 }} noWrap>
                {mode === 'create' ? 'Create Recurring Series' : 'Edit Recurring Series'}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                Compact setup — basics first, advanced options collapsed
              </Typography>
            </Box>

            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={saving}
              size="small"
            >
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </Box>
        </Box>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        <Stack spacing={2}>
          {/* PRIMARY: Basic + Recurrence + Assignment */}
          <Paper sx={sectionPaperSx}>
            <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>
              Basics
            </Typography>

            <Grid container spacing={1.5}>
              {/* Row 1 */}
              <Grid item xs={12} md={8}>
                <TextField
                  {...smallField}
                  required
                  label="Title"
                  value={formData.title}
                  onChange={(e) => handleChange('title', e.target.value)}
                  placeholder="e.g., Weekly Status Report"
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl {...smallField}>
                  <InputLabel>Project</InputLabel>
                  <Select
                    value={formData.project_id}
                    onChange={(e) => handleChange('project_id', e.target.value)}
                    label="Project"
                  >
                    <MenuItem value="">No project</MenuItem>
                    {projectOptions.map((p) => (
                      <MenuItem key={p.id} value={p.id}>
                        {p.name}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Grid>

              {/* Description toggle */}
              <Grid item xs={12}>
                {!showDescription ? (
                  <Button
                    size="small"
                    startIcon={<DescriptionIcon />}
                    onClick={() => setShowDescription(true)}
                    sx={{ px: 0 }}
                  >
                    Add description (optional)
                  </Button>
                ) : (
                  <Box>
                    <TextField
                      {...smallField}
                      label="Description"
                      value={formData.description}
                      onChange={(e) => handleChange('description', e.target.value)}
                      multiline
                      rows={2}
                    />
                    <Box sx={{ mt: 0.5 }}>
                      <Button
                        size="small"
                        startIcon={<ClearIcon />}
                        onClick={() => {
                          handleChange('description', '');
                          setShowDescription(false);
                        }}
                        sx={{ px: 0 }}
                      >
                        Remove description
                      </Button>
                    </Box>
                  </Box>
                )}
              </Grid>

              {/* Row 2 */}
              <Grid item xs={12} md={4}>
                <DatePicker
                  label="Start Date"
                  value={parseDateInput(formData.start_date)}
                  onChange={(value) => handleChange('start_date', formatDateInput(value))}
                  inputFormat="dd-MMM-yyyy"
                  slotProps={{
                    textField: { ...smallField, required: true },
                  }}
                />
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl {...smallField}>
                  <InputLabel>Timezone</InputLabel>
                  <Select
                    value={formData.timezone}
                    onChange={(e) => handleChange('timezone', e.target.value)}
                    label="Timezone"
                  >
                    <MenuItem value="UTC">UTC</MenuItem>
                    <MenuItem value="America/New_York">Eastern (US)</MenuItem>
                    <MenuItem value="America/Chicago">Central (US)</MenuItem>
                    <MenuItem value="America/Denver">Mountain (US)</MenuItem>
                    <MenuItem value="America/Los_Angeles">Pacific (US)</MenuItem>
                    <MenuItem value="Europe/London">London</MenuItem>
                    <MenuItem value="Europe/Paris">Paris</MenuItem>
                    <MenuItem value="Asia/Tokyo">Tokyo</MenuItem>
                    <MenuItem value="Asia/Kolkata">India</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                <FormControl {...smallField}>
                  <InputLabel>Category</InputLabel>
                  <Select
                    value={formData.category}
                    onChange={(e) => handleChange('category', e.target.value)}
                    label="Category"
                  >
                    <MenuItem value="">None</MenuItem>
                    <MenuItem value="daily">📆 Daily Tasks</MenuItem>
                    <MenuItem value="weekly">📅 Weekly Tasks</MenuItem>
                    <MenuItem value="monthly">🗓️ Monthly Tasks</MenuItem>
                    <MenuItem value="yearly">📊 Yearly Tasks</MenuItem>
                    <MenuItem value="reports">📋 Reports</MenuItem>
                    <MenuItem value="maintenance">🔧 Maintenance</MenuItem>
                    <MenuItem value="reviews">👁️ Reviews</MenuItem>
                    <MenuItem value="meetings">🤝 Meetings</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              {/* Row 3: Color */}
              <Grid item xs={12}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                  <Typography variant="caption" sx={{ fontWeight: 700, mr: 0.5 }}>
                    Color
                  </Typography>

                  <TextField
                    type="color"
                    size="small"
                    value={formData.color}
                    onChange={(e) => handleChange('color', e.target.value)}
                    sx={{ width: 56, '& input': { padding: '6px' } }}
                  />

                  {colorPresets.map((c) => (
                    <Box
                      key={c}
                      onClick={() => handleChange('color', c)}
                      sx={{
                        width: 18,
                        height: 18,
                        borderRadius: '999px',
                        bgcolor: c,
                        cursor: 'pointer',
                        outline: formData.color === c ? '2px solid' : '1px solid',
                        outlineColor: formData.color === c ? 'text.primary' : 'divider',
                      }}
                      title={c}
                    />
                  ))}

                  <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                    (Used for quick recognition)
                  </Typography>
                </Box>
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Recurrence */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Recurrence
              </Typography>
              <Tooltip title="Set the repeat pattern. End condition is controlled below.">
                <IconButton size="small">
                  <HelpOutlineIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>

            <RecurrenceRuleBuilder
              value={formData.recurrence_rule}
              onChange={handleRecurrenceRuleChange}
              startDate={formData.start_date}
            />

            <Divider sx={{ my: 2 }} />

            {/* End condition row */}
            <Grid container spacing={1.5} alignItems="center">
              <Grid item xs={12} md={4}>
                <FormControl {...smallField}>
                  <InputLabel>End</InputLabel>
                  <Select
                    value={formData.end_type}
                    onChange={(e) => handleChange('end_type', e.target.value)}
                    label="End"
                  >
                    <MenuItem value="never">Never</MenuItem>
                    <MenuItem value="date">By date</MenuItem>
                    <MenuItem value="count">After occurrences</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={4}>
                {formData.end_type === 'date' ? (
                  <DatePicker
                    label="End Date"
                    value={parseDateInput(formData.end_date)}
                    onChange={(value) => handleChange('end_date', formatDateInput(value))}
                    inputFormat="dd-MMM-yyyy"
                    slotProps={{
                      textField: {
                        ...smallField,
                        required: true,
                        error: !formData.end_date,
                        helperText: !formData.end_date ? 'Required' : '',
                      },
                    }}
                  />
                ) : formData.end_type === 'count' ? (
                  <TextField
                    {...smallField}
                    required
                    type="number"
                    label="Occurrences"
                    value={formData.end_count}
                    onChange={(e) => handleChange('end_count', e.target.value)}
                    inputProps={{ min: 1, max: 365 }}
                    error={!formData.end_count || Number(formData.end_count) < 1}
                    helperText={!formData.end_count ? 'Required' : ''}
                  />
                ) : (
                  <TextField
                    {...smallField}
                    label="End Details"
                    value="—"
                    disabled
                    helperText="No end condition"
                  />
                )}
              </Grid>

              <Grid item xs={12} md={4}>
                <TextField
                  {...smallField}
                  label="Status / Stage"
                  value={`${formData.template.status} • ${formData.template.stage}`}
                  disabled
                  helperText="Defaults shown below (Template section)"
                />
              </Grid>
            </Grid>

            <Divider sx={{ my: 2 }} />

            {/* Assignment (compact one-row) */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Assignment
              </Typography>
              <Tooltip title="Static assigns every instance to one person. Round robin rotates among selected members.">
                <IconButton size="small">
                  <HelpOutlineIcon fontSize="inherit" />
                </IconButton>
              </Tooltip>
            </Box>

            <Grid container spacing={1.5}>
              <Grid item xs={12} md={4}>
                <FormControl {...smallField}>
                  <InputLabel>Strategy</InputLabel>
                  <Select
                    value={formData.assignment_strategy}
                    onChange={(e) => handleChange('assignment_strategy', e.target.value)}
                    label="Strategy"
                  >
                    <MenuItem value="static">Static</MenuItem>
                    <MenuItem value="round_robin">Round Robin</MenuItem>
                  </Select>
                </FormControl>
              </Grid>

              <Grid item xs={12} md={8}>
                {formData.assignment_strategy === 'static' ? (
                  <Autocomplete
                    size="small"
                    options={memberOptions}
                    value={selectedStaticAssignee}
                    onChange={(_, newValue) => handleChange('static_assignee_id', newValue?.id || '')}
                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                    getOptionLabel={(opt) => opt.label || ''}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24 }}>
                          {(option.first_name?.[0] || option.email?.[0] || 'M').toUpperCase()}
                        </Avatar>
                        <Typography variant="body2">{option.label}</Typography>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="Assignee (optional)" placeholder="Unassigned" />
                    )}
                    clearOnEscape
                  />
                ) : (
                  <Autocomplete
                    multiple
                    size="small"
                    options={memberOptions}
                    value={selectedRotationMembers}
                    onChange={(_, newValue) => handleChange('rotation_members', newValue.map((m) => m.id))}
                    isOptionEqualToValue={(opt, val) => opt.id === val.id}
                    getOptionLabel={(opt) => opt.label || ''}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 24, height: 24 }}>
                          {(option.first_name?.[0] || option.email?.[0] || 'M').toUpperCase()}
                        </Avatar>
                        <Typography variant="body2">{option.label}</Typography>
                      </Box>
                    )}
                    renderInput={(params) => (
                      <TextField {...params} label="Rotation Members" placeholder="Select members" />
                    )}
                    renderTags={(value, getTagProps) =>
                      value.map((option, index) => (
                        <Chip
                          size="small"
                          label={option.label}
                          {...getTagProps({ index })}
                          key={option.id}
                        />
                      ))
                    }
                  />
                )}
              </Grid>
            </Grid>
          </Paper>

          {/* Collapsible: Approval */}
          <Accordion defaultExpanded={false} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography sx={{ fontWeight: 800 }}>Approval</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  Optional
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={1.5} alignItems="center">
                <Grid item xs={12} md={4}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.requires_approval}
                        onChange={(e) => handleChange('requires_approval', e.target.checked)}
                        size="small"
                      />
                    }
                    label="Require approval"
                  />
                </Grid>

                <Grid item xs={12} md={8}>
                  {formData.requires_approval ? (
                    <Autocomplete
                      size="small"
                      options={memberOptions}
                      value={selectedApprover}
                      onChange={(_, newValue) => handleChange('approver_id', newValue?.id || '')}
                      isOptionEqualToValue={(opt, val) => opt.id === val.id}
                      getOptionLabel={(opt) => opt.label || ''}
                      renderOption={(props, option) => (
                        <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Avatar sx={{ width: 24, height: 24 }}>
                            {(option.first_name?.[0] || option.email?.[0] || 'M').toUpperCase()}
                          </Avatar>
                          <Typography variant="body2">{option.label}</Typography>
                        </Box>
                      )}
                      renderInput={(params) => (
                        <TextField {...params} label="Approver" placeholder="Select approver" />
                      )}
                    />
                  ) : (
                    <TextField size="small" fullWidth label="Approver" value="—" disabled />
                  )}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Collapsible: Generation + Template */}
          <Accordion defaultExpanded={false} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography sx={{ fontWeight: 800 }}>Generation & Template</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  Recommended settings
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}>
                  <FormControl {...smallField}>
                    <InputLabel>Generation Mode</InputLabel>
                    <Select
                      value={formData.generation_mode}
                      onChange={(e) => handleChange('generation_mode', e.target.value)}
                      label="Generation Mode"
                      size="small"
                    >
                      <MenuItem value="auto">🔄 Auto (on save)</MenuItem>
                      <MenuItem value="manual">✋ Manual (generate later)</MenuItem>
                    </Select>
                  </FormControl>

                  <Box sx={{ mt: 1 }}>
                    <FormGroup row>
                      <Tooltip title="Only create instances up to today (recommended)">
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.prevent_future}
                              onChange={(e) => handleChange('prevent_future', e.target.checked)}
                              size="small"
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Prevent future
                              <HelpOutlineIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                            </Box>
                          }
                        />
                      </Tooltip>

                      <Tooltip title="If start date is before today, create instances for past dates">
                        <FormControlLabel
                          control={
                            <Switch
                              checked={formData.generate_past}
                              onChange={(e) => handleChange('generate_past', e.target.checked)}
                              size="small"
                            />
                          }
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              Backfill past
                              <HelpOutlineIcon sx={{ fontSize: 16, opacity: 0.7 }} />
                            </Box>
                          }
                        />
                      </Tooltip>
                    </FormGroup>
                  </Box>
                </Grid>

                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" sx={{ fontWeight: 800, mb: 1 }}>
                    Task Template
                  </Typography>

                  <Grid container spacing={1.5}>
                    <Grid item xs={12} sm={6}>
                      <FormControl {...smallField}>
                        <InputLabel>Priority</InputLabel>
                        <Select
                          value={formData.template.priority}
                          onChange={(e) => handleTemplateChange('priority', e.target.value)}
                          label="Priority"
                          size="small"
                        >
                          <MenuItem value="Critical">Critical</MenuItem>
                          <MenuItem value="High">High</MenuItem>
                          <MenuItem value="Medium">Medium</MenuItem>
                          <MenuItem value="Low">Low</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>

                    <Grid item xs={12} sm={6}>
                      <FormControl {...smallField}>
                        <InputLabel>Stage</InputLabel>
                        <Select
                          value={formData.template.stage}
                          onChange={(e) => handleTemplateChange('stage', e.target.value)}
                          label="Stage"
                          size="small"
                        >
                          <MenuItem value="Planned">Planned</MenuItem>
                          <MenuItem value="In-process">In-process</MenuItem>
                        </Select>
                      </FormControl>
                    </Grid>
                  </Grid>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>

          {/* Collapsible: Advanced */}
          <Accordion defaultExpanded={false} sx={{ borderRadius: 2, overflow: 'hidden' }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%' }}>
                <Typography sx={{ fontWeight: 800 }}>Advanced</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                  Reminders, auto-close
                </Typography>
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={1.5}>
                <Grid item xs={12} md={6}>
                  <TextField
                    size="small"
                    fullWidth
                    type="number"
                    label="Auto-close after (days)"
                    value={formData.auto_close_after_days}
                    onChange={(e) => handleChange('auto_close_after_days', e.target.value)}
                    helperText="Automatically close overdue tasks after this many days"
                    inputProps={{ min: 1 }}
                  />
                </Grid>

                <Grid item xs={12} md={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                    <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
                      Reminders
                    </Typography>
                    <Tooltip title="Click chips to add/remove reminders. Use Custom for a specific value.">
                      <IconButton size="small">
                        <HelpOutlineIcon fontSize="inherit" />
                      </IconButton>
                    </Tooltip>

                    <Box sx={{ ml: 'auto' }}>
                      <Button
                        size="small"
                        startIcon={<ClearIcon />}
                        onClick={() => handleChange('reminder_offsets', [])}
                      >
                        Clear
                      </Button>
                    </Box>
                  </Box>

                  <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                    {REMINDER_PRESETS.map((preset, i) => {
                      const isSelected = presetSelected(preset);
                      return (
                        <Chip
                          key={i}
                          size="small"
                          label={preset.label}
                          variant={isSelected ? 'filled' : 'outlined'}
                          color={isSelected ? 'primary' : 'default'}
                          onClick={() => toggleReminderPreset(preset)}
                        />
                      );
                    })}

                    <Chip
                      size="small"
                      icon={showCustomReminder ? <ClearIcon /> : <AddIcon />}
                      label={showCustomReminder ? 'Hide custom' : 'Custom'}
                      variant="outlined"
                      onClick={() => setShowCustomReminder((v) => !v)}
                    />
                  </Stack>

                  {showCustomReminder && (
                    <Grid container spacing={1.25} sx={{ mt: 1 }}>
                      <Grid item xs={6}>
                        <TextField
                          size="small"
                          fullWidth
                          type="number"
                          label="Value"
                          value={customReminderValue}
                          onChange={(e) => setCustomReminderValue(e.target.value)}
                          inputProps={{ min: 1, max: 999 }}
                        />
                      </Grid>
                      <Grid item xs={6}>
                        <FormControl fullWidth size="small">
                          <InputLabel>Unit</InputLabel>
                          <Select
                            value={customReminderUnit}
                            onChange={(e) => setCustomReminderUnit(e.target.value)}
                            label="Unit"
                          >
                            <MenuItem value="minutes">minutes</MenuItem>
                            <MenuItem value="hours">hours</MenuItem>
                            <MenuItem value="days">days</MenuItem>
                            <MenuItem value="weeks">weeks</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>

                      <Grid item xs={12}>
                        <Button size="small" variant="outlined" onClick={addCustomReminder}>
                          Add custom reminder
                        </Button>
                      </Grid>

                      {formData.reminder_offsets?.length > 0 && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">
                            Active: {formData.reminder_offsets.map((r) => `${r.value} ${r.unit}`).join(', ')}
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  )}
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Stack>

        {/* Bottom spacer */}
        <Box sx={{ height: 24 }} />
      </Box>
    </LocalizationProvider>
  );
}

export default SeriesForm;
