import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
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
  TextField,
  Typography,
  Avatar,
  Alert,
  Menu,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
} from '@mui/material';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import WorkspacesIcon from '@mui/icons-material/Workspaces';
import FolderIcon from '@mui/icons-material/Folder';
import EmailIcon from '@mui/icons-material/Email';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import FileDownloadIcon from '@mui/icons-material/FileDownload';
import { getWorkspaceMembers, addWorkspaceMember, updateWorkspaceMember, removeWorkspaceMember } from '../../apiClient';

const roleColors = {
  'Owner': { bg: '#d1fae5', text: '#065f46' },
  'Admin': { bg: '#e0e7ff', text: '#3730a3' },
  'ProjectAdmin': { bg: '#fef3c7', text: '#92400e' },
  'Member': { bg: '#f3e8ff', text: '#6b21a8' },
};

function TeamPage({ user, workspace }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Member');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedMember, setSelectedMember] = useState(null);
  const [members, setMembers] = useState([]);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'table'

  // Export members to CSV
  const handleExport = () => {
    const headers = ['Name', 'Email', 'Role', 'Workspaces', 'Projects', 'Joined'];
    const csvData = filteredMembers.map(member => {
      const name = (member.first_name || '') + (member.last_name ? ' ' + member.last_name : '') || member.username || member.email;
      return [
        name,
        member.email || '',
        member.role || 'Member',
        member.workspaces || 0,
        member.projects || 0,
        member.joinedDate || ''
      ];
    });
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `team_members_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  useEffect(() => {
    const fetchMembers = async () => {
      if (!workspace?.id) return;
      try {
        const response = await getWorkspaceMembers(workspace.id);
        setMembers(response.data);
      } catch (error) {
        console.error('Failed to fetch members:', error);
      }
    };
    
    fetchMembers();
  }, [workspace]);

  const isOwnerOrAdmin = ['Owner','Admin'].includes(workspace?.role);
  const isOwner = workspace?.role === 'Owner';

  // Helper function to check if current user can manage a member
  const canManageMember = (member) => {
    if (!member || !isOwnerOrAdmin) return false;
    // Can't manage yourself
    if (member.id === user?.id) return false;
    // Owner can manage everyone
    if (isOwner) return true;
    // Admin can't manage Owner or other Admins
    if (member.role === 'Owner' || member.role === 'Admin') return false;
    return true;
  };

  // Helper function to check if role change is allowed
  const canChangeToRole = (member, targetRole) => {
    if (!member || !canManageMember(member)) return false;
    // Only owner can assign Owner role
    if (targetRole === 'Owner' && !isOwner) return false;
    return true;
  };

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
    if (!window.confirm(`Remove ${member.email} from workspace?`)) return;
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

      {/* Search & View Controls */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
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
            maxWidth: 400,
            flex: 1,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: '#fff',
            },
          }}
        />
        
        {/* View Mode Toggle */}
        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(e, newMode) => newMode && setViewMode(newMode)}
          size="small"
          sx={{ ml: 'auto' }}
        >
          <ToggleButton value="list" sx={{ px: 1.5 }}>
            <Tooltip title="List View">
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

      {/* Team Members Table View */}
      {viewMode === 'table' && (
        <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 3, mb: 3 }}>
          <Table>
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Member</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Workspaces</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Projects</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Joined</TableCell>
                <TableCell sx={{ width: 50 }}></TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredMembers.map((member) => {
                const name = (member.first_name || '') + (member.last_name ? ' ' + member.last_name : '') || member.username || member.email;
                const initials = (member.first_name ? member.first_name.charAt(0) : '') + (member.last_name ? member.last_name.charAt(0) : '');
                const role = member.role || 'Member';
                return (
                  <TableRow key={member.id} hover sx={{ '&:hover': { bgcolor: '#f8fafc' } }}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar sx={{ bgcolor: '#0f766e', width: 32, height: 32, fontSize: '0.8rem', fontWeight: 600 }}>
                          {member.avatar || initials}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" fontWeight={600}>{name}</Typography>
                          {member.id === user?.id && (
                            <Chip label="You" size="small" sx={{ height: 18, fontSize: '0.65rem', ml: 0.5 }} />
                          )}
                        </Box>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{member.email}</Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={role}
                        size="small"
                        sx={{
                          bgcolor: roleColors[role]?.bg || '#f3e8ff',
                          color: roleColors[role]?.text || '#6b21a8',
                          fontWeight: 500,
                          fontSize: '0.7rem',
                        }}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{member.workspaces || 0}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography variant="body2">{member.projects || 0}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">{member.joinedDate || '-'}</Typography>
                    </TableCell>
                    <TableCell>
                      {isOwnerOrAdmin && member.role !== 'Owner' && (
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, member)}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Team Members List View */}
      {viewMode === 'list' && (
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
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 200 },
        }}
      >
        {/* Change Role - only show if user can manage this member */}
        {selectedMember && canManageMember(selectedMember) ? (
          <MenuItem onClick={() => { openChangeRoleDialog(selectedMember); }}>
            Change Role
          </MenuItem>
        ) : selectedMember?.id === user?.id ? (
          <MenuItem disabled sx={{ opacity: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Cannot change own role
            </Typography>
          </MenuItem>
        ) : selectedMember?.role === 'Owner' ? (
          <MenuItem disabled sx={{ opacity: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Owner role - use transfer
            </Typography>
          </MenuItem>
        ) : selectedMember?.role === 'Admin' && !isOwner ? (
          <MenuItem disabled sx={{ opacity: 0.5 }}>
            <Typography variant="body2" color="text.secondary">
              Only Owner can manage Admins
            </Typography>
          </MenuItem>
        ) : null}
        <MenuItem onClick={handleMenuClose}>View Projects</MenuItem>
        <MenuItem onClick={handleMenuClose}>Send Message</MenuItem>
        {/* Remove - only show if user can manage this member */}
        {selectedMember && canManageMember(selectedMember) ? (
          <MenuItem onClick={() => { handleRemoveMember(selectedMember); }} sx={{ color: 'error.main' }}>
            Remove from Workspace
          </MenuItem>
        ) : selectedMember?.id === user?.id ? (
          <MenuItem disabled sx={{ color: 'text.secondary', opacity: 0.5 }}>
            Cannot remove yourself
          </MenuItem>
        ) : selectedMember?.role === 'Owner' ? (
          <MenuItem disabled sx={{ color: 'text.secondary', opacity: 0.5 }}>
            Cannot remove Owner
          </MenuItem>
        ) : selectedMember?.role === 'Admin' && !isOwner ? (
          <MenuItem disabled sx={{ color: 'text.secondary', opacity: 0.5 }}>
            Only Owner can remove Admins
          </MenuItem>
        ) : null}
      </Menu>

      {/* Change Role Dialog */}
      <Dialog open={changeRoleOpen} onClose={() => setChangeRoleOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Change Member Role</DialogTitle>
        <DialogContent>
          {selectedMember && (
            <Box sx={{ mb: 2, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
              <Typography variant="subtitle2" color="text.secondary">
                Changing role for:
              </Typography>
              <Typography variant="body1" fontWeight={500}>
                {selectedMember.first_name} {selectedMember.last_name || selectedMember.email}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Current role: {selectedMember.role}
              </Typography>
            </Box>
          )}
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Role</InputLabel>
            <Select value={newRole} label="Role" onChange={(e) => setNewRole(e.target.value)}>
              {isOwner && <MenuItem value="Owner">Owner (Transfer ownership)</MenuItem>}
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="ProjectAdmin">Project Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ mt: 2, p: 2, bgcolor: 'info.50', borderRadius: 1, border: '1px solid', borderColor: 'info.200' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Role Permissions:</strong><br/>
              • <strong>Owner:</strong> Full control (only one per workspace)<br/>
              • <strong>Admin:</strong> Same as Owner except cannot manage other Admins<br/>
              • <strong>Project Admin:</strong> Can create/manage projects<br/>
              • <strong>Member:</strong> Access to assigned projects only
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setChangeRoleOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleChangeRoleConfirm}
            disabled={newRole === selectedMember?.role}
          >
            {newRole === 'Owner' ? 'Transfer Ownership' : 'Save'}
          </Button>
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
