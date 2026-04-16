import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Grid,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { getManagerDashboard } from '../../apiClient';

const formatDate = (value) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
};

function MetricBar({ value, max = 100, color = '#0f766e' }) {
  const width = max > 0 ? Math.max(4, Math.min(100, (Number(value || 0) / max) * 100)) : 0;
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
      <Box sx={{ flex: 1, height: 10, bgcolor: '#e2e8f0', borderRadius: 999 }}>
        <Box sx={{ width: `${width}%`, height: '100%', bgcolor: color, borderRadius: 999 }} />
      </Box>
      <Typography variant="caption" sx={{ minWidth: 40, textAlign: 'right' }}>
        {value}
      </Typography>
    </Box>
  );
}

function AdminManagerDashboardTab({ workspace, dateRange }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      if (!workspace?.id) return;
      setLoading(true);
      setError('');
      try {
        const params = {};
        if (dateRange?.from) params.date_from = formatDate(dateRange.from);
        if (dateRange?.to) params.date_to = formatDate(dateRange.to);
        const response = await getManagerDashboard(workspace.id, params);
        setData(response.data);
      } catch (err) {
        setError(err.response?.data?.error || 'Failed to load manager dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [workspace?.id, dateRange?.from, dateRange?.to]);

  const maxWorkload = useMemo(() => {
    const values = (data?.workload || []).map((item) => Number(item.open_tasks || 0));
    return values.length ? Math.max(...values) : 0;
  }, [data]);

  const maxHours = useMemo(() => {
    const values = (data?.work_hours?.summary || []).map((item) => Number(item.total_hours || 0));
    return values.length ? Math.max(...values) : 0;
  }, [data]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return <Alert severity="error">{error}</Alert>;
  }

  return (
    <Box>
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary">Employees Tracked</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {data?.performance?.length || 0}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary">Task Status Buckets</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {data?.task_status?.length || 0}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="subtitle2" color="text.secondary">Weekly Work-Hour Series</Typography>
            <Typography variant="h4" sx={{ fontWeight: 700 }}>
              {data?.work_hours?.series?.length || 0}
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Productivity Overview</Typography>
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Employee</TableCell>
                    <TableCell align="right">Updated</TableCell>
                    <TableCell align="right">Completed</TableCell>
                    <TableCell align="right">Completion %</TableCell>
                    <TableCell align="right">Timeliness %</TableCell>
                    <TableCell align="right">Activity</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(data?.performance || []).map((member) => (
                    <TableRow key={member.user_id}>
                      <TableCell>{member.name}</TableCell>
                      <TableCell align="right">{member.tasks_updated}</TableCell>
                      <TableCell align="right">{member.completed_in_range}</TableCell>
                      <TableCell align="right">{member.completion_rate}</TableCell>
                      <TableCell align="right">{member.timeliness_rate}</TableCell>
                      <TableCell align="right">{member.activity_level}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Workload Distribution</Typography>
            {(data?.workload || []).map((item) => (
              <Box key={`${item.user_id}-${item.name}`} sx={{ mb: 1.5 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>{item.name || 'Unassigned'}</Typography>
                <MetricBar value={item.open_tasks} max={maxWorkload} color="#f59e0b" />
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Hours Summary</Typography>
            {(data?.work_hours?.summary || []).map((item) => (
              <Box key={`${item.user_id}-${item.name}`} sx={{ mb: 1.5 }}>
                <Typography variant="body2" sx={{ mb: 0.5 }}>{item.name}</Typography>
                <MetricBar value={item.total_hours} max={maxHours} color="#0f766e" />
              </Box>
            ))}
          </Paper>
        </Grid>

        <Grid item xs={12} lg={6}>
          <Paper sx={{ p: 2.5 }}>
            <Typography variant="h6" sx={{ mb: 2 }}>Task Status</Typography>
            {(data?.task_status || []).map((item) => (
              <Box key={item.status} sx={{ display: 'flex', justifyContent: 'space-between', py: 0.75 }}>
                <Typography variant="body2">{item.status}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{item.count}</Typography>
              </Box>
            ))}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default AdminManagerDashboardTab;
