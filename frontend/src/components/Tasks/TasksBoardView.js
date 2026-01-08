import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  Avatar,
  IconButton,
  Tooltip,
  Card,
  CardContent,
  Badge,
} from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import RepeatIcon from '@mui/icons-material/Repeat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import FolderIcon from '@mui/icons-material/Folder';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import { format, parseISO, isValid } from 'date-fns';

const STATUS_COLUMNS = [
  { id: 'Open', label: 'Open', color: '#2563eb', bg: '#eff6ff' },
  { id: 'In Progress', label: 'In Progress', color: '#d97706', bg: '#fef3c7' },
  { id: 'Under Review', label: 'Under Review', color: '#9333ea', bg: '#f3e8ff' },
  { id: 'Completed', label: 'Completed', color: '#16a34a', bg: '#dcfce7' },
  { id: 'Closed', label: 'Closed', color: '#64748b', bg: '#f1f5f9' },
];

const PRIORITY_COLUMNS = [
  { id: 'Critical', label: 'Critical', color: '#dc2626', bg: '#fef2f2' },
  { id: 'High', label: 'High', color: '#ea580c', bg: '#fff7ed' },
  { id: 'Medium', label: 'Medium', color: '#ca8a04', bg: '#fefce8' },
  { id: 'Low', label: 'Low', color: '#16a34a', bg: '#f0fdf4' },
];

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'Critical': return { color: '#dc2626', bg: '#fef2f2' };
    case 'High': return { color: '#ea580c', bg: '#fff7ed' };
    case 'Medium': return { color: '#ca8a04', bg: '#fefce8' };
    case 'Low': return { color: '#16a34a', bg: '#f0fdf4' };
    default: return { color: '#64748b', bg: '#f8fafc' };
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  if (!isValid(date)) return null;
  return format(date, 'MMM d, yyyy');
};

const isToday = (dateStr) => {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    return d.getFullYear() === now.getFullYear()
      && d.getMonth() === now.getMonth()
      && d.getDate() === now.getDate();
  } catch (e) {
    return false;
  }
};

function TasksBoardView({
  tasks,
  groupBy = 'status',
  groupMetadata,
  onTaskClick,
  onTaskEdit,
  onTaskDrop,
  getTaskIndicators,
}) {
  const [draggedTask, setDraggedTask] = useState(null);
  const [dragOverColumn, setDragOverColumn] = useState(null);

  // Determine columns based on groupBy
  const columns = useMemo(() => {
    if (groupBy === 'status') return STATUS_COLUMNS;
    if (groupBy === 'priority') return PRIORITY_COLUMNS;
    
    // For project/assignee grouping, build columns from metadata
    if (groupMetadata?.groups) {
      return groupMetadata.groups.map(g => ({
        id: g.id || g.status || g.priority || 'ungrouped',
        label: g.name || g.status || g.priority || 'Unassigned',
        color: '#0f766e',
        bg: '#f0fdfa',
      }));
    }
    
    return STATUS_COLUMNS;
  }, [groupBy, groupMetadata]);

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach(col => {
      map[col.id] = [];
    });
    
    tasks.forEach(task => {
      let key;
      switch (groupBy) {
        case 'status':
          key = task.status;
          break;
        case 'priority':
          key = task.priority;
          break;
        case 'project':
          key = task.project_id;
          break;
        case 'assignee':
          key = task.assignee_id || 'ungrouped';
          break;
        default:
          key = task.status;
      }
      
      if (map[key]) {
        map[key].push(task);
      } else if (map['ungrouped']) {
        map['ungrouped'].push(task);
      }
    });
    
    return map;
  }, [tasks, columns, groupBy]);

  // Drag and drop handlers
  const handleDragStart = (e, task) => {
    setDraggedTask(task);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = (e, columnId) => {
    e.preventDefault();
    setDragOverColumn(null);
    
    if (draggedTask && draggedTask[groupBy === 'status' ? 'status' : groupBy === 'priority' ? 'priority' : 'project_id'] !== columnId) {
      const updates = {};
      if (groupBy === 'status') updates.status = columnId;
      else if (groupBy === 'priority') updates.priority = columnId;
      
      if (Object.keys(updates).length > 0) {
        onTaskDrop([draggedTask.id], updates);
      }
    }
    
    setDraggedTask(null);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
    setDragOverColumn(null);
  };

  const renderTaskCard = (task) => {
    const indicators = getTaskIndicators(task);
    const priorityStyle = getPriorityColor(task.priority);
    const isDragging = draggedTask?.id === task.id;
    
    return (
      <Card
        key={task.id}
        draggable
        onDragStart={(e) => handleDragStart(e, task)}
        onDragEnd={handleDragEnd}
        onClick={() => onTaskClick(task)}
        sx={{
          mb: 1.5,
          cursor: 'grab',
          transition: 'all 0.2s ease',
          opacity: isDragging ? 0.5 : 1,
          transform: isDragging ? 'rotate(3deg)' : 'none',
          '&:hover': {
            boxShadow: 2,
            transform: 'translateY(-2px)',
          },
          '&:active': {
            cursor: 'grabbing',
          },
        }}
      >
        <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
          {/* Project Tag */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <Chip
              size="small"
              icon={<FolderIcon sx={{ fontSize: '0.85rem !important' }} />}
              label={task.project_name}
              sx={{
                height: 20,
                fontSize: '0.65rem',
                bgcolor: '#f1f5f9',
                '& .MuiChip-label': { px: 0.5 },
                '& .MuiChip-icon': { ml: 0.5 },
              }}
            />
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                onTaskEdit(task);
              }}
              sx={{ p: 0.25 }}
            >
              <EditIcon sx={{ fontSize: '0.9rem' }} />
            </IconButton>
          </Box>
          
          {/* Task Name */}
          <Typography
            variant="body2"
            fontWeight={500}
            sx={{
              mb: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              lineHeight: 1.3,
            }}
          >
            {task.name}
          </Typography>
          
          {/* Task Indicators */}
          {indicators.length > 0 && (
            <Box sx={{ display: 'flex', gap: 0.5, mb: 1 }}>
              {indicators.map((ind, idx) => (
                <Tooltip key={idx} title={ind.label}>
                  <Chip
                    size="small"
                    icon={ind.icon}
                    label={ind.label}
                    sx={{
                      height: 18,
                      fontSize: '0.6rem',
                      bgcolor: ind.type === 'overdue' ? '#fef2f2' :
                               ind.type === 'recurring' ? '#f3e8ff' :
                               '#eff6ff',
                      color: ind.type === 'overdue' ? '#dc2626' :
                             ind.type === 'recurring' ? '#7c3aed' :
                             '#2563eb',
                      '& .MuiChip-icon': { fontSize: '0.75rem' },
                      '& .MuiChip-label': { px: 0.5 },
                    }}
                  />
                </Tooltip>
              ))}
            </Box>
          )}
          
          {/* Bottom Row: Stage, Priority, Target/Due Date, Assignee, Created */}
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
            {/* Priority Badge */}
            {groupBy !== 'priority' && (
              <Chip
                size="small"
                label={task.priority}
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  bgcolor: priorityStyle.bg,
                  color: priorityStyle.color,
                  fontWeight: 600,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}
            {/* Stage */}
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', mr: 1 }}>
              <Typography variant="caption" noWrap sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{task.stage || task.stage_name || ''}</Typography>
              <Typography variant="caption" noWrap sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>{task.target_date ? `Target: ${formatDate(task.target_date)}` : ''}</Typography>
            </Box>

            {/* Due Date */}
            {task.due_date && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    color: task.is_overdue ? '#dc2626' : 'text.secondary',
                    fontWeight: task.is_overdue ? 600 : 400,
                  }}
                >
                  {formatDate(task.due_date)}
                </Typography>
                {isToday(task.due_date) && <CalendarTodayIcon sx={{ color: '#dc2626', fontSize: '0.9rem' }} />}
              </Box>
            )}
            
            {/* Assignee Avatar */}
            <Box sx={{ flex: 1 }} />
              {task.assignee_name ? (
              <Tooltip title={task.assignee_name}>
                <Avatar
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: '0.65rem',
                    bgcolor: '#0f766e',
                  }}
                >
                  {task.assignee_name.charAt(0)}
                </Avatar>
              </Tooltip>
            ) : (
              <Tooltip title="Unassigned">
                <Avatar
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: '0.65rem',
                    bgcolor: '#e2e8f0',
                    color: '#94a3b8',
                  }}
                >
                  ?
                </Avatar>
              </Tooltip>
            )}
            {/* Collaborators */}
            <Box sx={{ ml: 1, display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {task.collaborators && task.collaborators.slice(0,3).map((c, i) => (
                <Tooltip key={i} title={c.name || c.email || ''}>
                  <Avatar sx={{ width: 18, height: 18, fontSize: '0.6rem', bgcolor: '#6b7280' }}>{(c.name || c.email || '?').charAt(0)}</Avatar>
                </Tooltip>
              ))}
              {task.collaborators && task.collaborators.length > 3 && (
                <Typography variant="caption">+{task.collaborators.length - 3}</Typography>
              )}
            </Box>

            {/* Created info */}
            <Box sx={{ ml: 1, textAlign: 'right' }}>
              <Typography variant="caption" noWrap sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>{task.created_at ? format(new Date(task.created_at), 'MMM d, yyyy') : ''}</Typography>
              <Typography variant="caption" noWrap sx={{ display: 'block', fontSize: '0.6rem', color: 'text.secondary' }}>{task.created_by_name || ''}</Typography>
            </Box>
          </Box>
        </CardContent>
      </Card>
    );
  };

  const renderColumn = (column) => {
    const columnTasks = tasksByColumn[column.id] || [];
    const isDragOver = dragOverColumn === column.id;
    
    return (
      <Box
        key={column.id}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column.id)}
        sx={{
          width: 280,
          minWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: isDragOver ? 'rgba(15, 118, 110, 0.1)' : '#f8fafc',
          borderRadius: 2,
          transition: 'background-color 0.2s ease',
        }}
      >
        {/* Column Header */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            p: 1.5,
            borderBottom: `3px solid ${column.color}`,
          }}
        >
          <Box
            sx={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              bgcolor: column.color,
            }}
          />
          <Typography variant="subtitle2" fontWeight={600} sx={{ flex: 1 }}>
            {column.label}
          </Typography>
          <Badge
            badgeContent={columnTasks.length}
            color="default"
            sx={{
              '& .MuiBadge-badge': {
                bgcolor: '#e2e8f0',
                color: '#475569',
                fontSize: '0.7rem',
              },
            }}
          />
        </Box>
        
        {/* Column Tasks */}
        <Box
          sx={{
            flex: 1,
            p: 1,
            overflowY: 'auto',
            minHeight: 100,
          }}
        >
          {columnTasks.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 80,
                border: '2px dashed #e2e8f0',
                borderRadius: 2,
                color: 'text.secondary',
              }}
            >
              <Typography variant="caption">No tasks</Typography>
            </Box>
          ) : (
            columnTasks.map(task => renderTaskCard(task))
          )}
        </Box>
      </Box>
    );
  };

  return (
    <Paper
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      {/* Board Header */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          p: 2,
          borderBottom: '1px solid #e2e8f0',
        }}
      >
        <Typography variant="subtitle2" color="text.secondary">
          Grouped by: <strong style={{ color: '#0f766e' }}>{groupBy}</strong>
        </Typography>
        <Box sx={{ flex: 1 }} />
        <Typography variant="caption" color="text.secondary">
          Drag tasks between columns to update {groupBy}
        </Typography>
      </Box>
      
      {/* Board Columns */}
      <Box
        sx={{
          flex: 1,
          display: 'flex',
          gap: 2,
          p: 2,
          overflowX: 'auto',
          overflowY: 'hidden',
        }}
      >
        {columns.map(column => renderColumn(column))}
      </Box>
    </Paper>
  );
}

export default TasksBoardView;
