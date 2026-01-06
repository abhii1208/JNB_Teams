import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Grid,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CodeIcon from '@mui/icons-material/Code';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import BugReportIcon from '@mui/icons-material/BugReport';
import CampaignIcon from '@mui/icons-material/Campaign';

const projectIcons = [
  { value: 'folder', label: 'Folder', icon: <FolderIcon /> },
  { value: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { value: 'code', label: 'Code', icon: <CodeIcon /> },
  { value: 'design', label: 'Design', icon: <DesignServicesIcon /> },
  { value: 'bug', label: 'Bug', icon: <BugReportIcon /> },
  { value: 'campaign', label: 'Campaign', icon: <CampaignIcon /> },
];

const projectColors = [
  { value: '#0f766e', label: 'Teal' },
  { value: '#0284c7', label: 'Blue' },
  { value: '#7c3aed', label: 'Purple' },
  { value: '#c026d3', label: 'Magenta' },
  { value: '#dc2626', label: 'Red' },
  { value: '#ea580c', label: 'Orange' },
  { value: '#ca8a04', label: 'Yellow' },
  { value: '#16a34a', label: 'Green' },
];

function ProjectForm({ open, onClose, onSave, project, workspace }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('folder');
  const [color, setColor] = useState('#0f766e');

  useEffect(() => {
    if (project) {
      // Editing existing project
      setName(project.name || '');
      setDescription(project.description || '');
      setIcon(project.icon || 'folder');
      setColor(project.color || '#0f766e');
    } else {
      // Creating new project
      setName('');
      setDescription('');
      setIcon('folder');
      setColor('#0f766e');
    }
  }, [project, open]);

  const handleSubmit = () => {
    const projectData = {
      id: project?.id || Date.now(),
      name,
      description,
      icon,
      color,
      workspace: workspace?.name || 'Current Workspace',
      createdDate: project?.createdDate || new Date().toISOString(),
      status: project?.status || 'Active',
      members: project?.members || [],
      tasks: project?.tasks || [],
    };
    onSave(projectData);
    onClose();
  };

  const handleClose = () => {
    onClose();
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: 3,
        },
      }}
    >
      <DialogTitle sx={{ p: 3, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {project ? 'Edit Project' : 'Create New Project'}
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: 3, pt: 1 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Project Name */}
          <TextField
            fullWidth
            label="Project Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter project name"
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          {/* Description */}
          <TextField
            fullWidth
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this project about?"
            multiline
            rows={3}
            sx={{
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />

          {/* Icon and Color Selection */}
          <Grid container spacing={2}>
            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Project Icon</InputLabel>
                <Select
                  value={icon}
                  onChange={(e) => setIcon(e.target.value)}
                  label="Project Icon"
                  sx={{ borderRadius: 2 }}
                >
                  {projectIcons.map((iconOption) => (
                    <MenuItem key={iconOption.value} value={iconOption.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {iconOption.icon}
                        <Typography>{iconOption.label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Project Color</InputLabel>
                <Select
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  label="Project Color"
                  sx={{ borderRadius: 2 }}
                >
                  {projectColors.map((colorOption) => (
                    <MenuItem key={colorOption.value} value={colorOption.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 20,
                            height: 20,
                            borderRadius: 1,
                            backgroundColor: colorOption.value,
                            border: '1px solid rgba(148, 163, 184, 0.2)',
                          }}
                        />
                        <Typography>{colorOption.label}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
          </Grid>

          {/* Preview */}
          <Box
            sx={{
              p: 2,
              borderRadius: 2,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              backgroundColor: 'rgba(248, 250, 252, 0.5)',
            }}
          >
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Preview
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  backgroundColor: color,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                }}
              >
                {projectIcons.find((i) => i.value === icon)?.icon}
              </Box>
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {name || 'Project Name'}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {description || 'Project description will appear here'}
                </Typography>
              </Box>
            </Box>
          </Box>

          {project && (
            <Box
              sx={{
                p: 1.5,
                borderRadius: 2,
                backgroundColor: 'rgba(15, 118, 110, 0.05)',
                border: '1px solid rgba(15, 118, 110, 0.2)',
              }}
            >
              <Typography variant="caption" color="text.secondary">
                Created on {new Date(project.createdDate).toLocaleDateString()}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={handleClose}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            px: 3,
          }}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim()}
          sx={{
            textTransform: 'none',
            borderRadius: 2,
            px: 3,
          }}
        >
          {project ? 'Save Changes' : 'Create Project'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default ProjectForm;
