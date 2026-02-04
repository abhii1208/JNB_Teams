/**
 * ChecklistItemManager - Admin UI for creating and managing checklist items
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Autocomplete,
  Alert,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  getChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getChecklistCategories,
  createChecklistCategory,
  getWorkspaceMembers,
  getWorkspaceChecklistSettings,
  updateWorkspaceChecklistSettings,
} from '../../apiClient';

const INITIAL_ITEM = {
  title: '',
  description: '',
  frequency: 'daily',
  category_id: '',
  completion_rule: 'any',
  remarks_required: false,
  assignee_ids: [],
  is_active: true,
};

function ChecklistItemManager({ workspaceId, clientId, isAdmin }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(INITIAL_ITEM);
  const [saving, setSaving] = useState(false);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});

  // Active tab
  const [activeTab, setActiveTab] = useState(0);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = clientId ? { clientId } : {};
      
      const [itemsRes, categoriesRes, membersRes, settingsRes] = await Promise.all([
        getChecklistItems(workspaceId, filters),
        getChecklistCategories(workspaceId),
        getWorkspaceMembers(workspaceId),
        getWorkspaceChecklistSettings(workspaceId),
      ]);
      
      setItems(itemsRes.data || []);
      setCategories(categoriesRes.data || []);
      setMembers(membersRes.data || []);
      setSettingsForm(settingsRes.data || {});
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load checklist data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle item dialog open
  const handleOpenItemDialog = (item = null) => {
    if (item) {
      setEditingItem(item);
      setItemForm({
        title: item.title,
        description: item.description || '',
        frequency: item.frequency,
        category_id: item.category_id || '',
        completion_rule: item.completion_rule,
        remarks_required: item.remarks_required,
        assignee_ids: item.assignees?.map(a => a.id) || [],
        is_active: item.is_active,
      });
    } else {
      setEditingItem(null);
      setItemForm(INITIAL_ITEM);
    }
    setItemDialogOpen(true);
  };

  // Handle dialog close
  const handleCloseDialog = () => {
    setItemForm(INITIAL_ITEM);
    setEditingItem(null);
    setError(null);
    setItemDialogOpen(false);
  };

  // Handle item save
  const handleSaveItem = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!itemForm.title.trim()) {
        setError('Title is required');
        return;
      }

      if (itemForm.assignee_ids.length === 0) {
        setError('At least one assignee is required');
        return;
      }

      // Prepare data for API - map frontend form fields to backend expected fields
      const apiData = {
        clientId: clientId,
        title: itemForm.title,
        description: itemForm.description,
        category: itemForm.category_id || null,
        frequency: itemForm.frequency,
        effectiveFrom: new Date().toISOString().split('T')[0], // Today's date
        completionRule: itemForm.completion_rule,
        remarksRequired: itemForm.remarks_required,
        assigneeIds: itemForm.assignee_ids,
        isActive: itemForm.is_active,
      };

      console.log('Sending checklist item data:', apiData);
      console.log('Form data:', JSON.stringify(itemForm, null, 2));
      console.log('Category from form:', itemForm.category_id);
      console.log('Assignees from form:', itemForm.assignee_ids);

      if (editingItem) {
        await updateChecklistItem(editingItem.id, apiData);
      } else {
        await createChecklistItem(workspaceId, apiData);
      }

      // Reset form and close dialog
      handleCloseDialog();
      fetchData();
    } catch (err) {
      console.error('Error saving item:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  // Handle item delete
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
      return;
    }

    try {
      await deleteChecklistItem(item.id);
      fetchData();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err.response?.data?.error || 'Failed to delete item');
    }
  };

  // Handle item duplicate
  const handleDuplicateItem = (item) => {
    setEditingItem(null);
    setItemForm({
      title: `${item.title} (Copy)`,
      description: item.description || '',
      frequency: item.frequency,
      category_id: item.category_id || '',
      completion_rule: item.completion_rule,
      remarks_required: item.remarks_required,
      assignee_ids: item.assignees?.map(a => a.id) || [],
      is_active: true,
    });
    setItemDialogOpen(true);
  };

  // Handle category save
  const handleSaveCategory = async () => {
    try {
      setSaving(true);
      if (!newCategory.trim()) {
        setError('Category name is required');
        return;
      }
      await createChecklistCategory(workspaceId, { name: newCategory.trim() });
      setCategoryDialogOpen(false);
      setNewCategory('');
      fetchData();
    } catch (err) {
      console.error('Error saving category:', err);
      setError(err.response?.data?.error || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  // Handle settings save
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await updateWorkspaceChecklistSettings(workspaceId, settingsForm);
      setSettingsDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Filter items by frequency
  const filteredItems = activeTab === 0 
    ? items 
    : items.filter(item => item.frequency === ['daily', 'weekly', 'monthly'][activeTab - 1]);

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

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenItemDialog()}
          disabled={!isAdmin}
        >
          Add Checklist Item
        </Button>
        <Button
          variant="outlined"
          onClick={() => setCategoryDialogOpen(true)}
          disabled={!isAdmin}
        >
          Manage Categories
        </Button>
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          onClick={() => setSettingsDialogOpen(true)}
          disabled={!isAdmin}
        >
          Workspace Settings
        </Button>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1, backgroundColor: '#dbeafe' }}>
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
              {items.filter(i => i.frequency === 'daily').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Daily Items</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, backgroundColor: '#fef3c7' }}>
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#b45309' }}>
              {items.filter(i => i.frequency === 'weekly').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Weekly Items</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, backgroundColor: '#f3e8ff' }}>
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#7c3aed' }}>
              {items.filter(i => i.frequency === 'monthly').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Monthly Items</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${items.length})`} />
        <Tab label={`Daily (${items.filter(i => i.frequency === 'daily').length})`} />
        <Tab label={`Weekly (${items.filter(i => i.frequency === 'weekly').length})`} />
        <Tab label={`Monthly (${items.filter(i => i.frequency === 'monthly').length})`} />
      </Tabs>

      {/* Items Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Completion Rule</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Assignees</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No checklist items found. Click "Add Checklist Item" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.title}
                    </Typography>
                    {item.description && (
                      <Typography variant="caption" color="text.secondary">
                        {item.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.frequency} 
                      size="small"
                      sx={{
                        backgroundColor: {
                          daily: '#dbeafe',
                          weekly: '#fef3c7',
                          monthly: '#f3e8ff',
                        }[item.frequency],
                        color: {
                          daily: '#1d4ed8',
                          weekly: '#b45309',
                          monthly: '#7c3aed',
                        }[item.frequency],
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {item.category_name || <Typography color="text.secondary">—</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.completion_rule === 'all' ? 'All must confirm' : 'Any can confirm'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                      {item.assignees?.slice(0, 3).map((a) => (
                        <Chip key={a.id} label={a.name} size="small" />
                      ))}
                      {item.assignees?.length > 3 && (
                        <Chip label={`+${item.assignees.length - 3}`} size="small" variant="outlined" />
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={item.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenItemDialog(item)} disabled={!isAdmin}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <IconButton size="small" onClick={() => handleDuplicateItem(item)} disabled={!isAdmin}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteItem(item)} disabled={!isAdmin} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit Checklist Item' : 'New Checklist Item'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              required
              value={itemForm.title}
              onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={itemForm.description}
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={itemForm.frequency}
                  label="Frequency"
                  onChange={(e) => setItemForm({ ...itemForm, frequency: e.target.value })}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={itemForm.category_id}
                  label="Category"
                  onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>
            <FormControl fullWidth>
              <InputLabel>Completion Rule</InputLabel>
              <Select
                value={itemForm.completion_rule}
                label="Completion Rule"
                onChange={(e) => setItemForm({ ...itemForm, completion_rule: e.target.value })}
              >
                <MenuItem value="any">Any assignee can confirm</MenuItem>
                <MenuItem value="all">All assignees must confirm</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={members}
              getOptionLabel={(option) => option.name || option.email}
              value={members.filter(m => itemForm.assignee_ids.includes(m.id))}
              onChange={(e, newValue) => setItemForm({ ...itemForm, assignee_ids: newValue.map(v => v.id) })}
              renderInput={(params) => <TextField {...params} label="Assignees" required />}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => (
                  <Chip key={option.id} label={option.name || option.email} {...getTagProps({ index })} />
                ))
              }
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={itemForm.remarks_required}
                    onChange={(e) => setItemForm({ ...itemForm, remarks_required: e.target.checked })}
                  />
                }
                label="Remarks Required"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={itemForm.is_active}
                    onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveItem}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Categories</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <TextField
              label="New Category Name"
              fullWidth
              size="small"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button variant="contained" onClick={handleSaveCategory} disabled={saving}>
              Add
            </Button>
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Existing Categories:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {categories.map((cat) => (
              <Chip key={cat.id} label={cat.name} />
            ))}
            {categories.length === 0 && (
              <Typography color="text.secondary">No categories yet</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Workspace Checklist Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Daily Reminder Time"
              type="time"
              fullWidth
              value={settingsForm.daily_reminder_time || '09:00'}
              onChange={(e) => setSettingsForm({ ...settingsForm, daily_reminder_time: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Weekly Reminder Day"
              select
              fullWidth
              value={settingsForm.weekly_reminder_day || 3}
              onChange={(e) => setSettingsForm({ ...settingsForm, weekly_reminder_day: e.target.value })}
            >
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((day, index) => (
                <MenuItem key={index} value={index}>{day}</MenuItem>
              ))}
            </TextField>
            <TextField
              label="Monthly Reminder Day"
              type="number"
              fullWidth
              value={settingsForm.monthly_reminder_day || 25}
              onChange={(e) => setSettingsForm({ ...settingsForm, monthly_reminder_day: parseInt(e.target.value) })}
              InputProps={{ inputProps: { min: 1, max: 28 } }}
              helperText="Day of month to send monthly reminders (1-28)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settingsForm.auto_mark_missed ?? true}
                  onChange={(e) => setSettingsForm({ ...settingsForm, auto_mark_missed: e.target.checked })}
                />
              }
              label="Auto-mark as missed when deadline passes"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settingsForm.allow_late_confirmation ?? true}
                  onChange={(e) => setSettingsForm({ ...settingsForm, allow_late_confirmation: e.target.checked })}
                />
              }
              label="Allow late confirmation (admin only)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSettings} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save Settings'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChecklistItemManager;
