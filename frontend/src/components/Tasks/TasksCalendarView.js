import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Badge,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  ListItemButton,
  Divider,
  ToggleButton,
  ToggleButtonGroup,
  FormControl,
  Select,
  MenuItem,
  Checkbox,
  Menu,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import RepeatIcon from '@mui/icons-material/Repeat';
import WarningIcon from '@mui/icons-material/Warning';
import CalendarViewMonthIcon from '@mui/icons-material/CalendarViewMonth';
import CalendarViewWeekIcon from '@mui/icons-material/CalendarViewWeek';
import CalendarViewDayIcon from '@mui/icons-material/CalendarViewDay';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import FilterListIcon from '@mui/icons-material/FilterList';
import ViewCompactIcon from '@mui/icons-material/ViewCompact';
import ViewComfyIcon from '@mui/icons-material/ViewComfy';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  addWeeks,
  subWeeks,
  isSameMonth,
  isSameDay,
  isToday,
  isValid,
  startOfDay,
} from 'date-fns';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAYS_FULL = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'Critical': return '#dc2626';
    case 'High': return '#ea580c';
    case 'Medium': return '#ca8a04';
    case 'Low': return '#16a34a';
    default: return '#64748b';
  }
};

const getStatusBgColor = (status) => {
  switch (status) {
    case 'Open': return '#eff6ff';
    case 'In Progress': return '#fef3c7';
    case 'Under Review': return '#f3e8ff';
    case 'Completed': return '#dcfce7';
    case 'Closed': return '#f1f5f9';
    default: return '#f8fafc';
  }
};

// Get color for tasks based on date
const getTaskDateColor = (dateStr) => {
  const today = format(new Date(), 'yyyy-MM-dd');
  const taskDate = dateStr;
  
  if (taskDate < today) return '#dc2626'; // Overdue - red
  if (taskDate === today) return '#f97316'; // Due today - orange
  
  const taskDateObj = parseDateOnly(taskDate);
  const todayObj = parseDateOnly(today);
  const daysDiff = taskDateObj && todayObj
    ? Math.floor((taskDateObj - todayObj) / (1000 * 60 * 60 * 24))
    : 0;
  if (daysDiff <= 3) return '#3b82f6'; // Upcoming (next 3 days) - blue
  
  return '#64748b'; // Future - gray
};

// Safe date parser - prevents timezone issues
const parseDateOnly = (dateStr) => {
  if (!dateStr) return null;
  const [year, month, day] = dateStr.split('T')[0].split('-').map(Number);
  return new Date(year, month - 1, day, 12, 0, 0); // Noon to prevent UTC crossing
};

// Format date to YYYY-MM-DD
const formatDateOnly = (date) => {
  if (!date) return null;
  const d = date instanceof Date ? date : new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateKey = (dateValue) => {
  if (!dateValue) return null;
  if (dateValue instanceof Date) return formatDateOnly(dateValue);
  if (typeof dateValue === 'string') {
    if (!dateValue.includes('T')) return dateValue;
    const [isoDate, timePartRaw = ''] = dateValue.split('T');
    const timePart = timePartRaw.toUpperCase();
    const isMidnightUtc = timePart.startsWith('00:00:00')
      && (timePart.includes('Z') || timePart.includes('+00') || timePart.includes('-00'));
    if (isMidnightUtc) return isoDate;
    const parsed = new Date(dateValue);
    if (isValid(parsed)) return formatDateOnly(parsed);
    return isoDate;
  }
  return null;
};

function TasksCalendarView({ tasks, date, onDateChange, onTaskClick, getTaskIndicators, onTaskUpdate }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  const [dateMode, setDateMode] = useState(() => {
    return localStorage.getItem('calendarDateMode') || 'due';
  });
  const [calendarView, setCalendarView] = useState('month');
  const [selectedDate, setSelectedDate] = useState(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('calendarDensity') || 'comfortable';
  });
  const [filterAnchor, setFilterAnchor] = useState(null);
  const [statusFilter, setStatusFilter] = useState([]);
  const [priorityFilter, setPriorityFilter] = useState([]);
  const [draggedTask, setDraggedTask] = useState(null);
  
  // Handle date mode change
  const handleDateModeChange = (event, newMode) => {
    if (newMode !== null) {
      setDateMode(newMode);
      localStorage.setItem('calendarDateMode', newMode);
    }
  };

  // Handle density change
  const handleDensityChange = (newDensity) => {
    setDensity(newDensity);
    localStorage.setItem('calendarDensity', newDensity);
  };

  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  // Filter tasks
  const filteredTasks = useMemo(() => {
    let filtered = tasks;
    
    if (statusFilter.length > 0) {
      filtered = filtered.filter(t => statusFilter.includes(t.status));
    }
    
    if (priorityFilter.length > 0) {
      filtered = filtered.filter(t => priorityFilter.includes(t.priority));
    }
    
    return filtered;
  }, [tasks, statusFilter, priorityFilter]);

  // Recompute tasks by date with filtered tasks
  const filteredTasksByDate = useMemo(() => {
    const map = {};
    filteredTasks.forEach(task => {
      const dateField = dateMode === 'due' ? task.due_date : task.target_date;
      const dateKey = getDateKey(dateField);
      if (!dateKey) return;
      if (!map[dateKey]) map[dateKey] = [];
      map[dateKey].push(task);
    });
    return map;
  }, [filteredTasks, dateMode]);

  // Generate calendar days based on view
  const calendarDays = useMemo(() => {
    const days = [];
    
    if (calendarView === 'month') {
      let day = calendarStart;
      while (day <= calendarEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
    } else if (calendarView === 'week') {
      const weekStart = startOfWeek(date);
      const weekEnd = endOfWeek(date);
      let day = weekStart;
      while (day <= weekEnd) {
        days.push(day);
        day = addDays(day, 1);
      }
    } else if (calendarView === 'day') {
      days.push(startOfDay(date));
    }
    
    return days;
  }, [calendarStart, calendarEnd, date, calendarView]);
  
  // Generate weeks for grid
  const weeks = useMemo(() => {
    if (calendarView === 'day') {
      return [[calendarDays[0]]];
    }
    if (calendarView === 'week') {
      return [calendarDays];
    }
    const result = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays, calendarView]);
  
  const handlePrev = () => {
    if (calendarView === 'month') {
      onDateChange(subMonths(date, 1));
    } else if (calendarView === 'week') {
      onDateChange(subWeeks(date, 1));
    } else {
      onDateChange(addDays(date, -1));
    }
  };
  
  const handleNext = () => {
    if (calendarView === 'month') {
      onDateChange(addMonths(date, 1));
    } else if (calendarView === 'week') {
      onDateChange(addWeeks(date, 1));
    } else {
      onDateChange(addDays(date, 1));
    }
  };
  
  const handleToday = () => {
    onDateChange(new Date());
  };
  
  const getTasksForDay = (day) => {
    const dateKey = formatDateOnly(day);
    return filteredTasksByDate[dateKey] || [];
  };

  // Open date dialog
  const handleDateClick = (day) => {
    setSelectedDate(day);
    setDialogOpen(true);
  };

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = async (e, day) => {
    e.preventDefault();
    if (!draggedTask || !onTaskUpdate) return;

    const newDateStr = format(day, 'yyyy-MM-dd');
    const updates = {};
    
    if (dateMode === 'due') {
      updates.due_date = newDateStr;
    } else {
      updates.target_date = newDateStr;
    }

    try {
      await onTaskUpdate(draggedTask.id, updates);
    } catch (err) {
      console.error('Failed to update task date:', err);
    }

    setDraggedTask(null);
  };
  
  const renderTaskChip = (task, isCompact = false) => {
    const indicators = getTaskIndicators(task);
    const priorityColor = getPriorityColor(task.priority);
    const isOverdue = indicators.some(i => i.type === 'overdue');
    const isRecurring = indicators.some(i => i.type === 'recurring');
    
    const dateField = dateMode === 'due' ? task.due_date : task.target_date;
    const dateStr = getDateKey(dateField);
    const dateColor = dateStr ? getTaskDateColor(dateStr) : '#64748b';
    
    return (
      <Tooltip
        key={task.id}
        title={
          <Box>
            <Typography variant="body2" fontWeight={600}>{task.name}</Typography>
            <Typography variant="caption" display="block">Project: {task.project_name}</Typography>
            <Typography variant="caption" display="block">Status: {task.status}</Typography>
            <Typography variant="caption" display="block">Priority: {task.priority}</Typography>
            {task.assignee_name && (
              <Typography variant="caption" display="block">Assignee: {task.assignee_name}</Typography>
            )}
          </Box>
        }
      >
        <Box
          draggable
          onDragStart={(e) => handleDragStart(e, task)}
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(task);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: isCompact ? 0.75 : 1,
            py: isCompact ? 0.2 : 0.25,
            mb: isCompact ? 0.25 : 0.5,
            borderRadius: 1,
            bgcolor: task.status === 'Completed' ? '#f1f5f9' : getStatusBgColor(task.status),
            borderLeft: `3px solid ${priorityColor}`,
            cursor: 'pointer',
            overflow: 'hidden',
            opacity: task.status === 'Completed' ? 0.7 : 1,
            '&:hover': {
              bgcolor: '#e2e8f0',
            },
          }}
        >
          <Typography
            variant="caption"
            sx={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: isCompact ? '0.65rem' : '0.7rem',
              fontWeight: 500,
              color: task.status === 'Completed' ? 'text.secondary' : dateColor,
              textDecoration: task.status === 'Completed' ? 'line-through' : 'none',
            }}
          >
            {task.name}
          </Typography>
          {/* Icons aligned to right */}
          <Box sx={{ display: 'flex', gap: 0.25, alignItems: 'center' }}>
            {isRecurring && (
              <RepeatIcon sx={{ fontSize: isCompact ? '0.75rem' : '0.85rem', color: '#7c3aed' }} />
            )}
            {isOverdue && (
              <WarningIcon sx={{ fontSize: isCompact ? '0.75rem' : '0.85rem', color: '#dc2626' }} />
            )}
          </Box>
        </Box>
      </Tooltip>
    );
  };
  
  const renderDay = (day) => {
    const dayTasks = getTasksForDay(day);
    const isCurrentMonth = isSameMonth(day, date);
    const isCurrentDay = isToday(day);
    
    const isCompact = density === 'compact';
    const maxVisible = isCompact ? 2 : (calendarView === 'month' ? 3 : 8);
    const hasMoreTasks = dayTasks.length > maxVisible;
    const visibleTasks = dayTasks.slice(0, maxVisible);
    
    const minHeight = calendarView === 'day' ? 400 : (isCompact ? 100 : 120);
    
    return (
      <Box
        key={day.toISOString()}
        onMouseEnter={() => setHoveredDay(day)}
        onMouseLeave={() => setHoveredDay(null)}
        onDragOver={handleDragOver}
        onDrop={(e) => handleDrop(e, day)}
        sx={{
          flex: 1,
          minHeight: minHeight,
          border: '1px solid #e2e8f0',
          borderRadius: 0,
          p: 0.5,
          bgcolor: isCurrentDay ? '#fef2f2' : (isCurrentMonth ? '#fff' : '#f8fafc'),
          opacity: isCurrentMonth ? 1 : 0.6,
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: isCurrentDay ? '#fee2e2' : '#f1f5f9',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography
            variant="caption"
            onClick={(e) => {
              e.stopPropagation();
              handleDateClick(day);
            }}
            sx={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              fontWeight: isCurrentDay ? 700 : 500,
              bgcolor: isCurrentDay ? '#dc2626' : 'transparent',
              color: isCurrentDay ? '#fff' : isCurrentMonth ? 'text.primary' : 'text.secondary',
              cursor: 'pointer',
              '&:hover': {
                bgcolor: isCurrentDay ? '#b91c1c' : '#e2e8f0',
              },
            }}
          >
            {format(day, 'd')}
          </Typography>
          {dayTasks.length > 0 && (
            <Badge
              badgeContent={dayTasks.length}
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  height: 16,
                  minWidth: 16,
                  bgcolor: isCurrentDay ? '#dc2626' : '#2563eb',
                  color: '#fff',
                  border: isCurrentDay ? '1px solid #dc2626' : 'none',
                },
              }}
            />
          )}
        </Box>
        
        <Box sx={{ overflow: 'hidden' }}>
          {visibleTasks.map(task => renderTaskChip(task, isCompact))}
          {hasMoreTasks && (
            <Typography
              variant="caption"
              onClick={(e) => {
                e.stopPropagation();
                handleDateClick(day);
              }}
              sx={{
                display: 'block',
                textAlign: 'center',
                color: 'text.secondary',
                fontSize: '0.65rem',
                cursor: 'pointer',
                '&:hover': {
                  color: 'primary.main',
                  fontWeight: 600,
                },
              }}
            >
              +{dayTasks.length - maxVisible} more
            </Typography>
          )}
        </Box>
      </Box>
    );
  };
  
  // Render date dialog
  const renderDateDialog = () => {
    if (!selectedDate) return null;
    const dayTasks = getTasksForDay(selectedDate);
    const dateStr = format(selectedDate, 'dd MMM yyyy');
    const dayName = format(selectedDate, 'EEEE');
    
    return (
      <Dialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: { minHeight: 400, maxHeight: 600 }
        }}
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box>
              <Typography variant="h6" fontWeight={600}>
                Tasks for {dateStr}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {dayName} • {dateMode === 'due' ? 'Due Date' : 'Target Date'} • {dayTasks.length} task{dayTasks.length !== 1 ? 's' : ''}
              </Typography>
            </Box>
            <IconButton onClick={() => setDialogOpen(false)} size="small">
              <CloseIcon />
            </IconButton>
          </Box>
        </DialogTitle>
        <DialogContent dividers>
          {dayTasks.length === 0 ? (
            <Box sx={{ textAlign: 'center', py: 4 }}>
              <Typography variant="body2" color="text.secondary">
                No tasks for this date
              </Typography>
            </Box>
          ) : (
            <List sx={{ py: 0 }}>
              {dayTasks.map((task, idx) => {
                const priorityColor = getPriorityColor(task.priority);
                const indicators = getTaskIndicators(task);
                return (
                  <React.Fragment key={task.id}>
                    {idx > 0 && <Divider />}
                    <ListItem
                      disablePadding
                      secondaryAction={
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => {
                            setDialogOpen(false);
                            onTaskClick(task);
                          }}
                        >
                          <EditIcon fontSize="small" />
                        </IconButton>
                      }
                    >
                      <ListItemButton
                        onClick={() => {
                          setDialogOpen(false);
                          onTaskClick(task);
                        }}
                        sx={{ py: 1.5 }}
                      >
                        <Box sx={{ flex: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                            <Box
                              sx={{
                                width: 4,
                                height: 24,
                                bgcolor: priorityColor,
                                borderRadius: 1,
                              }}
                            />
                            <Typography variant="body2" fontWeight={500}>
                              {task.name}
                            </Typography>
                            {indicators.map((ind, i) => (
                              <Box key={i} sx={{ display: 'flex', color: ind.color }}>
                                {React.cloneElement(ind.icon, { sx: { fontSize: '1rem' } })}
                              </Box>
                            ))}
                          </Box>
                          <Box sx={{ display: 'flex', gap: 1, ml: 1.5, flexWrap: 'wrap' }}>
                            <Chip label={task.status} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                            <Chip label={task.priority} size="small" sx={{ height: 20, fontSize: '0.7rem' }} />
                            {task.project_name && (
                              <Chip label={task.project_name} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                            {task.assignee_name && (
                              <Chip label={task.assignee_name} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.7rem' }} />
                            )}
                          </Box>
                        </Box>
                      </ListItemButton>
                    </ListItem>
                  </React.Fragment>
                );
              })}
            </List>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    );
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Calendar Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          flexDirection: 'column',
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        {/* Top Row: Navigation & View Controls */}
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', px: 2, pt: 2, pb: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <IconButton onClick={handlePrev} size="small">
              <ChevronLeftIcon />
            </IconButton>
            <IconButton onClick={handleNext} size="small">
              <ChevronRightIcon />
            </IconButton>
            <Typography variant="h6" fontWeight={600} sx={{ minWidth: 180 }}>
              {calendarView === 'day' ? format(date, 'dd MMMM yyyy') : 
               calendarView === 'week' ? `${format(startOfWeek(date), 'dd MMM')} - ${format(endOfWeek(date), 'dd MMM yyyy')}` :
               format(date, 'MMMM yyyy')}
            </Typography>
            <Tooltip title="Go to today">
              <IconButton onClick={handleToday} size="small">
                <TodayIcon />
              </IconButton>
            </Tooltip>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {/* View Type Toggle */}
            <ToggleButtonGroup
              value={calendarView}
              exclusive
              onChange={(e, val) => val && setCalendarView(val)}
              size="small"
            >
              <ToggleButton value="day">
                <Tooltip title="Day View"><CalendarViewDayIcon fontSize="small" /></Tooltip>
              </ToggleButton>
              <ToggleButton value="week">
                <Tooltip title="Week View"><CalendarViewWeekIcon fontSize="small" /></Tooltip>
              </ToggleButton>
              <ToggleButton value="month">
                <Tooltip title="Month View"><CalendarViewMonthIcon fontSize="small" /></Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Density Toggle */}
            <ToggleButtonGroup
              value={density}
              exclusive
              onChange={(e, val) => val && handleDensityChange(val)}
              size="small"
            >
              <ToggleButton value="compact">
                <Tooltip title="Compact"><ViewCompactIcon fontSize="small" /></Tooltip>
              </ToggleButton>
              <ToggleButton value="comfortable">
                <Tooltip title="Comfortable"><ViewComfyIcon fontSize="small" /></Tooltip>
              </ToggleButton>
            </ToggleButtonGroup>

            <Divider orientation="vertical" flexItem sx={{ mx: 0.5 }} />

            {/* Filters Button */}
            <Tooltip title="Filters">
              <IconButton
                onClick={(e) => setFilterAnchor(e.currentTarget)}
                size="small"
                color={statusFilter.length > 0 || priorityFilter.length > 0 ? 'primary' : 'default'}
              >
                <Badge
                  badgeContent={(statusFilter.length || 0) + (priorityFilter.length || 0)}
                  color="primary"
                >
                  <FilterListIcon />
                </Badge>
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {/* Second Row: Due/Target Date Toggle */}
        <Box sx={{ display: 'flex', justifyContent: 'center', pb: 1.5 }}>
          <ToggleButtonGroup
            value={dateMode}
            exclusive
            onChange={handleDateModeChange}
            size="small"
            sx={{
              bgcolor: '#f1f5f9',
              borderRadius: 3,
              '& .MuiToggleButton-root': {
                border: 'none',
                borderRadius: 3,
                px: 2.5,
                py: 0.5,
                textTransform: 'none',
                fontWeight: 500,
                fontSize: '0.85rem',
                '&.Mui-selected': {
                  bgcolor: '#fff',
                  color: '#0f766e',
                  fontWeight: 600,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                  '&:hover': {
                    bgcolor: '#fff',
                  },
                },
              },
            }}
          >
            <ToggleButton value="due">Due Date</ToggleButton>
            <ToggleButton value="target">Target Date</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>
      
      {/* Calendar Grid */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Weekday Headers */}
        {calendarView !== 'day' && (
          <Box sx={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
            {(calendarView === 'week' ? WEEKDAYS_FULL : WEEKDAYS).map((day, idx) => (
              <Box
                key={day}
                sx={{
                  flex: 1,
                  py: 1,
                  textAlign: 'center',
                  bgcolor: '#f8fafc',
                  fontWeight: 600,
                  fontSize: calendarView === 'week' ? '0.8rem' : '0.75rem',
                  color: 'text.secondary',
                }}
              >
                {day}
              </Box>
            ))}
          </Box>
        )}
        
        {/* Calendar Weeks */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {weeks.map((week, weekIdx) => (
            <Box
              key={weekIdx}
              sx={{
                display: 'flex',
                flex: calendarView === 'month' ? 1 : 'auto',
                minHeight: density === 'compact' ? 100 : (calendarView === 'day' ? 400 : 120),
              }}
            >
              {week.map(day => renderDay(day))}
            </Box>
          ))}
        </Box>
      </Box>

      {/* Filter Menu */}
      <Menu
        anchorEl={filterAnchor}
        open={Boolean(filterAnchor)}
        onClose={() => setFilterAnchor(null)}
        PaperProps={{ sx: { width: 280, p: 2 } }}
      >
        <Typography variant="subtitle2" fontWeight={600} sx={{ mb: 1 }}>Filter Tasks</Typography>
        
        {/* Status Filter */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Status</Typography>
          <FormControl fullWidth size="small">
            <Select
              multiple
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              renderValue={(selected) => selected.length === 0 ? 'All' : `${selected.length} selected`}
              displayEmpty
            >
              {['Open', 'In Progress', 'Under Review', 'Completed', 'Closed'].map(status => (
                <MenuItem key={status} value={status}>
                  <Checkbox checked={statusFilter.includes(status)} size="small" />
                  <ListItemText primary={status} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        {/* Priority Filter */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>Priority</Typography>
          <FormControl fullWidth size="small">
            <Select
              multiple
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              renderValue={(selected) => selected.length === 0 ? 'All' : `${selected.length} selected`}
              displayEmpty
            >
              {['Critical', 'High', 'Medium', 'Low'].map(priority => (
                <MenuItem key={priority} value={priority}>
                  <Checkbox checked={priorityFilter.includes(priority)} size="small" />
                  <ListItemText primary={priority} />
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ my: 1 }} />
        
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            size="small"
            onClick={() => {
              setStatusFilter([]);
              setPriorityFilter([]);
            }}
            disabled={statusFilter.length === 0 && priorityFilter.length === 0}
          >
            Clear
          </Button>
          <Button
            size="small"
            variant="contained"
            onClick={() => setFilterAnchor(null)}
          >
            Apply
          </Button>
        </Box>
      </Menu>
      
      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1.5,
          borderTop: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
          flexWrap: 'wrap',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          Legend:
        </Typography>
        
        {/* Priority Colors */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>Priority:</Typography>
          {['Critical', 'High', 'Medium', 'Low'].map(priority => (
            <Box key={priority} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <Box
                sx={{
                  width: 12,
                  height: 12,
                  borderRadius: '2px',
                  bgcolor: getPriorityColor(priority),
                }}
              />
              <Typography variant="caption" color="text.secondary">
                {priority}
              </Typography>
            </Box>
          ))}
        </Box>
        
        <Divider orientation="vertical" flexItem />
        
        {/* Date-based Colors */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="caption" color="text.secondary" fontWeight={500}>Date:</Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#dc2626' }} />
            <Typography variant="caption" color="text.secondary">Overdue</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#f97316' }} />
            <Typography variant="caption" color="text.secondary">Today</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Box sx={{ width: 12, height: 12, borderRadius: '2px', bgcolor: '#3b82f6' }} />
            <Typography variant="caption" color="text.secondary">Next 3 days</Typography>
          </Box>
        </Box>
        
        <Divider orientation="vertical" flexItem />
        
        {/* Icons */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <RepeatIcon fontSize="small" sx={{ color: '#7c3aed' }} />
            <Typography variant="caption" color="text.secondary">Recurring</Typography>
          </Box>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <WarningIcon fontSize="small" sx={{ color: '#dc2626' }} />
            <Typography variant="caption" color="text.secondary">Overdue</Typography>
          </Box>
        </Box>
      </Box>
      
      {/* Date Dialog */}
      {renderDateDialog()}
    </Paper>
  );
}

export default TasksCalendarView;
