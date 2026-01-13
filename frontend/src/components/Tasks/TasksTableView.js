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
  Checkbox,
  Chip,
  Typography,
  IconButton,
  Avatar,
  Tooltip,
  LinearProgress,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
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
    case 'In Progress':
    case 'In-process': return { bg: '#fef3c7', color: '#d97706' };
    case 'Under Review': return { bg: '#f3e8ff', color: '#9333ea' };
    case 'Pending Approval': return { bg: '#fee2e2', color: '#991b1b' };
    case 'Rejected': return { bg: '#fee2e2', color: '#991b1b' };
    case 'Blocked': return { bg: '#fef3c7', color: '#92400e' };
    case 'Completed': return { bg: '#dcfce7', color: '#16a34a' };
    case 'Closed': return { bg: '#f1f5f9', color: '#64748b' };
    case 'Not started': return { bg: '#e2e8f0', color: '#475569' };
    default: return { bg: '#f8fafc', color: '#64748b' };
  }
};

const formatDate = (dateStr) => {
  if (!dateStr) return '-';
  const date = parseISO(dateStr);
  if (!isValid(date)) return '-';
  return format(date, 'dd-MMM-yy'); // matches your UI style
};

const formatRelativeDate = (dateStr) => {
  if (!dateStr) return null;
  const date = parseISO(dateStr);
  if (!isValid(date)) return null;
  return formatDistanceToNow(date, { addSuffix: true });
};

const isToday = (dateStr) => {
  if (!dateStr) return false;
  try {
    const d = parseISO(dateStr);
    const now = new Date();
    return (
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate()
    );
  } catch (e) {
    return false;
  }
};

// ✅ Force single line (NO WRAP) everywhere
const NOWRAP_SX = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  overflowWrap: 'normal',
  wordBreak: 'keep-all',
  hyphens: 'none',
};

const CHECKBOX_CELL_SX = {
  width: 96,
  minWidth: 96,
  maxWidth: 96,
  px: 2,
  boxSizing: 'border-box',
  overflow: 'visible',
};

// ✅ Table-level "hard lock" to prevent wrapping even if theme overrides
const TABLE_NOWRAP_SX = {
  minWidth: 1800,
  tableLayout: 'fixed',
  '& th, & td': {
    ...NOWRAP_SX,
  },
  '& th *': {
    whiteSpace: 'nowrap !important',
  },
  '& td *': {
    whiteSpace: 'nowrap !important',
  },
  // If any header uses TableSortLabel elsewhere, prevent it from wrapping
  '& .MuiTableSortLabel-root': {
    display: 'inline-flex',
    flexWrap: 'nowrap',
    whiteSpace: 'nowrap',
  },
};

const COLUMNS = [
  { id: 'name', label: 'Task', width: '14%', sortable: true },
  { id: 'project_name', label: 'Project', width: '12%', sortable: true },
  { id: 'stage', label: 'Stage', width: '9.2%', sortable: true },
  { id: 'status', label: 'Status', width: '10.35%', sortable: true },
  { id: 'priority', label: 'Priority', width: '9%', sortable: true },
  { id: 'assignee_name', label: 'Assignee', width: '12%', sortable: true },
  { id: 'collaborators', label: 'Collaborators', width: '10%', sortable: false },

  // ✅ Use NBSP to *also* prevent breaks even if nowrap gets overridden
  { id: 'due_date', label: 'Due\u00A0Date', width: '9%', sortable: true },
  { id: 'target_date', label: 'Target\u00A0Date', width: '9%', sortable: true },
  { id: 'created_by_name', label: 'Created\u00A0By', width: '10%', sortable: true },
  { id: 'created_at', label: 'Created\u00A0Date', width: '10%', sortable: true },
  { id: 'notes', label: 'Notes', width: '10%', sortable: false },

  { id: 'actions', label: '', width: '4%', sortable: false },
];

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

  const groupedTasks = useMemo(() => {
    if (!groupBy || !(groupMetadata && groupMetadata.groups)) return null;

    const groups = {};
    groupMetadata.groups.forEach((g) => {
      const key = g.id || g.status || g.priority || g.bucket || 'ungrouped';
      groups[key] = { ...g, tasks: [] };
    });

    tasks.forEach((task) => {
      let key;
      switch (groupBy) {
        case 'project': key = task.project_id; break;
        case 'status': key = task.status; break;
        case 'priority': key = task.priority; break;
        case 'assignee': key = task.assignee_id || 'ungrouped'; break;
        default: key = 'ungrouped';
      }
      if (groups[key]) groups[key].tasks.push(task);
    });

    return groups;
  }, [tasks, groupBy, groupMetadata]);

  const toggleGroup = (groupKey) => {
    setExpandedGroups((prev) => ({ ...prev, [groupKey]: !prev[groupKey] }));
  };

  const isSelected = (taskId) => selectedTasks.includes(taskId);

  const handleSelectAll = (event) => {
    if (event.target.checked) onSelectTasks(tasks.map((t) => t.id));
    else onSelectTasks([]);
  };

  const handleSelectTask = (taskId) => {
    if (isSelected(taskId)) onSelectTasks(selectedTasks.filter((id) => id !== taskId));
    else onSelectTasks([...selectedTasks, taskId]);
  };

  const renderTaskRow = (task) => {
    const priorityStyle = getPriorityColor(task.priority);
    const statusStyle = getStatusColor(task.status);
    const indicators = getTaskIndicators(task);
    const selected = isSelected(task.id);

    // ✅ show due date in a single line (date + relative inside same line)
    const dueText = formatDate(task.due_date);
    const dueRel = formatRelativeDate(task.due_date);
    const dueTooltip = dueRel ? `${dueText} (${dueRel})` : null;

    const targetText = formatDate(task.target_date);
    const createdText = formatDate(task.created_at);

    // notes can come as notes OR task.notes_text OR something else
    const notesText = task.notes || task.task_notes || task.notes_text || 'No notes';

    return (
      <TableRow
        key={task.id}
        hover
        selected={selected}
        onClick={() => onTaskClick(task)}
        sx={{ cursor: 'pointer', '&:hover': { bgcolor: '#f8fafc' } }}
      >
        <TableCell padding="none" onClick={(e) => e.stopPropagation()} sx={{ ...NOWRAP_SX, ...CHECKBOX_CELL_SX }}>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Checkbox checked={selected} onChange={() => handleSelectTask(task.id)} size="small" sx={{ p: 0.5, m: 0 }} />
          </Box>
        </TableCell>

        {/* Task */}
        <TableCell sx={NOWRAP_SX}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="body2"
                fontWeight={500}
                noWrap
                sx={{
                  ...NOWRAP_SX,
                  textDecoration: task.status === 'Closed' ? 'line-through' : 'none',
                  color: task.status === 'Closed' ? 'text.secondary' : 'text.primary',
                }}
              >
                {task.name}
              </Typography>
              {task.description && (
                <Typography variant="caption" color="text.secondary" noWrap sx={NOWRAP_SX}>
                  {task.description}
                </Typography>
              )}
            </Box>

            <Box sx={{ display: 'flex', gap: 0.5, flexShrink: 0 }}>
              {indicators.map((ind, idx) => (
                <Tooltip key={idx} title={ind.label}>
                  <Box sx={{ display: 'flex', alignItems: 'center', color: ind.color || '#64748b' }}>
                    {ind.icon}
                  </Box>
                </Tooltip>
              ))}
            </Box>
          </Box>
        </TableCell>

        {/* Project */}
        <TableCell sx={NOWRAP_SX}>
          <Chip
            size="small"
            icon={<FolderIcon fontSize="small" />}
            label={task.project_name}
            sx={{
              bgcolor: '#f1f5f9',
              color: '#475569',
              maxWidth: '100%',
              '& .MuiChip-label': { ...NOWRAP_SX },
            }}
          />
        </TableCell>

        {/* Stage */}
        <TableCell sx={NOWRAP_SX}>
          <Typography variant="body2" noWrap sx={NOWRAP_SX}>
            {task.stage || task.stage_name || '-'}
          </Typography>
        </TableCell>

        {/* Status */}
        <TableCell sx={NOWRAP_SX}>
          <Chip size="small" label={task.status} sx={{ bgcolor: statusStyle.bg, color: statusStyle.color, fontWeight: 500 }} />
        </TableCell>

        {/* Priority */}
        <TableCell sx={NOWRAP_SX}>
          <Chip
            size="small"
            label={task.priority}
            sx={{
              bgcolor: priorityStyle.bg,
              color: priorityStyle.color,
              border: `1px solid ${priorityStyle.border}`,
              fontWeight: 500,
            }}
          />
        </TableCell>

        {/* Assignee (no wrap) */}
        <TableCell sx={NOWRAP_SX}>
          {task.assignee_name ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#0f766e', flexShrink: 0 }}>
                {task.assignee_name.charAt(0)}
              </Avatar>
              <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                {task.assignee_name}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>
              -
            </Typography>
          )}
        </TableCell>

        {/* Collaborators */}
        <TableCell sx={NOWRAP_SX}>
          {task.collaborators && task.collaborators.length > 0 ? (
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center' }}>
              {task.collaborators.slice(0, 3).map((c, i) => (
                <Tooltip key={i} title={c.name || c.email || ''}>
                  <Avatar sx={{ width: 22, height: 22, fontSize: '0.65rem', bgcolor: '#6b7280' }}>
                    {(c.name || c.email || '?').charAt(0)}
                  </Avatar>
                </Tooltip>
              ))}
              {task.collaborators.length > 3 && (
                <Typography variant="caption" noWrap sx={NOWRAP_SX}>
                  +{task.collaborators.length - 3}
                </Typography>
              )}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>
              -
            </Typography>
          )}
        </TableCell>

        {/* Due Date (single-line) */}
        <TableCell sx={NOWRAP_SX}>
          <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
            {dueTooltip ? (
              <Tooltip title={dueTooltip}>
                <Typography
                  variant="body2"
                  noWrap
                  sx={{
                    ...NOWRAP_SX,
                    color: task.is_overdue ? '#dc2626' : 'text.primary',
                    fontWeight: task.is_overdue ? 600 : 400,
                  }}
                >
                  {dueText}
                </Typography>
              </Tooltip>
            ) : (
              <Typography
                variant="body2"
                noWrap
                sx={{
                  ...NOWRAP_SX,
                  color: task.is_overdue ? '#dc2626' : 'text.primary',
                  fontWeight: task.is_overdue ? 600 : 400,
                }}
              >
                {dueText}
              </Typography>
            )}
            {isToday(task.due_date) && (
              <Tooltip title="Due today">
                <CalendarTodayIcon sx={{ color: '#dc2626', fontSize: '1rem', flexShrink: 0 }} />
              </Tooltip>
            )}
          </Box>
        </TableCell>

        {/* Target Date (single-line) */}
        <TableCell sx={NOWRAP_SX}>
          <Typography variant="body2" noWrap sx={NOWRAP_SX}>
            {targetText}
          </Typography>
        </TableCell>

        {/* Created By (single-line) */}
        <TableCell sx={NOWRAP_SX}>
          <Typography variant="body2" noWrap sx={NOWRAP_SX}>
            {task.created_by_name || '-'}
          </Typography>
        </TableCell>

        {/* Created Date (single-line) */}
        <TableCell sx={NOWRAP_SX}>
          <Typography variant="body2" noWrap sx={NOWRAP_SX}>
            {createdText}
          </Typography>
        </TableCell>

        {/* Notes (single-line) */}
        <TableCell sx={NOWRAP_SX}>
          <Typography variant="body2" noWrap sx={NOWRAP_SX}>
            {notesText}
          </Typography>
        </TableCell>

        {/* Actions */}
        <TableCell onClick={(e) => e.stopPropagation()} sx={NOWRAP_SX}>
          <IconButton size="small" onClick={() => onTaskEdit(task)}>
            <EditIcon fontSize="small" />
          </IconButton>
        </TableCell>
      </TableRow>
    );
  };

  const renderGroupHeader = (groupKey, group) => {
    const isExpanded = expandedGroups[groupKey] !== false;

    return (
      <TableRow key={`group-${groupKey}`} sx={{ bgcolor: '#f8fafc' }}>
        <TableCell colSpan={COLUMNS.length + 1} sx={{ py: 1, ...NOWRAP_SX }}>
          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
            onClick={() => toggleGroup(groupKey)}
          >
            <IconButton size="small">
              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>

            <Typography variant="subtitle2" fontWeight={600} noWrap sx={NOWRAP_SX}>
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
        <Table stickyHeader size="small" sx={TABLE_NOWRAP_SX}>
          <TableHead>
            <TableRow>
              <TableCell padding="none" sx={{ bgcolor: '#f8fafc', ...NOWRAP_SX, ...CHECKBOX_CELL_SX }}>
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Checkbox
                    indeterminate={selectedTasks.length > 0 && selectedTasks.length < tasks.length}
                    checked={tasks.length > 0 && selectedTasks.length === tasks.length}
                    onChange={handleSelectAll}
                    size="small"
                    sx={{ p: 0.5, m: 0 }}
                  />
                </Box>
              </TableCell>

              {COLUMNS.map((col) => (
                <TableCell
                  key={col.id}
                  sx={{
                    bgcolor: '#f8fafc',
                    fontWeight: 700,
                    width: col.width,
                    ...NOWRAP_SX,
                  }}
                >
                  <Typography variant="body2" noWrap sx={{ fontWeight: 700, ...NOWRAP_SX }}>
                    {col.label}
                  </Typography>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {groupedTasks ? (
              Object.entries(groupedTasks).map(([key, group]) => {
                const isExpanded = expandedGroups[key] !== false;
                return (
                  <React.Fragment key={key}>
                    {renderGroupHeader(key, group)}
                    {isExpanded && group.tasks.map((task) => renderTaskRow(task))}
                  </React.Fragment>
                );
              })
            ) : (
              tasks.map((task) => renderTaskRow(task))
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
