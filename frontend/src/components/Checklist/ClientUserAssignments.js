/**
 * ClientUserAssignments - Admin UI for managing user-client assignments
 * Allows admins to assign users to specific clients
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  ListItemSecondaryAction,
  Checkbox,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import BusinessIcon from '@mui/icons-material/Business';
import GroupIcon from '@mui/icons-material/Group';
import {
  getClientAssignments,
  removeUserFromClient,
  bulkAssignUsersToClient,
  getWorkspaceMembers,
} from '../../apiClient';

function ClientUserAssignments({ workspaceId, clients }) {
  const [assignments, setAssignments] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Dialog states
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSelectedClientIds, setBulkSelectedClientIds] = useState([]);
  const [bulkSelectedUserIds, setBulkSelectedUserIds] = useState([]);

  // View mode: 'by-client' or 'by-user'
  const [viewMode, setViewMode] = useState('by-client');

  const normalizeMultiSelectValue = (value) => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string') return value.split(',');
    return [];
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [assignmentsRes, membersRes] = await Promise.all([
        getClientAssignments(workspaceId),
        getWorkspaceMembers(workspaceId),
      ]);

      setAssignments(assignmentsRes.data || []);
      setMembers(membersRes.data || []);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group assignments by client
  const assignmentsByClient = React.useMemo(() => {
    const grouped = {};
    clients.forEach(client => {
      grouped[client.id] = {
        client,
        users: assignments
          .filter(a => a.client_id === client.id && a.is_active)
          .map(a => ({
            id: a.user_id,
            name: a.user_name,
            email: a.user_email,
            assignedAt: a.assigned_at,
          })),
      };
    });
    return grouped;
  }, [clients, assignments]);

  // Group assignments by user
  const assignmentsByUser = React.useMemo(() => {
    const grouped = {};
    members.forEach(member => {
      const userId = member.id || member.user_id || member.userId; // Try different field names
      grouped[userId] = {
        user: member,
        clients: assignments
          .filter(a => a.user_id === userId && a.is_active)
          .map(a => ({
            id: a.client_id,
            name: a.client_name,
            code: a.client_code,
            assignedAt: a.assigned_at,
          })),
      };
    });
    return grouped;
  }, [members, assignments]);

  const regularMembers = React.useMemo(
    () => members.filter((m) => !['Owner', 'Admin'].includes(m.role)),
    [members]
  );

  // Open assign dialog for a client
  const handleOpenAssignDialog = (client) => {
    setSelectedClient(client);
    const currentAssignments = assignmentsByClient[client.id]?.users || [];
    const initialSelectedUsers = currentAssignments.map(u => u.id);
    setSelectedUsers(initialSelectedUsers);
    setAssignDialogOpen(true);
  };

  // Save assignments
  const handleSaveAssignments = async () => {
    if (!selectedClient) return;

    try {
      setSaving(true);
      setError(null);

      await bulkAssignUsersToClient(selectedClient.id, selectedUsers);
      
      setAssignDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving assignments:', err);
      setError(err.response?.data?.error || 'Failed to save assignments');
    } finally {
      setSaving(false);
    }
  };

  const handleOpenBulkDialog = () => {
    setBulkSelectedClientIds([]);
    setBulkSelectedUserIds([]);
    setBulkDialogOpen(true);
  };

  const handleApplyBulkAccess = async () => {
    if (bulkSelectedClientIds.length === 0 || bulkSelectedUserIds.length === 0) {
      setError('Select at least one client and one user for bulk access');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      await Promise.all(
        bulkSelectedClientIds.map((clientId) => bulkAssignUsersToClient(clientId, bulkSelectedUserIds))
      );
      setBulkDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error applying bulk access:', err);
      setError(err.response?.data?.error || 'Failed to apply bulk access');
    } finally {
      setSaving(false);
    }
  };

  // Remove single assignment
  const handleRemoveAssignment = async (clientId, userId) => {
    if (!window.confirm('Are you sure you want to remove this user from the client?')) {
      return;
    }

    try {
      await removeUserFromClient(clientId, userId);
      fetchData();
    } catch (err) {
      console.error('Error removing assignment:', err);
      setError(err.response?.data?.error || 'Failed to remove assignment');
    }
  };

  // Toggle user selection
  const handleToggleUser = (userId) => {
    setSelectedUsers(prev => {
      const newSelection = prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      return newSelection;
    });
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h6" sx={{ fontWeight: 600 }}>
          Client Access
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            onClick={handleOpenBulkDialog}
            size="small"
          >
            Bulk Access
          </Button>
          <Button
            variant={viewMode === 'by-client' ? 'contained' : 'outlined'}
            startIcon={<BusinessIcon />}
            onClick={() => setViewMode('by-client')}
            size="small"
          >
            By Client
          </Button>
          <Button
            variant={viewMode === 'by-user' ? 'contained' : 'outlined'}
            startIcon={<GroupIcon />}
            onClick={() => setViewMode('by-user')}
            size="small"
          >
            By User
          </Button>
        </Box>
      </Box>

      {/* Info Alert */}
      <Alert severity="info" sx={{ mb: 3 }}>
        Assign users to specific clients to control which checklists they can access. 
        Users will only see clients they are assigned to. Workspace Owners and Admins always have access to all clients.
      </Alert>

      {/* View by Client */}
      {viewMode === 'by-client' && (
        <TableContainer component={Paper} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Code</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Assigned Users</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Count</TableCell>
                <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {clients.map((client) => {
                const clientData = assignmentsByClient[client.id];
                const assignedUsers = clientData?.users || [];
                return (
                  <TableRow key={client.id} hover>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <BusinessIcon color="primary" fontSize="small" />
                        <Typography>{client.name || client.client_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{client.code || client.client_code || '-'}</TableCell>
                    <TableCell>
                      {assignedUsers.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No users assigned
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {assignedUsers.map((user) => (
                            <Chip
                              key={user.id}
                              size="small"
                              avatar={<Avatar sx={{ bgcolor: '#0f766e' }}>{user.name?.charAt(0) || 'U'}</Avatar>}
                              label={user.name}
                              onDelete={() => handleRemoveAssignment(client.id, user.id)}
                            />
                          ))}
                        </Box>
                      )}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={assignedUsers.length}
                        color={assignedUsers.length > 0 ? 'success' : 'default'}
                        variant={assignedUsers.length > 0 ? 'filled' : 'outlined'}
                      />
                    </TableCell>
                    <TableCell align="center">
                      <Button
                        variant="outlined"
                        startIcon={<AddIcon />}
                        onClick={() => handleOpenAssignDialog(client)}
                        size="small"
                      >
                        Manage Users
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* View by User */}
      {viewMode === 'by-user' && (
        <TableContainer component={Paper} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Email</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Role</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Assigned Clients</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {members.map(member => {
                const userId = member.id || member.user_id || member.userId; // Try different field names
                const userData = assignmentsByUser[userId];
                const assignedClients = userData?.clients || [];
                const isAdminUser = ['Owner', 'Admin'].includes(member.role);
                
                return (
                  <TableRow key={userId}>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 32, height: 32, bgcolor: '#0f766e' }}>
                          {member.name?.charAt(0) || member.username?.charAt(0) || 'U'}
                        </Avatar>
                        <Typography>{member.name || member.username}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>{member.email}</TableCell>
                    <TableCell>
                      <Chip 
                        label={member.role} 
                        size="small"
                        color={isAdminUser ? 'primary' : 'default'}
                      />
                    </TableCell>
                    <TableCell>
                      {isAdminUser ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          All clients (Admin)
                        </Typography>
                      ) : assignedClients.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                          No clients assigned
                        </Typography>
                      ) : (
                        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                          {assignedClients.map(client => {
                            const userId = member.id || member.user_id || member.userId;
                            return (
                            <Chip
                              key={client.id}
                              label={client.name}
                              size="small"
                              variant="outlined"
                              onDelete={() => handleRemoveAssignment(client.id, userId)}
                            />
                            );
                          })}
                        </Box>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Assign Users Dialog */}
      <Dialog 
        open={assignDialogOpen} 
        onClose={() => setAssignDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          Assign Users to {selectedClient?.name || selectedClient?.client_name}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select users who should have access to this client's checklist. 
            Admins automatically have access to all clients.
          </Typography>
          
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {regularMembers
              .map((member, index) => {
                const userId = member.id || member.user_id || member.userId; // Try different field names
                return (
                <ListItem 
                  key={userId || `member-${index}`} 
                  dense 
                  sx={{ cursor: 'pointer', '&:hover': { backgroundColor: 'rgba(0, 0, 0, 0.04)' } }}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32, bgcolor: '#0f766e' }}>
                      {member.name?.charAt(0) || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText 
                    primary={member.name || member.username}
                    secondary={<span>{member.email}</span>}
                    onClick={() => handleToggleUser(userId)}
                    sx={{ cursor: 'pointer' }}
                  />
                  <ListItemSecondaryAction>
                    <Checkbox
                      edge="end"
                      checked={selectedUsers.includes(userId)}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleToggleUser(userId);
                      }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                );
              })}
          </List>

          {regularMembers.length === 0 && (
            <Alert severity="info">
              No regular users in this workspace. All current members are Admins or Owners.
            </Alert>
          )}
        </DialogContent>
      <DialogActions>
          <Button onClick={() => setAssignDialogOpen(false)}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveAssignments} 
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Assignments'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Bulk Access Dialog */}
      <Dialog
        open={bulkDialogOpen}
        onClose={() => setBulkDialogOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Bulk Access</DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            Bulk access will replace current non-admin user assignments for selected clients.
          </Alert>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Clients</InputLabel>
            <Select
              multiple
              value={bulkSelectedClientIds}
              label="Clients"
              onChange={(e) => {
                const normalized = normalizeMultiSelectValue(e.target.value);
                setBulkSelectedClientIds(normalized.map((v) => Number(v)));
              }}
              renderValue={(selected) => {
                const selectedSet = new Set(selected.map((v) => Number(v)));
                return clients
                  .filter((client) => selectedSet.has(Number(client.id)))
                  .map((client) => client.name || client.client_name)
                  .join(', ');
              }}
            >
              {clients.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  <Checkbox checked={bulkSelectedClientIds.includes(Number(client.id))} />
                  <ListItemText primary={client.name || client.client_name} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <FormControl fullWidth>
            <InputLabel>Users</InputLabel>
            <Select
              multiple
              value={bulkSelectedUserIds}
              label="Users"
              onChange={(e) => {
                const normalized = normalizeMultiSelectValue(e.target.value);
                setBulkSelectedUserIds(normalized.map((v) => Number(v)));
              }}
              renderValue={(selected) => {
                const selectedSet = new Set(selected.map((v) => Number(v)));
                return regularMembers
                  .filter((member) => selectedSet.has(Number(member.id || member.user_id || member.userId)))
                  .map((member) => member.name || member.username)
                  .join(', ');
              }}
            >
              {regularMembers.map((member) => {
                const userId = Number(member.id || member.user_id || member.userId);
                return (
                  <MenuItem key={userId} value={userId}>
                    <Checkbox checked={bulkSelectedUserIds.includes(userId)} />
                    <ListItemText primary={member.name || member.username} secondary={member.email} />
                  </MenuItem>
                );
              })}
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setBulkDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleApplyBulkAccess}
            disabled={saving || bulkSelectedClientIds.length === 0 || bulkSelectedUserIds.length === 0}
          >
            {saving ? 'Applying...' : 'Apply Access'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ClientUserAssignments;
