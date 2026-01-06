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
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FilterListIcon from '@mui/icons-material/FilterList';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ProjectForm from './ProjectForm';
import { getProjects, createProject, updateProject, archiveProject, unarchiveProject, updateProjectAccess } from '../../apiClient';

function ProjectList({ onSelectProject, workspace }) {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projectFormOpen, setProjectFormOpen] = useState(false);
  const [editingProject, setEditingProject] = useState(null);
  const [showArchived, setShowArchived] = useState(false);

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
          ...response.data,
          members: response.data.members || [],
          openTasks: response.data.openTasks || 0,
          pendingApproval: response.data.pendingApproval || 0,
          completedTasks: response.data.completedTasks || 0,
          taskCount: response.data.taskCount || 0,
          status: response.data.status || 'Active'
        };
        setProjects(projects.map(p => p.id === editingProject.id ? updatedProject : p));
      } else {
        // Add new project
        const response = await createProject({ ...projectData, workspace_id: workspace.id });
        const newProject = {
          ...response.data,
          members: response.data.members || [],
          openTasks: 0,
          pendingApproval: 0,
          completedTasks: 0,
          taskCount: 0,
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
    (proj) =>
      proj.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      proj.description?.toLowerCase().includes(searchQuery.toLowerCase())
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
      <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center' }}>
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
      </Box>

      {/* Projects Grid */}
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
                      backgroundColor: 'rgba(15, 118, 110, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#0f766e',
                    }}
                  >
                    <FolderIcon />
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
                        fontWeight: 500,
                        fontSize: '0.7rem',
                      }}
                    />
                  </Box>
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

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
      />
    </Box>
  );
}

export default ProjectList;
