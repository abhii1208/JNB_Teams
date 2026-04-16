import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  InputAdornment,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { getWorkspaceTimeLogs } from '../../apiClient';

function formatDateTime(value) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function formatDuration(startTime, endTime, hoursValue) {
  const start = new Date(startTime);
  const end = new Date(endTime);

  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime()) && end > start) {
    const totalMinutes = Math.floor((end.getTime() - start.getTime()) / (1000 * 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return `${hours} hrs ${minutes} min`;
  }

  const numericHours = Number(hoursValue || 0);
  const wholeHours = Math.floor(numericHours);
  const minutes = Math.round((numericHours - wholeHours) * 60);
  return `${wholeHours} hrs ${minutes} min`;
}

function WorklogsPage({ workspace }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [logs, setLogs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLogIds, setSelectedLogIds] = useState([]);

  useEffect(() => {
    const loadWorklogs = async () => {
      if (!workspace?.id) {
        setLogs([]);
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError('');
        const response = await getWorkspaceTimeLogs(workspace.id);
        setLogs(Array.isArray(response.data?.logs) ? response.data.logs : []);
      } catch (err) {
        console.error('Failed to load worklogs', err);
        setError(err.response?.data?.error || 'Failed to load worklogs');
        setLogs([]);
      } finally {
        setLoading(false);
      }
    };

    loadWorklogs();
  }, [workspace?.id]);

  const filteredLogs = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return logs;

    return logs.filter((log) => {
      const haystack = [
        log.task_name,
        log.user_name,
        log.task_description,
        log.project_name,
        formatDateTime(log.start_time),
        formatDateTime(log.end_time),
        formatDuration(log.start_time, log.end_time, log.hours),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [logs, searchQuery]);

  const allVisibleSelected = filteredLogs.length > 0
    && filteredLogs.every((log) => selectedLogIds.includes(log.id));

  const partiallySelected = filteredLogs.some((log) => selectedLogIds.includes(log.id)) && !allVisibleSelected;

  const handleToggleAll = (checked) => {
    if (checked) {
      setSelectedLogIds(filteredLogs.map((log) => log.id));
      return;
    }
    setSelectedLogIds([]);
  };

  const handleToggleOne = (logId) => {
    setSelectedLogIds((prev) => (
      prev.includes(logId)
        ? prev.filter((id) => id !== logId)
        : [...prev, logId]
    ));
  };

  if (!workspace) {
    return (
      <Box sx={{ p: 6 }}>
        <Typography variant="h6">Select a workspace to view worklogs.</Typography>
      </Box>
    );
  }

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        p: { xs: 2, md: 4 },
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
        Worklogs
      </Typography>
      <Typography variant="body1" color="text.secondary" sx={{ mb: 3 }}>
        Saved time tracking entries for {workspace.name}.
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
          {error}
        </Alert>
      )}

      <Paper
        elevation={0}
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: 3,
          border: '1px solid rgba(148, 163, 184, 0.18)',
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        <Box
          sx={{
            px: { xs: 2, md: 2.5 },
            py: 2,
            borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
            backgroundColor: '#fcfdff',
          }}
        >
          <TextField
            fullWidth
            size="small"
            placeholder="Search by task, employee, description, start time, end time, or total time"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Box>

        <TableContainer
          sx={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'auto',
          }}
        >
          <Table stickyHeader sx={{ minWidth: 980 }}>
            <TableHead>
              <TableRow>
                <TableCell
                  padding="checkbox"
                  sx={{
                    bgcolor: '#f8fafc',
                    borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                    width: 56,
                  }}
                >
                  <Checkbox
                    indeterminate={partiallySelected}
                    checked={allVisibleSelected}
                    onChange={(event) => handleToggleAll(event.target.checked)}
                  />
                </TableCell>
                {['Task Name', 'Employee Name', 'Description', 'Start Time', 'End Time', 'Total Time (hrs/min)'].map((label) => (
                  <TableCell
                    key={label}
                    sx={{
                      bgcolor: '#f8fafc',
                      borderBottom: '1px solid rgba(148, 163, 184, 0.14)',
                      fontWeight: 700,
                      color: '#0f172a',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 6, color: '#64748b' }}>
                    {logs.length === 0 ? 'No worklogs yet.' : 'No worklogs match your search.'}
                  </TableCell>
                </TableRow>
              ) : (
                filteredLogs.map((log) => (
                  <TableRow
                    key={log.id}
                    hover
                    sx={{
                      '& td': {
                        borderBottom: '1px solid rgba(148, 163, 184, 0.10)',
                        py: 1.5,
                        verticalAlign: 'top',
                      },
                    }}
                  >
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedLogIds.includes(log.id)}
                        onChange={() => handleToggleOne(log.id)}
                      />
                    </TableCell>
                    <TableCell sx={{ minWidth: 220 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                        {log.task_name || 'Task'}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {log.project_name || 'Project'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography variant="body2">{log.user_name || 'User'}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 280, maxWidth: 360 }}>
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {log.task_description || '-'}
                      </Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography variant="body2">{formatDateTime(log.start_time)}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 180 }}>
                      <Typography variant="body2">{formatDateTime(log.end_time)}</Typography>
                    </TableCell>
                    <TableCell sx={{ minWidth: 160 }}>
                      <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f766e' }}>
                        {formatDuration(log.start_time, log.end_time, log.hours)}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Box>
  );
}

export default WorklogsPage;
