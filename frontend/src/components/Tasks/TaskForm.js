import React, { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  Avatar,
  Typography,
  Autocomplete,
  IconButton,
  Snackbar,
  Alert,
  Paper,
  Divider,
  Tooltip,
  Checkbox,
  Popover,
  List,
  ListItemButton,
  ListItemIcon,
  FormControlLabel,
  Switch,
  Collapse,
} from '@mui/material';

import AvatarGroup from '@mui/material/AvatarGroup';
import CloseIcon from '@mui/icons-material/Close';
import PersonIcon from '@mui/icons-material/Person';
import RepeatIcon from '@mui/icons-material/Repeat';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ClearIcon from '@mui/icons-material/Clear';
import GroupIcon from '@mui/icons-material/Group';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';

import { getProjectColumnOptions, getProjectColumnSettings, getProjectMembers } from '../../apiClient';
import { formatShortDate } from '../../utils/date';

const stageOptions = ['Planned', 'In-process', 'Completed', 'On-hold', 'Dropped'];

const DEFAULT_COLUMN_SETTINGS = {
  enable_category: false,
  enable_section: false,
  enable_estimated_hours: false,
  enable_actual_hours: false,
  enable_completion_percentage: false,
  enable_tags: false,
  enable_external_id: false,
};

function canEditTask(task, userRole, isAssignee) {
  if (!task) return true;
  const status = task.status;
  const role = (userRole || '').toString().toLowerCase();
  const isAdminOrOwner = role === 'admin' || role === 'owner';

  if (status === 'Pending Approval' || status === 'Closed') return isAdminOrOwner;
  if (status === 'Rejected') return isAssignee || isAdminOrOwner;
  return true;
}

const getMemberLabel = (m) => {
  if (!m) return '';
  const name = m.first_name ? `${m.first_name} ${m.last_name || ''}`.trim() : (m.username || '');
  return name || m.name || m.email || '';
};

const getClientLabel = (client) => {
  if (!client) return '';
  const seriesNo = client.series_no || client.seriesNo || '';
  const legalName = client.legal_name || client.legalName || '';
  const name = client.name || client.client_name || '';
  if (seriesNo) {
    const tail = legalName || name;
    return tail ? `${seriesNo} - ${tail}` : seriesNo;
  }
  return legalName || name || '';
};

const getProjectLabel = (project) => {
  if (!project) return '';
  return project.name || project.project_name || project.projectName || '';
};

const isMidnightUtcString = (value) => {
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (!trimmed.includes('T')) return false;
  const [, timePartRaw = ''] = trimmed.split('T');
  const timePart = timePartRaw.toUpperCase();
  const isMidnight = timePart.startsWith('00:00:00') || timePart.startsWith('00:00');
  const isUtc = timePart.includes('Z') || timePart.includes('+00') || timePart.includes('-00');
  return isMidnight && isUtc;
};

const parseLocalDate = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value;

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.includes('T') && !isMidnightUtcString(trimmed)) {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const datePart = trimmed.split('T')[0].split(' ')[0];
    const parts = datePart.split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      const year = Number(parts[0]);
      const month = Number(parts[1]) - 1;
      const day = Number(parts[2]);
      if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
        return new Date(year, month, day);
      }
    }
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const formatDateForApi = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (trimmed.includes('T') && !isMidnightUtcString(trimmed)) {
      const parsed = new Date(trimmed);
      return Number.isNaN(parsed.getTime()) ? null : formatDateForApi(parsed);
    }
    const parsed = parseLocalDate(trimmed);
    return parsed ? formatDateForApi(parsed) : null;
  }
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;
  const isUtcMidnight = value.getUTCHours() === 0
    && value.getUTCMinutes() === 0
    && value.getUTCSeconds() === 0
    && value.getUTCMilliseconds() === 0;
  const useUtc = isUtcMidnight && !(value.getHours() === 0 && value.getMinutes() === 0 && value.getSeconds() === 0);
  const year = useUtc ? value.getUTCFullYear() : value.getFullYear();
  const month = String((useUtc ? value.getUTCMonth() : value.getMonth()) + 1).padStart(2, '0');
  const day = String(useUtc ? value.getUTCDate() : value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitials = (m) => {
  const label = getMemberLabel(m).trim();
  const parts = label.split(/\s+/).filter(Boolean);
  if (!parts.length) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
};

const Section = ({ title, children }) => (
  <Paper
    variant="outlined"
    sx={{
      p: 1.75,
      borderRadius: 2,
      bgcolor: '#fff',
      borderColor: 'rgba(148,163,184,0.25)',
    }}
  >
    <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
      {title}
    </Typography>
    <Divider sx={{ mb: 1.5, borderColor: 'rgba(148,163,184,0.20)' }} />
    {children}
  </Paper>
);

function TaskForm({
  open,
  onClose,
  onSave,
  task = null,
  prefilledStage = null,
  prefilledStatus = null,
  projectId = null,
  projectClients = [],
  primaryClient = null,
  userRole = null,
  currentUserId = null,
  workspaceProjects = [],
  enableMultiProjectLinks = false,
  onDelete,
  onCreateRecurring,
}) {
  const isEdit = Boolean(task);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    stage: prefilledStage || 'Planned',
    status: prefilledStatus || 'Open',
    dueDate: null,
    targetDate: null,
    assignee: null,
    collaborators: [],
    notes: '',
    priority: 'Medium',
    isRecurring: false,
    recurrencePattern: 'weekly',
    clientId: null,
    linkedProjectIds: [],
    // Custom columns (Feature 1)
    category: '',
    section: '',
    estimatedHours: '',
    actualHours: '',
    completionPercentage: '',
    tags: [],
    externalId: '',
  });

  const [projectMembers, setProjectMembers] = useState([]);
  const [columnSettings, setColumnSettings] = useState(DEFAULT_COLUMN_SETTINGS);
  const [columnOptions, setColumnOptions] = useState({ category: [], section: [] });
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });

  const normalizedRole = (userRole || '').toString().toLowerCase();
  const isAdminOrOwner = normalizedRole === 'admin' || normalizedRole === 'owner';

  const isAssignee =
    task &&
    currentUserId &&
    (task.assignee_id === currentUserId ||
      task.assignee === currentUserId ||
      String(task.assignee_id) === String(currentUserId));

  const canEdit = canEditTask(task, normalizedRole, isAssignee);
  const canDelete = isEdit && onDelete && isAdminOrOwner;

  // keep your rule: dates locked for non-admin/owner on edit
  const lockDates = isEdit && !isAdminOrOwner;

  // Date picker open states (so click anywhere opens calendar)
  const [openTarget, setOpenTarget] = useState(false);
  const [openDue, setOpenDue] = useState(false);

  // collaborators picker popover
  const [collabAnchorEl, setCollabAnchorEl] = useState(null);
  const [collabQuery, setCollabQuery] = useState('');
  const collabPopoverOpen = Boolean(collabAnchorEl);

  const memberOptions = useMemo(() => projectMembers || [], [projectMembers]);

  const rawProjectClients = useMemo(
    () => (Array.isArray(projectClients) ? projectClients : []),
    [projectClients]
  );

  const primaryProjectClient = useMemo(() => {
    if (primaryClient && primaryClient.id) return primaryClient;
    return rawProjectClients.find((client) => client.is_primary) || null;
  }, [primaryClient, rawProjectClients]);

  const projectClientOptions = useMemo(() => {
    if (!rawProjectClients.length && !primaryProjectClient) return [];
    if (!primaryProjectClient) return rawProjectClients;
    const exists = rawProjectClients.some(
      (client) => String(client.id) === String(primaryProjectClient.id)
    );
    return exists ? rawProjectClients : [primaryProjectClient, ...rawProjectClients];
  }, [rawProjectClients, primaryProjectClient]);

  const showClientSelect = projectClientOptions.length > 1;

  const defaultClientId = useMemo(() => {
    if (projectClientOptions.length === 1) return projectClientOptions[0].id;
    if (primaryProjectClient?.id) return primaryProjectClient.id;
    return null;
  }, [projectClientOptions, primaryProjectClient]);

  const currentUserMember = useMemo(() => {
    if (!currentUserId) return null;
    return memberOptions.find((m) => String(m.id) === String(currentUserId)) || null;
  }, [memberOptions, currentUserId]);

  const linkableProjects = useMemo(() => {
    const list = Array.isArray(workspaceProjects) ? workspaceProjects : [];
    return list.filter((project) => {
      if (!project?.id) return false;
      if (projectId && String(project.id) === String(projectId)) return false;
      if (project.archived) return false;
      return true;
    });
  }, [workspaceProjects, projectId]);

  const linkedProjectIdSet = useMemo(() => {
    const ids = Array.isArray(formData.linkedProjectIds) ? formData.linkedProjectIds : [];
    return new Set(ids.map((id) => String(id)));
  }, [formData.linkedProjectIds]);

  const selectedLinkedProjects = useMemo(
    () => linkableProjects.filter((project) => linkedProjectIdSet.has(String(project.id))),
    [linkableProjects, linkedProjectIdSet]
  );

  const collaboratorCandidates = useMemo(() => {
    const aid = formData.assignee?.id;
    const base = memberOptions.filter((m) => !aid || String(m.id) !== String(aid));
    const q = collabQuery.trim().toLowerCase();
    if (!q) return base;

    return base.filter((m) => {
      const label = getMemberLabel(m).toLowerCase();
      const email = (m.email || '').toLowerCase();
      return label.includes(q) || email.includes(q);
    });
  }, [memberOptions, formData.assignee, collabQuery]);

  const normalizeColumnOptions = (res, columnType) => {
    const data = res?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.grouped?.[columnType])) return data.grouped[columnType];
    if (Array.isArray(data?.options)) {
      return data.options.filter((option) => option.column_name === columnType);
    }
    return [];
  };

  const categoryOptions = columnOptions.category || [];
  const sectionOptions = columnOptions.section || [];

  const showCategory = columnSettings.enable_category && categoryOptions.length > 0;
  const showSection = columnSettings.enable_section && sectionOptions.length > 0;

  const showEstimated = columnSettings.enable_estimated_hours;
  const showActual = columnSettings.enable_actual_hours;
  const showCompletion = columnSettings.enable_completion_percentage;
  const showTags = columnSettings.enable_tags;
  const showExternalId = columnSettings.enable_external_id;
  const showCustomFieldsSection =
    showEstimated || showActual || showCompletion || showTags || showExternalId;

  const categoryValue = showCategory && categoryOptions.some((opt) => opt.option_value === formData.category)
    ? formData.category
    : '';
  const sectionValue = showSection && sectionOptions.some((opt) => opt.option_value === formData.section)
    ? formData.section
    : '';

  const dateColumns = ['156px', '156px'];
  const metaColWidth = '165px';
  const clientColWidth = '185px';
  if (showCategory) dateColumns.push(metaColWidth);
  if (showSection) dateColumns.push(metaColWidth);
  if (showClientSelect) dateColumns.push(clientColWidth);
  const dateGridTemplateMd = dateColumns.join(' ');

  useEffect(() => {
    if (task) {
      const initialStage = task.status === 'Rejected' ? 'In-process' : (task.stage || 'Planned');

      setFormData({
        name: task.name || '',
        description: task.description || '',
        stage: initialStage,
        status: task.status || 'Open',
        dueDate: parseLocalDate(task.due_date || task.dueDate),
        targetDate: parseLocalDate(task.target_date || task.targetDate),
        assignee: null,
        collaborators: [],
        notes: task.notes || '',
        priority: task.priority || 'Medium',
        isRecurring: false,
        recurrencePattern: 'weekly',
        clientId: task.client_id || task.clientId || null,
        linkedProjectIds: Array.isArray(task.linked_project_ids || task.linkedProjectIds)
          ? (task.linked_project_ids || task.linkedProjectIds)
          : [],
        // Custom columns (Feature 1)
        category: task.category || '',
        section: task.section || '',
        estimatedHours: task.estimated_hours || '',
        actualHours: task.actual_hours || '',
        completionPercentage: task.completion_percentage || '',
        tags: task.tags || [],
        externalId: task.external_id || '',
      });
    } else {
      setFormData({
        name: '',
        description: '',
        stage: prefilledStage || 'Planned',
        status: prefilledStatus || 'Open',
        dueDate: null,
        targetDate: null,
        assignee: null,
        collaborators: [],
        notes: '',
        priority: 'Medium',
        isRecurring: false,
        recurrencePattern: 'weekly',
        clientId: null,
        linkedProjectIds: [],
        // Custom columns (Feature 1)
        category: '',
        section: '',
        estimatedHours: '',
        actualHours: '',
        completionPercentage: '',
        tags: [],
        externalId: '',
      });
    }
  }, [task, prefilledStage, prefilledStatus, open]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!projectId) return;
      try {
        const res = await getProjectMembers(projectId);
        setProjectMembers(res.data || []);
      } catch (err) {
        console.error('Failed to fetch project members:', err);
        setProjectMembers([]);
      }
    };
    if (open && projectId) fetchMembers();
  }, [projectId, open]);

  useEffect(() => {
    if (!projectId || !open) return;
    let active = true;

    const fetchColumnData = async () => {
      try {
        const [settingsRes, categoryRes, sectionRes] = await Promise.all([
          getProjectColumnSettings(projectId),
          getProjectColumnOptions(projectId, 'category'),
          getProjectColumnOptions(projectId, 'section'),
        ]);

        if (!active) return;

        setColumnSettings({ ...DEFAULT_COLUMN_SETTINGS, ...(settingsRes.data || {}) });
        setColumnOptions({
          category: normalizeColumnOptions(categoryRes, 'category'),
          section: normalizeColumnOptions(sectionRes, 'section'),
        });
      } catch (err) {
        console.error('Failed to fetch column settings:', err);
        if (!active) return;
        setColumnSettings(DEFAULT_COLUMN_SETTINGS);
        setColumnOptions({ category: [], section: [] });
      }
    };

    setColumnSettings(DEFAULT_COLUMN_SETTINGS);
    setColumnOptions({ category: [], section: [] });
    fetchColumnData();

    return () => {
      active = false;
    };
  }, [projectId, open]);

  useEffect(() => {
    if (!open) return;
    if (!defaultClientId) return;

    setFormData((prev) => {
      if (prev.clientId) return prev;
      return { ...prev, clientId: defaultClientId };
    });
  }, [defaultClientId, open]);

  useEffect(() => {
    if (!task || projectMembers.length === 0) return;

    const findMemberFor = (val) => {
      if (!val) return null;

      if (typeof val === 'object') {
        const id = val.id || val.user_id || val.userId || null;
        if (id) return projectMembers.find((m) => String(m.id) === String(id)) || null;
        if (val.name) return projectMembers.find((m) => getMemberLabel(m) === val.name) || null;
      }

      let found = projectMembers.find((m) => String(m.id) === String(val));
      if (found) return found;

      found = projectMembers.find((m) => m.email === val);
      if (found) return found;

      found = projectMembers.find((m) => getMemberLabel(m) === val);
      return found || null;
    };

    const assigneeVal = task.assignee_id || task.assignee || task.assignee_name || null;
    const assigneeObj = findMemberFor(assigneeVal);

    const collaboratorsObjs = Array.isArray(task.collaborators)
      ? task.collaborators.map((c) => findMemberFor(c)).filter(Boolean)
      : [];

    setFormData((prev) => ({
      ...prev,
      assignee: assigneeObj,
      collaborators: collaboratorsObjs.filter(
        (c) => !assigneeObj || String(c.id) !== String(assigneeObj.id)
      ),
    }));
  }, [projectMembers, task]);

  const handleChange = (field, value) => setFormData((prev) => ({ ...prev, [field]: value }));

  const handleStageChange = (newStage) => {
    setFormData((prev) => {
      let newStatus = prev.status;

      if (newStage === 'Completed') newStatus = 'Pending Approval';
      else if (newStage === 'Planned' || newStage === 'In-process') {
        if (prev.status === 'Pending Approval' || prev.status === 'Closed') newStatus = 'Open';
      } else {
        if (prev.status === 'Pending Approval') newStatus = 'Open';
      }

      return { ...prev, stage: newStage, status: newStatus };
    });
  };

  const handleAssigneeChange = (_, value) => {
    setFormData((prev) => ({
      ...prev,
      assignee: value,
      collaborators: (prev.collaborators || []).filter(
        (c) => !value || String(c.id) !== String(value.id)
      ),
    }));
  };

  const isCollaboratorSelected = (m) =>
    (formData.collaborators || []).some((c) => String(c.id) === String(m.id));

  const toggleCollaborator = (m) => {
    setFormData((prev) => {
      const exists = (prev.collaborators || []).some((c) => String(c.id) === String(m.id));
      const next = exists
        ? (prev.collaborators || []).filter((c) => String(c.id) !== String(m.id))
        : [...(prev.collaborators || []), m];
      return { ...prev, collaborators: next };
    });
  };

  const openCollaboratorsPicker = (anchorEl) => {
    if (!canEdit) return;
    setCollabAnchorEl(anchorEl);
    setCollabQuery('');
  };

  const handleSubmit = () => {
    if (!canEdit) {
      setToast({ open: true, severity: 'error', message: 'You do not have permission to edit this task' });
      return;
    }

    if (formData.assignee) {
      const found = memberOptions.find((m) => String(m.id) === String(formData.assignee.id));
      if (!found) {
        setToast({ open: true, severity: 'error', message: 'Assignee must be a project member' });
        return;
      }
    }

    if (formData.collaborators?.length) {
      const invalid = formData.collaborators.some(
        (c) => !memberOptions.find((m) => String(m.id) === String(c.id))
      );
      if (invalid) {
        setToast({ open: true, severity: 'error', message: 'All collaborators must be project members' });
        return;
      }
    }

    const taskData = {
      ...formData,
      id: task?.id || Date.now(),
      assignee: formData.assignee || null,
      collaborators: formData.collaborators || [],
      dueDate: formatDateForApi(formData.dueDate),
      targetDate: formatDateForApi(formData.targetDate),
      createdBy: task?.created_by_name || task?.createdBy || null,
      createdDate: task?.created_at || task?.createdDate || null,
      clientId: formData.clientId || null,
      // Custom columns (Feature 1)
      category: formData.category || null,
      section: formData.section || null,
      estimated_hours: formData.estimatedHours ? parseFloat(formData.estimatedHours) : null,
      actual_hours: formData.actualHours ? parseFloat(formData.actualHours) : null,
      completion_percentage: formData.completionPercentage ? parseInt(formData.completionPercentage) : null,
      tags: formData.tags || [],
      external_id: formData.externalId || null,
    };

    if (enableMultiProjectLinks) {
      taskData.linkedProjectIds = formData.linkedProjectIds || [];
    }

    onSave(taskData);
    onClose();
  };

  // smaller controls (premium compact)
  const fieldSx = {
    '& .MuiOutlinedInput-root': {
      borderRadius: 2,
      minHeight: 44,
      bgcolor: 'rgba(15,118,110,0.03)',
    },
    '& .MuiInputLabel-root': { fontWeight: 700 },
  };

  const selectSx = {
    borderRadius: 2,
    minHeight: 44,
    bgcolor: 'rgba(15,118,110,0.03)',
    '& .MuiSelect-select': {
      whiteSpace: 'nowrap',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
    },
  };

  const iconBtnSx = {
    borderRadius: 2,
    border: '1px solid rgba(148,163,184,0.35)',
    bgcolor: '#fff',
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth={false}
        fullWidth
        scroll="body"
        PaperProps={{
          sx: {
            width: { xs: '74vw', md: '66vw' },
            maxWidth: '1040px',
            borderRadius: 2.5,
            overflow: 'hidden',
          },
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            py: 1.4,
            px: 2,
            bgcolor: 'rgba(15,118,110,0.05)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography component="div" variant="h6" sx={{ fontWeight: 900 }}>
              {isEdit ? 'Edit Task' : 'Create New Task'}
            </Typography>
            <Chip label="UPDATED" size="small" color="success" />
            {!canEdit && <Chip label="Read Only" size="small" color="warning" />}
          </Box>

          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 2, bgcolor: 'rgba(148,163,184,0.04)' }}>
          {!canEdit && (
            <Alert variant="outlined" severity="info" sx={{ mb: 2 }}>
              This task is <strong>{task?.status || 'restricted'}</strong> and can only be edited by admin/owner.
              {task?.status === 'Rejected' && isAssignee && ' (Assignees can edit rejected tasks)'}
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
            {/* ===================== BASIC (with dates) ===================== */}
            <Section title="Basic">
              {/* Row 1 */}
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: '1.54fr 0.6fr 0.6fr' },
                  alignItems: 'stretch',
                }}
              >
                <TextField
                  fullWidth
                  label="Task Name (max 30 chars)"
                  value={formData.name}
                  onChange={(e) => handleChange('name', e.target.value)}
                  required
                  disabled={!canEdit}
                  inputProps={{ maxLength: 30 }}
                  helperText={`${formData.name.length}/30 characters`}
                  placeholder="Enter task name"
                  sx={fieldSx}
                  size="small"
                />

                <FormControl fullWidth disabled={!canEdit} size="small" sx={{ '& .MuiInputLabel-root': { fontWeight: 700 } }}>
                  <InputLabel>Stage</InputLabel>
                  <Select
                    value={formData.stage}
                    label="Stage"
                    onChange={(e) => handleStageChange(e.target.value)}
                    sx={selectSx}
                  >
                    {stageOptions.map((stage) => (
                      <MenuItem key={stage} value={stage}>
                        {stage}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>

                <FormControl fullWidth disabled={!canEdit} size="small" sx={{ '& .MuiInputLabel-root': { fontWeight: 700 } }}>
                  <InputLabel>Priority</InputLabel>
                  <Select
                    value={formData.priority}
                    label="Priority"
                    onChange={(e) => handleChange('priority', e.target.value)}
                    sx={selectSx}
                  >
                    <MenuItem value="Low">Low</MenuItem>
                    <MenuItem value="Medium">Medium</MenuItem>
                    <MenuItem value="High">High</MenuItem>
                    <MenuItem value="Critical">Critical</MenuItem>
                  </Select>
                </FormControl>
              </Box>

              {/* Row 2 (Dates) — calendar opens on clicking the field */}
              <Box
                sx={{
                  mt: 1.5,
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: dateGridTemplateMd },
                  justifyContent: 'flex-start',
                }}
              >
                <DatePicker
                  disabled={!canEdit || lockDates}
                  open={openTarget}
                  onOpen={() => setOpenTarget(true)}
                  onClose={() => setOpenTarget(false)}
                  label="Target Date"
                  value={formData.targetDate}
                  onChange={(value) => handleChange('targetDate', value)}
                  inputFormat="dd-MMM-yy"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small',
                      helperText: lockDates ? 'Only owner/admin can edit' : '',
                      sx: fieldSx,
                      onClick: () => {
                        if (!(!canEdit || lockDates)) setOpenTarget(true);
                      },
                      inputProps: { readOnly: true },
                    },
                  }}
                />

                <DatePicker
                  disabled={!canEdit || lockDates}
                  open={openDue}
                  onOpen={() => setOpenDue(true)}
                  onClose={() => setOpenDue(false)}
                  label="Due Date"
                  value={formData.dueDate}
                  onChange={(value) => handleChange('dueDate', value)}
                  inputFormat="dd-MMM-yy"
                  slotProps={{
                    textField: {
                      fullWidth: true,
                      size: 'small',
                      helperText: lockDates ? 'Only owner/admin can edit' : '',
                      sx: fieldSx,
                      onClick: () => {
                        if (!(!canEdit || lockDates)) setOpenDue(true);
                      },
                      inputProps: { readOnly: true },
                    },
                  }}
                />

                {showCategory && (
                  <FormControl
                    fullWidth
                    disabled={!canEdit}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontWeight: 700 } }}
                  >
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={categoryValue}
                      label="Category"
                      onChange={(e) => handleChange('category', e.target.value)}
                      sx={selectSx}
                    >
                      <MenuItem value="">None</MenuItem>
                      {categoryOptions.map((option) => (
                        <MenuItem key={option.id || option.option_value} value={option.option_value}>
                          {option.option_value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {showSection && (
                  <FormControl
                    fullWidth
                    disabled={!canEdit}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontWeight: 700 } }}
                  >
                    <InputLabel>Section</InputLabel>
                    <Select
                      value={sectionValue}
                      label="Section"
                      onChange={(e) => handleChange('section', e.target.value)}
                      sx={selectSx}
                    >
                      <MenuItem value="">None</MenuItem>
                      {sectionOptions.map((option) => (
                        <MenuItem key={option.id || option.option_value} value={option.option_value}>
                          {option.option_value}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}

                {showClientSelect && (
                  <FormControl
                    fullWidth
                    disabled={!canEdit}
                    size="small"
                    sx={{ '& .MuiInputLabel-root': { fontWeight: 700 } }}
                  >
                    <InputLabel>Client</InputLabel>
                    <Select
                      value={formData.clientId || ''}
                      label="Client"
                      onChange={(e) => handleChange('clientId', e.target.value)}
                      sx={selectSx}
                    >
                      {projectClientOptions.map((client) => (
                        <MenuItem key={client.id} value={client.id}>
                          {getClientLabel(client) || client.name || client.client_name || 'Client'}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            </Section>

            {/* ===================== ALLOCATION ===================== */}
            <Section title="Allocation">
              <Box
                sx={{
                  display: 'grid',
                  gap: 1.5,
                  gridTemplateColumns: {
                    xs: '1fr',
                    md: enableMultiProjectLinks ? 'repeat(3, minmax(0, 1fr))' : 'repeat(2, minmax(0, 1fr))',
                  },
                }}
              >
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Autocomplete
                    disabled={!canEdit}
                    options={memberOptions}
                    getOptionLabel={(o) => getMemberLabel(o)}
                    value={formData.assignee}
                    onChange={handleAssigneeChange}
                    isOptionEqualToValue={(a, b) => String(a?.id) === String(b?.id)}
                    disablePortal
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Assignee"
                        placeholder="Select"
                        fullWidth
                        size="small"
                        sx={fieldSx}
                        InputProps={{
                          ...params.InputProps,
                          startAdornment: (
                            <>
                              <Box sx={{ display: 'flex', alignItems: 'center', mr: 1 }}>
                                <Avatar
                                  sx={{
                                    width: 26,
                                    height: 26,
                                    fontSize: 11,
                                    bgcolor: formData.assignee ? '#0f766e' : 'rgba(148,163,184,0.35)',
                                  }}
                                >
                                  {formData.assignee ? getInitials(formData.assignee) : <PersonIcon sx={{ fontSize: 15 }} />}
                                </Avatar>
                              </Box>
                              {params.InputProps.startAdornment}
                            </>
                          ),
                        }}
                      />
                    )}
                    renderOption={(props, option) => (
                      <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1.1, py: 0.75 }}>
                        <Avatar sx={{ width: 26, height: 26, fontSize: 11, bgcolor: '#0f766e' }}>
                          {option.avatar || getInitials(option)}
                        </Avatar>
                        <Box sx={{ minWidth: 0 }}>
                          <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                            {getMemberLabel(option)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap>
                            {option.email || ''}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  />

                  <Box sx={{ display: 'flex', gap: 0.75 }}>
                    <Tooltip title="Assign to me">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canEdit || !currentUserMember}
                          onClick={() => {
                            if (!currentUserMember) return;
                            handleAssigneeChange(null, currentUserMember);
                          }}
                          sx={iconBtnSx}
                        >
                          <AssignmentIndIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Tooltip title="Clear assignee">
                      <span>
                        <IconButton
                          size="small"
                          disabled={!canEdit || !formData.assignee}
                          onClick={() => handleAssigneeChange(null, null)}
                          sx={{ ...iconBtnSx, color: 'error.main' }}
                        >
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                  </Box>
                </Box>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                  <Box sx={{ position: 'relative', pt: 0.5 }}>
                    <InputLabel
                      shrink
                      sx={{
                        position: 'absolute',
                        top: -8,
                        left: 12,
                        px: 0.5,
                        bgcolor: '#fff',
                        fontWeight: 700,
                        fontSize: 12,
                        lineHeight: 1,
                        color: 'text.secondary',
                        zIndex: 1,
                      }}
                    >
                      Collaborators
                    </InputLabel>
                    <Box
                      onClick={(e) => openCollaboratorsPicker(e.currentTarget)}
                      sx={{
                        cursor: canEdit ? 'pointer' : 'default',
                        border: '1px solid rgba(148,163,184,0.35)',
                        borderRadius: 2,
                        bgcolor: 'rgba(15,118,110,0.03)',
                        minHeight: 44,
                        px: 1.15,
                        py: 0.75,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 1,
                        width: '100%',
                        '&:hover': canEdit ? { borderColor: 'rgba(15,118,110,0.55)' } : undefined,
                      }}
                    >
                      <Box sx={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 1 }}>
                        {formData.collaborators?.length ? (
                          <AvatarGroup
                            max={5}
                            sx={{
                              '& .MuiAvatar-root': {
                                width: 26,
                                height: 26,
                                fontSize: 11,
                                bgcolor: '#0f766e',
                              },
                            }}
                          >
                            {formData.collaborators.map((m) => (
                              <Avatar key={m.id} title={getMemberLabel(m)}>
                                {m.avatar || getInitials(m)}
                              </Avatar>
                            ))}
                          </AvatarGroup>
                        ) : (
                          <Typography variant="body2" color="text.secondary">
                            Add collaborators
                          </Typography>
                        )}

                        {formData.collaborators?.length ? (
                          <Chip
                            size="small"
                            label={`${formData.collaborators.length}`}
                            sx={{ height: 20, borderRadius: 999, fontWeight: 900 }}
                          />
                        ) : null}
                      </Box>
                    </Box>
                  </Box>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    <Tooltip title="Add / remove collaborators">
                      <span>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            openCollaboratorsPicker(e.currentTarget);
                          }}
                          disabled={!canEdit}
                          sx={iconBtnSx}
                        >
                          <GroupIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>

                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 0.75,
                        overflowX: 'auto',
                        py: 0.25,
                        px: 0.25,
                        flex: 1,
                      }}
                    >
                      {memberOptions
                        .filter((m) => !formData.assignee || String(m.id) !== String(formData.assignee.id))
                        .slice(0, 12)
                        .map((m) => {
                          const selected = isCollaboratorSelected(m);
                          return (
                            <Tooltip key={m.id} title={getMemberLabel(m)} arrow>
                              <span>
                                <Avatar
                                  onClick={() => {
                                    if (!canEdit) return;
                                    toggleCollaborator(m);
                                  }}
                                  sx={{
                                    width: 28,
                                    height: 28,
                                    fontSize: 11,
                                    bgcolor: selected ? '#0f766e' : 'rgba(148,163,184,0.35)',
                                    color: selected ? '#fff' : 'rgba(0,0,0,0.75)',
                                    cursor: canEdit ? 'pointer' : 'default',
                                    border: selected ? '2px solid rgba(15,118,110,0.65)' : '2px solid transparent',
                                    transition: 'all 0.15s',
                                  }}
                                >
                                  {m.avatar || getInitials(m)}
                                </Avatar>
                              </span>
                            </Tooltip>
                          );
                        })}
                      {memberOptions.length > 12 && (
                        <Chip
                          size="small"
                          label={`+${memberOptions.length - 12}`}
                          onClick={(e) => openCollaboratorsPicker(e.currentTarget)}
                          sx={{
                            height: 24,
                            borderRadius: 999,
                            fontWeight: 900,
                            cursor: canEdit ? 'pointer' : 'default',
                          }}
                        />
                      )}
                    </Box>
                  </Box>
                </Box>

                {enableMultiProjectLinks && (
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Autocomplete
                      multiple
                      disabled={!canEdit}
                      options={linkableProjects}
                      value={selectedLinkedProjects}
                      onChange={(_, value) =>
                        setFormData((prev) => ({
                          ...prev,
                          linkedProjectIds: Array.isArray(value) ? value.map((project) => project.id) : [],
                        }))
                      }
                      getOptionLabel={(o) => getProjectLabel(o)}
                      isOptionEqualToValue={(a, b) => String(a?.id) === String(b?.id)}
                      disablePortal
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          label="Project links"
                          placeholder="Select projects"
                          fullWidth
                          size="small"
                          sx={fieldSx}
                          helperText={!linkableProjects.length ? 'No other projects available to link.' : 'Primary project stays unchanged.'}
                        />
                      )}
                    />
                  </Box>
                )}
              </Box>

              <Popover
                open={collabPopoverOpen}
                anchorEl={collabAnchorEl}
                onClose={() => setCollabAnchorEl(null)}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
                transformOrigin={{ vertical: 'top', horizontal: 'left' }}
                PaperProps={{ sx: { width: 440, borderRadius: 2, p: 1.25 } }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 900, mb: 1 }}>
                  Select collaborators
                </Typography>

                <TextField
                  size="small"
                  fullWidth
                  placeholder="Search members..."
                  value={collabQuery}
                  onChange={(e) => setCollabQuery(e.target.value)}
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />

                <Box sx={{ mt: 1, maxHeight: 260, overflowY: 'auto' }}>
                  <List dense disablePadding>
                    {collaboratorCandidates.map((m) => {
                      const selected = isCollaboratorSelected(m);
                      return (
                        <ListItemButton
                          key={m.id}
                          onClick={() => toggleCollaborator(m)}
                          sx={{ borderRadius: 2, mb: 0.5 }}
                        >
                          <ListItemIcon sx={{ minWidth: 34 }}>
                            <Checkbox edge="start" checked={selected} tabIndex={-1} disableRipple />
                          </ListItemIcon>

                          <Avatar sx={{ width: 28, height: 28, fontSize: 12, bgcolor: '#0f766e', mr: 1 }}>
                            {m.avatar || getInitials(m)}
                          </Avatar>

                          <Box sx={{ minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 800 }} noWrap>
                              {getMemberLabel(m)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" noWrap>
                              {m.email || ''}
                            </Typography>
                          </Box>
                        </ListItemButton>
                      );
                    })}

                    {!collaboratorCandidates.length && (
                      <Typography variant="body2" color="text.secondary" sx={{ p: 1 }}>
                        No members found
                      </Typography>
                    )}
                  </List>
                </Box>

                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                  <Button
                    onClick={() => setCollabAnchorEl(null)}
                    variant="contained"
                    sx={{ borderRadius: 2, textTransform: 'none', fontWeight: 900 }}
                  >
                    Done
                  </Button>
                </Box>
              </Popover>
            </Section>

            {/* ===================== DETAILS ===================== */}
            <Section title="Details">
              <Box
                sx={{
                  display: 'grid',
                  gap: 2,
                  gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                }}
              >
                <TextField
                  disabled={!canEdit}
                  fullWidth
                  label="Task Notes"
                  value={formData.notes}
                  onChange={(e) => handleChange('notes', e.target.value)}
                  multiline
                  rows={4}
                  placeholder="Add notes"
                  sx={fieldSx}
                  size="small"
                />

                <TextField
                  disabled={!canEdit}
                  fullWidth
                  label="Description"
                  value={formData.description}
                  onChange={(e) => handleChange('description', e.target.value)}
                  multiline
                  rows={4}
                  placeholder="Add description"
                  sx={fieldSx}
                  size="small"
                />
              </Box>

              {isEdit && (
                <Box sx={{ mt: 1.2, display: 'flex', justifyContent: 'flex-end' }}>
                  <Box sx={{ textAlign: 'right' }}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Created by: <strong>{task.created_by_name || task.createdBy || '-'}</strong>
                    </Typography>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                      Created on:{' '}
                      <strong>
                        {(task.created_at || task.createdDate) ? formatShortDate(task.created_at || task.createdDate) : '-'}
                      </strong>
                    </Typography>
                  </Box>
                </Box>
              )}

              {!isEdit && onCreateRecurring && (
                <Box sx={{ mt: 1.5 }}>
                  <Divider sx={{ mb: 1.25 }} />
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isRecurring}
                        onChange={(e) => handleChange('isRecurring', e.target.checked)}
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RepeatIcon sx={{ color: 'text.secondary' }} />
                        <Typography sx={{ fontWeight: 900 }}>Recurring task</Typography>
                      </Box>
                    }
                  />
                  <Collapse in={formData.isRecurring}>
                    <Box sx={{ mt: 1 }}>
                      <FormControl size="small" sx={{ minWidth: 220 }}>
                        <InputLabel>Repeat</InputLabel>
                        <Select
                          value={formData.recurrencePattern}
                          label="Repeat"
                          onChange={(e) => handleChange('recurrencePattern', e.target.value)}
                          sx={{ borderRadius: 2 }}
                        >
                          <MenuItem value="daily">Daily</MenuItem>
                          <MenuItem value="weekly">Weekly</MenuItem>
                          <MenuItem value="biweekly">Bi-weekly</MenuItem>
                          <MenuItem value="monthly">Monthly</MenuItem>
                        </Select>
                      </FormControl>
                    </Box>
                  </Collapse>
                </Box>
              )}
            </Section>

            {/* ===================== CUSTOM FIELDS (Feature 1) ===================== */}
            {showCustomFieldsSection && (
              <Section title="Custom Fields">
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
                  Additional fields for tracking and organization (enable in Project Settings)
                </Typography>

                {(showEstimated || showActual || showCompletion) && (
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: { xs: '1fr', md: 'repeat(auto-fit, minmax(220px, 1fr))' },
                      mt: 2,
                    }}
                  >
                    {showEstimated && (
                      <TextField
                        disabled={!canEdit}
                        fullWidth
                        label="Estimated Hours"
                        type="number"
                        value={formData.estimatedHours}
                        onChange={(e) => handleChange('estimatedHours', e.target.value)}
                        inputProps={{ min: 0, step: 0.5 }}
                        placeholder="0"
                        sx={fieldSx}
                        size="small"
                      />
                    )}

                    {showActual && (
                      <TextField
                        disabled={!canEdit}
                        fullWidth
                        label="Actual Hours"
                        type="number"
                        value={formData.actualHours}
                        onChange={(e) => handleChange('actualHours', e.target.value)}
                        inputProps={{ min: 0, step: 0.5 }}
                        placeholder="0"
                        sx={fieldSx}
                        size="small"
                      />
                    )}

                    {showCompletion && (
                      <TextField
                        disabled={!canEdit}
                        fullWidth
                        label="Completion %"
                        type="number"
                        value={formData.completionPercentage}
                        onChange={(e) =>
                          handleChange(
                            'completionPercentage',
                            Math.min(100, Math.max(0, parseInt(e.target.value) || 0))
                          )
                        }
                        inputProps={{ min: 0, max: 100 }}
                        placeholder="0"
                        sx={fieldSx}
                        size="small"
                      />
                    )}
                  </Box>
                )}

                {(showTags || showExternalId) && (
                  <Box
                    sx={{
                      display: 'grid',
                      gap: 2,
                      gridTemplateColumns: {
                        xs: '1fr',
                        md: showTags && showExternalId ? '2fr 1fr' : '1fr',
                      },
                      mt: 2,
                    }}
                  >
                    {showTags && (
                      <Autocomplete
                        multiple
                        freeSolo
                        disabled={!canEdit}
                        options={[]}
                        value={formData.tags}
                        onChange={(_, value) => handleChange('tags', value)}
                        renderTags={(value, getTagProps) =>
                          value.map((tag, index) => (
                            <Chip
                              {...getTagProps({ index })}
                              key={index}
                              label={tag}
                              size="small"
                              sx={{ height: 22, borderRadius: 1 }}
                            />
                          ))
                        }
                        renderInput={(params) => (
                          <TextField
                            {...params}
                            label="Tags"
                            placeholder="Add tags (press Enter)"
                            size="small"
                            sx={fieldSx}
                          />
                        )}
                      />
                    )}

                    {showExternalId && (
                      <TextField
                        disabled={!canEdit}
                        fullWidth
                        label="External ID"
                        value={formData.externalId}
                        onChange={(e) => handleChange('externalId', e.target.value)}
                        placeholder="JIRA-123"
                        sx={{
                          ...fieldSx,
                          '& .MuiOutlinedInput-input': {
                            fontFamily: 'monospace',
                          },
                        }}
                        size="small"
                        helperText="Link to external system"
                      />
                    )}
                  </Box>
                )}
              </Section>
            )}

          </Box>
        </DialogContent>

        <DialogActions sx={{ p: 2, bgcolor: '#fff', borderTop: '1px solid rgba(148,163,184,0.25)' }}>
          {canDelete && (
            <Button
              onClick={() => {
                onDelete(task);
                onClose();
              }}
              color="error"
              variant="outlined"
              sx={{ textTransform: 'none', mr: 'auto', borderRadius: 2, fontWeight: 900 }}
            >
              Delete Task
            </Button>
          )}

          <Button onClick={onClose} sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 900 }}>
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 2, fontWeight: 900 }}
            disabled={!formData.name.trim() || !canEdit}
          >
            {isEdit ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogActions>

        <Snackbar
          open={toast.open}
          autoHideDuration={4000}
          onClose={() => setToast({ ...toast, open: false })}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
            {toast.message}
          </Alert>
        </Snackbar>
      </Dialog>
    </LocalizationProvider>
  );
}

export default TaskForm;
