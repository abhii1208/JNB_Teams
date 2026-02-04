import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  TextField,
  Typography,
  Tooltip,
  IconButton,
  InputAdornment,
  MenuItem,
  Divider,
  Badge,
  Collapse,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Checkbox,
  useMediaQuery,
  createTheme,
  ThemeProvider,
  CssBaseline,
  Fade,
  Snackbar,
  Select,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Search as SearchIcon,
  Clear as ClearIcon,
  FilterList as FilterListIcon,
  ViewCompact as ViewCompactIcon,
  ViewAgenda as ViewAgendaIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Download as DownloadIcon,
  Fullscreen as FullscreenIcon,
  FullscreenExit as FullscreenExitIcon,
  CheckCircle as CheckCircleIcon,
  Schedule as ScheduleIcon,
  PriorityHigh as PriorityHighIcon,
  Today as TodayIcon,
  Refresh as RefreshIcon,
  Print as PrintIcon,
  ContentCopy as ContentCopyIcon,
  DarkMode as DarkModeIcon,
  LightMode as LightModeIcon,
  UnfoldMore as UnfoldMoreIcon,
  UnfoldLess as UnfoldLessIcon,
  Deselect as DeselectIcon,
  DragIndicator as DragIndicatorIcon,
} from '@mui/icons-material';
import { getPublicShareMeta, getPublicShareTasks, unlockPublicShare } from '../../apiClient';
import { SHARE_FIELD_LABELS } from './shareLinkFields';
import { 
  formatShortDateIST, 
  isTodayIST, 
  isTomorrowIST, 
  isPastIST, 
  isThisWeek,
  formatDateIST 
} from '../../utils/dateUtils';

// ============== Constants ==============
const DATE_KEYS = new Set(['due_date', 'target_date', 'created_at', 'updated_at']);
const MAX_TEXT_LEN = 120;
const COMPACT_MAX_TEXT_LEN = 60;
const MIN_COLUMN_WIDTH = 80;
const MAX_COLUMN_WIDTH = 500;
const DEFAULT_COLUMN_WIDTH = 150;

// Default column widths
const COLUMN_DEFAULT_WIDTHS = {
  name: 250,
  description: 280,
  notes: 280,
  status: 120,
  priority: 100,
  due_date: 130,
  target_date: 130,
  assignee_name: 150,
  project_name: 180,
  client_name: 150,
  tags: 200,
  completion_percentage: 140,
  category: 120,
  section: 120,
  stage: 100,
  estimated_hours: 100,
  actual_hours: 100,
  created_at: 130,
  updated_at: 130,
};

// Groupable columns
const GROUPABLE_COLUMNS = ['status', 'priority', 'assignee_name', 'project_name', 'client_name', 'category', 'section', 'stage'];

// Priority colors and values for sorting
const PRIORITY_CONFIG = {
  high: { color: '#ef4444', bgColor: '#fef2f2', darkBgColor: '#7f1d1d', order: 1, label: 'High' },
  medium: { color: '#f59e0b', bgColor: '#fffbeb', darkBgColor: '#78350f', order: 2, label: 'Medium' },
  low: { color: '#22c55e', bgColor: '#f0fdf4', darkBgColor: '#14532d', order: 3, label: 'Low' },
  none: { color: '#94a3b8', bgColor: '#f8fafc', darkBgColor: '#334155', order: 4, label: 'None' },
};

// Status colors and config
const STATUS_CONFIG = {
  todo: { color: '#64748b', bgColor: '#f1f5f9', darkBgColor: '#334155', label: 'To Do' },
  'in-progress': { color: '#3b82f6', bgColor: '#eff6ff', darkBgColor: '#1e3a8a', label: 'In Progress' },
  'in_progress': { color: '#3b82f6', bgColor: '#eff6ff', darkBgColor: '#1e3a8a', label: 'In Progress' },
  blocked: { color: '#ef4444', bgColor: '#fef2f2', darkBgColor: '#7f1d1d', label: 'Blocked' },
  review: { color: '#8b5cf6', bgColor: '#f5f3ff', darkBgColor: '#4c1d95', label: 'Review' },
  done: { color: '#22c55e', bgColor: '#f0fdf4', darkBgColor: '#14532d', label: 'Done' },
  completed: { color: '#22c55e', bgColor: '#f0fdf4', darkBgColor: '#14532d', label: 'Completed' },
  cancelled: { color: '#94a3b8', bgColor: '#f8fafc', darkBgColor: '#334155', label: 'Cancelled' },
};

// Quick filter presets
const QUICK_FILTERS = {
  overdue: {
    label: 'Overdue',
    icon: <ScheduleIcon fontSize="small" />,
    color: 'error',
    filter: (task) => {
      if (!task.due_date) return false;
      const dueDate = parseTaskDate(task.due_date);
      return dueDate && isPastIST(dueDate) && !isTodayIST(dueDate);
    },
  },
  dueToday: {
    label: 'Due Today',
    icon: <TodayIcon fontSize="small" />,
    color: 'warning',
    filter: (task) => {
      if (!task.due_date) return false;
      const dueDate = parseTaskDate(task.due_date);
      return dueDate && isTodayIST(dueDate);
    },
  },
  dueTomorrow: {
    label: 'Due Tomorrow',
    icon: <TodayIcon fontSize="small" />,
    color: 'info',
    filter: (task) => {
      if (!task.due_date) return false;
      const dueDate = parseTaskDate(task.due_date);
      return dueDate && isTomorrowIST(dueDate);
    },
  },
  dueThisWeek: {
    label: 'Due This Week',
    icon: <ScheduleIcon fontSize="small" />,
    color: 'primary',
    filter: (task) => {
      if (!task.due_date) return false;
      const dueDate = parseTaskDate(task.due_date);
      return dueDate && isThisWeek(dueDate);
    },
  },
  highPriority: {
    label: 'High Priority',
    icon: <PriorityHighIcon fontSize="small" />,
    color: 'error',
    filter: (task) => String(task.priority || '').toLowerCase() === 'high',
  },
  inProgress: {
    label: 'In Progress',
    icon: <CheckCircleIcon fontSize="small" />,
    color: 'info',
    filter: (task) => {
      const status = String(task.status || '').toLowerCase().replace(/[\s_-]+/g, '-');
      return status === 'in-progress';
    },
  },
  completed: {
    label: 'Completed',
    icon: <CheckCircleIcon fontSize="small" />,
    color: 'success',
    filter: (task) => {
      const status = String(task.status || '').toLowerCase();
      return status === 'done' || status === 'completed';
    },
  },
};

// ============== Theme Definitions ==============
const lightTheme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#0f766e' },
    background: {
      default: '#f8fafc',
      paper: '#ffffff',
    },
  },
});

const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: '#14b8a6' },
    background: {
      default: '#0f172a',
      paper: '#1e293b',
    },
  },
});

// ============== Utility Functions ==============
const formatDateTime = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDateIST(date, 'MMM d, yyyy h:mm a');
};

const parseTaskDate = (value) => {
  if (!value) return null;
  const parts = String(value).split('-').map((part) => parseInt(part, 10));
  if (parts.length === 3 && parts.every((part) => Number.isInteger(part))) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatCellValue = (key, value, compact = false) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (DATE_KEYS.has(key)) {
    if (key === 'due_date' || key === 'target_date') {
      const date = parseTaskDate(value);
      if (date) {
        if (isTodayIST(date)) return 'Today';
        if (isTomorrowIST(date)) return 'Tomorrow';
        return formatDateIST(date, compact ? 'dd-MMM' : 'dd-MMM-yy');
      }
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return formatDateIST(date, compact ? 'dd-MMM' : 'dd-MMM-yy');
  }
  return String(value);
};

const getTruncatedText = (value, maxLen = MAX_TEXT_LEN) => {
  const text = String(value || '');
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen - 3)}...`;
};

const normalizeString = (str) => String(str || '').toLowerCase().trim();

const getUniqueValuesWithCount = (tasks, key) => {
  const counts = new Map();
  tasks.forEach((task) => {
    const val = task?.[key];
    if (val !== null && val !== undefined && val !== '') {
      if (Array.isArray(val)) {
        val.forEach((v) => {
          const strVal = String(v);
          counts.set(strVal, (counts.get(strVal) || 0) + 1);
        });
      } else {
        const strVal = String(val);
        counts.set(strVal, (counts.get(strVal) || 0) + 1);
      }
    }
  });
  return Array.from(counts.entries())
    .map(([value, count]) => ({ value, count }))
    .sort((a, b) => a.value.localeCompare(b.value));
};

// Sorting comparator
const getSortComparator = (key, direction) => {
  return (a, b) => {
    let aVal = a?.[key];
    let bVal = b?.[key];

    if (aVal === null || aVal === undefined) aVal = '';
    if (bVal === null || bVal === undefined) bVal = '';

    if (key === 'priority') {
      const aOrder = PRIORITY_CONFIG[normalizeString(aVal)]?.order ?? 99;
      const bOrder = PRIORITY_CONFIG[normalizeString(bVal)]?.order ?? 99;
      return direction === 'asc' ? aOrder - bOrder : bOrder - aOrder;
    }

    if (DATE_KEYS.has(key)) {
      const aDate = parseTaskDate(aVal);
      const bDate = parseTaskDate(bVal);
      const aTime = aDate ? aDate.getTime() : (direction === 'asc' ? Infinity : -Infinity);
      const bTime = bDate ? bDate.getTime() : (direction === 'asc' ? Infinity : -Infinity);
      return direction === 'asc' ? aTime - bTime : bTime - aTime;
    }

    if (typeof aVal === 'number' && typeof bVal === 'number') {
      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    }

    const aStr = String(aVal).toLowerCase();
    const bStr = String(bVal).toLowerCase();
    const result = aStr.localeCompare(bStr);
    return direction === 'asc' ? result : -result;
  };
};

// Group tasks by a column
const groupTasksByColumn = (tasks, groupByColumn) => {
  if (!groupByColumn) return null;
  
  const groups = new Map();
  tasks.forEach((task) => {
    const val = task?.[groupByColumn];
    const key = val !== null && val !== undefined && val !== '' ? String(val) : '(No Value)';
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(task);
  });
  
  // Sort groups
  const sortedGroups = Array.from(groups.entries()).sort((a, b) => {
    if (a[0] === '(No Value)') return 1;
    if (b[0] === '(No Value)') return -1;
    
    if (groupByColumn === 'priority') {
      const aOrder = PRIORITY_CONFIG[normalizeString(a[0])]?.order ?? 99;
      const bOrder = PRIORITY_CONFIG[normalizeString(b[0])]?.order ?? 99;
      return aOrder - bOrder;
    }
    
    return a[0].localeCompare(b[0]);
  });
  
  return sortedGroups;
};

// ============== Sub-components ==============

// Priority Badge Component
const PriorityBadge = ({ priority, compact, darkMode }) => {
  const key = normalizeString(priority);
  const config = PRIORITY_CONFIG[key] || PRIORITY_CONFIG.none;
  
  if (compact) {
    return (
      <Box
        sx={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          bgcolor: config.color,
          flexShrink: 0,
        }}
        title={config.label}
      />
    );
  }

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        bgcolor: darkMode ? config.darkBgColor : config.bgColor,
        color: darkMode ? '#fff' : config.color,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
};

// Status Badge Component
const StatusBadge = ({ status, compact, darkMode }) => {
  const key = normalizeString(status).replace(/[\s_]+/g, '-');
  const config = STATUS_CONFIG[key] || { color: '#64748b', bgColor: '#f1f5f9', darkBgColor: '#334155', label: status || '-' };
  
  if (compact) {
    return (
      <Typography variant="caption" sx={{ color: config.color, fontWeight: 600 }}>
        {config.label}
      </Typography>
    );
  }

  return (
    <Chip
      label={config.label}
      size="small"
      sx={{
        bgcolor: darkMode ? config.darkBgColor : config.bgColor,
        color: darkMode ? '#fff' : config.color,
        fontWeight: 600,
        fontSize: '0.7rem',
        height: 22,
        '& .MuiChip-label': { px: 1 },
      }}
    />
  );
};

// Due Date Badge with color coding
const DueDateBadge = ({ dueDate, compact, darkMode }) => {
  if (!dueDate) return <Typography variant="body2" color="text.secondary">-</Typography>;
  
  const date = parseTaskDate(dueDate);
  if (!date) return <Typography variant="body2">{String(dueDate)}</Typography>;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  let color = 'text.primary';
  let bgColor = 'transparent';
  let label = formatDateIST(date, compact ? 'dd-MMM' : 'dd-MMM-yy');

  if (isTodayIST(date)) {
    color = '#f59e0b';
    bgColor = darkMode ? '#78350f' : '#fffbeb';
    label = 'Today';
  } else if (isTomorrowIST(date)) {
    color = '#3b82f6';
    bgColor = darkMode ? '#1e3a8a' : '#eff6ff';
    label = 'Tomorrow';
  } else if (isPastIST(date)) {
    color = '#ef4444';
    bgColor = darkMode ? '#7f1d1d' : '#fef2f2';
    label = compact ? formatDateIST(date, 'dd-MMM') : `Overdue (${formatDateIST(date, 'dd-MMM')})`;
  }

  if (compact) {
    return (
      <Typography variant="caption" sx={{ color, fontWeight: isPastIST(date) ? 600 : 400 }}>
        {label}
      </Typography>
    );
  }

  return (
    <Box
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1,
        py: 0.25,
        borderRadius: 1,
        bgcolor: bgColor,
        color: darkMode && bgColor !== 'transparent' ? '#fff' : color,
        fontWeight: 500,
        fontSize: '0.8rem',
      }}
    >
      {label}
    </Box>
  );
};

// Column Filter Popover with task counts
const ColumnFilterPopover = ({ anchorEl, open, onClose, column, tasks, selectedValues, onFilterChange }) => {
  const valuesWithCount = useMemo(() => getUniqueValuesWithCount(tasks, column), [tasks, column]);
  const [localSearch, setLocalSearch] = useState('');

  const filteredValues = useMemo(() => {
    if (!localSearch) return valuesWithCount;
    const search = localSearch.toLowerCase();
    return valuesWithCount.filter((v) => v.value.toLowerCase().includes(search));
  }, [valuesWithCount, localSearch]);

  const handleToggle = (value) => {
    const newValues = selectedValues.includes(value)
      ? selectedValues.filter((v) => v !== value)
      : [...selectedValues, value];
    onFilterChange(column, newValues);
  };

  const handleSelectAll = () => {
    onFilterChange(column, filteredValues.map((v) => v.value));
  };

  const handleClearAll = () => {
    onFilterChange(column, []);
  };

  // Reset local search when popover closes
  useEffect(() => {
    if (!open) setLocalSearch('');
  }, [open]);

  return (
    <Popover
      open={open}
      anchorEl={anchorEl}
      onClose={onClose}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
      transformOrigin={{ vertical: 'top', horizontal: 'left' }}
    >
      <Box sx={{ width: 300, maxHeight: 450, display: 'flex', flexDirection: 'column' }}>
        <Box sx={{ p: 1.5, borderBottom: 1, borderColor: 'divider' }}>
          <TextField
            size="small"
            fullWidth
            placeholder="Search values..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            InputProps={{
              startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
            }}
          />
        </Box>
        <Box sx={{ px: 1.5, py: 1, display: 'flex', gap: 1, borderBottom: 1, borderColor: 'divider' }}>
          <Button size="small" onClick={handleSelectAll}>Select All</Button>
          <Button size="small" onClick={handleClearAll}>Clear</Button>
          <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto', alignSelf: 'center' }}>
            {filteredValues.length} values
          </Typography>
        </Box>
        <List dense sx={{ overflow: 'auto', flex: 1 }}>
          {filteredValues.length === 0 ? (
            <ListItem>
              <ListItemText secondary="No values found" />
            </ListItem>
          ) : (
            filteredValues.map(({ value, count }) => (
              <ListItemButton key={value} onClick={() => handleToggle(value)} dense>
                <ListItemIcon sx={{ minWidth: 36 }}>
                  <Checkbox
                    edge="start"
                    checked={selectedValues.includes(value)}
                    tabIndex={-1}
                    disableRipple
                    size="small"
                  />
                </ListItemIcon>
                <ListItemText 
                  primary={
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span>{value}</span>
                      <Chip label={count} size="small" sx={{ height: 20, fontSize: '0.7rem', ml: 1 }} />
                    </Box>
                  } 
                />
              </ListItemButton>
            ))
          )}
        </List>
      </Box>
    </Popover>
  );
};

// Stats Summary Bar
const StatsSummaryBar = ({ tasks, columns, compact }) => {
  const stats = useMemo(() => {
    const result = {
      total: tasks.length,
      overdue: 0,
      dueToday: 0,
      highPriority: 0,
      completed: 0,
    };

    tasks.forEach((task) => {
      if (task.due_date) {
        const date = parseTaskDate(task.due_date);
        if (date) {
          if (isPastIST(date) && !isTodayIST(date)) result.overdue++;
          if (isTodayIST(date)) result.dueToday++;
        }
      }
      if (normalizeString(task.priority) === 'high') result.highPriority++;
      const status = normalizeString(task.status);
      if (status === 'done' || status === 'completed') result.completed++;
    });

    return result;
  }, [tasks]);

  if (compact) {
    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
        <Typography variant="caption" color="text.secondary">
          {stats.total} tasks
        </Typography>
        {stats.overdue > 0 && (
          <Chip label={`${stats.overdue} overdue`} size="small" color="error" sx={{ height: 20, fontSize: '0.7rem' }} />
        )}
        {stats.dueToday > 0 && (
          <Chip label={`${stats.dueToday} due today`} size="small" color="warning" sx={{ height: 20, fontSize: '0.7rem' }} />
        )}
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center', mb: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <Typography variant="body2" fontWeight={600}>{stats.total}</Typography>
        <Typography variant="body2" color="text.secondary">Total</Typography>
      </Box>
      {columns.includes('due_date') && stats.overdue > 0 && (
        <Chip
          icon={<ScheduleIcon fontSize="small" />}
          label={`${stats.overdue} Overdue`}
          size="small"
          color="error"
          variant="outlined"
        />
      )}
      {columns.includes('due_date') && stats.dueToday > 0 && (
        <Chip
          icon={<TodayIcon fontSize="small" />}
          label={`${stats.dueToday} Due Today`}
          size="small"
          color="warning"
          variant="outlined"
        />
      )}
      {columns.includes('priority') && stats.highPriority > 0 && (
        <Chip
          icon={<PriorityHighIcon fontSize="small" />}
          label={`${stats.highPriority} High Priority`}
          size="small"
          color="error"
          variant="outlined"
        />
      )}
      {columns.includes('status') && (
        <Chip
          icon={<CheckCircleIcon fontSize="small" />}
          label={`${stats.completed} Completed`}
          size="small"
          color="success"
          variant="outlined"
        />
      )}
    </Box>
  );
};

// Resizable Column Header
const ResizableHeader = ({ column, width, onResize, children, ...props }) => {
  const [isResizing, setIsResizing] = useState(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const handleMouseDown = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsResizing(true);
    startXRef.current = e.clientX;
    startWidthRef.current = width;
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isResizing) return;
      const diff = e.clientX - startXRef.current;
      const newWidth = Math.max(MIN_COLUMN_WIDTH, Math.min(MAX_COLUMN_WIDTH, startWidthRef.current + diff));
      onResize(column, newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, column, onResize]);

  return (
    <TableCell
      {...props}
      sx={{
        ...props.sx,
        width,
        minWidth: width,
        maxWidth: width,
        position: 'relative',
      }}
    >
      {children}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          position: 'absolute',
          right: 0,
          top: 0,
          bottom: 0,
          width: 6,
          cursor: 'col-resize',
          bgcolor: isResizing ? 'primary.main' : 'transparent',
          '&:hover': {
            bgcolor: 'primary.light',
          },
          zIndex: 1,
        }}
      />
    </TableCell>
  );
};

// Group Header Row
const GroupHeaderRow = ({ groupName, groupValue, taskCount, columns, isExpanded, onToggle, selectedInGroup, onSelectGroup, darkMode }) => {
  const allSelected = selectedInGroup === taskCount && taskCount > 0;
  const someSelected = selectedInGroup > 0 && selectedInGroup < taskCount;

  // Get group-specific styling
  let groupColor = 'text.primary';
  let groupBgColor = darkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  
  if (groupName === 'priority') {
    const config = PRIORITY_CONFIG[normalizeString(groupValue)];
    if (config) {
      groupColor = config.color;
      groupBgColor = darkMode ? config.darkBgColor : config.bgColor;
    }
  } else if (groupName === 'status') {
    const config = STATUS_CONFIG[normalizeString(groupValue).replace(/[\s_]+/g, '-')];
    if (config) {
      groupColor = config.color;
      groupBgColor = darkMode ? config.darkBgColor : config.bgColor;
    }
  }

  return (
    <TableRow sx={{ bgcolor: groupBgColor }}>
      <TableCell 
        colSpan={columns.length + 1}
        sx={{ 
          py: 1, 
          fontWeight: 600,
          borderBottom: 2,
          borderColor: groupColor,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Checkbox
            checked={allSelected}
            indeterminate={someSelected}
            onChange={(e) => onSelectGroup(e.target.checked)}
            size="small"
          />
          <IconButton size="small" onClick={onToggle}>
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>
          <Typography variant="subtitle2" sx={{ color: groupColor }}>
            {groupValue}
          </Typography>
          <Chip 
            label={`${taskCount} tasks`} 
            size="small" 
            sx={{ height: 20, fontSize: '0.7rem' }}
          />
          {selectedInGroup > 0 && (
            <Chip 
              label={`${selectedInGroup} selected`} 
              size="small" 
              color="primary"
              sx={{ height: 20, fontSize: '0.7rem' }}
            />
          )}
        </Box>
      </TableCell>
    </TableRow>
  );
};

// Print Styles Component
const PrintStyles = () => (
  <style>
    {`
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        .no-print {
          display: none !important;
        }
        .print-only {
          display: block !important;
        }
        .MuiTableContainer-root {
          max-height: none !important;
          overflow: visible !important;
        }
        .MuiTable-root {
          page-break-inside: auto;
        }
        .MuiTableRow-root {
          page-break-inside: avoid;
          page-break-after: auto;
        }
        .MuiTableHead-root {
          display: table-header-group;
        }
        .MuiPaper-root {
          box-shadow: none !important;
        }
        @page {
          margin: 1cm;
          size: landscape;
        }
      }
    `}
  </style>
);

// ============== Main Component ==============
export default function PublicSharePage({ slug }) {
  // Dark mode state
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('shareLink_darkMode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  const isMobile = useMediaQuery('(max-width:600px)');
  
  // Core state
  const [meta, setMeta] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  // View state
  const [compactView, setCompactView] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sorting state
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // Filtering state
  const [searchQuery, setSearchQuery] = useState('');
  const [activeQuickFilters, setActiveQuickFilters] = useState([]);
  const [columnFilters, setColumnFilters] = useState({});
  
  // Filter popover state
  const [filterPopover, setFilterPopover] = useState({ anchorEl: null, column: null });

  // Row selection state
  const [selectedRows, setSelectedRows] = useState(new Set());

  // Grouping state
  const [groupByColumn, setGroupByColumn] = useState(null);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());

  // Column widths state
  const [columnWidths, setColumnWidths] = useState({});

  // Snackbar for copy feedback
  const [snackbar, setSnackbar] = useState({ open: false, message: '' });

  const columns = useMemo(() => meta?.allowed_columns || [], [meta]);

  // Initialize column widths
  useEffect(() => {
    if (columns.length > 0) {
      const widths = {};
      columns.forEach((col) => {
        widths[col] = COLUMN_DEFAULT_WIDTHS[col] || DEFAULT_COLUMN_WIDTH;
      });
      setColumnWidths(widths);
    }
  }, [columns]);

  // Save dark mode preference
  useEffect(() => {
    localStorage.setItem('shareLink_darkMode', String(darkMode));
  }, [darkMode]);

  // Determine which quick filters are available based on columns
  const availableQuickFilters = useMemo(() => {
    const available = [];
    if (columns.includes('due_date')) {
      available.push('overdue', 'dueToday', 'dueTomorrow', 'dueThisWeek');
    }
    if (columns.includes('priority')) {
      available.push('highPriority');
    }
    if (columns.includes('status')) {
      available.push('inProgress', 'completed');
    }
    return available;
  }, [columns]);

  // Get filterable columns
  const filterableColumns = useMemo(() => {
    const filterable = ['status', 'priority', 'stage', 'category', 'section', 'project_name', 'assignee_name', 'client_name'];
    return columns.filter((col) => filterable.includes(col));
  }, [columns]);

  // Get groupable columns that are present
  const availableGroupColumns = useMemo(() => {
    return columns.filter((col) => GROUPABLE_COLUMNS.includes(col));
  }, [columns]);

  // Processed tasks (filtered + sorted)
  const processedTasks = useMemo(() => {
    let result = [...tasks];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((task) => {
        return columns.some((col) => {
          const val = task?.[col];
          if (val === null || val === undefined) return false;
          return String(val).toLowerCase().includes(query);
        });
      });
    }

    // Apply quick filters (OR logic within quick filters)
    if (activeQuickFilters.length > 0) {
      result = result.filter((task) => {
        return activeQuickFilters.some((filterKey) => {
          const filterConfig = QUICK_FILTERS[filterKey];
          return filterConfig?.filter(task);
        });
      });
    }

    // Apply column filters (AND logic between columns, OR within column values)
    Object.entries(columnFilters).forEach(([column, values]) => {
      if (values && values.length > 0) {
        result = result.filter((task) => {
          const taskVal = String(task?.[column] || '');
          return values.includes(taskVal);
        });
      }
    });

    // Apply sorting
    if (sortConfig.key) {
      result.sort(getSortComparator(sortConfig.key, sortConfig.direction));
    }

    return result;
  }, [tasks, searchQuery, activeQuickFilters, columnFilters, sortConfig, columns]);

  // Grouped tasks
  const groupedTasks = useMemo(() => {
    if (!groupByColumn) return null;
    return groupTasksByColumn(processedTasks, groupByColumn);
  }, [processedTasks, groupByColumn]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = activeQuickFilters.length;
    Object.values(columnFilters).forEach((values) => {
      if (values && values.length > 0) count++;
    });
    if (searchQuery.trim()) count++;
    return count;
  }, [activeQuickFilters, columnFilters, searchQuery]);

  // Load tasks
  const loadTasks = useCallback(async (shareToken) => {
    if (!slug) return;
    setTasksLoading(true);
    try {
      const res = await getPublicShareTasks(slug, shareToken);
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Failed to load shared tasks:', err);
      setError('Unable to load shared tasks.');
    } finally {
      setTasksLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const loadMeta = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getPublicShareMeta(slug);
        setMeta(res.data);
        if (!res.data.is_protected) {
          await loadTasks('');
        }
      } catch (err) {
        console.error('Failed to load share link:', err);
        setError('This link is invalid, expired, or revoked.');
      } finally {
        setLoading(false);
      }
    };
    loadMeta();
  }, [slug, loadTasks]);

  const handleUnlock = async () => {
    if (!password.trim()) return;
    setUnlocking(true);
    setError('');
    try {
      const res = await unlockPublicShare(slug, password.trim());
      const nextToken = res.data.token;
      setToken(nextToken);
      await loadTasks(nextToken);
    } catch (err) {
      console.error('Failed to unlock share link:', err);
      setError('Unable to unlock this share link.');
    } finally {
      setUnlocking(false);
    }
  };

  // Sorting handler
  const handleSort = (column) => {
    setSortConfig((prev) => {
      if (prev.key === column) {
        if (prev.direction === 'asc') return { key: column, direction: 'desc' };
        return { key: null, direction: 'asc' };
      }
      return { key: column, direction: 'asc' };
    });
  };

  // Quick filter toggle
  const toggleQuickFilter = (filterKey) => {
    setActiveQuickFilters((prev) => {
      if (prev.includes(filterKey)) {
        return prev.filter((k) => k !== filterKey);
      }
      return [...prev, filterKey];
    });
  };

  // Column filter change
  const handleColumnFilterChange = (column, values) => {
    setColumnFilters((prev) => ({
      ...prev,
      [column]: values,
    }));
  };

  // Clear all filters
  const clearAllFilters = () => {
    setSearchQuery('');
    setActiveQuickFilters([]);
    setColumnFilters({});
    setSortConfig({ key: null, direction: 'asc' });
  };

  // Column resize handler
  const handleColumnResize = useCallback((column, width) => {
    setColumnWidths((prev) => ({
      ...prev,
      [column]: width,
    }));
  }, []);

  // Row selection handlers
  const handleRowSelect = (taskIndex, isGrouped = false, groupKey = null) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      const key = isGrouped ? `${groupKey}-${taskIndex}` : String(taskIndex);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  const handleSelectAll = () => {
    if (selectedRows.size === processedTasks.length) {
      setSelectedRows(new Set());
    } else {
      const allKeys = processedTasks.map((_, i) => String(i));
      setSelectedRows(new Set(allKeys));
    }
  };

  const handleSelectGroup = (groupKey, tasks, select) => {
    setSelectedRows((prev) => {
      const newSet = new Set(prev);
      tasks.forEach((_, i) => {
        const key = `${groupKey}-${i}`;
        if (select) {
          newSet.add(key);
        } else {
          newSet.delete(key);
        }
      });
      return newSet;
    });
  };

  // Group collapse toggle
  const toggleGroupCollapse = (groupKey) => {
    setCollapsedGroups((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(groupKey)) {
        newSet.delete(groupKey);
      } else {
        newSet.add(groupKey);
      }
      return newSet;
    });
  };

  // Copy selected rows
  const handleCopySelected = () => {
    const selectedTasks = [];
    
    if (groupedTasks) {
      groupedTasks.forEach(([groupKey, groupTasks]) => {
        groupTasks.forEach((task, i) => {
          if (selectedRows.has(`${groupKey}-${i}`)) {
            selectedTasks.push(task);
          }
        });
      });
    } else {
      processedTasks.forEach((task, i) => {
        if (selectedRows.has(String(i))) {
          selectedTasks.push(task);
        }
      });
    }

    if (selectedTasks.length === 0) {
      setSnackbar({ open: true, message: 'No rows selected' });
      return;
    }

    // Build tab-separated values
    const headers = columns.map((col) => SHARE_FIELD_LABELS[col] || col).join('\t');
    const rows = selectedTasks.map((task) =>
      columns.map((col) => {
        const val = task?.[col];
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) return val.join(', ');
        return String(val);
      }).join('\t')
    );

    const text = [headers, ...rows].join('\n');
    navigator.clipboard.writeText(text).then(() => {
      setSnackbar({ open: true, message: `${selectedTasks.length} rows copied to clipboard` });
    }).catch(() => {
      setSnackbar({ open: true, message: 'Failed to copy to clipboard' });
    });
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = columns.map((col) => SHARE_FIELD_LABELS[col] || col);
    const rows = processedTasks.map((task) =>
      columns.map((col) => {
        const val = task?.[col];
        if (val === null || val === undefined) return '';
        if (Array.isArray(val)) return val.join('; ');
        return String(val).replace(/"/g, '""');
      })
    );

    const csvContent = [
      headers.map((h) => `"${h}"`).join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${meta?.link_name || 'shared-tasks'}-${formatDateIST(new Date(), 'yyyy-MM-dd')}.csv`;
    link.click();
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Render cell content with enhanced formatting
  const renderCellContent = (col, task) => {
    const rawValue = task?.[col];
    const maxTextLen = compactView ? COMPACT_MAX_TEXT_LEN : MAX_TEXT_LEN;

    if (col === 'priority') {
      return <PriorityBadge priority={rawValue} compact={compactView} darkMode={darkMode} />;
    }

    if (col === 'status') {
      return <StatusBadge status={rawValue} compact={compactView} darkMode={darkMode} />;
    }

    if (col === 'due_date') {
      return <DueDateBadge dueDate={rawValue} compact={compactView} darkMode={darkMode} />;
    }

    if (col === 'tags' && Array.isArray(rawValue) && rawValue.length > 0) {
      if (compactView) {
        return (
          <Box sx={{ display: 'flex', gap: 0.5 }}>
            {rawValue.slice(0, 2).map((tag, i) => (
              <Chip key={i} label={tag} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
            ))}
            {rawValue.length > 2 && (
              <Typography variant="caption" color="text.secondary">+{rawValue.length - 2}</Typography>
            )}
          </Box>
        );
      }
      return (
        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {rawValue.map((tag, i) => (
            <Chip key={i} label={tag} size="small" sx={{ height: 22, fontSize: '0.7rem' }} />
          ))}
        </Box>
      );
    }

    if (col === 'completion_percentage' && rawValue !== null && rawValue !== undefined) {
      const pct = Number(rawValue) || 0;
      return (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ flex: 1, height: 6, bgcolor: darkMode ? '#334155' : '#e2e8f0', borderRadius: 3, overflow: 'hidden', minWidth: 40 }}>
            <Box sx={{ height: '100%', bgcolor: pct >= 100 ? '#22c55e' : '#3b82f6', width: `${Math.min(pct, 100)}%` }} />
          </Box>
          <Typography variant="caption" sx={{ minWidth: 32 }}>{pct}%</Typography>
        </Box>
      );
    }

    const isLongText = col === 'notes' || col === 'description';
    const baseValue = formatCellValue(col, rawValue, compactView);
    const truncated = isLongText ? getTruncatedText(rawValue || baseValue, maxTextLen) : baseValue;
    const showTooltip = isLongText && rawValue && String(rawValue).length > maxTextLen;

    if (showTooltip) {
      return (
        <Tooltip title={String(rawValue)} placement="top">
          <span>{truncated}</span>
        </Tooltip>
      );
    }

    return truncated;
  };

  // Render table row
  const renderTableRow = (task, index, isGrouped = false, groupKey = null) => {
    const rowKey = isGrouped ? `${groupKey}-${index}` : String(index);
    const isSelected = selectedRows.has(rowKey);
    
    return (
      <TableRow 
        key={rowKey} 
        hover 
        selected={isSelected}
        sx={{ 
          '&:hover': { bgcolor: 'action.hover' },
          '&.Mui-selected': { bgcolor: darkMode ? 'rgba(20, 184, 166, 0.16)' : 'rgba(15, 118, 110, 0.08)' },
        }}
      >
        <TableCell padding="checkbox" sx={{ width: 48 }}>
          <Checkbox
            checked={isSelected}
            onChange={() => handleRowSelect(index, isGrouped, groupKey)}
            size="small"
          />
        </TableCell>
        {columns.map((col) => {
          const width = columnWidths[col] || DEFAULT_COLUMN_WIDTH;
          return (
            <TableCell
              key={`${rowKey}-${col}`}
              sx={{
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                width,
                minWidth: width,
                maxWidth: width,
                py: compactView ? 0.75 : 1.25,
              }}
            >
              {renderCellContent(col, task)}
            </TableCell>
          );
        })}
      </TableRow>
    );
  };

  // Loading state
  if (loading) {
    return (
      <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CircularProgress />
        </Box>
      </ThemeProvider>
    );
  }

  // Error state
  if (!meta) {
    return (
      <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
        <CssBaseline />
        <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
          <Alert severity="error">{error || 'This link is not available.'}</Alert>
        </Box>
      </ThemeProvider>
    );
  }

  const allSelected = selectedRows.size === processedTasks.length && processedTasks.length > 0;
  const someSelected = selectedRows.size > 0 && selectedRows.size < processedTasks.length;

  return (
    <ThemeProvider theme={darkMode ? darkTheme : lightTheme}>
      <CssBaseline />
      <PrintStyles />
      
      <Box sx={{ minHeight: '100vh', bgcolor: 'background.default', p: { xs: 1, sm: 2, md: 3 } }}>
        <Box sx={{ maxWidth: 1600, mx: 'auto' }}>
          {/* Header Section */}
          <Paper sx={{ p: { xs: 2, md: 3 }, mb: 2 }} className="no-print">
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
              <Avatar
                src={meta.workspace_logo_url || ''}
                alt={meta.workspace_name || 'Workspace'}
                sx={{ width: 44, height: 44, bgcolor: 'primary.main' }}
              >
                {(meta.workspace_name || 'W').charAt(0).toUpperCase()}
              </Avatar>
              <Box sx={{ flex: 1, minWidth: 200 }}>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                  <Typography variant="h5" fontWeight={700}>
                    {meta.link_name || 'Shared Tasks'}
                  </Typography>
                  <Chip label="View only" size="small" />
                  {meta.is_protected && <Chip label="Protected" size="small" color="warning" />}
                </Box>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                  {meta.workspace_name} • {meta.task_count} tasks • Expires {formatDateTime(meta.expires_at)}
                </Typography>
              </Box>
              {/* Dark Mode Toggle */}
              <Tooltip title={darkMode ? 'Light Mode' : 'Dark Mode'}>
                <IconButton onClick={() => setDarkMode(!darkMode)} color="inherit">
                  {darkMode ? <LightModeIcon /> : <DarkModeIcon />}
                </IconButton>
              </Tooltip>
            </Box>
          </Paper>

          {/* Print Header - Only visible when printing */}
          <Box className="print-only" sx={{ display: 'none', mb: 2 }}>
            <Typography variant="h4" fontWeight={700}>
              {meta.link_name || 'Shared Tasks'}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {meta.workspace_name} • {processedTasks.length} tasks • Printed on {formatDateIST(new Date(), 'PPP')}
            </Typography>
          </Box>

          {error && (
            <Alert severity="error" sx={{ mb: 2 }} className="no-print">
              {error}
            </Alert>
          )}

          {/* Password Protection */}
          {meta.is_protected && !token ? (
            <Paper sx={{ p: 3 }}>
              <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
                Enter password to view tasks
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  type="password"
                  label="Password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                  size="small"
                  sx={{ minWidth: 240 }}
                />
                <Button variant="contained" onClick={handleUnlock} disabled={unlocking || !password.trim()}>
                  {unlocking ? 'Unlocking...' : 'Unlock'}
                </Button>
              </Box>
            </Paper>
          ) : (
            <>
              {/* Toolbar Section */}
              <Paper sx={{ p: 1.5, mb: 2 }} className="no-print">
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1.5, alignItems: 'center' }}>
                  {/* Search */}
                  <TextField
                    size="small"
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    sx={{ minWidth: 200, flex: isMobile ? 1 : 'none' }}
                    InputProps={{
                      startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>,
                      endAdornment: searchQuery && (
                        <InputAdornment position="end">
                          <IconButton size="small" onClick={() => setSearchQuery('')}>
                            <ClearIcon fontSize="small" />
                          </IconButton>
                        </InputAdornment>
                      ),
                    }}
                  />

                  {!isMobile && <Divider orientation="vertical" flexItem />}

                  {/* Quick Filters */}
                  <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', alignItems: 'center' }}>
                    {availableQuickFilters.slice(0, isMobile ? 2 : 4).map((filterKey) => {
                      const config = QUICK_FILTERS[filterKey];
                      const isActive = activeQuickFilters.includes(filterKey);
                      const count = tasks.filter(config.filter).length;
                      
                      return (
                        <Chip
                          key={filterKey}
                          icon={config.icon}
                          label={`${config.label} (${count})`}
                          size="small"
                          color={isActive ? config.color : 'default'}
                          variant={isActive ? 'filled' : 'outlined'}
                          onClick={() => toggleQuickFilter(filterKey)}
                          sx={{ cursor: 'pointer' }}
                        />
                      );
                    })}
                  </Box>

                  <Box sx={{ flex: 1 }} />

                  {/* Group By Selector */}
                  {availableGroupColumns.length > 0 && (
                    <FormControl size="small" sx={{ minWidth: 120 }}>
                      <InputLabel>Group by</InputLabel>
                      <Select
                        value={groupByColumn || ''}
                        label="Group by"
                        onChange={(e) => {
                          setGroupByColumn(e.target.value || null);
                          setCollapsedGroups(new Set());
                        }}
                      >
                        <MenuItem value="">
                          <em>None</em>
                        </MenuItem>
                        {availableGroupColumns.map((col) => (
                          <MenuItem key={col} value={col}>
                            {SHARE_FIELD_LABELS[col] || col}
                          </MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  )}

                  {/* View Controls */}
                  <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
                    {/* Filter toggle */}
                    <Tooltip title="Advanced Filters">
                      <IconButton
                        size="small"
                        onClick={() => setShowFilters(!showFilters)}
                        color={showFilters || activeFilterCount > 0 ? 'primary' : 'default'}
                      >
                        <Badge badgeContent={activeFilterCount} color="primary" max={9}>
                          <FilterListIcon />
                        </Badge>
                      </IconButton>
                    </Tooltip>

                    {/* Compact view toggle */}
                    <Tooltip title={compactView ? 'Standard View' : 'Compact View'}>
                      <IconButton size="small" onClick={() => setCompactView(!compactView)}>
                        {compactView ? <ViewAgendaIcon /> : <ViewCompactIcon />}
                      </IconButton>
                    </Tooltip>

                    {/* Selection actions */}
                    {selectedRows.size > 0 && (
                      <>
                        <Tooltip title="Copy Selected">
                          <IconButton size="small" onClick={handleCopySelected} color="primary">
                            <ContentCopyIcon />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Clear Selection">
                          <IconButton size="small" onClick={() => setSelectedRows(new Set())}>
                            <DeselectIcon />
                          </IconButton>
                        </Tooltip>
                      </>
                    )}

                    {/* Refresh */}
                    <Tooltip title="Refresh">
                      <IconButton size="small" onClick={() => loadTasks(token)} disabled={tasksLoading}>
                        <RefreshIcon />
                      </IconButton>
                    </Tooltip>

                    {/* Print */}
                    <Tooltip title="Print">
                      <IconButton size="small" onClick={handlePrint}>
                        <PrintIcon />
                      </IconButton>
                    </Tooltip>

                    {/* Export */}
                    <Tooltip title="Export CSV">
                      <IconButton size="small" onClick={handleExportCSV}>
                        <DownloadIcon />
                      </IconButton>
                    </Tooltip>

                    {/* Fullscreen */}
                    {!isMobile && (
                      <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
                        <IconButton size="small" onClick={toggleFullscreen}>
                          {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>
                </Box>

                {/* Advanced Filters Panel */}
                <Collapse in={showFilters}>
                  <Box sx={{ mt: 2, pt: 2, borderTop: 1, borderColor: 'divider' }}>
                    <Typography variant="subtitle2" sx={{ mb: 1 }}>Filter by Column</Typography>
                    <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                      {filterableColumns.map((col) => {
                        const hasFilter = columnFilters[col]?.length > 0;
                        const valuesWithCount = getUniqueValuesWithCount(tasks, col);
                        return (
                          <Chip
                            key={col}
                            label={`${SHARE_FIELD_LABELS[col] || col} (${valuesWithCount.length})`}
                            size="small"
                            variant={hasFilter ? 'filled' : 'outlined'}
                            color={hasFilter ? 'primary' : 'default'}
                            onClick={(e) => setFilterPopover({ anchorEl: e.currentTarget, column: col })}
                            onDelete={hasFilter ? () => handleColumnFilterChange(col, []) : undefined}
                            deleteIcon={hasFilter ? <ClearIcon fontSize="small" /> : undefined}
                          />
                        );
                      })}
                      {activeFilterCount > 0 && (
                        <Button size="small" color="error" onClick={clearAllFilters} startIcon={<ClearIcon />}>
                          Clear All
                        </Button>
                      )}
                    </Box>
                  </Box>
                </Collapse>
              </Paper>

              {/* Stats Summary */}
              <StatsSummaryBar tasks={processedTasks} columns={columns} compact={compactView} />

              {/* Selection & Results info */}
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1, flexWrap: 'wrap', gap: 1 }} className="no-print">
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                  {selectedRows.size > 0 && (
                    <Chip
                      label={`${selectedRows.size} selected`}
                      size="small"
                      color="primary"
                      onDelete={() => setSelectedRows(new Set())}
                    />
                  )}
                  {(searchQuery || activeQuickFilters.length > 0 || Object.values(columnFilters).some(v => v?.length > 0)) && (
                    <Fade in>
                      <Typography variant="body2" color="text.secondary">
                        Showing {processedTasks.length} of {tasks.length} tasks
                      </Typography>
                    </Fade>
                  )}
                </Box>
                {groupByColumn && (
                  <Box sx={{ display: 'flex', gap: 1 }}>
                    <Button
                      size="small"
                      startIcon={<UnfoldMoreIcon />}
                      onClick={() => setCollapsedGroups(new Set())}
                    >
                      Expand All
                    </Button>
                    <Button
                      size="small"
                      startIcon={<UnfoldLessIcon />}
                      onClick={() => setCollapsedGroups(new Set(groupedTasks?.map(([key]) => key) || []))}
                    >
                      Collapse All
                    </Button>
                  </Box>
                )}
              </Box>

              {/* Data Table */}
              <TableContainer 
                component={Paper} 
                sx={{ 
                  maxHeight: isFullscreen ? 'calc(100vh - 200px)' : '65vh', 
                  overflowX: 'auto',
                }}
              >
                <Table 
                  stickyHeader 
                  size={compactView ? 'small' : 'medium'}
                >
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" sx={{ width: 48, bgcolor: 'background.paper' }}>
                        <Checkbox
                          checked={allSelected}
                          indeterminate={someSelected}
                          onChange={handleSelectAll}
                          size="small"
                        />
                      </TableCell>
                      {columns.map((col) => {
                        const isSorted = sortConfig.key === col;
                        const isFilterable = filterableColumns.includes(col);
                        const hasFilter = columnFilters[col]?.length > 0;
                        const width = columnWidths[col] || DEFAULT_COLUMN_WIDTH;

                        return (
                          <ResizableHeader
                            key={col}
                            column={col}
                            width={width}
                            onResize={handleColumnResize}
                            sx={{
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              bgcolor: hasFilter ? (darkMode ? 'rgba(20, 184, 166, 0.2)' : 'rgba(15, 118, 110, 0.1)') : 'background.paper',
                              py: compactView ? 1 : 1.5,
                              cursor: 'pointer',
                              userSelect: 'none',
                              '&:hover': { bgcolor: 'action.hover' },
                            }}
                            onClick={() => handleSort(col)}
                          >
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <TableSortLabel
                                active={isSorted}
                                direction={isSorted ? sortConfig.direction : 'asc'}
                                sx={{ '& .MuiTableSortLabel-icon': { opacity: isSorted ? 1 : 0.3 } }}
                              >
                                {SHARE_FIELD_LABELS[col] || col}
                              </TableSortLabel>
                              {isFilterable && (
                                <IconButton
                                  size="small"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFilterPopover({ anchorEl: e.currentTarget, column: col });
                                  }}
                                  sx={{ 
                                    ml: 0.5, 
                                    p: 0.25,
                                    color: hasFilter ? 'primary.main' : 'text.secondary',
                                  }}
                                >
                                  <FilterListIcon fontSize="small" />
                                </IconButton>
                              )}
                              <DragIndicatorIcon 
                                fontSize="small" 
                                sx={{ 
                                  opacity: 0.3, 
                                  ml: 'auto',
                                  cursor: 'col-resize',
                                }} 
                              />
                            </Box>
                          </ResizableHeader>
                        );
                      })}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasksLoading ? (
                      <TableRow>
                        <TableCell colSpan={columns.length + 1} align="center">
                          <Box sx={{ py: 4 }}>
                            <CircularProgress size={28} />
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : processedTasks.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={columns.length + 1} align="center">
                          <Box sx={{ py: 4 }}>
                            <Typography variant="body2" color="text.secondary">
                              {tasks.length === 0 ? 'No tasks to display.' : 'No tasks match your filters.'}
                            </Typography>
                            {tasks.length > 0 && activeFilterCount > 0 && (
                              <Button size="small" sx={{ mt: 1 }} onClick={clearAllFilters}>
                                Clear Filters
                              </Button>
                            )}
                          </Box>
                        </TableCell>
                      </TableRow>
                    ) : groupedTasks ? (
                      // Grouped view
                      groupedTasks.map(([groupKey, groupTasks]) => {
                        const isCollapsed = collapsedGroups.has(groupKey);
                        const selectedInGroup = groupTasks.filter((_, i) => 
                          selectedRows.has(`${groupKey}-${i}`)
                        ).length;

                        return (
                          <React.Fragment key={groupKey}>
                            <GroupHeaderRow
                              groupName={groupByColumn}
                              groupValue={groupKey}
                              taskCount={groupTasks.length}
                              columns={columns}
                              isExpanded={!isCollapsed}
                              onToggle={() => toggleGroupCollapse(groupKey)}
                              selectedInGroup={selectedInGroup}
                              onSelectGroup={(select) => handleSelectGroup(groupKey, groupTasks, select)}
                              darkMode={darkMode}
                            />
                            {!isCollapsed && groupTasks.map((task, index) => 
                              renderTableRow(task, index, true, groupKey)
                            )}
                          </React.Fragment>
                        );
                      })
                    ) : (
                      // Flat view
                      processedTasks.map((task, index) => renderTableRow(task, index))
                    )}
                  </TableBody>
                </Table>
              </TableContainer>

              {/* Footer */}
              <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  {processedTasks.length} of {tasks.length} tasks displayed
                  {sortConfig.key && ` • Sorted by ${SHARE_FIELD_LABELS[sortConfig.key] || sortConfig.key}`}
                  {groupByColumn && ` • Grouped by ${SHARE_FIELD_LABELS[groupByColumn] || groupByColumn}`}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Powered by JNB Teams
                </Typography>
              </Box>
            </>
          )}
        </Box>

        {/* Column Filter Popover */}
        <ColumnFilterPopover
          anchorEl={filterPopover.anchorEl}
          open={Boolean(filterPopover.anchorEl)}
          onClose={() => setFilterPopover({ anchorEl: null, column: null })}
          column={filterPopover.column}
          tasks={tasks}
          selectedValues={columnFilters[filterPopover.column] || []}
          onFilterChange={handleColumnFilterChange}
        />

        {/* Snackbar for copy feedback */}
        <Snackbar
          open={snackbar.open}
          autoHideDuration={3000}
          onClose={() => setSnackbar({ open: false, message: '' })}
          message={snackbar.message}
        />
      </Box>
    </ThemeProvider>
  );
}
