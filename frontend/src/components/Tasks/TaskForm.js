import React, { useState, useEffect } from 'react';
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
  Grid,
  Chip,
  Avatar,
  Typography,
  Autocomplete,
  IconButton,
  Snackbar,
  Alert,
  FormControlLabel,
  Switch,
  Collapse,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import RepeatIcon from '@mui/icons-material/Repeat';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { getProjectMembers } from '../../apiClient';
import { formatShortDate } from '../../utils/date';

const stageOptions = ['Planned', 'In-process', 'Completed', 'On-hold', 'Dropped'];
const statusOptions = ['Open', 'Pending Approval', 'Closed', 'Rejected'];

const mockMembers = [
  { id: 1, name: 'John Doe', email: 'john@example.com', avatar: 'JD' },
  { id: 2, name: 'Sarah Miller', email: 'sarah@example.com', avatar: 'SM' },
  { id: 3, name: 'Alex Kim', email: 'alex@example.com', avatar: 'AK' },
  { id: 4, name: 'Patricia Lee', email: 'patricia@example.com', avatar: 'PL' },
  { id: 5, name: 'Mike Roberts', email: 'mike@example.com', avatar: 'MR' },
];

/**
 * Check if user can edit task based on status and role
 * Rules:
 * - Pending Approval/Closed: Only admin/owner can edit
 * - Rejected: Assignee regains access to edit
 * - Open/In-process: Normal editing based on project role
 */
function canEditTask(task, userRole, isAssignee) {
  if (!task) return true; // New task
  
  const status = task.status;
  const role = (userRole || '').toString().toLowerCase();
  const isAdminOrOwner = role === 'admin' || role === 'owner';
  
  // Pending Approval or Closed: only admin/owner
  if (status === 'Pending Approval' || status === 'Closed') {
    return isAdminOrOwner;
  }
  
  // Rejected: assignee can edit (to fix and resubmit)
  if (status === 'Rejected') {
    return isAssignee || isAdminOrOwner;
  }
  
  // Open/other statuses: allow normal editing
  return true;
}

function TaskForm({ open, onClose, onSave, task = null, prefilledStage = null, prefilledStatus = null, projectId = null, userRole = null, currentUserId = null, onDelete, onCreateRecurring }) {
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
  });

  const [projectMembers, setProjectMembers] = useState([]);
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  
  // Determine if current user is assignee
  const isAssignee = task && currentUserId && (
    task.assignee_id === currentUserId || 
    task.assignee === currentUserId ||
    String(task.assignee_id) === String(currentUserId)
  );
  
  // Check edit permission
  const normalizedRole = (userRole || '').toString().toLowerCase();
  const canEdit = canEditTask(task, normalizedRole, isAssignee);

  useEffect(() => {
    if (task) {
      // If task was rejected previously, set stage to In-process per workflow
      const initialStage = task.status === 'Rejected' ? 'In-process' : (task.stage || 'Planned');
      setFormData({
        name: task.name || '',
        description: task.description || '',
        stage: initialStage,
        status: task.status || 'Open',
        dueDate: task.due_date ? new Date(task.due_date) : (task.dueDate ? new Date(task.dueDate) : null),
        targetDate: task.target_date ? new Date(task.target_date) : (task.targetDate ? new Date(task.targetDate) : null),
        assignee: null,
        collaborators: [],
        notes: task.notes || '',
        priority: task.priority || 'Medium',
      });
    } else {
      // For new tasks, completely reset the form with blank values
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
      });
    }
  }, [task, prefilledStage, prefilledStatus, open]);

  // Fetch project members when projectId or dialog opens
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

  // When projectMembers load and task exists, map assignee/collaborators to member objects
  useEffect(() => {
    if (!task || projectMembers.length === 0) return;
    const findMemberFor = (val) => {
      if (!val) return null;
      // If val is an object with id/user_id, match by id
      if (typeof val === 'object') {
        const id = val.id || val.user_id || val.userId || null;
        if (id) return projectMembers.find(m => String(m.id) === String(id)) || null;
        // if object has name, try matching by name
        if (val.name) return projectMembers.find(m => `${m.first_name || ''} ${m.last_name || ''}`.trim() === val.name) || null;
      }
      // try by id
      let found = projectMembers.find(m => String(m.id) === String(val));
      if (found) return found;
      // try by email
      found = projectMembers.find(m => m.email === val);
      if (found) return found;
      // try by avatar or name
      found = projectMembers.find(m => m.avatar === val || m.name === val || `${m.first_name || ''} ${m.last_name || ''}`.trim() === val);
      return found || null;
    };

    const assigneeVal = task.assignee_id || task.assignee || task.assignee_name || null;
    const assigneeObj = findMemberFor(assigneeVal);
    const collaboratorsObjs = Array.isArray(task.collaborators)
      ? task.collaborators.map(c => findMemberFor(c)).filter(Boolean)
      : [];

    setFormData(prev => ({ ...prev, assignee: assigneeObj, collaborators: collaboratorsObjs }));
  }, [projectMembers, task]);

  // handle stage change with auto-status logic
  const handleStageChange = (newStage) => {
    setFormData(prev => {
      let newStatus = prev.status;
      if (newStage === 'Completed') {
        // When stage is set to Completed, automatically set status to Pending Approval
        newStatus = 'Pending Approval';
      } else if (newStage === 'Planned' || newStage === 'In-process') {
        // For Planned or In-process stages, keep status as Open (unless it's Rejected)
        if (prev.status === 'Pending Approval' || prev.status === 'Closed') {
          newStatus = 'Open';
        }
        // Keep Rejected status if it was rejected before
      } else {
        // For On-hold or Dropped, keep the current status
        if (prev.status === 'Pending Approval') newStatus = 'Open';
      }
      return { ...prev, stage: newStage, status: newStatus };
    });
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = () => {
    // Check if user has permission to save
    if (!canEdit) {
      setToast({ open: true, severity: 'error', message: 'You do not have permission to edit this task' });
      return;
    }
    
    // Validate assignee and collaborators are project members
    if (formData.assignee) {
      const found = projectMembers.find(m => String(m.id) === String(formData.assignee.id));
      if (!found) {
        setToast({ open: true, severity: 'error', message: 'Assignee must be a project member' });
        return;
      }
    }
    if (formData.collaborators && formData.collaborators.length > 0) {
      const invalid = formData.collaborators.some(c => !projectMembers.find(m => String(m.id) === String(c.id)));
      if (invalid) {
        setToast({ open: true, severity: 'error', message: 'All collaborators must be project members' });
        return;
      }
    }
    const taskData = {
      ...formData,
      id: task?.id || Date.now(),
      // send full assignee object so caller can extract id
      assignee: formData.assignee || null,
      // collaborators as array of member objects
      collaborators: formData.collaborators || [],
      dueDate: formData.dueDate ? formData.dueDate.toISOString().split('T')[0] : null,
      targetDate: formData.targetDate ? formData.targetDate.toISOString().split('T')[0] : null,
        createdBy: task?.created_by_name || task?.createdBy || null,
        createdDate: task?.created_at || task?.createdDate || null,
    };
    onSave(taskData);
    onClose();
  };

  return (
    <LocalizationProvider dateAdapter={AdapterDateFns}>
      <Dialog
        open={open}
        onClose={onClose}
        maxWidth="md"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', pb: 2 }}>
          <Typography component="div" variant="h6" sx={{ fontWeight: 600 }}>
            {isEdit ? 'Edit Task' : 'Create New Task'}
            <Chip label="UPDATED" size="small" color="success" sx={{ ml: 1 }} />
            {!canEdit && (
              <Chip 
                label="Read Only" 
                size="small" 
                color="warning" 
                sx={{ ml: 2 }} 
              />
            )}
          </Typography>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers>
          {!canEdit && (
            <Alert severity="info" sx={{ mb: 2 }}>
              This task is {task?.status === 'Pending Approval' ? 'pending approval' : 'closed'} and can only be edited by project admin/owner.
              {task?.status === 'Rejected' && isAssignee && ' (Assignees can edit rejected tasks)'}
            </Alert>
          )}
          <Grid container spacing={3}>
            {/* UPDATED LAYOUT v3: Row 1: Task Name, Stage, Priority | Row 2: Assignee, Collab, Status | Row 3: Dates | Row 4: Notes/Desc */}
            {/* ROW 1: Task Name, Stage, Priority */}
            <Grid xs={12} md={6}>
              <TextField
                fullWidth
                label="Task Name"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                required
                placeholder="Enter task name"
                disabled={!canEdit}
                inputProps={{ maxLength: 20 }}
                helperText={`${formData.name.length}/20 characters`}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <FormControl fullWidth disabled={!canEdit}>
                <InputLabel>Stage</InputLabel>
                <Select
                  value={formData.stage}
                  label="Stage"
                  onChange={(e) => handleStageChange(e.target.value)}
                >
                  {stageOptions.map(stage => (
                    <MenuItem key={stage} value={stage}>{stage}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid xs={12} md={3}>
              <FormControl fullWidth disabled={!canEdit}>
                <InputLabel>Priority</InputLabel>
                <Select
                  value={formData.priority}
                  label="Priority"
                  onChange={(e) => handleChange('priority', e.target.value)}
                >
                  <MenuItem value="Low">Low</MenuItem>
                  <MenuItem value="Medium">Medium</MenuItem>
                  <MenuItem value="High">High</MenuItem>
                  <MenuItem value="Critical">Critical</MenuItem>
                </Select>
              </FormControl>
            </Grid>

            {/* ROW 2: Assignee, Collaborators, Status */}
            <Grid xs={12} md={6}>
              <Autocomplete
                disabled={!canEdit}
                options={projectMembers}
                getOptionLabel={(option) => option.first_name ? `${option.first_name} ${option.last_name || ''}`.trim() : option.username || option.email}
                value={formData.assignee}
                onChange={(e, value) => handleChange('assignee', value)}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Assignee"
                    placeholder="Select assignee"
                    fullWidth
                    sx={{ '& .MuiInputBase-root': { minHeight: 64, fontSize: '1rem' } }}
                    InputProps={{
                      ...params.InputProps,
                      sx: { alignItems: 'center' }
                    }}
                  />
                )}
                renderOption={(props, option) => (
                  <Box component="li" {...props} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#0f766e' }}>
                      {option.avatar || ((option.first_name || '').charAt(0) + (option.last_name || '').charAt(0))}
                    </Avatar>
                    <Box>
                      <Typography variant="body2">{option.first_name ? `${option.first_name} ${option.last_name || ''}`.trim() : option.username || option.email}</Typography>
                      <Typography variant="caption" color="text.secondary">{option.email}</Typography>
                    </Box>
                  </Box>
                )}
              />
            </Grid>
            <Grid xs={12} md={3}>
              <Autocomplete
                disabled={!canEdit}
                multiple
                options={projectMembers}
                getOptionLabel={(option) => option.first_name ? `${option.first_name} ${option.last_name || ''}`.trim() : option.username || option.email}
                value={formData.collaborators}
                onChange={(e, value) => handleChange('collaborators', value)}
                renderInput={(params) => (
                  <TextField {...params} label="Collaborators" placeholder="Add collaborators" fullWidth sx={{ '& .MuiInputBase-root': { minHeight: 56, fontSize: '0.95rem' } }} />
                )}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip
                      avatar={
                        <Avatar sx={{ width: 32, height: 32, fontSize: '0.95rem', bgcolor: '#0f766e' }}>
                          {option.avatar || ((option.first_name || '').charAt(0) + (option.last_name || '').charAt(0))}
                        </Avatar>
                      }
                      label={option.first_name ? `${option.first_name} ${option.last_name || ''}`.trim() : option.username || option.email}
                      {...getTagProps({ index })}
                      size="medium"
                      sx={{ mr: 0.5, py: 0.5, fontSize: '0.95rem' }}
                    />
                  ))
                }
              />
            </Grid>
            <Grid xs={12} md={3}>
              <TextField label="Status" value={formData.status} disabled fullWidth />
            </Grid>
            {/* ROW 3: Target Date, Due Date */}
            <Grid xs={12} md={6}>
              <DatePicker
                disabled={!canEdit || (isEdit && normalizedRole !== 'owner' && normalizedRole !== 'admin')}
                label="Target Date"
                value={formData.targetDate}
                onChange={(value) => handleChange('targetDate', value)}
                inputFormat="dd-MMM-yy"
                slotProps={{ textField: { fullWidth: true, helperText: isEdit && userRole !== 'owner' && userRole !== 'admin' ? 'Only owner/admin can edit' : '' } }}
              />
            </Grid>

            <Grid xs={12} md={6}>
              <DatePicker
                disabled={!canEdit || (isEdit && normalizedRole !== 'owner' && normalizedRole !== 'admin')}
                label="Due Date"
                value={formData.dueDate}
                onChange={(value) => handleChange('dueDate', value)}
                inputFormat="dd-MMM-yy"
                slotProps={{ textField: { fullWidth: true, helperText: isEdit && normalizedRole !== 'owner' && normalizedRole !== 'admin' ? 'Only owner/admin can edit' : '' } }}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                disabled={!canEdit}
                fullWidth
                label="Task Notes"
                value={formData.notes}
                onChange={(e) => handleChange('notes', e.target.value)}
                multiline
                rows={4}
                placeholder="Add detailed notes, instructions, or updates"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                disabled={!canEdit}
                fullWidth
                label="Description"
                value={formData.description}
                onChange={(e) => handleChange('description', e.target.value)}
                multiline
                rows={4}
                placeholder="Add task description"
              />
            </Grid>

            {isEdit && (
              <Grid item xs={12} md={3}>
                <Box sx={{ p: 2, bgcolor: 'rgba(148, 163, 184, 0.05)', borderRadius: 2 }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Created by: <strong>{task.created_by_name || task.createdBy || '-'}</strong>
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block">
                    Created on: <strong>{(task.created_at || task.createdDate) ? formatShortDate(task.created_at || task.createdDate) : '-'}</strong>
                  </Typography>
                </Box>
              </Grid>
            )}

            {/* Recurring Task Option - Only for new tasks */}
            {!isEdit && onCreateRecurring && (
              <Grid item xs={12}>
                <Box 
                  sx={{ 
                    p: 2, 
                    border: '1px solid', 
                    borderColor: formData.isRecurring ? '#0f766e' : 'rgba(148, 163, 184, 0.3)',
                    borderRadius: 2,
                    bgcolor: formData.isRecurring ? 'rgba(15, 118, 110, 0.05)' : 'transparent',
                    transition: 'all 0.2s'
                  }}
                >
                  <FormControlLabel
                    control={
                      <Switch
                        checked={formData.isRecurring}
                        onChange={(e) => handleChange('isRecurring', e.target.checked)}
                        color="primary"
                      />
                    }
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <RepeatIcon sx={{ color: formData.isRecurring ? '#0f766e' : 'text.secondary' }} />
                        <Typography variant="body1" sx={{ fontWeight: formData.isRecurring ? 600 : 400 }}>
                          Make this a recurring task
                        </Typography>
                      </Box>
                    }
                  />
                  
                  <Collapse in={formData.isRecurring}>
                    <Box sx={{ mt: 2, pl: 5 }}>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                        Set up automatic repetition for this task
                      </Typography>
                      <Grid container spacing={2} alignItems="center">
                        <Grid item>
                          <FormControl size="small" sx={{ minWidth: 150 }}>
                            <InputLabel>Repeat</InputLabel>
                            <Select
                              value={formData.recurrencePattern}
                              label="Repeat"
                              onChange={(e) => handleChange('recurrencePattern', e.target.value)}
                            >
                              <MenuItem value="daily">Daily</MenuItem>
                              <MenuItem value="weekly">Weekly</MenuItem>
                              <MenuItem value="biweekly">Bi-weekly</MenuItem>
                              <MenuItem value="monthly">Monthly</MenuItem>
                            </Select>
                          </FormControl>
                        </Grid>
                        <Grid item>
                          <Button
                            variant="outlined"
                            size="small"
                            startIcon={<RepeatIcon />}
                            onClick={() => {
                              onCreateRecurring({
                                title: formData.name,
                                description: formData.description,
                                project_id: projectId,
                                assignee: formData.assignee,
                                priority: formData.priority,
                                recurrencePattern: formData.recurrencePattern,
                              });
                              onClose();
                            }}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                          >
                            Set up recurring series
                          </Button>
                        </Grid>
                      </Grid>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                        This will open the recurring series editor for advanced options
                      </Typography>
                    </Box>
                  </Collapse>
                </Box>
              </Grid>
            )}
          </Grid>
        </DialogContent>

        <DialogActions sx={{ p: 2.5 }}>
          {isEdit && onDelete && (
            <Button
              onClick={() => {
                onDelete(task);
                onClose();
              }}
              color="error"
              variant="outlined"
              sx={{ textTransform: 'none', mr: 'auto' }}
            >
              Delete Task
            </Button>
          )}
          <Button onClick={onClose} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            variant="contained"
            sx={{ textTransform: 'none', borderRadius: 2 }}
            disabled={!formData.name.trim() || !canEdit}
          >
            {isEdit ? 'Save Changes' : 'Create Task'}
          </Button>
        </DialogActions>
      </Dialog>
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
    </LocalizationProvider>
  );
}

export default TaskForm;