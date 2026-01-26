import React, { useState, useMemo, useCallback, useRef } from 'react';
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
  Divider,
} from '@mui/material';

import EditIcon from '@mui/icons-material/Edit';
import FolderIcon from '@mui/icons-material/Folder';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';

import { format, isValid } from 'date-fns';
import { parseDateInput } from '../../utils/date';

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

const STAGE_COLUMNS = [
  { id: 'Planned', label: 'Planned', color: '#2563eb', bg: '#eff6ff' },
  { id: 'In-process', label: 'In-process', color: '#0f766e', bg: '#f0fdfa' },
  { id: 'Completed', label: 'Completed', color: '#16a34a', bg: '#dcfce7' },
  { id: 'On-hold', label: 'On-hold', color: '#9333ea', bg: '#f3e8ff' },
  { id: 'Dropped', label: 'Dropped', color: '#64748b', bg: '#f1f5f9' },
];

const norm = (v) => (v == null || v === '' ? 'ungrouped' : String(v));

const getPriorityColor = (priority) => {
  switch (priority) {
    case 'Critical': return { color: '#dc2626', bg: '#fef2f2', border: '#fecaca' };
    case 'High': return { color: '#ea580c', bg: '#fff7ed', border: '#fed7aa' };
    case 'Medium': return { color: '#ca8a04', bg: '#fefce8', border: '#fef08a' };
    case 'Low': return { color: '#16a34a', bg: '#f0fdf4', border: '#bbf7d0' };
    default: return { color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' };
  }
};

const parseDateValue = (value) => {
  const parsed = parseDateInput(value);
  return parsed && isValid(parsed) ? parsed : null;
};

const formatDate = (dateStr) => {
  const date = parseDateValue(dateStr);
  if (!date) return null;
  return format(date, 'MMM d, yyyy');
};

const isToday = (dateStr) => {
  const d = parseDateValue(dateStr);
  if (!d) return false;
  const now = new Date();
  return d.getFullYear() === now.getFullYear()
    && d.getMonth() === now.getMonth()
    && d.getDate() === now.getDate();
};

const getGroupField = (groupBy) => {
  if (groupBy === 'status') return 'status';
  if (groupBy === 'stage') return 'stage';
  if (groupBy === 'priority') return 'priority';
  if (groupBy === 'project') return 'project_id';
  if (groupBy === 'assignee') return 'assignee_id';
  return 'status';
};

const TaskCard = React.memo(function TaskCard({
  task,
  groupBy,
  isDragging,
  clickBlockRef,
  onTaskClick,
  onTaskEdit,
  onDragStartHandle,
  onDragEndHandle,
  getTaskIndicators,
}) {
  const indicators = getTaskIndicators ? getTaskIndicators(task) : [];
  const priorityStyle = getPriorityColor(task.priority);

  const handleCardClick = () => {
    // prevents accidental open right after drag
    if (clickBlockRef?.current) return;
    onTaskClick?.(task);
  };

  return (
    <Card
      key={task.id}
      onClick={handleCardClick}
      sx={{
        mb: 1.5,
        cursor: 'pointer',
        transition: 'all 0.18s ease',
        opacity: isDragging ? 0.55 : 1,
        transform: isDragging ? 'rotate(2deg)' : 'none',
        border: '1px solid rgba(148,163,184,0.25)',
        '&:hover': {
          boxShadow: 2,
          transform: isDragging ? 'rotate(2deg)' : 'translateY(-2px)',
        },
      }}
    >
      <CardContent sx={{ p: 1.5, '&:last-child': { pb: 1.5 } }}>
        {/* Header row: drag handle + project chip + edit */}
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
          {/* Drag handle only (draggable) */}
          <Tooltip title="Drag">
            <Box
              draggable
              onDragStart={(e) => onDragStartHandle(e, task)}
              onDragEnd={onDragEndHandle}
              onClick={(e) => e.stopPropagation()}
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 26,
                height: 22,
                borderRadius: 1,
                cursor: 'grab',
                color: '#64748b',
                '&:hover': { bgcolor: 'rgba(148,163,184,0.18)', color: '#334155' },
                '&:active': { cursor: 'grabbing' },
              }}
            >
              <DragIndicatorIcon sx={{ fontSize: '1.05rem' }} />
            </Box>
          </Tooltip>

          <Chip
            size="small"
            icon={<FolderIcon sx={{ fontSize: '0.85rem !important' }} />}
            label={task.project_name || 'Project'}
            sx={{
              height: 20,
              fontSize: '0.65rem',
              bgcolor: '#f1f5f9',
              maxWidth: 170,
              '& .MuiChip-label': { px: 0.5, overflow: 'hidden', textOverflow: 'ellipsis' },
              '& .MuiChip-icon': { ml: 0.5 },
            }}
          />

          <Box sx={{ flex: 1 }} />

          <IconButton
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              onTaskEdit?.(task);
            }}
            sx={{ p: 0.25 }}
          >
            <EditIcon sx={{ fontSize: '0.95rem' }} />
          </IconButton>
        </Box>

        {/* Task Name */}
        <Typography
          variant="body2"
          fontWeight={600}
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

        {/* Indicators (icon-only, tooltip carries label) */}
        {indicators.length > 0 && (
          <Box sx={{ display: 'flex', gap: 0.75, mb: 1, flexWrap: 'wrap' }}>
            {indicators.slice(0, 6).map((ind, idx) => (
              <Tooltip key={idx} title={ind.label}>
                <Box
                  sx={{
                    width: 22,
                    height: 22,
                    borderRadius: 1.2,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    bgcolor:
                      ind.type === 'overdue' ? '#fef2f2' :
                      ind.type === 'recurring' ? '#f3e8ff' :
                      '#eff6ff',
                    color:
                      ind.type === 'overdue' ? '#dc2626' :
                      ind.type === 'recurring' ? '#7c3aed' :
                      '#2563eb',
                    border: '1px solid rgba(148,163,184,0.25)',
                    '& .MuiSvgIcon-root': { fontSize: '1rem' },
                  }}
                >
                  {ind.icon}
                </Box>
              </Tooltip>
            ))}
          </Box>
        )}

        <Divider sx={{ my: 1 }} />

        {/* Bottom section (stable layout, 2 lines) */}
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.75 }}>
          {/* Line 1: Stage + Target (left) | Due (right) */}
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="caption" noWrap sx={{ fontSize: '0.65rem', color: 'text.secondary' }}>
                {task.stage || task.stage_name || '—'}
              </Typography>
              <Typography variant="caption" noWrap sx={{ display: 'block', fontSize: '0.65rem', color: 'text.secondary' }}>
                {task.target_date ? `Target: ${formatDate(task.target_date)}` : ''}
              </Typography>
            </Box>

            {task.due_date ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, flexShrink: 0 }}>
                <Typography
                  variant="caption"
                  sx={{
                    fontSize: '0.65rem',
                    color: task.is_overdue ? '#dc2626' : 'text.secondary',
                    fontWeight: task.is_overdue ? 700 : 500,
                  }}
                >
                  {formatDate(task.due_date)}
                </Typography>
                {isToday(task.due_date) && (
                  <CalendarTodayIcon sx={{ color: '#dc2626', fontSize: '0.9rem' }} />
                )}
              </Box>
            ) : null}
          </Box>

          {/* Line 2: Priority (if not grouping by priority) + assignee + collaborators + created */}
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            {groupBy !== 'priority' && (
              <Chip
                size="small"
                variant="outlined"
                label={task.priority || '—'}
                sx={{
                  height: 18,
                  fontSize: '0.6rem',
                  bgcolor: 'transparent',
                  borderColor: priorityStyle.border,
                  color: priorityStyle.color,
                  fontWeight: 700,
                  '& .MuiChip-label': { px: 0.75 },
                }}
              />
            )}

            {/* Assignee */}
            {task.assignee_name ? (
              <Tooltip title={task.assignee_name}>
                <Avatar
                  sx={{
                    width: 22,
                    height: 22,
                    fontSize: '0.65rem',
                    bgcolor: '#0f766e',
                    flexShrink: 0,
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
                    flexShrink: 0,
                  }}
                >
                  ?
                </Avatar>
              </Tooltip>
            )}

            {/* Collaborators (capped) */}
            <Box sx={{ display: 'flex', gap: 0.5, alignItems: 'center', minWidth: 0 }}>
              {task.collaborators && task.collaborators.slice(0, 3).map((c, i) => (
                <Tooltip key={i} title={c.name || c.email || ''}>
                  <Avatar sx={{ width: 18, height: 18, fontSize: '0.6rem', bgcolor: '#6b7280' }}>
                    {(c.name || c.email || '?').charAt(0)}
                  </Avatar>
                </Tooltip>
              ))}
              {task.collaborators && task.collaborators.length > 3 && (
                <Typography variant="caption" noWrap sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                  +{task.collaborators.length - 3}
                </Typography>
              )}
            </Box>

            <Box sx={{ flex: 1 }} />

            {/* Created (safe formatter) */}
            <Box sx={{ textAlign: 'right', minWidth: 0 }}>
              <Typography variant="caption" noWrap sx={{ fontSize: '0.6rem', color: 'text.secondary' }}>
                {task.created_at ? formatDate(task.created_at) : ''}
              </Typography>
              <Typography variant="caption" noWrap sx={{ display: 'block', fontSize: '0.6rem', color: 'text.secondary' }}>
                {task.created_by_name || ''}
              </Typography>
            </Box>
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
});

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

  // prevents accidental click open after drag
  const clickBlockRef = useRef(false);

  const groupField = useMemo(() => getGroupField(groupBy), [groupBy]);

  // Build columns
  const columns = useMemo(() => {
    // Status/Priority fixed columns
    if (groupBy === 'status') {
      return STATUS_COLUMNS.map((c) => ({
        ...c,
        id: norm(c.id),
        rawId: c.id,
      }));
    }
    if (groupBy === 'stage') {
      return STAGE_COLUMNS.map((c) => ({
        ...c,
        id: norm(c.id),
        rawId: c.id,
      }));
    }
    if (groupBy === 'priority') {
      return PRIORITY_COLUMNS.map((c) => ({
        ...c,
        id: norm(c.id),
        rawId: c.id,
      }));
    }

    // Project/Assignee from metadata
    if (groupMetadata?.groups) {
      const cols = groupMetadata.groups.map((g) => {
        const rawId = g.id ?? g.status ?? g.priority ?? g.bucket ?? g.project_id ?? g.assignee_id ?? 'ungrouped';
        return {
          id: norm(rawId),
          rawId: rawId,
          label: g.name || g.status || g.priority || g.bucket || 'Unassigned',
          color: '#0f766e',
          bg: '#f0fdfa',
        };
      });

      // Ensure "ungrouped" exists for mismatches / nulls
      const hasUngrouped = cols.some((c) => c.id === 'ungrouped');
      if (!hasUngrouped) {
        cols.push({
          id: 'ungrouped',
          rawId: null,
          label: 'Unassigned',
          color: '#64748b',
          bg: '#f1f5f9',
        });
      }

      return cols;
    }

    // fallback
    return STATUS_COLUMNS.map((c) => ({
      ...c,
      id: norm(c.id),
      rawId: c.id,
    }));
  }, [groupBy, groupMetadata]);

  // Group tasks by column (string-normalized keys)
  const tasksByColumn = useMemo(() => {
    const map = {};
    columns.forEach((col) => {
      map[col.id] = [];
    });

    tasks.forEach((task) => {
      const key = norm(task?.[groupField]);
      if (map[key]) map[key].push(task);
      else if (map.ungrouped) map.ungrouped.push(task);
      else {
        // in case ungrouped not created for some reason
        map.ungrouped = [task];
      }
    });

    return map;
  }, [tasks, columns, groupField]);

  /* ---------------- Drag/drop handlers ---------------- */

  const handleDragStartHandle = useCallback((e, task) => {
    // needed for Firefox to start drag properly
    try { e.dataTransfer.setData('text/plain', String(task.id)); } catch {}
    e.dataTransfer.effectAllowed = 'move';

    clickBlockRef.current = true; // block clicks while dragging
    setDraggedTask(task);
  }, []);

  const handleDragOver = useCallback((e, columnId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverColumn(null);
  }, []);

  const handleDrop = useCallback((e, column) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedTask) return;
    if (typeof onTaskDrop !== 'function') {
      setDraggedTask(null);
      return;
    }

    const fromKey = norm(draggedTask?.[groupField]);
    const toKey = column.id;

    if (fromKey !== toKey) {
      // Update appropriate field. For "ungrouped", set null.
      const updates = { [groupField]: column.rawId == null ? null : column.rawId };
      onTaskDrop([draggedTask.id], updates);
    }

    setDraggedTask(null);

    // unblock click next tick (prevents accidental open)
    setTimeout(() => { clickBlockRef.current = false; }, 0);
  }, [draggedTask, onTaskDrop, groupField]);

  const handleDragEndHandle = useCallback(() => {
    setDraggedTask(null);
    setDragOverColumn(null);
    setTimeout(() => { clickBlockRef.current = false; }, 0);
  }, []);

  /* ---------------- Render column ---------------- */

  const renderColumn = useCallback((column) => {
    const columnTasks = tasksByColumn[column.id] || [];
    const isDragOver = dragOverColumn === column.id;

    return (
      <Box
        key={column.id}
        onDragOver={(e) => handleDragOver(e, column.id)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, column)}
        sx={{
          width: 280,
          minWidth: 280,
          display: 'flex',
          flexDirection: 'column',
          bgcolor: column.bg || '#f8fafc',
          borderRadius: 2,
          border: isDragOver ? `2px solid ${column.color}` : '1px solid rgba(148,163,184,0.22)',
          transition: 'all 0.18s ease',
          boxShadow: isDragOver ? 2 : 'none',
          position: 'relative',
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
            bgcolor: '#ffffff',
            borderTopLeftRadius: 8,
            borderTopRightRadius: 8,
          }}
        >
          <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: column.color }} />
          <Typography variant="subtitle2" fontWeight={700} sx={{ flex: 1 }}>
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
            minHeight: 120,
            position: 'relative',
          }}
        >
          {/* Drag-over overlay */}
          {isDragOver && draggedTask && (
            <Box
              sx={{
                position: 'absolute',
                inset: 10,
                borderRadius: 2,
                border: `2px dashed ${column.color}`,
                bgcolor: 'rgba(15,118,110,0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 2,
                pointerEvents: 'none',
              }}
            >
              <Typography variant="caption" sx={{ fontWeight: 800, color: column.color }}>
                Drop here
              </Typography>
            </Box>
          )}

          {columnTasks.length === 0 ? (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                height: 90,
                border: '2px dashed rgba(148,163,184,0.35)',
                borderRadius: 2,
                color: 'text.secondary',
                bgcolor: '#ffffff',
              }}
            >
              <Typography variant="caption">No tasks</Typography>
            </Box>
          ) : (
            columnTasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                groupBy={groupBy}
                isDragging={draggedTask?.id === task.id}
                clickBlockRef={clickBlockRef}
                onTaskClick={onTaskClick}
                onTaskEdit={onTaskEdit}
                onDragStartHandle={handleDragStartHandle}
                onDragEndHandle={handleDragEndHandle}
                getTaskIndicators={getTaskIndicators}
              />
            ))
          )}
        </Box>
      </Box>
    );
  }, [
    tasksByColumn,
    dragOverColumn,
    draggedTask,
    groupBy,
    onTaskClick,
    onTaskEdit,
    handleDragOver,
    handleDragLeave,
    handleDrop,
    handleDragStartHandle,
    handleDragEndHandle,
    getTaskIndicators,
  ]);

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
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
          Drag tasks using the handle to update {groupBy}
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
        {columns.map((column) => renderColumn(column))}
      </Box>
    </Paper>
  );
}

export default TasksBoardView;
