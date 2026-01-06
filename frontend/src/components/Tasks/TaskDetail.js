import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  TextField,
  Typography,
  Avatar,
  AvatarGroup,
  Alert,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import CommentIcon from '@mui/icons-material/Comment';
import { approveApproval, rejectApproval, getApprovals, updateTask } from '../../apiClient';
import { formatShortDate } from '../../utils/date';

const stageColors = {
  'Planned': { bg: '#e0e7ff', text: '#3730a3' },
  'In-process': { bg: '#fef3c7', text: '#92400e' },
  'Completed': { bg: '#d1fae5', text: '#065f46' },
  'Dropped': { bg: '#fee2e2', text: '#991b1b' },
  'On-hold': { bg: '#f3e8ff', text: '#6b21a8' },
};

const statusColors = {
  'Open': { bg: '#fef3c7', text: '#92400e' },
  'Pending Approval': { bg: '#fee2e2', text: '#991b1b' },
  'Closed': { bg: '#e2e8f0', text: '#475569' },
  'Rejected': { bg: '#fee2e2', text: '#991b1b' },
};

// Mock comments/activity
const mockActivity = [
  {
    id: 1,
    type: 'comment',
    user: 'Sarah Miller',
    avatar: 'SM',
    content: 'I\'ve completed the initial draft. Ready for review.',
    timestamp: '2026-01-05 10:30 AM',
  },
  {
    id: 2,
    type: 'status',
    user: 'John Doe',
    avatar: 'JD',
    content: 'Changed stage from In-process to Completed',
    timestamp: '2026-01-05 02:15 PM',
  },
  {
    id: 3,
    type: 'request',
    user: 'Sarah Miller',
    avatar: 'SM',
    content: 'Requested task closure',
    timestamp: '2026-01-05 02:20 PM',
  },
];

function TaskDetail({ task, onBack }) {
  const [isEditing, setIsEditing] = useState(false);
  const [closureDialogOpen, setClosureDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [rejectionDialogOpen, setRejectionDialogOpen] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [comment, setComment] = useState('');

  const [taskData, setTaskData] = useState({
    name: task.name,
    description: 'This task involves creating comprehensive user documentation for the new features. The documentation should be clear, concise, and include screenshots where appropriate.',
    stage: task.stage,
    status: task.status,
    assignee: task.assignee || task.assignee_id || null,
    collaborators: task.collaborators || [],
    dueDate: task.due_date || task.dueDate || null,
    targetDate: task.target_date || task.targetDate || null,
    createdDate: task.created_at || task.createdDate || null,
    createdBy: task.created_by_name || task.createdBy || null,
    project: task.project,
  });

  // Determine if current user can approve (mock logic - in real app, check user's role)
  const canApprove = true; // Mock: current user is project owner/admin
  const isTaskOwner = true; // Mock: current user is the assignee
  const isPendingApproval = task.status === 'Pending Approval';
  const isClosed = task.status === 'Closed';
  const canRequestClosure = task.status === 'Open' && task.stage === 'Completed' && isTaskOwner;

  const handleRequestClosure = () => setClosureDialogOpen(true);

  const confirmClosure = async () => {
    try {
      await updateTask(task.id, { status: 'Pending Approval' });
      setClosureDialogOpen(false);
      window.alert('Closure requested — approval created.');
      // refresh the page so parent lists / task state update (simpler for smoke checks)
      window.location.reload();
    } catch (err) {
      console.error('Failed to request closure', err);
      window.alert('Failed to request closure');
    }
  };

  const handleApprove = () => setApprovalDialogOpen(true);

  const confirmApproval = async () => {
    try {
      // Find pending approval for this task
      const res = await getApprovals({ status: 'Pending' });
      const approvals = res.data || res.rows || [];
      const approval = approvals.find((a) => Number(a.task_id) === Number(task.id));
      if (!approval) {
        window.alert('No pending approval found for this task');
        setApprovalDialogOpen(false);
        return;
      }
      await approveApproval(approval.id);
      setApprovalDialogOpen(false);
      window.alert('Task approved — task closed');
      window.location.reload();
    } catch (err) {
      console.error('Failed to approve', err);
      window.alert('Failed to approve');
    }
  };

  const handleReject = () => setRejectionDialogOpen(true);

  const confirmRejection = async () => {
    if (!rejectionReason.trim()) return;
    try {
      const res = await getApprovals({ status: 'Pending' });
      const approvals = res.data || res.rows || [];
      const approval = approvals.find((a) => Number(a.task_id) === Number(task.id));
      if (!approval) {
        window.alert('No pending approval found for this task');
        setRejectionDialogOpen(false);
        return;
      }
      await rejectApproval(approval.id, rejectionReason);
      setRejectionDialogOpen(false);
      setRejectionReason('');
      window.alert('Task rejected');
      window.location.reload();
    } catch (err) {
      console.error('Failed to reject approval', err);
      window.alert('Failed to reject approval');
    }
  };

  const handleAddComment = () => {
    if (!comment.trim()) return;
    // In real app: call API to add comment
    console.log('Adding comment:', comment);
    setComment('');
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 4 }}>
        <IconButton onClick={onBack} sx={{ border: '1px solid rgba(148, 163, 184, 0.3)' }}>
          <ArrowBackIcon />
        </IconButton>
        <Box sx={{ flex: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 0.5, flexWrap: 'wrap' }}>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {taskData.name}
            </Typography>
            <Chip
              label={taskData.stage}
              sx={{
                backgroundColor: stageColors[taskData.stage]?.bg,
                color: stageColors[taskData.stage]?.text,
                fontWeight: 500,
              }}
            />
            <Chip
              label={taskData.status}
              sx={{
                backgroundColor: statusColors[taskData.status]?.bg,
                color: statusColors[taskData.status]?.text,
                fontWeight: 500,
              }}
            />
          </Box>
          <Typography variant="body2" color="text.secondary">
            {taskData.project}
          </Typography>
        </Box>
        {!isClosed && !isPendingApproval && (
          <Button
            variant="outlined"
            startIcon={<EditIcon />}
            onClick={() => setIsEditing(!isEditing)}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            {isEditing ? 'Cancel Edit' : 'Edit Task'}
          </Button>
        )}
      </Box>

      {/* Pending Approval Alert */}
      {isPendingApproval && canApprove && (
        <Alert
          severity="warning"
          sx={{ mb: 3, borderRadius: 2 }}
          action={
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                size="small"
                variant="contained"
                onClick={handleApprove}
                sx={{
                  textTransform: 'none',
                  bgcolor: '#0f766e',
                  '&:hover': { bgcolor: '#115e59' },
                }}
              >
                Approve
              </Button>
              <Button
                size="small"
                variant="outlined"
                color="error"
                onClick={handleReject}
                sx={{ textTransform: 'none' }}
              >
                Reject
              </Button>
            </Box>
          }
        >
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            This task is awaiting your approval to be closed
          </Typography>
          <Typography variant="caption">
            The assignee has marked this task as completed and requested closure.
          </Typography>
        </Alert>
      )}

      {/* Closed Alert */}
      {isClosed && (
        <Alert severity="success" sx={{ mb: 3, borderRadius: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            This task is closed and marked as completed
          </Typography>
          <Typography variant="caption">
            Task was approved and closed. It is now read-only.
          </Typography>
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Main Content */}
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
              mb: 3,
            }}
          >
            <Typography variant="h6" sx={{ mb: 3 }}>
              Task Details
            </Typography>

            {isEditing ? (
              <>
                <TextField
                  fullWidth
                  label="Task Name"
                  value={taskData.name}
                  onChange={(e) => setTaskData({ ...taskData, name: e.target.value })}
                  sx={{ mb: 3 }}
                />
                <TextField
                  fullWidth
                  label="Description"
                  value={taskData.description}
                  onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                  multiline
                  rows={4}
                  sx={{ mb: 3 }}
                />
                <FormControl fullWidth sx={{ mb: 3 }}>
                  <InputLabel>Stage</InputLabel>
                  <Select
                    value={taskData.stage}
                    label="Stage"
                    onChange={(e) => setTaskData({ ...taskData, stage: e.target.value })}
                  >
                    <MenuItem value="Planned">Planned</MenuItem>
                    <MenuItem value="In-process">In-process</MenuItem>
                    <MenuItem value="Completed">Completed</MenuItem>
                    <MenuItem value="On-hold">On-hold</MenuItem>
                    <MenuItem value="Dropped">Dropped</MenuItem>
                  </Select>
                </FormControl>
                <Button variant="contained" sx={{ textTransform: 'none', px: 4 }}>
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Typography variant="body1" paragraph>
                  {taskData.description}
                </Typography>
                
                {canRequestClosure && (
                  <Box sx={{ mt: 3, p: 2, borderRadius: 2, backgroundColor: '#f8fafc', border: '1px solid rgba(148, 163, 184, 0.2)' }}>
                    <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                      Task Completed?
                    </Typography>
                    <Typography variant="caption" color="text.secondary" paragraph>
                      Once you request closure, this task will be sent to the project owner/admin for approval.
                      You won't be able to edit it unless it's rejected.
                    </Typography>
                    <Button
                      variant="contained"
                      startIcon={<CheckCircleIcon />}
                      onClick={handleRequestClosure}
                      sx={{
                        textTransform: 'none',
                        bgcolor: '#0f766e',
                        '&:hover': { bgcolor: '#115e59' },
                      }}
                    >
                      Request Task Closure
                    </Button>
                  </Box>
                )}
              </>
            )}
          </Paper>

          {/* Activity & Comments */}
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
            }}
          >
            <Typography variant="h6" sx={{ mb: 3 }}>
              Activity & Comments
            </Typography>

            <List sx={{ mb: 3 }}>
              {mockActivity.map((item) => (
                <ListItem key={item.id} alignItems="flex-start" sx={{ px: 0 }}>
                  <ListItemAvatar>
                    <Avatar sx={{ bgcolor: '#0f766e', fontWeight: 600 }}>
                      {item.avatar}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          {item.user}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {item.timestamp}
                        </Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" color="text.primary">
                        {item.content}
                      </Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>

            {!isClosed && (
              <>
                <Divider sx={{ my: 3 }} />
                <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                  <Avatar sx={{ bgcolor: '#0f766e', fontWeight: 600 }}>JD</Avatar>
                  <Box sx={{ flex: 1 }}>
                    <TextField
                      fullWidth
                      placeholder="Add a comment..."
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      multiline
                      rows={2}
                      sx={{ mb: 1 }}
                    />
                    <Button
                      variant="contained"
                      size="small"
                      onClick={handleAddComment}
                      disabled={!comment.trim()}
                      sx={{ textTransform: 'none' }}
                    >
                      Add Comment
                    </Button>
                  </Box>
                </Box>
              </>
            )}
          </Paper>
        </Grid>

        {/* Sidebar */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
              mb: 3,
            }}
          >
            <Typography variant="h6" sx={{ mb: 3 }}>
              Task Information
            </Typography>

            <Box sx={{ mb: 3 }}>
              <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                ASSIGNEE
              </Typography>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                <Avatar sx={{ bgcolor: '#0f766e', width: 32, height: 32, fontWeight: 600 }}>
                  {task.assigneeAvatar}
                </Avatar>
                <Typography variant="body2" sx={{ fontWeight: 500 }}>
                  {taskData.assignee}
                </Typography>
              </Box>
            </Box>

            {taskData.collaborators.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                  COLLABORATORS
                </Typography>
                <AvatarGroup max={4}>
                  {taskData.collaborators.map((collab, idx) => (
                    <Avatar key={idx} sx={{ bgcolor: '#7c3aed', width: 32, height: 32, fontWeight: 600 }}>
                      {collab}
                    </Avatar>
                  ))}
                </AvatarGroup>
              </Box>
            )}

            <Divider sx={{ my: 3 }} />

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <CalendarTodayIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  DUE DATE
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {taskData.dueDate ? formatShortDate(taskData.dueDate) : '-'}
              </Typography>
            </Box>

            <Box sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.5 }}>
                <AccessTimeIcon sx={{ fontSize: 16, color: 'text.secondary' }} />
                <Typography variant="caption" color="text.secondary">
                  CREATED
                </Typography>
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                {taskData.createdDate ? formatShortDate(taskData.createdDate) : '-'} by {taskData.createdBy || '-'}
              </Typography>
            </Box>
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Task Lifecycle
            </Typography>
            <Typography variant="caption" color="text.secondary" paragraph>
              <strong>Stage:</strong> Represents the current work state<br />
              <strong>Status:</strong> Represents the lifecycle state
            </Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Chip
                label={`Stage: ${taskData.stage}`}
                sx={{
                  backgroundColor: stageColors[taskData.stage]?.bg,
                  color: stageColors[taskData.stage]?.text,
                  fontWeight: 500,
                  justifyContent: 'flex-start',
                }}
              />
              <Chip
                label={`Status: ${taskData.status}`}
                sx={{
                  backgroundColor: statusColors[taskData.status]?.bg,
                  color: statusColors[taskData.status]?.text,
                  fontWeight: 500,
                  justifyContent: 'flex-start',
                }}
              />
            </Box>
          </Paper>
        </Grid>
      </Grid>

      {/* Request Closure Dialog */}
      <Dialog
        open={closureDialogOpen}
        onClose={() => setClosureDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Request Task Closure</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This task will be sent for approval to the project owner/admin. 
            You won't be able to edit it unless it's rejected.
          </DialogContentText>
          <Alert severity="info" sx={{ mt: 2, borderRadius: 2 }}>
            <Typography variant="body2">
              <strong>What happens next:</strong>
            </Typography>
            <Typography variant="caption">
              • Task status changes to "Pending Approval"<br />
              • Project owner/admin receives a notification<br />
              • They can approve (closes task) or reject (returns to you with feedback)
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setClosureDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmClosure}
            sx={{
              textTransform: 'none',
              px: 3,
              bgcolor: '#0f766e',
              '&:hover': { bgcolor: '#115e59' },
            }}
          >
            Confirm Request
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog
        open={approvalDialogOpen}
        onClose={() => setApprovalDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Approve Task Closure</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to approve this task closure?
          </DialogContentText>
          <Alert severity="success" sx={{ mt: 2, borderRadius: 2 }}>
            <Typography variant="body2">
              <strong>This will:</strong>
            </Typography>
            <Typography variant="caption">
              • Change task status to "Closed"<br />
              • Set stage to "Completed"<br />
              • Lock the task (read-only)<br />
              • Notify the assignee
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setApprovalDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={confirmApproval}
            sx={{
              textTransform: 'none',
              px: 3,
              bgcolor: '#0f766e',
              '&:hover': { bgcolor: '#115e59' },
            }}
          >
            Approve & Close Task
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rejection Dialog */}
      <Dialog
        open={rejectionDialogOpen}
        onClose={() => setRejectionDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Reject Task Closure</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Please provide a reason for rejecting this task closure. This will help the assignee understand what needs to be addressed.
          </DialogContentText>
          <TextField
            fullWidth
            label="Rejection Reason (Required)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            multiline
            rows={4}
            placeholder="e.g., Documentation is incomplete, missing test cases, needs further review..."
            required
          />
          <Alert severity="warning" sx={{ mt: 2, borderRadius: 2 }}>
            <Typography variant="caption">
              The task will be reopened and the assignee will be notified with your feedback.
            </Typography>
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setRejectionDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            onClick={confirmRejection}
            disabled={!rejectionReason.trim()}
            sx={{ textTransform: 'none', px: 3 }}
          >
            Reject Task
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default TaskDetail;
