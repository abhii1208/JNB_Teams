import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import EditIcon from '@mui/icons-material/Edit';
import SendIcon from '@mui/icons-material/Send';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CommentIcon from '@mui/icons-material/Comment';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import {
  addTaskComment,
  addTaskWorkLog,
  getTaskDetails,
  sendTaskReminder,
} from '../../apiClient';

const statusColor = (status) => {
  switch (status) {
    case 'Closed':
    case 'Completed':
      return { bg: '#dcfce7', color: '#166534' };
    case 'Pending Approval':
      return { bg: '#fef3c7', color: '#92400e' };
    case 'Rejected':
      return { bg: '#fee2e2', color: '#b91c1c' };
    default:
      return { bg: '#e0f2fe', color: '#075985' };
  }
};

const priorityColor = (priority) => {
  switch (priority) {
    case 'Critical':
      return { bg: '#fee2e2', color: '#b91c1c' };
    case 'High':
      return { bg: '#ffedd5', color: '#c2410c' };
    case 'Low':
      return { bg: '#dcfce7', color: '#166534' };
    default:
      return { bg: '#fef3c7', color: '#92400e' };
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kolkata',
  }).format(date);
};

const formatDateOnly = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'medium',
    timeZone: 'Asia/Kolkata',
  }).format(date);
};

function TaskDetailsDrawer({ open, taskId, onClose, onEdit, workspaceMembers = [], onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [task, setTask] = useState(null);
  const [error, setError] = useState('');
  const [commentText, setCommentText] = useState('');
  const [workLog, setWorkLog] = useState({ work_date: '', start_time: '', end_time: '', hours: '', notes: '' });
  const [reminder, setReminder] = useState({ recipient_ids: [], message: '', delivery_channels: ['in_app'] });

  const fetchDetails = useCallback(async () => {
    if (!taskId || !open) return;
    setLoading(true);
    setError('');
    try {
      const response = await getTaskDetails(taskId);
      setTask(response.data);
    } catch (err) {
      console.error('Failed to fetch task details:', err);
      setError(err?.response?.data?.error || 'Failed to load task details');
    } finally {
      setLoading(false);
    }
  }, [open, taskId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const recipientOptions = useMemo(() => {
    return workspaceMembers.map((member) => ({
      id: member.id,
      label: `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.username || member.email,
    }));
  }, [workspaceMembers]);

  const handleAddComment = async () => {
    if (!commentText.trim()) return;
    await addTaskComment(taskId, commentText.trim());
    setCommentText('');
    await fetchDetails();
    onUpdated?.();
  };

  const handleAddWorkLog = async () => {
    await addTaskWorkLog(taskId, workLog);
    setWorkLog({ work_date: '', start_time: '', end_time: '', hours: '', notes: '' });
    await fetchDetails();
    onUpdated?.();
  };

  const handleSendReminder = async () => {
    if (!reminder.recipient_ids.length) return;
    await sendTaskReminder(taskId, reminder);
    setReminder({ recipient_ids: [], message: '', delivery_channels: ['in_app'] });
    await fetchDetails();
    onUpdated?.();
  };

  return (
    <Drawer
      anchor="right"
      open={open}
      onClose={onClose}
      PaperProps={{
        sx: {
          width: { xs: '100%', sm: 560 },
          maxWidth: '100%',
          bgcolor: '#f8fafc',
        },
      }}
    >
      <Box sx={{ p: 2.5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="overline" sx={{ color: '#0f766e', fontWeight: 800 }}>
            Task Details
          </Typography>
          <Typography variant="h6" sx={{ fontWeight: 800 }} noWrap>
            {task?.name || 'Task'}
          </Typography>
          {task?.project_name ? (
            <Typography variant="body2" color="text.secondary" noWrap>
              Project: {task.project_name}
            </Typography>
          ) : null}
        </Box>
        <Stack direction="row" spacing={1}>
          <IconButton onClick={() => task && onEdit?.(task)}>
            <EditIcon />
          </IconButton>
          <IconButton onClick={onClose}>
            <CloseIcon />
          </IconButton>
        </Stack>
      </Box>

      <Divider />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 8 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Box sx={{ p: 2.5 }}>
          <Alert severity="error">{error}</Alert>
        </Box>
      ) : task ? (
        <Box sx={{ p: 2.5, overflowY: 'auto' }}>
          <Stack spacing={2.5}>
            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mb: 1.5 }}>
                <Chip label={task.project_name || 'Project'} variant="outlined" />
                <Chip label={task.status || 'Open'} sx={{ bgcolor: statusColor(task.status).bg, color: statusColor(task.status).color, fontWeight: 700 }} />
                <Chip label={task.priority || 'Medium'} sx={{ bgcolor: priorityColor(task.priority).bg, color: priorityColor(task.priority).color, fontWeight: 700 }} />
                {task.service_name ? <Chip label={task.service_name} variant="outlined" /> : null}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                {task.description || task.notes || 'No description provided.'}
              </Typography>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1.5 }}>
                <Typography variant="body2"><strong>Assignee:</strong> {task.assignee_name || '-'}</Typography>
                <Typography variant="body2"><strong>Due Date:</strong> {formatDateOnly(task.due_date)}</Typography>
                <Typography variant="body2"><strong>Worked Hours:</strong> {task.worked_hours || 0}</Typography>
                <Typography variant="body2"><strong>Start Time:</strong> {formatDateTime(task.start_time)}</Typography>
                <Typography variant="body2"><strong>End Time:</strong> {formatDateTime(task.end_time)}</Typography>
                <Typography variant="body2"><strong>Created By:</strong> {task.created_by_name || '-'}</Typography>
              </Box>
            </Paper>

            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <CommentIcon fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Comments</Typography>
              </Stack>
              <List sx={{ p: 0, mb: 1.5 }}>
                {(task.comments || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No comments yet.</Typography>
                ) : (
                  task.comments.map((comment) => (
                    <ListItem key={comment.id} disableGutters divider>
                      <ListItemText
                        primary={`${comment.user_name || 'User'} • ${formatDateTime(comment.created_at)}`}
                        secondary={comment.comment}
                      />
                    </ListItem>
                  ))
                )}
              </List>
              <Stack direction="row" spacing={1}>
                <TextField
                  fullWidth
                  size="small"
                  placeholder="Add a comment"
                  value={commentText}
                  onChange={(event) => setCommentText(event.target.value)}
                />
                <Button variant="contained" onClick={handleAddComment}>Post</Button>
              </Stack>
            </Paper>

            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <AccessTimeIcon fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Work Logs</Typography>
              </Stack>
              <List sx={{ p: 0, mb: 1.5 }}>
                {(task.work_logs || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No work sessions logged yet.</Typography>
                ) : (
                  task.work_logs.map((log) => (
                    <ListItem key={log.id} disableGutters divider>
                      <ListItemText
                        primary={`${log.user_name || 'User'} • ${formatDateOnly(log.work_date)} • ${log.hours || 0}h`}
                        secondary={`Start: ${formatDateTime(log.start_time)} • End: ${formatDateTime(log.end_time)}${log.notes ? ` • ${log.notes}` : ''}`}
                      />
                    </ListItem>
                  ))
                )}
              </List>
              <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 1 }}>
                <TextField size="small" type="date" label="Work Date" value={workLog.work_date} onChange={(e) => setWorkLog((prev) => ({ ...prev, work_date: e.target.value }))} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="number" label="Hours" value={workLog.hours} onChange={(e) => setWorkLog((prev) => ({ ...prev, hours: e.target.value }))} />
                <TextField size="small" type="datetime-local" label="Start Time" value={workLog.start_time} onChange={(e) => setWorkLog((prev) => ({ ...prev, start_time: e.target.value }))} InputLabelProps={{ shrink: true }} />
                <TextField size="small" type="datetime-local" label="End Time" value={workLog.end_time} onChange={(e) => setWorkLog((prev) => ({ ...prev, end_time: e.target.value }))} InputLabelProps={{ shrink: true }} />
              </Box>
              <TextField
                fullWidth
                size="small"
                multiline
                minRows={2}
                sx={{ mt: 1 }}
                label="Work Notes"
                value={workLog.notes}
                onChange={(e) => setWorkLog((prev) => ({ ...prev, notes: e.target.value }))}
              />
              <Button sx={{ mt: 1.5 }} variant="contained" onClick={handleAddWorkLog}>Add Work Log</Button>
            </Paper>

            <Paper sx={{ p: 2, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
                <NotificationsActiveIcon fontSize="small" />
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Reminder History</Typography>
              </Stack>
              <List sx={{ p: 0, mb: 1.5 }}>
                {(task.reminders || []).length === 0 ? (
                  <Typography variant="body2" color="text.secondary">No reminders sent yet.</Typography>
                ) : (
                  task.reminders.map((entry) => (
                    <ListItem key={entry.id} disableGutters divider>
                      <ListItemText
                        primary={`${entry.sender_name || 'User'} → ${entry.recipient_name || 'Recipient'}`}
                        secondary={`${entry.message || 'Task reminder'} • ${formatDateTime(entry.sent_at)}`}
                      />
                    </ListItem>
                  ))
                )}
              </List>
              <TextField
                select
                fullWidth
                size="small"
                label="Recipients"
                SelectProps={{ multiple: true }}
                value={reminder.recipient_ids}
                onChange={(event) => setReminder((prev) => ({ ...prev, recipient_ids: event.target.value }))}
              >
                {recipientOptions.map((option) => (
                  <MenuItem key={option.id} value={option.id}>{option.label}</MenuItem>
                ))}
              </TextField>
              <TextField
                fullWidth
                size="small"
                sx={{ mt: 1 }}
                label="Reminder Message"
                value={reminder.message}
                onChange={(event) => setReminder((prev) => ({ ...prev, message: event.target.value }))}
              />
              <Button sx={{ mt: 1.5 }} variant="contained" startIcon={<SendIcon />} onClick={handleSendReminder}>
                Send Reminder
              </Button>
            </Paper>
          </Stack>
        </Box>
      ) : null}
    </Drawer>
  );
}

export default TaskDetailsDrawer;
