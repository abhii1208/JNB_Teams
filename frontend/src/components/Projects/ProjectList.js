import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  IconButton,
  InputAdornment,
  TextField,
  Typography,
  Menu,
  MenuItem,
  Avatar,
  AvatarGroup,
  CircularProgress,
  FormControl,
  InputLabel,
  Select,
  Tooltip,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  LinearProgress,
  Checkbox,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  Divider,
  Alert,
  Snackbar,
  Autocomplete,
  RadioGroup,
  Radio,
  FormControlLabel,
  Badge,
  Collapse,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
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
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import EditIcon from '@mui/icons-material/Edit';
import GroupAddIcon from '@mui/icons-material/GroupAdd';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import ProjectForm from './ProjectForm';
import { 
  getProjects, 
  createProject, 
  updateProject, 
  archiveProject, 
  unarchiveProject, 
  updateProjectAccess, 
  getClients,
  getWorkspaceMembers,
  getProjectMembers,
  addProjectMember,
  transferProjectOwnership,
} from '../../apiClient';

function ProjectList({ onSelectProject, workspace, user }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [clientOptions, setClientOptions] = useState([]);
  const [clientFilter, setClientFilter] = useState('all');
  const [viewMode, setViewMode] = useState('card'); // 'card' or 'table'

  // === Bulk Edit State ===
  const [selectedProjects, setSelectedProjects] = useState(new Set());
  const [bulkAddMembersOpen, setBulkAddMembersOpen] = useState(false);
  const [transferOwnershipOpen, setTransferOwnershipOpen] = useState(false);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [membersLoading, setMembersLoading] = useState(false);
  
  // Bulk Add Members Dialog State
  const [selectedMembersToAdd, setSelectedMembersToAdd] = useState([]);
  const [memberRole, setMemberRole] = useState('Member');
  const [bulkOperationLoading, setBulkOperationLoading] = useState(false);
  
  // Transfer Ownership Dialog State
  const [transferTargetUser, setTransferTargetUser] = useState(null);
  const [transferReason, setTransferReason] = useState('');
  const [eligibleTransferUsers, setEligibleTransferUsers] = useState([]);
  
  // Inline Edit State
  const [inlineEditingProject, setInlineEditingProject] = useState(null);
  const [inlineEditValues, setInlineEditValues] = useState({});
  
  // Snackbar for feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });

  // Helper: Check if user can edit a project (is Owner or Admin of that project)
  const canEditProject = useCallback((project) => {
    if (!project || !user) return false;
    const projectRole = project.role;
    // User is Owner or Admin of the project
    if (projectRole === 'Owner' || projectRole === 'Admin') return true;
    // User is workspace Owner or Admin - they can manage all projects
    if (workspace?.role === 'Owner' || workspace?.role === 'Admin') return true;
    return false;
  }, [user, workspace]);

  // Helper: Check if user is project Owner (not just Admin)
  const isProjectOwner = useCallback((project) => {
    if (!project || !user) return false;
    return project.role === 'Owner' || workspace?.role === 'Owner';
  }, [user, workspace]);

  // Get editable projects from selection (only projects user can edit)
  const editableSelectedProjects = useMemo(() => {
    return Array.from(selectedProjects)
      .map(id => projects.find(p => p.id === id))
      .filter(p => p && canEditProject(p));
  }, [selectedProjects, projects, canEditProject]);

  // Get projects where user can transfer ownership (must be Owner)
  const transferableSelectedProjects = useMemo(() => {
    return Array.from(selectedProjects)
      .map(id => projects.find(p => p.id === id))
      .filter(p => p && isProjectOwner(p));
  }, [selectedProjects, projects, isProjectOwner]);

  // Show toast message
  const showToast = useCallback((severity, message) => {
    setSnackbar({ open: true, message, severity });
  }, []);

  // Export projects to CSV
  const handleExport = () => {
    const headers = ['Name', 'Description', 'Status', 'Clients', 'Open Tasks', 'Pending Approval', 'Completed Tasks', 'Total Tasks', 'Members'];
    const csvData = filteredProjects.map(project => [
      project.name || '',
      (project.description || '').replace(/"/g, '""'),
      project.status || '',
      (project.clients || []).map(c => c.name).join('; '),
      project.openTasks || 0,
      project.pendingApproval || 0,
      project.completedTasks || 0,
      project.taskCount || 0,
      (project.members || []).length
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `projects_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  // Fetch projects
  useEffect(() => {
    const fetchProjects = async () => {
      if (!workspace?.id) return;
      try {
        setLoading(true);
        const response = await getProjects(workspace.id, showArchived);
        // Ensure we always have an array, and provide default values for missing properties
        const projectsData = (response.data || []).map(p => ({
          ...p,
          members: p.members || [],
          clients: Array.isArray(p.clients) ? p.clients : [],
          primary_client: p.primary_client || null,
          openTasks: p.open_tasks || 0,
          pendingApproval: p.pending_approval || 0,
          completedTasks: p.completed_tasks || 0,
          taskCount: p.task_count || 0,
          status: p.status || 'Active'
        }));
        setProjects(projectsData);
      } catch (error) {
        console.error('Failed to fetch projects:', error);
        setProjects([]); // Set empty array on error
      } finally {
        setLoading(false);
      }
    };
    
    fetchProjects();
  }, [workspace, showArchived]);

  useEffect(() => {
    const fetchClients = async () => {
      if (!workspace?.id) return;
      try {
        const response = await getClients(workspace.id, { status: 'Active' });
        setClientOptions(response.data || []);
      } catch (error) {
        console.error('Failed to fetch clients:', error);
        setClientOptions([]);
      }
    };

    fetchClients();
  }, [workspace?.id]);

  useEffect(() => {
    setClientFilter('all');
  }, [workspace?.id]);

  // Fetch workspace members when bulk add members dialog opens
  useEffect(() => {
    const fetchWorkspaceMembers = async () => {
      if (!workspace?.id || !bulkAddMembersOpen) return;
      setMembersLoading(true);
      try {
        const response = await getWorkspaceMembers(workspace.id);
        setWorkspaceMembers(response.data || []);
      } catch (error) {
        console.error('Failed to fetch workspace members:', error);
        setWorkspaceMembers([]);
      } finally {
        setMembersLoading(false);
      }
    };
    fetchWorkspaceMembers();
  }, [workspace?.id, bulkAddMembersOpen]);

  // Fetch eligible users for ownership transfer
  useEffect(() => {
    const fetchEligibleUsers = async () => {
      if (!transferOwnershipOpen || transferableSelectedProjects.length !== 1) return;
      
      const project = transferableSelectedProjects[0];
      try {
        const response = await getProjectMembers(project.id);
        // Only admins and members can receive ownership transfer
        const eligible = (response.data || []).filter(
          member => member.role !== 'Owner' && member.id !== user?.id
        );
        setEligibleTransferUsers(eligible);
      } catch (error) {
        console.error('Failed to fetch project members:', error);
        setEligibleTransferUsers([]);
      }
    };
    fetchEligibleUsers();
  }, [transferOwnershipOpen, transferableSelectedProjects, user?.id]);

  // Clear selection when archived view changes
  useEffect(() => {
    setSelectedProjects(new Set());
  }, [showArchived]);

  // === Bulk Selection Handlers ===
  const handleSelectProject = (projectId, event) => {
    if (event) event.stopPropagation();
    setSelectedProjects(prev => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    const editableProjects = filteredProjects.filter(p => canEditProject(p));
    if (selectedProjects.size === editableProjects.length) {
      setSelectedProjects(new Set());
    } else {
      setSelectedProjects(new Set(editableProjects.map(p => p.id)));
    }
  };

  const handleClearSelection = () => {
    setSelectedProjects(new Set());
  };

  // === Bulk Add Members Handler ===
  const handleBulkAddMembers = async () => {
    if (selectedMembersToAdd.length === 0 || editableSelectedProjects.length === 0) return;
    
    setBulkOperationLoading(true);
    const results = { success: 0, failed: 0, errors: [] };
    
    for (const project of editableSelectedProjects) {
      for (const member of selectedMembersToAdd) {
        try {
          await addProjectMember(project.id, { user_id: member.id, role: memberRole });
          results.success++;
        } catch (error) {
          const errMsg = error.response?.data?.error || 'Unknown error';
          if (!errMsg.includes('already a project member')) {
            results.failed++;
            results.errors.push(`${project.name}: ${member.name || member.email} - ${errMsg}`);
          }
        }
      }
    }
    
    setBulkOperationLoading(false);
    setBulkAddMembersOpen(false);
    setSelectedMembersToAdd([]);
    setMemberRole('Member');
    
    if (results.success > 0) {
      showToast('success', `Added ${results.success} member(s) to project(s)`);
      // Refresh projects to get updated member lists
      const response = await getProjects(workspace.id, showArchived);
      const projectsData = (response.data || []).map(p => ({
        ...p,
        members: p.members || [],
        clients: Array.isArray(p.clients) ? p.clients : [],
        primary_client: p.primary_client || null,
        openTasks: p.open_tasks || 0,
        pendingApproval: p.pending_approval || 0,
        completedTasks: p.completed_tasks || 0,
        taskCount: p.task_count || 0,
        status: p.status || 'Active'
      }));
      setProjects(projectsData);
    }
    if (results.failed > 0) {
      showToast('error', `Failed to add ${results.failed} member(s). Check console for details.`);
      console.error('Bulk add member errors:', results.errors);
    }
  };

  // === Transfer Ownership Handler ===
  const handleTransferOwnership = async () => {
    if (!transferTargetUser || transferableSelectedProjects.length !== 1) return;
    
    const project = transferableSelectedProjects[0];
    setBulkOperationLoading(true);
    
    try {
      await transferProjectOwnership(project.id, transferTargetUser.id, transferReason);
      showToast('success', `Ownership of "${project.name}" transferred to ${transferTargetUser.name || transferTargetUser.email}`);
      
      // Refresh projects
      const response = await getProjects(workspace.id, showArchived);
      const projectsData = (response.data || []).map(p => ({
        ...p,
        members: p.members || [],
        clients: Array.isArray(p.clients) ? p.clients : [],
        primary_client: p.primary_client || null,
        openTasks: p.open_tasks || 0,
        pendingApproval: p.pending_approval || 0,
        completedTasks: p.completed_tasks || 0,
        taskCount: p.task_count || 0,
        status: p.status || 'Active'
      }));
      setProjects(projectsData);
      setSelectedProjects(new Set());
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Failed to transfer ownership');
    } finally {
      setBulkOperationLoading(false);
      setTransferOwnershipOpen(false);
      setTransferTargetUser(null);
      setTransferReason('');
    }
  };

  // === Inline Edit Handlers ===
  const handleStartInlineEdit = (project, event) => {
    if (event) event.stopPropagation();
    if (!canEditProject(project)) return;
    
    setInlineEditingProject(project.id);
    setInlineEditValues({
      name: project.name || '',
      description: project.description || '',
      status: project.status || 'Active',
    });
  };

  const handleInlineEditChange = (field, value) => {
    setInlineEditValues(prev => ({ ...prev, [field]: value }));
  };

  const handleSaveInlineEdit = async (projectId) => {
    try {
      await updateProject(projectId, inlineEditValues);
      setProjects(prev => prev.map(p => 
        p.id === projectId ? { ...p, ...inlineEditValues } : p
      ));
      showToast('success', 'Project updated');
    } catch (error) {
      showToast('error', error.response?.data?.error || 'Failed to update project');
    } finally {
      setInlineEditingProject(null);
      setInlineEditValues({});
    }
  };

  const handleCancelInlineEdit = () => {
    setInlineEditingProject(null);
    setInlineEditValues({});
  };

  // === Bulk Archive Handler ===
  const handleBulkArchive = async () => {
    const projectsToArchive = editableSelectedProjects.filter(p => isProjectOwner(p));
    if (projectsToArchive.length === 0) {
      showToast('error', 'You can only archive projects you own');
      return;
    }
    
    setBulkOperationLoading(true);
    let successCount = 0;
    
    for (const project of projectsToArchive) {
      try {
        await archiveProject(project.id);
        successCount++;
      } catch (error) {
        console.error(`Failed to archive ${project.name}:`, error);
      }
    }
    
    setBulkOperationLoading(false);
    if (successCount > 0) {
      setProjects(prev => prev.filter(p => !projectsToArchive.some(ap => ap.id === p.id)));
      setSelectedProjects(new Set());
      showToast('success', `Archived ${successCount} project(s)`);
    }
  };

  const roleColors = {
    'Owner': { bg: '#d1fae5', text: '#065f46' },
    'Admin': { bg: '#e0e7ff', text: '#3730a3' },
    'Member': { bg: '#f3e8ff', text: '#6b21a8' },
  };

  const statusColors = {
    'Active': { bg: '#d1fae5', text: '#065f46' },
    'Completed': { bg: '#e2e8f0', text: '#475569' },
    'On Hold': { bg: '#fef3c7', text: '#92400e' },
  };

  const handleOpenProjectForm = (project = null) => {
    setEditingProject(project);
    setProjectFormOpen(true);
    if (project) {
      handleMenuClose();
    }
  };

  const handleCloseProjectForm = () => {
    setProjectFormOpen(false);
    setEditingProject(null);
  };

  const handleSaveProject = async (projectData) => {
    try {
      if (editingProject) {
        // Update existing project
        const response = await updateProject(editingProject.id, projectData);
        const updatedProject = {
          // merge server response with local projectData to preserve icon/color when server doesn't return them
          ...response.data,
          ...projectData,
          members: (response.data && (response.data.members || response.data.members === []) ) ? response.data.members : (projectData.members || []),
          openTasks: response.data.openTasks || response.data.open_tasks || 0,
          pendingApproval: response.data.pendingApproval || response.data.pending_approval || 0,
          completedTasks: response.data.completedTasks || response.data.completed_tasks || 0,
          taskCount: response.data.taskCount || response.data.task_count || 0,
          status: response.data.status || 'Active'
        };
        setProjects(projects.map(p => p.id === editingProject.id ? updatedProject : p));
      } else {
        // Add new project
        const response = await createProject({ ...projectData, workspace_id: workspace.id });
        const newProject = {
          // merge server response with projectData to keep icon/color even if server omits them
          ...response.data,
          ...projectData,
          members: response.data.members || projectData.members || [],
          openTasks: response.data.openTasks || response.data.open_tasks || 0,
          pendingApproval: response.data.pendingApproval || response.data.pending_approval || 0,
          completedTasks: response.data.completedTasks || response.data.completed_tasks || 0,
          taskCount: response.data.taskCount || response.data.task_count || 0,
          status: response.data.status || 'Active'
        };
        setProjects([...projects, newProject]);
      }
      handleCloseProjectForm();
    } catch (error) {
      console.error('Failed to save project:', error);
      alert('Failed to save project. Please try again.');
    }
  };

  const handleMenuOpen = (event, project) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedProject(project);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedProject(null);
  };

  const handleProjectClick = async (project) => {
    // Update last accessed timestamp
    try {
      await updateProjectAccess(project.id);
    } catch (err) {
      console.error('Failed to update project access:', err);
    }
    onSelectProject(project);
  };

  const handleArchive = async () => {
    if (!selectedProject) return;
    try {
      await archiveProject(selectedProject.id);
      // Remove from current list
      setProjects(projects.filter(p => p.id !== selectedProject.id));
      handleMenuClose();
    } catch (err) {
      console.error('Failed to archive project:', err);
      alert('Failed to archive project');
    }
  };

  const handleUnarchive = async () => {
    if (!selectedProject) return;
    try {
      await unarchiveProject(selectedProject.id);
      // Remove from archived list
      setProjects(projects.filter(p => p.id !== selectedProject.id));
      handleMenuClose();
    } catch (err) {
      console.error('Failed to unarchive project:', err);
      alert('Failed to unarchive project');
    }
  };

  const filteredProjects = (projects || []).filter(
    (proj) => {
      const matchesSearch =
        proj.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        proj.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesClient =
        clientFilter === 'all' ||
        (proj.clients || []).some((client) => String(client.id) === String(clientFilter));
      return matchesSearch && matchesClient;
    }
  );

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: { xs: 1, sm: 3, lg: 4 } }}>
      {/* Header */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 2.25, sm: 3 },
          mb: 2,
          borderRadius: { xs: 4, sm: 3 },
          border: '1px solid rgba(148, 163, 184, 0.14)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.95) 100%)',
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', sm: 'center' }, gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#0f766e', mb: 0.8 }}>
              PROJECT HUB
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.75, fontSize: { xs: '1.65rem', sm: '2.125rem' } }}>
              Projects
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your pipeline, team ownership, and progress in one place.
            </Typography>
          </Box>
          {['Owner', 'Admin', 'ProjectAdmin'].includes(workspace?.role) && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => handleOpenProjectForm()}
              sx={{
                px: 3,
                py: 1.5,
                borderRadius: 3,
                fontWeight: 700,
              }}
              fullWidth={isMobile}
            >
              Create Project
            </Button>
          )}
        </Box>
      </Paper>

      {/* Search & Filter */}
      <Paper
        elevation={0}
        sx={{
          p: { xs: 1.5, sm: 2 },
          mb: 3,
          borderRadius: 3,
          border: '1px solid rgba(148, 163, 184, 0.14)',
        }}
      >
      <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          fullWidth
          placeholder="Search projects..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon sx={{ color: 'text.secondary' }} />
              </InputAdornment>
            ),
          }}
          sx={{
            width: { xs: '100%', sm: 'auto' },
            maxWidth: { xs: '100%', sm: 400 },
            '& .MuiOutlinedInput-root': {
              borderRadius: 3,
              backgroundColor: '#fff',
            },
          }}
        />
        <FormControl sx={{ minWidth: { xs: '100%', sm: 200 } }}>
          <InputLabel>Client</InputLabel>
          <Select
            label="Client"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            sx={{ borderRadius: 3, backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All Clients</MenuItem>
            {clientOptions.map((client) => (
              <MenuItem key={client.id} value={client.id}>
                {client.name}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button
          variant="outlined"
          startIcon={<FilterListIcon />}
          onClick={(e) => setFilterAnchorEl(e.currentTarget)}
          sx={{ borderRadius: 3 }}
        >
          Filter
        </Button>
        <Button
          variant={showArchived ? 'contained' : 'outlined'}
          startIcon={showArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
          onClick={() => setShowArchived(!showArchived)}
          sx={{ borderRadius: 3 }}
        >
          {showArchived ? 'Show Active' : 'Show Archived'}
        </Button>
        
        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
          sx={{ ml: { xs: 0, md: 'auto' } }}
        >
          <ToggleButton value="card" sx={{ px: 1.5 }}>
            <Tooltip title="Card View">
              <ViewModuleIcon />
            </Tooltip>
          </ToggleButton>
          <ToggleButton value="table" sx={{ px: 1.5 }}>
            <Tooltip title="Table View">
              <ViewListIcon />
            </Tooltip>
          </ToggleButton>
        </ToggleButtonGroup>

        {/* Export Button */}
          <Button
            variant="outlined"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            sx={{ borderRadius: 3 }}
          >
            Export
          </Button>
      </Box>
      </Paper>

      {/* Projects Table View */}
      {viewMode === 'table' && (
        <>
          {/* Bulk Edit Toolbar */}
          <Collapse in={selectedProjects.size > 0}>
            <Paper 
              elevation={2}
              sx={{ 
                p: 1.5, 
                mb: 2, 
                display: 'flex', 
                alignItems: 'center', 
                gap: 2,
                bgcolor: '#f0fdf4',
                border: '1px solid #86efac',
                borderRadius: 2,
              }}
            >
              <Badge badgeContent={selectedProjects.size} color="primary">
                <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                  Selected
                </Typography>
              </Badge>
              
              <Divider orientation="vertical" flexItem />
              
              {/* Bulk Add Members - Only for editable projects */}
              {editableSelectedProjects.length > 0 && (
                <Tooltip title={`Add members to ${editableSelectedProjects.length} project(s)`}>
                  <Button
                    size="small"
                    startIcon={<GroupAddIcon />}
                    onClick={() => setBulkAddMembersOpen(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    Add Members ({editableSelectedProjects.length})
                  </Button>
                </Tooltip>
              )}
              
              {/* Transfer Ownership - Only for single owner project */}
              {transferableSelectedProjects.length === 1 && (
                <Tooltip title="Transfer project ownership">
                  <Button
                    size="small"
                    startIcon={<SwapHorizIcon />}
                    onClick={() => setTransferOwnershipOpen(true)}
                    sx={{ textTransform: 'none' }}
                  >
                    Transfer Ownership
                  </Button>
                </Tooltip>
              )}
              
              {/* Bulk Archive - Only for owned projects */}
              {!showArchived && transferableSelectedProjects.length > 0 && (
                <Tooltip title={`Archive ${transferableSelectedProjects.length} project(s) you own`}>
                  <Button
                    size="small"
                    startIcon={<ArchiveIcon />}
                    onClick={handleBulkArchive}
                    sx={{ textTransform: 'none' }}
                  >
                    Archive ({transferableSelectedProjects.length})
                  </Button>
                </Tooltip>
              )}
              
              <Box sx={{ flex: 1 }} />
              
              <Button
                size="small"
                onClick={handleClearSelection}
                sx={{ textTransform: 'none' }}
              >
                Clear Selection
              </Button>
            </Paper>
          </Collapse>

          <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 3, mb: 3, overflowX: 'auto' }}>
            <Table sx={{ minWidth: 980 }}>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f8fafc' }}>
                  <TableCell padding="checkbox" sx={{ width: 48 }}>
                    <Tooltip title={selectedProjects.size === filteredProjects.filter(p => canEditProject(p)).length ? 'Deselect all' : 'Select all editable'}>
                      <Checkbox
                        indeterminate={selectedProjects.size > 0 && selectedProjects.size < filteredProjects.filter(p => canEditProject(p)).length}
                        checked={selectedProjects.size > 0 && selectedProjects.size === filteredProjects.filter(p => canEditProject(p)).length}
                        onChange={handleSelectAll}
                        size="small"
                      />
                    </Tooltip>
                  </TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Clients</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Progress</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Open</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Pending</TableCell>
                  <TableCell sx={{ fontWeight: 600 }} align="center">Done</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Members</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                  <TableCell sx={{ fontWeight: 600, width: 100 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredProjects.map((project) => {
                  const progress = project.taskCount > 0 ? Math.round((project.completedTasks / project.taskCount) * 100) : 0;
                  const primaryClient = project.primary_client || (project.clients || [])[0];
                  const isEditable = canEditProject(project);
                  const isInlineEditing = inlineEditingProject === project.id;
                  const isSelected = selectedProjects.has(project.id);
                  
                  return (
                    <TableRow
                      key={project.id}
                      hover
                      selected={isSelected}
                      onClick={() => !isInlineEditing && handleProjectClick(project)}
                      sx={{ 
                        cursor: isInlineEditing ? 'default' : 'pointer', 
                        '&:hover': { bgcolor: '#f8fafc' },
                        bgcolor: isSelected ? 'rgba(15, 118, 110, 0.08)' : 'inherit',
                      }}
                    >
                      {/* Checkbox Cell */}
                      <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
                        {isEditable ? (
                          <Checkbox
                            checked={isSelected}
                            onChange={(e) => handleSelectProject(project.id, e)}
                            size="small"
                          />
                        ) : (
                          <Tooltip title="You don't have edit permission for this project">
                            <span>
                              <Checkbox disabled size="small" />
                            </span>
                          </Tooltip>
                        )}
                      </TableCell>
                      
                      {/* Project Name Cell - With inline edit */}
                      <TableCell>
                        {isInlineEditing ? (
                          <TextField
                            size="small"
                            fullWidth
                            value={inlineEditValues.name || ''}
                            onChange={(e) => handleInlineEditChange('name', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            autoFocus
                            sx={{ minWidth: 200 }}
                          />
                        ) : (
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                            <Box
                              sx={{
                                width: 32,
                                height: 32,
                                borderRadius: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                bgcolor: project.color || '#0f766e',
                              }}
                            >
                              <FolderIcon sx={{ color: '#fff', fontSize: 18 }} />
                            </Box>
                            <Box>
                              <Typography variant="body2" fontWeight={600}>{project.name}</Typography>
                              {project.description && (
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {project.description}
                                </Typography>
                              )}
                            </Box>
                          </Box>
                        )}
                      </TableCell>
                      
                      {/* Status Cell - With inline edit */}
                      <TableCell onClick={(e) => isInlineEditing && e.stopPropagation()}>
                        {isInlineEditing ? (
                          <Select
                            size="small"
                            value={inlineEditValues.status || 'Active'}
                            onChange={(e) => handleInlineEditChange('status', e.target.value)}
                            sx={{ minWidth: 100 }}
                          >
                            <MenuItem value="Active">Active</MenuItem>
                            <MenuItem value="On Hold">On Hold</MenuItem>
                            <MenuItem value="Completed">Completed</MenuItem>
                          </Select>
                        ) : (
                          <Chip
                            label={project.status || 'Active'}
                            size="small"
                            sx={{
                              bgcolor: statusColors[project.status]?.bg || '#d1fae5',
                              color: statusColors[project.status]?.text || '#065f46',
                              fontWeight: 500,
                              fontSize: '0.7rem',
                            }}
                          />
                        )}
                      </TableCell>
                      
                      <TableCell>
                        {primaryClient ? (
                          <Tooltip title={(project.clients || []).map(c => c.name).join(', ')}>
                            <Chip
                              label={primaryClient.name}
                              size="small"
                              sx={{ bgcolor: project.color || '#0f766e', color: '#fff', fontWeight: 500, fontSize: '0.65rem' }}
                            />
                          </Tooltip>
                        ) : (
                          <Typography variant="caption" color="text.secondary">-</Typography>
                        )}
                      </TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                          <LinearProgress
                            variant="determinate"
                            value={progress}
                            sx={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              bgcolor: 'rgba(148, 163, 184, 0.2)',
                              '& .MuiLinearProgress-bar': { bgcolor: '#0f766e', borderRadius: 3 }
                            }}
                          />
                          <Typography variant="caption" fontWeight={600}>{progress}%</Typography>
                        </Box>
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={project.openTasks || 0} size="small" sx={{ bgcolor: '#fef3c7', color: '#92400e', fontWeight: 600, minWidth: 32 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={project.pendingApproval || 0} size="small" sx={{ bgcolor: '#fee2e2', color: '#991b1b', fontWeight: 600, minWidth: 32 }} />
                      </TableCell>
                      <TableCell align="center">
                        <Chip label={project.completedTasks || 0} size="small" sx={{ bgcolor: '#d1fae5', color: '#065f46', fontWeight: 600, minWidth: 32 }} />
                      </TableCell>
                      <TableCell>
                        <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 24, height: 24, fontSize: '0.65rem' } }}>
                          {(project.members || []).map((member, idx) => (
                            <Avatar key={idx} sx={{ bgcolor: '#0f766e', fontWeight: 600 }}>
                              {typeof member === 'string' ? member : member?.name?.charAt(0) || '?'}
                            </Avatar>
                          ))}
                        </AvatarGroup>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={project.role || 'Member'}
                          size="small"
                          sx={{
                            bgcolor: roleColors[project.role]?.bg || '#f3e8ff',
                            color: roleColors[project.role]?.text || '#6b21a8',
                            fontWeight: 500,
                            fontSize: '0.65rem',
                          }}
                        />
                      </TableCell>
                      
                      {/* Actions Cell */}
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        {isInlineEditing ? (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            <Tooltip title="Save changes">
                              <IconButton 
                                size="small" 
                                color="primary"
                                onClick={() => handleSaveInlineEdit(project.id)}
                              >
                                <CheckIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Cancel">
                              <IconButton 
                                size="small" 
                                onClick={handleCancelInlineEdit}
                              >
                                <CloseIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        ) : (
                          <Box sx={{ display: 'flex', gap: 0.5 }}>
                            {isEditable && (
                              <Tooltip title="Quick edit">
                                <IconButton 
                                  size="small" 
                                  onClick={(e) => handleStartInlineEdit(project, e)}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            )}
                            <IconButton size="small" onClick={(e) => handleMenuOpen(e, project)}>
                              <MoreVertIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </TableContainer>
        </>
      )}

      {/* Projects Card Grid */}
      {viewMode === 'card' && (
      <Box
        sx={{
          display: 'grid',
          gap: { xs: 1.5, sm: 3 },
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(3, minmax(0, 1fr))',
            lg: 'repeat(5, minmax(0, 1fr))',
          },
        }}
      >
        {filteredProjects.map((project) => (
          <Card
            key={project.id}
            elevation={0}
            onClick={() => handleProjectClick(project)}
            sx={{
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
              cursor: 'pointer',
              height: { xs: 'auto', sm: 360 },
              minWidth: 0,
              transition: 'all 0.2s ease',
              '&:hover': {
                transform: 'translateY(-4px)',
                boxShadow: '0 12px 40px rgba(15, 23, 42, 0.1)',
                borderColor: '#0f766e',
              },
            }}
          >
              <CardContent sx={{ p: { xs: 1.75, sm: 2 }, height: '100%', display: 'flex', flexDirection: 'column' }}>
                {/* Header */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                  <Box
                    sx={{
                      width: 40,
                      height: 40,
                      borderRadius: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: project.color || 'rgba(15, 118, 110, 0.1)',
                    }}
                  >
                        {/* Render selected project icon if present */}
                        {(() => {
                          const iconValue = project.icon || 'folder';
                          const iconMap = {
                            folder: FolderIcon,
                            dashboard: DashboardIcon,
                            code: CodeIcon,
                            design: DesignServicesIcon,
                            bug: BugReportIcon,
                            campaign: CampaignIcon,
                            lightbulb: LightbulbIcon,
                            rocket: RocketLaunchIcon,
                            star: StarIcon,
                            analytics: AnalyticsIcon,
                            settings: SettingsIcon,
                            build: BuildIcon,
                            science: ScienceIcon,
                            school: SchoolIcon,
                            psychology: PsychologyIcon,
                            offer: LocalOfferIcon,
                            store: StorefrontIcon,
                            cart: ShoppingCartIcon,
                            restaurant: RestaurantIcon,
                            flight: FlightIcon,
                            car: DirectionsCarIcon,
                            hotel: HotelIcon,
                            health: HealthAndSafetyIcon,
                            pets: PetsIcon,
                            gaming: SportsEsportsIcon,
                          };
                          const IconComp = iconMap[iconValue] || FolderIcon;
                          return <IconComp sx={{ color: '#fff', fontSize: 20 }} />;
                        })()}
                  </Box>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, project)}
                  >
                    <MoreVertIcon fontSize="small" />
                  </IconButton>
                </Box>

                {/* Project Info */}
                <Typography
                  variant="h6"
                  sx={{
                    fontWeight: 600,
                    mb: 0.5,
                    fontSize: '1rem',
                    lineHeight: 1.2,
                    whiteSpace: 'normal',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflowWrap: 'anywhere',
                    wordBreak: 'break-word',
                    minHeight: '2.4em',
                  }}
                >
                  {project.name}
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
                  {project.workspace}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 2,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    minHeight: 35,
                    fontSize: '0.85rem',
                  }}
                >
                  {project.description}
                </Typography>

                {/* Clients */}
                {(() => {
                  const clientList = project.clients || [];
                  const primaryClient = project.primary_client || clientList.find((c) => c.is_primary) || null;
                  const combinedClients = primaryClient && !clientList.some((c) => String(c.id) === String(primaryClient.id))
                    ? [primaryClient, ...clientList]
                    : clientList;
                  const secondaryClients = combinedClients.filter(
                    (c) => !primaryClient || String(c.id) !== String(primaryClient.id)
                  );
                  const secondaryDisplay = secondaryClients.slice(0, 2);
                  const overflowCount = secondaryClients.length - secondaryDisplay.length;
                  const tooltipLabel = combinedClients.length
                    ? combinedClients.map((c) => c.name).join(', ')
                    : 'No clients linked';

                  return (
                    <Tooltip title={tooltipLabel} arrow>
                      <Box
                        sx={{
                          display: 'flex',
                          gap: 0.5,
                          flexWrap: 'nowrap',
                          alignItems: 'center',
                          overflow: 'hidden',
                          minWidth: 0,
                          mb: 2,
                          minHeight: 26,
                        }}
                      >
                        {combinedClients.length === 0 ? (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            noWrap
                            sx={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}
                          >
                            No client linked
                          </Typography>
                        ) : (
                          <>
                            {primaryClient && (
                              <Chip
                                label={primaryClient.name}
                                size="small"
                                sx={{
                                  backgroundColor: primaryClient.status === 'Inactive'
                                    ? '#e2e8f0'
                                    : (project.color || '#0f766e'),
                                  color: primaryClient.status === 'Inactive' ? '#475569' : '#fff',
                                  fontWeight: 600,
                                  fontSize: '0.65rem',
                                  height: 22,
                                  maxWidth: 140,
                                  minWidth: 0,
                                  '& .MuiChip-label': {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                  },
                                }}
                              />
                            )}
                            {secondaryDisplay.map((client) => (
                              <Chip
                                key={client.id}
                                label={client.name}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontWeight: 500,
                                  fontSize: '0.65rem',
                                  height: 22,
                                  opacity: client.status === 'Inactive' ? 0.6 : 1,
                                  maxWidth: 140,
                                  minWidth: 0,
                                  '& .MuiChip-label': {
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'block',
                                  },
                                }}
                              />
                            ))}
                            {overflowCount > 0 && (
                              <Chip
                                label={`+${overflowCount}`}
                                size="small"
                                variant="outlined"
                                sx={{
                                  fontWeight: 500,
                                  fontSize: '0.65rem',
                                  height: 22,
                                }}
                              />
                            )}
                          </>
                        )}
                      </Box>
                    </Tooltip>
                  );
                })()}

                {/* Stats */}
                <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
                  <Chip
                    label={`${project.openTasks} Open`}
                    size="small"
                    sx={{
                      backgroundColor: '#fef3c7',
                      color: '#92400e',
                      fontWeight: 500,
                      fontSize: '0.65rem',
                      height: 22,
                    }}
                  />
                  <Chip
                    label={`${project.pendingApproval} Pending`}
                    size="small"
                    sx={{
                      backgroundColor: '#fee2e2',
                      color: '#991b1b',
                      fontWeight: 500,
                      fontSize: '0.65rem',
                      height: 22,
                    }}
                  />
                  <Chip
                    label={`${project.completedTasks} Done`}
                    size="small"
                    sx={{
                      backgroundColor: '#d1fae5',
                      color: '#065f46',
                      fontWeight: 500,
                      fontSize: '0.65rem',
                      height: 22,
                    }}
                  />
                </Box>

                {/* Progress Bar */}
                <Box sx={{ mb: 2 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                      Progress
                    </Typography>
                    <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                      {Math.round((project.completedTasks / project.taskCount) * 100)}%
                    </Typography>
                  </Box>
                  <Box
                    sx={{
                      height: 6,
                      backgroundColor: 'rgba(148, 163, 184, 0.2)',
                      borderRadius: 3,
                      overflow: 'hidden',
                    }}
                  >
                    <Box
                      sx={{
                        height: '100%',
                        width: `${(project.completedTasks / project.taskCount) * 100}%`,
                        backgroundColor: '#0f766e',
                        borderRadius: 3,
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </Box>
                </Box>

                {/* Footer */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
                  <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 26, height: 26, fontSize: '0.7rem' } }}>
                    {project.members.map((member, idx) => {
                      // `member` can be a string (initials) or an object { id, avatar, name }
                      const content = typeof member === 'string'
                        ? member
                        : (member && (member.avatar || (member.name ? member.name.split(' ').map(n=>n[0]).join('').slice(0,2) : String(member.id))))
                      ;

                      return (
                        <Avatar key={idx} sx={{ bgcolor: '#0f766e', fontWeight: 600 }}>
                          {content}
                        </Avatar>
                      );
                    })}
                  </AvatarGroup>
                  <Box sx={{ display: 'flex', gap: 0.5 }}>
                    <Chip
                      label={project.role}
                      size="small"
                      sx={{
                        backgroundColor: roleColors[project.role]?.bg,
                        color: roleColors[project.role]?.text,
                        fontWeight: 500,
                        fontSize: '0.65rem',
                        height: 20,
                      }}
                    />
                    <Chip
                      label={project.status}
                      size="small"
                      sx={{
                        backgroundColor: statusColors[project.status]?.bg,
                        color: statusColors[project.status]?.text,
                        fontWeight: 500,
                        fontSize: '0.65rem',
                        height: 20,
                      }}
                    />
                  </Box>
                </Box>
              </CardContent>
          </Card>
        ))}
      </Box>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 180 },
        }}
      >
        <MenuItem onClick={handleMenuClose}>View Project</MenuItem>
        <MenuItem onClick={() => handleOpenProjectForm(selectedProject)}>Edit Details</MenuItem>
        <MenuItem onClick={handleMenuClose}>Project Settings</MenuItem>
        <MenuItem onClick={handleMenuClose}>Manage Members</MenuItem>
        {!showArchived && selectedProject?.role === 'Owner' && (
          <MenuItem onClick={handleArchive}>
            <ArchiveIcon sx={{ mr: 1, fontSize: 20 }} />
            Archive Project
          </MenuItem>
        )}
        {showArchived && selectedProject?.role === 'Owner' && (
          <MenuItem onClick={handleUnarchive}>
            <UnarchiveIcon sx={{ mr: 1, fontSize: 20 }} />
            Unarchive Project
          </MenuItem>
        )}
        {selectedProject?.role === 'Owner' && (
          <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
            Delete Project
          </MenuItem>
        )}
      </Menu>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchorEl}
        open={Boolean(filterAnchorEl)}
        onClose={() => setFilterAnchorEl(null)}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 200 },
        }}
      >
        <MenuItem onClick={() => setFilterAnchorEl(null)}>All Projects</MenuItem>
        <MenuItem onClick={() => setFilterAnchorEl(null)}>Active Only</MenuItem>
        <MenuItem onClick={() => setFilterAnchorEl(null)}>Completed</MenuItem>
        <MenuItem onClick={() => setFilterAnchorEl(null)}>On Hold</MenuItem>
        <MenuItem onClick={() => setFilterAnchorEl(null)}>My Projects</MenuItem>
      </Menu>

      {/* Project Form Dialog */}
      <ProjectForm
        open={projectFormOpen}
        onClose={handleCloseProjectForm}
        onSave={handleSaveProject}
        project={editingProject}
        workspace={workspace}
        user={user}
      />

      {/* Bulk Add Members Dialog */}
      <Dialog 
        open={bulkAddMembersOpen} 
        onClose={() => setBulkAddMembersOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <GroupAddIcon color="primary" />
            <Typography variant="h6">Add Members to Projects</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            Adding members to <strong>{editableSelectedProjects.length}</strong> project(s) where you have edit access.
          </Alert>
          
          {/* Project List */}
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Selected Projects:</Typography>
          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            {editableSelectedProjects.map(p => (
              <Chip key={p.id} label={p.name} size="small" />
            ))}
          </Box>
          
          {/* Member Selection */}
          <Autocomplete
            multiple
            options={workspaceMembers.filter(m => 
              !selectedMembersToAdd.some(s => s.id === m.id)
            )}
            getOptionLabel={(option) => 
              `${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email
            }
            value={selectedMembersToAdd}
            onChange={(_, newValue) => setSelectedMembersToAdd(newValue)}
            loading={membersLoading}
            renderOption={(props, option) => {
              const { key, ...rest } = props;
              return (
                <Box component="li" key={key} {...rest} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: '#0f766e' }}>
                    {(option.first_name?.[0] || option.email?.[0] || '?').toUpperCase()}
                  </Avatar>
                  <Box>
                    <Typography variant="body2">
                      {`${option.first_name || ''} ${option.last_name || ''}`.trim() || option.email}
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      {option.email}
                    </Typography>
                  </Box>
                </Box>
              );
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                label="Select Members"
                placeholder="Search workspace members..."
                sx={{ mb: 2 }}
              />
            )}
          />
          
          {/* Role Selection */}
          <FormControl fullWidth>
            <InputLabel>Assign Role</InputLabel>
            <Select
              value={memberRole}
              label="Assign Role"
              onChange={(e) => setMemberRole(e.target.value)}
            >
              <MenuItem value="Admin">
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2">Admin</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Can manage project settings, members, and tasks
                  </Typography>
                </Box>
              </MenuItem>
              <MenuItem value="Member">
                <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                  <Typography variant="body2">Member</Typography>
                  <Typography variant="caption" color="text.secondary">
                    Can view and work on tasks (creation depends on settings)
                  </Typography>
                </Box>
              </MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setBulkAddMembersOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleBulkAddMembers}
            disabled={selectedMembersToAdd.length === 0 || bulkOperationLoading}
            startIcon={bulkOperationLoading ? <CircularProgress size={16} /> : <PersonAddIcon />}
            sx={{ textTransform: 'none' }}
          >
            {bulkOperationLoading ? 'Adding...' : `Add ${selectedMembersToAdd.length} Member(s)`}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Transfer Ownership Dialog */}
      <Dialog
        open={transferOwnershipOpen}
        onClose={() => setTransferOwnershipOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <SwapHorizIcon color="warning" />
            <Typography variant="h6">Transfer Project Ownership</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {transferableSelectedProjects.length === 1 && (
            <>
              <Alert severity="warning" sx={{ mb: 2 }}>
                You are about to transfer ownership of <strong>{transferableSelectedProjects[0]?.name}</strong>.
                This action will make you an Admin of the project and the selected user will become the Owner.
              </Alert>
              
              <Typography variant="subtitle2" sx={{ mb: 1 }}>Select New Owner:</Typography>
              
              {eligibleTransferUsers.length === 0 ? (
                <Alert severity="info">
                  No eligible users found. The project must have at least one Admin or Member who can receive ownership.
                </Alert>
              ) : (
                <RadioGroup
                  value={transferTargetUser?.id || ''}
                  onChange={(e) => {
                    const userId = parseInt(e.target.value, 10);
                    setTransferTargetUser(eligibleTransferUsers.find(u => u.id === userId) || null);
                  }}
                >
                  <List>
                    {eligibleTransferUsers.map((member) => (
                      <ListItem 
                        key={member.id} 
                        dense 
                        sx={{ 
                          border: '1px solid', 
                          borderColor: transferTargetUser?.id === member.id ? 'primary.main' : 'divider',
                          borderRadius: 2,
                          mb: 1,
                          bgcolor: transferTargetUser?.id === member.id ? 'rgba(15, 118, 110, 0.08)' : 'inherit',
                        }}
                      >
                        <FormControlLabel
                          value={member.id}
                          control={<Radio />}
                          label={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, ml: 1 }}>
                              <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: '#0f766e' }}>
                                {(member.name?.[0] || member.email?.[0] || '?').toUpperCase()}
                              </Avatar>
                              <Box>
                                <Typography variant="body2" fontWeight={600}>
                                  {member.name || member.email}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  Current role: {member.role}
                                </Typography>
                              </Box>
                            </Box>
                          }
                          sx={{ width: '100%', m: 0 }}
                        />
                      </ListItem>
                    ))}
                  </List>
                </RadioGroup>
              )}
              
              <TextField
                fullWidth
                label="Reason for Transfer (optional)"
                multiline
                rows={2}
                value={transferReason}
                onChange={(e) => setTransferReason(e.target.value)}
                placeholder="e.g., Team restructuring, role change, etc."
                sx={{ mt: 2 }}
              />
            </>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setTransferOwnershipOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleTransferOwnership}
            disabled={!transferTargetUser || bulkOperationLoading}
            startIcon={bulkOperationLoading ? <CircularProgress size={16} /> : <SwapHorizIcon />}
            sx={{ textTransform: 'none' }}
          >
            {bulkOperationLoading ? 'Transferring...' : 'Transfer Ownership'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbar({ ...snackbar, open: false })} 
          severity={snackbar.severity}
          variant="filled"
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ProjectList;
