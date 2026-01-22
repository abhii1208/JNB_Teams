import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  FormControl,
  IconButton,
  InputAdornment,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import { listShareLinks, revokeShareLink, updateShareLink } from '../../apiClient';

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const formatDateTime = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const day = String(date.getDate()).padStart(2, '0');
  const month = MONTHS[date.getMonth()] || '---';
  const year = date.getFullYear();
  let hours = date.getHours();
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const isPm = hours >= 12;
  const period = isPm ? 'PM' : 'AM';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${day}-${month}-${year} ${String(hours).padStart(2, '0')}:${minutes} ${period}`;
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

const getCreatorLabel = (link) => {
  const first = link?.created_by_first_name || '';
  const last = link?.created_by_last_name || '';
  const name = `${first} ${last}`.trim();
  return name || link?.created_by_email || link?.created_by_username || `User #${link?.created_by || '-'}`;
};

export default function AdminShareLinksTab({ workspace }) {
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortOrder, setSortOrder] = useState('desc');
  const [updatingId, setUpdatingId] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const params = useMemo(() => {
    const next = {
      include_all: 'true',
      include_creator: 'true',
    };
    if (statusFilter !== 'all') next.status = statusFilter;
    if (debouncedSearch) next.q = debouncedSearch;
    if (sortBy) next.sort_by = sortBy;
    if (sortOrder) next.sort_order = sortOrder;
    return next;
  }, [statusFilter, debouncedSearch, sortBy, sortOrder]);

  const loadLinks = useCallback(async () => {
    if (!workspace?.id) return;
    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await listShareLinks(workspace.id, params);
      if (!isMountedRef.current || requestIdRef.current !== reqId) return;
      setLinks(res.data.items || []);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!isMountedRef.current || requestIdRef.current !== reqId) return;
      console.error('Failed to load share links:', err);
      setError('Failed to load share links.');
    } finally {
      if (!isMountedRef.current || requestIdRef.current !== reqId) return;
      setLoading(false);
    }
  }, [workspace?.id, params]);

  useEffect(() => {
    if (workspace?.id) {
      loadLinks();
    }
  }, [workspace?.id, loadLinks]);

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
    setError(null);
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

  if (loading && links.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 320 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 2.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search slug or name..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          size="small"
          sx={{ minWidth: 320 }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon fontSize="small" />
              </InputAdornment>
            ),
            endAdornment: searchTerm ? (
              <InputAdornment position="end">
                <Tooltip title="Clear">
                  <IconButton size="small" onClick={() => setSearchTerm('')} aria-label="Clear search">
                    <ClearIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </InputAdornment>
            ) : null,
          }}
        />

        <FormControl size="small" sx={{ minWidth: 140 }}>
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

        <FormControl size="small" sx={{ minWidth: 150 }}>
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

        <FormControl size="small" sx={{ minWidth: 120 }}>
          <Select
            value={sortOrder}
            onChange={(event) => setSortOrder(event.target.value)}
          >
            <MenuItem value="desc">Desc</MenuItem>
            <MenuItem value="asc">Asc</MenuItem>
          </Select>
        </FormControl>

        <Box sx={{ flex: 1 }} />

        {lastRefreshed && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </Typography>
        )}

        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={loadLinks} size="small" aria-label="Refresh share links" disabled={loading}>
              <RefreshIcon fontSize="small" />
            </IconButton>
          </span>
        </Tooltip>
      </Box>

      {error && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            <Tooltip title="Retry">
              <span>
                <IconButton onClick={loadLinks} size="small" aria-label="Retry" disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          }
        >
          {error}
        </Alert>
      )}

      {links.length === 0 ? (
        <Alert severity="info">No share links found</Alert>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}
        >
          <Table size="small" stickyHeader sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Link</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Name</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Created by</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Created</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Tasks</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Expiry</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Protected</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>Status</TableCell>
                <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {links.map((link) => {
                const creatorLabel = getCreatorLabel(link);
                const creatorEmail = link?.created_by_email || '';
                const expiryState = getExpiryState(link.expires_at);
                return (
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
                    <TableCell sx={{ maxWidth: 220 }}>
                      <Typography variant="body2" noWrap title={creatorLabel}>
                        {creatorLabel}
                      </Typography>
                      {creatorEmail && creatorEmail !== creatorLabel && (
                        <Typography variant="caption" color="text.secondary" noWrap title={creatorEmail}>
                          {creatorEmail}
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{formatDateTime(link.created_at)}</TableCell>
                    <TableCell>{link.task_count}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2">
                          {link.expires_at ? formatDateTime(link.expires_at) : 'Never'}
                        </Typography>
                        {expiryState === 'soon' && link.status === 'active' && (
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
                        {(expiryState === 'soon' || link.status === 'expired') && link.status !== 'revoked' && (
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
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
