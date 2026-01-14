import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  IconButton,
  TextField,
  InputAdornment,
  Chip,
  Menu,
  MenuItem,
  FormControl,
  Select,
  Checkbox,
  ListItemText,
  Divider,
  Tooltip,
  Badge,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Snackbar,
  ToggleButton,
  ToggleButtonGroup,
  Collapse,
  FormControlLabel,
  Switch,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewListIcon from '@mui/icons-material/ViewList';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import AddIcon from '@mui/icons-material/Add';
import SaveIcon from '@mui/icons-material/Save';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import SortIcon from '@mui/icons-material/Sort';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import RefreshIcon from '@mui/icons-material/Refresh';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import ClearIcon from '@mui/icons-material/Clear';
import WarningIcon from '@mui/icons-material/Warning';
import RepeatIcon from '@mui/icons-material/Repeat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';

import TasksTableView from './TasksTableView';
import TasksCalendarView from './TasksCalendarView';
import TasksBoardView from './TasksBoardView';
import TaskFormWithProjectSelect from './TaskFormWithProjectSelect';

import {
  getWorkspaceTasks,
  getWorkspaceProjects,
  getWorkspaceMembers,
  getCalendarTasks,
  bulkUpdateTasks,
  updateTask,
  getSavedViews,
  createSavedView,
  updateSavedView,
  deleteSavedView,
  getUserViewPreferences,
  updateUserViewPreferences,
} from '../../apiClient';

const VIEW_TYPES = [
  { id: 'table', label: 'Table', icon: <ViewListIcon /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarMonthIcon /> },
  { id: 'board', label: 'Board', icon: <ViewKanbanIcon /> },
];

const STATUS_OPTIONS = ['Open', 'In Progress', 'Under Review', 'Completed', 'Closed'];
const STAGE_OPTIONS = ['Not Started', 'Planning', 'In Development', 'Testing', 'Done'];
const BULK_STAGE_OPTIONS = ['Planned', 'In-process', 'Completed', 'On-hold', 'Dropped'];
const PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const GROUP_BY_OPTIONS = [
  { id: null, label: 'None' },
  { id: 'project', label: 'Project' },
  { id: 'status', label: 'Status' },
  { id: 'priority', label: 'Priority' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'due_date', label: 'Due Date' },
];

const SORT_OPTIONS = [
  { id: 'created_at', label: 'Created Date' },
  { id: 'updated_at', label: 'Updated Date' },
  { id: 'due_date', label: 'Due Date' },
  { id: 'name', label: 'Name' },
  { id: 'priority', label: 'Priority' },
  { id: 'status', label: 'Status' },
  { id: 'project_name', label: 'Project' },
  { id: 'assignee_name', label: 'Assignee' },
];

const DEFAULT_FILTERS = {
  projects: [],
  status: [],
  stage: [],
  priority: [],
  assignee: 'all',
  overdue: false,
  recurring: null,
  search: '',
  include_archived: false,
};

function TasksPage({ workspace, user }) {
  // View state
  const [viewType, setViewType] = useState('table');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data state
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [total, setTotal] = useState(0);
  const [groupMetadata, setGroupMetadata] = useState(null);
  
  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(50);
  
  // Filters
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  
  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Grouping
  const [groupBy, setGroupBy] = useState(null);
  
  // Saved Views
  const [savedViews, setSavedViews] = useState([]);
  const [activeView, setActiveView] = useState(null);
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [newViewName, setNewViewName] = useState('');
  const [newViewVisibility, setNewViewVisibility] = useState('personal');
  
  // UI state
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  
  // Menu anchors
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [sortAnchor, setSortAnchor] = useState(null);
  const [groupAnchor, setGroupAnchor] = useState(null);
  const [savedViewsAnchor, setSavedViewsAnchor] = useState(null);
  const [bulkActionAnchor, setBulkActionAnchor] = useState(null);
  const [bulkDueDate, setBulkDueDate] = useState('');
  const [bulkTargetDate, setBulkTargetDate] = useState('');
  const [bulkAssigneeId, setBulkAssigneeId] = useState('');
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  
  // Calendar state
  const [calendarDate, setCalendarDate] = useState(new Date());
  const [calendarTasks, setCalendarTasks] = useState([]);

  // Fetch projects
  useEffect(() => {
    if (!workspace?.id) return;
    
    const fetchProjects = async () => {
      try {
        const res = await getWorkspaceProjects(workspace.id);
        setProjects(res.data || []);
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    
    fetchProjects();
  }, [workspace?.id]);

  // Fetch workspace members
  useEffect(() => {
    if (!workspace?.id) return;
    
    const fetchWorkspaceMembers = async () => {
      try {
        const res = await getWorkspaceMembers(workspace.id);
        setWorkspaceMembers(res.data || []);
      } catch (err) {
        console.error('Failed to fetch workspace members:', err);
        setWorkspaceMembers([]);
      }
    };
    
    fetchWorkspaceMembers();
  }, [workspace?.id]);

  // Fetch saved views
  useEffect(() => {
    if (!workspace?.id) return;
    
    const fetchSavedViews = async () => {
      try {
        const res = await getSavedViews(workspace.id);
        setSavedViews(res.data || []);
      } catch (err) {
        console.error('Failed to fetch saved views:', err);
      }
    };
    
    fetchSavedViews();
  }, [workspace?.id]);

  // Load user preferences
  useEffect(() => {
    if (!workspace?.id) return;
    
    const loadPreferences = async () => {
      try {
        const res = await getUserViewPreferences(workspace.id);
        if (res.data) {
          if (res.data.default_view) setViewType(res.data.default_view);
          if (res.data.selected_projects?.length) {
            setFilters(prev => ({ ...prev, projects: res.data.selected_projects }));
          }
        }
      } catch (err) {
        console.error('Failed to load preferences:', err);
      }
    };
    
    loadPreferences();
  }, [workspace?.id]);

  // Build query params for API
  const buildQueryParams = useCallback(() => {
    const params = {
      page,
      limit,
      sort_by: sortBy,
      sort_order: sortOrder,
    };
    
    if (filters.projects.length > 0) params.projects = filters.projects.join(',');
    if (filters.status.length > 0) params.status = filters.status.join(',');
    if (filters.stage.length > 0) params.stage = filters.stage.join(',');
    if (filters.priority.length > 0) params.priority = filters.priority.join(',');
    if (filters.assignee && filters.assignee !== 'all') params.assignee = filters.assignee;
    if (filters.overdue) params.overdue = 'true';
    if (filters.recurring !== null) params.recurring = filters.recurring ? 'true' : 'false';
    if (filters.search) params.search = filters.search;
    if (filters.include_archived) params.include_archived = 'true';
    if (groupBy) params.group_by = groupBy;
    
    return params;
  }, [page, limit, sortBy, sortOrder, filters, groupBy]);

  // Fetch tasks
  const fetchTasks = useCallback(async () => {
    if (!workspace?.id) return;
    
    setLoading(true);
    setError(null);
    
    try {
      const params = buildQueryParams();
      const res = await getWorkspaceTasks(workspace.id, params);
      
      setTasks(res.data.tasks || []);
      setTotal(res.data.total || 0);
      setGroupMetadata(res.data.groupMetadata || null);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
      setError('Failed to load tasks. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, buildQueryParams]);

  // Fetch calendar tasks
  const fetchCalendarTasks = useCallback(async () => {
    if (!workspace?.id || viewType !== 'calendar') return;
    
    const startOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth(), 1);
    const endOfMonth = new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 0);
    
    try {
      const params = {
        start_date: startOfMonth.toISOString().split('T')[0],
        end_date: endOfMonth.toISOString().split('T')[0],
      };
      if (filters.projects.length > 0) params.projects = filters.projects.join(',');
      
      const res = await getCalendarTasks(workspace.id, params);
      setCalendarTasks(res.data || []);
    } catch (err) {
      console.error('Failed to fetch calendar tasks:', err);
    }
  }, [workspace?.id, viewType, calendarDate, filters.projects]);

  // Load tasks when params change
  useEffect(() => {
    if (viewType === 'calendar') {
      fetchCalendarTasks();
    } else {
      fetchTasks();
    }
  }, [viewType, fetchTasks, fetchCalendarTasks]);

  // Filter helpers
  const hasActiveFilters = useMemo(() => {
    return filters.projects.length > 0 ||
      filters.status.length > 0 ||
      filters.stage.length > 0 ||
      filters.priority.length > 0 ||
      filters.assignee !== 'all' ||
      filters.overdue ||
      filters.recurring !== null ||
      filters.search ||
      filters.include_archived;
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.projects.length > 0) count++;
    if (filters.status.length > 0) count++;
    if (filters.stage.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.assignee !== 'all') count++;
    if (filters.overdue) count++;
    if (filters.recurring !== null) count++;
    if (filters.include_archived) count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  // Saved View handlers
  const handleApplyView = (view) => {
    if (!view.config) return;
    
    const config = view.config;
    setViewType(config.viewType || 'table');
    setFilters(config.filters || DEFAULT_FILTERS);
    setSortBy(config.sortBy || 'created_at');
    setSortOrder(config.sortOrder || 'desc');
    setGroupBy(config.groupBy || null);
    setActiveView(view);
    setSavedViewsAnchor(null);
    setPage(1);
  };

  const handleSaveView = async () => {
    if (!newViewName.trim()) return;
    
    const config = {
      viewType,
      filters,
      sortBy,
      sortOrder,
      groupBy,
    };
    
    try {
      const res = await createSavedView(workspace.id, {
        name: newViewName.trim(),
        view_type: viewType,
        config,
        visibility: newViewVisibility,
      });
      
      setSavedViews(prev => [...prev, res.data]);
      setShowSaveViewDialog(false);
      setNewViewName('');
      setSnackbar({ open: true, message: 'View saved successfully', severity: 'success' });
    } catch (err) {
      console.error('Failed to save view:', err);
      setSnackbar({ open: true, message: 'Failed to save view', severity: 'error' });
    }
  };

  const handleDeleteView = async (viewId) => {
    try {
      await deleteSavedView(viewId);
      setSavedViews(prev => prev.filter(v => v.id !== viewId));
      if (activeView?.id === viewId) setActiveView(null);
      setSnackbar({ open: true, message: 'View deleted', severity: 'success' });
    } catch (err) {
      console.error('Failed to delete view:', err);
      setSnackbar({ open: true, message: 'Failed to delete view', severity: 'error' });
    }
  };

  // Bulk actions
  const resetBulkInputs = () => {
    setBulkDueDate('');
    setBulkTargetDate('');
    setBulkAssigneeId('');
  };

  const handleCloseBulkMenu = () => {
    setBulkActionAnchor(null);
    resetBulkInputs();
  };

  const handleBulkUpdate = async (updates) => {
    if (selectedTasks.length === 0) return;
    
    try {
      await bulkUpdateTasks(selectedTasks, updates);
      setSelectedTasks([]);
      setBulkActionAnchor(null);
      resetBulkInputs();
      fetchTasks();
      setSnackbar({ open: true, message: `${selectedTasks.length} tasks updated`, severity: 'success' });
    } catch (err) {
      console.error('Failed to bulk update:', err);
      setSnackbar({ open: true, message: 'Failed to update tasks', severity: 'error' });
    }
  };

  const getMemberLabel = (member) => {
    if (!member) return 'Unknown';
    const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
    return fullName || member.username || member.email || 'Unknown';
  };

  const applyBulkDueDate = () => {
    if (!bulkDueDate) return;
    handleBulkUpdate({ due_date: bulkDueDate });
  };

  const applyBulkTargetDate = () => {
    if (!bulkTargetDate) return;
    handleBulkUpdate({ target_date: bulkTargetDate });
  };

  const applyBulkAssignee = () => {
    if (bulkAssigneeId === '') return;
    const assigneeId = bulkAssigneeId === 'unassigned' ? null : Number(bulkAssigneeId);
    handleBulkUpdate({ assignee_id: assigneeId });
  };

  // Task actions
  const handleTaskClick = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleTaskEdit = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleTaskCreated = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    fetchTasks();
  };

  // Handle task update for calendar drag & drop
  const handleTaskUpdate = async (taskId, updates) => {
    try {
      await updateTask(taskId, updates);
      // Refresh calendar tasks
      if (viewType === 'calendar') {
        fetchCalendarTasks();
      } else {
        fetchTasks();
      }
      setSnackbar({ open: true, message: 'Task updated', severity: 'success' });
    } catch (err) {
      console.error('Failed to update task:', err);
      setSnackbar({ open: true, message: 'Failed to update task', severity: 'error' });
      throw err;
    }
  };

  // Task context indicators
  const getTaskIndicators = (task) => {
    const indicators = [];
    if (task.is_recurring) indicators.push({ type: 'recurring', icon: <RepeatIcon fontSize="small" />, label: 'Recurring', color: '#7c3aed' });
    if (task.latest_approval_status === 'pending') indicators.push({ type: 'approval', icon: <CheckCircleIcon fontSize="small" />, label: 'Pending Approval', color: '#2563eb' });
    if (task.is_overdue) indicators.push({ type: 'overdue', icon: <WarningIcon fontSize="small" />, label: 'Overdue', color: '#dc2626' });
    return indicators;
  };

  // Render filter menu
  const renderFilterMenu = () => (
    <Popover
      open={Boolean(filterAnchor)}
      anchorEl={filterAnchor}
      onClose={() => setFilterAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
      PaperProps={{ sx: { width: 320, maxHeight: 500, p: 2 } }}
    >
      <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 2 }}>Filters</Typography>
      
      {/* Project Filter */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Projects</Typography>
        <FormControl fullWidth size="small">
          <Select
            multiple
            value={filters.projects}
            onChange={(e) => setFilters(prev => ({ ...prev, projects: e.target.value }))}
            renderValue={(selected) => selected.length === 0 ? 'All Projects' : `${selected.length} selected`}
            displayEmpty
          >
            {projects.map(p => (
              <MenuItem key={p.id} value={p.id}>
                <Checkbox checked={filters.projects.includes(p.id)} size="small" />
                <ListItemText primary={p.name} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Status Filter */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Status</Typography>
        <FormControl fullWidth size="small">
          <Select
            multiple
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
            renderValue={(selected) => selected.length === 0 ? 'All Statuses' : selected.join(', ')}
            displayEmpty
          >
            {STATUS_OPTIONS.map(s => (
              <MenuItem key={s} value={s}>
                <Checkbox checked={filters.status.includes(s)} size="small" />
                <ListItemText primary={s} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Priority Filter */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Priority</Typography>
        <FormControl fullWidth size="small">
          <Select
            multiple
            value={filters.priority}
            onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
            renderValue={(selected) => selected.length === 0 ? 'All Priorities' : selected.join(', ')}
            displayEmpty
          >
            {PRIORITY_OPTIONS.map(p => (
              <MenuItem key={p} value={p}>
                <Checkbox checked={filters.priority.includes(p)} size="small" />
                <ListItemText primary={p} />
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Box>

      {/* Assignee Filter */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Assignee</Typography>
        <FormControl fullWidth size="small">
          <Select
            value={filters.assignee}
            onChange={(e) => setFilters(prev => ({ ...prev, assignee: e.target.value }))}
          >
            <MenuItem value="all">All Assignees</MenuItem>
            <MenuItem value="me">Assigned to me</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Divider sx={{ my: 2 }} />

      {/* Quick Filters */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.overdue}
              onChange={(e) => setFilters(prev => ({ ...prev, overdue: e.target.checked }))}
              size="small"
            />
          }
          label={<Typography variant="body2">Overdue only</Typography>}
        />
      </Box>

      <Box sx={{ mb: 2 }}>
        <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>Recurring</Typography>
        <FormControl fullWidth size="small">
          <Select
            value={filters.recurring === null ? 'all' : filters.recurring ? 'yes' : 'no'}
            onChange={(e) => {
              const val = e.target.value;
              setFilters(prev => ({ ...prev, recurring: val === 'all' ? null : val === 'yes' }));
            }}
          >
            <MenuItem value="all">All Tasks</MenuItem>
            <MenuItem value="yes">Recurring only</MenuItem>
            <MenuItem value="no">Non-recurring only</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={filters.include_archived}
              onChange={(e) => setFilters(prev => ({ ...prev, include_archived: e.target.checked }))}
              size="small"
            />
          }
          label={<Typography variant="body2">Include archived</Typography>}
        />
      </Box>

      <Divider sx={{ my: 2 }} />
      
      <Box sx={{ display: 'flex', gap: 1 }}>
        <Button size="small" onClick={clearFilters} disabled={!hasActiveFilters}>
          Clear All
        </Button>
        <Button size="small" variant="contained" onClick={() => setFilterAnchor(null)}>
          Apply
        </Button>
      </Box>
    </Popover>
  );

  // Render sort menu
  const renderSortMenu = () => (
    <Menu
      anchorEl={sortAnchor}
      open={Boolean(sortAnchor)}
      onClose={() => setSortAnchor(null)}
    >
      {SORT_OPTIONS.map(option => (
        <MenuItem
          key={option.id}
          selected={sortBy === option.id}
          onClick={() => {
            if (sortBy === option.id) {
              setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
            } else {
              setSortBy(option.id);
              setSortOrder('desc');
            }
            setSortAnchor(null);
          }}
        >
          <ListItemText primary={option.label} />
          {sortBy === option.id && (
            <Typography variant="caption" color="text.secondary" sx={{ ml: 1 }}>
              {sortOrder === 'asc' ? '↑' : '↓'}
            </Typography>
          )}
        </MenuItem>
      ))}
    </Menu>
  );

  // Render group menu
  const renderGroupMenu = () => (
    <Menu
      anchorEl={groupAnchor}
      open={Boolean(groupAnchor)}
      onClose={() => setGroupAnchor(null)}
    >
      {GROUP_BY_OPTIONS.map(option => (
        <MenuItem
          key={option.id || 'none'}
          selected={groupBy === option.id}
          onClick={() => {
            setGroupBy(option.id);
            setGroupAnchor(null);
          }}
        >
          {option.label}
        </MenuItem>
      ))}
    </Menu>
  );

  // Render saved views menu
  const renderSavedViewsMenu = () => (
    <Popover
      open={Boolean(savedViewsAnchor)}
      anchorEl={savedViewsAnchor}
      onClose={() => setSavedViewsAnchor(null)}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      PaperProps={{ sx: { width: 280, p: 1 } }}
    >
      <Box sx={{ p: 1 }}>
        <Typography variant="subtitle2" fontWeight={600}>Saved Views</Typography>
      </Box>
      <Divider />
      <List dense>
        {savedViews.length === 0 ? (
          <ListItem>
            <ListItemText primary="No saved views" secondary="Save the current view to access it later" />
          </ListItem>
        ) : (
          savedViews.map(view => (
            <ListItem
              key={view.id}
              secondaryAction={
                <IconButton size="small" onClick={() => handleDeleteView(view.id)}>
                  <DeleteIcon fontSize="small" />
                </IconButton>
              }
              disablePadding
            >
              <ListItemButton
                selected={activeView?.id === view.id}
                onClick={() => handleApplyView(view)}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {view.visibility === 'personal' && <PersonIcon fontSize="small" />}
                  {view.visibility === 'team' && <PeopleIcon fontSize="small" />}
                  {view.visibility === 'organization' && <BusinessIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText
                  primary={view.name}
                  secondary={view.visibility}
                  primaryTypographyProps={{ variant: 'body2' }}
                  secondaryTypographyProps={{ variant: 'caption' }}
                />
              </ListItemButton>
            </ListItem>
          ))
        )}
      </List>
      <Divider />
      <Box sx={{ p: 1 }}>
        <Button
          fullWidth
          size="small"
          startIcon={<SaveIcon />}
          onClick={() => {
            setSavedViewsAnchor(null);
            setShowSaveViewDialog(true);
          }}
        >
          Save Current View
        </Button>
      </Box>
    </Popover>
  );

  
  // Render bulk actions menu
  const renderBulkActionsMenu = () => (
    <Menu
      anchorEl={bulkActionAnchor}
      open={Boolean(bulkActionAnchor)}
      onClose={handleCloseBulkMenu}
      PaperProps={{ sx: { width: 360, maxWidth: 'calc(100vw - 32px)' } }}
    >
      <MenuItem disabled>
        <Typography variant="caption">{selectedTasks.length} tasks selected</Typography>
      </MenuItem>
      <Divider />
      <MenuItem
        disableRipple
        disableTouchRipple
        sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 1, px: 2, py: 1.5 }}
      >
        <Typography variant="body2">Change Stage</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {BULK_STAGE_OPTIONS.map((s) => (
            <Chip key={s} label={s} size="small" onClick={() => handleBulkUpdate({ stage: s })} />
          ))}
        </Box>
      </MenuItem>
      <MenuItem
        disableRipple
        disableTouchRipple
        sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 1, px: 2, py: 1.5 }}
      >
        <Typography variant="body2">Change Priority</Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
          {PRIORITY_OPTIONS.map((p) => (
            <Chip key={p} label={p} size="small" onClick={() => handleBulkUpdate({ priority: p })} />
          ))}
        </Box>
      </MenuItem>
      <MenuItem
        disableRipple
        disableTouchRipple
        sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 1, px: 2, py: 1.5 }}
      >
        <Typography variant="body2">Set Due Date</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="date"
            size="small"
            label="Due Date"
            value={bulkDueDate}
            onChange={(e) => setBulkDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
          />
          <Button size="small" variant="outlined" onClick={applyBulkDueDate} disabled={!bulkDueDate}>
            Apply
          </Button>
        </Box>
      </MenuItem>
      <MenuItem
        disableRipple
        disableTouchRipple
        sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 1, px: 2, py: 1.5 }}
      >
        <Typography variant="body2">Set Target Date</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TextField
            type="date"
            size="small"
            label="Target Date"
            value={bulkTargetDate}
            onChange={(e) => setBulkTargetDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: 170 }}
          />
          <Button size="small" variant="outlined" onClick={applyBulkTargetDate} disabled={!bulkTargetDate}>
            Apply
          </Button>
        </Box>
      </MenuItem>
      <MenuItem
        disableRipple
        disableTouchRipple
        sx={{ alignItems: 'flex-start', flexDirection: 'column', gap: 1, px: 2, py: 1.5 }}
      >
        <Typography variant="body2">Set Assignee</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <FormControl size="small" sx={{ minWidth: 200 }}>
            <Select
              value={bulkAssigneeId}
              onChange={(e) => setBulkAssigneeId(e.target.value)}
              displayEmpty
            >
              <MenuItem value="">
                <Typography variant="body2" color="text.secondary">Select assignee</Typography>
              </MenuItem>
              <MenuItem value="unassigned">Unassigned</MenuItem>
              {workspaceMembers.map((member) => (
                <MenuItem key={member.id} value={String(member.id)}>
                  {getMemberLabel(member)}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <Button size="small" variant="outlined" onClick={applyBulkAssignee} disabled={bulkAssigneeId === ''}>
            Apply
          </Button>
        </Box>
      </MenuItem>
    </Menu>
  );

  // Render save view dialog
  const renderSaveViewDialog = () => (
    <Dialog open={showSaveViewDialog} onClose={() => setShowSaveViewDialog(false)} maxWidth="sm" fullWidth>
      <DialogTitle>Save View</DialogTitle>
      <DialogContent>
        <TextField
          autoFocus
          label="View Name"
          fullWidth
          value={newViewName}
          onChange={(e) => setNewViewName(e.target.value)}
          sx={{ mt: 1, mb: 2 }}
        />
        <FormControl fullWidth>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>Visibility</Typography>
          <Select
            value={newViewVisibility}
            onChange={(e) => setNewViewVisibility(e.target.value)}
            size="small"
          >
            <MenuItem value="personal">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PersonIcon fontSize="small" />
                Personal - Only you can see
              </Box>
            </MenuItem>
            <MenuItem value="team">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <PeopleIcon fontSize="small" />
                Team - Workspace members
              </Box>
            </MenuItem>
            <MenuItem value="organization">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon fontSize="small" />
                Organization - Everyone
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowSaveViewDialog(false)}>Cancel</Button>
        <Button onClick={handleSaveView} variant="contained" disabled={!newViewName.trim()}>
          Save View
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <Box sx={{ p: 3, pb: 0 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box>
            <Typography variant="h5" fontWeight={600}>Tasks</Typography>
            <Typography variant="body2" color="text.secondary">
              {total} tasks across {projects.length} projects
            </Typography>
          </Box>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => setShowTaskForm(true)}
              sx={{ bgcolor: '#0f766e', '&:hover': { bgcolor: '#115e59' } }}
            >
              New Task
            </Button>
          </Box>
        </Box>

        {/* Toolbar */}
        <Paper sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
          {/* Search */}
          <TextField
            placeholder="Search tasks..."
            size="small"
            value={filters.search}
            onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" color="action" />
                </InputAdornment>
              ),
              endAdornment: filters.search && (
                <InputAdornment position="end">
                  <IconButton size="small" onClick={() => setFilters(prev => ({ ...prev, search: '' }))}>
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ width: 220 }}
          />

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* View Type Toggle */}
          <ToggleButtonGroup
            value={viewType}
            exclusive
            onChange={(e, val) => val && setViewType(val)}
            size="small"
          >
            {VIEW_TYPES.map(v => (
              <ToggleButton key={v.id} value={v.id}>
                <Tooltip title={v.label}>{v.icon}</Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

          {/* Filters Button */}
          <Button
            size="small"
            startIcon={
              <Badge badgeContent={activeFilterCount} color="primary">
                <FilterListIcon />
              </Badge>
            }
            onClick={(e) => setFilterAnchor(e.currentTarget)}
            color={hasActiveFilters ? 'primary' : 'inherit'}
          >
            Filters
          </Button>

          {/* Sort Button */}
          <Button
            size="small"
            startIcon={<SortIcon />}
            onClick={(e) => setSortAnchor(e.currentTarget)}
          >
            Sort: {SORT_OPTIONS.find(o => o.id === sortBy)?.label}
          </Button>

          {/* Group Button */}
          <Button
            size="small"
            startIcon={<GroupWorkIcon />}
            onClick={(e) => setGroupAnchor(e.currentTarget)}
          >
            Group: {GROUP_BY_OPTIONS.find(o => o.id === groupBy)?.label || 'None'}
          </Button>

          <Box sx={{ flex: 1 }} />

          {/* Saved Views */}
          <Button
            size="small"
            startIcon={activeView ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            onClick={(e) => setSavedViewsAnchor(e.currentTarget)}
          >
            {activeView ? activeView.name : 'Views'}
          </Button>

          {/* Refresh */}
          <IconButton size="small" onClick={fetchTasks}>
            <RefreshIcon />
          </IconButton>
        </Paper>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 1, flexWrap: 'wrap' }}>
            <Typography variant="caption" color="text.secondary">Active filters:</Typography>
            {filters.projects.length > 0 && (
              <Chip
                size="small"
                label={`${filters.projects.length} Projects`}
                onDelete={() => setFilters(prev => ({ ...prev, projects: [] }))}
                icon={<FolderIcon fontSize="small" />}
              />
            )}
            {filters.status.length > 0 && (
              <Chip
                size="small"
                label={filters.status.join(', ')}
                onDelete={() => setFilters(prev => ({ ...prev, status: [] }))}
              />
            )}
            {filters.priority.length > 0 && (
              <Chip
                size="small"
                label={filters.priority.join(', ')}
                onDelete={() => setFilters(prev => ({ ...prev, priority: [] }))}
              />
            )}
            {filters.assignee !== 'all' && (
              <Chip
                size="small"
                label={filters.assignee === 'me' ? 'Assigned to me' : 'Unassigned'}
                onDelete={() => setFilters(prev => ({ ...prev, assignee: 'all' }))}
              />
            )}
            {filters.overdue && (
              <Chip
                size="small"
                label="Overdue"
                color="error"
                onDelete={() => setFilters(prev => ({ ...prev, overdue: false }))}
              />
            )}
            {filters.recurring !== null && (
              <Chip
                size="small"
                label={filters.recurring ? 'Recurring' : 'Non-recurring'}
                onDelete={() => setFilters(prev => ({ ...prev, recurring: null }))}
                icon={<RepeatIcon fontSize="small" />}
              />
            )}
            <Button size="small" onClick={clearFilters}>Clear All</Button>
          </Box>
        )}

        {/* Bulk Actions Bar */}
        {selectedTasks.length > 0 && (
          <Paper sx={{ mt: 1, p: 1, display: 'flex', alignItems: 'center', gap: 2, bgcolor: '#e0f2fe' }}>
            <Typography variant="body2">{selectedTasks.length} tasks selected</Typography>
            <Button size="small" onClick={(e) => setBulkActionAnchor(e.currentTarget)}>
              Bulk Actions
            </Button>
            <Button size="small" onClick={() => setSelectedTasks([])}>
              Clear Selection
            </Button>
          </Paper>
        )}
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: 3, pt: 2 }}>
        {loading && !tasks.length ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ m: 2 }}>{error}</Alert>
        ) : (
          <>
            {viewType === 'table' && (
              <TasksTableView
                tasks={tasks}
                total={total}
                page={page}
                limit={limit}
                groupBy={groupBy}
                groupMetadata={groupMetadata}
                selectedTasks={selectedTasks}
                onSelectTasks={setSelectedTasks}
                onPageChange={setPage}
                onLimitChange={setLimit}
                onTaskClick={handleTaskClick}
                onTaskEdit={handleTaskEdit}
                getTaskIndicators={getTaskIndicators}
                loading={loading}
              />
            )}
            {viewType === 'calendar' && (
              <TasksCalendarView
                tasks={calendarTasks}
                date={calendarDate}
                onDateChange={setCalendarDate}
                onTaskClick={handleTaskClick}
                onTaskUpdate={handleTaskUpdate}
                getTaskIndicators={getTaskIndicators}
              />
            )}
            {viewType === 'board' && (
              <TasksBoardView
                tasks={tasks}
                groupBy={groupBy || 'status'}
                groupMetadata={groupMetadata}
                onTaskClick={handleTaskClick}
                onTaskEdit={handleTaskEdit}
                onTaskDrop={handleBulkUpdate}
                getTaskIndicators={getTaskIndicators}
              />
            )}
          </>
        )}
      </Box>

      {/* Menus and Dialogs */}
      {renderFilterMenu()}
      {renderSortMenu()}
      {renderGroupMenu()}
      {renderSavedViewsMenu()}
      {renderBulkActionsMenu()}
      {renderSaveViewDialog()}

      {/* Task Form Dialog - Need to select project first for new tasks */}
      {showTaskForm && (
        <TaskFormWithProjectSelect
          open={showTaskForm}
          onClose={() => {
            setShowTaskForm(false);
            setEditingTask(null);
            setSelectedProject(null);
          }}
          task={editingTask}
          projects={projects}
          workspace={workspace}
          user={user}
          onSave={handleTaskCreated}
          selectedProject={selectedProject}
          onProjectSelect={setSelectedProject}
        />
      )}

      {/* Snackbar */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={4000}
        onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}
      >
        <Alert severity={snackbar.severity} onClose={() => setSnackbar(prev => ({ ...prev, open: false }))}>
          {snackbar.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default TasksPage;
