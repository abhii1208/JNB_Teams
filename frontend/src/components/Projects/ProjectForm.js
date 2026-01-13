import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
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

// --- helpers ---
function getCreatedDateValue(p) {
  if (!p) return null;
  return (
    p.createdDate ??
    p.created_at ??
    p.createdAt ??
    p.created_on ??
    p.createdOn ??
    null
  );
}

function formatDateSafe(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
}

function ProjectForm({ open, onClose, onSave, project, workspace }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('folder');
  const [color, setColor] = useState('#0f766e');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);

  useEffect(() => {
    if (project) {
      setName(project.name ?? project.project_name ?? '');
      setDescription(project.description ?? project.project_description ?? '');
      setIcon(project.icon ?? project.project_icon ?? 'folder');
      setColor(project.color ?? project.project_color ?? '#0f766e');
    } else {
      setName('');
      setDescription('');
      setIcon('folder');
      setColor('#0f766e');
    }
  }, [project, open]);

  const createdOnLabel = useMemo(() => {
    const raw = getCreatedDateValue(project);
    const formatted = formatDateSafe(raw);
    return formatted ? `Created on ${formatted}` : 'Created on —';
  }, [project]);

  const handleSubmit = () => {
    const created = getCreatedDateValue(project) || new Date().toISOString();

    const projectData = {
      id: project?.id || Date.now(),
      name: name.trim(),
      description,
      icon,
      color,
      workspace: workspace?.name || 'Current Workspace',
      createdDate: created, // keep this for your app usage
      status: project?.status || 'Active',
      members: project?.members || [],
      tasks: project?.tasks || [],
      // keep original backend field if it exists (no harm)
      ...(project?.created_at ? { created_at: project.created_at } : {}),
    };

    onSave(projectData);
    onClose();
  };

  const handleClose = () => onClose();

  const selectedIcon = projectIcons.find((i) => i.value === icon);
  const selectedColor = projectColors.find((c) => c.value === color);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3 } }}
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

      <DialogContent sx={{ p: 3, pt: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
          {/* Project Name (fixed label clipping by using external label) */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Project Name <Box component="span" sx={{ color: 'error.main' }}>*</Box>
            </Typography>
            <TextField
              fullWidth
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter project name"
              autoFocus
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />
          </Box>

          {/* Description */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Description
            </Typography>
            <TextField
              fullWidth
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this project about?"
              multiline
              rows={3}
              sx={{
                '& .MuiOutlinedInput-root': { borderRadius: 2 },
              }}
            />
          </Box>

          {/* Icon + Color (aligned) */}
          <Grid container spacing={2} alignItems="flex-end">
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
                  height: 52,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    {selectedIcon?.icon}
                  </Box>
                  <Typography sx={{ fontWeight: 500 }}>
                    {selectedIcon?.label || 'Select Icon'}
                  </Typography>
                </Box>
              </Button>
            </Grid>

            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Project Color
              </Typography>

              <FormControl fullWidth>
                <Select
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  displayEmpty
                  sx={{
                    borderRadius: 2,
                    height: 52,
                    '& .MuiSelect-select': {
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                    },
                  }}
                  renderValue={(selected) => {
                    const opt = projectColors.find((c) => c.value === selected);
                    return (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 18,
                            height: 18,
                            borderRadius: 1,
                            backgroundColor: selected,
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                          }}
                        />
                        <Typography sx={{ fontWeight: 500 }}>
                          {opt?.label || 'Select color'}
                        </Typography>
                      </Box>
                    );
                  }}
                >
                  {projectColors.map((c) => (
                    <MenuItem key={c.value} value={c.value}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 18,
                            height: 18,
                            borderRadius: 1,
                            backgroundColor: c.value,
                            border: '1px solid rgba(148, 163, 184, 0.25)',
                          }}
                        />
                        <Typography>{c.label}</Typography>
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
                  '& .MuiSvgIcon-root': { color: '#fff' },
                }}
              >
                {selectedIcon?.icon}
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

          {/* Created date (safe) */}
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
                {createdOnLabel}
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>

      <DialogActions sx={{ p: 3, pt: 2 }}>
        <Button
          onClick={handleClose}
          sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}
        >
          Cancel
        </Button>

        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim()}
          sx={{ textTransform: 'none', borderRadius: 2, px: 3 }}
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
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Select Project Icon
            </Typography>
            <IconButton onClick={() => setIconPickerOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>

        <DialogContent>
          <Grid container spacing={1.5}>
            {projectIcons.map((opt) => (
              <Grid item xs={3} sm={2.4} key={opt.value}>
                <Box
                  onClick={() => {
                    setIcon(opt.value);
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
                    border: icon === opt.value ? '2px solid #0f766e' : '2px solid transparent',
                    backgroundColor: icon === opt.value ? 'rgba(15, 118, 110, 0.1)' : 'transparent',
                    transition: 'all 0.2s',
                    '&:hover': {
                      backgroundColor:
                        icon === opt.value
                          ? 'rgba(15, 118, 110, 0.15)'
                          : 'rgba(148, 163, 184, 0.1)',
                      transform: 'scale(1.05)',
                    },
                  }}
                >
                  <Box
                    sx={{
                      color: icon === opt.value ? '#0f766e' : 'text.secondary',
                      mb: 0.5,
                      display: 'flex',
                      alignItems: 'center',
                      '& .MuiSvgIcon-root': { fontSize: '1.2rem' },
                    }}
                  >
                    {opt.icon}
                  </Box>

                  <Typography
                    variant="caption"
                    sx={{
                      fontSize: '0.65rem',
                      textAlign: 'center',
                      color: icon === opt.value ? '#0f766e' : 'text.secondary',
                      fontWeight: icon === opt.value ? 600 : 400,
                    }}
                  >
                    {opt.label}
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
