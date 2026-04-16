import React, { useState, useEffect, useMemo } from 'react';
import {
  Autocomplete,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  FormControl,
  FormHelperText,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  IconButton,
  Grid,
  Chip,
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
import { createClient, getClients, getWorkspaceMembers } from '../../apiClient';

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

function ProjectForm({ open, onClose, onSave, project, workspace, user }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [icon, setIcon] = useState('folder');
  const [color, setColor] = useState('#0f766e');
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [clientsOptions, setClientsOptions] = useState([]);
  const [selectedClients, setSelectedClients] = useState([]);
  const [primaryClientId, setPrimaryClientId] = useState(null);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [clientQuickOpen, setClientQuickOpen] = useState(false);
  const [quickClientName, setQuickClientName] = useState('');
  const [quickClientOwnerId, setQuickClientOwnerId] = useState(user?.id || '');
  const [quickClientStatus, setQuickClientStatus] = useState('Active');
  const [quickClientGstin, setQuickClientGstin] = useState('');
  const [quickClientTags, setQuickClientTags] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState([]);

  useEffect(() => {
    if (project) {
      setName(project.name ?? project.project_name ?? '');
      setDescription(project.description ?? project.project_description ?? '');
      setIcon(project.icon ?? project.project_icon ?? 'folder');
      setColor(project.color ?? project.project_color ?? '#0f766e');
      const existingClients = Array.isArray(project.clients) ? project.clients : [];
      const existingPrimary = project.primary_client || existingClients.find((c) => c.is_primary) || null;
      setSelectedClients(existingClients);
      setPrimaryClientId(existingPrimary?.id || existingClients[0]?.id || null);
    } else {
      setName('');
      setDescription('');
      setIcon('folder');
      setColor('#0f766e');
      setSelectedClients([]);
      setPrimaryClientId(null);
    }
  }, [project, open]);

  useEffect(() => {
    const fetchClients = async () => {
      if (!workspace?.id || !open) return;
      try {
        setClientsLoading(true);
        const response = await getClients(workspace.id);
        setClientsOptions(response.data || []);
      } catch (error) {
        console.error('Failed to fetch clients:', error);
        setClientsOptions([]);
      } finally {
        setClientsLoading(false);
      }
    };

    fetchClients();
  }, [workspace?.id, open]);

  useEffect(() => {
    if (selectedClients.length === 0) {
      if (primaryClientId !== null) setPrimaryClientId(null);
      return;
    }
    if (selectedClients.length === 1 && String(primaryClientId) !== String(selectedClients[0].id)) {
      setPrimaryClientId(selectedClients[0].id);
      return;
    }
    if (primaryClientId && !selectedClients.some((client) => String(client.id) === String(primaryClientId))) {
      setPrimaryClientId(selectedClients[0].id);
    }
  }, [selectedClients, primaryClientId]);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!clientQuickOpen || !workspace?.id) return;
      try {
        const response = await getWorkspaceMembers(workspace.id);
        setWorkspaceMembers(response.data || []);
      } catch (error) {
        console.error('Failed to fetch workspace members:', error);
        setWorkspaceMembers([]);
      }
    };

    fetchMembers();
  }, [clientQuickOpen, workspace?.id]);

  const createdOnLabel = useMemo(() => {
    const raw = getCreatedDateValue(project);
    const formatted = formatDateSafe(raw);
    return formatted ? `Created on ${formatted}` : 'Created on —';
  }, [project]);

  const handleSubmit = () => {
    const created = getCreatedDateValue(project) || new Date().toISOString();
    const selectedClientIds = selectedClients.map((client) => client.id);
    const resolvedPrimaryId = selectedClientIds.includes(primaryClientId)
      ? primaryClientId
      : selectedClientIds[0] || null;
    const resolvedPrimaryClient = selectedClients.find(
      (client) => String(client.id) === String(resolvedPrimaryId)
    ) || null;

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
      client_ids: selectedClientIds,
      primary_client_id: resolvedPrimaryId,
      clients: selectedClients,
      primary_client: resolvedPrimaryClient,
      // keep original backend field if it exists (no harm)
      ...(project?.created_at ? { created_at: project.created_at } : {}),
    };

    onSave(projectData);
    onClose();
  };

  const resetQuickClient = () => {
    setQuickClientName('');
    setQuickClientOwnerId(user?.id || '');
    setQuickClientStatus('Active');
    setQuickClientGstin('');
    setQuickClientTags('');
  };

  const handleCreateQuickClient = async () => {
    if (!workspace?.id || !quickClientName.trim()) return;
    const basePayload = {
      workspace_id: workspace.id,
      client_name: quickClientName.trim(),
      status: quickClientStatus,
      owner_user_id: quickClientOwnerId === '' ? null : quickClientOwnerId || user?.id || null,
      gstin: quickClientGstin || null,
      tags: quickClientTags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean),
    };
    try {
      const attemptCreate = async (allowDuplicate = false) => {
        const payload = allowDuplicate ? { ...basePayload, allow_duplicate: true } : basePayload;
        return createClient(payload);
      };

      let response = await attemptCreate();
      const created = response.data || {};
      const nextClient = {
        id: created.id,
        name: created.name || created.client_name || quickClientName.trim(),
        code: created.code || created.client_code,
        status: created.status || quickClientStatus,
      };
      setClientsOptions((prev) => {
        const exists = prev.some((client) => String(client.id) === String(nextClient.id));
        return exists ? prev : [...prev, nextClient];
      });
      setSelectedClients((prev) => {
        const exists = prev.some((client) => String(client.id) === String(nextClient.id));
        return exists ? prev : [...prev, nextClient];
      });
      if (!primaryClientId) {
        setPrimaryClientId(nextClient.id);
      }
      resetQuickClient();
      setClientQuickOpen(false);
    } catch (error) {
      const similar = error.response?.data?.similar_clients;
      if (error.response?.status === 409 && Array.isArray(similar) && similar.length > 0) {
        const list = similar.map((client) => `${client.name} (${client.code})`).join('\n');
        const proceed = window.confirm(
          `Similar clients found:\n${list}\n\nCreate anyway?`
        );
        if (proceed) {
          try {
            const retryResponse = await createClient({ ...basePayload, allow_duplicate: true });
            const created = retryResponse.data || {};
            const nextClient = {
              id: created.id,
              name: created.name || created.client_name || quickClientName.trim(),
              code: created.code || created.client_code,
              status: created.status || quickClientStatus,
            };
            setClientsOptions((prev) => {
              const exists = prev.some((client) => String(client.id) === String(nextClient.id));
              return exists ? prev : [...prev, nextClient];
            });
            setSelectedClients((prev) => {
              const exists = prev.some((client) => String(client.id) === String(nextClient.id));
              return exists ? prev : [...prev, nextClient];
            });
            if (!primaryClientId) {
              setPrimaryClientId(nextClient.id);
            }
            resetQuickClient();
            setClientQuickOpen(false);
            return;
          } catch (retryError) {
            console.error('Failed to create client after confirmation:', retryError);
            alert(retryError.response?.data?.error || 'Failed to create client');
            return;
          }
        }
      }
      console.error('Failed to create client:', error);
      alert(error.response?.data?.error || 'Failed to create client');
    }
  };

  const handleClose = () => onClose();

  const selectedIcon = projectIcons.find((i) => i.value === icon);

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { borderRadius: 3, width: { xs: 'calc(100vw - 16px)', sm: '100%' }, m: { xs: 1, sm: 2 }, maxHeight: { xs: 'calc(100dvh - 16px)', sm: 'calc(100vh - 32px)' } } }}
    >
      <DialogTitle sx={{ p: { xs: 2, sm: 3 }, pb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            {project ? 'Edit Project' : 'Create New Project'}
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent sx={{ p: { xs: 2, sm: 3 }, pt: 2.5 }}>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 3 } }}>
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

          {/* Clients */}
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Clients
            </Typography>
            <Autocomplete
              multiple
              options={clientsOptions}
              value={selectedClients}
              loading={clientsLoading}
              onChange={(_event, value) => setSelectedClients(value)}
              getOptionLabel={(option) => option?.name || ''}
              isOptionEqualToValue={(option, value) => String(option.id) === String(value.id)}
              getOptionDisabled={(option) => option?.status === 'Inactive'}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip
                    key={option.id || option.name}
                    label={option.name}
                    size="small"
                    variant={option.status === 'Inactive' ? 'outlined' : 'filled'}
                    sx={{ opacity: option.status === 'Inactive' ? 0.65 : 1 }}
                    {...getTagProps({ index })}
                  />
                ))
              }
              renderOption={(props, option) => (
                <Box component="li" {...props} sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
                  <Typography variant="body2">{option?.name}</Typography>
                  {option?.status === 'Inactive' && (
                    <Chip
                      label="Inactive"
                      size="small"
                      variant="outlined"
                      sx={{ fontSize: '0.65rem', height: 20 }}
                    />
                  )}
                </Box>
              )}
              renderInput={(params) => (
                <TextField
                  {...params}
                  placeholder="Search clients..."
                  sx={{ '& .MuiOutlinedInput-root': { borderRadius: 2 } }}
                />
              )}
            />
            <FormHelperText>
              Select one or more clients. Inactive clients cannot be newly linked.
            </FormHelperText>
            <Box sx={{ mt: 1, display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                size="small"
                onClick={() => {
                  resetQuickClient();
                  setClientQuickOpen(true);
                }}
                sx={{ textTransform: 'none' }}
              >
                + Add new client
              </Button>
            </Box>
          </Box>

          {selectedClients.length > 0 && (
            <Box>
              <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
                Primary Client
              </Typography>
              <FormControl fullWidth>
                <InputLabel>Primary Client</InputLabel>
                <Select
                  label="Primary Client"
                  value={primaryClientId || ''}
                  onChange={(e) => setPrimaryClientId(e.target.value)}
                >
                  {selectedClients.map((client) => (
                    <MenuItem key={client.id} value={client.id} disabled={client.status === 'Inactive'}>
                      {client.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
          )}

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

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
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

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name || 'Project Name'}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
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

      <DialogActions sx={{ p: { xs: 2, sm: 3 }, pt: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button
          onClick={handleClose}
          sx={{ textTransform: 'none', borderRadius: 2, px: 3, width: { xs: '100%', sm: 'auto' } }}
        >
          Cancel
        </Button>

        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!name.trim()}
          sx={{ textTransform: 'none', borderRadius: 2, px: 3, width: { xs: '100%', sm: 'auto' } }}
        >
          {project ? 'Save Changes' : 'Create Project'}
        </Button>
      </DialogActions>

      {/* Quick Add Client Dialog */}
      <Dialog
        open={clientQuickOpen}
        onClose={() => setClientQuickOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, width: { xs: 'calc(100vw - 16px)', sm: '100%' }, m: { xs: 1, sm: 2 } } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Quick Add Client</DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label="Client Name"
              value={quickClientName}
              onChange={(e) => setQuickClientName(e.target.value)}
              fullWidth
              required
            />
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                label="Status"
                value={quickClientStatus}
                onChange={(e) => setQuickClientStatus(e.target.value)}
              >
                <MenuItem value="Active">Active</MenuItem>
                <MenuItem value="Inactive">Inactive</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Owner</InputLabel>
              <Select
                label="Owner"
                value={quickClientOwnerId}
                onChange={(e) => setQuickClientOwnerId(e.target.value)}
              >
                <MenuItem value="">
                  <em>Unassigned</em>
                </MenuItem>
                {workspaceMembers.map((member) => (
                  <MenuItem key={member.id} value={member.id}>
                    {member.first_name || member.last_name
                      ? `${member.first_name || ''} ${member.last_name || ''}`.trim()
                      : member.email}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="GSTIN"
              value={quickClientGstin}
              onChange={(e) => setQuickClientGstin(e.target.value)}
              fullWidth
            />
            <TextField
              label="Tags"
              value={quickClientTags}
              onChange={(e) => setQuickClientTags(e.target.value)}
              fullWidth
              placeholder="Retail, Marketplace"
            />
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() => {
              setClientQuickOpen(false);
              resetQuickClient();
            }}
            sx={{ textTransform: 'none', width: { xs: '100%', sm: 'auto' } }}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleCreateQuickClient}
            disabled={!quickClientName.trim()}
            sx={{ textTransform: 'none', px: 3, width: { xs: '100%', sm: 'auto' } }}
          >
            Create Client
          </Button>
        </DialogActions>
      </Dialog>

      {/* Icon Picker Dialog */}
      <Dialog
        open={iconPickerOpen}
        onClose={() => setIconPickerOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3, width: { xs: 'calc(100vw - 16px)', sm: '100%' }, m: { xs: 1, sm: 2 } } }}
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
