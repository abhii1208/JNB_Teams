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
  Paper,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import FolderIcon from '@mui/icons-material/Folder';
import DashboardIcon from '@mui/icons-material/Dashboard';
import CodeIcon from '@mui/icons-material/Code';
import DesignServicesIcon from '@mui/icons-material/DesignServices';
import BugReportIcon from '@mui/icons-material/BugReport';
import CampaignIcon from '@mui/icons-material/Campaign';
import LightbulbIcon from '@mui/icons-material/Lightbulb';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import StarIcon from '@mui/icons-material/Star';
import AnalyticsIcon from '@mui/icons-material/Analytics';
import SettingsIcon from '@mui/icons-material/Settings';
import BuildIcon from '@mui/icons-material/Build';
import ScienceIcon from '@mui/icons-material/Science';
import SchoolIcon from '@mui/icons-material/School';
import PsychologyIcon from '@mui/icons-material/Psychology';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import StorefrontIcon from '@mui/icons-material/Storefront';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import FlightIcon from '@mui/icons-material/Flight';
import DirectionsCarIcon from '@mui/icons-material/DirectionsCar';
import HotelIcon from '@mui/icons-material/Hotel';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import PetsIcon from '@mui/icons-material/Pets';
import SportsEsportsIcon from '@mui/icons-material/SportsEsports';

const projectIcons = [
  { value: 'folder', label: 'Folder', icon: <FolderIcon /> },
  { value: 'dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
  { value: 'code', label: 'Code', icon: <CodeIcon /> },
  { value: 'design', label: 'Design', icon: <DesignServicesIcon /> },
  { value: 'bug', label: 'Bug', icon: <BugReportIcon /> },
  { value: 'campaign', label: 'Campaign', icon: <CampaignIcon /> },
  { value: 'lightbulb', label: 'Idea', icon: <LightbulbIcon /> },
  { value: 'rocket', label: 'Rocket', icon: <RocketLaunchIcon /> },
  { value: 'star', label: 'Star', icon: <StarIcon /> },
  { value: 'analytics', label: 'Analytics', icon: <AnalyticsIcon /> },
  { value: 'settings', label: 'Settings', icon: <SettingsIcon /> },
  { value: 'build', label: 'Build', icon: <BuildIcon /> },
  { value: 'science', label: 'Science', icon: <ScienceIcon /> },
  { value: 'school', label: 'School', icon: <SchoolIcon /> },
  { value: 'psychology', label: 'AI/Brain', icon: <PsychologyIcon /> },
  { value: 'offer', label: 'Offer', icon: <LocalOfferIcon /> },
  { value: 'store', label: 'Store', icon: <StorefrontIcon /> },
  { value: 'cart', label: 'Cart', icon: <ShoppingCartIcon /> },
  { value: 'restaurant', label: 'Restaurant', icon: <RestaurantIcon /> },
  { value: 'flight', label: 'Flight', icon: <FlightIcon /> },
  { value: 'car', label: 'Car', icon: <DirectionsCarIcon /> },
  { value: 'hotel', label: 'Hotel', icon: <HotelIcon /> },
  { value: 'health', label: 'Health', icon: <HealthAndSafetyIcon /> },
  { value: 'pets', label: 'Pets', icon: <PetsIcon /> },
  { value: 'gaming', label: 'Gaming', icon: <SportsEsportsIcon /> },
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
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

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

      <DialogContent sx={{ p: 3, pt: 4 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Project Name */}
          <TextField
            fullWidth
            label="Project Name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter project name"
            InputLabelProps={{ shrink: true }}
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
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Project Icon
              </Typography>
              <Button
                fullWidth
                variant="outlined"
                onClick={() => setIconPickerOpen(true)}
                sx={{
                  justifyContent: 'flex-start',
                  p: 1.5,
                  borderRadius: 2,
                  textTransform: 'none',
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ fontSize: '1.5rem', display: 'flex', alignItems: 'center' }}>
                    {projectIcons.find(i => i.value === icon)?.icon}
                  </Box>
                  <Typography>
                    {projectIcons.find(i => i.value === icon)?.label || 'Select Icon'}
                  </Typography>
                </Box>
              </Button>
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

      {/* Icon Picker Dialog */}
      <Dialog
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>Select Project Icon</Typography>
            <IconButton onClick={() => setIconPickerOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Grid container spacing={1.5}>
            {projectIcons.map((iconOption) => (
              <Grid item xs={2.4} key={iconOption.value}>
                <Box
                  onClick={() => {
                    setIcon(iconOption.value);
                    setIconPickerOpen(false);
                  }}
                  sx={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    p: 1.5,
                    borderRadius: 2,
                    cursor: 'pointer',
                    border: icon === iconOption.value ? '2px solid #0f766e' : '2px solid transparent',
                    backgroundColor: icon === iconOption.value ? 'rgba(15, 118, 110, 0.1)' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor: icon === iconOption.value ? 'rgba(15, 118, 110, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  <Box sx={{ 
                    color: icon === iconOption.value ? '#0f766e' : 'text.secondary', 
                    mb: 0.5,
                    fontSize: '1.2rem',
                    display: 'flex',
                    alignItems: 'center',
                    '& .MuiSvgIcon-root': {
                      fontSize: '1.2rem'
                    }
                  }}>
                    {iconOption.icon}
                  </Box>
                  <Typography 
                    variant="caption" 
                    sx={{ 
                      fontSize: '0.65rem',
                      textAlign: 'center',
                      color: icon === iconOption.value ? '#0f766e' : 'text.secondary',
                      fontWeight: icon === iconOption.value ? 600 : 400,
                    }}
                  >
                    {iconOption.label}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

export default ProjectForm;
