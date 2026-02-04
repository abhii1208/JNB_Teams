import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  IconButton,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { listShareLinks, revokeShareLink, updateShareLink } from '../../apiClient';
import { formatDateTimeIST } from '../../utils/dateUtils';

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return formatDateTimeIST(date, 'MMM d, yyyy h:mm a');
};

const HOURS_24 = 24 * 60 * 60 * 1000;

const getExpiryState = (expiresAt) => {
  if (!expiresAt) return null;
  const date = new Date(expiresAt);
  if (Number.isNaN(date.getTime())) return null;
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return 'expired';
  if (diff <= HOURS_24) return 'soon';
  return null;
};

const extendExpiry = (expiresAt, days) => {
  const now = new Date();
  const base = expiresAt ? new Date(expiresAt) : now;
  const start = Number.isNaN(base.getTime()) || base < now ? now : base;
  const next = new Date(start.getTime());
  next.setDate(next.getDate() + days);
  return next.toISOString();
};

const getStatusChipSx = (status) => {
  switch (status) {
    case 'active':
      return { bgcolor: '#dcfce7', color: '#166534' };
    case 'expired':
      return { bgcolor: '#fef3c7', color: '#92400e' };
    case 'revoked':
      return { bgcolor: '#e2e8f0', color: '#475569' };
    default:
      return { bgcolor: '#e2e8f0', color: '#475569' };
  }
};

export default function ShareLinksManagerDialog({ open, onClose, workspaceId }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [updatingId, setUpdatingId] = useState(null);

  const params = useMemo(() => {
    const next = {};
    if (statusFilter !== 'all') next.status = statusFilter;
    if (search.trim()) next.q = search.trim();
    if (sortBy) next.sort_by = sortBy;
    if (sortOrder) next.sort_order = sortOrder;
    return next;
  }, [statusFilter, search, sortBy, sortOrder]);

  const loadLinks = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    setError('');
    try {
      const res = await listShareLinks(workspaceId, params);
      setLinks(res.data.items || []);
    } catch (err) {
      console.error('Failed to load share links:', err);
      setError('Failed to load share links.');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, params]);

  useEffect(() => {
    if (open) {
      loadLinks();
    }
  }, [open, loadLinks]);

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleRevoke = async (linkId) => {
    const confirm = window.confirm('Revoke this share link? This cannot be undone.');
    if (!confirm) return;

    try {
      await revokeShareLink(linkId);
      await loadLinks();
    } catch (err) {
      console.error('Failed to revoke share link:', err);
      setError('Failed to revoke share link.');
    }
  };

  const handleExtend = async (link, days) => {
    if (!link?.id) return;
    setUpdatingId(link.id);
    setError('');
    try {
      const nextExpiry = extendExpiry(link.expires_at, days);
      await updateShareLink(link.id, { expiresAt: nextExpiry });
      await loadLinks();
    } catch (err) {
      console.error('Failed to extend expiry:', err);
      setError('Failed to extend expiry.');
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        Links Manager
        <Box sx={{ ml: 'auto', display: 'flex', gap: 1, alignItems: 'center' }}>
          <TextField
            size="small"
            placeholder="Search slug or name..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            sx={{ minWidth: 200 }}
          />
          <FormControl size="small">
            <Select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <MenuItem value="all">All</MenuItem>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="expired">Expired</MenuItem>
              <MenuItem value="revoked">Revoked</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
            >
              <MenuItem value="created_at">Created</MenuItem>
              <MenuItem value="expires_at">Expiry</MenuItem>
              <MenuItem value="task_count">Task count</MenuItem>
              <MenuItem value="last_accessed_at">Last accessed</MenuItem>
              <MenuItem value="view_count">Views</MenuItem>
              <MenuItem value="status">Status</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small">
            <Select
              value={sortOrder}
              onChange={(event) => setSortOrder(event.target.value)}
            >
              <MenuItem value="desc">Desc</MenuItem>
              <MenuItem value="asc">Asc</MenuItem>
            </Select>
          </FormControl>
          <Tooltip title="Refresh">
            <IconButton onClick={loadLinks} size="small">
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: '#f8fafc' }}>
                <TableCell>Link</TableCell>
                <TableCell>Name</TableCell>
                <TableCell>Created</TableCell>
                <TableCell>Tasks</TableCell>
                <TableCell>Expiry</TableCell>
                <TableCell>Protected</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {links.length === 0 && !loading && (
                <TableRow>
                  <TableCell colSpan={8}>
                    <Typography variant="body2" color="text.secondary">
                      No share links found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
              {links.map((link) => (
                <TableRow key={link.id} hover>
                  <TableCell sx={{ maxWidth: 320 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" noWrap>
                        {link.url || link.slug}
                      </Typography>
                      <Tooltip title="Copy link">
                        <IconButton size="small" onClick={() => handleCopy(link.url || link.slug)}>
                          <ContentCopyIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ maxWidth: 200 }}>
                    <Typography variant="body2" noWrap>
                      {link.name || '-'}
                    </Typography>
                  </TableCell>
                  <TableCell>{formatDateTime(link.created_at)}</TableCell>
                  <TableCell>{link.task_count}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2">
                        {link.expires_at ? formatDateTime(link.expires_at) : 'Never'}
                      </Typography>
                      {getExpiryState(link.expires_at) === 'soon' && link.status === 'active' && (
                        <Tooltip title="Expires within 24 hours">
                          <WarningAmberIcon fontSize="small" color="warning" />
                        </Tooltip>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>{link.is_protected ? 'Yes' : 'No'}</TableCell>
                  <TableCell>
                    <Chip
                      label={link.status || 'active'}
                      size="small"
                      sx={getStatusChipSx(link.status)}
                    />
                  </TableCell>
                  <TableCell align="right">
                    <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
                      {(getExpiryState(link.expires_at) === 'soon' || link.status === 'expired') && link.status !== 'revoked' && (
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => handleExtend(link, 15)}
                          disabled={updatingId === link.id}
                        >
                          Extend 15d
                        </Button>
                      )}
                      <Tooltip title="Revoke link">
                        <span>
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => handleRevoke(link.id)}
                            disabled={link.status === 'revoked'}
                          >
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </span>
                      </Tooltip>
                    </Box>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
