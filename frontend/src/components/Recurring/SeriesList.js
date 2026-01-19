import React, { useState, useEffect, useCallback } from 'react';
import {
    Box,
    Typography,
    Button,
    Card,
    CardContent,
    Chip,
    IconButton,
    Menu,
    MenuItem,
    TextField,
    InputAdornment,
    CircularProgress,
    Grid,
    Avatar,
    Tooltip
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PauseIcon from '@mui/icons-material/Pause';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import FilterListIcon from '@mui/icons-material/FilterList';
import RepeatIcon from '@mui/icons-material/Repeat';
import TodayIcon from '@mui/icons-material/Today';
import EventRepeatIcon from '@mui/icons-material/EventRepeat';
import AutoModeIcon from '@mui/icons-material/AutoMode';
import TouchAppIcon from '@mui/icons-material/TouchApp';
import apiClient from '../../apiClient';
import { getRuleSummary } from '../../utils/recurrenceHelpers';

/**
 * SeriesList Component
 * Displays list of recurring series for a workspace
 */
function SeriesList({ workspace, onCreateNew, onEdit, onViewDetail }) {
    const workspaceId = workspace?.id;
    const [series, setSeries] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showPaused, setShowPaused] = useState(false);
    const [filterAnchorEl, setFilterAnchorEl] = useState(null);
    const [menuAnchor, setMenuAnchor] = useState(null);
    const [selectedSeries, setSelectedSeries] = useState(null);

    // Fetch series
    const fetchSeries = useCallback(async () => {
        if (!workspaceId) return;
        setLoading(true);
        setError(null);
        try {
            const params = new URLSearchParams({
                includePaused: 'true',
                includeDeleted: 'false'
            });
            const response = await apiClient.get(
                `/api/recurring/workspace/${workspaceId}?${params}`
            );
            setSeries(response.data || []);
        } catch (err) {
            console.error('Error fetching series:', err);
            setError('Failed to load recurring series');
        } finally {
            setLoading(false);
        }
    }, [workspaceId]);

    useEffect(() => {
        if (workspaceId) {
            fetchSeries();
        }
    }, [workspaceId, fetchSeries]);

    // Filter series
    const filteredSeries = (series || []).filter(s => {
        // Search filter
        const matchesSearch = !searchQuery || 
            s.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.description?.toLowerCase().includes(searchQuery.toLowerCase());
        
        // Pause filter
        const matchesPauseFilter = showPaused ? !!s.paused_at : !s.paused_at;
        
        return matchesSearch && matchesPauseFilter;
    });

    // Counts
    const activeCount = series.filter(s => !s.paused_at).length;
    const pausedCount = series.filter(s => s.paused_at).length;

    // Menu handlers
    const handleMenuOpen = (event, series) => {
        setMenuAnchor(event.currentTarget);
        setSelectedSeries(series);
    };

    const handleMenuClose = () => {
        setMenuAnchor(null);
        setSelectedSeries(null);
    };

    // Actions
    const handlePauseSeries = async (seriesId) => {
        try {
            await apiClient.post(`/api/recurring/${seriesId}/pause`);
            fetchSeries();
        } catch (err) {
            console.error('Error pausing series:', err);
        }
        handleMenuClose();
    };

    const handleResumeSeries = async (seriesId) => {
        try {
            await apiClient.post(`/api/recurring/${seriesId}/resume`);
            fetchSeries();
        } catch (err) {
            console.error('Error resuming series:', err);
        }
        handleMenuClose();
    };

    const handleDeleteSeries = async (seriesId) => {
        if (!window.confirm('Delete this recurring series? Existing tasks will be preserved.')) {
            return;
        }
        try {
            await apiClient.delete(`/api/recurring/${seriesId}`);
            fetchSeries();
        } catch (err) {
            console.error('Error deleting series:', err);
        }
        handleMenuClose();
    };

    const handleGenerateNow = async (seriesId) => {
        try {
            const response = await apiClient.post(`/api/recurring/${seriesId}/generate`);
            alert(`Generated ${response.data?.generated || 0} task instances`);
            fetchSeries();
        } catch (err) {
            console.error('Error generating instances:', err);
        }
        handleMenuClose();
    };

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
                        Recurring Tasks
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Manage your recurring task series and schedules
                    </Typography>
                </Box>
                <Button
                    variant="contained"
                    startIcon={<AddIcon />}
                    onClick={onCreateNew}
                    sx={{
                        px: 3,
                        py: 1.5,
                        borderRadius: 2,
                        textTransform: 'none',
                        fontWeight: 600,
                    }}
                >
                    Create Series
                </Button>
            </Box>

            {/* Search & Filter */}
            <Box sx={{ display: 'flex', gap: 2, mb: 4, alignItems: 'center' }}>
                <TextField
                    fullWidth
                    placeholder="Search recurring series..."
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
                    variant={showPaused ? 'contained' : 'outlined'}
                    startIcon={showPaused ? <PlayArrowIcon /> : <PauseIcon />}
                    onClick={() => setShowPaused(!showPaused)}
                    sx={{ borderRadius: 2, textTransform: 'none' }}
                >
                    {showPaused ? `Show Active (${activeCount})` : `Show Paused (${pausedCount})`}
                </Button>
                <IconButton onClick={fetchSeries} sx={{ ml: 'auto' }}>
                    <RefreshIcon />
                </IconButton>
            </Box>

            {/* Filter Menu */}
            <Menu
                anchorEl={filterAnchorEl}
                open={Boolean(filterAnchorEl)}
                onClose={() => setFilterAnchorEl(null)}
            >
                <MenuItem onClick={() => { setShowPaused(false); setFilterAnchorEl(null); }}>
                    Active Only
                </MenuItem>
                <MenuItem onClick={() => { setShowPaused(true); setFilterAnchorEl(null); }}>
                    Paused Only
                </MenuItem>
            </Menu>

            {/* Error State */}
            {error && (
                <Box sx={{ textAlign: 'center', py: 4 }}>
                    <Typography color="error">{error}</Typography>
                    <Button onClick={fetchSeries} sx={{ mt: 2 }}>Retry</Button>
                </Box>
            )}

            {/* Series Grid */}
            {!error && (
                <Grid container spacing={3}>
                    {filteredSeries.map((item) => {
                        const getCategoryIcon = (cat) => {
                            const icons = {
                                daily: '📆',
                                weekly: '📅',
                                monthly: '🗓️',
                                yearly: '📊',
                                reports: '📋',
                                maintenance: '🔧',
                                reviews: '👁️',
                                meetings: '🤝'
                            };
                            return icons[cat] || '🔁';
                        };
                        
                        return (
                        <Grid item xs={12} md={6} lg={4} key={item.id}>
                            <Card
                                elevation={0}
                                onClick={() => onViewDetail(item.id)}
                                sx={{
                                    border: '1px solid rgba(148, 163, 184, 0.2)',
                                    borderLeft: `4px solid ${item.color || '#0f766e'}`,
                                    borderRadius: 3,
                                    cursor: 'pointer',
                                    height: '100%',
                                    transition: 'all 0.2s ease',
                                    opacity: item.paused_at ? 0.7 : 1,
                                    '&:hover': {
                                        transform: 'translateY(-4px)',
                                        boxShadow: '0 12px 40px rgba(15, 23, 42, 0.1)',
                                        borderColor: item.color || '#0f766e',
                                    },
                                }}
                            >
                                <CardContent sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
                                    {/* Header */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1.5 }}>
                                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                            <Box
                                                sx={{
                                                    width: 40,
                                                    height: 40,
                                                    borderRadius: 2,
                                                    backgroundColor: item.paused_at ? 'rgba(148, 163, 184, 0.2)' : `${item.color || '#0f766e'}15`,
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    color: item.paused_at ? '#64748b' : (item.color || '#0f766e'),
                                                    fontSize: '1.2rem'
                                                }}
                                            >
                                                {getCategoryIcon(item.category)}
                                            </Box>
                                            {/* Generation Mode Badge */}
                                            <Tooltip title={item.generation_mode === 'auto' ? 'Auto Generation' : 'Manual Generation'}>
                                                <Box sx={{ 
                                                    p: 0.5, 
                                                    borderRadius: 1, 
                                                    bgcolor: item.generation_mode === 'auto' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                                                    display: 'flex',
                                                    alignItems: 'center'
                                                }}>
                                                    {item.generation_mode === 'auto' ? (
                                                        <AutoModeIcon sx={{ fontSize: 16, color: '#22c55e' }} />
                                                    ) : (
                                                        <TouchAppIcon sx={{ fontSize: 16, color: '#f59e0b' }} />
                                                    )}
                                                </Box>
                                            </Tooltip>
                                        </Box>
                                        <IconButton
                                            size="small"
                                            onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, item); }}
                                        >
                                            <MoreVertIcon fontSize="small" />
                                        </IconButton>
                                    </Box>

                                    {/* Series Info */}
                                    <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5, fontSize: '1rem' }}>
                                        {item.title}
                                    </Typography>
                                    <Typography variant="caption" color="text.secondary" sx={{ mb: 1.5 }}>
                                        {item.rule_summary || getRuleSummary(item.recurrence_rule) || 'Custom schedule'}
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
                                        {item.description || 'No description'}
                                    </Typography>

                                    {/* Stats */}
                                    <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                                        {item.paused_at && (
                                            <Chip
                                                label="Paused"
                                                size="small"
                                                sx={{
                                                    backgroundColor: '#fef3c7',
                                                    color: '#92400e',
                                                    fontWeight: 500,
                                                    fontSize: '0.65rem',
                                                    height: 22,
                                                }}
                                            />
                                        )}
                                        {item.category && (
                                            <Chip
                                                label={item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                                                size="small"
                                                sx={{
                                                    backgroundColor: `${item.color || '#0f766e'}15`,
                                                    color: item.color || '#0f766e',
                                                    fontWeight: 500,
                                                    fontSize: '0.65rem',
                                                    height: 22,
                                                }}
                                            />
                                        )}
                                        <Chip
                                            label={`${item.total_instances || 0} Tasks`}
                                            size="small"
                                            sx={{
                                                backgroundColor: '#e0e7ff',
                                                color: '#3730a3',
                                                fontWeight: 500,
                                                fontSize: '0.65rem',
                                                height: 22,
                                            }}
                                        />
                                        <Chip
                                            label={`${item.completed_instances || 0} Done`}
                                            size="small"
                                            sx={{
                                                backgroundColor: '#d1fae5',
                                                color: '#065f46',
                                                fontWeight: 500,
                                                fontSize: '0.65rem',
                                                height: 22,
                                            }}
                                        />
                                        {item.prevent_future && (
                                            <Tooltip title="Future instances prevented">
                                                <Chip
                                                    icon={<TodayIcon sx={{ fontSize: 14 }} />}
                                                    label="Today Only"
                                                    size="small"
                                                    sx={{
                                                        backgroundColor: '#fce7f3',
                                                        color: '#be185d',
                                                        fontWeight: 500,
                                                        fontSize: '0.65rem',
                                                        height: 22,
                                                    }}
                                                />
                                            </Tooltip>
                                        )}
                                    </Box>

                                    {/* Next Occurrence */}
                                    {item.next_occurrence && !item.paused_at && (
                                        <Box sx={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: 0.5, 
                                            mb: 1.5,
                                            p: 1,
                                            bgcolor: 'rgba(59, 130, 246, 0.05)',
                                            borderRadius: 1
                                        }}>
                                            <EventRepeatIcon sx={{ fontSize: 14, color: '#3b82f6' }} />
                                            <Typography variant="caption" sx={{ color: '#3b82f6', fontWeight: 500 }}>
                                                Next: {new Date(item.next_occurrence).toLocaleDateString('en-GB', { 
                                                    day: '2-digit', 
                                                    month: 'short', 
                                                    year: 'numeric' 
                                                })}
                                            </Typography>
                                        </Box>
                                    )}

                                    {/* Progress Bar */}
                                    {item.total_instances > 0 && (
                                        <Box sx={{ mb: 2 }}>
                                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                                                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.7rem' }}>
                                                    Completion
                                                </Typography>
                                                <Typography variant="caption" sx={{ fontWeight: 600, fontSize: '0.7rem' }}>
                                                    {Math.round((item.completed_instances / item.total_instances) * 100) || 0}%
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
                                                        width: `${(item.completed_instances / item.total_instances) * 100 || 0}%`,
                                                        backgroundColor: '#0f766e',
                                                        borderRadius: 3,
                                                        transition: 'width 0.3s ease',
                                                    }}
                                                />
                                            </Box>
                                        </Box>
                                    )}

                                    {/* Footer */}
                                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 'auto' }}>
                                        {item.assignee_name ? (
                                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                                <Avatar sx={{ width: 26, height: 26, fontSize: '0.7rem' }}>
                                                    {item.assignee_name?.split(' ').map(n => n[0]).join('')}
                                                </Avatar>
                                                <Typography variant="caption" color="text.secondary">
                                                    {item.assignee_name}
                                                </Typography>
                                            </Box>
                                        ) : (
                                            <Typography variant="caption" color="text.secondary">
                                                Unassigned
                                            </Typography>
                                        )}
                                        {item.project_name && (
                                            <Chip
                                                label={item.project_name}
                                                size="small"
                                                sx={{
                                                    backgroundColor: 'rgba(148, 163, 184, 0.1)',
                                                    fontSize: '0.65rem',
                                                    height: 20,
                                                }}
                                            />
                                        )}
                                    </Box>
                                </CardContent>
                            </Card>
                        </Grid>
                    );
                    })}
                </Grid>
            )}

            {/* Empty State */}
            {!error && filteredSeries.length === 0 && (
                <Box sx={{ textAlign: 'center', py: 8 }}>
                    <RepeatIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
                    <Typography variant="h6" color="text.secondary" gutterBottom>
                        {searchQuery ? 'No series match your search' : 'No recurring series yet'}
                    </Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Create recurring series to automate repetitive tasks
                    </Typography>
                    {!searchQuery && (
                        <Button
                            variant="contained"
                            startIcon={<AddIcon />}
                            onClick={onCreateNew}
                            sx={{ borderRadius: 2, textTransform: 'none' }}
                        >
                            Create your first series
                        </Button>
                    )}
                </Box>
            )}

            {/* Context Menu */}
            <Menu
                anchorEl={menuAnchor}
                open={Boolean(menuAnchor)}
                onClose={handleMenuClose}
            >
                <MenuItem onClick={() => { handleMenuClose(); onViewDetail(selectedSeries?.id); }}>
                    <VisibilityIcon fontSize="small" sx={{ mr: 1.5 }} />
                    View Details
                </MenuItem>
                <MenuItem onClick={() => { handleMenuClose(); onEdit(selectedSeries); }}>
                    <EditIcon fontSize="small" sx={{ mr: 1.5 }} />
                    Edit
                </MenuItem>
                {selectedSeries?.paused_at ? (
                    <MenuItem onClick={() => handleResumeSeries(selectedSeries?.id)}>
                        <PlayArrowIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Resume
                    </MenuItem>
                ) : (
                    <MenuItem onClick={() => handlePauseSeries(selectedSeries?.id)}>
                        <PauseIcon fontSize="small" sx={{ mr: 1.5 }} />
                        Pause
                    </MenuItem>
                )}
                <MenuItem onClick={() => handleGenerateNow(selectedSeries?.id)}>
                    <RefreshIcon fontSize="small" sx={{ mr: 1.5 }} />
                    Generate Now
                </MenuItem>
                <MenuItem onClick={() => handleDeleteSeries(selectedSeries?.id)} sx={{ color: 'error.main' }}>
                    <DeleteIcon fontSize="small" sx={{ mr: 1.5 }} />
                    Delete
                </MenuItem>
            </Menu>
        </Box>
    );
}

export default SeriesList;
