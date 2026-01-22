import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
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
} from '@mui/material';
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
import ProjectForm from './ProjectForm';
import { getProjects, createProject, updateProject, archiveProject, unarchiveProject, updateProjectAccess, getClients } from '../../apiClient';

function ProjectList({ onSelectProject, workspace, user }) {
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

  const handleSelectProject = async (project) => {
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
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Projects
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your projects and track progress
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
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Create Project
          </Button>
        )}
      </Box>

      {/* Search & Filter */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center', flexWrap: 'wrap' }}>
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
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
            backgroundColor: '#fff',
          },
        }}
      />
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Client</InputLabel>
          <Select
            label="Client"
            value={clientFilter}
            onChange={(e) => setClientFilter(e.target.value)}
            sx={{ borderRadius: 2, backgroundColor: '#fff' }}
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
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          Filter
        </Button>
        <Button
          variant={showArchived ? 'contained' : 'outlined'}
          startIcon={showArchived ? <UnarchiveIcon /> : <ArchiveIcon />}
          onClick={() => setShowArchived(!showArchived)}
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          {showArchived ? 'Show Active' : 'Show Archived'}
        </Button>
        
        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
          sx={{ ml: 'auto' }}
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
          sx={{ borderRadius: 2, textTransform: 'none' }}
        >
          Export
        </Button>
      </Box>

      {/* Projects Table View */}
      {viewMode === 'table' && (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 3, mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Clients</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Progress</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Open</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Pending</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Done</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Members</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                <TableCell sx={{ width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredProjects.map((project) => {
                const progress = project.taskCount > 0 ? Math.round((project.completedTasks / project.taskCount) * 100) : 0;
                const primaryClient = project.primary_client || (project.clients || [])[0];
                return (
                  <TableRow
                    key={project.id}
                    hover
                    onClick={() => handleSelectProject(project)}
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
                  >
                    <TableCell>
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
                    </TableCell>
                    <TableCell>
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
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, project)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Projects Card Grid */}
      {viewMode === 'card' && (
      <Grid container spacing={3}>
        {filteredProjects.map((project) => (
          <Grid item xs={12} md={6} lg={4} key={project.id}>
            <Card
              elevation={0}
              onClick={() => handleSelectProject(project)}
              sx={{
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 3,
                cursor: 'pointer',
                height: '100%',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.1)',
                  borderColor: '#0f766e',
                },
              }}
            >
              <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
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
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, fontSize: '1rem' }}>
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
                      <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2, minHeight: 26 }}>
                        {combinedClients.length === 0 ? (
                          <Typography variant="caption" color="text.secondary">
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
          </Grid>
        ))}
      </Grid>
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
    </Box>
  );
}

export default ProjectList;
