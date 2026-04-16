/**
 * Create Chat Dialog Components
 * Dialogs for creating DMs and Group chats with member selection
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemAvatar,
  ListItemText,
  Avatar,
  Checkbox,
  Typography,
  Box,
  InputAdornment,
  Chip,
  MenuItem,
  CircularProgress,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getWorkspaceMembers } from '../../apiClient';

function getInitials(firstName, lastName, username) {
  if (firstName && lastName) {
    return `${firstName[0]}${lastName[0]}`.toUpperCase();
  }
  if (firstName) return firstName[0].toUpperCase();
  if (username) return username[0].toUpperCase();
  return '?';
}

function getDisplayName(member) {
  if (member.first_name && member.last_name) {
    return `${member.first_name} ${member.last_name}`;
  }
  return member.username || 'Unknown';
}

/**
 * Create DM Dialog - Select one user to start a direct message
 */
export function CreateDmDialog({ open, onClose, onCreateDm, workspaceId, currentUserId }) {
  const [members, setMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Fetch workspace members
  useEffect(() => {
    if (!open || !workspaceId) return;

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getWorkspaceMembers(workspaceId);
        // Filter out current user
        setMembers(response.data.filter(m => m.id !== currentUserId));
      } catch (err) {
        console.error('Failed to fetch members:', err);
        setError('Failed to load workspace members');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [open, workspaceId, currentUserId]);

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(m =>
      m.username?.toLowerCase().includes(query) ||
      m.first_name?.toLowerCase().includes(query) ||
      m.last_name?.toLowerCase().includes(query) ||
      m.email?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  const handleSelect = async (member) => {
    setCreating(true);
    setError(null);
    try {
      await onCreateDm(member.id);
      onClose();
    } catch (err) {
      console.error('Failed to create DM:', err);
      const errorMessage = err.response?.data?.error || 'Failed to create conversation';
      if (errorMessage.includes('not a workspace member')) {
        setError('Selected user is not a member of this workspace');
      } else {
        setError(errorMessage);
      }
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Direct Message</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredMembers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {searchQuery ? 'No members found' : 'No workspace members available'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 400, overflow: 'auto' }}>
            {filteredMembers.map((member) => (
              <ListItem key={member.id} disablePadding>
                <ListItemButton
                  onClick={() => handleSelect(member)}
                  disabled={creating}
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: `hsl(${member.id * 40}, 60%, 50%)` }}>
                      {getInitials(member.first_name, member.last_name, member.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={getDisplayName(member)}
                    secondary={member.email}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Create Group Dialog - Select multiple users and set group name
 */
export function CreateGroupDialog({ open, onClose, onCreateGroup, workspaceId, currentUserId }) {
  const [members, setMembers] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  // Fetch workspace members
  useEffect(() => {
    if (!open || !workspaceId) return;

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getWorkspaceMembers(workspaceId);
        // Filter out current user
        setMembers(response.data.filter(m => m.id !== currentUserId));
      } catch (err) {
        console.error('Failed to fetch members:', err);
        setError('Failed to load workspace members');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [open, workspaceId, currentUserId]);

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return members;
    const query = searchQuery.toLowerCase();
    return members.filter(m =>
      m.username?.toLowerCase().includes(query) ||
      m.first_name?.toLowerCase().includes(query) ||
      m.last_name?.toLowerCase().includes(query) ||
      m.email?.toLowerCase().includes(query)
    );
  }, [members, searchQuery]);

  // Selected members
  const selectedMembers = useMemo(() => {
    return members.filter(m => selectedIds.includes(m.id));
  }, [members, selectedIds]);

  const toggleMember = (memberId) => {
    setSelectedIds(prev =>
      prev.includes(memberId)
        ? prev.filter(id => id !== memberId)
        : [...prev, memberId]
    );
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      setError('Group name is required');
      return;
    }
    if (selectedIds.length < 2) {
      setError('Select at least 2 members');
      return;
    }

    setCreating(true);
    setError(null);
    try {
      await onCreateGroup(groupName.trim(), selectedIds);
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create group');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setSearchQuery('');
    setGroupName('');
    setSelectedIds([]);
    setError(null);
    onClose();
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Group Chat</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          label="Group Name"
          placeholder="Enter group name..."
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          sx={{ mb: 2 }}
        />

        {/* Selected members chips */}
        {selectedMembers.length > 0 && (
          <Box sx={{ mb: 2, display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {selectedMembers.map((member) => (
              <Chip
                key={member.id}
                label={getDisplayName(member)}
                onDelete={() => toggleMember(member.id)}
                size="small"
                avatar={
                  <Avatar sx={{ bgcolor: `hsl(${member.id * 40}, 60%, 50%)` }}>
                    {getInitials(member.first_name, member.last_name, member.username)}
                  </Avatar>
                }
              />
            ))}
          </Box>
        )}

        <TextField
          fullWidth
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredMembers.length === 0 ? (
          <Box sx={{ textAlign: 'center', py: 4 }}>
            <Typography color="text.secondary">
              {searchQuery ? 'No members found' : 'No workspace members available'}
            </Typography>
          </Box>
        ) : (
          <List sx={{ maxHeight: 300, overflow: 'auto' }}>
            {filteredMembers.map((member) => (
              <ListItem key={member.id} disablePadding>
                <ListItemButton onClick={() => toggleMember(member.id)}>
                  <Checkbox
                    edge="start"
                    checked={selectedIds.includes(member.id)}
                    tabIndex={-1}
                    disableRipple
                  />
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: `hsl(${member.id * 40}, 60%, 50%)` }}>
                      {getInitials(member.first_name, member.last_name, member.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={getDisplayName(member)}
                    secondary={member.email}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        )}

        <Typography variant="caption" color="text.secondary">
          {selectedIds.length} of {members.length} members selected (minimum 2 required)
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={creating}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleCreate}
          disabled={creating || !groupName.trim() || selectedIds.length < 2}
        >
          {creating ? <CircularProgress size={20} /> : 'Create Group'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export function CreateChannelDialog({ open, onClose, onCreateChannel }) {
  const [form, setForm] = useState({ name: '', description: '', intro_text: '', visibility: 'workspace' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleClose = () => {
    setForm({ name: '', description: '', intro_text: '', visibility: 'workspace' });
    setError(null);
    onClose();
  };

  const handleCreate = async () => {
    if (!form.name.trim()) {
      setError('Channel name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onCreateChannel({
        name: form.name.trim(),
        description: form.description.trim(),
        intro_text: form.intro_text.trim(),
        visibility: form.visibility,
      });
      handleClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to create channel');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>New Channel</DialogTitle>
      <DialogContent dividers>
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <TextField fullWidth label="Channel Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} sx={{ mb: 2 }} />
        <TextField fullWidth label="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} multiline minRows={2} sx={{ mb: 2 }} />
        <TextField fullWidth label="Channel Intro" value={form.intro_text} onChange={(e) => setForm((prev) => ({ ...prev, intro_text: e.target.value }))} multiline minRows={3} sx={{ mb: 2 }} />
        <TextField select fullWidth label="Visibility" value={form.visibility} onChange={(e) => setForm((prev) => ({ ...prev, visibility: e.target.value }))}>
          <MenuItem value="workspace">Workspace Members</MenuItem>
          <MenuItem value="management">Management Only</MenuItem>
        </TextField>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={loading}>Cancel</Button>
        <Button variant="contained" onClick={handleCreate} disabled={loading || !form.name.trim()}>
          {loading ? <CircularProgress size={20} /> : 'Create Channel'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Manage Members Dialog - Add/remove members from a group
 */
export function ManageMembersDialog({
  open,
  onClose,
  thread,
  workspaceId,
  currentUserId,
  onAddMembers,
  onRemoveMember,
}) {
  const [allMembers, setAllMembers] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);

  // Current thread member IDs
  const threadMemberIds = useMemo(() => {
    return new Set((thread?.members || []).map(m => m.user_id));
  }, [thread]);

  // Fetch all workspace members
  useEffect(() => {
    if (!open || !workspaceId) return;

    const fetchMembers = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await getWorkspaceMembers(workspaceId);
        setAllMembers(response.data);
      } catch (err) {
        console.error('Failed to fetch members:', err);
        setError('Failed to load workspace members');
      } finally {
        setLoading(false);
      }
    };

    fetchMembers();
  }, [open, workspaceId]);

  // Filter members by search
  const filteredMembers = useMemo(() => {
    if (!searchQuery.trim()) return allMembers;
    const query = searchQuery.toLowerCase();
    return allMembers.filter(m =>
      m.username?.toLowerCase().includes(query) ||
      m.first_name?.toLowerCase().includes(query) ||
      m.last_name?.toLowerCase().includes(query)
    );
  }, [allMembers, searchQuery]);

  // Split into current and available members
  const { currentMembers, availableMembers } = useMemo(() => {
    const current = [];
    const available = [];
    filteredMembers.forEach(m => {
      if (threadMemberIds.has(m.id)) {
        current.push(m);
      } else {
        available.push(m);
      }
    });
    return { currentMembers: current, availableMembers: available };
  }, [filteredMembers, threadMemberIds]);

  const handleAddMember = async (memberId) => {
    setActionLoading(memberId);
    setError(null);
    try {
      await onAddMembers([memberId]);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to add member');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveMember = async (memberId) => {
    setActionLoading(memberId);
    setError(null);
    try {
      await onRemoveMember(memberId);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to remove member');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Manage Group Members</DialogTitle>
      <DialogContent dividers>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        <TextField
          fullWidth
          placeholder="Search members..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon color="action" />
              </InputAdornment>
            ),
          }}
          sx={{ mb: 2 }}
        />

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <>
            {/* Current Members */}
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
              Current Members ({currentMembers.length})
            </Typography>
            <List dense sx={{ mb: 2, maxHeight: 200, overflow: 'auto', bgcolor: 'grey.50', borderRadius: 1 }}>
              {currentMembers.map((member) => (
                <ListItem
                  key={member.id}
                  secondaryAction={
                    member.id !== thread?.created_by && member.id !== currentUserId && (
                      <Button
                        size="small"
                        color="error"
                        onClick={() => handleRemoveMember(member.id)}
                        disabled={actionLoading === member.id}
                      >
                        {actionLoading === member.id ? <CircularProgress size={16} /> : 'Remove'}
                      </Button>
                    )
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: `hsl(${member.id * 40}, 60%, 50%)`, width: 32, height: 32 }}>
                      {getInitials(member.first_name, member.last_name, member.username)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        {getDisplayName(member)}
                        {member.id === thread?.created_by && (
                          <Chip label="Creator" size="small" color="primary" sx={{ height: 18, fontSize: '0.7rem' }} />
                        )}
                        {member.id === currentUserId && (
                          <Chip label="You" size="small" sx={{ height: 18, fontSize: '0.7rem' }} />
                        )}
                      </Box>
                    }
                  />
                </ListItem>
              ))}
            </List>

            {/* Available Members */}
            {availableMembers.length > 0 && (
              <>
                <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                  Add Members ({availableMembers.length})
                </Typography>
                <List dense sx={{ maxHeight: 200, overflow: 'auto' }}>
                  {availableMembers.map((member) => (
                    <ListItem
                      key={member.id}
                      secondaryAction={
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleAddMember(member.id)}
                          disabled={actionLoading === member.id}
                        >
                          {actionLoading === member.id ? <CircularProgress size={16} /> : 'Add'}
                        </Button>
                      }
                    >
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: `hsl(${member.id * 40}, 60%, 50%)`, width: 32, height: 32 }}>
                          {getInitials(member.first_name, member.last_name, member.username)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText primary={getDisplayName(member)} />
                    </ListItem>
                  ))}
                </List>
              </>
            )}
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Done</Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Rename Group Dialog
 */
export function RenameGroupDialog({ open, onClose, thread, onRename }) {
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (open && thread) {
      setName(thread.name || '');
    }
  }, [open, thread]);

  const handleRename = async () => {
    if (!name.trim()) {
      setError('Group name is required');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      await onRename(name.trim());
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to rename group');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Rename Group</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <TextField
          fullWidth
          label="Group Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          autoFocus
          sx={{ mt: 1 }}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          onClick={handleRename}
          disabled={loading || !name.trim()}
        >
          {loading ? <CircularProgress size={20} /> : 'Rename'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

const ChatDialogs = {
  CreateDmDialog,
  CreateGroupDialog,
  CreateChannelDialog,
  ManageMembersDialog,
  RenameGroupDialog,
};

export default ChatDialogs;
