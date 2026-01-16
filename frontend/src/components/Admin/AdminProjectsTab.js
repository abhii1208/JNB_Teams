// src/components/admin/AdminProjectsTab.js
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
  AvatarGroup,
  Typography,
  TextField,
  InputAdornment,
  CircularProgress,
  Tooltip,
  IconButton,
  Alert,
  FormControlLabel,
  Switch,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

import SearchIcon from '@mui/icons-material/Search';
import ClearIcon from '@mui/icons-material/Clear';
import RefreshIcon from '@mui/icons-material/Refresh';

import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

import { getAdminProjects } from '../../apiClient';
import ProjectTeamMetricsDialog from './ProjectTeamMetricsDialog';

// --- Helpers ---
const formatYYYYMMDDLocal = (d) => {
  if (!d || !(d instanceof Date) || Number.isNaN(d.getTime())) return null;
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

const normalizeIconKey = (v) => String(v || '').trim().toLowerCase();

const ICON_MAP = {
  folder: FolderOutlinedIcon,
  psychology: PsychologyOutlinedIcon,
  dashboard: DashboardOutlinedIcon,
  code: CodeOutlinedIcon,
  design: DesignServicesOutlinedIcon,
  designservices: DesignServicesOutlinedIcon,
  bug: BugReportOutlinedIcon,
  bugreport: BugReportOutlinedIcon,
  campaign: CampaignOutlinedIcon,
  lightbulb: LightbulbOutlinedIcon,
  idea: LightbulbOutlinedIcon,
};

function AdminProjectsTab({ workspace, dateRange }) {
  const theme = useTheme();

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const [sortBy, setSortBy] = useState('critical_late');
  const [sortOrder, setSortOrder] = useState('desc');

  const [includeArchived, setIncludeArchived] = useState(false);
  const [selectedProject, setSelectedProject] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Prevent setState after unmount + handle overlapping requests
  const isMountedRef = useRef(true);
  const requestIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Debounce search for smoother typing + less sorting work
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(t);
  }, [searchTerm]);

  const fromTime = dateRange?.from instanceof Date ? dateRange.from.getTime() : null;
  const toTime = dateRange?.to instanceof Date ? dateRange.to.getTime() : null;

  // Stable date params (avoid toISOString UTC shifting day)
  const dateParams = useMemo(() => {
    const fromStr = formatYYYYMMDDLocal(dateRange?.from);
    const toStr = formatYYYYMMDDLocal(dateRange?.to);
    return { fromStr, toStr };
  }, [fromTime, toTime]);

  const fetchProjects = useCallback(async () => {
    if (!workspace?.id) return;

    const reqId = ++requestIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = {
        include_archived: includeArchived ? 'true' : 'false',
      };

      if (dateParams.fromStr && dateParams.toStr) {
        params.date_from = dateParams.fromStr;
        params.date_to = dateParams.toStr;
      }

      const response = await getAdminProjects(workspace.id, params);

      if (!isMountedRef.current || requestIdRef.current !== reqId) return;

      const data = Array.isArray(response?.data) ? response.data : [];
      setProjects(data);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!isMountedRef.current || requestIdRef.current !== reqId) return;

      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to fetch projects. Please try again.';
      setError(msg);
    } finally {
      if (!isMountedRef.current || requestIdRef.current !== reqId) return;
      setLoading(false);
    }
  }, [workspace?.id, includeArchived, dateParams.fromStr, dateParams.toStr]);

  useEffect(() => {
    if (workspace?.id) fetchProjects();
  }, [workspace?.id, fetchProjects]);

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

  // Health badge refined: use open tasks as denominator (risk), fall back to total
  const getHealthBadge = (project) => {
    const total = toNum(project?.total_tasks, 0);
    const open = toNum(project?.open_tasks, 0);
    const denom = open > 0 ? open : total;

    if (denom <= 0) return { label: 'No tasks', color: 'default' };

    const criticalLate = toNum(project?.critical_late, 0);
    const dueOverdue = toNum(project?.due_overdue_open, 0);

    const criticalPct = (criticalLate / denom) * 100;
    const overduePct = (dueOverdue / denom) * 100;

    if (criticalPct >= 30 || overduePct >= 30) return { label: 'Critical', color: 'error' };
    if (criticalPct >= 15 || overduePct >= 15) return { label: 'Attention', color: 'warning' };
    return { label: 'Healthy', color: 'success' };
  };

  const sortedProjects = useMemo(() => {
    const q = debouncedSearch.toLowerCase();
    const list = Array.isArray(projects) ? projects : [];

    const filtered = list.filter((p) => {
      const name = (p?.name || '').toString().toLowerCase();
      return name.includes(q);
    });

    const isNumeric = (v) =>
      v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

    filtered.sort((a, b) => {
      if (sortBy === 'name') {
        const aStr = (a?.name || '').toString();
        const bStr = (b?.name || '').toString();
        return sortOrder === 'asc' ? aStr.localeCompare(bStr) : bStr.localeCompare(aStr);
      }

      const aRaw = a?.[sortBy];
      const bRaw = b?.[sortBy];

      const aNum = isNumeric(aRaw) ? Number(aRaw) : 0;
      const bNum = isNumeric(bRaw) ? Number(bRaw) : 0;

      return sortOrder === 'asc' ? aNum - bNum : bNum - aNum;
    });

    return filtered;
  }, [projects, debouncedSearch, sortBy, sortOrder]);

  const handleTeamOpen = (project) => setSelectedProject(project);

  const handleTeamKeyDown = (e, project) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTeamOpen(project);
    }
  };

  // --- UI helpers ---
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
    '& .MuiChip-label': { px: 1 },
  });

  // Sticky columns to fix the left-side “Project” layout + scroll usability
  const COL_W = { project: 280, health: 120, team: 160 };
  const stickyCell = (left, isHead = false) => ({
    position: 'sticky',
    left,
    zIndex: isHead ? 4 : 2,
    bgcolor: isHead ? 'grey.50' : 'background.paper',
    boxShadow: isHead
      ? `inset -1px 0 ${theme.palette.divider}`
      : `inset -1px 0 ${theme.palette.divider}`,
  });

  const renderProjectIcon = (project) => {
    const raw = String(project?.icon || '').trim();
    const key = normalizeIconKey(raw);
    const IconComp = ICON_MAP[key];

    const bg = project?.color || theme.palette.primary.main;
    const fg = theme.palette.getContrastText(bg);

    // If icon is an emoji / short symbol -> show it
    if (raw && raw.length <= 2 && !IconComp) {
      return (
        <Box
          component="span"
          sx={{ fontSize: 16, lineHeight: 1, color: fg, display: 'inline-flex' }}
        >
          {raw}
        </Box>
      );
    }

    // If icon is a known icon-name -> render the MUI icon
    if (IconComp) {
      return <IconComp sx={{ fontSize: 18, color: fg }} />;
    }

    // Otherwise (like "psychology", "folder" words coming from DB), avoid overflow:
    // show first letter of project name
    const firstLetter = String(project?.name || '?').trim()[0]?.toUpperCase() || '?';
    return (
      <Box
        component="span"
        sx={{ fontSize: 14, fontWeight: 900, lineHeight: 1, color: fg }}
      >
        {firstLetter}
      </Box>
    );
  };

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
          placeholder="Search projects..."
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

        <FormControlLabel
          control={
            <Switch
              checked={includeArchived}
              onChange={(e) => setIncludeArchived(e.target.checked)}
            />
          }
          label="Include archived"
        />

        <Box sx={{ flex: 1 }} />

        {lastRefreshed && (
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Last refreshed: {lastRefreshed.toLocaleTimeString()}
          </Typography>
        )}

        <Tooltip title="Refresh">
          <span>
            <IconButton
              onClick={fetchProjects}
              size="small"
              aria-label="Refresh projects"
              disabled={loading}
            >
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
                <IconButton onClick={fetchProjects} size="small" aria-label="Retry" disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          }
        >
          {error}
        </Alert>
      )}

      {sortedProjects.length === 0 ? (
        <Alert severity="info">No projects found</Alert>
      ) : (
        <TableContainer
          component={Paper}
          elevation={0}
          sx={{
            border: 1,
            borderColor: 'divider',
            borderRadius: 2,
            overflowX: 'auto',
          }}
        >
          <Table size="small" stickyHeader sx={{ minWidth: 1200 }}>
            <TableHead>
              <TableRow sx={{ bgcolor: 'grey.50' }}>
                <TableCell
                  sx={{
                    ...stickyCell(0, true),
                    width: COL_W.project,
                    minWidth: COL_W.project,
                    maxWidth: COL_W.project,
                    whiteSpace: 'nowrap',
                  }}
                >
                  <TableSortLabel
                    active={sortBy === 'name'}
                    direction={sortBy === 'name' ? sortOrder : 'asc'}
                    onClick={() => handleSort('name')}
                  >
                    Project
                  </TableSortLabel>
                </TableCell>

                <TableCell
                  align="center"
                  sx={{
                    ...stickyCell(COL_W.project, true),
                    width: COL_W.health,
                    minWidth: COL_W.health,
                    maxWidth: COL_W.health,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Health
                </TableCell>

                <TableCell
                  align="center"
                  sx={{
                    ...stickyCell(COL_W.project + COL_W.health, true),
                    width: COL_W.team,
                    minWidth: COL_W.team,
                    maxWidth: COL_W.team,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Team
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'total_tasks'}
                    direction={sortBy === 'total_tasks' ? sortOrder : 'asc'}
                    onClick={() => handleSort('total_tasks')}
                  >
                    Total
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'open_tasks'}
                    direction={sortBy === 'open_tasks' ? sortOrder : 'asc'}
                    onClick={() => handleSort('open_tasks')}
                  >
                    Open
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'completed_tasks'}
                    direction={sortBy === 'completed_tasks' ? sortOrder : 'asc'}
                    onClick={() => handleSort('completed_tasks')}
                  >
                    Completed
                  </TableSortLabel>
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="On-time (<= target) / Late (> target completed) / Overdue (open & crossed target)">
                    <span>Target Metrics</span>
                  </Tooltip>
                </TableCell>

                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <Tooltip title="On-time (<= due) / Late (> due completed) / Overdue (open & crossed due)">
                    <span>Due Metrics</span>
                  </Tooltip>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'recovered'}
                    direction={sortBy === 'recovered' ? sortOrder : 'asc'}
                    onClick={() => handleSort('recovered')}
                  >
                    <Tooltip title="Late vs target but completed within due">
                      <span>Recovered</span>
                    </Tooltip>
                  </TableSortLabel>
                </TableCell>

                <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                  <TableSortLabel
                    active={sortBy === 'critical_late'}
                    direction={sortBy === 'critical_late' ? sortOrder : 'asc'}
                    onClick={() => handleSort('critical_late')}
                  >
                    <Tooltip title="Crossed due date (open overdue or completed after due)">
                      <span>Critical</span>
                    </Tooltip>
                  </TableSortLabel>
                </TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {sortedProjects.map((project, index) => {
                const healthBadge = getHealthBadge(project);
                const teamMembers = Array.isArray(project?.team_members) ? project.team_members : [];

                const projectBg = project?.color || theme.palette.primary.main;
                const projectFg = theme.palette.getContrastText(projectBg);

                const onTarget = toNum(project?.on_target_completed);
                const lateTarget = toNum(project?.late_vs_target_completed);
                const targetOverdue = toNum(project?.target_overdue_open);

                const onDue = toNum(project?.on_due_completed);
                const lateDue = toNum(project?.late_vs_due_completed);
                const dueOverdue = toNum(project?.due_overdue_open);

                const recovered = toNum(project?.recovered);
                const criticalLate = toNum(project?.critical_late);

                return (
                  <TableRow
                    key={project.id}
                    hover
                    sx={{
                      '&:nth-of-type(odd)': { bgcolor: alpha(theme.palette.text.primary, 0.015) },
                    }}
                  >
                    {/* Project (sticky) */}
                    <TableCell
                      sx={{
                        ...stickyCell(0, false),
                        width: COL_W.project,
                        minWidth: COL_W.project,
                        maxWidth: COL_W.project,
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, minWidth: 0 }}>
                        {/* Rectified icon: no overflow + proper mapping */}
                        <Box
                          sx={{
                            width: 34,
                            height: 34,
                            borderRadius: 1.5,
                            bgcolor: projectBg,
                            color: projectFg,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flex: '0 0 auto',
                            overflow: 'hidden',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {renderProjectIcon(project)}
                        </Box>

                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              lineHeight: 1.2,
                            }}
                            title={project?.name || ''}
                          >
                            {project?.name || '—'}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ whiteSpace: 'nowrap', lineHeight: 1.2 }}
                          >
                            {project?.owner_name || '—'}
                          </Typography>
                        </Box>
                      </Box>
                    </TableCell>

                    {/* Health (sticky) */}
                    <TableCell
                      align="center"
                      sx={{
                        ...stickyCell(COL_W.project, false),
                        width: COL_W.health,
                        minWidth: COL_W.health,
                        maxWidth: COL_W.health,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Chip
                        label={healthBadge.label}
                        color={healthBadge.color}
                        size="small"
                        sx={{ fontWeight: 800 }}
                      />
                    </TableCell>

                    {/* Team (sticky) */}
                    <TableCell
                      align="center"
                      sx={{
                        ...stickyCell(COL_W.project + COL_W.health, false),
                        width: COL_W.team,
                        minWidth: COL_W.team,
                        maxWidth: COL_W.team,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      <Tooltip title="Click to view team metrics">
                        <Box
                          role="button"
                          tabIndex={0}
                          onClick={() => handleTeamOpen(project)}
                          onKeyDown={(e) => handleTeamKeyDown(e, project)}
                          sx={{ display: 'inline-flex', outline: 'none', cursor: 'pointer' }}
                        >
                          <AvatarGroup
                            max={5}
                            spacing="small"
                            sx={{
                              justifyContent: 'center',
                              '&:hover': { opacity: 0.75 },
                              '& .MuiAvatar-root': { width: 28, height: 28, fontSize: '0.75rem' },
                            }}
                          >
                            {teamMembers.map((member, idx) => {
                              const name = member?.name || member?.full_name || '';
                              const avatarText = member?.avatar || getInitials(name);
                              return (
                                <Tooltip key={member?.id || idx} title={name || 'Member'}>
                                  <Avatar
                                    sx={{
                                      bgcolor: theme.palette.secondary.main,
                                      color: theme.palette.getContrastText(theme.palette.secondary.main),
                                    }}
                                  >
                                    {avatarText}
                                  </Avatar>
                                </Tooltip>
                              );
                            })}
                          </AvatarGroup>
                        </Box>
                      </Tooltip>
                    </TableCell>

                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {toNum(project?.total_tasks)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {toNum(project?.open_tasks)}
                      </Typography>
                    </TableCell>

                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Typography variant="body2" sx={{ fontWeight: 700 }}>
                        {toNum(project?.completed_tasks)}
                      </Typography>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Tooltip title="Completed on/before target date">
                          <Chip label={onTarget} size="small" sx={metricChipSx(COLORS.successBg, COLORS.successFg)} />
                        </Tooltip>
                        <Tooltip title="Completed after target date">
                          <Chip label={lateTarget} size="small" sx={metricChipSx(COLORS.warnBg, COLORS.warnFg)} />
                        </Tooltip>
                        <Tooltip title="Open tasks that crossed target date">
                          <Chip label={targetOverdue} size="small" sx={metricChipSx(COLORS.errorBg, COLORS.errorFg)} />
                        </Tooltip>
                      </Box>
                    </TableCell>

                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.75, flexWrap: 'wrap' }}>
                        <Tooltip title="Completed on/before due date">
                          <Chip label={onDue} size="small" sx={metricChipSx(COLORS.successBg, COLORS.successFg)} />
                        </Tooltip>
                        <Tooltip title="Completed after due date">
                          <Chip label={lateDue} size="small" sx={metricChipSx(COLORS.warnBg, COLORS.warnFg)} />
                        </Tooltip>
                        <Tooltip title="Open tasks that crossed due date">
                          <Chip label={dueOverdue} size="small" sx={metricChipSx(COLORS.errorBg, COLORS.errorFg)} />
                        </Tooltip>
                      </Box>
                    </TableCell>

                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Late vs target but completed within due">
                        <Chip label={recovered} size="small" sx={metricChipSx(COLORS.infoBg, COLORS.infoFg)} />
                      </Tooltip>
                    </TableCell>

                    <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title="Crossed due date (high risk)">
                        <Chip
                          label={criticalLate}
                          size="small"
                          color={criticalLate > 0 ? 'error' : 'default'}
                          sx={{ fontWeight: 800, borderRadius: 999 }}
                        />
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {selectedProject && (
        <ProjectTeamMetricsDialog
          open={Boolean(selectedProject)}
          onClose={() => setSelectedProject(null)}
          project={selectedProject}
          workspace={workspace}
          dateRange={dateRange}
        />
      )}
    </Box>
  );
}

export default AdminProjectsTab;
