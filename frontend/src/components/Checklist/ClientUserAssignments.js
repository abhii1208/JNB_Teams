/**
 * ClientUserAssignments - Admin UI for managing user-client assignments
 * Allows admins to assign users to specific clients
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
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

  // View mode: 'by-client' or 'by-user'
  const [viewMode, setViewMode] = useState('by-client');

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
      console.log('Processing member for assignmentsByUser:', member, 'resolved userId:', userId);
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

  // Open assign dialog for a client
  const handleOpenAssignDialog = (client) => {
    console.log('Opening dialog for client:', client);
    setSelectedClient(client);
    const currentAssignments = assignmentsByClient[client.id]?.users || [];
    console.log('Current assignments:', currentAssignments);
    console.log('assignmentsByClient:', assignmentsByClient);
    const initialSelectedUsers = currentAssignments.map(u => u.id);
    console.log('Initial selected users:', initialSelectedUsers);
    setSelectedUsers(initialSelectedUsers);
    setAssignDialogOpen(true);
  };

  // Save assignments
  const handleSaveAssignments = async () => {
    if (!selectedClient) return;

    try {
      setSaving(true);
      setError(null);

      console.log('Saving assignments:', {
        clientId: selectedClient.id,
        selectedUsers: selectedUsers
      });

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
    console.log('Toggling user:', userId, 'Type:', typeof userId);
    console.log('Current selectedUsers:', selectedUsers);
    console.log('selectedUsers types:', selectedUsers.map(id => ({ id, type: typeof id })));
    
    setSelectedUsers(prev => {
      const newSelection = prev.includes(userId) 
        ? prev.filter(id => id !== userId)
        : [...prev, userId];
      console.log('New selection:', newSelection);
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
          Client User Assignments
        </Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {clients.map(client => {
            const clientData = assignmentsByClient[client.id];
            const assignedUsers = clientData?.users || [];
            
            return (
              <Card key={client.id} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                <CardContent>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BusinessIcon color="primary" />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        {client.name || client.client_name}
                      </Typography>
                      {client.code && (
                        <Chip label={client.code || client.client_code} size="small" variant="outlined" />
                      )}
                    </Box>
                    <Button
                      variant="outlined"
                      startIcon={<AddIcon />}
                      onClick={() => handleOpenAssignDialog(client)}
                      size="small"
                    >
                      Manage Users
                    </Button>
                  </Box>

                  {assignedUsers.length === 0 ? (
                    <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
                      No users assigned. Only admins can view this client's checklist.
                    </Typography>
                  ) : (
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                      {assignedUsers.map(user => (
                        <Chip
                          key={user.id}
                          avatar={<Avatar sx={{ bgcolor: '#0f766e' }}>{user.name?.charAt(0) || 'U'}</Avatar>}
                          label={user.name}
                          onDelete={() => handleRemoveAssignment(client.id, user.id)}
                          sx={{ 
                            backgroundColor: '#f0fdfa',
                            '& .MuiChip-deleteIcon': { color: '#dc2626' }
                          }}
                        />
                      ))}
                    </Box>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </Box>
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
            {members
              .filter(m => !['Owner', 'Admin'].includes(m.role)) // Exclude admins from list
              .map((member, index) => {
                console.log(`Member ${index}:`, member); // Debug: check member structure
                const userId = member.id || member.user_id || member.userId; // Try different field names
                console.log(`Resolved userId for member:`, userId);
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
                      checked={(() => {
                        const isChecked = selectedUsers.includes(userId);
                        console.log(`Checkbox for user ${userId} (${typeof userId}): ${isChecked}`);
                        return isChecked;
                      })()}
                      onChange={(e) => {
                        e.stopPropagation();
                        console.log('Checkbox onChange for:', userId);
                        handleToggleUser(userId);
                      }}
                    />
                  </ListItemSecondaryAction>
                </ListItem>
                );
              })}
          </List>

          {members.filter(m => !['Owner', 'Admin'].includes(m.role)).length === 0 && (
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
    </Box>
  );
}

export default ClientUserAssignments;
