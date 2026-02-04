// src/components/admin/AdminTeamTab.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Paper,
  Chip,
  Avatar,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Tooltip,
  IconButton,
  Alert,
  ToggleButtonGroup,
  ToggleButton,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';

import { getAdminTeam } from '../../apiClient';
import MemberDetailDialog from './MemberDetailDialog';
import { formatTimeIST } from '../../utils/dateUtils';

// ---------- Helpers ----------
const toJSDate = (v) => {
  if (!v) return null;

  // Native Date
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;

  // Dayjs/Moment
  if (typeof v?.toDate === 'function') {
    const d = v.toDate();
    if (d instanceof Date && !Number.isNaN(d.getTime())) return d;
  }

  // Some libs store date at $d
  if (v?.$d instanceof Date && !Number.isNaN(v.$d.getTime())) return v.$d;

  // ISO / YYYY-MM-DD string
  if (typeof v === 'string') {
    // If already YYYY-MM-DD, use noon to avoid TZ shifting
    if (/^\d{4}-\d{2}-\d{2}$/.test(v)) {
      const d = new Date(`${v}T12:00:00`);
      return Number.isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  return null;
};

const formatYYYYMMDDLocal = (v) => {
  const d = toJSDate(v);
  if (!d || Number.isNaN(d.getTime())) return null;
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const toNum = (v, fallback = 0) => {
  if (v === null || v === undefined || v === '') return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
};

const getInitials = (name = '') => {
  const parts = String(name).trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] || '';
  const second = parts[1]?.[0] || '';
  return (first + second).toUpperCase() || 'U';
};

function AdminTeamTab({ workspace, dateRange }) {
  const theme = useTheme();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [sortBy, setSortBy] = useState('due_overdue_open');
  const [sortOrder, setSortOrder] = useState('desc');

  const [filter, setFilter] = useState('all');

  const [selectedMember, setSelectedMember] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Prevent setState after unmount + overlapping calls
  const isMountedRef = useRef(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const dateParams = useMemo(() => {
    const fromStr = formatYYYYMMDDLocal(dateRange?.from);
    const toStr = formatYYYYMMDDLocal(dateRange?.to);
    return { fromStr, toStr };
  }, [dateRange?.from, dateRange?.to]);

  const fetchTeam = useCallback(async () => {
    if (!workspace?.id) return;

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (dateParams.fromStr && dateParams.toStr) {
        params.date_from = dateParams.fromStr;
        params.date_to = dateParams.toStr;
      }

      const response = await getAdminTeam(workspace.id, params);

      if (!isMountedRef.current || reqIdRef.current !== reqId) return;

      const data = Array.isArray(response?.data) ? response.data : [];
      setMembers(data);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!isMountedRef.current || reqIdRef.current !== reqId) return;

      // Try to show a useful server message
      const msg =
        err?.response?.data?.message ||
        err?.response?.data?.error ||
        err?.message ||
        'Failed to fetch team members. Please try again.';
      setError(msg);
      setMembers([]);
    } finally {
      if (!isMountedRef.current || reqIdRef.current !== reqId) return;
      setLoading(false);
    }
  }, [workspace?.id, dateParams.fromStr, dateParams.toStr]);

  useEffect(() => {
    if (workspace?.id) fetchTeam();
  }, [workspace?.id, fetchTeam]);

  const handleSort = (column) => {
    setSortBy((prev) => {
      if (prev === column) {
        setSortOrder((o) => (o === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortOrder('desc');
      return column;
    });
  };

  const COLORS = useMemo(() => {
    const successBg = alpha(theme.palette.success.main, 0.14);
    const successFg = theme.palette.success.dark;

    const warnBg = alpha(theme.palette.warning.main, 0.16);
    const warnFg = theme.palette.warning.dark;

    const errorBg = alpha(theme.palette.error.main, 0.14);
    const errorFg = theme.palette.error.dark;

    const infoBg = alpha(theme.palette.info.main, 0.14);
    const infoFg = theme.palette.info.dark;

    return { successBg, successFg, warnBg, warnFg, errorBg, errorFg, infoBg, infoFg };
  }, [theme]);

  const metricChipSx = (bg, fg) => ({
    bgcolor: bg,
    color: fg,
    fontWeight: 800,
    height: 26,
    borderRadius: 999,
    minWidth: 32,
    justifyContent: 'center',
    '& .MuiChip-label': { px: 1, textAlign: 'center' },
  });

  const sortedMembers = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const list = Array.isArray(members) ? members : [];

    const filtered = list.filter((m) => {
      const name = (m?.name || '').toString().toLowerCase();
      const matchesSearch = name.includes(q);

      if (!matchesSearch) return false;

      if (filter === 'admins') {
        return ['Owner', 'Admin'].includes(m?.role);
      }
      if (filter === 'overloaded') {
        return toNum(m?.assigned_open) > 10;
      }
      if (filter === 'critical') {
        return toNum(m?.due_overdue_open) > 0;
      }

      return true;
    });

    // numeric safe sorting: only string-sort for name/role
    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        const aStr = (a?.name || '').toString();
        const bStr = (b?.name || '').toString();
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }

      if (sortBy === 'role') {
        const aStr = (a?.role || '').toString();
        const bStr = (b?.role || '').toString();
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }

      const aNum = toNum(a?.[sortBy]);
      const bNum = toNum(b?.[sortBy]);
      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return filtered;
  }, [members, debouncedSearch, filter, sortBy, sortOrder]);

  const onRowOpen = (member) => setSelectedMember(member);

  const onRowKeyDown = (e, member) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onRowOpen(member);
    }
  };

  // Sticky first column (Member) for wide tables
  const stickyMemberCell = (isHead = false) => ({
    position: 'sticky',
    left: 0,
    zIndex: isHead ? 4 : 2,
    bgcolor: isHead ? 'grey.50' : 'background.paper',
    boxShadow: `inset -1px 0 ${theme.palette.divider}`,
    whiteSpace: 'nowrap',
  });

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {/* Controls */}
      <Box sx={{ mb: 2.5, display: 'flex', gap: 2, alignItems: 'center', flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search members..."
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

        <ToggleButtonGroup
          value={filter}
          exclusive
          onChange={(e, newFilter) => newFilter && setFilter(newFilter)}
          size="small"
          sx={{
            '& .MuiToggleButton-root': {
              textTransform: 'none',
              fontWeight: 700,
              px: 1.5,
            },
          }}
        >
          <ToggleButton value="all">All</ToggleButton>
          <ToggleButton value="admins">Admins</ToggleButton>
          <ToggleButton value="overloaded">Overloaded</ToggleButton>
          <ToggleButton value="critical">Critical</ToggleButton>
        </ToggleButtonGroup>

        <Box sx={{ flex: 1 }} />

        {lastRefreshed && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Last refreshed: {formatTimeIST(lastRefreshed)}
          </Typography>
        )}

        <Tooltip title="Refresh">
          <span>
            <IconButton onClick={fetchTeam} size="small" aria-label="Refresh team" disabled={loading}>
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
                <IconButton onClick={fetchTeam} size="small" aria-label="Retry" disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          }
        >
          {error}
        </Alert>
      )}

      {sortedMembers.length === 0 ? (
        <Alert severity="info">No team members found</Alert>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflowX: 'auto' }}
        >
          <Table size="small" stickyHeader sx={{ minWidth: 1300 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell sx={stickyMemberCell(true)}>
                  <TableSortLabel
                    active={sortBy === 'name'}
                    direction={sortBy === 'name' ? sortOrder : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Member
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'role'}
                    direction={sortBy === 'role' ? sortOrder : 'asc'}
                    onClick={() => handleSort('role')}
                  >
                    Role
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'projects_involved'}
                    direction={sortBy === 'projects_involved' ? sortOrder : 'asc'}
                    onClick={() => handleSort('projects_involved')}
                  >
                    Projects
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'assigned_open'}
                    direction={sortBy === 'assigned_open' ? sortOrder : 'asc'}
                    onClick={() => handleSort('assigned_open')}
                  >
                    Open
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'completed'}
                    direction={sortBy === 'completed' ? sortOrder : 'asc'}
                    onClick={() => handleSort('completed')}
                  >
                    Completed
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="On-time / Late / Overdue (Target)">
                    <span>Target Performance</span>
                  </Tooltip>
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="On-time / Late / Overdue (Due)">
                    <span>Due Performance</span>
                  </Tooltip>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'target_compliance_pct'}
                    direction={sortBy === 'target_compliance_pct' ? sortOrder : 'asc'}
                    onClick={() => handleSort('target_compliance_pct')}
                  >
                    <Tooltip title="Target compliance percentage">
                      <span>Target %</span>
                    </Tooltip>
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'due_compliance_pct'}
                    direction={sortBy === 'due_compliance_pct' ? sortOrder : 'asc'}
                    onClick={() => handleSort('due_compliance_pct')}
                  >
                    <Tooltip title="Due compliance percentage">
                      <span>Due %</span>
                    </Tooltip>
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'recovered'}
                    direction={sortBy === 'recovered' ? sortOrder : 'asc'}
                    onClick={() => handleSort('recovered')}
                  >
                    Recovered
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'critical_late'}
                    direction={sortBy === 'critical_late' ? sortOrder : 'asc'}
                    onClick={() => handleSort('critical_late')}
                  >
                    Critical
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {sortedMembers.map((member, idx) => {
                const name = member?.name || '—';
                const avatarText = member?.avatar || getInitials(name);

                const role = member?.role || 'Member';
                const projectsInvolved = toNum(member?.projects_involved);

                const assignedOpen = toNum(member?.assigned_open);
                const completed = toNum(member?.completed);

                const onTarget = toNum(member?.on_target_completed);
                const lateTarget = toNum(member?.late_vs_target_completed);
                const targetOverdue = toNum(member?.target_overdue_open);

                const onDue = toNum(member?.on_due_completed);
                const lateDue = toNum(member?.late_vs_due_completed);
                const dueOverdue = toNum(member?.due_overdue_open);

                const targetPct =
                  member?.target_compliance_pct !== null && member?.target_compliance_pct !== undefined
                    ? `${toNum(member.target_compliance_pct)}%`
                    : '—';

                const duePct =
                  member?.due_compliance_pct !== null && member?.due_compliance_pct !== undefined
                    ? `${toNum(member.due_compliance_pct)}%`
                    : '—';

                const recovered = toNum(member?.recovered);
                const criticalLate = toNum(member?.critical_late);

                const rowBg = idx % 2 === 1 ? alpha(theme.palette.text.primary, 0.015) : 'transparent';

                return (
                  <TableRow
                    key={member?.id || idx}
                    hover
                    role="button"
                    tabIndex={0}
                    sx={{ cursor: 'pointer', bgcolor: rowBg }}
                    onClick={() => onRowOpen(member)}
                    onKeyDown={(e) => onRowKeyDown(e, member)}
                  >
                    <TableCell sx={stickyMemberCell(false)}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Avatar
                          sx={{
                            width: 34,
                            height: 34,
                            bgcolor: theme.palette.secondary.main,
                            color: theme.palette.getContrastText(theme.palette.secondary.main),
                            fontSize: '0.85rem',
                            fontWeight: 800,
                          }}
                        >
                          {avatarText}
                        </Avatar>

                        <Typography variant="body2" sx={{ fontWeight: 800, whiteSpace: 'nowrap' }}>
                          {name}
                        </Typography>
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={role}
                        size="small"
                        sx={{
                          borderRadius: 999,
                          fontWeight: 800,
                          bgcolor:
                            role === 'Owner'
                              ? COLORS.successBg
                              : role === 'Admin'
                              ? COLORS.infoBg
                              : alpha(theme.palette.secondary.main, 0.12),
                          color:
                            role === 'Owner'
                              ? COLORS.successFg
                              : role === 'Admin'
                              ? COLORS.infoFg
                              : theme.palette.secondary.dark,
                        }}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {projectsInvolved}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={assignedOpen}
                        size="small"
                        color={assignedOpen > 10 ? 'warning' : 'default'}
                        sx={{ fontWeight: 800, borderRadius: 999, minWidth: 36 }}
                      />
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {completed}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Tooltip title="Completed on/before target">
                          <Chip label={onTarget} size="small" sx={metricChipSx(COLORS.successBg, COLORS.successFg)} />
                        </Tooltip>
                        <Tooltip title="Completed after target">
                          <Chip label={lateTarget} size="small" sx={metricChipSx(COLORS.warnBg, COLORS.warnFg)} />
                        </Tooltip>
                        <Tooltip title="Open crossed target">
                          <Chip label={targetOverdue} size="small" sx={metricChipSx(COLORS.errorBg, COLORS.errorFg)} />
                        </Tooltip>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Tooltip title="Completed on/before due">
                          <Chip label={onDue} size="small" sx={metricChipSx(COLORS.successBg, COLORS.successFg)} />
                        </Tooltip>
                        <Tooltip title="Completed after due">
                          <Chip label={lateDue} size="small" sx={metricChipSx(COLORS.warnBg, COLORS.warnFg)} />
                        </Tooltip>
                        <Tooltip title="Open crossed due">
                          <Chip label={dueOverdue} size="small" sx={metricChipSx(COLORS.errorBg, COLORS.errorFg)} />
                        </Tooltip>
                      </Box>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {targetPct}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Typography variant="body2" sx={{ fontWeight: 800 }}>
                        {duePct}
                      </Typography>
                    </TableCell>

                    <TableCell align="center">
                      <Chip label={recovered} size="small" sx={metricChipSx(COLORS.infoBg, COLORS.infoFg)} />
                    </TableCell>

                    <TableCell align="center">
                      <Chip
                        label={criticalLate}
                        size="small"
                        color={criticalLate > 0 ? 'error' : 'default'}
                        sx={{ fontWeight: 800, borderRadius: 999, minWidth: 36 }}
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {selectedMember && (
        <MemberDetailDialog
          open={Boolean(selectedMember)}
          onClose={() => setSelectedMember(null)}
          member={selectedMember}
          workspace={workspace}
          dateRange={dateRange}
        />
      )}
    </Box>
  );
}

export default AdminTeamTab;
