import React, { useState, useMemo, useRef, useCallback } from 'react';
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
  Button,
  Badge,
  FormControl,
  FormControlLabel,
  MenuItem,
  Select,
  TextField,
  Popover,
  ListItemText,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  TableSortLabel,
} from '@mui/material';

import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import EditIcon from '@mui/icons-material/Edit';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import FolderIcon from '@mui/icons-material/Folder';
import AddIcon from '@mui/icons-material/Add';
import FilterListIcon from '@mui/icons-material/FilterList';
import DensitySmallIcon from '@mui/icons-material/DensitySmall';
import DensityMediumIcon from '@mui/icons-material/DensityMedium';
import PlaylistAddCheckIcon from '@mui/icons-material/PlaylistAddCheck';
import TuneIcon from '@mui/icons-material/Tune';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import ClearIcon from '@mui/icons-material/Clear';

import {
  formatDistanceToNow,
  format,
  isValid,
  differenceInCalendarDays,
} from 'date-fns';
import { parseDateInput } from '../../utils/date';
import { 
  formatShortDateIST, 
  formatRelativeTimeIST, 
  isTodayIST, 
  isTomorrowIST, 
  isPastIST 
} from '../../utils/dateUtils';

/* ---------------- helpers ---------------- */

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

const parseDateValue = (value) => {
  const parsed = parseDateInput(value);
  return parsed && isValid(parsed) ? parsed : null;
};

const formatDate = (dateStr) => {
  const date = parseDateValue(dateStr);
  if (!date) return '-';
  return formatShortDateIST(date);
};

const formatRelativeDate = (dateStr) => {
  const date = parseDateValue(dateStr);
  if (!date) return null;
  return formatRelativeTimeIST(date);
};

const getClientDisplayName = (task) => {
  if (!task) return '';
  return task.client_name || task.client_legal_name || '';
};

const getClientTooltip = (task) => {
  if (!task) return '';
  const seriesNo = task.client_series_no;
  const legalName = task.client_legal_name;
  const name = task.client_name;
  if (seriesNo) {
    const tail = legalName || name;
    return tail ? `${seriesNo} - ${tail}` : seriesNo;
  }
  if (legalName) return legalName;
  if (name) return name;
  return '';
};

const isToday = (dateStr) => {
  const d = parseDateValue(dateStr);
  if (!d) return false;
  return isTodayIST(d);
};

const getDueSignal = (dateStr, taskStatus = null) => {
  // Feature 6: Don't show date labels for completed/closed tasks
  if (taskStatus === 'Closed' || taskStatus === 'Completed') return null;
  
  const d = parseDateValue(dateStr);
  if (!d) return null;

  if (isTodayIST(d)) return { label: 'Today', color: '#2563eb', bg: '#eff6ff', filterKey: 'today' };
  if (isPastIST(d)) return { label: 'Overdue', color: '#dc2626', bg: '#fef2f2', filterKey: 'overdue' };
  if (isTomorrowIST(d)) return { label: 'Tomorrow', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', filterKey: 'tomorrow' };
  
  const diff = differenceInCalendarDays(d, new Date()); // future = positive
  if (diff > 0 && diff <= 7) return { label: `in ${diff}d`, color: '#0f766e', bg: 'rgba(15,118,110,0.08)', filterKey: 'week' };
  if (diff > 7 && diff <= 31) return { label: 'This month', color: '#64748b', bg: '#f8fafc', filterKey: 'month' };
  return null;
};

// ✅ Force single line (NO WRAP) everywhere
const getTargetPlanSignal = (dateStr, taskStatus = null) => {
  // Feature 6: Don't show date labels for completed/closed tasks
  if (taskStatus === 'Closed' || taskStatus === 'Completed') return null;
  
  const d = parseDateValue(dateStr);
  if (!d) return null;

  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return { label: 'Overdue', color: '#dc2626', bg: '#fef2f2', filterKey: 'overdue' };
  if (diff === 0) return { label: 'Planned for today', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', filterKey: 'today' };
  if (diff === 1) return { label: 'Planned for tomorrow', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', filterKey: 'tomorrow' };
  if (diff <= 7) return { label: 'Planned this week', color: '#2563eb', bg: '#eff6ff', filterKey: 'week' };
  if (diff <= 31) return { label: 'Planned this month', color: '#0f766e', bg: 'rgba(15,118,110,0.08)', filterKey: 'month' };
  return { label: 'Planned later', color: '#64748b', bg: '#f8fafc', filterKey: 'later' };
};

const NOWRAP_SX = {
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  overflowWrap: 'normal',
  wordBreak: 'keep-all',
  hyphens: 'none',
};

/* ---------------- column config ---------------- */

// Task cell width: 30ch text + reserved space (change this!)
const TASK_NAME_TEXT_CH = 30;
const TASK_NAME_SPACE_CH = 1; // <-- reduce/increase reserved "space" here
const TASK_NAME_TOTAL_CH = TASK_NAME_TEXT_CH + TASK_NAME_SPACE_CH;

// Sticky left widths
const CHECKBOX_W = 56;

const CHECKBOX_CELL_SX = {
  width: CHECKBOX_W,
  minWidth: CHECKBOX_W,
  maxWidth: CHECKBOX_W,
  px: 1,
  boxSizing: 'border-box',
  overflow: 'visible',
};

const ACTIONS_W = 56;
const ACTIONS_CELL_SX = {
  width: ACTIONS_W,
  minWidth: ACTIONS_W,
  maxWidth: ACTIONS_W,
  px: 0.5,
  textAlign: 'center',
};

const TASK_COL_SX = {
  width: `${TASK_NAME_TOTAL_CH}ch`,
  minWidth: `${TASK_NAME_TOTAL_CH}ch`,
  maxWidth: `${TASK_NAME_TOTAL_CH}ch`,
  ...NOWRAP_SX,
};

// Column list
const COLUMNS = [
  { id: 'name', label: 'Task', sortable: true },
  { id: 'project_name', label: 'Project', sortable: true },
  { id: 'client_name', label: 'Client', sortable: true },
  { id: 'stage', label: 'Stage', sortable: true },
  { id: 'status', label: 'Status', sortable: true },
  { id: 'priority', label: 'Priority', sortable: true },
  { id: 'assignee_name', label: 'Assignee', sortable: true },
  { id: 'collaborators', label: 'Collaborators', sortable: false },
  { id: 'due_date', label: 'Due\u00A0Date', sortable: true },
  { id: 'target_date', label: 'Target\u00A0Date', sortable: true },
  { id: 'created_by_name', label: 'Created\u00A0By', sortable: true },
  { id: 'created_at', label: 'Created\u00A0Date', sortable: true },
  { id: 'notes', label: 'Notes', sortable: false },
  { id: 'category', label: 'Category', sortable: true, custom: true },
  { id: 'section', label: 'Section', sortable: true, custom: true },
  { id: 'estimated_hours', label: 'Est.\u00A0Hours', sortable: true, custom: true },
  { id: 'actual_hours', label: 'Actual\u00A0Hours', sortable: true, custom: true },
  { id: 'completion_percentage', label: 'Completion\u00A0%', sortable: true, custom: true },
  { id: 'tags', label: 'Tags', sortable: false, custom: true },
  { id: 'external_id', label: 'External\u00A0ID', sortable: true, custom: true },
  { id: 'actions', label: '', sortable: false },
];

const DEFAULT_VISIBLE_COLUMNS = [
  'name', 'project_name', 'client_name', 'stage', 'status', 'priority',
  'assignee_name', 'due_date', 'completion_percentage', 'actions'
];

const getColumnById = (id) => COLUMNS.find((c) => c.id === id);

/* ---------------- sorting ---------------- */

const getSortValue = (task, key) => {
  if (!key) return '';
  const v = task?.[key];

  // date keys
  if (['due_date', 'target_date', 'created_at'].includes(key)) {
    if (!v) return 0;
    const d = parseDateValue(v);
    return d ? d.getTime() : 0;
  }

  // numbers
  if (['estimated_hours', 'actual_hours', 'completion_percentage'].includes(key)) {
    return typeof v === 'number' ? v : (v ? Number(v) : 0);
  }

  // arrays
  if (Array.isArray(v)) return v.length;

  return (v ?? '').toString().toLowerCase();
};

const stableSort = (arr, comparator) => {
  const stabilized = arr.map((el, index) => [el, index]);
  stabilized.sort((a, b) => {
    const order = comparator(a[0], b[0]);
    if (order !== 0) return order;
    return a[1] - b[1];
  });
  return stabilized.map((el) => el[0]);
};

const getComparator = (order, orderBy) => (a, b) => {
  const av = getSortValue(a, orderBy);
  const bv = getSortValue(b, orderBy);
  if (av < bv) return order === 'asc' ? -1 : 1;
  if (av > bv) return order === 'asc' ? 1 : -1;
  return 0;
};

/* ---------------- cell sizing + sticky + dividers ---------------- */

const dividerColor = 'rgba(148, 163, 184, 0.35)';

const getDividerSx = (colId) => {
  // subtle separators after Task + Status + Due Date (you can tune)
  if (colId === 'name' || colId === 'status' || colId === 'due_date') {
    return { borderRight: `1px solid ${dividerColor}` };
  }
  return {};
};

const stickyHeaderSx = {
  position: 'sticky',
  top: 0,
  zIndex: 3,
};

const stickyBodySx = {
  position: 'sticky',
  zIndex: 2,
  backgroundColor: '#fff',
};

/* ---------------- row memo components ---------------- */

const TaskRow = React.memo(function TaskRow({
  task,
  rowIndex,
  displayedColumns,
  selected,
  onRowClick,
  onToggleSelect,
  onTaskEdit,
  getTaskIndicators,
  density,
  getBodyCellSx,
  onDateFilterClick,
}) {
  const indicators = getTaskIndicators(task);

  const rowPy = density === 'compact' ? 0.6 : 1.0;

  return (
    <TableRow
      hover
      selected={selected}
      onClick={onRowClick}
      sx={{
        cursor: 'pointer',
        '&:hover': { bgcolor: '#f8fafc' },
        // zebra rows
        bgcolor: rowIndex % 2 === 0 ? '#ffffff' : 'rgba(248, 250, 252, 0.75)',
        // show actions on hover
        '&:hover .rowActions': { opacity: 1 },
      }}
    >
      {/* Sticky checkbox */}
      <TableCell
        padding="none"
        onClick={(e) => e.stopPropagation()}
        sx={{
          ...CHECKBOX_CELL_SX,
          ...NOWRAP_SX,
          ...stickyBodySx,
          left: 0,
          borderRight: `1px solid ${dividerColor}`,
          py: rowPy,
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Checkbox
            checked={selected}
            onChange={onToggleSelect}
            size="small"
            sx={{ p: 0.25, m: 0 }}
          />
        </Box>
      </TableCell>

      {displayedColumns.map((col) => {
        const colId = col.id;
        const cellSx = getBodyCellSx(colId, density);

        // Sticky task column
        const extraSticky =
          colId === 'name'
            ? {
                ...stickyBodySx,
                left: CHECKBOX_W,
                borderRight: `1px solid ${dividerColor}`,
              }
            : {};

        return (
          <TableCell
            key={colId}
            sx={{
              ...cellSx,
              ...getDividerSx(colId),
              ...extraSticky,
              py: rowPy,
            }}
            onClick={colId === 'actions' ? (e) => e.stopPropagation() : undefined}
          >
            {(() => {
              const priorityStyle = getPriorityColor(task.priority);
              const statusStyle = getStatusColor(task.status);
              
              // Feature 3: Build tooltip content showing all labels for task name hover
              const getTaskLabelsTooltip = () => {
                const labels = [];
                if (task.priority) labels.push(`Priority: ${task.priority}`);
                if (task.status) labels.push(`Status: ${task.status}`);
                if (task.stage) labels.push(`Stage: ${task.stage}`);
                if (task.project_name) labels.push(`Project: ${task.project_name}`);
                if (task.assignee_name) labels.push(`Assignee: ${task.assignee_name}`);
                if (task.due_date) {
                  const dueSignal = getDueSignal(task.due_date, task.status);
                  labels.push(`Due: ${formatDate(task.due_date)}${dueSignal ? ` (${dueSignal.label})` : ''}`);
                }
                if (task.target_date) {
                  const targetSignal = getTargetPlanSignal(task.target_date, task.status);
                  labels.push(`Target: ${formatDate(task.target_date)}${targetSignal ? ` (${targetSignal.label})` : ''}`);
                }
                if (task.is_recurring) labels.push('Recurring Task');
                if (task.latest_approval_status === 'pending') labels.push('Pending Approval');
                return labels.join('\n');
              };

              switch (colId) {
                case 'name':
                  return (
                    <Tooltip 
                      title={
                        <Box sx={{ whiteSpace: 'pre-line', fontSize: '0.75rem' }}>
                          {getTaskLabelsTooltip()}
                        </Box>
                      }
                      placement="right"
                      arrow
                    >
                    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0, gap: 1 }}>
                        {/* Task Code Chip */}
                        {task.task_code && (
                          <Chip
                            label={task.task_code}
                            size="small"
                            sx={{
                              height: 20,
                              fontSize: '0.7rem',
                              fontWeight: 600,
                              fontFamily: 'monospace',
                              bgcolor: '#f1f5f9',
                              color: '#475569',
                              border: '1px solid #e2e8f0',
                              flexShrink: 0,
                              '& .MuiChip-label': { px: 1 },
                            }}
                          />
                        )}
                        <Box sx={{ flex: 1, minWidth: 0, maxWidth: `${TASK_NAME_TEXT_CH}ch` }}>
                          <Typography
                            variant="body2"
                            fontWeight={600}
                            noWrap
                            sx={{
                              ...NOWRAP_SX,
                              textDecoration: task.status === 'Closed' ? 'line-through' : 'none',
                              color: task.status === 'Closed' ? 'text.secondary' : 'text.primary',
                            }}
                          >
                            {task.name}
                          </Typography>
                        </Box>

                        {/* Reserved right area */}
                        <Box
                          sx={{
                            minWidth: `${TASK_NAME_SPACE_CH}ch`,
                            maxWidth: `${TASK_NAME_SPACE_CH}ch`,
                            display: 'flex',
                            justifyContent: 'flex-end',
                            alignItems: 'center',
                            gap: 0.5,
                            flexShrink: 0,
                            ml: 1,
                          }}
                        >
                          {indicators.slice(0, 4).map((ind, idx) => (
                            <Tooltip key={idx} title={ind.label}>
                              <Box sx={{ display: 'flex', alignItems: 'center', color: ind.color || '#64748b' }}>
                                {ind.icon}
                              </Box>
                            </Tooltip>
                          ))}
                        </Box>
                      </Box>

                      {task.description && (
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          noWrap
                          sx={{ ...NOWRAP_SX, maxWidth: `${TASK_NAME_TEXT_CH}ch` }}
                        >
                          {task.description}
                        </Typography>
                      )}
                    </Box>
                    </Tooltip>
                  );

                case 'project_name':
                  return (
                    <Chip
                      size="small"
                      icon={<FolderIcon fontSize="small" />}
                      label={task.project_name || '-'}
                      sx={{
                        bgcolor: '#f1f5f9',
                        color: '#475569',
                        maxWidth: '100%',
                        '& .MuiChip-label': { ...NOWRAP_SX },
                      }}
                    />
                  );

                case 'client_name': {
                  const displayName = getClientDisplayName(task);
                  const tooltip = getClientTooltip(task);
                  const content = (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {displayName}
                    </Typography>
                  );
                  if (!displayName) return content;
                  return tooltip ? <Tooltip title={tooltip}>{content}</Tooltip> : content;
                }

                case 'stage':
                  return (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {task.stage || task.stage_name || '-'}
                    </Typography>
                  );

                case 'status':
                  return (
                    <Chip
                      size="small"
                      label={task.status || '-'}
                      sx={{
                        bgcolor: statusStyle.bg,
                        color: statusStyle.color,
                        fontWeight: 600,
                      }}
                    />
                  );

                case 'priority':
                  // toned down priority chip
                  return (
                    <Chip
                      size="small"
                      variant="outlined"
                      label={task.priority || '-'}
                      sx={{
                        bgcolor: 'transparent',
                        color: priorityStyle.color,
                        borderColor: priorityStyle.border,
                        fontWeight: 600,
                        height: 22,
                        '& .MuiChip-label': { px: 1 },
                      }}
                    />
                  );

                case 'assignee_name':
                  return task.assignee_name ? (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.75rem', bgcolor: '#0f766e', flexShrink: 0 }}>
                        {task.assignee_name.charAt(0)}
                      </Avatar>
                      <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                        {task.assignee_name}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>-</Typography>
                  );

                case 'collaborators':
                  return task.collaborators && task.collaborators.length > 0 ? (
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
                    <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>-</Typography>
                  );

                case 'due_date': {
                  const dueText = formatDate(task.due_date);
                  const dueRel = formatRelativeDate(task.due_date);
                  const dueTooltip = dueRel ? `${dueText} (${dueRel})` : null;
                  const signal = getDueSignal(task.due_date, task.status);

                  return (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      {dueTooltip ? (
                        <Tooltip title={dueTooltip}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              ...NOWRAP_SX,
                              color: task.is_overdue && task.status !== 'Closed' && task.status !== 'Completed' ? '#dc2626' : 'text.primary',
                              fontWeight: task.is_overdue && task.status !== 'Closed' && task.status !== 'Completed' ? 700 : 500,
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
                            color: task.is_overdue && task.status !== 'Closed' && task.status !== 'Completed' ? '#dc2626' : 'text.primary',
                            fontWeight: task.is_overdue && task.status !== 'Closed' && task.status !== 'Completed' ? 700 : 500,
                          }}
                        >
                          {dueText}
                        </Typography>
                      )}

                      {isToday(task.due_date) && task.status !== 'Closed' && task.status !== 'Completed' && (
                        <Tooltip title="Due today">
                          <CalendarTodayIcon sx={{ color: '#2563eb', fontSize: '1rem', flexShrink: 0 }} />
                        </Tooltip>
                      )}

                      {signal && (
                        <Chip
                          size="small"
                          label={signal.label}
                          onClick={signal.filterKey && onDateFilterClick ? (e) => {
                            e.stopPropagation();
                            onDateFilterClick(signal.filterKey);
                          } : undefined}
                          sx={{
                            height: 20,
                            bgcolor: signal.bg,
                            color: signal.color,
                            fontWeight: 700,
                            cursor: signal.filterKey && onDateFilterClick ? 'pointer' : 'default',
                            '& .MuiChip-label': { px: 1, fontSize: '0.72rem' },
                            '&:hover': signal.filterKey && onDateFilterClick ? { opacity: 0.85 } : {},
                          }}
                        />
                      )}
                    </Box>
                  );
                }

                case 'target_date':
                  return (() => {
                    const targetSignal = getTargetPlanSignal(task.target_date, task.status);
                    return (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                          {formatDate(task.target_date)}
                        </Typography>
                        {targetSignal && (
                          <Chip
                            size="small"
                            label={targetSignal.label}
                            onClick={targetSignal.filterKey && onDateFilterClick ? (e) => {
                              e.stopPropagation();
                              onDateFilterClick(targetSignal.filterKey);
                            } : undefined}
                            sx={{
                              height: 20,
                              bgcolor: targetSignal.bg,
                              color: targetSignal.color,
                              fontWeight: 700,
                              cursor: targetSignal.filterKey && onDateFilterClick ? 'pointer' : 'default',
                              '& .MuiChip-label': { px: 1, fontSize: '0.72rem' },
                              '&:hover': targetSignal.filterKey && onDateFilterClick ? { opacity: 0.85 } : {},
                            }}
                          />
                        )}
                      </Box>
                    );
                  })();

                case 'created_by_name':
                  return (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {task.created_by_name || '-'}
                    </Typography>
                  );

                case 'created_at':
                  return (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {formatDate(task.created_at)}
                    </Typography>
                  );

                case 'notes':
                  return (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {task.notes || task.task_notes || task.notes_text || 'No notes'}
                    </Typography>
                  );

                case 'category':
                  return task.category ? (
                    <Chip size="small" label={task.category} sx={{ bgcolor: '#e0e7ff', color: '#4338ca', height: 22 }} />
                  ) : (
                    <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>-</Typography>
                  );

                case 'section':
                  return task.section ? (
                    <Chip size="small" label={task.section} sx={{ bgcolor: '#fce7f3', color: '#be185d', height: 22 }} />
                  ) : (
                    <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>-</Typography>
                  );

                case 'estimated_hours':
                  return (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {task.estimated_hours ? `${task.estimated_hours}h` : '-'}
                    </Typography>
                  );

                case 'actual_hours':
                  return (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {task.actual_hours ? `${task.actual_hours}h` : '-'}
                    </Typography>
                  );

                case 'completion_percentage':
                  const completionValue = task.completion_percentage ?? 0;
                  const getCompletionColor = (val) => {
                    if (val < 25) return '#ef4444';
                    if (val < 50) return '#f97316';
                    if (val < 75) return '#eab308';
                    return '#22c55e';
                  };
                  return (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 100 }}>
                      <LinearProgress
                        variant="determinate"
                        value={completionValue}
                        sx={{
                          flex: 1,
                          height: 6,
                          borderRadius: 3,
                          backgroundColor: '#e2e8f0',
                          '& .MuiLinearProgress-bar': {
                            borderRadius: 3,
                            backgroundColor: getCompletionColor(completionValue),
                          },
                        }}
                      />
                      <Typography variant="caption" sx={{ minWidth: 32, textAlign: 'right', fontWeight: 500 }}>
                        {completionValue}%
                      </Typography>
                    </Box>
                  );

                case 'tags':
                  return task.tags && task.tags.length > 0 ? (
                    <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'nowrap', overflow: 'hidden' }}>
                      {task.tags.slice(0, 2).map((tag, i) => (
                        <Chip key={i} label={tag} size="small" sx={{ fontSize: '0.7rem', height: 20 }} />
                      ))}
                      {task.tags.length > 2 && (
                        <Typography variant="caption" noWrap sx={NOWRAP_SX}>
                          +{task.tags.length - 2}
                        </Typography>
                      )}
                    </Box>
                  ) : (
                    <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>-</Typography>
                  );

                case 'external_id':
                  return (
                    <Typography variant="body2" noWrap sx={{ ...NOWRAP_SX, fontFamily: 'monospace', fontSize: '0.82rem' }}>
                      {task.external_id || '-'}
                    </Typography>
                  );

                case 'actions':
                  return (
                    <Box
                      className="rowActions"
                      sx={{
                        opacity: 0,
                        transition: 'opacity 0.15s ease',
                        display: 'flex',
                        justifyContent: 'center',
                      }}
                    >
                      <IconButton
                        size="small"
                        onClick={(e) => {
                          e.stopPropagation();
                          onTaskEdit(task);
                        }}
                      >
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  );

                default:
                  return (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {task[colId] || '-'}
                    </Typography>
                  );
              }
            })()}
          </TableCell>
        );
      })}
    </TableRow>
  );
});

const GroupHeaderRow = React.memo(function GroupHeaderRow({ groupKey, group, isExpanded, onToggle, colSpan }) {
  return (
    <TableRow sx={{ bgcolor: '#f8fafc' }}>
      <TableCell colSpan={colSpan} sx={{ py: 0.75, ...NOWRAP_SX }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }} onClick={() => onToggle(groupKey)}>
          <IconButton size="small">
            {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
          </IconButton>

          <Typography variant="subtitle2" fontWeight={700} noWrap sx={NOWRAP_SX}>
            {group.name || group.status || group.priority || group.bucket || 'Unassigned'}
          </Typography>

          <Chip size="small" label={group.task_count || (group.tasks && group.tasks.length) || 0} sx={{ height: 20 }} />
        </Box>
      </TableCell>
    </TableRow>
  );
});

/* ---------------- main component ---------------- */

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
  visibleColumns = DEFAULT_VISIBLE_COLUMNS,
  columnOrder = COLUMNS.map((c) => c.id),
  filters = {},
  onFiltersChange,
  projects = [],
  workspaceMembers = [],
  statusOptions = [],
  stageOptions = [],
  priorityOptions = [],
  hasActiveFilters = false,
  activeFilterCount = 0,
  onClearFilters,
  onOpenBulkActions,
  onOpenShareLink,
  onClearSelection,
  onCreateTask, // optional: shows Create Task button in empty state
  onDateFilterClick, // optional: callback for clicking date labels (feature 7)
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [density, setDensity] = useState('comfortable'); // 'compact' | 'comfortable'
  const [orderBy, setOrderBy] = useState('due_date');
  const [order, setOrder] = useState('asc');
  const [filterAnchorEl, setFilterAnchorEl] = useState(null);
  const [filterColumnId, setFilterColumnId] = useState(null);
  const selectedCount = selectedTasks.length;
  const hasSelection = selectedCount > 0;

  // Column widths (resize) in px for non-sticky columns
  const [colWidths, setColWidths] = useState({}); // { [colId]: number }
  const dragRef = useRef(null);

  const updateFilters = useCallback(
    (patch) => {
      if (!onFiltersChange || !patch) return;
      onFiltersChange(patch);
    },
    [onFiltersChange]
  );

  const handleFilterOpen = (event, colId) => {
    event.stopPropagation();
    setFilterAnchorEl(event.currentTarget);
    setFilterColumnId(colId);
  };

  const handleFilterClose = () => {
    setFilterAnchorEl(null);
    setFilterColumnId(null);
  };

  const getMemberLabel = (member) => {
    if (!member) return 'Unknown';
    const fullName = `${member.first_name || ''} ${member.last_name || ''}`.trim();
    return fullName || member.username || member.email || 'Unknown';
  };

  const displayedColumns = useMemo(() => {
    const orderedVisible = columnOrder
      .filter((id) => visibleColumns.includes(id) && getColumnById(id))
      .map((id) => getColumnById(id));

    if (visibleColumns.includes('actions') && !orderedVisible.find((c) => c.id === 'actions')) {
      orderedVisible.push(getColumnById('actions'));
    }

    return orderedVisible;
  }, [visibleColumns, columnOrder]);

  const handleSort = (col) => {
    if (!col.sortable) return;
    if (orderBy === col.id) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(col.id);
      setOrder('asc');
    }
  };

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

  const sortedTasks = useMemo(() => {
    if (!tasks || tasks.length === 0) return [];
    const comparator = getComparator(order, orderBy);
    return stableSort(tasks, comparator);
  }, [tasks, order, orderBy]);

  const groupedTasks = useMemo(() => {
    if (!groupBy || !(groupMetadata && groupMetadata.groups)) return null;

    const groups = {};
    groupMetadata.groups.forEach((g) => {
      const key = g.id || g.status || g.priority || g.bucket || 'ungrouped';
      groups[key] = { ...g, tasks: [] };
    });

    sortedTasks.forEach((task) => {
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

    // sort inside each group as well (already sortedTasks order, but keeps safe)
    return groups;
  }, [sortedTasks, groupBy, groupMetadata]);

  const isColumnFiltered = useCallback(
    (colId) => {
      const hasText = (value) => String(value || '').trim().length > 0;
      switch (colId) {
        case 'name':
          return hasText(filters.name) || filters.recurring !== null;
        case 'project_name':
          return (filters.projects || []).length > 0 || filters.include_archived;
        case 'client_name':
          return hasText(filters.client_name);
        case 'stage':
          return (filters.stage || []).length > 0;
        case 'status':
          return (filters.status || []).length > 0 || !filters.hideCompleted;
        case 'priority':
          return (filters.priority || []).length > 0;
        case 'assignee_name':
          return filters.assignee && filters.assignee !== 'all';
        case 'collaborators':
          return (filters.collaborators || []).length > 0;
        case 'due_date':
          return hasText(filters.due_date_from)
            || hasText(filters.due_date_to)
            || Boolean(filters.dueDateFilter)
            || filters.overdue
            || filters.no_due_date;
        case 'target_date':
          return hasText(filters.target_date_from)
            || hasText(filters.target_date_to)
            || filters.no_target_date;
        case 'created_by_name':
          return (filters.created_by || []).length > 0;
        case 'created_at':
          return hasText(filters.created_date_from) || hasText(filters.created_date_to);
        case 'notes':
          return hasText(filters.notes);
        case 'category':
          return hasText(filters.category);
        case 'section':
          return hasText(filters.section);
        case 'estimated_hours':
          return filters.estimated_hours_min !== '' || filters.estimated_hours_max !== '';
        case 'actual_hours':
          return filters.actual_hours_min !== '' || filters.actual_hours_max !== '';
        case 'completion_percentage':
          return filters.completion_percentage_min !== '' || filters.completion_percentage_max !== '';
        case 'tags':
          return hasText(filters.tags);
        case 'external_id':
          return hasText(filters.external_id);
        default:
          return false;
      }
    },
    [filters]
  );

  const clearColumnFilter = useCallback(
    (colId) => {
      switch (colId) {
        case 'name':
          updateFilters({ name: '', recurring: null });
          break;
        case 'project_name':
          updateFilters({ projects: [], include_archived: false });
          break;
        case 'client_name':
          updateFilters({ client_name: '' });
          break;
        case 'stage':
          updateFilters({ stage: [] });
          break;
        case 'status':
          updateFilters({ status: [], hideCompleted: true });
          break;
        case 'priority':
          updateFilters({ priority: [] });
          break;
        case 'assignee_name':
          updateFilters({ assignee: 'all' });
          break;
        case 'collaborators':
          updateFilters({ collaborators: [] });
          break;
        case 'due_date':
          updateFilters({
            due_date_from: '',
            due_date_to: '',
            dueDateFilter: null,
            overdue: false,
            no_due_date: false,
          });
          break;
        case 'target_date':
          updateFilters({ target_date_from: '', target_date_to: '', no_target_date: false });
          break;
        case 'created_by_name':
          updateFilters({ created_by: [] });
          break;
        case 'created_at':
          updateFilters({ created_date_from: '', created_date_to: '' });
          break;
        case 'notes':
          updateFilters({ notes: '' });
          break;
        case 'category':
          updateFilters({ category: '' });
          break;
        case 'section':
          updateFilters({ section: '' });
          break;
        case 'estimated_hours':
          updateFilters({ estimated_hours_min: '', estimated_hours_max: '' });
          break;
        case 'actual_hours':
          updateFilters({ actual_hours_min: '', actual_hours_max: '' });
          break;
        case 'completion_percentage':
          updateFilters({ completion_percentage_min: '', completion_percentage_max: '' });
          break;
        case 'tags':
          updateFilters({ tags: '' });
          break;
        case 'external_id':
          updateFilters({ external_id: '' });
          break;
        default:
          break;
      }
    },
    [updateFilters]
  );

  const renderMultiSelect = (value, options, placeholder, onChange) => {
    const normalized = (Array.isArray(value) ? value : []).map((item) => String(item));
    return (
    <FormControl fullWidth size="small">
      <Select
        multiple
        value={value}
        onChange={onChange}
        displayEmpty
        renderValue={(selected) => {
          if (!selected || selected.length === 0) {
            return (
              <Typography variant="body2" color="text.secondary">
                {placeholder}
              </Typography>
            );
          }
          const labels = selected.map((val) => {
            const match = options.find((opt) => String(opt.value) === String(val));
            return match ? match.label : val;
          });
          return labels.join(', ');
        }}
      >
        {options.map((option) => (
          <MenuItem key={option.value} value={option.value}>
            <Checkbox checked={normalized.includes(String(option.value))} size="small" />
            <ListItemText primary={option.label} />
          </MenuItem>
        ))}
      </Select>
    </FormControl>
    );
  };

  const renderFilterContent = () => {
    if (!filterColumnId) return null;

    const selectedProjects = Array.isArray(filters.projects) ? filters.projects : [];
    const selectedStatuses = Array.isArray(filters.status) ? filters.status : [];
    const selectedStages = Array.isArray(filters.stage) ? filters.stage : [];
    const selectedPriorities = Array.isArray(filters.priority) ? filters.priority : [];
    const selectedCreators = Array.isArray(filters.created_by) ? filters.created_by : [];
    const selectedCollaborators = Array.isArray(filters.collaborators) ? filters.collaborators : [];

    const projectOptions = (Array.isArray(projects) ? projects : []).map((project) => ({
      value: project.id,
      label: project.name || `Project ${project.id}`,
    }));

    const memberOptions = (Array.isArray(workspaceMembers) ? workspaceMembers : []).map((member) => ({
      value: member.id,
      label: getMemberLabel(member),
    }));

    const statusOptionsList = (Array.isArray(statusOptions) ? statusOptions : []).map((value) => ({
      value,
      label: value,
    }));

    const stageOptionsList = (Array.isArray(stageOptions) ? stageOptions : []).map((value) => ({
      value,
      label: value,
    }));

    const priorityOptionsList = (Array.isArray(priorityOptions) ? priorityOptions : []).map((value) => ({
      value,
      label: value,
    }));

    switch (filterColumnId) {
      case 'name':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              label="Task name"
              size="small"
              value={filters.name || ''}
              onChange={(e) => updateFilters({ name: e.target.value })}
            />
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={filters.recurring === null ? '' : (filters.recurring ? 'true' : 'false')}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '') {
                    updateFilters({ recurring: null });
                  } else {
                    updateFilters({ recurring: value === 'true' });
                  }
                }}
              >
                <MenuItem value="">All tasks</MenuItem>
                <MenuItem value="true">Recurring only</MenuItem>
                <MenuItem value="false">Non-recurring only</MenuItem>
              </Select>
            </FormControl>
          </Box>
        );
      case 'project_name':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {renderMultiSelect(
              selectedProjects,
              projectOptions,
              'All projects',
              (e) => updateFilters({ projects: e.target.value })
            )}
            <FormControlLabel
              control={(
                <Checkbox
                  size="small"
                  checked={filters.include_archived}
                  onChange={(e) => updateFilters({ include_archived: e.target.checked })}
                />
              )}
              label="Include archived tasks"
            />
          </Box>
        );
      case 'client_name':
        return (
          <TextField
            label="Client name"
            size="small"
            value={filters.client_name || ''}
            onChange={(e) => updateFilters({ client_name: e.target.value })}
          />
        );
      case 'status':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {renderMultiSelect(
              selectedStatuses,
              statusOptionsList,
              'All statuses',
              (e) => updateFilters({ status: e.target.value })
            )}
            <FormControlLabel
              control={(
                <Checkbox
                  size="small"
                  checked={!filters.hideCompleted}
                  onChange={(e) => updateFilters({ hideCompleted: !e.target.checked })}
                />
              )}
              label="Show completed/closed"
            />
          </Box>
        );
      case 'stage':
        return renderMultiSelect(
          selectedStages,
          stageOptionsList,
          'All stages',
          (e) => updateFilters({ stage: e.target.value })
        );
      case 'priority':
        return renderMultiSelect(
          selectedPriorities,
          priorityOptionsList,
          'All priorities',
          (e) => updateFilters({ priority: e.target.value })
        );
      case 'assignee_name':
        return (
          <FormControl fullWidth size="small">
            <Select
              value={filters.assignee || 'all'}
              onChange={(e) => updateFilters({ assignee: e.target.value })}
            >
              <MenuItem value="all">All assignees</MenuItem>
              <MenuItem value="me">Me</MenuItem>
              <MenuItem value="unassigned">Unassigned</MenuItem>
              {memberOptions.map((option) => (
                <MenuItem key={option.value} value={option.value}>
                  {option.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        );
      case 'collaborators':
        return renderMultiSelect(
          selectedCollaborators,
          memberOptions,
          'Any collaborator',
          (e) => updateFilters({ collaborators: e.target.value })
        );
      case 'due_date':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControl fullWidth size="small">
              <Select
                displayEmpty
                value={filters.dueDateFilter || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  updateFilters({
                    dueDateFilter: value || null,
                    overdue: false,
                    no_due_date: false,
                    ...(value ? { due_date_from: '', due_date_to: '' } : {}),
                  });
                }}
              >
                <MenuItem value="">Any date</MenuItem>
                <MenuItem value="today">Today</MenuItem>
                <MenuItem value="tomorrow">Tomorrow</MenuItem>
                <MenuItem value="overdue">Overdue</MenuItem>
                <MenuItem value="week">Next 7 days</MenuItem>
                <MenuItem value="month">Next 30 days</MenuItem>
              </Select>
            </FormControl>
            <FormControlLabel
              control={(
                <Checkbox
                  size="small"
                  checked={Boolean(filters.no_due_date)}
                  onChange={(e) => updateFilters({
                    no_due_date: e.target.checked,
                    dueDateFilter: null,
                    overdue: false,
                    due_date_from: '',
                    due_date_to: '',
                  })}
                />
              )}
              label="No due date"
            />
            <TextField
              label="From"
              type="date"
              size="small"
              value={filters.due_date_from || ''}
              onChange={(e) => updateFilters({
                due_date_from: e.target.value,
                dueDateFilter: null,
                no_due_date: false,
              })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={filters.due_date_to || ''}
              onChange={(e) => updateFilters({
                due_date_to: e.target.value,
                dueDateFilter: null,
                no_due_date: false,
              })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        );
      case 'target_date':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <FormControlLabel
              control={(
                <Checkbox
                  size="small"
                  checked={Boolean(filters.no_target_date)}
                  onChange={(e) => updateFilters({
                    no_target_date: e.target.checked,
                    target_date_from: '',
                    target_date_to: '',
                  })}
                />
              )}
              label="No target date"
            />
            <TextField
              label="From"
              type="date"
              size="small"
              value={filters.target_date_from || ''}
              onChange={(e) => updateFilters({
                target_date_from: e.target.value,
                no_target_date: false,
              })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={filters.target_date_to || ''}
              onChange={(e) => updateFilters({
                target_date_to: e.target.value,
                no_target_date: false,
              })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        );
      case 'created_by_name':
        return renderMultiSelect(
          selectedCreators,
          memberOptions,
          'Any creator',
          (e) => updateFilters({ created_by: e.target.value })
        );
      case 'created_at':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              label="From"
              type="date"
              size="small"
              value={filters.created_date_from || ''}
              onChange={(e) => updateFilters({ created_date_from: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="To"
              type="date"
              size="small"
              value={filters.created_date_to || ''}
              onChange={(e) => updateFilters({ created_date_to: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
          </Box>
        );
      case 'notes':
        return (
          <TextField
            label="Notes"
            size="small"
            value={filters.notes || ''}
            onChange={(e) => updateFilters({ notes: e.target.value })}
          />
        );
      case 'category':
        return (
          <TextField
            label="Category"
            size="small"
            value={filters.category || ''}
            onChange={(e) => updateFilters({ category: e.target.value })}
          />
        );
      case 'section':
        return (
          <TextField
            label="Section"
            size="small"
            value={filters.section || ''}
            onChange={(e) => updateFilters({ section: e.target.value })}
          />
        );
      case 'estimated_hours':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              label="Min hours"
              type="number"
              size="small"
              value={filters.estimated_hours_min}
              onChange={(e) => updateFilters({ estimated_hours_min: e.target.value })}
              inputProps={{ min: 0, step: 0.25 }}
            />
            <TextField
              label="Max hours"
              type="number"
              size="small"
              value={filters.estimated_hours_max}
              onChange={(e) => updateFilters({ estimated_hours_max: e.target.value })}
              inputProps={{ min: 0, step: 0.25 }}
            />
          </Box>
        );
      case 'actual_hours':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              label="Min hours"
              type="number"
              size="small"
              value={filters.actual_hours_min}
              onChange={(e) => updateFilters({ actual_hours_min: e.target.value })}
              inputProps={{ min: 0, step: 0.25 }}
            />
            <TextField
              label="Max hours"
              type="number"
              size="small"
              value={filters.actual_hours_max}
              onChange={(e) => updateFilters({ actual_hours_max: e.target.value })}
              inputProps={{ min: 0, step: 0.25 }}
            />
          </Box>
        );
      case 'completion_percentage':
        return (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <TextField
              label="Min %"
              type="number"
              size="small"
              value={filters.completion_percentage_min}
              onChange={(e) => updateFilters({ completion_percentage_min: e.target.value })}
              inputProps={{ min: 0, max: 100, step: 1 }}
            />
            <TextField
              label="Max %"
              type="number"
              size="small"
              value={filters.completion_percentage_max}
              onChange={(e) => updateFilters({ completion_percentage_max: e.target.value })}
              inputProps={{ min: 0, max: 100, step: 1 }}
            />
          </Box>
        );
      case 'tags':
        return (
          <TextField
            label="Tags"
            size="small"
            placeholder="tag1, tag2"
            value={filters.tags || ''}
            onChange={(e) => updateFilters({ tags: e.target.value })}
          />
        );
      case 'external_id':
        return (
          <TextField
            label="External ID"
            size="small"
            value={filters.external_id || ''}
            onChange={(e) => updateFilters({ external_id: e.target.value })}
          />
        );
      default:
        return null;
    }
  };

  /* --------- column resize logic --------- */
  const startResize = (e, colId) => {
    e.preventDefault();
    e.stopPropagation();

    // don't allow resizing sticky checkbox/task/actions
    if (colId === 'name' || colId === 'actions') return;

    const startX = e.clientX;
    const startW = colWidths[colId] || e.currentTarget.parentElement.getBoundingClientRect().width;

    dragRef.current = { colId, startX, startW };

    const onMove = (ev) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const next = Math.max(80, Math.round(dragRef.current.startW + dx));
      setColWidths((prev) => ({ ...prev, [dragRef.current.colId]: next }));
    };

    const onUp = () => {
      dragRef.current = null;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  /* --------- cell sx helpers --------- */
  const getHeaderCellSx = useCallback((colId) => {
    const base = {
      bgcolor: '#f8fafc',
      fontWeight: 800,
      ...NOWRAP_SX,
      py: density === 'compact' ? 0.75 : 1.1,
      ...getDividerSx(colId),
    };

    if (colId === 'name') {
      return {
        ...base,
        ...TASK_COL_SX,
        ...stickyHeaderSx,
        left: CHECKBOX_W,
        borderRight: `1px solid ${dividerColor}`,
        zIndex: 4,
      };
    }

    if (colId === 'actions') {
      return { ...base, ...ACTIONS_CELL_SX };
    }

    // resizable columns (px), else auto
    const w = colWidths[colId];
    return {
      ...base,
      ...(w ? { width: w, minWidth: w, maxWidth: w } : {}),
    };
  }, [density, colWidths]);

  const getBodyCellSx = useCallback((colId, dens) => {
    const base = {
      ...NOWRAP_SX,
      ...(colId === 'actions' ? ACTIONS_CELL_SX : {}),
      ...(colId === 'name' ? TASK_COL_SX : {}),
      py: dens === 'compact' ? 0.6 : 1.0,
      ...getDividerSx(colId),
    };

    // apply fixed px widths to resized columns
    const w = colWidths[colId];
    if (w && colId !== 'name' && colId !== 'actions') {
      return { ...base, width: w, minWidth: w, maxWidth: w };
    }

    return base;
  }, [colWidths]);

  /* --------- render --------- */

  return (
    <Paper sx={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Top toolbar (density + sorting info) */}
      <Box sx={{ px: 2, py: 1.25, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, minWidth: 0 }}>
          <Typography sx={{ fontWeight: 800 }} noWrap>
            Tasks
          </Typography>
          <Divider orientation="vertical" flexItem />
          <Typography variant="caption" color="text.secondary" noWrap>
            Sort: <b>{getColumnById(orderBy)?.label || orderBy}</b> ({order})
          </Typography>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          {hasActiveFilters && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary" noWrap>
                Active filters: {activeFilterCount}
              </Typography>
              <Button
                size="small"
                onClick={onClearFilters}
                disabled={typeof onClearFilters !== 'function'}
              >
                Clear All
              </Button>
            </Box>
          )}
          <ToggleButtonGroup
            size="small"
            exclusive
            value={density}
            onChange={(e, v) => v && setDensity(v)}
          >
            <ToggleButton value="compact" aria-label="Compact density" title="Compact">
              <DensitySmallIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="comfortable" aria-label="Comfortable density" title="Comfortable">
              <DensityMediumIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {loading && <LinearProgress />}

      <TableContainer sx={{ flex: 1, overflow: 'auto' }}>
        <Table
          stickyHeader
          size="small"
          sx={{
            // fixed layout helps resizing + sticky columns
            tableLayout: 'fixed',
            width: 'max-content',
            minWidth: 1100,
            '& th, & td': { ...NOWRAP_SX },
            '& th *': { whiteSpace: 'nowrap !important' },
            '& td *': { whiteSpace: 'nowrap !important' },
          }}
        >
          <TableHead>
            <TableRow>
              {/* Sticky checkbox header */}
              <TableCell
                padding="none"
                sx={{
                  ...CHECKBOX_CELL_SX,
                  ...NOWRAP_SX,
                  bgcolor: '#f8fafc',
                  ...stickyHeaderSx,
                  left: 0,
                  zIndex: 5,
                  borderRight: `1px solid ${dividerColor}`,
                  py: density === 'compact' ? 0.75 : 1.1,
                }}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Checkbox
                    indeterminate={selectedTasks.length > 0 && selectedTasks.length < tasks.length}
                    checked={tasks.length > 0 && selectedTasks.length === tasks.length}
                    onChange={handleSelectAll}
                    size="small"
                    sx={{ p: 0.25, m: 0 }}
                  />
                </Box>
              </TableCell>

              {displayedColumns.map((col) => (
                <TableCell key={col.id} sx={getHeaderCellSx(col.id)}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    {col.sortable ? (
                      <TableSortLabel
                        active={orderBy === col.id}
                        direction={orderBy === col.id ? order : 'asc'}
                        onClick={() => handleSort(col)}
                      >
                        <Typography variant="body2" noWrap sx={{ fontWeight: 800, ...NOWRAP_SX }}>
                          {col.label}
                        </Typography>
                      </TableSortLabel>
                    ) : (
                      <Typography variant="body2" noWrap sx={{ fontWeight: 800, ...NOWRAP_SX }}>
                        {col.label}
                      </Typography>
                    )}

                    {col.id !== 'actions' && (
                      <Tooltip title="Filter">
                        <IconButton
                          size="small"
                          onClick={(e) => handleFilterOpen(e, col.id)}
                          color={isColumnFiltered(col.id) ? 'primary' : 'default'}
                        >
                          <FilterListIcon fontSize="inherit" />
                        </IconButton>
                      </Tooltip>
                    )}

                    {/* resize handle (not for Task/actions) */}
                    {col.id !== 'name' && col.id !== 'actions' && (
                      <Box
                        onMouseDown={(e) => startResize(e, col.id)}
                        sx={{
                          marginLeft: 'auto',
                          width: 10,
                          height: 18,
                          cursor: 'col-resize',
                          borderRadius: 1,
                          opacity: 0.35,
                          '&:hover': { opacity: 1, bgcolor: 'rgba(148,163,184,0.25)' },
                        }}
                        title="Drag to resize"
                      />
                    )}
                  </Box>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>

          <TableBody>
            {/* Grouped */}
            {groupedTasks ? (
              (() => {
                let globalIndex = 0;
                return Object.entries(groupedTasks).map(([key, group]) => {
                  const isExpanded = expandedGroups[key] !== false;
                  return (
                    <React.Fragment key={key}>
                      <GroupHeaderRow
                        groupKey={key}
                        group={group}
                        isExpanded={isExpanded}
                        onToggle={toggleGroup}
                        colSpan={displayedColumns.length + 1}
                      />
                      {isExpanded &&
                        group.tasks.map((task) => {
                          const rowIndex = globalIndex++;
                          const selected = isSelected(task.id);
                          return (
                            <TaskRow
                              key={task.id}
                              task={task}
                              rowIndex={rowIndex}
                              displayedColumns={displayedColumns}
                              selected={selected}
                              onRowClick={() => onTaskClick(task)}
                              onToggleSelect={() => handleSelectTask(task.id)}
                              onTaskEdit={onTaskEdit}
                              getTaskIndicators={getTaskIndicators}
                              density={density}
                              getBodyCellSx={getBodyCellSx}
                              onDateFilterClick={onDateFilterClick}
                            />
                          );
                        })}
                    </React.Fragment>
                  );
                });
              })()
            ) : (
              // Ungrouped
              sortedTasks.map((task, idx) => {
                const selected = isSelected(task.id);
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    rowIndex={idx}
                    displayedColumns={displayedColumns}
                    selected={selected}
                    onRowClick={() => onTaskClick(task)}
                    onToggleSelect={() => handleSelectTask(task.id)}
                    onTaskEdit={onTaskEdit}
                    getTaskIndicators={getTaskIndicators}
                    density={density}
                    getBodyCellSx={getBodyCellSx}
                    onDateFilterClick={onDateFilterClick}
                  />
                );
              })
            )}

            {/* Empty state */}
            {(!sortedTasks || sortedTasks.length === 0) && !loading && (
              <TableRow>
                <TableCell colSpan={displayedColumns.length + 1} align="center" sx={{ py: 5 }}>
                  <Typography sx={{ fontWeight: 800, mb: 0.75 }}>No tasks found</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Try changing filters, or create a new task to get started.
                  </Typography>

                  {typeof onCreateTask === 'function' && (
                    <Button
                      variant="contained"
                      startIcon={<AddIcon />}
                      onClick={onCreateTask}
                      sx={{ textTransform: 'none', borderRadius: 2 }}
                    >
                      Create Task
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <Popover
          open={Boolean(filterAnchorEl)}
          anchorEl={filterAnchorEl}
          onClose={handleFilterClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'left' }}
          transformOrigin={{ vertical: 'top', horizontal: 'left' }}
        >
          <Box sx={{ p: 2, width: 260, display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="subtitle2" fontWeight={700}>
              {getColumnById(filterColumnId)?.label || 'Filter'}
            </Typography>
            {renderFilterContent()}
            <Box sx={{ display: 'flex', justifyContent: 'space-between', pt: 0.5 }}>
              <Button size="small" onClick={() => clearColumnFilter(filterColumnId)}>
                Clear
              </Button>
              <Button size="small" onClick={handleFilterClose}>
                Close
              </Button>
            </Box>
          </Box>
        </Popover>
      </TableContainer>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Tooltip title={hasSelection ? `${selectedCount} selected` : 'No tasks selected'}>
            <span>
              <IconButton size="small" disabled={!hasSelection}>
                <Badge color="primary" badgeContent={selectedCount} invisible={!hasSelection}>
                  <PlaylistAddCheckIcon fontSize="small" />
                </Badge>
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Bulk actions">
            <span>
              <IconButton
                size="small"
                onClick={onOpenBulkActions}
                disabled={!hasSelection || typeof onOpenBulkActions !== 'function'}
              >
                <TuneIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Generate link">
            <span>
              <IconButton
                size="small"
                onClick={onOpenShareLink}
                disabled={!hasSelection || typeof onOpenShareLink !== 'function'}
              >
                <InsertLinkIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title="Clear selection">
            <span>
              <IconButton
                size="small"
                onClick={onClearSelection}
                disabled={!hasSelection || typeof onClearSelection !== 'function'}
              >
                <ClearIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
        </Box>
        <TablePagination
          component="div"
          sx={{ flex: 1 }}
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
      </Box>
    </Paper>
  );
}

export default TasksTableView;
