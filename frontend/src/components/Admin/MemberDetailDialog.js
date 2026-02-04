import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Chip,
  Avatar,
  CircularProgress,
  Alert,
  Grid,
  Card,
  CardContent,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { getAdminMemberDetails } from '../../apiClient';
import { formatShortDateIST } from '../../utils/dateUtils';

function MemberDetailDialog({ open, onClose, member, workspace, dateRange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const fetchMemberDetails = useCallback(async () => {
    try {
      setLoading(true);
      const params = {};
      
      if (dateRange?.from && dateRange?.to) {
        params.date_from = dateRange.from.toISOString().split('T')[0];
        params.date_to = dateRange.to.toISOString().split('T')[0];
      }

      const response = await getAdminMemberDetails(workspace.id, member.id, params);
      setData(response.data);
    } catch (error) {
      console.error('Failed to fetch member details:', error);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, member?.id, dateRange?.from, dateRange?.to]);

  useEffect(() => {
    if (open && member && workspace) {
      fetchMemberDetails();
    }
  }, [open, member, workspace, fetchMemberDetails]);

  const summary = data?.summary || {};
  const drilldowns = data?.drilldowns || {};

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return formatShortDateIST(dateString);
  };

  const renderTaskList = (tasks, title) => {
    if (!tasks || tasks.length === 0) {
      return <Alert severity="info">No {title.toLowerCase()} found</Alert>;
    }

    return (
      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'grey.50' }}>
              <TableCell>Task</TableCell>
              <TableCell>Project</TableCell>
              <TableCell align="center">Priority</TableCell>
              <TableCell align="center">Target Date</TableCell>
              <TableCell align="center">Due Date</TableCell>
              <TableCell align="center">Completed</TableCell>
              <TableCell align="center">Days Late</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {tasks.map(task => (
              <TableRow key={task.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {task.name}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Chip
                    label={task.project_name}
                    size="small"
                    sx={{
                      bgcolor: task.color || '#0f766e',
                      color: '#fff',
                      fontSize: '0.75rem'
                    }}
                  />
                </TableCell>
                <TableCell align="center">
                  <Chip
                    label={task.priority}
                    size="small"
                    color={
                      task.priority === 'Critical' ? 'error' :
                      task.priority === 'High' ? 'warning' :
                      'default'
                    }
                  />
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{formatDate(task.target_date)}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{formatDate(task.due_date)}</Typography>
                </TableCell>
                <TableCell align="center">
                  <Typography variant="body2">{formatDate(task.completed_at)}</Typography>
                </TableCell>
                <TableCell align="center">
                  {task.days_late && (
                    <Chip
                      label={`${task.days_late}d`}
                      size="small"
                      color="error"
                      sx={{ fontWeight: 600 }}
                    />
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Avatar
              sx={{ 
                width: 48, 
                height: 48, 
                bgcolor: '#0f766e',
                fontSize: '1.25rem'
              }}
            >
              {member.avatar}
            </Avatar>
            <Box>
              <Typography variant="h6">{member.name}</Typography>
              <Chip
                label={member.role}
                size="small"
                sx={{
                  bgcolor: member.role === 'Owner' ? '#d1fae5' : member.role === 'Admin' ? '#e0e7ff' : '#f3e8ff',
                  color: member.role === 'Owner' ? '#065f46' : member.role === 'Admin' ? '#3730a3' : '#6b21a8',
                  fontWeight: 600,
                  mt: 0.5
                }}
              />
            </Box>
          </Box>
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box>
            {/* Summary Cards */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Performance Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Assigned Open
                      </Typography>
                      <Typography variant="h4">{summary.assigned_open || 0}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined">
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Completed
                      </Typography>
                      <Typography variant="h4">{summary.completed || 0}</Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: '#fee2e2' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Target Overdue
                      </Typography>
                      <Typography variant="h4" color="error">
                        {summary.target_overdue_open || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: '#fee2e2' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Due Overdue
                      </Typography>
                      <Typography variant="h4" color="error">
                        {summary.due_overdue_open || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: '#d1fae5' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        On-Target Completed
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#065f46' }}>
                        {summary.on_target_completed || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: '#d1fae5' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        On-Due Completed
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#065f46' }}>
                        {summary.on_due_completed || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: '#dbeafe' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Recovered
                      </Typography>
                      <Typography variant="h5" sx={{ color: '#1e3a8a' }}>
                        {summary.recovered || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ bgcolor: '#fee2e2' }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Critical Late
                      </Typography>
                      <Typography variant="h5" color="error">
                        {summary.critical_late || 0}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            {/* Tabs for Drilldowns */}
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs value={activeTab} onChange={(e, newValue) => setActiveTab(newValue)}>
                <Tab label={`Target Overdue (${drilldowns.target_overdue_open?.length || 0})`} />
                <Tab label={`Due Overdue (${drilldowns.due_overdue_open?.length || 0})`} />
                <Tab label={`Late vs Target (${drilldowns.completed_late_target?.length || 0})`} />
                <Tab label={`Late vs Due (${drilldowns.completed_late_due?.length || 0})`} />
                <Tab label={`Recently Completed (${drilldowns.recently_completed?.length || 0})`} />
              </Tabs>
            </Box>

            {/* Tab Content */}
            <Box>
              {activeTab === 0 && renderTaskList(drilldowns.target_overdue_open, 'Target Overdue Tasks')}
              {activeTab === 1 && renderTaskList(drilldowns.due_overdue_open, 'Due Overdue Tasks')}
              {activeTab === 2 && renderTaskList(drilldowns.completed_late_target, 'Completed Late vs Target')}
              {activeTab === 3 && renderTaskList(drilldowns.completed_late_due, 'Completed Late vs Due')}
              {activeTab === 4 && renderTaskList(drilldowns.recently_completed, 'Recently Completed Tasks')}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default MemberDetailDialog;
