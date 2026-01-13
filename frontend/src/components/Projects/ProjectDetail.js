import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  Avatar,
  Alert,
  Snackbar,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Menu,
  Fade,
  Collapse,
  Slide,
  InputAdornment,
  Tooltip,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AddIcon from '@mui/icons-material/Add';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewKanbanIcon from '@mui/icons-material/ViewKanban';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TableViewIcon from '@mui/icons-material/TableView';
import FilterListIcon from '@mui/icons-material/FilterList';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import GroupWorkIcon from '@mui/icons-material/GroupWork';
import BarChartIcon from '@mui/icons-material/BarChart';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CloseIcon from '@mui/icons-material/Close';
import TaskForm from '../Tasks/TaskForm';
import { getTasks, createTask, updateTask, deleteTask, updateProject, getProjectMembers, getWorkspaceMembers, addProjectMember, updateProjectMember, removeProjectMember, addTaskCollaborator } from '../../apiClient';
import { formatShortDate } from '../../utils/date';

// member list is loaded from API
const mockTasks = [];

const roleColors = {
  'Owner': { bg: '#d1fae5', text: '#065f46' },
  'Admin': { bg: '#e0e7ff', text: '#3730a3' },
  'Member': { bg: '#f3e8ff', text: '#6b21a8' },
};

const stageColors = {
  'Planned': { bg: '#e0e7ff', text: '#3730a3' },
  'In-process': { bg: '#fef3c7', text: '#92400e' },
  'Completed': { bg: '#d1fae5', text: '#065f46' },
  'Dropped': { bg: '#fee2e2', text: '#991b1b' },
  'On-hold': { bg: '#f3e8ff', text: '#6b21a8' },
};

const statusColors = {
  'Open': { bg: '#fef3c7', text: '#92400e' },
  'Pending Approval': { bg: '#fee2e2', text: '#991b1b' },
  'Closed': { bg: '#e2e8f0', text: '#475569' },
  'Rejected': { bg: '#fee2e2', text: '#991b1b' },
};

// Helper function to generate theme colors based on project color
const getProjectTheme = (projectColor) => {
  const color = projectColor || '#0f766e';
  
  // Convert hex to RGB for generating lighter shades
  const hexToRgb = (hex) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 15, g: 118, b: 110 };
  };
  
  const rgb = hexToRgb(color);
  
  return {
    primary: color,
    primaryLight: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.1)`,
    primaryMedium: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.2)`,
    primaryDark: color,
  };
};

function ProjectDetail({ project, onBack, onSelectTask, workspace, user }) {
  const projectTheme = getProjectTheme(project?.color);
  const [activeTab, setActiveTab] = useState(0);
  const [taskView, setTaskView] = useState('table'); // 'table', 'list', 'board', 'calendar'
  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [taskFormOpen, setTaskFormOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [prefilledStage, setPrefilledStage] = useState(null);
  const [prefilledStatus, setPrefilledStatus] = useState(null);
  
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [calendarDateMode, setCalendarDateMode] = useState('due'); // 'due' or 'target'
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [sortAnchor, setSortAnchor] = useState(null);
  const [groupAnchor, setGroupAnchor] = useState(null);
  const [filterBy, setFilterBy] = useState('all'); // 'all', 'open', 'pending', 'completed'
  const [sortBy, setSortBy] = useState('dueDate'); // 'dueDate', 'name', 'status', 'stage'
  const [groupBy, setGroupBy] = useState('none'); // 'none', 'status', 'stage', 'assignee'
  const [sortColumn, setSortColumn] = useState('due_date'); // Column to sort by
  const [sortDirection, setSortDirection] = useState('asc'); // 'asc' or 'desc'
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [draggedTaskId, setDraggedTaskId] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState(null);
  
  // Advanced filter state
  const [advancedFilters, setAdvancedFilters] = useState({
    name: '',
    assignee: '',
    status: [],
    stage: [],
    priority: [],
    dueDateFrom: null,
    dueDateTo: null,
  });
  const [savedViews, setSavedViews] = useState([]);
  const [currentView, setCurrentView] = useState(null);
  const [viewNameDialog, setViewNameDialog] = useState(false);
  const [newViewName, setNewViewName] = useState('');

  // Load saved views from localStorage
  React.useEffect(() => {
    const saved = localStorage.getItem(`project_${project?.id}_views`);
    if (saved) {
      try {
        setSavedViews(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load saved views:', e);
      }
    }
  }, [project]);

  // Save views to localStorage
  const saveViewsToStorage = (views) => {
    localStorage.setItem(`project_${project?.id}_views`, JSON.stringify(views));
  };

  const handleSaveView = () => {
    if (!newViewName.trim()) return;
    const newView = {
      id: Date.now(),
      name: newViewName,
      filters: { ...advancedFilters },
      sortColumn,
      sortDirection,
      taskView,
    };
    const updatedViews = [...savedViews, newView];
    setSavedViews(updatedViews);
    saveViewsToStorage(updatedViews);
    setCurrentView(newView);
    setViewNameDialog(false);
    setNewViewName('');
  };

  const handleLoadView = (view) => {
    setAdvancedFilters(view.filters);
    setSortColumn(view.sortColumn);
    setSortDirection(view.sortDirection);
    setTaskView(view.taskView);
    setCurrentView(view);
  };

  const handleDeleteView = (viewId) => {
    const updatedViews = savedViews.filter(v => v.id !== viewId);
    setSavedViews(updatedViews);
    saveViewsToStorage(updatedViews);
    if (currentView?.id === viewId) setCurrentView(null);
  };

  // Fetch tasks for the project
  useEffect(() => {
    const fetchTasks = async () => {
      if (!project?.id) return;
      try {
        setLoading(true);
        const response = await getTasks(project.id, showArchived);
        setTasks(response.data);
      } catch (error) {
        console.error('Failed to fetch tasks:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchTasks();
  }, [project, showArchived]);
  const [members, setMembers] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [selectedNewMember, setSelectedNewMember] = useState('');
  const [selectedNewMemberRole, setSelectedNewMemberRole] = useState('Member');
  const [toast, setToast] = useState({ open: false, severity: 'success', message: '' });
  const [memberActionAnchor, setMemberActionAnchor] = useState(null);
  const [memberActionTarget, setMemberActionTarget] = useState(null);
  const [changeRoleOpen, setChangeRoleOpen] = useState(false);
  const [changeRoleValue, setChangeRoleValue] = useState('Member');
  const [projectSettings, setProjectSettings] = useState({
    membersCanCreateTasks: true,
    membersCanCloseTasks: true,
    adminsCanApprove: true,
    onlyOwnerApproves: false,
    requireRejectionReason: true,
    autoCloseAfterDays: 0,
    memberTaskApproval: false,
    adminTaskApproval: true,
    showSettingsToAdmin: true,
    freezeColumns: [],
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  const normalizeProjectSettings = (source) => {
    if (!source) return null;
    const onlyOwnerApproves = source.only_owner_approves ?? false;
    const adminsCanApprove = onlyOwnerApproves ? false : (source.admins_can_approve ?? true);
    let freezeColumns = [];
    if (Array.isArray(source.freeze_columns)) {
      freezeColumns = source.freeze_columns;
    } else if (typeof source.freeze_columns === 'string') {
      try {
        const parsed = JSON.parse(source.freeze_columns);
        if (Array.isArray(parsed)) freezeColumns = parsed;
      } catch (err) {
        // Ignore malformed data and keep defaults.
      }
    }

    return {
      membersCanCreateTasks: source.members_can_create_tasks ?? true,
      membersCanCloseTasks: source.members_can_close_tasks ?? true,
      adminsCanApprove,
      onlyOwnerApproves,
      requireRejectionReason: source.require_rejection_reason ?? true,
      autoCloseAfterDays: Number.isFinite(source.auto_close_after_days) ? source.auto_close_after_days : 0,
      memberTaskApproval: source.member_task_approval ?? false,
      adminTaskApproval: source.admin_task_approval ?? true,
      showSettingsToAdmin: source.show_settings_to_admin ?? true,
      freezeColumns,
    };
  };

  useEffect(() => {
    if (!project?.id) return;
    const normalized = normalizeProjectSettings(project);
    if (normalized) {
      setProjectSettings(normalized);
    }
  }, [project?.id]);

  // Fetch project members
  useEffect(() => {
    const fetchMembers = async () => {
      if (!project?.id) return;
      try {
        const res = await getProjectMembers(project.id);
        setMembers(res.data || []);
      } catch (err) {
        console.error('Failed to fetch project members:', err);
        setMembers([]);
      }
    };

    fetchMembers();
  }, [project]);
  
  // Determine current user's role in this project
  const currentUserMember = members.find(m => m.id === user?.id || m.user_id === user?.id);
  const userRole = currentUserMember?.role || 'member';
  const isProjectOwner = project?.role === 'Owner';
  const canManageMembers = isProjectOwner || project?.role === 'Admin';

  // Fetch workspace members for Add Member dialog
  useEffect(() => {
    const fetchWorkspaceMembers = async () => {
      if (!workspace?.id) return;
      try {
        const res = await getWorkspaceMembers(workspace.id);
        setWorkspaceMembers(res.data || []);
      } catch (err) {
        console.error('Failed to fetch workspace members:', err);
        setWorkspaceMembers([]);
      }
    };

    if (addMemberOpen) fetchWorkspaceMembers();
  }, [workspace, addMemberOpen]);

  const availableWorkspaceMembers = workspaceMembers.filter((wm) => !members.some((m) => m.id === wm.id));

  const showToast = (severity, message) => {
    setToast({ open: true, severity, message });
  };

  const handleSaveSettings = async () => {
    if (!project?.id || settingsSaving) return;
    setSettingsSaving(true);
    try {
      const payload = {
        members_can_create_tasks: projectSettings.membersCanCreateTasks,
        members_can_close_tasks: projectSettings.membersCanCloseTasks,
        admins_can_approve: projectSettings.onlyOwnerApproves ? false : projectSettings.adminsCanApprove,
        only_owner_approves: projectSettings.onlyOwnerApproves,
        require_rejection_reason: projectSettings.requireRejectionReason,
        auto_close_after_days: Number.isFinite(projectSettings.autoCloseAfterDays)
          ? projectSettings.autoCloseAfterDays
          : 0,
        member_task_approval: projectSettings.memberTaskApproval,
        admin_task_approval: projectSettings.adminTaskApproval,
        show_settings_to_admin: projectSettings.showSettingsToAdmin,
        freeze_columns: projectSettings.freezeColumns || [],
      };
      const response = await updateProject(project.id, payload);
      if (response?.data) {
        const normalized = normalizeProjectSettings(response.data);
        if (normalized) setProjectSettings(normalized);
      }
      showToast('success', 'Settings saved');
    } catch (err) {
      console.error('Failed to save project settings:', err);
      showToast('error', 'Failed to save settings. Please try again.');
    } finally {
      setSettingsSaving(false);
    }
  };

  // Handle column sorting
  const handleSort = (column) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column with ascending order
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Sort tasks based on column and direction
  const sortTasks = (tasksToSort) => {
    return [...tasksToSort].sort((a, b) => {
      let aVal = a[sortColumn];
      let bVal = b[sortColumn];
      
      // Handle null/undefined values
      if (aVal === null || aVal === undefined) aVal = '';
      if (bVal === null || bVal === undefined) bVal = '';
      
      // String comparison
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      
      // Number or Date comparison
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  };

  const normalizeDateValue = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    const str = String(value);
    return str.includes('T') ? str.split('T')[0] : str;
  };
  
  // Apply advanced filters to tasks
  const filterTasks = (tasksToFilter) => {
    return tasksToFilter.filter(task => {
      const searchTerm = advancedFilters.name.toLowerCase();
      
      if (!searchTerm) return true;
      
      // Search in task name
      if (task.name?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in assignee
      if (task.assignee_name?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in collaborators
      if (task.collaborators && Array.isArray(task.collaborators)) {
        const collabMatch = task.collaborators.some(collab => {
          const collabName = collab.name || collab.first_name + ' ' + collab.last_name || '';
          return collabName.toLowerCase().includes(searchTerm);
        });
        if (collabMatch) return true;
      }
      
      // Search in stage
      if (task.stage?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in status
      if (task.status?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in priority
      if (task.priority?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in created by
      if (task.created_by_name?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in notes
      if (task.notes?.toLowerCase().includes(searchTerm)) return true;
      
      // Search in dates (month or year)
      const isMonthSearch = /^(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)/i.test(searchTerm);
      const isYearSearch = /^(19|20)\d{2}$/.test(searchTerm);
      
      if (isMonthSearch || isYearSearch) {
        const dates = [
          task.due_date,
          task.target_date,
          task.created_at
        ].filter(Boolean);
        
        for (const dateStr of dates) {
          const date = new Date(dateStr);
          if (isYearSearch && date.getFullYear().toString() === searchTerm) return true;
          if (isMonthSearch) {
            const monthName = date.toLocaleDateString('en-US', { month: 'short' }).toLowerCase();
            if (monthName.startsWith(searchTerm.substring(0, 3))) return true;
          }
        }
      }
      
      return false;
    });
  };
  
  // Get filtered and sorted tasks
  const getProcessedTasks = () => {
    const filtered = filterTasks(tasks);
    const sorted = sortTasks(filtered);
    
    // Apply grouping if enabled
    if (groupBy === 'none') {
      return sorted;
    }
    
    // Group tasks
    const grouped = {};
    sorted.forEach(task => {
      let groupKey;
      if (groupBy === 'status') {
        groupKey = task.status || 'No Status';
      } else if (groupBy === 'stage') {
        groupKey = task.stage || 'No Stage';
      } else if (groupBy === 'assignee') {
        groupKey = task.assignee_name || 'Unassigned';
      }
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = [];
      }
      grouped[groupKey].push(task);
    });
    
    // Return grouped tasks with headers
    const result = [];
    Object.keys(grouped).sort().forEach(groupKey => {
      result.push({ isGroupHeader: true, groupKey, count: grouped[groupKey].length });
      result.push(...grouped[groupKey]);
    });
    
    return result;
  };

  // Helper function to get frozen column styles
  const getFrozenColumnStyle = (columnName, index) => {
    if (!projectSettings.freezeColumns?.includes(columnName)) return {};
    
    const leftOffset = {
      'Task Name': 0,
      'Assignee': projectSettings.freezeColumns.includes('Task Name') ? 240 : 0,
      'Stage': (projectSettings.freezeColumns.includes('Task Name') ? 240 : 0) + 
               (projectSettings.freezeColumns.includes('Assignee') ? 150 : 0),
      'Status': (projectSettings.freezeColumns.includes('Task Name') ? 240 : 0) + 
                (projectSettings.freezeColumns.includes('Assignee') ? 150 : 0) +
                (projectSettings.freezeColumns.includes('Stage') ? 120 : 0),
    };
    
    return {
      position: 'sticky',
      left: leftOffset[columnName] || 0,
      backgroundColor: '#fff',
      zIndex: 100,
      boxShadow: '2px 0 4px rgba(0,0,0,0.05)',
    };
  };

  const hasProjectSettingsPermission = project?.role === 'Owner' || (project?.role === 'Admin' && projectSettings.showSettingsToAdmin);
  const tabList = [
    { key: 'overview', label: 'Overview' },
    { key: 'tasks', label: `Tasks (${tasks.length})` },
    { key: 'members', label: `Members (${members.length})` },
  ];
  if (hasProjectSettingsPermission) tabList.push({ key: 'settings', label: 'Settings' });
  const activeKey = tabList[activeTab]?.key || 'overview';

  const handleOpenTaskForm = (task = null, stage = null, status = null) => {
    // Explicitly set selectedTask to null if task is not provided (new task scenario)
    setSelectedTask(task || null);
    setPrefilledStage(stage);
    setPrefilledStatus(status);
    setTaskFormOpen(true);
  };

  const handleCloseTaskForm = () => {
    setTaskFormOpen(false);
    setSelectedTask(null);
    setPrefilledStage(null);
    setPrefilledStatus(null);
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (selectedTask) {
        // Edit existing task
        const payload = {
          name: taskData.name,
          description: taskData.description,
          assignee_id: taskData.assignee?.id || taskData.assignee_id || null,
          stage: taskData.stage,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.dueDate || taskData.due_date || null,
          target_date: taskData.targetDate || taskData.target_date || null,
          notes: taskData.notes,
        };
        const response = await updateTask(selectedTask.id, payload);
        setTasks(prev => prev.map(t => t.id === selectedTask.id ? response.data : t));
        // Sync collaborators: add any new collaborators selected in the form
        try {
          const existingIds = (selectedTask.collaborators || []).map(c => c.id || c.user_id || c);
          const desiredIds = (taskData.collaborators || []).map(c => c.id || c.user_id || c);
          for (const id of desiredIds) {
            if (!existingIds.includes(id)) {
              try {
                await addTaskCollaborator(selectedTask.id, id);
              } catch (err) {
                console.error('Failed to add collaborator during edit', err);
              }
            }
          }
          // refresh the task list to reflect updated collaborators
          const refreshed = await getTasks(project.id);
          setTasks(refreshed.data || []);
        } catch (err) {
          console.error('Error syncing collaborators on edit', err);
        }
      } else {
        // Add new task
        const payload = {
          name: taskData.name,
          description: taskData.description,
          project_id: project.id,
          assignee_id: taskData.assignee?.id || null,
          stage: taskData.stage,
          status: taskData.status,
          priority: taskData.priority,
          due_date: taskData.dueDate || null,
          target_date: taskData.targetDate || null,
          notes: taskData.notes,
        };
        const response = await createTask(payload);
        const created = response.data;
        // add collaborators if provided
        if (taskData.collaborators && taskData.collaborators.length > 0) {
          for (const coll of taskData.collaborators) {
            try {
              await addTaskCollaborator(created.id, coll.id || coll.user_id || coll);
            } catch (err) {
              // ignore collaborator add errors for now
              console.error('Failed to add collaborator', err);
            }
          }
        }
        // refetch members for display
        const refreshed = await getTasks(project.id);
        setTasks(refreshed.data || []);
      }
      handleCloseTaskForm();
      showToast('success', 'Task saved');
    } catch (error) {
      console.error('Failed to save task:', error);
      showToast('error', 'Failed to save task. Please try again.');
    }
  };

  const handleDeleteTask = async (task) => {
    setTaskToDelete(task);
    setDeleteDialogOpen(true);
  };
  
  const confirmDelete = async () => {
    if (!taskToDelete) return;
    try {
      await deleteTask(taskToDelete.id);
      setTasks(tasks.filter(t => t.id !== taskToDelete.id));
      showToast('success', 'Task deleted successfully');
    } catch (error) {
      console.error('Failed to delete task:', error);
      showToast('error', 'Failed to delete task');
    } finally {
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
    }
  };

  const handleDragStart = (task) => (event) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', String(task.id));
    setDraggedTaskId(task.id);
  };

  const handleDragEnd = () => {
    setDraggedTaskId(null);
    setDragOverStage(null);
  };

  const handleStageDragOver = (stage) => (event) => {
    event.preventDefault();
    if (dragOverStage !== stage) {
      setDragOverStage(stage);
    }
  };

  const handleStageDragLeave = (event) => {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setDragOverStage(null);
    }
  };

  const handleStageDrop = (stage) => async (event) => {
    event.preventDefault();
    const droppedId = event.dataTransfer.getData('text/plain');
    const taskId = droppedId ? Number(droppedId) : draggedTaskId;
    if (!taskId) return;

    const task = tasks.find((t) => t.id === taskId);
    if (!task || task.stage === stage) {
      setDraggedTaskId(null);
      setDragOverStage(null);
      return;
    }

    const previousTasks = tasks;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, stage } : t)));
    setDraggedTaskId(null);
    setDragOverStage(null);

    try {
      await updateTask(taskId, { stage });
      showToast('success', `Moved to ${stage}`);
    } catch (error) {
      console.error('Failed to move task:', error);
      setTasks(previousTasks);
      showToast('error', 'Failed to move task');
    }
  };

  const openTasks = tasks.filter(t => t.status === 'Open');
  const pendingTasks = tasks.filter(t => t.status === 'Pending Approval');
  const closedTasks = tasks.filter(t => t.status === 'Closed');

  const TaskCard = ({ task, draggable = false, onDragStart, onDragEnd, isDragging = false }) => (
    <Card
      elevation={0}
      onClick={() => handleOpenTaskForm(task)}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      sx={{
        border: '1px solid rgba(148, 163, 184, 0.2)',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease, opacity 0.2s ease',
        opacity: isDragging ? 0.6 : 1,
        transform: isDragging ? 'scale(0.98)' : 'scale(1)',
        '&:hover': {
          borderColor: '#0f766e',
          backgroundColor: 'rgba(15, 118, 110, 0.02)',
        },
      }}
    >
      <CardContent sx={{ p: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 2 }}>
          {task.assignee_name || task.assignee_username ? (
            <Avatar sx={{ bgcolor: projectTheme.primary, width: 32, height: 32, fontSize: '0.8rem', fontWeight: 600 }}>
              {(() => {
                const name = task.assignee_name || task.assignee_username || '';
                const parts = name.split(' ').filter(Boolean);
                if (parts.length === 0) return (task.assignee_username || 'U').slice(0,2).toUpperCase();
                return (parts[0][0] || '') + (parts[1]?.[0] || '');
              })()}
            </Avatar>
          ) : (
            <Box sx={{ width: 32, height: 32 }} /> 
          )}
          <Box sx={{ flex: 1, minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
              {task.name}
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip
                label={task.stage}
                size="small"
                sx={{
                  backgroundColor: stageColors[task.stage]?.bg,
                  color: stageColors[task.stage]?.text,
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
              <Chip
                label={task.status}
                size="small"
                sx={{
                  backgroundColor: statusColors[task.status]?.bg,
                  color: statusColors[task.status]?.text,
                  fontWeight: 500,
                  fontSize: '0.7rem',
                  height: 20,
                }}
              />
              <Typography variant="caption" color="text.secondary" sx={{ lineHeight: '20px' }}>
                Due {task.due_date ? formatShortDate(task.due_date) : '-'}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={onBack} sx={{ border: '1px solid rgba(148, 163, 184, 0.3)' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5 }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {project.name}
            </Typography>
            <Chip
              label={project.role}
              size="small"
              sx={{
                backgroundColor: roleColors[project.role]?.bg,
                color: roleColors[project.role]?.text,
                fontWeight: 500,
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {project.workspace}
          </Typography>
        </Box>
        {(project.role === 'Owner' || project.role === 'Admin') && (
          <Button
            variant="outlined"
            startIcon={<SettingsIcon />}
            onClick={() => setActiveTab(Math.max(0, tabList.findIndex(t => t.key === 'settings')))}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Settings
          </Button>
        )}
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenTaskForm()}
          sx={{ textTransform: 'none', borderRadius: 2 }}
        >
          New Task
        </Button>
      </Box>

      {/* Tabs */}
      <Paper
        elevation={0}
        sx={{
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 3,
        }}
      >
          <Tabs
            value={activeTab}
            onChange={(e, v) => setActiveTab(v)}
          sx={{
            px: 3,
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 56,
            },
          }}
        >
            {tabList.map((t) => (
              <Tab key={t.key} label={t.label} />
            ))}
        </Tabs>

        <Box sx={{ p: 3 }}>
            {/* Overview Tab */}
            {activeKey === 'overview' && (
            <Fade in timeout={300}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
                  Project Statistics
                </Typography>
                
                {/* Stats Cards */}
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ 
                      p: 2.5, 
                      border: '1px solid rgba(148, 163, 184, 0.2)', 
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 4px 12px rgba(15, 118, 110, 0.15)',
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f59e0b',
                          }}
                        >
                          <TaskAltIcon />
                        </Box>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {openTasks.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Open Tasks
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ 
                      p: 2.5, 
                      border: '1px solid rgba(148, 163, 184, 0.2)', 
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 4px 12px rgba(239, 68, 68, 0.15)',
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            backgroundColor: 'rgba(239, 68, 68, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#ef4444',
                          }}
                        >
                          <PendingActionsIcon />
                        </Box>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {pendingTasks.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Pending Approval
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ 
                      p: 2.5, 
                      border: '1px solid rgba(148, 163, 184, 0.2)', 
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 4px 12px rgba(15, 118, 110, 0.15)',
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 40,
                            height: 40,
                            borderRadius: 2,
                            backgroundColor: 'rgba(15, 118, 110, 0.1)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#0f766e',
                          }}
                        >
                          <CheckCircleIcon />
                        </Box>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {closedTasks.length}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Completed
                          </Typography>
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                  <Grid item xs={12} sm={6} md={3}>
                    <Paper elevation={0} sx={{ 
                      p: 2.5, 
                      border: '1px solid rgba(148, 163, 184, 0.2)', 
                      borderRadius: 2,
                      transition: 'all 0.3s ease',
                      '&:hover': {
                        transform: 'translateY(-4px)',
                        boxShadow: '0 4px 12px rgba(124, 58, 237, 0.15)',
                      }
                    }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box>
                          <Typography variant="h5" sx={{ fontWeight: 700 }}>
                            {Math.round((project.completedTasks / project.taskCount) * 100)}%
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Progress
                          </Typography>
                        </Box>
                        <Box
                          sx={{
                            ml: 'auto',
                            height: 8,
                            flex: 1,
                            backgroundColor: 'rgba(148, 163, 184, 0.2)',
                            borderRadius: 4,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: `${(project.completedTasks / project.taskCount) * 100}%`,
                              backgroundColor: '#0f766e',
                              borderRadius: 4,
                              transition: 'width 0.5s ease',
                            }}
                          />
                        </Box>
                      </Box>
                    </Paper>
                  </Grid>
                </Grid>

                {/* Additional Charts/Stats can go here */}
                <Paper elevation={0} sx={{ 
                  mt: 3, 
                  p: 3, 
                  border: '1px solid rgba(148, 163, 184, 0.2)', 
                  borderRadius: 2 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BarChartIcon sx={{ color: '#0f766e' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Task Distribution by Stage
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {Object.entries(stageColors).map(([stage, colors]) => {
                      const count = tasks.filter(t => t.stage === stage).length;
                      const percentage = tasks.length > 0 ? (count / tasks.length) * 100 : 0;
                      return (
                        <Grid item xs={12} key={stage}>
                          <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {stage}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {count} ({Math.round(percentage)}%)
                              </Typography>
                            </Box>
                            <Box sx={{ 
                              height: 8, 
                              backgroundColor: 'rgba(148, 163, 184, 0.1)', 
                              borderRadius: 4,
                              overflow: 'hidden'
                            }}>
                              <Box sx={{ 
                                height: '100%', 
                                width: `${percentage}%`, 
                                backgroundColor: colors.text,
                                borderRadius: 4,
                                transition: 'width 0.5s ease'
                              }} />
                            </Box>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>
                
                {/* Status Distribution Chart */}
                <Paper elevation={0} sx={{ 
                  mt: 3, 
                  p: 3, 
                  border: '1px solid rgba(148, 163, 184, 0.2)', 
                  borderRadius: 2 
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                    <BarChartIcon sx={{ color: '#0f766e' }} />
                    <Typography variant="h6" sx={{ fontWeight: 600 }}>
                      Task Distribution by Status
                    </Typography>
                  </Box>
                  <Grid container spacing={2}>
                    {Object.entries(statusColors).map(([status, colors]) => {
                      const count = tasks.filter(t => t.status === status).length;
                      const percentage = tasks.length > 0 ? (count / tasks.length) * 100 : 0;
                      return (
                        <Grid item xs={12} key={status}>
                          <Box>
                            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {status}
                              </Typography>
                              <Typography variant="body2" color="text.secondary">
                                {count} ({Math.round(percentage)}%)
                              </Typography>
                            </Box>
                            <Box sx={{ 
                              height: 8, 
                              backgroundColor: 'rgba(148, 163, 184, 0.1)', 
                              borderRadius: 4,
                              overflow: 'hidden'
                            }}>
                              <Box sx={{ 
                                height: '100%', 
                                width: `${percentage}%`, 
                                backgroundColor: colors.text,
                                borderRadius: 4,
                                transition: 'width 0.5s ease'
                              }} />
                            </Box>
                          </Box>
                        </Grid>
                      );
                    })}
                  </Grid>
                </Paper>
              </Box>
            </Fade>
          )}

          {/* Tasks Tab */}
          {activeKey === 'tasks' && (
            <Fade in timeout={300}>
              <Box>
                {/* View Controls */}
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3, gap: 2, flexWrap: 'wrap' }}>
                  {/* Search and Filter Buttons */}
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
                    <TextField
                      size="small"
                      placeholder="Search tasks..."
                      value={advancedFilters.name || ''}
                      onChange={(e) => setAdvancedFilters(prev => ({ ...prev, name: e.target.value }))}
                      InputProps={{
                        startAdornment: (
                          <InputAdornment position="start">
                            <SearchIcon sx={{ color: 'text.secondary', fontSize: 20 }} />
                          </InputAdornment>
                        ),
                      }}
                      sx={{ 
                        minWidth: 250,
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                        }
                      }}
                    />
                    <Button
                      size="small"
                      variant={showArchived ? 'contained' : 'outlined'}
                      onClick={() => setShowArchived(!showArchived)}
                      sx={{ 
                        textTransform: 'none', 
                        borderRadius: 2,
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                      }}
                    >
                      {showArchived ? 'Show Active' : 'Show Archived'}
                    </Button>
                    <Button
                      size="small"
                      startIcon={<GroupWorkIcon />}
                      onClick={(e) => setGroupAnchor(e.currentTarget)}
                      sx={{ 
                        textTransform: 'none', 
                        borderRadius: 2,
                        border: '1px solid rgba(148, 163, 184, 0.3)',
                      }}
                    >
                      Group: {groupBy}
                    </Button>
                    {savedViews.length > 0 && (
                      <Select
                        size="small"
                        value={currentView?.id || ''}
                        onChange={(e) => {
                          const view = savedViews.find(v => v.id === e.target.value);
                          if (view) handleLoadView(view);
                        }}
                        displayEmpty
                        sx={{ minWidth: 150 }}
                      >
                        <MenuItem value="">
                          <em>Select View</em>
                        </MenuItem>
                        {savedViews.map(view => (
                          <MenuItem key={view.id} value={view.id}>
                            {view.name}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                    <Button
                      size="small"
                      variant="outlined"
                      onClick={() => setViewNameDialog(true)}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Save View
                    </Button>
                  </Box>

                  {/* View Tabs */}
                  <Tabs
                    value={taskView}
                    onChange={(e, newView) => setTaskView(newView)}
                    sx={{
                      minHeight: 'auto',
                      '& .MuiTab-root': {
                        minHeight: 40,
                        minWidth: 'auto',
                        px: 2,
                        py: 1,
                        textTransform: 'none',
                        fontSize: '0.875rem',
                      },
                      '& .MuiTabs-indicator': {
                        backgroundColor: '#0f766e',
                      },
                    }}
                  >
                    <Tab 
                      value="table" 
                      icon={<TableViewIcon sx={{ fontSize: 18 }} />} 
                      iconPosition="start" 
                      label="Table" 
                    />
                    <Tab 
                      value="list" 
                      icon={<ViewListIcon sx={{ fontSize: 18 }} />} 
                      iconPosition="start" 
                      label="List" 
                    />
                    <Tab 
                      value="board" 
                      icon={<ViewKanbanIcon sx={{ fontSize: 18 }} />} 
                      iconPosition="start" 
                      label="Board" 
                    />
                    <Tab 
                      value="calendar" 
                      icon={<CalendarMonthIcon sx={{ fontSize: 18 }} />} 
                      iconPosition="start" 
                      label="Calendar" 
                    />
                  </Tabs>
                </Box>

                {/* Advanced Filter Dialog */}
                <Dialog
                  open={Boolean(filterAnchor)}
                  onClose={() => setFilterAnchor(null)}
                  maxWidth="md"
                  fullWidth
                >
                  <DialogTitle>
                    Advanced Filters
                    <IconButton
                      onClick={() => setFilterAnchor(null)}
                      sx={{ position: 'absolute', right: 8, top: 8 }}
                    >
                      <CloseIcon />
                    </IconButton>
                  </DialogTitle>
                  <DialogContent dividers>
                    <Grid container spacing={2}>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Task Name"
                          value={advancedFilters.name}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, name: e.target.value }))}
                          placeholder="Search by name..."
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <TextField
                          fullWidth
                          label="Assignee"
                          value={advancedFilters.assignee}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, assignee: e.target.value }))}
                          placeholder="Search by assignee..."
                        />
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Status</InputLabel>
                          <Select
                            multiple
                            value={advancedFilters.status}
                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, status: e.target.value }))}
                            renderValue={(selected) => selected.join(', ')}
                          >
                            <MenuItem value="Open">Open</MenuItem>
                            <MenuItem value="Pending Approval">Pending Approval</MenuItem>
                            <MenuItem value="Closed">Closed</MenuItem>
                            <MenuItem value="Rejected">Rejected</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Stage</InputLabel>
                          <Select
                            multiple
                            value={advancedFilters.stage}
                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, stage: e.target.value }))}
                            renderValue={(selected) => selected.join(', ')}
                          >
                            <MenuItem value="Planned">Planned</MenuItem>
                            <MenuItem value="In-process">In-process</MenuItem>
                            <MenuItem value="Completed">Completed</MenuItem>
                            <MenuItem value="On-hold">On-hold</MenuItem>
                            <MenuItem value="Dropped">Dropped</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={6}>
                        <FormControl fullWidth>
                          <InputLabel>Priority</InputLabel>
                          <Select
                            multiple
                            value={advancedFilters.priority}
                            onChange={(e) => setAdvancedFilters(prev => ({ ...prev, priority: e.target.value }))}
                            renderValue={(selected) => selected.join(', ')}
                          >
                            <MenuItem value="Low">Low</MenuItem>
                            <MenuItem value="Medium">Medium</MenuItem>
                            <MenuItem value="High">High</MenuItem>
                            <MenuItem value="Critical">Critical</MenuItem>
                          </Select>
                        </FormControl>
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          type="date"
                          label="Due Date From"
                          value={advancedFilters.dueDateFrom || ''}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dueDateFrom: e.target.value }))}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                      <Grid item xs={12} md={3}>
                        <TextField
                          fullWidth
                          type="date"
                          label="Due Date To"
                          value={advancedFilters.dueDateTo || ''}
                          onChange={(e) => setAdvancedFilters(prev => ({ ...prev, dueDateTo: e.target.value }))}
                          InputLabelProps={{ shrink: true }}
                        />
                      </Grid>
                    </Grid>
                  </DialogContent>
                  <DialogActions>
                    <Button
                      onClick={() => {
                        setAdvancedFilters({
                          name: '',
                          assignee: '',
                          status: [],
                          stage: [],
                          priority: [],
                          dueDateFrom: null,
                          dueDateTo: null,
                        });
                      }}
                    >
                      Clear All
                    </Button>
                    <Button onClick={() => setFilterAnchor(null)} variant="contained">
                      Apply Filters
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* Save View Dialog */}
                <Dialog open={viewNameDialog} onClose={() => setViewNameDialog(false)}>
                  <DialogTitle>Save Current View</DialogTitle>
                  <DialogContent>
                    <TextField
                      autoFocus
                      margin="dense"
                      label="View Name"
                      fullWidth
                      value={newViewName}
                      onChange={(e) => setNewViewName(e.target.value)}
                      onKeyPress={(e) => {
                        if (e.key === 'Enter') {
                          handleSaveView();
                        }
                      }}
                    />
                    {savedViews.length > 0 && (
                      <Box sx={{ mt: 2 }}>
                        <Typography variant="caption" color="text.secondary">
                          Saved Views:
                        </Typography>
                        <List dense>
                          {savedViews.map(view => (
                            <ListItem
                              key={view.id}
                              secondaryAction={
                                <IconButton edge="end" size="small" onClick={() => handleDeleteView(view.id)}>
                                  <CloseIcon fontSize="small" />
                                </IconButton>
                              }
                            >
                              <ListItemText primary={view.name} />
                            </ListItem>
                          ))}
                        </List>
                      </Box>
                    )}
                  </DialogContent>
                  <DialogActions>
                    <Button onClick={() => { setViewNameDialog(false); setNewViewName(''); }}>
                      Cancel
                    </Button>
                    <Button onClick={handleSaveView} variant="contained" disabled={!newViewName.trim()}>
                      Save
                    </Button>
                  </DialogActions>
                </Dialog>

                {/* Filter Menu (kept for legacy) */}
                <Menu
                  anchorEl={null}
                  open={false}
                  onClose={() => setFilterAnchor(null)}
                  TransitionComponent={Fade}
                >
                  <MenuItem onClick={() => { setFilterBy('all'); setFilterAnchor(null); }}>All Tasks</MenuItem>
                  <MenuItem onClick={() => { setFilterBy('open'); setFilterAnchor(null); }}>Open Only</MenuItem>
                  <MenuItem onClick={() => { setFilterBy('pending'); setFilterAnchor(null); }}>Pending Approval</MenuItem>
                  <MenuItem onClick={() => { setFilterBy('completed'); setFilterAnchor(null); }}>Completed</MenuItem>
                </Menu>

                {/* Sort Menu */}
                <Menu
                  anchorEl={sortAnchor}
                  open={Boolean(sortAnchor)}
                  onClose={() => setSortAnchor(null)}
                  TransitionComponent={Fade}
                >
                  <MenuItem onClick={() => { setSortBy('dueDate'); setSortAnchor(null); }}>Due Date</MenuItem>
                  <MenuItem onClick={() => { setSortBy('name'); setSortAnchor(null); }}>Name</MenuItem>
                  <MenuItem onClick={() => { setSortBy('status'); setSortAnchor(null); }}>Status</MenuItem>
                  <MenuItem onClick={() => { setSortBy('stage'); setSortAnchor(null); }}>Stage</MenuItem>
                </Menu>

                {/* Group Menu */}
                <Menu
                  anchorEl={groupAnchor}
                  open={Boolean(groupAnchor)}
                  onClose={() => setGroupAnchor(null)}
                  TransitionComponent={Fade}
                >
                  <MenuItem onClick={() => { setGroupBy('none'); setGroupAnchor(null); }}>No Grouping</MenuItem>
                  <MenuItem onClick={() => { setGroupBy('status'); setGroupAnchor(null); }}>By Status</MenuItem>
                  <MenuItem onClick={() => { setGroupBy('stage'); setGroupAnchor(null); }}>By Stage</MenuItem>
                  <MenuItem onClick={() => { setGroupBy('assignee'); setGroupAnchor(null); }}>By Assignee</MenuItem>
                </Menu>

                {/* Table View */}
                {taskView === 'table' && (
                  <Fade in timeout={300}>
                    <TableContainer component={Paper} elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2, overflowX: 'auto' }}>
                      <Table sx={{ minWidth: 1200 }}>
                        <TableHead>
                          <TableRow sx={{ backgroundColor: projectTheme.primaryLight }}>
                            <TableCell 
                              sx={{ 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                userSelect: 'none', 
                                width: '24%', 
                                minWidth: '240px',
                                ...getFrozenColumnStyle('Task Name', 0)
                              }}
                              onClick={() => handleSort('name')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                Task Name
                                {sortColumn === 'name' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell 
                              sx={{ 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                ...getFrozenColumnStyle('Assignee', 1)
                              }}
                              onClick={() => handleSort('assignee_name')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                Assignee
                                {sortColumn === 'assignee_name' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Collaborators</TableCell>
                            <TableCell 
                              sx={{ 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                ...getFrozenColumnStyle('Stage', 3)
                              }}
                              onClick={() => handleSort('stage')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                Stage
                                {sortColumn === 'stage' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell 
                              sx={{ 
                                fontWeight: 600, 
                                cursor: 'pointer', 
                                userSelect: 'none',
                                ...getFrozenColumnStyle('Status', 4)
                              }}
                              onClick={() => handleSort('status')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                Status
                                {sortColumn === 'status' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell 
                              sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none' }}
                              onClick={() => handleSort('priority')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                                Priority
                                {sortColumn === 'priority' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell 
                              sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => handleSort('due_date')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                Due Date
                                {sortColumn === 'due_date' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell 
                              sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => handleSort('target_date')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                Target Date
                                {sortColumn === 'target_date' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell 
                              sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => handleSort('created_by_name')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                Created By
                                {sortColumn === 'created_by_name' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell 
                              sx={{ fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                              onClick={() => handleSort('created_at')}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                Created Date
                                {sortColumn === 'created_at' && (
                                  sortDirection === 'asc' ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />
                                )}
                              </Box>
                            </TableCell>
                            <TableCell sx={{ fontWeight: 600 }}>Notes</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {getProcessedTasks().map((item, index) => {
                            // Render group header if grouping is enabled
                            if (item.isGroupHeader) {
                              return (
                                <TableRow key={`group-${item.groupKey}`}>
                                  <TableCell colSpan={11} sx={{ bgcolor: '#f8fafc', py: 1.5 }}>
                                    <Typography variant="subtitle2" sx={{ fontWeight: 700, color: projectTheme.primary }}>
                                      {item.groupKey} ({item.count})
                                    </Typography>
                                  </TableCell>
                                </TableRow>
                              );
                            }

                            const task = item;
                            return (
                              <TableRow
                              key={task.id}
                              onClick={() => handleOpenTaskForm(task)}
                              sx={{ 
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                                '&:hover': { 
                                  backgroundColor: projectTheme.primaryLight,
                                },
                                animation: `slideIn 0.3s ease ${index * 0.05}s both`,
                                '@keyframes slideIn': {
                                  from: {
                                    opacity: 0,
                                    transform: 'translateX(-10px)',
                                  },
                                  to: {
                                    opacity: 1,
                                    transform: 'translateX(0)',
                                  },
                                },
                              }}
                            >
                              <TableCell sx={getFrozenColumnStyle('Task Name', 0)}>
                                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                  {task.name}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ ...getFrozenColumnStyle('Assignee', 1), whiteSpace: 'nowrap' }}>
                                {task.assignee_name || task.assignee_username ? (
                                  <Tooltip title={task.assignee_name || task.assignee_username} arrow placement="top">
                                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer', minWidth: 0, flexWrap: 'nowrap', whiteSpace: 'nowrap' }}>
                                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: projectTheme.primary }}>
                                        {(() => {
                                          const name = task.assignee_name || task.assignee_username || '';
                                          const parts = name.split(' ').filter(Boolean);
                                          if (parts.length === 0) return (task.assignee_username || 'U').slice(0,2).toUpperCase();
                                          return (parts[0][0] || '') + (parts[1]?.[0] || '');
                                        })()}
                                      </Avatar>
                                      <Typography variant="body2" noWrap sx={{ fontSize: '0.875rem' }}>{task.assignee_name || task.assignee_username}</Typography>
                                    </Box>
                                  </Tooltip>
                                ) : (
                                  <Typography variant="body2" noWrap sx={{ fontSize: '0.875rem' }} color="text.secondary">-</Typography>
                                )}
                              </TableCell>
                              <TableCell>
                                <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                                  {task.collaborators && task.collaborators.length > 0 ? (
                                    task.collaborators.map((collab, idx) => {
                                      const collabName = collab.name || (collab.first_name + ' ' + collab.last_name).trim() || 'Unknown';
                                      return (
                                        <Tooltip key={idx} title={collabName} arrow placement="top">
                                          <Avatar sx={{ width: 20, height: 20, fontSize: '0.65rem', bgcolor: '#7c3aed', cursor: 'pointer' }}>
                                            { (collab.name || '').split(' ').map(p=>p[0]).slice(0,2).join('') }
                                          </Avatar>
                                        </Tooltip>
                                      );
                                    })
                                  ) : (
                                    <Typography variant="caption" color="text.secondary">-</Typography>
                                  )}
                                </Box>
                              </TableCell>
                              <TableCell sx={getFrozenColumnStyle('Stage', 3)}>
                                <Chip
                                  label={task.stage}
                                  size="small"
                                  sx={{
                                    backgroundColor: stageColors[task.stage]?.bg,
                                    color: stageColors[task.stage]?.text,
                                    fontWeight: 500,
                                    fontSize: '0.7rem',
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={getFrozenColumnStyle('Status', 4)}>
                                <Chip
                                  label={task.status}
                                  size="small"
                                  sx={{
                                    backgroundColor: statusColors[task.status]?.bg,
                                    color: statusColors[task.status]?.text,
                                    fontWeight: 500,
                                    fontSize: '0.7rem',
                                  }}
                                />
                              </TableCell>
                              <TableCell>
                                <Chip
                                  label={task.priority || 'Medium'}
                                  size="small"
                                  sx={{
                                    backgroundColor: 
                                      task.priority === 'Critical' ? '#fee2e2' :
                                      task.priority === 'High' ? '#fed7aa' :
                                      task.priority === 'Low' ? '#dbeafe' : '#e2e8f0',
                                    color: 
                                      task.priority === 'Critical' ? '#991b1b' :
                                      task.priority === 'High' ? '#c2410c' :
                                      task.priority === 'Low' ? '#1e40af' : '#475569',
                                    fontWeight: 500,
                                    fontSize: '0.7rem',
                                  }}
                                />
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Typography variant="body2" noWrap sx={{ fontSize: '0.875rem' }} color="text.secondary">
                                  {task.due_date ? formatShortDate(task.due_date) : '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Typography variant="body2" noWrap sx={{ fontSize: '0.875rem' }} color="text.secondary">
                                  {task.target_date ? formatShortDate(task.target_date) : '-'}
                                </Typography>
                              </TableCell>
                              <TableCell>
                                <Typography variant="body2" sx={{ fontSize: '0.875rem' }}>
                                  {task.created_by_name || '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ whiteSpace: 'nowrap' }}>
                                <Typography variant="body2" noWrap sx={{ fontSize: '0.875rem' }} color="text.secondary">
                                  {task.created_at ? formatShortDate(task.created_at) : '-'}
                                </Typography>
                              </TableCell>
                              <TableCell sx={{ maxWidth: 200, whiteSpace: 'nowrap' }}>
                                <Typography 
                                  variant="caption" 
                                  color="text.secondary"
                                  noWrap
                                  sx={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {task.notes || 'No notes'}
                                </Typography>
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </TableContainer>
                  </Fade>
                )}

                {/* List View */}
                {taskView === 'list' && (
                  <Fade in timeout={300}>
                    <Box>
                      {pendingTasks.length > 0 && (
                    <>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                        Pending Approval ({pendingTasks.length})
                      </Typography>
                      <Grid container spacing={2} sx={{ mb: 4 }}>
                        {pendingTasks.map(task => (
                          <Grid item xs={12} key={task.id}>
                            <TaskCard task={task} />
                          </Grid>
                        ))}
                      </Grid>
                    </>
                  )}

                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Open Tasks ({openTasks.length})
                  </Typography>
                  <Grid container spacing={2} sx={{ mb: 4 }}>
                    {openTasks.map(task => (
                      <Grid item xs={12} md={6} key={task.id}>
                        <TaskCard task={task} />
                      </Grid>
                    ))}
                  </Grid>

                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2 }}>
                    Completed ({closedTasks.length})
                  </Typography>
                  <Grid container spacing={2}>
                    {closedTasks.map(task => (
                      <Grid item xs={12} md={6} key={task.id}>
                        <TaskCard task={task} />
                      </Grid>
                    ))}
                  </Grid>
                </Box>
              </Fade>
              )}

              {/* Board View (Kanban) */}
              {taskView === 'board' && (
                <Fade in timeout={300}>
                  <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 2 }}>
                  {/* Planned Column */}
                  <Paper
                    elevation={0}
                    onClick={(e) => {
                      if (e.target === e.currentTarget || e.target.closest('.add-task-area')) {
                        handleOpenTaskForm(null, 'Planned', null);
                      }
                    }}
                    onDragOver={handleStageDragOver('Planned')}
                    onDragLeave={handleStageDragLeave}
                    onDrop={handleStageDrop('Planned')}
                    sx={{
                      minWidth: 300,
                      flex: 1,
                      backgroundColor: 'rgba(224, 231, 255, 0.3)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: 2,
                      p: 2,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                      boxShadow: dragOverStage === 'Planned' ? '0 10px 30px rgba(55, 48, 163, 0.18)' : 'none',
                      transform: dragOverStage === 'Planned' ? 'translateY(-2px)' : 'translateY(0)',
                      '&:hover': {
                        backgroundColor: 'rgba(224, 231, 255, 0.5)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#3730a3',
                          }}
                        />
                        Planned
                      </Typography>
                      <Chip
                        label={tasks.filter(t => t.stage === 'Planned').length}
                        size="small"
                        sx={{
                          backgroundColor: '#e0e7ff',
                          color: '#3730a3',
                          fontWeight: 600,
                          height: 20,
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {tasks
                        .filter(t => t.stage === 'Planned')
                        .map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            draggable
                            onDragStart={handleDragStart(task)}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedTaskId === task.id}
                          />
                        ))}
                      <Box 
                        className="add-task-area"
                        sx={{ 
                          p: 2, 
                          border: '2px dashed rgba(55, 48, 163, 0.3)', 
                          borderRadius: 2,
                          textAlign: 'center',
                          color: '#3730a3',
                          fontSize: '0.875rem',
                          '&:hover': {
                            borderColor: '#3730a3',
                            backgroundColor: 'rgba(224, 231, 255, 0.5)',
                          }
                        }}
                      >
                        + Add Task
                      </Box>
                    </Box>
                  </Paper>

                  {/* In-process Column */}
                  <Paper
                    elevation={0}
                    onClick={(e) => {
                      if (!e.target.closest('.task-card') && !e.target.closest('.add-task-area')) {
                        handleOpenTaskForm(null, 'In-process', null);
                      }
                    }}
                    onDragOver={handleStageDragOver('In-process')}
                    onDragLeave={handleStageDragLeave}
                    onDrop={handleStageDrop('In-process')}
                    sx={{
                      minWidth: 300,
                      flex: 1,
                      backgroundColor: 'rgba(254, 243, 199, 0.3)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: 2,
                      p: 2,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                      boxShadow: dragOverStage === 'In-process' ? '0 10px 30px rgba(146, 64, 14, 0.18)' : 'none',
                      transform: dragOverStage === 'In-process' ? 'translateY(-2px)' : 'translateY(0)',
                      '&:hover': {
                        backgroundColor: 'rgba(254, 243, 199, 0.5)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#92400e',
                          }}
                        />
                        In Process
                      </Typography>
                      <Chip
                        label={tasks.filter(t => t.stage === 'In-process').length}
                        size="small"
                        sx={{
                          backgroundColor: '#fef3c7',
                          color: '#92400e',
                          fontWeight: 600,
                          height: 20,
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {tasks
                        .filter(t => t.stage === 'In-process')
                        .map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            draggable
                            onDragStart={handleDragStart(task)}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedTaskId === task.id}
                          />
                        ))}
                      <Box
                        className="add-task-area"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTaskForm(null, 'In-process', null);
                        }}
                        sx={{
                          border: '2px dashed rgba(148, 163, 184, 0.3)',
                          borderRadius: 2,
                          p: 1.5,
                          textAlign: 'center',
                          color: 'text.secondary',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          mt: 1,
                          '&:hover': {
                            backgroundColor: 'rgba(254, 243, 199, 0.5)',
                            borderColor: 'rgba(148, 163, 184, 0.5)',
                          },
                        }}
                      >
                        + Add Task
                      </Box>
                    </Box>
                  </Paper>

                  {/* Completed Column */}
                  <Paper
                    elevation={0}
                    onClick={(e) => {
                      if (!e.target.closest('.task-card') && !e.target.closest('.add-task-area')) {
                        handleOpenTaskForm(null, 'Completed', null);
                      }
                    }}
                    onDragOver={handleStageDragOver('Completed')}
                    onDragLeave={handleStageDragLeave}
                    onDrop={handleStageDrop('Completed')}
                    sx={{
                      minWidth: 300,
                      flex: 1,
                      backgroundColor: 'rgba(209, 250, 229, 0.3)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: 2,
                      p: 2,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                      boxShadow: dragOverStage === 'Completed' ? '0 10px 30px rgba(6, 95, 70, 0.18)' : 'none',
                      transform: dragOverStage === 'Completed' ? 'translateY(-2px)' : 'translateY(0)',
                      '&:hover': {
                        backgroundColor: 'rgba(209, 250, 229, 0.5)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#065f46',
                          }}
                        />
                        Completed
                      </Typography>
                      <Chip
                        label={tasks.filter(t => t.stage === 'Completed').length}
                        size="small"
                        sx={{
                          backgroundColor: '#d1fae5',
                          color: '#065f46',
                          fontWeight: 600,
                          height: 20,
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {tasks
                        .filter(t => t.stage === 'Completed')
                        .map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            draggable
                            onDragStart={handleDragStart(task)}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedTaskId === task.id}
                          />
                        ))}
                      <Box
                        className="add-task-area"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTaskForm(null, 'Completed', null);
                        }}
                        sx={{
                          border: '2px dashed rgba(148, 163, 184, 0.3)',
                          borderRadius: 2,
                          p: 1.5,
                          textAlign: 'center',
                          color: 'text.secondary',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          mt: 1,
                          '&:hover': {
                            backgroundColor: 'rgba(209, 250, 229, 0.5)',
                            borderColor: 'rgba(148, 163, 184, 0.5)',
                          },
                        }}
                      >
                        + Add Task
                      </Box>
                    </Box>
                  </Paper>

                  {/* On-hold Column */}
                  <Paper
                    elevation={0}
                    onClick={(e) => {
                      if (!e.target.closest('.task-card') && !e.target.closest('.add-task-area')) {
                        handleOpenTaskForm(null, 'On-hold', null);
                      }
                    }}
                    onDragOver={handleStageDragOver('On-hold')}
                    onDragLeave={handleStageDragLeave}
                    onDrop={handleStageDrop('On-hold')}
                    sx={{
                      minWidth: 300,
                      flex: 1,
                      backgroundColor: 'rgba(243, 232, 255, 0.3)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: 2,
                      p: 2,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                      boxShadow: dragOverStage === 'On-hold' ? '0 10px 30px rgba(107, 33, 168, 0.18)' : 'none',
                      transform: dragOverStage === 'On-hold' ? 'translateY(-2px)' : 'translateY(0)',
                      '&:hover': {
                        backgroundColor: 'rgba(243, 232, 255, 0.5)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#6b21a8',
                          }}
                        />
                        On Hold
                      </Typography>
                      <Chip
                        label={tasks.filter(t => t.stage === 'On-hold').length}
                        size="small"
                        sx={{
                          backgroundColor: '#f3e8ff',
                          color: '#6b21a8',
                          fontWeight: 600,
                          height: 20,
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {tasks
                        .filter(t => t.stage === 'On-hold')
                        .map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            draggable
                            onDragStart={handleDragStart(task)}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedTaskId === task.id}
                          />
                        ))}
                      <Box
                        className="add-task-area"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTaskForm(null, 'On-hold', null);
                        }}
                        sx={{
                          border: '2px dashed rgba(148, 163, 184, 0.3)',
                          borderRadius: 2,
                          p: 1.5,
                          textAlign: 'center',
                          color: 'text.secondary',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          mt: 1,
                          '&:hover': {
                            backgroundColor: 'rgba(243, 232, 255, 0.5)',
                            borderColor: 'rgba(148, 163, 184, 0.5)',
                          },
                        }}
                      >
                        + Add Task
                      </Box>
                    </Box>
                  </Paper>

                  {/* Dropped Column */}
                  <Paper
                    elevation={0}
                    onClick={(e) => {
                      if (!e.target.closest('.task-card') && !e.target.closest('.add-task-area')) {
                        handleOpenTaskForm(null, 'Dropped', null);
                      }
                    }}
                    onDragOver={handleStageDragOver('Dropped')}
                    onDragLeave={handleStageDragLeave}
                    onDrop={handleStageDrop('Dropped')}
                    sx={{
                      minWidth: 300,
                      flex: 1,
                      backgroundColor: 'rgba(254, 226, 226, 0.3)',
                      border: '1px solid rgba(148, 163, 184, 0.2)',
                      borderRadius: 2,
                      p: 2,
                      cursor: 'pointer',
                      transition: 'background-color 0.2s ease, box-shadow 0.2s ease, transform 0.2s ease',
                      boxShadow: dragOverStage === 'Dropped' ? '0 10px 30px rgba(153, 27, 27, 0.18)' : 'none',
                      transform: dragOverStage === 'Dropped' ? 'translateY(-2px)' : 'translateY(0)',
                      '&:hover': {
                        backgroundColor: 'rgba(254, 226, 226, 0.5)',
                      },
                    }}
                  >
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: '50%',
                            backgroundColor: '#991b1b',
                          }}
                        />
                        Dropped
                      </Typography>
                      <Chip
                        label={tasks.filter(t => t.stage === 'Dropped').length}
                        size="small"
                        sx={{
                          backgroundColor: '#fee2e2',
                          color: '#991b1b',
                          fontWeight: 600,
                          height: 20,
                        }}
                      />
                    </Box>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                      {tasks
                        .filter(t => t.stage === 'Dropped')
                        .map(task => (
                          <TaskCard
                            key={task.id}
                            task={task}
                            draggable
                            onDragStart={handleDragStart(task)}
                            onDragEnd={handleDragEnd}
                            isDragging={draggedTaskId === task.id}
                          />
                        ))}
                      <Box
                        className="add-task-area"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenTaskForm(null, 'Dropped', null);
                        }}
                        sx={{
                          border: '2px dashed rgba(148, 163, 184, 0.3)',
                          borderRadius: 2,
                          p: 1.5,
                          textAlign: 'center',
                          color: 'text.secondary',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          mt: 1,
                          '&:hover': {
                            backgroundColor: 'rgba(254, 226, 226, 0.5)',
                            borderColor: 'rgba(148, 163, 184, 0.5)',
                          },
                        }}
                      >
                        + Add Task
                      </Box>
                    </Box>
                  </Paper>
                </Box>
              </Fade>
              )}

              {/* Calendar View */}
              {taskView === 'calendar' && (
                <Fade in timeout={300}>
                  <Box>
                  {/* Calendar Header */}
                  <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 3 }}>
                    <Typography variant="h4" sx={{ fontWeight: 700, color: '#0f172a' }}>
                      {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                    </Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newMonth = new Date(currentMonth);
                            newMonth.setMonth(newMonth.getMonth() - 1);
                            setCurrentMonth(newMonth);
                          }}
                          sx={{ 
                            bgcolor: '#f8fafc',
                            '&:hover': {
                              bgcolor: '#0f766e',
                              color: '#fff',
                            }
                          }}
                        >
                          <ChevronLeftIcon fontSize="small" />
                        </IconButton>
                        <Button
                          size="small"
                          onClick={() => setCurrentMonth(new Date())}
                          sx={{ 
                            textTransform: 'none', 
                            fontWeight: 600,
                            px: 2,
                            bgcolor: '#f8fafc',
                            color: '#0f172a',
                            '&:hover': {
                              bgcolor: projectTheme.primary,
                              color: '#fff',
                            }
                          }}
                        >
                          Today
                        </Button>
                        <IconButton
                          size="small"
                          onClick={() => {
                            const newMonth = new Date(currentMonth);
                            newMonth.setMonth(newMonth.getMonth() + 1);
                            setCurrentMonth(newMonth);
                          }}
                          sx={{ 
                            bgcolor: '#f8fafc',
                            '&:hover': {
                              bgcolor: '#0f766e',
                              color: '#fff',
                            }
                          }}
                        >
                          <ChevronRightIcon fontSize="small" />
                        </IconButton>
                      </Box>
                      <ToggleButtonGroup
                        exclusive
                        size="small"
                        value={calendarDateMode}
                        onChange={(_event, value) => {
                          if (value) setCalendarDateMode(value);
                        }}
                        sx={{
                          borderRadius: 999,
                          backgroundColor: 'rgba(148, 163, 184, 0.2)',
                          p: 0.25,
                          '& .MuiToggleButton-root': {
                            textTransform: 'none',
                            border: 'none',
                            borderRadius: 999,
                            px: 1.5,
                            py: 0.5,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            color: '#475569',
                            '&.Mui-selected': {
                              backgroundColor: projectTheme.primary,
                              color: '#fff',
                              '&:hover': {
                                backgroundColor: projectTheme.primary,
                              },
                            },
                          },
                        }}
                      >
                        <ToggleButton value="due">Due date</ToggleButton>
                        <ToggleButton value="target">Target date</ToggleButton>
                      </ToggleButtonGroup>
                    </Box>
                  </Box>

                  {/* Calendar Grid - Asana Style */}
                  <Paper
                    elevation={0}
                    sx={{
                      border: '1px solid #e2e8f0',
                      borderRadius: 2,
                      overflow: 'hidden',
                      backgroundColor: '#fff',
                    }}
                  >
                    {/* Weekday Headers */}
                    <Box sx={{ display: 'flex', borderBottom: '2px solid #e2e8f0', bgcolor: '#f8fafc' }}>
                      {['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'].map((day, idx) => (
                        <Box
                          key={day}
                          sx={{
                            flex: 1,
                            p: 1.5,
                            textAlign: 'center',
                            borderRight: idx < 6 ? '1px solid #e2e8f0' : 'none',
                          }}
                        >
                          <Typography variant="caption" sx={{ fontWeight: 700, color: '#64748b', fontSize: '0.75rem' }}>
                            {day}
                          </Typography>
                        </Box>
                      ))}
                    </Box>

                    {/* Calendar Weeks */}
                    {(() => {
                      const year = currentMonth.getFullYear();
                      const month = currentMonth.getMonth();
                      const firstDay = new Date(year, month, 1).getDay();
                      const daysInMonth = new Date(year, month + 1, 0).getDate();
                      const today = new Date();
                      const isCurrentMonth = today.getMonth() === month && today.getFullYear() === year;
                      
                      const weeks = [];
                      let currentWeek = [];
                      
                      // Previous month days
                      const prevMonthDays = new Date(year, month, 0).getDate();
                      for (let i = firstDay - 1; i >= 0; i--) {
                        const day = prevMonthDays - i;
                        currentWeek.push({
                          day,
                          isCurrentMonth: false,
                          isPrevMonth: true,
                          dateStr: null,
                          isToday: false,
                        });
                      }
                      
                      // Current month days
                      for (let day = 1; day <= daysInMonth; day++) {
                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const isToday = isCurrentMonth && today.getDate() === day;
                        
                        currentWeek.push({
                          day,
                          isCurrentMonth: true,
                          isPrevMonth: false,
                          isNextMonth: false,
                          dateStr,
                          isToday,
                        });
                        
                        if (currentWeek.length === 7) {
                          weeks.push([...currentWeek]);
                          currentWeek = [];
                        }
                      }
                      
                      // Next month days
                      if (currentWeek.length > 0) {
                        let nextDay = 1;
                        while (currentWeek.length < 7) {
                          currentWeek.push({
                            day: nextDay++,
                            isCurrentMonth: false,
                            isNextMonth: true,
                            dateStr: null,
                            isToday: false,
                          });
                        }
                        weeks.push([...currentWeek]);
                      }
                      
                      return weeks.map((week, weekIdx) => (
                        <Box
                          key={weekIdx}
                          sx={{
                            display: 'flex',
                            minHeight: 140,
                            borderBottom: weekIdx < weeks.length - 1 ? '1px solid #e2e8f0' : 'none',
                          }}
                        >
                          {week.map((dayInfo, dayIdx) => {
                            const tasksOnDay = dayInfo.dateStr
                              ? tasks.filter((t) => {
                                const value = calendarDateMode === 'target'
                                  ? (t.target_date || t.targetDate)
                                  : (t.due_date || t.dueDate);
                                return normalizeDateValue(value) === dayInfo.dateStr;
                              })
                              : [];
                            
                            return (
                              <Box
                                key={dayIdx}
                                onClick={(e) => {
                                  if (dayInfo.isCurrentMonth && (e.target === e.currentTarget || !e.target.closest('[data-task-chip]'))) {
                                    handleOpenTaskForm(null, null, null);
                                  }
                                }}
                                sx={{
                                  flex: 1,
                                  p: 1.5,
                                  borderRight: dayIdx < 6 ? '1px solid #e2e8f0' : 'none',
                                  backgroundColor: !dayInfo.isCurrentMonth 
                                    ? '#fafafa' 
                                    : dayInfo.isToday 
                                    ? '#f0fdfa' 
                                    : '#fff',
                                  cursor: dayInfo.isCurrentMonth ? 'pointer' : 'default',
                                  position: 'relative',
                                  transition: 'background-color 0.2s ease',
                                  '&:hover': dayInfo.isCurrentMonth ? {
                                    backgroundColor: dayInfo.isToday ? '#ccfbf1' : '#f8fafc',
                                  } : {},
                                }}
                              >
                                {/* Date Number */}
                                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 1 }}>
                                  <Box
                                    sx={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      minWidth: dayInfo.isToday ? 28 : 'auto',
                                      height: dayInfo.isToday ? 28 : 'auto',
                                      borderRadius: '50%',
                                      bgcolor: dayInfo.isToday ? projectTheme.primary : 'transparent',
                                      px: dayInfo.isToday ? 0 : 0.5,
                                    }}
                                  >
                                    <Typography
                                      variant="body2"
                                      sx={{
                                        fontWeight: dayInfo.isToday ? 700 : dayInfo.isCurrentMonth ? 600 : 400,
                                        color: dayInfo.isToday ? '#fff' : dayInfo.isCurrentMonth ? '#0f172a' : '#94a3b8',
                                        fontSize: '0.875rem',
                                      }}
                                    >
                                      {dayInfo.day}
                                    </Typography>
                                  </Box>
                                  {tasksOnDay.length > 0 && (
                                    <Chip
                                      label={tasksOnDay.length}
                                      size="small"
                                      sx={{
                                        height: 20,
                                        fontSize: '0.65rem',
                                        fontWeight: 700,
                                        bgcolor: projectTheme.primary,
                                        color: '#fff',
                                        '& .MuiChip-label': { px: 1 },
                                      }}
                                    />
                                  )}
                                </Box>

                                {/* Tasks */}
                                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
                                  {tasksOnDay.slice(0, 4).map(task => {
                                    const assigneeInitials = task.assignee_name 
                                      ? task.assignee_name.split(' ').map(n => n[0]).join('').toUpperCase()
                                      : '?';
                                    
                                    return (
                                      <Box
                                        key={task.id}
                                        data-task-chip
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenTaskForm(task);
                                        }}
                                        sx={{
                                          p: 1,
                                          borderRadius: 1.5,
                                          backgroundColor: stageColors[task.stage]?.bg || '#f1f5f9',
                                          borderLeft: `3px solid ${stageColors[task.stage]?.text || '#64748b'}`,
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 1,
                                          '&:hover': {
                                            transform: 'translateX(3px)',
                                            boxShadow: '0 2px 8px rgba(15, 118, 110, 0.15)',
                                          },
                                        }}
                                      >
                                        <Avatar
                                          sx={{
                                            width: 20,
                                            height: 20,
                                            fontSize: '0.6rem',
                                            fontWeight: 700,
                                            bgcolor: stageColors[task.stage]?.text || '#64748b',
                                          }}
                                        >
                                          {assigneeInitials}
                                        </Avatar>
                                        <Typography
                                          variant="caption"
                                          sx={{
                                            fontSize: '0.75rem',
                                            fontWeight: 600,
                                            color: stageColors[task.stage]?.text || '#0f172a',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            flex: 1,
                                          }}
                                        >
                                          {task.name}
                                        </Typography>
                                      </Box>
                                    );
                                  })}
                                  {tasksOnDay.length > 4 && (
                                    <Typography
                                      variant="caption"
                                      onClick={() => handleOpenTaskForm(null, null, null)}
                                      sx={{
                                        fontSize: '0.7rem',
                                        color: projectTheme.primary,
                                        fontWeight: 600,
                                        cursor: 'pointer',
                                        pl: 0.5,
                                        '&:hover': {
                                          textDecoration: 'underline',
                                        },
                                      }}
                                    >
                                      +{tasksOnDay.length - 4} more tasks
                                    </Typography>
                                  )}
                                </Box>
                              </Box>
                            );
                          })}
                        </Box>
                      ));
                    })()}
                  </Paper>

                  {/* Calendar Legend */}
                  <Box sx={{ display: 'flex', gap: 4, flexWrap: 'wrap', mt: 3, justifyContent: 'center' }}>
                    {Object.entries(stageColors).map(([stage, colors]) => (
                      <Box key={stage} sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          sx={{
                            width: 18,
                            height: 18,
                            borderRadius: 1,
                            backgroundColor: colors.bg,
                            borderLeft: `4px solid ${colors.text}`,
                          }}
                        />
                        <Typography variant="body2" sx={{ fontWeight: 600, color: '#64748b' }}>
                          {stage}
                        </Typography>
                      </Box>
                    ))}
                  </Box>
                </Box>
              </Fade>
              )}
          </Box>
          </Fade>
          )}

          {/* Members Tab */}
          {activeKey === 'members' && (
            <Fade in timeout={300}>
              <Box>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Project Members ({members.length})</Typography>
                {canManageMembers && (
                  <Button
                    variant="contained"
                    size="small"
                    startIcon={<PersonAddIcon />}
                    onClick={() => setAddMemberOpen(true)}
                    sx={{ textTransform: 'none', borderRadius: 2 }}
                  >
                    Add Member
                  </Button>
                )}
              </Box>

              <List sx={{ mx: -2 }}>
                {members.map((member) => {
                  const name = (member.first_name || '') + (member.last_name ? ' ' + member.last_name : '');
                  const initials = (member.first_name ? member.first_name.charAt(0) : '') + (member.last_name ? member.last_name.charAt(0) : '');
                  const role = member.role || 'Member';
                  const canManageMember = canManageMembers && (isProjectOwner || role !== 'Owner');
                  return (
                  <ListItem
                    key={member.id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: projectTheme.primary, fontWeight: 600 }}>
                        {member.avatar || initials}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={name || member.username || member.email}
                      secondary={member.email}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                    <Chip
                      label={role}
                      size="small"
                      sx={{
                        backgroundColor: roleColors[role]?.bg,
                        color: roleColors[role]?.text,
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        mr: 1,
                      }}
                    />
                    <Box sx={{ width: 32, display: 'flex', justifyContent: 'flex-end' }}>
                      {canManageMember && (
                        <IconButton size="small" onClick={(e) => { setMemberActionAnchor(e.currentTarget); setMemberActionTarget(member); }}>
                          <MoreVertIcon />
                        </IconButton>
                      )}
                    </Box>
                  </ListItem>
                  );
                })}
              </List>
              <Menu
                anchorEl={memberActionAnchor}
                open={Boolean(memberActionAnchor)}
                onClose={() => { setMemberActionAnchor(null); setMemberActionTarget(null); }}
              >
                <MenuItem onClick={() => {
                  setChangeRoleValue(memberActionTarget?.role || 'Member');
                  setChangeRoleOpen(true);
                  setMemberActionAnchor(null);
                }}>Change Role</MenuItem>
                <MenuItem onClick={async () => {
                  if (!memberActionTarget) return;
                  try {
                    await removeProjectMember(project.id, memberActionTarget.id);
                    const res = await getProjectMembers(project.id);
                    setMembers(res.data || []);
                    showToast('success', 'Member removed');
                  } catch (err) {
                    console.error('Failed to remove project member:', err);
                    showToast('error', 'Failed to remove member');
                  } finally {
                    setMemberActionAnchor(null);
                    setMemberActionTarget(null);
                  }
                }}>Remove Member</MenuItem>
              </Menu>

              <Dialog open={changeRoleOpen} onClose={() => setChangeRoleOpen(false)}>
                <DialogTitle>Change Project Role</DialogTitle>
                <DialogContent>
                  <FormControl fullWidth>
                    <InputLabel>Role</InputLabel>
                    <Select value={changeRoleValue} label="Role" onChange={(e) => setChangeRoleValue(e.target.value)}>
                      <MenuItem value="Admin">Admin</MenuItem>
                      <MenuItem value="Member">Member</MenuItem>
                    </Select>
                  </FormControl>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setChangeRoleOpen(false)}>Cancel</Button>
                  <Button variant="contained" onClick={async () => {
                    if (!memberActionTarget) return;
                    try {
                      await updateProjectMember(project.id, memberActionTarget.id, changeRoleValue);
                      const res = await getProjectMembers(project.id);
                      setMembers(res.data || []);
                      showToast('success', 'Member role updated');
                    } catch (err) {
                      console.error('Failed to update project member:', err);
                      showToast('error', 'Failed to update member');
                    } finally {
                      setChangeRoleOpen(false);
                      setMemberActionTarget(null);
                    }
                  }}>Save</Button>
                </DialogActions>
              </Dialog>
            </Box>
          </Fade>
          )}

          {/* Settings Tab */}
          {activeKey === 'settings' && (
            <Fade in timeout={300}>
              <Box sx={{ maxWidth: 700 }}>
              <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
                These settings control task permissions and approval workflows for this project.
              </Alert>

              <Typography variant="h6" sx={{ mb: 3 }}>Task Creation & Management</Typography>
              
              <Box sx={{ mb: 4 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.membersCanCreateTasks}
                      onChange={(e) => setProjectSettings({ ...projectSettings, membersCanCreateTasks: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Members can create tasks
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow project members to create new tasks
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 3 }}>Task Closure & Approval</Typography>
              
              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.membersCanCloseTasks}
                      onChange={(e) => setProjectSettings({ ...projectSettings, membersCanCloseTasks: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Members can request task closure
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Tasks will require approval before being marked as closed
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.adminsCanApprove}
                      onChange={(e) => setProjectSettings({ ...projectSettings, adminsCanApprove: e.target.checked })}
                      disabled={projectSettings.onlyOwnerApproves}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Admins can approve task closures
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Both Owner and Admins can approve task closures
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.onlyOwnerApproves}
                      onChange={(e) => setProjectSettings({ ...projectSettings, onlyOwnerApproves: e.target.checked, adminsCanApprove: !e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Only Owner can approve (Strict Mode)
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Only the project owner has final approval authority
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.requireRejectionReason}
                      onChange={(e) => setProjectSettings({ ...projectSettings, requireRejectionReason: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Require rejection reason
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Approvers must provide a reason when rejecting task closures
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.memberTaskApproval}
                      onChange={(e) => setProjectSettings({ ...projectSettings, memberTaskApproval: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Task approval for members
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Member-created tasks require approval before being active
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.adminTaskApproval}
                      onChange={(e) => setProjectSettings({ ...projectSettings, adminTaskApproval: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Task approval for admin
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Admin-created tasks require approval before being active
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 3 }}>Permissions & Visibility</Typography>

              <Box sx={{ mb: 3 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={projectSettings.showSettingsToAdmin}
                      onChange={(e) => setProjectSettings({ ...projectSettings, showSettingsToAdmin: e.target.checked })}
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Show project settings to admin
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Allow project admins to view and modify settings (Owner always has access)
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 3 }}>Column Management</Typography>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, mb: 1 }}>
                  Freeze Columns
                </Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Select columns to freeze (remain visible when scrolling horizontally)
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                  {['Task Name', 'Assignee', 'Stage', 'Status'].map((col) => (
                    <FormControlLabel
                      key={col}
                      control={
                        <Switch
                          size="small"
                          checked={projectSettings.freezeColumns?.includes(col)}
                          onChange={(e) => {
                            const newFrozen = e.target.checked
                              ? [...(projectSettings.freezeColumns || []), col]
                              : (projectSettings.freezeColumns || []).filter(c => c !== col);
                            setProjectSettings({ ...projectSettings, freezeColumns: newFrozen });
                          }}
                        />
                      }
                      label={<Typography variant="body2">{col}</Typography>}
                    />
                  ))}
                </Box>
              </Box>

              <TextField
                fullWidth
                type="number"
                label="Auto-close after (days)"
                value={projectSettings.autoCloseAfterDays}
                onChange={(e) => setProjectSettings({ ...projectSettings, autoCloseAfterDays: parseInt(e.target.value) || 0 })}
                helperText="Automatically close tasks after X days with no response (0 = disabled)"
                sx={{ mb: 3 }}
              />

              <Button
                variant="contained"
                sx={{ textTransform: 'none', px: 4 }}
                onClick={handleSaveSettings}
                disabled={settingsSaving}
              >
                {settingsSaving ? 'Saving...' : 'Save Settings'}
              </Button>
            </Box>
          </Fade>
          )}
        </Box>
      </Paper>

      {/* Add Member Dialog */}
      <Dialog
        open={addMemberOpen}
        onClose={() => setAddMemberOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Add Project Member</DialogTitle>
        <DialogContent>
          <FormControl fullWidth sx={{ mt: 1 }}>
            <InputLabel>Select User</InputLabel>
            <Select
              label="Select User"
              value={selectedNewMember}
              onChange={(e) => setSelectedNewMember(e.target.value)}
            >
              {availableWorkspaceMembers.map((m) => (
                <MenuItem key={m.id} value={m.id}>
                  {(m.first_name || '') + (m.last_name ? ' ' + m.last_name : '') || m.username || m.email}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
          <FormControl fullWidth sx={{ mt: 3 }}>
            <InputLabel>Project Role</InputLabel>
            <Select
              label="Project Role"
              value={selectedNewMemberRole}
              onChange={(e) => setSelectedNewMemberRole(e.target.value)}
            >
              <MenuItem value="Admin">Admin</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
            </Select>
          </FormControl>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setAddMemberOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            disabled={!selectedNewMember}
            onClick={async () => {
              try {
                await addProjectMember(project.id, { user_id: selectedNewMember, role: selectedNewMemberRole });
                // refresh project members
                const res = await getProjectMembers(project.id);
                setMembers(res.data || []);
                setAddMemberOpen(false);
                setSelectedNewMember('');
                setSelectedNewMemberRole('Member');
                showToast('success', 'Member added to project');
              } catch (err) {
                console.error('Failed to add project member:', err);
                showToast('error', 'Failed to add member');
              }
            }}
            sx={{ textTransform: 'none', px: 3 }}
          >
            Add Member
          </Button>
        </DialogActions>
      </Dialog>

      {/* Task Form Dialog */}
      <TaskForm
        open={taskFormOpen}
        onClose={handleCloseTaskForm}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        task={selectedTask}
        prefilledStage={prefilledStage}
        prefilledStatus={prefilledStatus}
        projectId={project?.id}
        userRole={userRole}
        currentUserId={user?.id}
        projectRole={project?.role}
      />
      
      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialogOpen}
        onClose={() => setDeleteDialogOpen(false)}
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Delete Task</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete <strong>{taskToDelete?.name}</strong>? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ p: 2, pt: 0 }}>
          <Button onClick={() => setDeleteDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button 
            onClick={confirmDelete} 
            color="error" 
            variant="contained"
            sx={{ textTransform: 'none' }}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      <Snackbar
        open={toast.open}
        autoHideDuration={4000}
        onClose={() => setToast({ ...toast, open: false })}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setToast({ ...toast, open: false })} severity={toast.severity} sx={{ width: '100%' }}>
          {toast.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

export default ProjectDetail;
