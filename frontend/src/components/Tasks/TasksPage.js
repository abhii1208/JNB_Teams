import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
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
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  FormControlLabel,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
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
import ClearIcon from '@mui/icons-material/Clear';
import WarningIcon from '@mui/icons-material/Warning';
import RepeatIcon from '@mui/icons-material/Repeat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import FolderIcon from '@mui/icons-material/Folder';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import BusinessIcon from '@mui/icons-material/Business';
import PersonIcon from '@mui/icons-material/Person';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';

import FileDownloadIcon from '@mui/icons-material/FileDownload';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import InsertLinkIcon from '@mui/icons-material/InsertLink';

import TasksTableView from './TasksTableView';
import TasksCalendarView from './TasksCalendarView';
import TasksBoardView from './TasksBoardView';
import TaskFormWithProjectSelect from './TaskFormWithProjectSelect';
import TaskDetailsDrawer from './TaskDetailsDrawer';
import BulkTaskUploadDialog from './BulkTaskUploadDialog';
import EditColumnsDialog, { DEFAULT_VISIBLE_COLUMNS, DEFAULT_COLUMN_ORDER } from './EditColumnsDialog';
import ShareLinkDialog from '../ShareLinks/ShareLinkDialog';
import ShareLinksManagerDialog from '../ShareLinks/ShareLinksManagerDialog';
import { DEFAULT_SHARE_COLUMNS, SHAREABLE_FIELDS, ADMIN_ONLY_FIELDS } from '../ShareLinks/shareLinkFields';

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
  getFullUserPreferences,
  patchUserPreferences,
} from '../../apiClient';
import { formatShortDateIST } from '../../utils/dateUtils';

const VIEW_TYPES = [
  { id: 'table', label: 'Table', icon: <ViewListIcon /> },
  { id: 'calendar', label: 'Calendar', icon: <CalendarMonthIcon /> },
  { id: 'board', label: 'Board', icon: <ViewKanbanIcon /> },
];

const STATUS_OPTIONS = ['Open', 'In Progress', 'Under Review', 'Completed', 'Closed'];
const BULK_STAGE_OPTIONS = ['Planned', 'In-process', 'Completed', 'On-hold', 'Dropped'];
const PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
const GROUP_BY_OPTIONS = [
  { id: null, label: 'None' },
  { id: 'project', label: 'Project' },
  { id: 'stage', label: 'Stage' },
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
  created_by: [],
  collaborators: [],
  name: '',
  client_name: '',
  notes: '',
  category: '',
  section: '',
  tags: '',
  external_id: '',
  due_date_from: '',
  due_date_to: '',
  no_due_date: false,
  target_date_from: '',
  target_date_to: '',
  no_target_date: false,
  created_date_from: '',
  created_date_to: '',
  estimated_hours_min: '',
  estimated_hours_max: '',
  actual_hours_min: '',
  actual_hours_max: '',
  completion_percentage_min: '',
  completion_percentage_max: '',
  overdue: false,
  recurring: null,
  search: '',
  include_archived: false,
  hideCompleted: true, // Feature 4: Hide completed tasks by default
  dueDateFilter: null, // Feature 7: Auto filter by date label - 'today', 'overdue', 'tomorrow', 'week', 'month'
};

const CUSTOM_COLUMN_IDS = [
  'category',
  'section',
  'estimated_hours',
  'actual_hours',
  'completion_percentage',
  'tags',
  'external_id',
];

const CLIENT_COLUMN_ID = 'client_name';
const CLIENT_COLUMN_AFTER = 'project_name';

const insertColumnAfter = (columns, afterId, newId) => {
  if (columns.includes(newId)) return columns;
  const next = [...columns];
  const index = next.indexOf(afterId);
  if (index === -1) {
    next.push(newId);
  } else {
    next.splice(index + 1, 0, newId);
  }
  return next;
};

const formatDateInput = (date) => {
  if (!(date instanceof Date)) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

function TasksPage({ workspace, user, navigationState, onNavigationConsumed }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  // View state
  const [viewType, setViewType] = useState(isMobile ? 'board' : 'table');
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

  const enabledProjectColumns = useMemo(() => {
    const selectedIds = filters.projects.length
      ? new Set(filters.projects.map((id) => Number(id)))
      : null;
    const relevantProjects = selectedIds
      ? projects.filter((project) => selectedIds.has(Number(project.id)))
      : projects;
    const enabled = {};
    relevantProjects.forEach((project) => {
      CUSTOM_COLUMN_IDS.forEach((columnId) => {
        const key = `enable_${columnId}`;
        if (project?.[key]) enabled[key] = true;
      });
    });
    return enabled;
  }, [projects, filters.projects]);
  
  // Sorting
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  
  // Grouping
  const [groupBy, setGroupBy] = useState(null);
  const effectiveGroupBy = useMemo(() => {
    if (viewType === 'board' && !groupBy) return 'stage';
    return groupBy;
  }, [groupBy, viewType]);
  
  // Column Visibility (Feature 2)
  const [visibleColumns, setVisibleColumns] = useState(DEFAULT_VISIBLE_COLUMNS);
  const [columnOrder, setColumnOrder] = useState(DEFAULT_COLUMN_ORDER);
  const [showEditColumnsDialog, setShowEditColumnsDialog] = useState(false);
  
  // Calendar settings
  const [calendarViewMode, setCalendarViewMode] = useState('month');
  const [calendarDateMode, setCalendarDateMode] = useState('due');
  const [calendarDensity, setCalendarDensity] = useState('comfortable');
  
  // Preferences tracking
  const [preferencesLoaded, setPreferencesLoaded] = useState(false);
  const preferencesDebounceRef = useRef(null);

  useEffect(() => {
    setViewType((current) => {
      if (isMobile && current === 'table') return 'board';
      return current;
    });
  }, [isMobile]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    const enabledIds = CUSTOM_COLUMN_IDS.filter(
      (columnId) => enabledProjectColumns[`enable_${columnId}`]
    );
    if (enabledIds.length === 0) return;

    setVisibleColumns((prev) => {
      const missing = enabledIds.filter((id) => !prev.includes(id));
      return missing.length ? [...prev, ...missing] : prev;
    });

    setColumnOrder((prev) => {
      const missing = enabledIds.filter((id) => !prev.includes(id));
      return missing.length ? [...prev, ...missing] : prev;
    });
  }, [enabledProjectColumns, preferencesLoaded]);

  useEffect(() => {
    if (!preferencesLoaded) return;
    if (columnOrder.includes(CLIENT_COLUMN_ID)) return;

    setColumnOrder((prev) => insertColumnAfter(prev, CLIENT_COLUMN_AFTER, CLIENT_COLUMN_ID));
    setVisibleColumns((prev) => insertColumnAfter(prev, CLIENT_COLUMN_AFTER, CLIENT_COLUMN_ID));
  }, [preferencesLoaded, columnOrder]);

  const shareDefaultColumns = useMemo(() => {
    const shareable = new Set(SHAREABLE_FIELDS.map((field) => field.key));
    const adminOnly = new Set(ADMIN_ONLY_FIELDS);
    const isAdmin = workspace?.role === 'Owner' || workspace?.role === 'Admin';
    const fromVisible = visibleColumns.filter(
      (column) => shareable.has(column) && (isAdmin || !adminOnly.has(column))
    );
    const fallback = DEFAULT_SHARE_COLUMNS.filter((column) => isAdmin || !adminOnly.has(column));
    return fromVisible.length ? fromVisible : fallback;
  }, [visibleColumns, workspace?.role]);
  
  // Saved Views
  const [savedViews, setSavedViews] = useState([]);
  const [activeView, setActiveView] = useState(null);
  const [showSaveViewDialog, setShowSaveViewDialog] = useState(false);
  const [saveViewTarget, setSaveViewTarget] = useState('new'); // 'new' | viewId
  const [saveViewName, setSaveViewName] = useState('');
  const [saveViewVisibility, setSaveViewVisibility] = useState('personal'); // personal | team | org
  const [hasPersistedPreferences, setHasPersistedPreferences] = useState(false);
  const defaultViewAppliedRef = useRef(false);
  
  // UI state
  const [selectedTasks, setSelectedTasks] = useState([]);
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [snackbar, setSnackbar] = useState({ open: false, message: '', severity: 'success' });
  const [showShareLinkDialog, setShowShareLinkDialog] = useState(false);
  const [showLinksManager, setShowLinksManager] = useState(false);
  const [showBulkUploadDialog, setShowBulkUploadDialog] = useState(false);
  
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

  const buildDashboardFilterPatch = useCallback((taskFilter) => {
    if (!taskFilter || !taskFilter.field || !taskFilter.bucket) return null;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dayAfterTomorrow = new Date(today);
    dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
    const day3 = new Date(today);
    day3.setDate(day3.getDate() + 3);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const basePatch = {
      due_date_from: '',
      due_date_to: '',
      target_date_from: '',
      target_date_to: '',
      dueDateFilter: null,
      overdue: false,
      no_due_date: false,
      no_target_date: false,
    };

    if (taskFilter.field === 'due_date') {
      switch (taskFilter.bucket) {
        case 'today':
          return {
            ...basePatch,
            due_date_from: formatDateInput(today),
            due_date_to: formatDateInput(today),
          };
        case 'tomorrow':
          return {
            ...basePatch,
            due_date_from: formatDateInput(tomorrow),
            due_date_to: formatDateInput(tomorrow),
          };
        case 'soon':
          return {
            ...basePatch,
            due_date_from: formatDateInput(dayAfterTomorrow),
            due_date_to: formatDateInput(day3),
          };
        case 'overdue':
          return {
            ...basePatch,
            overdue: true,
          };
        case 'none':
          return {
            ...basePatch,
            no_due_date: true,
          };
        default:
          return null;
      }
    }

    if (taskFilter.field === 'target_date') {
      switch (taskFilter.bucket) {
        case 'today':
          return {
            ...basePatch,
            target_date_from: formatDateInput(today),
            target_date_to: formatDateInput(today),
          };
        case 'tomorrow':
          return {
            ...basePatch,
            target_date_from: formatDateInput(tomorrow),
            target_date_to: formatDateInput(tomorrow),
          };
        case 'soon':
          return {
            ...basePatch,
            target_date_from: formatDateInput(dayAfterTomorrow),
            target_date_to: formatDateInput(day3),
          };
        case 'overdue':
          return {
            ...basePatch,
            target_date_to: formatDateInput(yesterday),
          };
        case 'none':
          return {
            ...basePatch,
            no_target_date: true,
          };
        default:
          return null;
      }
    }

    return null;
  }, []);

  useEffect(() => {
    if (!preferencesLoaded || !navigationState?.taskFilter) return;
    const patch = buildDashboardFilterPatch(navigationState.taskFilter);
    if (patch) {
      setFilters((prev) => ({ ...prev, ...patch }));
      setPage(1);
    }
    if (typeof onNavigationConsumed === 'function') {
      onNavigationConsumed();
    }
  }, [preferencesLoaded, navigationState, buildDashboardFilterPatch, onNavigationConsumed]);

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

  // Load user preferences (Feature 3 - Remember user's last activity)
  useEffect(() => {
    if (!workspace?.id) return;
    
    const loadPreferences = async () => {
      try {
        const res = await getFullUserPreferences(workspace.id);
        if (res.data) {
          const prefs = res.data;
          const hasAnyPrefs = Boolean(
            prefs.last_view_type ||
              prefs.sort_by ||
              prefs.sort_order ||
              (prefs.filters && Object.keys(prefs.filters).length) ||
              (prefs.visible_columns && prefs.visible_columns.length) ||
              (prefs.column_order && prefs.column_order.length) ||
              ((prefs.group_by !== undefined && prefs.group_by !== null) ? true : false) ||
              prefs.page_size ||
              prefs.calendar_view_mode ||
              prefs.calendar_date_mode ||
              prefs.calendar_density
          );
          setHasPersistedPreferences(hasAnyPrefs);
          // Apply view type
          if (prefs.last_view_type) setViewType(prefs.last_view_type);
          // Apply visible columns - add completion_percentage if not present
          if (prefs.visible_columns?.length) {
            const columns = [...prefs.visible_columns];
            // Add completion_percentage before actions if not already present
            if (!columns.includes('completion_percentage') && columns.includes('actions')) {
              const actionsIndex = columns.indexOf('actions');
              columns.splice(actionsIndex, 0, 'completion_percentage');
            } else if (!columns.includes('completion_percentage')) {
              columns.push('completion_percentage');
            }
            setVisibleColumns(columns);
          }
          // Apply column order
          if (prefs.column_order?.length) setColumnOrder(prefs.column_order);
          // Apply filters
          if (prefs.filters) {
            setFilters(prev => ({
              ...prev,
              ...prefs.filters,
              // Ensure arrays are properly handled
              projects: prefs.filters.projects || prev.projects,
              status: prefs.filters.status || prev.status,
              stage: prefs.filters.stage || prev.stage,
              priority: prefs.filters.priority || prev.priority,
            }));
          }
          // Apply sorting
          if (prefs.sort_by) setSortBy(prefs.sort_by);
          if (prefs.sort_order) setSortOrder(prefs.sort_order);
          // Apply grouping
          if (prefs.group_by !== undefined) setGroupBy(prefs.group_by);
          // Apply calendar settings
          if (prefs.calendar_view_mode) setCalendarViewMode(prefs.calendar_view_mode);
          if (prefs.calendar_date_mode) setCalendarDateMode(prefs.calendar_date_mode);
          if (prefs.calendar_density) setCalendarDensity(prefs.calendar_density);
          // Apply page size
          if (prefs.page_size) setLimit(prefs.page_size);
        }
        setPreferencesLoaded(true);
      } catch (err) {
        console.error('Failed to load preferences:', err);
        setPreferencesLoaded(true); // Still mark as loaded so UI can render
      }
    };
    
    loadPreferences();
  }, [workspace?.id]);

  // Save preferences when they change (debounced)
  const savePreferences = useCallback(async () => {
    if (!workspace?.id || !preferencesLoaded) return;
    
    try {
      await patchUserPreferences(workspace.id, {
        last_view_type: viewType,
        visible_columns: visibleColumns,
        column_order: columnOrder,
        filters: {
          projects: filters.projects,
          status: filters.status,
          stage: filters.stage,
          priority: filters.priority,
          assignee: filters.assignee,
          created_by: filters.created_by,
          collaborators: filters.collaborators,
          name: filters.name,
          client_name: filters.client_name,
          notes: filters.notes,
          category: filters.category,
          section: filters.section,
          tags: filters.tags,
          external_id: filters.external_id,
          due_date_from: filters.due_date_from,
          due_date_to: filters.due_date_to,
          no_due_date: filters.no_due_date,
          target_date_from: filters.target_date_from,
          target_date_to: filters.target_date_to,
          no_target_date: filters.no_target_date,
          created_date_from: filters.created_date_from,
          created_date_to: filters.created_date_to,
          estimated_hours_min: filters.estimated_hours_min,
          estimated_hours_max: filters.estimated_hours_max,
          actual_hours_min: filters.actual_hours_min,
          actual_hours_max: filters.actual_hours_max,
          completion_percentage_min: filters.completion_percentage_min,
          completion_percentage_max: filters.completion_percentage_max,
          overdue: filters.overdue,
          recurring: filters.recurring,
          include_archived: filters.include_archived,
          hideCompleted: filters.hideCompleted,
          dueDateFilter: filters.dueDateFilter,
        },
        sort_by: sortBy,
        sort_order: sortOrder,
        group_by: groupBy,
        calendar_view_mode: calendarViewMode,
        calendar_date_mode: calendarDateMode,
        calendar_density: calendarDensity,
        page_size: limit,
        selected_projects: filters.projects,
      });
    } catch (err) {
      console.error('Failed to save preferences:', err);
    }
  }, [workspace?.id, preferencesLoaded, viewType, visibleColumns, columnOrder, filters, sortBy, sortOrder, groupBy, calendarViewMode, calendarDateMode, calendarDensity, limit]);

  // Debounced preferences save
  useEffect(() => {
    if (!preferencesLoaded) return;
    
    // Clear existing timeout
    if (preferencesDebounceRef.current) {
      clearTimeout(preferencesDebounceRef.current);
    }
    
    // Set new timeout to save preferences after 1 second of inactivity
    preferencesDebounceRef.current = setTimeout(() => {
      savePreferences();
    }, 1000);
    
    return () => {
      if (preferencesDebounceRef.current) {
        clearTimeout(preferencesDebounceRef.current);
      }
    };
  }, [savePreferences, preferencesLoaded]);

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
    if (filters.created_by && filters.created_by.length > 0) params.created_by = filters.created_by.join(',');
    if (filters.collaborators && filters.collaborators.length > 0) {
      params.collaborator_ids = filters.collaborators.join(',');
    }
    if (filters.name) params.name = filters.name;
    if (filters.client_name) params.client_name = filters.client_name;
    if (filters.notes) params.notes = filters.notes;
    if (filters.category) params.category = filters.category;
    if (filters.section) params.section = filters.section;
    if (filters.tags) params.tags = filters.tags;
    if (filters.external_id) params.external_id = filters.external_id;
    if (filters.no_due_date) {
      params.no_due_date = 'true';
    } else {
      if (filters.due_date_from) params.due_date_from = filters.due_date_from;
      if (filters.due_date_to) params.due_date_to = filters.due_date_to;
      if (filters.overdue) params.overdue = 'true';
      if (filters.dueDateFilter) params.due_date_filter = filters.dueDateFilter;
    }

    if (filters.no_target_date) {
      params.no_target_date = 'true';
    } else {
      if (filters.target_date_from) params.target_date_from = filters.target_date_from;
      if (filters.target_date_to) params.target_date_to = filters.target_date_to;
    }
    if (filters.created_date_from) params.created_date_from = filters.created_date_from;
    if (filters.created_date_to) params.created_date_to = filters.created_date_to;
    if (filters.estimated_hours_min !== '') params.estimated_hours_min = filters.estimated_hours_min;
    if (filters.estimated_hours_max !== '') params.estimated_hours_max = filters.estimated_hours_max;
    if (filters.actual_hours_min !== '') params.actual_hours_min = filters.actual_hours_min;
    if (filters.actual_hours_max !== '') params.actual_hours_max = filters.actual_hours_max;
    if (filters.completion_percentage_min !== '') {
      params.completion_percentage_min = filters.completion_percentage_min;
    }
    if (filters.completion_percentage_max !== '') {
      params.completion_percentage_max = filters.completion_percentage_max;
    }
    if (filters.recurring !== null) params.recurring = filters.recurring ? 'true' : 'false';
    if (filters.search) params.search = filters.search;
    if (filters.include_archived) params.include_archived = 'true';
    if (groupBy) params.group_by = groupBy;
    // Feature 4: Hide completed tasks
    if (filters.hideCompleted) params.hide_completed = 'true';
    
    return params;
  }, [page, limit, sortBy, sortOrder, filters, groupBy]);

  // Feature 7: Handle date filter click from TasksTableView
  const handleDateFilterClick = useCallback((filterKey) => {
    setFilters(prev => ({
      ...prev,
      dueDateFilter: prev.dueDateFilter === filterKey ? null : filterKey, // Toggle filter
      overdue: filterKey === 'overdue' ? !prev.overdue : false,
      due_date_from: '',
      due_date_to: '',
      no_due_date: false,
    }));
    setPage(1);
  }, []);

  const handleColumnFiltersChange = useCallback((patch) => {
    if (!patch || typeof patch !== 'object') return;
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

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
        include_completed: filters.hideCompleted ? 'false' : 'true',
      };
      if (filters.projects.length > 0) params.projects = filters.projects.join(',');
      if (filters.assignee && filters.assignee !== 'all') params.assignee = filters.assignee;
      
      const res = await getCalendarTasks(workspace.id, params);
      const items = Array.isArray(res.data) ? res.data : [];
      if (filters.assignee && filters.assignee !== 'all') {
        if (filters.assignee === 'unassigned') {
          setCalendarTasks(items.filter((task) => !task.assignee_id));
        } else if (filters.assignee === 'me') {
          if (user?.id) {
            setCalendarTasks(
              items.filter((task) => String(task.assignee_id) === String(user.id))
            );
          } else {
            setCalendarTasks(items);
          }
        } else {
          setCalendarTasks(
            items.filter((task) => String(task.assignee_id) === String(filters.assignee))
          );
        }
      } else {
        setCalendarTasks(items);
      }
    } catch (err) {
      console.error('Failed to fetch calendar tasks:', err);
    }
  }, [workspace?.id, viewType, calendarDate, filters.projects, filters.assignee, filters.hideCompleted, user?.id]);

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
      (filters.created_by && filters.created_by.length > 0) ||
      (filters.collaborators && filters.collaborators.length > 0) ||
      Boolean(filters.name) ||
      Boolean(filters.client_name) ||
      Boolean(filters.notes) ||
      Boolean(filters.category) ||
      Boolean(filters.section) ||
      Boolean(filters.tags) ||
      Boolean(filters.external_id) ||
      Boolean(filters.due_date_from) ||
      Boolean(filters.due_date_to) ||
      filters.no_due_date ||
      Boolean(filters.target_date_from) ||
      Boolean(filters.target_date_to) ||
      filters.no_target_date ||
      Boolean(filters.created_date_from) ||
      Boolean(filters.created_date_to) ||
      filters.estimated_hours_min !== '' ||
      filters.estimated_hours_max !== '' ||
      filters.actual_hours_min !== '' ||
      filters.actual_hours_max !== '' ||
      filters.completion_percentage_min !== '' ||
      filters.completion_percentage_max !== '' ||
      filters.overdue ||
      filters.recurring !== null ||
      filters.search ||
      filters.include_archived ||
      !filters.hideCompleted ||
      filters.dueDateFilter !== null;
  }, [filters]);

  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.projects.length > 0) count++;
    if (filters.status.length > 0) count++;
    if (filters.stage.length > 0) count++;
    if (filters.priority.length > 0) count++;
    if (filters.assignee !== 'all') count++;
    if (filters.created_by && filters.created_by.length > 0) count++;
    if (filters.collaborators && filters.collaborators.length > 0) count++;
    if (filters.name) count++;
    if (filters.client_name) count++;
    if (filters.notes) count++;
    if (filters.category) count++;
    if (filters.section) count++;
    if (filters.tags) count++;
    if (filters.external_id) count++;
    if (filters.due_date_from) count++;
    if (filters.due_date_to) count++;
    if (filters.no_due_date) count++;
    if (filters.target_date_from) count++;
    if (filters.target_date_to) count++;
    if (filters.no_target_date) count++;
    if (filters.created_date_from) count++;
    if (filters.created_date_to) count++;
    if (filters.estimated_hours_min !== '') count++;
    if (filters.estimated_hours_max !== '') count++;
    if (filters.actual_hours_min !== '') count++;
    if (filters.actual_hours_max !== '') count++;
    if (filters.completion_percentage_min !== '') count++;
    if (filters.completion_percentage_max !== '') count++;
    if (filters.overdue) count++;
    if (filters.recurring !== null) count++;
    if (filters.include_archived) count++;
    if (!filters.hideCompleted) count++;
    if (filters.dueDateFilter) count++;
    return count;
  }, [filters]);

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setPage(1);
  };

  // Saved View handlers
  const handleApplyView = useCallback((view) => {
    if (!view.config) return;
    
    const config = view.config;
    setViewType(config.viewType || 'table');
    setFilters({ ...DEFAULT_FILTERS, ...(config.filters || {}) });
    setSortBy(config.sortBy || 'created_at');
    setSortOrder(config.sortOrder || 'desc');
    setGroupBy(config.groupBy || null);
    setActiveView(view);
    setSavedViewsAnchor(null);
    setPage(1);
  }, []);

  useEffect(() => {
    if (viewType !== 'board') return;
    if (groupBy) return;
    setGroupBy('stage');
  }, [viewType, groupBy]);

  useEffect(() => {
    defaultViewAppliedRef.current = false;
    setActiveView(null);
  }, [workspace?.id]);

  useEffect(() => {
    if (!workspace?.id || !preferencesLoaded) return;
    if (!savedViews.length) return;
    if (defaultViewAppliedRef.current) return;
    if (navigationState?.taskFilter) return;
    if (activeView) {
      defaultViewAppliedRef.current = true;
      return;
    }
    if (hasPersistedPreferences) {
      defaultViewAppliedRef.current = true;
      return;
    }

    const defaultView = savedViews.find(
      (view) => Boolean(view.is_default) && Number(view.user_id) === Number(user?.id)
    );

    defaultViewAppliedRef.current = true;
    if (defaultView) handleApplyView(defaultView);
  }, [
    activeView,
    handleApplyView,
    hasPersistedPreferences,
    navigationState?.taskFilter,
    preferencesLoaded,
    savedViews,
    user?.id,
    workspace?.id,
  ]);

  const handleSaveView = async () => {
    const config = {
      viewType,
      filters,
      sortBy,
      sortOrder,
      groupBy,
    };
    
    try {
      if (saveViewTarget === 'new') {
        if (!saveViewName.trim()) return;
        const res = await createSavedView(workspace.id, {
          name: saveViewName.trim(),
          view_type: viewType,
          config,
          visibility: saveViewVisibility,
        });

        setSavedViews(prev => [...prev, res.data]);
        setActiveView(res.data);
        setSnackbar({ open: true, message: 'View saved', severity: 'success' });
      } else {
        const targetId = Number.parseInt(saveViewTarget, 10);
        const payload = {
          config,
          view_type: viewType,
        };

        if (saveViewName.trim()) payload.name = saveViewName.trim();
        if (saveViewVisibility) payload.visibility = saveViewVisibility;

        const res = await updateSavedView(targetId, payload);
        setSavedViews((prev) => prev.map((v) => (v.id === targetId ? res.data : v)));
        setActiveView(res.data);
        setSnackbar({ open: true, message: 'View updated', severity: 'success' });
      }

      setShowSaveViewDialog(false);
    } catch (err) {
      console.error('Failed to save view:', err);
      setSnackbar({ open: true, message: 'Failed to save view', severity: 'error' });
    }
  };

  const openSaveViewDialog = (target = 'new') => {
    const editableViews = savedViews.filter((v) => Number(v.user_id) === Number(user?.id));
    const safeTarget =
      target !== 'new' && editableViews.some((v) => Number(v.id) === Number(target)) ? String(target) : 'new';

    setSaveViewTarget(safeTarget);

    if (safeTarget === 'new') {
      setSaveViewName(activeView?.name ? `${activeView.name} (copy)` : '');
      setSaveViewVisibility('personal');
      return;
    }

    const selected = editableViews.find((v) => String(v.id) === String(safeTarget));
    setSaveViewName(selected?.name || '');
    const vis = selected?.visibility === 'organization' ? 'org' : selected?.visibility;
    setSaveViewVisibility(vis || 'personal');
  };

  const formatViewVisibility = (visibility) => {
    if (visibility === 'personal') return 'Personal';
    if (visibility === 'team') return 'Team';
    if (visibility === 'org' || visibility === 'organization') return 'Org';
    return visibility || '';
  };

  const handleDuplicateView = async (view) => {
    if (!workspace?.id || !view) return;

    const config =
      view.config || {
        viewType,
        filters,
        sortBy,
        sortOrder,
        groupBy,
      };

    try {
      const res = await createSavedView(workspace.id, {
        name: `${view.name || 'View'} (copy)`,
        view_type: view.view_type || config.viewType || viewType,
        config,
        visibility: 'personal',
      });

      setSavedViews((prev) => [...prev, res.data]);
      setActiveView(res.data);
      setSnackbar({ open: true, message: 'View duplicated', severity: 'success' });
    } catch (err) {
      console.error('Failed to duplicate view:', err);
      setSnackbar({ open: true, message: 'Failed to duplicate view', severity: 'error' });
    }
  };

  const handleSetDefaultView = async (view) => {
    if (!view?.id) return;
    if (Number(view.user_id) !== Number(user?.id)) return;

    try {
      const res = await updateSavedView(view.id, { is_default: true });
      setSavedViews((prev) =>
        prev.map((v) => {
          if (Number(v.user_id) === Number(user?.id)) {
            if (Number(v.id) === Number(view.id)) return res.data;
            if (v.is_default) return { ...v, is_default: false };
          }
          return v;
        })
      );
      setSnackbar({ open: true, message: 'Default view updated', severity: 'success' });
    } catch (err) {
      console.error('Failed to set default view:', err);
      setSnackbar({ open: true, message: 'Failed to set default view', severity: 'error' });
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

  // Handle column visibility/order changes from EditColumnsDialog
  const handleSaveColumnSettings = ({ visibleColumns: newVisible, columnOrder: newOrder }) => {
    setVisibleColumns(newVisible);
    setColumnOrder(newOrder);
    setSnackbar({ open: true, message: 'Column settings saved', severity: 'success' });
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

  const getAssigneeFilterLabel = (value) => {
    if (!value || value === 'all') return 'All Assignees';
    if (value === 'me') return 'Assigned to me';
    if (value === 'unassigned') return 'Unassigned';
    const member = workspaceMembers.find((m) => String(m.id) === String(value));
    return member ? getMemberLabel(member) : 'Assignee';
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
    setSelectedTaskId(task.id);
  };

  const handleTaskEdit = (task) => {
    setEditingTask(task);
    setShowTaskForm(true);
  };

  const handleTaskSaved = () => {
    setShowTaskForm(false);
    setEditingTask(null);
    setSelectedTaskId(null);
    if (viewType === 'calendar') {
      fetchCalendarTasks();
    } else {
      fetchTasks();
    }
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

  // Export tasks to CSV
  const handleExport = () => {
    const headers = ['Task', 'Project', 'Client', 'Stage', 'Status', 'Priority', 'Assignee', 'Due Date', 'Target Date', 'Created By', 'Created Date', 'Notes'];
    const csvData = tasks.map(task => [
      task.name || '',
      task.project_name || '',
      task.client_name || '',
      task.stage || '',
      task.status || '',
      task.priority || '',
      task.assignee_name || '',
      task.due_date ? formatShortDateIST(task.due_date) : '',
      task.target_date ? formatShortDateIST(task.target_date) : '',
      task.created_by_name || '',
      task.created_at ? formatShortDateIST(task.created_at) : '',
      (task.notes || '').replace(/"/g, '""')
    ]);
    
    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `tasks_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
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
            displayEmpty
            renderValue={(selected) => getAssigneeFilterLabel(selected)}
          >
            <MenuItem value="all">All Assignees</MenuItem>
            <MenuItem value="me">Assigned to me</MenuItem>
            <MenuItem value="unassigned">Unassigned</MenuItem>
            {workspaceMembers.length > 0 && <Divider sx={{ my: 1 }} />}
            {workspaceMembers.map((member) => (
              <MenuItem key={member.id} value={member.id}>
                {getMemberLabel(member)}
              </MenuItem>
            ))}
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

      {/* Feature 4: Show completed tasks toggle */}
      <Box sx={{ mb: 2 }}>
        <FormControlLabel
          control={
            <Checkbox
              checked={!filters.hideCompleted}
              onChange={(e) => setFilters(prev => ({ ...prev, hideCompleted: !e.target.checked }))}
              size="small"
            />
          }
          label={<Typography variant="body2">Show completed tasks</Typography>}
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
          selected={effectiveGroupBy === option.id}
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
                <Stack direction="row" spacing={0.25} alignItems="center">
                  <Tooltip title={Number(view.user_id) === Number(user?.id) ? 'Set default' : 'Only your views can be default'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={Number(view.user_id) !== Number(user?.id)}
                        onClick={() => handleSetDefaultView(view)}
                      >
                        {view.is_default ? <StarIcon fontSize="small" /> : <StarBorderIcon fontSize="small" />}
                      </IconButton>
                    </span>
                  </Tooltip>
                  <Tooltip title="Duplicate">
                    <IconButton size="small" onClick={() => handleDuplicateView(view)}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title={Number(view.user_id) === Number(user?.id) ? 'Delete' : 'Only your views can be deleted'}>
                    <span>
                      <IconButton
                        size="small"
                        disabled={Number(view.user_id) !== Number(user?.id)}
                        onClick={() => handleDeleteView(view.id)}
                      >
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </span>
                  </Tooltip>
                </Stack>
              }
              disablePadding
            >
              <ListItemButton
                selected={activeView?.id === view.id}
                onClick={() => handleApplyView(view)}
                sx={{ pr: 10 }}
              >
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {view.visibility === 'personal' && <PersonIcon fontSize="small" />}
                  {view.visibility === 'team' && <PeopleIcon fontSize="small" />}
                  {(view.visibility === 'org' || view.visibility === 'organization') && <BusinessIcon fontSize="small" />}
                </ListItemIcon>
                <ListItemText
                  primary={view.name}
                  secondary={formatViewVisibility(view.visibility)}
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
        <Stack direction="row" spacing={1}>
          <Button
            fullWidth
            size="small"
            startIcon={<SaveIcon />}
            onClick={() => {
              setSavedViewsAnchor(null);
              openSaveViewDialog('new');
              setShowSaveViewDialog(true);
            }}
          >
            Save new
          </Button>
          <Button
            fullWidth
            size="small"
            variant="outlined"
            disabled={!activeView || Number(activeView.user_id) !== Number(user?.id)}
            onClick={() => {
              if (!activeView) return;
              setSavedViewsAnchor(null);
              openSaveViewDialog(String(activeView.id));
              setShowSaveViewDialog(true);
            }}
          >
            Update
          </Button>
        </Stack>
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%' }}>
          <TextField
            type="date"
            size="small"
            label="Due Date"
            value={bulkDueDate}
            onChange={(e) => setBulkDueDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: '100%', sm: 170 }, flex: 1 }}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%' }}>
          <TextField
            type="date"
            size="small"
            label="Target Date"
            value={bulkTargetDate}
            onChange={(e) => setBulkTargetDate(e.target.value)}
            InputLabelProps={{ shrink: true }}
            sx={{ minWidth: { xs: '100%', sm: 170 }, flex: 1 }}
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
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', width: '100%' }}>
          <FormControl size="small" sx={{ minWidth: { xs: '100%', sm: 200 }, flex: 1 }}>
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
    <Dialog open={showSaveViewDialog} onClose={() => setShowSaveViewDialog(false)} maxWidth="xs" fullWidth>
      <DialogTitle sx={{ pb: 1 }}>Save view</DialogTitle>
      <DialogContent>
        <FormControl fullWidth size="small" sx={{ mt: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            Save to
          </Typography>
          <Select
            value={saveViewTarget}
            onChange={(e) => {
              const next = e.target.value;
              openSaveViewDialog(next);
            }}
            size="small"
          >
            <MenuItem value="new">New view</MenuItem>
            {savedViews
              .filter((v) => Number(v.user_id) === Number(user?.id))
              .map((v) => (
                <MenuItem key={v.id} value={String(v.id)}>
                  {v.name}
                </MenuItem>
              ))}
          </Select>
        </FormControl>

        <TextField
          autoFocus
          size="small"
          label={saveViewTarget === 'new' ? 'New view name' : 'View name'}
          fullWidth
          value={saveViewName}
          onChange={(e) => setSaveViewName(e.target.value)}
          sx={{ mt: 2, mb: 2 }}
        />
        <FormControl fullWidth size="small">
          <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5 }}>
            Visibility
          </Typography>
          <Select
            value={saveViewVisibility}
            onChange={(e) => setSaveViewVisibility(e.target.value)}
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
            <MenuItem value="org">
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <BusinessIcon fontSize="small" />
                Organization - Everyone
              </Box>
            </MenuItem>
          </Select>
        </FormControl>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setShowSaveViewDialog(false)} size="small">
          Cancel
        </Button>
        <Button
          onClick={handleSaveView}
          variant="contained"
          size="small"
          disabled={saveViewTarget === 'new' ? !saveViewName.trim() : false}
        >
          {saveViewTarget === 'new' ? 'Save' : 'Update'}
        </Button>
      </DialogActions>
    </Dialog>
  );

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
      {/* Header */}
      <Box sx={{ p: { xs: 1.25, sm: 3 }, pb: 0 }}>
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2.1, sm: 2.5 },
            mb: 2,
            borderRadius: { xs: 4, sm: 3 },
            border: '1px solid rgba(148, 163, 184, 0.14)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.98) 0%, rgba(240,249,255,0.95) 100%)',
          }}
        >
          <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', sm: 'center' }, justifyContent: 'space-between', gap: 2, flexDirection: { xs: 'column', sm: 'row' } }}>
            <Box>
              <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#0f766e', mb: 0.75 }}>
                TASK SPACE
              </Typography>
              <Typography variant="h5" fontWeight={700} sx={{ fontSize: { xs: '1.55rem', sm: '2rem' } }}>
                Tasks
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {total} tasks across {projects.length} projects
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: 1, width: { xs: '100%', sm: 'auto' } }}>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={() => setShowTaskForm(true)}
                sx={{ bgcolor: '#0f766e', '&:hover': { bgcolor: '#115e59' }, borderRadius: 3 }}
                fullWidth={isMobile}
              >
                New Task
              </Button>
            </Box>
          </Box>
        </Paper>

        {/* Toolbar */}
        <Paper sx={{ p: { xs: 1.25, sm: 1.5 }, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', borderRadius: 3, border: '1px solid rgba(148, 163, 184, 0.14)' }}>
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
            sx={{
              width: { xs: '100%', sm: 220 },
              flexGrow: { xs: 1, sm: 0 },
              '& .MuiOutlinedInput-root': {
                borderRadius: 3,
              },
            }}
          />

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

          {/* View Type Toggle */}
          <ToggleButtonGroup
            value={viewType}
            exclusive
            onChange={(e, val) => val && setViewType(val)}
            size="small"
            sx={{
              backgroundColor: { xs: '#f8fafc', sm: 'transparent' },
              borderRadius: 3,
              '& .MuiToggleButton-root': {
                px: { xs: 1.2, sm: 1.5 },
              },
            }}
          >
            {VIEW_TYPES.filter((v) => !isMobile || v.id !== 'table').map(v => (
              <ToggleButton key={v.id} value={v.id}>
                <Tooltip title={v.label}>{v.icon}</Tooltip>
              </ToggleButton>
            ))}
          </ToggleButtonGroup>

          <Divider orientation="vertical" flexItem sx={{ mx: 0.5, display: { xs: 'none', sm: 'block' } }} />

          {/* Filters Button */}
          {viewType !== 'table' && (
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
          )}

          {/* Sort Button (hidden in table view; column headers handle sort) */}
          {viewType !== 'table' && (
            <Button
              size="small"
              startIcon={<SortIcon />}
              onClick={(e) => setSortAnchor(e.currentTarget)}
            >
              Sort: {SORT_OPTIONS.find(o => o.id === sortBy)?.label}
            </Button>
          )}

          {/* Group Button */}
          <Button
            size="small"
            startIcon={<GroupWorkIcon />}
            onClick={(e) => setGroupAnchor(e.currentTarget)}
            sx={{ borderRadius: 3 }}
          >
            Group: {GROUP_BY_OPTIONS.find(o => o.id === effectiveGroupBy)?.label || 'None'}
          </Button>

          {/* Edit Columns Button (Feature 2) */}
          {viewType === 'table' && (
            <Tooltip title="Edit visible columns">
              <IconButton
                size="small"
                onClick={() => setShowEditColumnsDialog(true)}
                color={visibleColumns.length !== DEFAULT_VISIBLE_COLUMNS.length ? 'primary' : 'default'}
              >
                <ViewColumnIcon />
              </IconButton>
            </Tooltip>
          )}

          <Box sx={{ flex: 1, minWidth: 0 }} />

          {/* Saved Views */}
          <Button
            size="small"
            startIcon={activeView ? <BookmarkIcon /> : <BookmarkBorderIcon />}
            onClick={(e) => setSavedViewsAnchor(e.currentTarget)}
            sx={{ borderRadius: 3 }}
          >
            {activeView ? activeView.name : 'Views'}
          </Button>

          {/* Refresh */}
          <IconButton size="small" onClick={fetchTasks}>
            <RefreshIcon />
          </IconButton>

          {/* Links Manager */}
          <Tooltip title="Links Manager">
            <IconButton size="small" onClick={() => setShowLinksManager(true)}>
              <InsertLinkIcon />
            </IconButton>
          </Tooltip>

          {/* Export */}
          <Button
            size="small"
            startIcon={<UploadFileIcon />}
            onClick={() => setShowBulkUploadDialog(true)}
            sx={{ borderRadius: 3 }}
          >
            Bulk Upload
          </Button>

          <Button
            size="small"
            startIcon={<FileDownloadIcon />}
            onClick={handleExport}
            sx={{ borderRadius: 3 }}
          >
            Export
          </Button>
        </Paper>

        {/* Active Filters Display */}
        {viewType !== 'table' && hasActiveFilters && (
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
                label={getAssigneeFilterLabel(filters.assignee)}
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

        {/* Bulk Actions moved to table footer */}
      </Box>

      {/* Main Content */}
      <Box sx={{ flex: 1, overflow: 'hidden', p: { xs: 1.25, sm: 3 }, pt: 2, minWidth: 0 }}>
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
                visibleColumns={visibleColumns}
                columnOrder={columnOrder}
                onDateFilterClick={handleDateFilterClick}
                filters={filters}
                onFiltersChange={handleColumnFiltersChange}
                projects={projects}
                workspaceMembers={workspaceMembers}
                statusOptions={STATUS_OPTIONS}
                stageOptions={BULK_STAGE_OPTIONS}
                priorityOptions={PRIORITY_OPTIONS}
                hasActiveFilters={hasActiveFilters}
                activeFilterCount={activeFilterCount}
                onClearFilters={clearFilters}
                onOpenBulkActions={(event) => setBulkActionAnchor(event.currentTarget)}
                onOpenShareLink={() => setShowShareLinkDialog(true)}
                onClearSelection={() => setSelectedTasks([])}
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
                viewMode={calendarViewMode}
                onViewModeChange={setCalendarViewMode}
                dateMode={calendarDateMode}
                onDateModeChange={setCalendarDateMode}
                density={calendarDensity}
                onDensityChange={setCalendarDensity}
              />
            )}
            {viewType === 'board' && (
              <TasksBoardView
                tasks={tasks}
                groupBy={effectiveGroupBy || 'stage'}
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
      {viewType !== 'table' && renderFilterMenu()}
      {viewType !== 'table' && renderSortMenu()}
      {renderGroupMenu()}
      {renderSavedViewsMenu()}
      {renderBulkActionsMenu()}
      {renderSaveViewDialog()}

      {/* Edit Columns Dialog (Feature 2) */}
      <EditColumnsDialog
        open={showEditColumnsDialog}
        onClose={() => setShowEditColumnsDialog(false)}
        visibleColumns={visibleColumns}
        columnOrder={columnOrder}
        onSave={handleSaveColumnSettings}
        enabledProjectColumns={enabledProjectColumns}
      />

      <ShareLinkDialog
        open={showShareLinkDialog}
        onClose={() => setShowShareLinkDialog(false)}
        workspaceId={workspace?.id}
        taskIds={selectedTasks}
        defaultColumns={shareDefaultColumns}
        workspaceRole={workspace?.role}
        onCreated={() => setSnackbar({ open: true, message: 'Share link created', severity: 'success' })}
      />

      <ShareLinksManagerDialog
        open={showLinksManager}
        onClose={() => setShowLinksManager(false)}
        workspaceId={workspace?.id}
      />

      <BulkTaskUploadDialog
        open={showBulkUploadDialog}
        onClose={() => setShowBulkUploadDialog(false)}
        workspaceId={workspace?.id}
        onImported={(count) => {
          setSnackbar({ open: true, message: `${count} tasks imported successfully`, severity: 'success' });
          fetchTasks();
        }}
      />

      {/* Task Form Dialog - Need to select project first for new tasks */}
      <TaskDetailsDrawer
        open={Boolean(selectedTaskId)}
        taskId={selectedTaskId}
        onClose={() => setSelectedTaskId(null)}
        onEdit={(task) => {
          setSelectedTaskId(null);
          setEditingTask(task);
          setShowTaskForm(true);
        }}
        workspaceMembers={workspaceMembers}
        onUpdated={() => {
          if (viewType === 'calendar') {
            fetchCalendarTasks();
          } else {
            fetchTasks();
          }
        }}
      />

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
          onSave={handleTaskSaved}
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
