import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  IconButton,
  Chip,
  Tooltip,
  Badge,
} from '@mui/material';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import TodayIcon from '@mui/icons-material/Today';
import RepeatIcon from '@mui/icons-material/Repeat';
import WarningIcon from '@mui/icons-material/Warning';
import {
  format,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  addMonths,
  subMonths,
  isSameMonth,
  isSameDay,
  isToday,
  parseISO,
  isValid,
} from 'date-fns';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

function TasksCalendarView({ tasks, date, onDateChange, onTaskClick, getTaskIndicators }) {
  const [hoveredDay, setHoveredDay] = useState(null);
  
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = endOfWeek(monthEnd);
  
  // Group tasks by date
  const tasksByDate = useMemo(() => {
    const map = {};
    tasks.forEach(task => {
      if (task.due_date) {
        const dateKey = task.due_date.split('T')[0];
        if (!map[dateKey]) map[dateKey] = [];
        map[dateKey].push(task);
      }
    });
    return map;
  }, [tasks]);
  
  // Generate calendar days
  const calendarDays = useMemo(() => {
    const days = [];
    let day = calendarStart;
    
    while (day <= calendarEnd) {
      days.push(day);
      day = addDays(day, 1);
    }
    
    return days;
  }, [calendarStart, calendarEnd]);
  
  // Generate weeks for grid
  const weeks = useMemo(() => {
    const result = [];
    for (let i = 0; i < calendarDays.length; i += 7) {
      result.push(calendarDays.slice(i, i + 7));
    }
    return result;
  }, [calendarDays]);
  
  const handlePrevMonth = () => {
    onDateChange(subMonths(date, 1));
  };
  
  const handleNextMonth = () => {
    onDateChange(addMonths(date, 1));
  };
  
  const handleToday = () => {
    onDateChange(new Date());
  };
  
  const getTasksForDay = (day) => {
    const dateKey = format(day, 'yyyy-MM-dd');
    return tasksByDate[dateKey] || [];
  };
  
  const renderTaskChip = (task) => {
    const indicators = getTaskIndicators(task);
    const priorityColor = getPriorityColor(task.priority);
    const isOverdue = indicators.some(i => i.type === 'overdue');
    
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
          onClick={(e) => {
            e.stopPropagation();
            onTaskClick(task);
          }}
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.25,
            mb: 0.5,
            borderRadius: 1,
            bgcolor: getStatusBgColor(task.status),
            borderLeft: `3px solid ${priorityColor}`,
            cursor: 'pointer',
            overflow: 'hidden',
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
              fontSize: '0.7rem',
              fontWeight: 500,
              color: isOverdue ? '#dc2626' : 'text.primary',
            }}
          >
            {task.name}
          </Typography>
          {indicators.map((ind, idx) => (
            <Box
              key={idx}
              sx={{
                display: 'flex',
                color: ind.type === 'overdue' ? '#dc2626' :
                       ind.type === 'recurring' ? '#7c3aed' : '#2563eb',
                fontSize: '0.7rem',
              }}
            >
              {React.cloneElement(ind.icon, { sx: { fontSize: '0.85rem' } })}
            </Box>
          ))}
        </Box>
      </Tooltip>
    );
  };
  
  const renderDay = (day) => {
    const dayTasks = getTasksForDay(day);
    const isCurrentMonth = isSameMonth(day, date);
    const isCurrentDay = isToday(day);
    const isHovered = hoveredDay && isSameDay(hoveredDay, day);
    const hasMoreTasks = dayTasks.length > 3;
    const visibleTasks = dayTasks.slice(0, 3);
    
    return (
      <Box
        key={day.toISOString()}
        onMouseEnter={() => setHoveredDay(day)}
        onMouseLeave={() => setHoveredDay(null)}
        sx={{
          flex: 1,
          minHeight: 120,
          border: '1px solid #e2e8f0',
          borderRadius: 0,
          p: 0.5,
          bgcolor: isCurrentMonth ? '#fff' : '#f8fafc',
          opacity: isCurrentMonth ? 1 : 0.6,
          transition: 'all 0.15s ease',
          '&:hover': {
            bgcolor: '#f1f5f9',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography
            variant="caption"
            sx={{
              width: 24,
              height: 24,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '50%',
              fontWeight: isCurrentDay ? 700 : 500,
              bgcolor: isCurrentDay ? '#0f766e' : 'transparent',
              color: isCurrentDay ? '#fff' : isCurrentMonth ? 'text.primary' : 'text.secondary',
            }}
          >
            {format(day, 'd')}
          </Typography>
          {dayTasks.length > 0 && (
            <Badge
              badgeContent={dayTasks.length}
              color="primary"
              sx={{
                '& .MuiBadge-badge': {
                  fontSize: '0.65rem',
                  height: 16,
                  minWidth: 16,
                },
              }}
            />
          )}
        </Box>
        
        <Box sx={{ overflow: 'hidden' }}>
          {visibleTasks.map(task => renderTaskChip(task))}
          {hasMoreTasks && (
            <Typography
              variant="caption"
              sx={{
                display: 'block',
                textAlign: 'center',
                color: 'text.secondary',
                fontSize: '0.65rem',
              }}
            >
              +{dayTasks.length - 3} more
            </Typography>
          )}
        </Box>
      </Box>
    );
  };
  
  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Calendar Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          p: 2,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <IconButton onClick={handlePrevMonth} size="small">
            <ChevronLeftIcon />
          </IconButton>
          <IconButton onClick={handleNextMonth} size="small">
            <ChevronRightIcon />
          </IconButton>
          <Typography variant="h6" fontWeight={600}>
            {format(date, 'MMMM yyyy')}
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Tooltip title="Go to today">
            <IconButton onClick={handleToday} size="small">
              <TodayIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>
      
      {/* Calendar Grid */}
      <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Weekday Headers */}
        <Box sx={{ display: 'flex', borderBottom: '1px solid #e2e8f0' }}>
          {WEEKDAYS.map(day => (
            <Box
              key={day}
              sx={{
                flex: 1,
                py: 1,
                textAlign: 'center',
                bgcolor: '#f8fafc',
                fontWeight: 600,
                fontSize: '0.75rem',
                color: 'text.secondary',
              }}
            >
              {day}
            </Box>
          ))}
        </Box>
        
        {/* Calendar Weeks */}
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'auto' }}>
          {weeks.map((week, weekIdx) => (
            <Box
              key={weekIdx}
              sx={{
                display: 'flex',
                flex: 1,
                minHeight: 120,
              }}
            >
              {week.map(day => renderDay(day))}
            </Box>
          ))}
        </Box>
      </Box>
      
      {/* Legend */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 1,
          borderTop: '1px solid #e2e8f0',
          bgcolor: '#f8fafc',
        }}
      >
        <Typography variant="caption" color="text.secondary" fontWeight={500}>
          Priority:
        </Typography>
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
        <Box sx={{ flex: 1 }} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <RepeatIcon fontSize="small" sx={{ color: '#7c3aed' }} />
          <Typography variant="caption" color="text.secondary">Recurring</Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <WarningIcon fontSize="small" sx={{ color: '#dc2626' }} />
          <Typography variant="caption" color="text.secondary">Overdue</Typography>
        </Box>
      </Box>
    </Paper>
  );
}

export default TasksCalendarView;
