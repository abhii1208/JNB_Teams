import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Chip,
} from '@mui/material';
import { Snackbar, Alert } from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import TaskForm from './TaskForm';
import { createTask, updateTask } from '../../apiClient';

const normalizeNumberInput = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const normalizeNullableString = (value) => (value === '' ? null : value);

/**
 * A wrapper component that allows selecting a project before creating a task
 * This is used from the Tasks page where no project context exists
 */
function TaskFormWithProjectSelect({
  open,
  onClose,
  task,
  projects = [],
  workspace,
  user,
  onSave,
  selectedProject,
  onProjectSelect,
}) {
  const isEdit = Boolean(task);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [internalProject, setInternalProject] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const effectiveProjectRole = internalProject?.role
    || projects.find((p) => String(p.id) === String(task?.project_id || selectedProject?.id))?.role
    || user?.role
    || 'Member';

  // When editing a task, find the project from the task data
  useEffect(() => {
    if (isEdit && task?.project_id) {
      const foundProject = projects.find(p => p.id === task.project_id);
      if (foundProject) {
        setInternalProject(foundProject);
        setShowTaskForm(true);
      }
    }
  }, [isEdit, task, projects]);

  // Handle project selection
  const handleProjectSelect = (projectId) => {
    const project = projects.find(p => p.id === projectId);
    setInternalProject(project);
    if (onProjectSelect) onProjectSelect(project);
  };

  // Handle proceeding to task form
  const handleProceed = () => {
    if (internalProject) {
      setShowTaskForm(true);
    }
  };

  // Handle task form close
  const handleTaskFormClose = () => {
    setShowTaskForm(false);
    setInternalProject(null);
    onClose();
  };

  // Handle task save
  const handleTaskSave = async (taskData) => {
    try {
      // Build payload expected by API
      const payload = {
        name: taskData.name,
        description: taskData.description,
        project_id: internalProject?.id,
        assignee_id: taskData.assignee?.id || null,
        collaborators: (taskData.collaborators || []).map(c => c.id),
        notes: taskData.notes || null,
        priority: taskData.priority || 'Medium',
        stage: taskData.stage || 'Planned',
        status: taskData.status || 'Open',
        due_date: taskData.dueDate || null,
        target_date: taskData.targetDate || null,
        category: normalizeNullableString(taskData.category ?? null),
        section: normalizeNullableString(taskData.section ?? null),
        estimated_hours: normalizeNumberInput(taskData.estimated_hours ?? taskData.estimatedHours),
        actual_hours: normalizeNumberInput(taskData.actual_hours ?? taskData.actualHours),
        completion_percentage: normalizeNumberInput(taskData.completion_percentage ?? taskData.completionPercentage),
        tags: Array.isArray(taskData.tags) ? taskData.tags : null,
        external_id: normalizeNullableString(taskData.external_id ?? taskData.externalId ?? null),
      };

      if (task && task.id) {
        await updateTask(task.id, payload);
        setSnackbar({ open: true, message: 'Task updated', severity: 'success' });
      } else {
        await createTask(payload);
        setSnackbar({ open: true, message: 'Task created', severity: 'success' });
      }

      handleTaskFormClose();
      if (onSave) onSave();
    } catch (err) {
      console.error('Failed to save task:', err);
      const msg = err?.response?.data?.error || err.message || 'Failed to save task';
      setSnackbar({ open: true, message: msg, severity: 'error' });
      // close the form to keep UX consistent with other flows
      handleTaskFormClose();
    }
  };

  // If editing or project already selected, show TaskForm directly
  if (showTaskForm && internalProject) {
    return (
      <TaskForm
        open={true}
        onClose={handleTaskFormClose}
        onSave={handleTaskSave}
        task={task}
        projectId={internalProject.id}
        userRole={effectiveProjectRole}
        currentUserId={user?.id}
      />
    );
  }

  // Show project selection dialog
  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {isEdit ? 'Edit Task' : 'Create New Task'}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ py: 2 }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select a project to create the task in:
          </Typography>
          
          <FormControl fullWidth>
            <InputLabel>Project</InputLabel>
            <Select
              value={internalProject?.id || ''}
              onChange={(e) => handleProjectSelect(e.target.value)}
              label="Project"
            >
              {projects.map(project => (
                <MenuItem key={project.id} value={project.id}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <FolderIcon fontSize="small" color="action" />
                    <Typography variant="body2">{project.name}</Typography>
                    {project.stage && (
                      <Chip label={project.stage} size="small" sx={{ ml: 'auto' }} />
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          
          {projects.length === 0 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
              No projects available. Create a project first.
            </Typography>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleProceed} 
          variant="contained"
          disabled={!internalProject}
          sx={{ bgcolor: '#0f766e', '&:hover': { bgcolor: '#115e59' } }}
        >
          Continue
        </Button>
      </DialogActions>
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnackbar(prev => ({ ...prev, open: false }))} severity={snackbar.severity} sx={{ width: '100%' }}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
}

export default TaskFormWithProjectSelect;
