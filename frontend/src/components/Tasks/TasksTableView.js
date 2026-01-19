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

import {
  formatDistanceToNow,
  format,
  isValid,
  differenceInCalendarDays,
} from 'date-fns';
import { parseDateInput } from '../../utils/date';

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
  return format(date, 'dd-MMM-yy');
};

const formatRelativeDate = (dateStr) => {
  const date = parseDateValue(dateStr);
  if (!date) return null;
  return formatDistanceToNow(date, { addSuffix: true });
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
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
};

const getDueSignal = (dateStr) => {
  const d = parseDateValue(dateStr);
  if (!d) return null;

  const diff = differenceInCalendarDays(d, new Date()); // future = positive
  if (diff === 0) return { label: 'Today', color: '#2563eb', bg: '#eff6ff' };
  if (diff < 0) return { label: 'Overdue', color: '#dc2626', bg: '#fef2f2' };
  if (diff > 0 && diff <= 7) return { label: `in ${diff}d`, color: '#0f766e', bg: 'rgba(15,118,110,0.08)' };
  return null;
};

// ✅ Force single line (NO WRAP) everywhere
const getTargetPlanSignal = (dateStr) => {
  const d = parseDateValue(dateStr);
  if (!d) return null;

  const diff = differenceInCalendarDays(d, new Date());
  if (diff < 0) return { label: 'Overdue', color: '#dc2626', bg: '#fef2f2' };
  if (diff === 0) return { label: 'Planned for today', color: '#0f766e', bg: 'rgba(15,118,110,0.08)' };
  if (diff === 1) return { label: 'Planned for tomorrow', color: '#0f766e', bg: 'rgba(15,118,110,0.08)' };
  if (diff <= 7) return { label: 'Planned this week', color: '#2563eb', bg: '#eff6ff' };
  if (diff <= 31) return { label: 'Planned this month', color: '#0f766e', bg: 'rgba(15,118,110,0.08)' };
  return { label: 'Planned later', color: '#64748b', bg: '#f8fafc' };
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
  'assignee_name', 'due_date', 'actions'
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

              switch (colId) {
                case 'name':
                  return (
                    <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
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
                  const signal = getDueSignal(task.due_date);

                  return (
                    <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                      {dueTooltip ? (
                        <Tooltip title={dueTooltip}>
                          <Typography
                            variant="body2"
                            noWrap
                            sx={{
                              ...NOWRAP_SX,
                              color: task.is_overdue ? '#dc2626' : 'text.primary',
                              fontWeight: task.is_overdue ? 700 : 500,
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
                            fontWeight: task.is_overdue ? 700 : 500,
                          }}
                        >
                          {dueText}
                        </Typography>
                      )}

                      {isToday(task.due_date) && (
                        <Tooltip title="Due today">
                          <CalendarTodayIcon sx={{ color: '#2563eb', fontSize: '1rem', flexShrink: 0 }} />
                        </Tooltip>
                      )}

                      {signal && (
                        <Chip
                          size="small"
                          label={signal.label}
                          sx={{
                            height: 20,
                            bgcolor: signal.bg,
                            color: signal.color,
                            fontWeight: 700,
                            '& .MuiChip-label': { px: 1, fontSize: '0.72rem' },
                          }}
                        />
                      )}
                    </Box>
                  );
                }

                case 'target_date':
                  return (() => {
                    const targetSignal = getTargetPlanSignal(task.target_date);
                    return (
                      <Box sx={{ display: 'inline-flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                        <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                          {formatDate(task.target_date)}
                        </Typography>
                        {targetSignal && (
                          <Chip
                            size="small"
                            label={targetSignal.label}
                            sx={{
                              height: 20,
                              bgcolor: targetSignal.bg,
                              color: targetSignal.color,
                              fontWeight: 700,
                              '& .MuiChip-label': { px: 1, fontSize: '0.72rem' },
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
                  return task.completion_percentage != null ? (
                    <Typography variant="body2" noWrap sx={NOWRAP_SX}>
                      {task.completion_percentage}%
                    </Typography>
                  ) : (
                    <Typography variant="body2" color="text.secondary" noWrap sx={NOWRAP_SX}>-</Typography>
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
  onCreateTask, // optional: shows Create Task button in empty state
}) {
  const [expandedGroups, setExpandedGroups] = useState({});
  const [density, setDensity] = useState('comfortable'); // 'compact' | 'comfortable'
  const [orderBy, setOrderBy] = useState('due_date');
  const [order, setOrder] = useState('asc');

  // Column widths (resize) in px for non-sticky columns
  const [colWidths, setColWidths] = useState({}); // { [colId]: number }
  const dragRef = useRef(null);

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
          <ToggleButtonGroup
            size="small"
            exclusive
            value={density}
            onChange={(e, v) => v && setDensity(v)}
          >
            <ToggleButton value="compact">Compact</ToggleButton>
            <ToggleButton value="comfortable">Comfortable</ToggleButton>
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
