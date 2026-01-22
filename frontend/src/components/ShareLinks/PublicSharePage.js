import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Avatar,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Tooltip,
} from '@mui/material';
import { format } from 'date-fns';
import { getPublicShareMeta, getPublicShareTasks, unlockPublicShare } from '../../apiClient';
import { SHARE_FIELD_LABELS } from './shareLinkFields';

const formatDateTime = (value) => {
  if (!value) return 'Never';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const DATE_KEYS = new Set(['due_date', 'target_date', 'created_at']);
const MAX_TEXT_LEN = 120;

const formatCellValue = (key, value) => {
  if (value === null || value === undefined || value === '') return '-';
  if (Array.isArray(value)) return value.join(', ');
  if (DATE_KEYS.has(key)) {
    if (key === 'due_date' || key === 'target_date') {
      const parts = String(value).split('-').map((part) => parseInt(part, 10));
      if (parts.length === 3 && parts.every((part) => Number.isInteger(part))) {
        const date = new Date(parts[0], parts[1] - 1, parts[2]);
        return format(date, 'dd-MMM-yy');
      }
    }
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return format(date, 'dd-MMM-yy');
  }
  return String(value);
};

const getTruncatedText = (value) => {
  const text = String(value || '');
  if (text.length <= MAX_TEXT_LEN) return text;
  return `${text.slice(0, MAX_TEXT_LEN - 3)}...`;
};

export default function PublicSharePage({ slug }) {
  const [meta, setMeta] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState(true);
  const [tasksLoading, setTasksLoading] = useState(false);
  const [error, setError] = useState('');
  const [password, setPassword] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const columns = useMemo(() => meta?.allowed_columns || [], [meta]);

  const loadTasks = useCallback(async (shareToken) => {
    if (!slug) return;
    setTasksLoading(true);
    try {
      const res = await getPublicShareTasks(slug, shareToken);
      setTasks(res.data.tasks || []);
    } catch (err) {
      console.error('Failed to load shared tasks:', err);
      setError('Unable to load shared tasks.');
    } finally {
      setTasksLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    if (!slug) return;
    const loadMeta = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await getPublicShareMeta(slug);
        setMeta(res.data);
        if (!res.data.is_protected) {
          await loadTasks('');
        }
      } catch (err) {
        console.error('Failed to load share link:', err);
        setError('This link is invalid, expired, or revoked.');
      } finally {
        setLoading(false);
      }
    };
    loadMeta();
  }, [slug, loadTasks]);

  const handleUnlock = async () => {
    if (!password.trim()) return;
    setUnlocking(true);
    setError('');
    try {
      const res = await unlockPublicShare(slug, password.trim());
      const nextToken = res.data.token;
      setToken(nextToken);
      await loadTasks(nextToken);
    } catch (err) {
      console.error('Failed to unlock share link:', err);
      setError('Unable to unlock this share link.');
    } finally {
      setUnlocking(false);
    }
  };

  if (loading) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!meta) {
    return (
      <Box sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', p: 3 }}>
        <Alert severity="error">{error || 'This link is not available.'}</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#f8fafc', p: { xs: 2, md: 4 } }}>
      <Box sx={{ maxWidth: 1200, mx: 'auto' }}>
        <Paper sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
            <Avatar
              src={meta.workspace_logo_url || ''}
              alt={meta.workspace_name || 'Workspace'}
              sx={{ width: 44, height: 44, bgcolor: '#0f766e' }}
            >
              {(meta.workspace_name || 'W').charAt(0).toUpperCase()}
            </Avatar>
            <Box sx={{ flex: 1, minWidth: 240 }}>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
                <Typography variant="h5" fontWeight={700}>
                  {meta.link_name || 'Shared Tasks'}
                </Typography>
                <Chip label="View only" size="small" sx={{ bgcolor: '#e2e8f0' }} />
                {meta.is_protected && <Chip label="Protected" size="small" color="warning" />}
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                Workspace: {meta.workspace_name || 'Workspace'}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
                {meta.task_count} tasks - Expires {formatDateTime(meta.expires_at)}
              </Typography>
            </Box>
          </Box>
        </Paper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {meta.is_protected && !token ? (
          <Paper sx={{ p: 3 }}>
            <Typography variant="subtitle1" fontWeight={600} sx={{ mb: 1 }}>
              Enter password to view tasks
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
              <TextField
                type="password"
                label="Password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                size="small"
                sx={{ minWidth: 240 }}
              />
              <Button variant="contained" onClick={handleUnlock} disabled={unlocking || !password.trim()}>
                {unlocking ? 'Unlocking...' : 'Unlock'}
              </Button>
            </Box>
          </Paper>
        ) : (
          <TableContainer component={Paper} sx={{ maxHeight: '70vh', overflowX: 'auto' }}>
            <Table stickyHeader size="small" sx={{ minWidth: Math.max(600, columns.length * 140) }}>
              <TableHead>
                <TableRow>
                  {columns.map((col) => (
                    <TableCell
                      key={col}
                      sx={{
                        fontWeight: 700,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {SHARE_FIELD_LABELS[col] || col}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {tasksLoading ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center">
                      <Box sx={{ py: 4 }}>
                        <CircularProgress size={28} />
                      </Box>
                    </TableCell>
                  </TableRow>
                ) : tasks.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={columns.length} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No tasks to display.
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  tasks.map((task, index) => (
                    <TableRow key={index} hover>
                      {columns.map((col) => {
                        const rawValue = task?.[col];
                        const isLongText = col === 'notes' || col === 'description';
                        const baseValue = formatCellValue(col, rawValue);
                        const truncated = isLongText
                          ? (rawValue ? getTruncatedText(rawValue) : baseValue)
                          : baseValue;
                        const showTooltip = isLongText && rawValue && String(rawValue).length > MAX_TEXT_LEN;
                        const cellSx = {
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: isLongText ? 280 : 220,
                        };

                        return (
                          <TableCell key={`${index}-${col}`} sx={cellSx}>
                            {showTooltip ? (
                              <Tooltip title={String(rawValue)} placement="top">
                                <span>{truncated}</span>
                              </Tooltip>
                            ) : (
                              truncated
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Box>
    </Box>
  );
}
