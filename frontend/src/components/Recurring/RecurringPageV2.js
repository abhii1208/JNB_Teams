/**
 * Recurring Tasks Module - V2
 * Simple, clean recurring task management
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
    Box, Paper, Typography, Button, IconButton,
    Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
    Chip, Dialog, DialogTitle, DialogContent, DialogActions,
    TextField, FormControl, InputLabel, Select, MenuItem,
    ToggleButtonGroup, ToggleButton, Alert, CircularProgress,
    Tooltip
} from '@mui/material';
import {
    Add as AddIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Pause as PauseIcon,
    PlayArrow as PlayIcon,
    Refresh as RefreshIcon,
    Event as EventIcon
} from '@mui/icons-material';
import api from '../../apiClient';

const FREQUENCIES = [
    { value: 'daily', label: 'Daily' },
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'yearly', label: 'Yearly' }
];

const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'];

const WEEK_DAYS = [
    { value: 0, label: 'Sun' },
    { value: 1, label: 'Mon' },
    { value: 2, label: 'Tue' },
    { value: 3, label: 'Wed' },
    { value: 4, label: 'Thu' },
    { value: 5, label: 'Fri' },
    { value: 6, label: 'Sat' }
];

function RecurringPage({ workspace, user }) {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [projects, setProjects] = useState([]);
    const [users, setUsers] = useState([]);
    
    // Dialog state
    const [dialogOpen, setDialogOpen] = useState(false);
    const [editingItem, setEditingItem] = useState(null);
    const [saving, setSaving] = useState(false);
    
    // Form state
    const [form, setForm] = useState({
        name: '',
        description: '',
        project_id: '',
        priority: 'Medium',
        assignee_id: '',
        frequency: 'daily',
        interval_value: 1,
        week_days: [],
        month_day: 1,
        start_date: new Date().toISOString().split('T')[0],
        end_date: '',
        reminder_days: 1
    });

    // Fetch data
    const fetchData = useCallback(async () => {
        if (!workspace?.id) return;
        try {
            setLoading(true);
            const [recurringRes, projectsRes, usersRes] = await Promise.all([
                api.get(`/api/recurring?workspace_id=${workspace.id}`),
                api.get(`/api/projects/workspace/${workspace.id}`),
                api.get(`/api/workspaces/${workspace.id}/members`)
            ]);
            setItems(recurringRes.data);
            setProjects(projectsRes.data);
            setUsers(usersRes.data);
            setError(null);
        } catch (err) {
            setError('Failed to load recurring tasks');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [workspace?.id]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Open dialog for new/edit
    const openDialog = (item = null) => {
        if (item) {
            setEditingItem(item);
            setForm({
                name: item.name,
                description: item.description || '',
                project_id: item.project_id,
                priority: item.priority || 'Medium',
                assignee_id: item.assignee_id || '',
                frequency: item.frequency,
                interval_value: item.interval_value || 1,
                week_days: item.week_days || [],
                month_day: item.month_day || 1,
                start_date: item.start_date?.split('T')[0] || new Date().toISOString().split('T')[0],
                end_date: item.end_date?.split('T')[0] || '',
                reminder_days: item.reminder_days || 1
            });
        } else {
            setEditingItem(null);
            setForm({
                name: '',
                description: '',
                project_id: projects[0]?.id || '',
                priority: 'Medium',
                assignee_id: '',
                frequency: 'daily',
                interval_value: 1,
                week_days: [],
                month_day: 1,
                start_date: new Date().toISOString().split('T')[0],
                end_date: '',
                reminder_days: 1
            });
        }
        setDialogOpen(true);
    };

    // Save (create/update)
    const handleSave = async () => {
        if (!form.name.trim()) {
            setError('Name is required');
            return;
        }
        if (!form.project_id) {
            setError('Project is required');
            return;
        }

        try {
            setSaving(true);
            const payload = {
                ...form,
                workspace_id: workspace.id,
                week_days: form.frequency === 'weekly' ? form.week_days : null,
                month_day: form.frequency === 'monthly' ? form.month_day : null,
                end_date: form.end_date || null,
                assignee_id: form.assignee_id || null
            };

            if (editingItem) {
                await api.put(`/api/recurring/${editingItem.id}`, payload);
            } else {
                await api.post('/api/recurring', payload);
            }

            setDialogOpen(false);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save');
        } finally {
            setSaving(false);
        }
    };

    // Delete
    const handleDelete = async (id) => {
        if (!window.confirm('Delete this recurring task? Generated tasks will remain.')) return;
        
        try {
            await api.delete(`/api/recurring/${id}`);
            fetchData();
        } catch (err) {
            setError('Failed to delete');
        }
    };

    // Pause/Resume
    const toggleActive = async (item) => {
        try {
            if (item.is_active) {
                await api.post(`/api/recurring/${item.id}/pause`);
            } else {
                await api.post(`/api/recurring/${item.id}/resume`);
            }
            fetchData();
        } catch (err) {
            setError('Failed to update status');
        }
    };

    // Generate task now
    const generateNow = async (id) => {
        try {
            await api.post(`/api/recurring/${id}/generate`);
            fetchData();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to generate task');
        }
    };

    // Render frequency label
    const getFrequencyLabel = (item) => {
        switch (item.frequency) {
            case 'daily':
                return item.interval_value > 1 ? `Every ${item.interval_value} days` : 'Daily';
            case 'weekly':
                if (item.week_days?.length > 0) {
                    const days = item.week_days.map(d => WEEK_DAYS.find(w => w.value === d)?.label).join(', ');
                    return `Weekly: ${days}`;
                }
                return 'Weekly';
            case 'monthly':
                if (item.month_day === -1) return 'Monthly (last day)';
                return `Monthly (day ${item.month_day})`;
            case 'yearly':
                return 'Yearly';
            default:
                return item.frequency;
        }
    };

    if (loading) {
        return (
            <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                <CircularProgress />
            </Box>
        );
    }

    return (
        <Box p={3}>
            {/* Header */}
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
                <Typography variant="h5" fontWeight="bold">
                    <EventIcon sx={{ mr: 1, verticalAlign: 'middle' }} />
                    Recurring Tasks
                </Typography>
                <Box>
                    <IconButton onClick={fetchData} sx={{ mr: 1 }}>
                        <RefreshIcon />
                    </IconButton>
                    <Button
                        variant="contained"
                        startIcon={<AddIcon />}
                        onClick={() => openDialog()}
                    >
                        New Recurring Task
                    </Button>
                </Box>
            </Box>

            {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
                    {error}
                </Alert>
            )}

            {/* Table */}
            <TableContainer component={Paper}>
                <Table>
                    <TableHead>
                        <TableRow>
                            <TableCell>Name</TableCell>
                            <TableCell>Project</TableCell>
                            <TableCell>Frequency</TableCell>
                            <TableCell>Assignee</TableCell>
                            <TableCell>Tasks</TableCell>
                            <TableCell>Status</TableCell>
                            <TableCell align="right">Actions</TableCell>
                        </TableRow>
                    </TableHead>
                    <TableBody>
                        {items.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} align="center">
                                    <Typography color="text.secondary" py={4}>
                                        No recurring tasks yet. Create one to get started!
                                    </Typography>
                                </TableCell>
                            </TableRow>
                        ) : (
                            items.map(item => (
                                <TableRow key={item.id} hover>
                                    <TableCell>
                                        <Typography fontWeight="medium">{item.name}</Typography>
                                        {item.description && (
                                            <Typography variant="body2" color="text.secondary" noWrap sx={{ maxWidth: 300 }}>
                                                {item.description}
                                            </Typography>
                                        )}
                                    </TableCell>
                                    <TableCell>{item.project_name}</TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={getFrequencyLabel(item)} 
                                            size="small" 
                                            color="primary" 
                                            variant="outlined"
                                        />
                                    </TableCell>
                                    <TableCell>{item.assignee_name || '-'}</TableCell>
                                    <TableCell>
                                        <Chip label={item.task_count || 0} size="small" />
                                    </TableCell>
                                    <TableCell>
                                        <Chip 
                                            label={item.is_active ? 'Active' : 'Paused'} 
                                            size="small"
                                            color={item.is_active ? 'success' : 'default'}
                                        />
                                    </TableCell>
                                    <TableCell align="right">
                                        <Tooltip title="Generate task now">
                                            <IconButton size="small" onClick={() => generateNow(item.id)}>
                                                <RefreshIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title={item.is_active ? 'Pause' : 'Resume'}>
                                            <IconButton size="small" onClick={() => toggleActive(item)}>
                                                {item.is_active ? <PauseIcon fontSize="small" /> : <PlayIcon fontSize="small" />}
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Edit">
                                            <IconButton size="small" onClick={() => openDialog(item)}>
                                                <EditIcon fontSize="small" />
                                            </IconButton>
                                        </Tooltip>
                                        <Tooltip title="Delete">
                                            <IconButton size="small" color="error" onClick={() => handleDelete(item.id)}>
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

            {/* Create/Edit Dialog */}
            <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
                <DialogTitle>
                    {editingItem ? 'Edit Recurring Task' : 'New Recurring Task'}
                </DialogTitle>
                <DialogContent>
                    <Box display="flex" flexDirection="column" gap={2} pt={1}>
                        {/* Name */}
                        <TextField
                            label="Task Name"
                            value={form.name}
                            onChange={e => setForm({ ...form, name: e.target.value })}
                            fullWidth
                            required
                        />

                        {/* Description */}
                        <TextField
                            label="Description"
                            value={form.description}
                            onChange={e => setForm({ ...form, description: e.target.value })}
                            fullWidth
                            multiline
                            rows={2}
                        />

                        {/* Project */}
                        <FormControl fullWidth required>
                            <InputLabel>Project</InputLabel>
                            <Select
                                value={form.project_id}
                                label="Project"
                                onChange={e => setForm({ ...form, project_id: e.target.value })}
                            >
                                {projects.map(p => (
                                    <MenuItem key={p.id} value={p.id}>{p.name}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Priority & Assignee */}
                        <Box display="flex" gap={2}>
                            <FormControl fullWidth>
                                <InputLabel>Priority</InputLabel>
                                <Select
                                    value={form.priority}
                                    label="Priority"
                                    onChange={e => setForm({ ...form, priority: e.target.value })}
                                >
                                    {PRIORITIES.map(p => (
                                        <MenuItem key={p} value={p}>{p}</MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                            <FormControl fullWidth>
                                <InputLabel>Assignee</InputLabel>
                                <Select
                                    value={form.assignee_id}
                                    label="Assignee"
                                    onChange={e => setForm({ ...form, assignee_id: e.target.value })}
                                >
                                    <MenuItem value="">Unassigned</MenuItem>
                                    {users.map(u => (
                                        <MenuItem key={u.id} value={u.id}>
                                            {u.first_name} {u.last_name}
                                        </MenuItem>
                                    ))}
                                </Select>
                            </FormControl>
                        </Box>

                        {/* Frequency */}
                        <FormControl fullWidth>
                            <InputLabel>Frequency</InputLabel>
                            <Select
                                value={form.frequency}
                                label="Frequency"
                                onChange={e => setForm({ ...form, frequency: e.target.value })}
                            >
                                {FREQUENCIES.map(f => (
                                    <MenuItem key={f.value} value={f.value}>{f.label}</MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        {/* Weekly: Day selection */}
                        {form.frequency === 'weekly' && (
                            <Box>
                                <Typography variant="body2" color="text.secondary" mb={1}>
                                    Select days of the week:
                                </Typography>
                                <ToggleButtonGroup
                                    value={form.week_days}
                                    onChange={(e, newDays) => setForm({ ...form, week_days: newDays })}
                                    size="small"
                                >
                                    {WEEK_DAYS.map(d => (
                                        <ToggleButton key={d.value} value={d.value}>
                                            {d.label}
                                        </ToggleButton>
                                    ))}
                                </ToggleButtonGroup>
                            </Box>
                        )}

                        {/* Monthly: Day of month */}
                        {form.frequency === 'monthly' && (
                            <FormControl fullWidth>
                                <InputLabel>Day of Month</InputLabel>
                                <Select
                                    value={form.month_day}
                                    label="Day of Month"
                                    onChange={e => setForm({ ...form, month_day: e.target.value })}
                                >
                                    {[...Array(31)].map((_, i) => (
                                        <MenuItem key={i + 1} value={i + 1}>{i + 1}</MenuItem>
                                    ))}
                                    <MenuItem value={-1}>Last day of month</MenuItem>
                                </Select>
                            </FormControl>
                        )}

                        {/* Start/End Date */}
                        <Box display="flex" gap={2}>
                            <TextField
                                label="Start Date"
                                type="date"
                                value={form.start_date}
                                onChange={e => setForm({ ...form, start_date: e.target.value })}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                            <TextField
                                label="End Date (optional)"
                                type="date"
                                value={form.end_date}
                                onChange={e => setForm({ ...form, end_date: e.target.value })}
                                fullWidth
                                InputLabelProps={{ shrink: true }}
                            />
                        </Box>
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
                    <Button onClick={handleSave} variant="contained" disabled={saving}>
                        {saving ? 'Saving...' : (editingItem ? 'Update' : 'Create')}
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default RecurringPage;
