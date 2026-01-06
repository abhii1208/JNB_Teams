import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid,
  IconButton,
  TextField,
  Typography,
  Avatar,
  AvatarGroup,
  Chip,
  Menu,
  MenuItem,
  InputAdornment,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import FolderIcon from '@mui/icons-material/Folder';
import GroupIcon from '@mui/icons-material/Group';
import WorkspacesIcon from '@mui/icons-material/Workspaces';

// Mock data for workspaces
const mockWorkspaces = [
  {
    id: 1,
    name: 'Engineering Team',
    description: 'All engineering projects and tasks',
    projectCount: 5,
    memberCount: 12,
    role: 'Owner',
    color: '#0f766e',
  },
  {
    id: 2,
    name: 'Marketing',
    description: 'Marketing campaigns and content',
    projectCount: 3,
    memberCount: 8,
    role: 'Admin',
    color: '#7c3aed',
  },
  {
    id: 3,
    name: 'Product Design',
    description: 'UI/UX design projects',
    projectCount: 4,
    memberCount: 6,
    role: 'Member',
    color: '#f59e0b',
  },
];

const roleColors = {
  'Owner': { bg: '#d1fae5', text: '#065f46' },
  'Admin': { bg: '#e0e7ff', text: '#3730a3' },
  'Project Admin': { bg: '#fef3c7', text: '#92400e' },
  'Member': { bg: '#f3e8ff', text: '#6b21a8' },
};

function WorkspaceList({ onSelectWorkspace }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newWorkspace, setNewWorkspace] = useState({ name: '', description: '' });
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedWorkspaceMenu, setSelectedWorkspaceMenu] = useState(null);

  const handleMenuOpen = (event, workspace) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedWorkspaceMenu(workspace);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedWorkspaceMenu(null);
  };

  const filteredWorkspaces = mockWorkspaces.filter(
    (ws) =>
      ws.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ws.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Workspaces
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage your workspaces and team collaboration
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => setCreateDialogOpen(true)}
          sx={{
            px: 3,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Create Workspace
        </Button>
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search workspaces..."
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
          mb: 4,
          maxWidth: 400,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            backgroundColor: '#fff',
          },
        }}
      />

      {/* Workspace Grid */}
      <Grid container spacing={3}>
        {filteredWorkspaces.map((workspace) => (
          <Grid item xs={12} sm={6} lg={4} key={workspace.id}>
            <Card
              elevation={0}
              onClick={() => onSelectWorkspace(workspace)}
              sx={{
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 3,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.1)',
                  borderColor: workspace.color,
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      backgroundColor: `${workspace.color}15`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: workspace.color,
                    }}
                  >
                    <WorkspacesIcon />
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                      label={workspace.role}
                      size="small"
                      sx={{
                        backgroundColor: roleColors[workspace.role]?.bg,
                        color: roleColors[workspace.role]?.text,
                        fontWeight: 500,
                        fontSize: '0.7rem',
                      }}
                    />
                    <IconButton
                      size="small"
                      onClick={(e) => handleMenuOpen(e, workspace)}
                    >
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>

                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
                  {workspace.name}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{
                    mb: 3,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                  }}
                >
                  {workspace.description}
                </Typography>

                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box sx={{ display: 'flex', gap: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <FolderIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {workspace.projectCount} projects
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <GroupIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {workspace.memberCount} members
                      </Typography>
                    </Box>
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
          sx: { borderRadius: 2, minWidth: 160 },
        }}
      >
        <MenuItem onClick={handleMenuClose}>Edit Workspace</MenuItem>
        <MenuItem onClick={handleMenuClose}>Manage Members</MenuItem>
        <MenuItem onClick={handleMenuClose}>Settings</MenuItem>
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          Delete Workspace
        </MenuItem>
      </Menu>

      {/* Create Workspace Dialog */}
      <Dialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { borderRadius: 3 },
        }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Workspace</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Workspace Name"
            value={newWorkspace.name}
            onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
            sx={{ mb: 3, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={newWorkspace.description}
            onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCreateDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={() => setCreateDialogOpen(false)}
            sx={{ textTransform: 'none', px: 3 }}
          >
            Create Workspace
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WorkspaceList;
