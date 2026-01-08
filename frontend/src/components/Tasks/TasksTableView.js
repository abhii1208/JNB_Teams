import React, { useState, useMemo } from 'react';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  TableSortLabel,
  Checkbox,
  Chip,
  Typography,
  IconButton,
  Avatar,
  Tooltip,
  Collapse,
  LinearProgress,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import RepeatIcon from '@mui/icons-material/Repeat';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import FolderIcon from '@mui/icons-material/Folder';
import { formatDistanceToNow, format, isValid, parseISO } from 'date-fns';

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'Critical': return { bg: '#fef2f2', color: '#dc2626', border: '#fecaca' };
    case 'High': return { bg: '#fff7ed', color: '#ea580c', border: '#fed7aa' };
    case 'Medium': return { bg: '#fefce8', color: '#ca8a04', border: '#fef08a' };
    case 'Low': return { bg: '#f0fdf4', color: '#16a34a', border: '#bbf7d0' };
    default: return { bg: '#f8fafc', color: '#64748b', border: '#e2e8f0' };
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case 'Open': return { bg: '#eff6ff', color: '#2563eb' };
    case 'In Progress': return { bg: '#fef3c7', color: '#d97706' };
    case 'Under Review': return { bg: '#f3e8ff', color: '#9333ea' };
    case 'Completed': return { bg: '#dcfce7', color: '#16a34a' };
    case 'Closed': return { bg: '#f1f5f9', color: '#64748b' };
    default: return { bg: '#f8fafc', color: '#64748b' };
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = parseISO(dateStr);
  if (!isValid(date)) return '-';
  return format(date, 'MMM d, yyyy');
};

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  if (!isValid(date)) return null;
  return formatDistanceToNow(date, { addSuffix: true });
};

const COLUMNS = [
  { id: 'name', label: 'Task', width: '24%', sortable: true },
  { id: 'project_name', label: 'Project', width: '12%', sortable: true },
  { id: 'stage', label: 'Stage', width: '8%', sortable: true },
  { id: 'status', label: 'Status', width: '8%', sortable: true },
  { id: 'priority', label: 'Priority', width: '8%', sortable: true },
  { id: 'assignee_name', label: 'Assignee', width: '10%', sortable: true },
  { id: 'collaborators', label: 'Collaborators', width: '8%', sortable: false },
  { id: 'target_date', label: 'Target Date', width: '8%', sortable: true },
  { id: 'due_date', label: 'Due Date', width: '8%', sortable: true },
  { id: 'created_at', label: 'Created', width: '8%', sortable: true },
  { id: 'created_by_name', label: 'Created By', width: '8%', sortable: true },
  { id: 'actions', label: '', width: '4%', sortable: false },
];

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

function TasksTableView({
  tasks,
  total,
  page,
  limit,
  groupBy,
  groupMetadata,
  selectedTasks,
  onSelectTasks,
  onPageChange,
  onLimitChange,
  onTaskClick,
  onTaskEdit,
  getTaskIndicators,
  loading,
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  
  // Group tasks if groupBy is set
  const groupedTasks = useMemo(() => {
    if (!groupBy || !(groupMetadata && groupMetadata.groups)) {
        return null;
      }
    
    const groups = {};
    groupMetadata.groups.forEach(g => {
      const key = g.id || g.status || g.priority || g.bucket || 'ungrouped';
      groups[key] = {
        ...g,
        tasks: [],
      };
    });
    
    tasks.forEach(task => {
      let key;
      switch (groupBy) {
        case 'project':
          key = task.project_id;
          break;
        case 'status':
          key = task.status;
          break;
        case 'priority':
          key = task.priority;
          break;
        case 'assignee':
          key = task.assignee_id || 'ungrouped';
          break;
        default:
          key = 'ungrouped';
      }
      
      if (groups[key]) {
        groups[key].tasks.push(task);
      }
    });
    
    return groups;
  }, [tasks, groupBy, groupMetadata]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups(prev => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const isSelected = (taskId) => selectedTasks.includes(taskId);

  const handleSelectAll = (event) => {
    if (event.target.checked) {
      onSelectTasks(tasks.map(t => t.id));
    } else {
      onSelectTasks([]);
    }
  };

  const handleSelectTask = (taskId) => {
    if (isSelected(taskId)) {
      onSelectTasks(selectedTasks.filter(id => id !== taskId));
    } else {
      onSelectTasks([...selectedTasks, taskId]);
    }
  };

  const renderTaskRow = (task) => {
    const priorityStyle = getPriorityColor(task.priority);
    const statusStyle = getStatusColor(task.status);
    const indicators = getTaskIndicators(task);
    const selected = isSelected(task.id);

    return (
      <TableRow
        key={task.id}
        hover
        selected={selected}
        onClick={() => onTaskClick(task)}
        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
      >
        <TableCell padding="checkbox" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={selected}
            onChange={() => handleSelectTask(task.id)}
            size="small"
          />
        </TableCell>

        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={500}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  textDecoration: task.status === 'Closed' ? 'line-through' : 'none',
                  color: task.status === 'Closed' ? 'text.secondary' : 'text.primary',
                }}
              >
                {task.name}
              </Typography>
              {task.description && (
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {task.description}
                </Typography>
              )}
            </Box>
            <Box sx={{ display: 'flex', gap: 0.5 }}>{indicators.map((ind, idx) => (
              <Tooltip key={idx} title={ind.label}><Box sx={{ display: 'flex', alignItems: 'center', color: ind.type === 'overdue' ? '#dc2626' : ind.type === 'recurring' ? '#7c3aed' : ind.type === 'approval' ? '#2563eb' : '#64748b' }}>{ind.icon}</Box></Tooltip>
            ))}</Box>
          </Box>
        </TableCell>

        <TableCell>
          <Chip size="small" icon={<FolderIcon fontSize="small" />} label={task.project_name} sx={{ bgcolor: '#f1f5f9', color: '#475569', maxWidth: '100%', '& .MuiChip-label': { overflow: 'hidden', textOverflow: 'ellipsis' }, whiteSpace: 'nowrap' }} />
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          <Typography variant="body2" noWrap>{task.stage || task.stage_name || '-'}</Typography>
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap', px: 1 }}>
          <Chip size="small" label={task.status} sx={{ bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 500 }} />
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap', px: 1 }}>
          <Chip size="small" label={task.priority} sx={{ bgcolor: priorityStyle.bg, color: priorityStyle.color, border: `1px solid ${priorityStyle.border}`, fontWeight: 500 }} />
        </TableCell>

        <TableCell>
          {task.assignee_name ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#0f766e' }}>{task.assignee_name.charAt(0)}</Avatar>
              <Typography variant="body2" noWrap>{task.assignee_name}</Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">Unassigned</Typography>
          )}
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          {task.collaborators && task.collaborators.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {task.collaborators.slice(0,3).map((c, i) => (
                <Tooltip key={i} title={c.name || c.email || ''}><Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: '#6b7280' }}>{(c.name || c.email || '?').charAt(0)}</Avatar></Tooltip>
              ))}
              {task.collaborators.length > 3 && (<Typography variant="caption">+{task.collaborators.length - 3}</Typography>)}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">-</Typography>
          )}
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          <Typography variant="body2" noWrap>{formatDate(task.target_date)}</Typography>
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Typography variant="body2" noWrap sx={{ color: task.is_overdue ? '#dc2626' : 'text.primary', fontWeight: task.is_overdue ? 600 : 400 }}>{formatDate(task.due_date)}</Typography>
            {isToday(task.due_date) && (<Tooltip title="Due today"><CalendarTodayIcon sx={{ color: '#dc2626', fontSize: '1rem' }} /></Tooltip>)}
          </Box>
          {task.due_date && (<Typography variant="caption" sx={{ color: task.is_overdue ? '#dc2626' : 'text.secondary' }} noWrap>{formatRelativeDate(task.due_date)}</Typography>)}
        </TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}><Typography variant="body2" noWrap>{formatDate(task.created_at)}</Typography></TableCell>

        <TableCell sx={{ whiteSpace: 'nowrap' }}><Typography variant="body2" noWrap>{task.created_by_name || '-'}</Typography></TableCell>

        <TableCell onClick={(e) => e.stopPropagation()}>
          <IconButton size="small" onClick={() => onTaskEdit(task)}><EditIcon fontSize="small" /></IconButton>
        </TableCell>
      </TableRow>
    );
  };

  const renderGroupHeader = (groupKey, group) => {
    const isExpanded = expandedGroups[groupKey] !== false;
    
    return (
      <TableRow
        key={`group-${groupKey}`}
        sx={{ bgcolor: '#f8fafc' }}
      >
        <TableCell colSpan={COLUMNS.length + 1} sx={{ py: 1 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
            }}
            onClick={() => toggleGroup(groupKey)}
          >
            <IconButton size="small">
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
            <Typography variant="subtitle2" fontWeight={600}>
              {group.name || group.status || group.priority || group.bucket || 'Unassigned'}
            </Typography>
            <Chip size="small" label={group.task_count || (group.tasks && group.tasks.length) || 0} sx={{ height: 20 }} />
          </Box>
        </TableCell>
      </TableRow>
    );
  };

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {loading && <LinearProgress />}
      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell padding="checkbox" sx={{ bgcolor: '#f8fafc' }}>
                <Checkbox
                  indeterminate={selectedTasks.length > 0 && selectedTasks.length < tasks.length}
                  checked={tasks.length > 0 && selectedTasks.length === tasks.length}
                  onChange={handleSelectAll}
                  size="small"
                />
              </TableCell>
              {COLUMNS.map(col => (
                <TableCell
                  key={col.id}
                  sx={{
                    bgcolor: '#f8fafc',
                    fontWeight: 600,
                    width: col.width,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{col.label}</Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {groupedTasks ? (
              // Render grouped tasks
              Object.entries(groupedTasks).map(([key, group]) => {
                const isExpanded = expandedGroups[key] !== false;
                return (
                  <React.Fragment key={key}>
                    {renderGroupHeader(key, group)}
                    {isExpanded && group.tasks.map(task => renderTaskRow(task))}
                  </React.Fragment>
                );
              })
            ) : (
              // Render flat list
              tasks.map(task => renderTaskRow(task))
            )}
            {tasks.length === 0 && !loading && (
              <TableRow>
                <TableCell colSpan={COLUMNS.length + 1} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">No tasks found</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      <TablePagination
        component="div"
        count={total}
        page={page - 1}
        onPageChange={(e, newPage) => onPageChange(newPage + 1)}
        rowsPerPage={limit}
        onRowsPerPageChange={(e) => {
          onLimitChange(parseInt(e.target.value, 10));
          onPageChange(1);
        }}
        rowsPerPageOptions={[25, 50, 100]}
      />
    </Paper>
  );
}

export default TasksTableView;
