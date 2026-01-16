import React, { useState, useEffect, useCallback } from 'react';
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
    Chip
} from '@mui/material';
import {
    Save as SaveIcon,
    ArrowBack as BackIcon,
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
    
    // Form state
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        project_id: '',
        recurrence_rule: null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        start_date: formatDateInput(new Date()),
        end_date: '',
        end_type: 'date', // 'date', 'count', or 'never' - default to date for mandatory
        end_count: 10,
        assignment_strategy: 'static',
        static_assignee_id: '',
        rotation_members: [],
        requires_approval: false,
        approver_id: '',
        auto_close_after_days: '',
        reminder_offsets: [],
        template: {
            priority: 'Medium',
            status: 'Open',
            stage: 'Planned'
        }
    });

    // Fetch initial data
    useEffect(() => {
        const fetchData = async () => {
            try {
                // Fetch projects
                const projectsRes = await apiClient.get(`/api/projects/workspace/${workspaceId}`);
                console.log('Projects loaded:', projectsRes.data);
                setProjects(projectsRes.data || []);
                
                // Fetch workspace members
                const membersRes = await apiClient.get(`/api/workspaces/${workspaceId}/members`);
                console.log('Members loaded:', membersRes.data);
                setMembers(membersRes.data || []);
                
                // Fetch series if editing
                if (mode === 'edit' && seriesId) {
                    const seriesRes = await apiClient.get(`/api/recurring/${seriesId}`);
                    const series = seriesRes.data;
                    const recurrenceRule = normalizeJsonValue(series.recurrence_rule, null);
                    const reminderOffsets = normalizeJsonValue(series.reminder_offsets, []);
                    const template = normalizeJsonValue(series.template, {
                        priority: 'Medium',
                        status: 'Open',
                        stage: 'Planned'
                    });
                    setFormData({
                        title: series.title || '',
                        description: series.description || '',
                        project_id: series.project_id || '',
                        recurrence_rule: recurrenceRule,
                        timezone: series.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
                        start_date: formatDateInput(series.start_date),
                        end_date: formatDateInput(series.end_date),
                        end_type: series.end_date ? 'date' : (recurrenceRule?.count ? 'count' : 'date'),
                        end_count: recurrenceRule?.count || 10,
                        assignment_strategy: series.assignment_strategy || 'static',
                        static_assignee_id: series.static_assignee_id || '',
                        rotation_members: series.rotation_members?.map(m => m.user_id || m.id) || [],
                        requires_approval: series.requires_approval || false,
                        approver_id: series.approver_id || '',
                        auto_close_after_days: series.auto_close_after_days || '',
                        reminder_offsets: reminderOffsets || [],
                        template
                    });
                }
            } catch (err) {
                console.error('Error fetching data:', err);
                setError('Failed to load form data');
            } finally {
                setLoading(false);
            }
        };
        
        fetchData();
    }, [workspaceId, seriesId, mode]);

    // Handle form field changes
    const handleChange = useCallback((field, value) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    }, []);

    // Handle template changes
    const handleTemplateChange = useCallback((field, value) => {
        setFormData(prev => ({
            ...prev,
            template: { ...prev.template, [field]: value }
        }));
    }, []);

    const handleRecurrenceRuleChange = useCallback((rule) => {
        setFormData(prev => ({ ...prev, recurrence_rule: rule }));
    }, []);

    // Handle submit
    const handleSubmit = async (e) => {
        e.preventDefault();
        setError(null);
        setSaving(true);

        try {
            // Validate required fields
            if (!formData.title) {
                throw new Error('Title is required');
            }
            if (!formData.recurrence_rule) {
                throw new Error('Recurrence pattern is required');
            }
            if (!formData.start_date) {
                throw new Error('Start date is required');
            }
            // End condition validation - mandatory
            if (formData.end_type === 'date' && !formData.end_date) {
                throw new Error('End date is required when using "End by date" option');
            }
            if (formData.end_type === 'count' && (!formData.end_count || formData.end_count < 1)) {
                throw new Error('Valid occurrence count is required when using "End after occurrences" option');
            }

            // Build payload with end condition
            const recurrence_rule = { ...formData.recurrence_rule };
            if (formData.end_type === 'count') {
                recurrence_rule.count = parseInt(formData.end_count);
            }

            const payload = {
                ...formData,
                recurrence_rule,
                workspace_id: workspaceId,
                end_date: formData.end_type === 'date' ? formData.end_date : null,
                project_id: formData.project_id || null,
                static_assignee_id: formData.static_assignee_id || null,
                approver_id: formData.approver_id || null,
                auto_close_after_days: formData.auto_close_after_days ? 
                    parseInt(formData.auto_close_after_days) : null
            };

            if (mode === 'create') {
                await apiClient.post('/api/recurring', payload);
            } else {
                await apiClient.put(`/api/recurring/${seriesId}`, payload);
            }

            onSuccess();
        } catch (err) {
            console.error('Error saving series:', err);
            setError(err.response?.data?.error || err.message || 'Failed to save series');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box component="form" onSubmit={handleSubmit}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
                <Button
                    startIcon={<BackIcon />}
                    onClick={onCancel}
                >
                    Back
                </Button>
                <Typography variant="h5" sx={{ flex: 1 }}>
                    {mode === 'create' ? 'Create Recurring Series' : 'Edit Recurring Series'}
                </Typography>
                <Button
                    type="submit"
                    variant="contained"
                    startIcon={<SaveIcon />}
                    disabled={saving}
                >
                    {saving ? 'Saving...' : 'Save'}
                </Button>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            <Stack spacing={3}>
                {/* Basic Info */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Basic Information</Typography>
                    
                    <Stack spacing={2}>
                        <TextField
                            required
                            fullWidth
                            label="Title"
                            value={formData.title}
                            onChange={(e) => handleChange('title', e.target.value)}
                            placeholder="e.g., Weekly Status Report"
                        />

                        <TextField
                            fullWidth
                            multiline
                            rows={2}
                            label="Description"
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                        />

                        <FormControl fullWidth>
                            <InputLabel>Project (Optional)</InputLabel>
                            <Select
                                value={formData.project_id}
                                onChange={(e) => handleChange('project_id', e.target.value)}
                                label="Project (Optional)"
                            >
                                <MenuItem value="">No project</MenuItem>
                                {projects.map(p => (
                                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>
                    </Stack>
                </Paper>

                {/* Recurrence Pattern */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Recurrence Pattern</Typography>
                    
                    <RecurrenceRuleBuilder
                        value={formData.recurrence_rule}
                        onChange={handleRecurrenceRuleChange}
                        startDate={formData.start_date}
                    />

                    <Divider sx={{ my: 2 }} />

                    <Typography variant="subtitle2" gutterBottom sx={{ mb: 1 }}>
                        End Condition <Typography component="span" color="error">*</Typography>
                    </Typography>
                    <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
                        <FormControl sx={{ minWidth: 180 }}>
                            <InputLabel>End Condition</InputLabel>
                            <Select
                                required
                                value={formData.end_type}
                                onChange={(e) => handleChange('end_type', e.target.value)}
                                label="End Condition"
                            >
                                <MenuItem value="date">End by date</MenuItem>
                                <MenuItem value="count">End after occurrences</MenuItem>
                            </Select>
                        </FormControl>
                        
                        {formData.end_type === 'date' && (
                            <DatePicker
                                label="End Date"
                                value={parseDateInput(formData.end_date)}
                                onChange={(value) => handleChange('end_date', formatDateInput(value))}
                                inputFormat="dd-MMM-yyyy"
                                slotProps={{ textField: { required: true, sx: { width: 200 }, error: !formData.end_date, helperText: !formData.end_date ? 'End date is required' : '' } }}
                            />
                        )}
                        
                        {formData.end_type === 'count' && (
                            <TextField
                                required
                                type="number"
                                label="Number of Occurrences"
                                value={formData.end_count}
                                onChange={(e) => handleChange('end_count', e.target.value)}
                                sx={{ width: 200 }}
                                inputProps={{ min: 1, max: 365 }}
                                error={!formData.end_count || formData.end_count < 1}
                                helperText={!formData.end_count ? 'Count is required' : ''}
                            />
                        )}
                    </Stack>

                    <Stack direction="row" spacing={2}>
                        <DatePicker
                            label="Start Date"
                            value={parseDateInput(formData.start_date)}
                            onChange={(value) => handleChange('start_date', formatDateInput(value))}
                            inputFormat="dd-MMM-yyyy"
                            slotProps={{ textField: { required: true, sx: { width: 200 } } }}
                        />
                        <FormControl sx={{ width: 200 }}>
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
                    </Stack>
                </Paper>

                {/* Assignment */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Assignment</Typography>
                    
                    <Stack spacing={2}>
                        <FormControl fullWidth>
                            <InputLabel>Assignment Strategy</InputLabel>
                            <Select
                                value={formData.assignment_strategy}
                                onChange={(e) => handleChange('assignment_strategy', e.target.value)}
                                label="Assignment Strategy"
                            >
                                <MenuItem value="static">Static (same person)</MenuItem>
                                <MenuItem value="round_robin">Round Robin (rotate)</MenuItem>
                            </Select>
                        </FormControl>

                        {formData.assignment_strategy === 'static' && (
                            <FormControl fullWidth>
                                <InputLabel>Assignee</InputLabel>
                                <Select
                                    value={formData.static_assignee_id}
                                    onChange={(e) => handleChange('static_assignee_id', e.target.value)}
                                    label="Assignee"
                                >
                                    <MenuItem value="">Unassigned</MenuItem>
                                    {members.map(m => (
                                        <MenuItem key={m.id} value={m.id}>
                                            {m.first_name} {m.last_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}

                        {formData.assignment_strategy === 'round_robin' && (
                            <Autocomplete
                                multiple
                                options={members}
                                getOptionLabel={(option) => `${option.first_name} ${option.last_name}`}
                                value={members.filter(m => formData.rotation_members.includes(m.id))}
                                onChange={(e, newValue) => {
                                    handleChange('rotation_members', newValue.map(m => m.id));
                                }}
                                renderInput={(params) => (
                                    <TextField
                                        {...params}
                                        label="Rotation Members"
                                        placeholder="Select members for rotation"
                                    />
                                )}
                                renderTags={(value, getTagProps) =>
                                    value.map((option, index) => (
                                        <Chip
                                            label={`${option.first_name} ${option.last_name}`}
                                            {...getTagProps({ index })}
                                            key={option.id}
                                        />
                                    ))
                                }
                            />
                        )}
                    </Stack>
                </Paper>

                {/* Approval */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Approval Workflow</Typography>
                    
                    <Stack spacing={2}>
                        <FormControlLabel
                            control={
                                <Switch
                                    checked={formData.requires_approval}
                                    onChange={(e) => handleChange('requires_approval', e.target.checked)}
                                />
                            }
                            label="Require approval for each task"
                        />

                        {formData.requires_approval && (
                            <FormControl fullWidth>
                                <InputLabel>Approver</InputLabel>
                                <Select
                                    value={formData.approver_id}
                                    onChange={(e) => handleChange('approver_id', e.target.value)}
                                    label="Approver"
                                >
                                    <MenuItem value="">Select approver</MenuItem>
                                    {members.map(m => (
                                        <MenuItem key={m.id} value={m.id}>
                                            {m.first_name} {m.last_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        )}
                    </Stack>
                </Paper>

                {/* Task Template */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Task Template</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Default values for generated tasks
                    </Typography>
                    
                    <Stack direction="row" spacing={2}>
                        <FormControl sx={{ minWidth: 150 }}>
                            <InputLabel>Priority</InputLabel>
                            <Select
                                value={formData.template.priority}
                                onChange={(e) => handleTemplateChange('priority', e.target.value)}
                                label="Priority"
                            >
                                <MenuItem value="Critical">Critical</MenuItem>
                                <MenuItem value="High">High</MenuItem>
                                <MenuItem value="Medium">Medium</MenuItem>
                                <MenuItem value="Low">Low</MenuItem>
                            </Select>
                        </FormControl>

                        <FormControl sx={{ minWidth: 150 }}>
                            <InputLabel>Stage</InputLabel>
                            <Select
                                value={formData.template.stage}
                                onChange={(e) => handleTemplateChange('stage', e.target.value)}
                                label="Stage"
                            >
                                <MenuItem value="Planned">Planned</MenuItem>
                                <MenuItem value="In-process">In-process</MenuItem>
                            </Select>
                        </FormControl>
                    </Stack>
                </Paper>

                {/* Advanced */}
                <Paper sx={{ p: 3 }}>
                    <Typography variant="h6" gutterBottom>Advanced Options</Typography>
                    
                    <Stack spacing={2}>
                        <TextField
                            type="number"
                            label="Auto-close after (days)"
                            value={formData.auto_close_after_days}
                            onChange={(e) => handleChange('auto_close_after_days', e.target.value)}
                            helperText="Automatically close overdue tasks after this many days"
                            sx={{ width: 250 }}
                            inputProps={{ min: 1 }}
                        />

                        <Box>
                            <Typography variant="subtitle2" gutterBottom>
                                Reminders
                            </Typography>
                            <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                                {REMINDER_PRESETS.map((preset, i) => {
                                    const isSelected = formData.reminder_offsets.some(
                                        r => r.value === preset.value && r.unit === preset.unit
                                    );
                                    return (
                                        <Chip
                                            key={i}
                                            label={preset.label}
                                            variant={isSelected ? 'filled' : 'outlined'}
                                            color={isSelected ? 'primary' : 'default'}
                                            onClick={() => {
                                                if (isSelected) {
                                                    handleChange('reminder_offsets', 
                                                        formData.reminder_offsets.filter(
                                                            r => !(r.value === preset.value && r.unit === preset.unit)
                                                        )
                                                    );
                                                } else {
                                                    handleChange('reminder_offsets', [
                                                        ...formData.reminder_offsets,
                                                        { value: preset.value, unit: preset.unit }
                                                    ]);
                                                }
                                            }}
                                        />
                                    );
                                })}
                            </Stack>
                        </Box>
                    </Stack>
                </Paper>
            </Stack>
            </Box>
        </LocalizationProvider>
    );
}

export default SeriesForm;
