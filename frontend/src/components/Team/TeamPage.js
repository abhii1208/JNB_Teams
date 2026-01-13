import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  MenuItem,
  Paper,
  Select,
  Tab,
  Tabs,
  TextField,
  Typography,
  Avatar,
  Alert,
  Menu,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import FolderIcon from '@mui/icons-material/Folder';
import EmailIcon from '@mui/icons-material/Email';
import { getWorkspaceMembers, addWorkspaceMember, updateWorkspaceMember, removeWorkspaceMember } from '../../apiClient';

const roleColors = {
  'Owner': { bg: '#d1fae5', text: '#065f46' },
  'Admin': { bg: '#e0e7ff', text: '#3730a3' },
  'ProjectAdmin': { bg: '#fef3c7', text: '#92400e' },
  'Member': { bg: '#f3e8ff', text: '#6b21a8' },
};

const roleDescriptions = {
  'Owner': 'Full control over workspace, including billing and deletion',
  'Admin': 'Same permissions as Owner except billing & workspace deletion',
  'ProjectAdmin': 'Can create projects and manage project memberships',
  'Member': 'Can access assigned projects, no workspace-wide control',
};

function TeamPage({ user, workspace }) {
  const [activeTab, setActiveTab] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMembers = async () => {
      if (!workspace?.id) return;
      try {
        setLoading(true);
        const response = await getWorkspaceMembers(workspace.id);
        setMembers(response.data);
      } catch (error) {
        console.error('Failed to fetch members:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchMembers();
  }, [workspace]);

  const isOwnerOrAdmin = ['Owner','Admin'].includes(workspace?.role);

  const handleMenuOpen = (event, member) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedMember(member);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedMember(null);
  };

  const handleInvite = async () => {
    if (!inviteEmail) return;
    try {
      // inviteRole already uses API role values: 'Admin', 'ProjectAdmin', 'Member'
      await addWorkspaceMember(workspace.id, inviteEmail, inviteRole);
      // Refresh members list
      const response = await getWorkspaceMembers(workspace.id);
      setMembers(response.data);
      setInviteDialogOpen(false);
      setInviteEmail('');
      setInviteRole('Member');
    } catch (error) {
      console.error('Failed to invite member:', error);
      alert(error.response?.data?.error || 'Failed to invite member. Please try again.');
    }
  };

  // Change role dialog state
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [newRole, setNewRole] = useState('Member');

  const openChangeRoleDialog = (member) => {
    setSelectedMember(member);
    setNewRole(member.role || 'Member');
    setChangeRoleOpen(true);
    setAnchorEl(null);
  };

  const handleChangeRoleConfirm = async () => {
    if (!selectedMember) return;
    try {
      await updateWorkspaceMember(workspace.id, selectedMember.id, newRole);
      const resp = await getWorkspaceMembers(workspace.id);
      setMembers(resp.data);
      setChangeRoleOpen(false);
      setSelectedMember(null);
    } catch (err) {
      console.error('Failed to change role', err);
      alert(err.response?.data?.error || 'Failed to change role');
    }
  };

  const handleRemoveMember = async (member) => {
    if (!member) return;
    if (!confirm(`Remove ${member.email} from workspace?`)) return;
    try {
      await removeWorkspaceMember(workspace.id, member.id);
      const resp = await getWorkspaceMembers(workspace.id);
      setMembers(resp.data);
      setAnchorEl(null);
      setSelectedMember(null);
    } catch (err) {
      console.error('Failed to remove member', err);
      alert(err.response?.data?.error || 'Failed to remove member');
    }
  };

  const filteredMembers = members.filter(
    (member) =>
      member.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      member.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Team Management
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage workspace members and their roles
          </Typography>
        </Box>
        {isOwnerOrAdmin && (
          <Button
            variant="contained"
            startIcon={<PersonAddIcon />}
            onClick={() => setInviteDialogOpen(true)}
            sx={{
              px: 3,
              py: 1.5,
              borderRadius: 2,
              textTransform: 'none',
              fontWeight: 600,
            }}
          >
            Invite Team
          </Button>
        )}
      </Box>

      {/* Search */}
      <TextField
        fullWidth
        placeholder="Search team members..."
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
          mb: 3,
          maxWidth: 400,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            backgroundColor: '#fff',
          },
        }}
      />

      {/* Team Members List */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 3,
        }}
      >
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <Typography variant="h6">
            Team Members ({filteredMembers.length})
          </Typography>
        </Box>

        <List sx={{ p: 2 }}>
          {filteredMembers.map((member) => {
            const name = (member.first_name || '') + (member.last_name ? ' ' + member.last_name : '') || member.username || member.email;
            const initials = (member.first_name ? member.first_name.charAt(0) : '') + (member.last_name ? member.last_name.charAt(0) : '');
            const role = member.role || 'Member';
            return (
            <ListItem
              key={member.id}
              sx={{
                borderRadius: 2,
                mb: 1,
                border: '1px solid rgba(148, 163, 184, 0.1)',
                '&:hover': {
                  backgroundColor: 'rgba(148, 163, 184, 0.05)',
                  borderColor: 'rgba(148, 163, 184, 0.3)',
                },
              }}
            >
              <ListItemAvatar>
                <Avatar
                  sx={{
                    bgcolor: '#0f766e',
                    width: 48,
                    height: 48,
                    fontWeight: 600,
                    fontSize: '1rem',
                  }}
                >
                  {member.avatar || initials}
                </Avatar>
              </ListItemAvatar>
              <ListItemText
                primary={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 0.5 }}>
                    <Typography variant="body1" sx={{ fontWeight: 600 }}>
                      {name}
                    </Typography>
                    {member.id === user?.id && (
                      <Chip label="You" size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                    )}
                  </Box>
                }
                secondary={
                  <Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
                      <EmailIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography component="span" variant="body2" color="text.secondary">
                          {member.email}
                        </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <WorkspacesIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {member.workspaces} workspaces
                        </Typography>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <FolderIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                        <Typography component="span" variant="caption" color="text.secondary">
                          {member.projects} projects
                        </Typography>
                      </Box>
                      <Typography component="span" variant="caption" color="text.secondary">
                        Joined {member.joinedDate}
                      </Typography>
                    </Box>
                  </Box>
                }
              />
              <Chip
                label={role}
                sx={{
                  backgroundColor: roleColors[role]?.bg,
                  color: roleColors[role]?.text,
                  fontWeight: 500,
                  mr: 2,
                }}
              />
              <ListItemSecondaryAction>
                {isOwnerOrAdmin && member.role !== 'Owner' && (
                  <IconButton
                    edge="end"
                    onClick={(e) => handleMenuOpen(e, member)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                )}
              </ListItemSecondaryAction>
            </ListItem>
          );
          })}
        </List>
      </Paper>

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 200 },
        }}
      >
        <MenuItem onClick={() => { openChangeRoleDialog(selectedMember); }}>
          Change Role
        </MenuItem>
        <MenuItem onClick={handleMenuClose}>View Projects</MenuItem>
        <MenuItem onClick={handleMenuClose}>Send Message</MenuItem>
        <MenuItem onClick={() => { handleRemoveMember(selectedMember); }} sx={{ color: 'error.main' }}>
          Remove from Workspace
        </MenuItem>
      </Menu>

      {/* Change Role Dialog */}
      <Dialog open={changeRoleOpen} onClose={() => setChangeRoleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Member Role</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Role</InputLabel>
            <Select value={newRole} label="Role" onChange={(e) => setNewRole(e.target.value)}>
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="ProjectAdmin">Project Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeRoleOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleChangeRoleConfirm}>Save</Button>
        </DialogActions>
      </Dialog>

      {/* Invite Member Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Invite Team Member</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 3, borderRadius: 2 }}>
            <Typography variant="caption">
              <strong>Important:</strong> Workspace roles control workspace-wide permissions. 
              Project-specific roles are assigned within each project.
            </Typography>
          </Alert>

          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="colleague@example.com"
            sx={{ mb: 3, mt: 1 }}
          />

          <FormControl fullWidth>
            <InputLabel>Workspace Role</InputLabel>
            <Select
              value={inviteRole}
              label="Workspace Role"
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <MenuItem value="Admin">Admin (Same as Owner)</MenuItem>
              <MenuItem value="ProjectAdmin">Project Admin (can create projects)</MenuItem>
              <MenuItem value="Member">Member (Access to assigned projects)</MenuItem>
            </Select>
          </FormControl>

          <Box sx={{ mt: 2, p: 2, borderRadius: 2, backgroundColor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Owner:</strong> Full control (only one owner per workspace)<br />
              <strong>Admin:</strong> Same as Owner except billing & deletion<br />
              <strong>Project Admin:</strong> Can create projects and manage project memberships<br />
              <strong>Member:</strong> Access to assigned projects only
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setInviteDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!inviteEmail.trim()}
            sx={{ textTransform: 'none', px: 3 }}
            onClick={handleInvite}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TeamPage;
