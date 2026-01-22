import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Paper,
    Chip,
    Stack,
    IconButton,
    Divider,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Alert,
    CircularProgress,
    Tabs,
    Tab,
    Dialog,
    DialogTitle,
    DialogContent,
    DialogActions,
    TextField,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    LinearProgress
} from '@mui/material';
import {
    ArrowBack as BackIcon,
    Edit as EditIcon,
    Delete as DeleteIcon,
    Pause as PauseIcon,
    PlayArrow as PlayIcon,
    Refresh as RefreshIcon,
    Add as AddIcon,
    Person as PersonIcon,
    CalendarToday as CalendarIcon,
    SkipNext as SkipIcon
} from '@mui/icons-material';
import apiClient from '../../apiClient';
import { getRuleSummary } from '../../utils/recurrenceHelpers';
import { formatLongDate } from '../../utils/date';

/**
 * SeriesDetail Component
 * Shows detailed view of a recurring series with instances, exceptions, and audit log
 */
function SeriesDetail({ seriesId, workspace, onBack, onEdit }) {
    const [series, setSeries] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [tabValue, setTabValue] = useState(0);
    const [generating, setGenerating] = useState(false);
    const [exceptionDialog, setExceptionDialog] = useState({ open: false, type: 'skip', date: '' });
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    // Fetch series details
    const fetchSeries = useCallback(async () => {
        if (!seriesId) return;
        setLoading(true);
        setError(null);
        try {
            const response = await apiClient.get(`/api/recurring/${seriesId}`);
            setSeries(response.data);
        } catch (err) {
            console.error('Error fetching series:', err);
            setError('Failed to load series details');
        } finally {
            setLoading(false);
        }
    }, [seriesId]);

    useEffect(() => {
        fetchSeries();
    }, [fetchSeries]);

    // Actions
    const handlePause = async () => {
        try {
            await apiClient.post(`/api/recurring/${seriesId}/pause`);
            fetchSeries();
        } catch (err) {
            console.error('Error pausing series:', err);
        }
    };

    const handleResume = async () => {
        try {
            await apiClient.post(`/api/recurring/${seriesId}/resume`, {});
            fetchSeries();
        } catch (err) {
            console.error('Error resuming series:', err);
        }
    };

    const handleGenerateNow = async () => {
        setGenerating(true);
        try {
            const response = await apiClient.post(`/api/recurring/${seriesId}/generate`);
            alert(`Generated ${response.data.generated} instances`);
            fetchSeries();
        } catch (err) {
            console.error('Error generating instances:', err);
        } finally {
            setGenerating(false);
        }
    };

    const handleDelete = async () => {
        try {
            await apiClient.delete(`/api/recurring/${seriesId}`);
            onBack();
        } catch (err) {
            console.error('Error deleting series:', err);
        } finally {
            setDeleteDialogOpen(false);
        }
    };

    const handleAddException = async () => {
        const { type, date, newDate, reason } = exceptionDialog;
        if (!date) {
            alert('Please select a date');
            return;
        }
        if (type === 'move' && !newDate) {
            alert('Please select a new date for move exception');
            return;
        }
        try {
            await apiClient.post(`/api/recurring/${seriesId}/exception`, {
                original_date: date,
                exception_type: type,
                new_date: type === 'move' ? newDate : null,
                reason
            });
            setExceptionDialog({ open: false, type: 'skip', date: '' });
            fetchSeries();
        } catch (err) {
            console.error('Error adding exception:', err);
        }
    };

    const handleRemoveException = async (date) => {
        if (!window.confirm('Remove this exception?')) return;
        try {
            await apiClient.delete(`/api/recurring/${seriesId}/exception/${date}`);
            fetchSeries();
        } catch (err) {
            console.error('Error removing exception:', err);
        }
    };

    if (loading) {
        return (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
                <CircularProgress />
            </Box>
        );
    }

    if (error || !series) {
        return (
            <Box sx={{ p: 3 }}>
                <Alert severity="error">{error || 'Series not found'}</Alert>
                <Button startIcon={<BackIcon />} onClick={onBack} sx={{ mt: 2 }}>
                    Back
                </Button>
            </Box>
        );
    }

    const isPaused = !!series.paused_at;
    const isEnded = series.end_date && new Date(series.end_date) < new Date();
    const completionRate = series.total_instances > 0 
        ? Math.round((series.completed_instances / series.total_instances) * 100) 
        : 0;

    return (
        <Box sx={{ p: 3 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, gap: 2 }}>
                <IconButton onClick={onBack}>
                    <BackIcon />
                </IconButton>
                <Box sx={{ flex: 1 }}>
                    <Typography variant="h5" component="h1">
                        🔁 {series.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                        {series.rule_summary || getRuleSummary(series.recurrence_rule)}
                    </Typography>
                </Box>
                <Stack direction="row" spacing={1}>
                    {isPaused ? (
                        <Button
                            variant="outlined"
                            startIcon={<PlayIcon />}
                            onClick={handleResume}
                            color="success"
                        >
                            Resume
                        </Button>
                    ) : (
                        <Button
                            variant="outlined"
                            startIcon={<PauseIcon />}
                            onClick={handlePause}
                            color="warning"
                        >
                            Pause
                        </Button>
                    )}
                    <Button
                        variant="outlined"
                        startIcon={<RefreshIcon />}
                        onClick={handleGenerateNow}
                        disabled={generating || isPaused}
                    >
                        {generating ? 'Generating...' : 'Generate Now'}
                    </Button>
                    <Button
                        variant="outlined"
                        startIcon={<EditIcon />}
                        onClick={() => onEdit(series)}
                    >
                        Edit
                    </Button>
                    <IconButton color="error" onClick={() => setDeleteDialogOpen(true)}>
                        <DeleteIcon />
                    </IconButton>
                </Stack>
            </Box>

            {/* Status Chips */}
            <Stack direction="row" spacing={1} sx={{ mb: 3 }}>
                {isPaused && <Chip label="Paused" color="warning" icon={<PauseIcon />} />}
                {isEnded && <Chip label="Ended" color="default" />}
                {series.requires_approval && <Chip label="Requires Approval" color="info" variant="outlined" />}
                {series.project_name && <Chip label={series.project_name} variant="outlined" />}
            </Stack>

            {/* Stats Cards */}
            <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 2, mb: 3 }}>
                <Paper sx={{ p: 2 }}>
                    <Typography variant="overline" color="text.secondary">Total Instances</Typography>
                    <Typography variant="h4">{series.total_instances || 0}</Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant="overline" color="text.secondary">Completed</Typography>
                    <Typography variant="h4">{series.completed_instances || 0}</Typography>
                    <LinearProgress 
                        variant="determinate" 
                        value={completionRate} 
                        sx={{ mt: 1 }}
                    />
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant="overline" color="text.secondary">Start Date</Typography>
                    <Typography variant="h6">{formatLongDate(series.start_date) || '-'}</Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant="overline" color="text.secondary">Next Occurrence</Typography>
                    <Typography variant="h6" sx={{ color: series.next_occurrence ? '#3b82f6' : 'text.secondary' }}>
                        {series.next_occurrence ? formatLongDate(series.next_occurrence) : 'N/A'}
                    </Typography>
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant="overline" color="text.secondary">Generation Mode</Typography>
                    <Chip 
                        label={series.generation_mode === 'auto' ? '🔄 Auto' : '✋ Manual'}
                        color={series.generation_mode === 'auto' ? 'success' : 'warning'}
                        size="small"
                        sx={{ mt: 0.5 }}
                    />
                </Paper>
                <Paper sx={{ p: 2 }}>
                    <Typography variant="overline" color="text.secondary">Category</Typography>
                    <Typography variant="h6" sx={{ textTransform: 'capitalize' }}>
                        {series.category || 'Uncategorized'}
                    </Typography>
                </Paper>
            </Box>

            {/* Generation Info */}
            <Paper sx={{ p: 2, mb: 3, bgcolor: series.generation_mode === 'manual' ? 'rgba(245, 158, 11, 0.05)' : 'rgba(34, 197, 94, 0.05)' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 2 }}>
                    <Box>
                        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                            Instance Generation Settings
                        </Typography>
                        <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
                            <Typography variant="caption" color="text.secondary">
                                <strong>Prevent Future:</strong> {series.prevent_future ? '✅ Yes' : '❌ No'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                                <strong>Backfill Past:</strong> {series.generate_past ? '✅ Yes' : '❌ No'}
                            </Typography>
                        </Stack>
                    </Box>
                    {series.generation_mode === 'manual' && !isPaused && (
                        <Button
                            variant="contained"
                            startIcon={generating ? <CircularProgress size={16} color="inherit" /> : <RefreshIcon />}
                            onClick={handleGenerateNow}
                            disabled={generating}
                            sx={{ 
                                bgcolor: '#f59e0b',
                                '&:hover': { bgcolor: '#d97706' }
                            }}
                        >
                            {generating ? 'Generating...' : 'Generate Now'}
                        </Button>
                    )}
                </Box>
            </Paper>

            {/* Details */}
            <Paper sx={{ p: 2, mb: 3 }}>
                <Typography variant="h6" gutterBottom>Details</Typography>
                <Divider sx={{ mb: 2 }} />
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 2 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Description</Typography>
                        <Typography variant="body2">{series.description || 'No description'}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Assignment Strategy</Typography>
                        <Typography variant="body2" sx={{ textTransform: 'capitalize' }}>
                            {series.assignment_strategy?.replace('_', ' ')}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Assignee</Typography>
                        <Typography variant="body2">
                            {series.assignee_name || 'Unassigned'}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Approver</Typography>
                        <Typography variant="body2">
                            {series.approver_name || (series.requires_approval ? 'Not set' : 'N/A')}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Auto-close after</Typography>
                        <Typography variant="body2">
                            {series.auto_close_after_days ? `${series.auto_close_after_days} days` : 'Never'}
                        </Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">End Date</Typography>
                        <Typography variant="body2">
                            {series.end_date ? formatLongDate(series.end_date) : 'No end date'}
                        </Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Tabs */}
            <Paper>
                <Tabs value={tabValue} onChange={(e, v) => setTabValue(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                    <Tab label={`Instances (${series.recent_instances?.length || 0})`} icon={<CalendarIcon />} iconPosition="start" />
                    <Tab label={`Exceptions (${series.exceptions?.length || 0})`} icon={<SkipIcon />} iconPosition="start" />
                    <Tab label="Rotation" icon={<PersonIcon />} iconPosition="start" disabled={series.assignment_strategy !== 'round_robin'} />
                </Tabs>

                {/* Instances Tab */}
                {tabValue === 0 && (
                    <Box sx={{ p: 2 }}>
                        {series.recent_instances?.length > 0 ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Due Date</TableCell>
                                            <TableCell>Assignee</TableCell>
                                            <TableCell>Status</TableCell>
                                            <TableCell>Exception</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {series.recent_instances.map((task) => (
                                            <TableRow key={task.id}>
                                                <TableCell>
                                                    {formatLongDate(task.due_date) || '-'}
                                                </TableCell>
                                                <TableCell>{task.assignee_name || 'Unassigned'}</TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={task.status} 
                                                        size="small"
                                                        color={
                                                            task.status === 'Completed' ? 'success' :
                                                            task.status === 'auto_closed' ? 'default' :
                                                            task.status === 'Open' ? 'primary' : 'warning'
                                                        }
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {task.is_exception && <Chip label="Modified" size="small" variant="outlined" />}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                No instances generated yet
                            </Typography>
                        )}
                    </Box>
                )}

                {/* Exceptions Tab */}
                {tabValue === 1 && (
                    <Box sx={{ p: 2 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                            <Button
                                startIcon={<AddIcon />}
                                onClick={() => setExceptionDialog({ open: true, type: 'skip', date: '' })}
                                size="small"
                            >
                                Add Exception
                            </Button>
                        </Box>
                        {series.exceptions?.length > 0 ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Original Date</TableCell>
                                            <TableCell>Type</TableCell>
                                            <TableCell>New Date</TableCell>
                                            <TableCell>Reason</TableCell>
                                            <TableCell>Actions</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {series.exceptions.map((exc) => (
                                            <TableRow key={exc.id}>
                                                <TableCell>
                                                    {formatLongDate(exc.original_date) || '-'}
                                                </TableCell>
                                                <TableCell>
                                                    <Chip 
                                                        label={exc.exception_type} 
                                                        size="small"
                                                        color={exc.exception_type === 'skip' ? 'warning' : 'info'}
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    {exc.new_date ? formatLongDate(exc.new_date) : '-'}
                                                </TableCell>
                                                <TableCell>{exc.reason || '-'}</TableCell>
                                                <TableCell>
                                                    <IconButton 
                                                        size="small" 
                                                        color="error"
                                                        onClick={() => handleRemoveException(exc.original_date)}
                                                    >
                                                        <DeleteIcon fontSize="small" />
                                                    </IconButton>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                No exceptions defined
                            </Typography>
                        )}
                    </Box>
                )}

                {/* Rotation Tab */}
                {tabValue === 2 && (
                    <Box sx={{ p: 2 }}>
                        {series.rotation_members?.length > 0 ? (
                            <TableContainer>
                                <Table size="small">
                                    <TableHead>
                                        <TableRow>
                                            <TableCell>Order</TableCell>
                                            <TableCell>Member</TableCell>
                                            <TableCell>Last Assigned</TableCell>
                                        </TableRow>
                                    </TableHead>
                                    <TableBody>
                                        {series.rotation_members.map((member) => (
                                            <TableRow key={member.id}>
                                                <TableCell>{member.order_index}</TableCell>
                                                <TableCell>{member.user_name}</TableCell>
                                                <TableCell>
                                                    {member.last_assigned_at 
                                                        ? formatLongDate(member.last_assigned_at)
                                                        : 'Never'
                                                    }
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </TableContainer>
                        ) : (
                            <Typography color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                                No rotation members configured
                            </Typography>
                        )}
                    </Box>
                )}
            </Paper>

            {/* Exception Dialog */}
            <Dialog 
                open={exceptionDialog.open} 
                onClose={() => setExceptionDialog({ open: false, type: 'skip', date: '' })}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Add Exception</DialogTitle>
                <DialogContent>
                    <Stack spacing={2} sx={{ mt: 1 }}>
                        <FormControl fullWidth>
                            <InputLabel>Exception Type</InputLabel>
                            <Select
                                value={exceptionDialog.type}
                                onChange={(e) => setExceptionDialog(prev => ({ ...prev, type: e.target.value }))}
                                label="Exception Type"
                            >
                                <MenuItem value="skip">Skip (Don't generate)</MenuItem>
                                <MenuItem value="move">Move (Generate on different date)</MenuItem>
                            </Select>
                        </FormControl>
                        <TextField
                            type="date"
                            label="Original Date"
                            value={exceptionDialog.date}
                            onChange={(e) => setExceptionDialog(prev => ({ ...prev, date: e.target.value }))}
                            InputLabelProps={{ shrink: true }}
                            fullWidth
                        />
                        {exceptionDialog.type === 'move' && (
                            <TextField
                                type="date"
                                label="New Date"
                                value={exceptionDialog.newDate || ''}
                                onChange={(e) => setExceptionDialog(prev => ({ ...prev, newDate: e.target.value }))}
                                InputLabelProps={{ shrink: true }}
                                fullWidth
                            />
                        )}
                        <TextField
                            label="Reason (Optional)"
                            value={exceptionDialog.reason || ''}
                            onChange={(e) => setExceptionDialog(prev => ({ ...prev, reason: e.target.value }))}
                            multiline
                            rows={2}
                            fullWidth
                        />
                    </Stack>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setExceptionDialog({ open: false, type: 'skip', date: '' })}>
                        Cancel
                    </Button>
                    <Button variant="contained" onClick={handleAddException}>
                        Add Exception
                    </Button>
                </DialogActions>
            </Dialog>

            <Dialog
                open={deleteDialogOpen}
                onClose={() => setDeleteDialogOpen(false)}
                maxWidth="sm"
                fullWidth
            >
                <DialogTitle>Delete recurring series?</DialogTitle>
                <DialogContent>
                    <Typography variant="body2" color="text.secondary">
                        Delete "{series.title}"? Existing tasks will be preserved.
                    </Typography>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setDeleteDialogOpen(false)}>
                        Cancel
                    </Button>
                    <Button variant="contained" color="error" onClick={handleDelete}>
                        Delete
                    </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
}

export default SeriesDetail;
