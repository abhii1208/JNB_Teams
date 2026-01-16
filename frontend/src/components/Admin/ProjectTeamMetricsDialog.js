// src/components/admin/ProjectTeamMetricsDialog.js
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  Box,
  Typography,
  IconButton,
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
  Divider,
  Tooltip,
  useTheme,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import RefreshIcon from '@mui/icons-material/Refresh';

import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined';
import PsychologyOutlinedIcon from '@mui/icons-material/PsychologyOutlined';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import DesignServicesOutlinedIcon from '@mui/icons-material/DesignServicesOutlined';
import BugReportOutlinedIcon from '@mui/icons-material/BugReportOutlined';
import CampaignOutlinedIcon from '@mui/icons-material/CampaignOutlined';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';

import { getAdminProjectTeamMetrics } from '../../apiClient';

// ----------------- Helpers -----------------
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

function ProjectTeamMetricsDialog({ open, onClose, project, workspace, dateRange }) {
  const theme = useTheme();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastRefreshed, setLastRefreshed] = useState(null);

  // Prevent setState after unmount + overlapping calls
  const isMountedRef = useRef(true);
  const reqIdRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const fromTime = dateRange?.from instanceof Date ? dateRange.from.getTime() : null;
  const toTime = dateRange?.to instanceof Date ? dateRange.to.getTime() : null;

  const dateParams = useMemo(() => {
    const fromStr = formatYYYYMMDDLocal(dateRange?.from);
    const toStr = formatYYYYMMDDLocal(dateRange?.to);
    return { fromStr, toStr };
  }, [fromTime, toTime]);

  const fetchTeamMetrics = useCallback(async () => {
    if (!open || !project?.id || !workspace?.id) return;

    const reqId = ++reqIdRef.current;
    setLoading(true);
    setError(null);

    try {
      const params = {};
      if (dateParams.fromStr && dateParams.toStr) {
        params.date_from = dateParams.fromStr;
        params.date_to = dateParams.toStr;
      }

      const response = await getAdminProjectTeamMetrics(workspace.id, project.id, params);

      if (!isMountedRef.current || reqIdRef.current !== reqId) return;

      setData(response?.data || null);
      setLastRefreshed(new Date());
    } catch (err) {
      if (!isMountedRef.current || reqIdRef.current !== reqId) return;
      const msg =
        err?.response?.data?.message ||
        err?.message ||
        'Failed to fetch team metrics. Please try again.';
      setError(msg);
      setData(null);
    } finally {
      if (!isMountedRef.current || reqIdRef.current !== reqId) return;
      setLoading(false);
    }
  }, [open, project?.id, workspace?.id, dateParams.fromStr, dateParams.toStr]);

  useEffect(() => {
    if (open) fetchTeamMetrics();
  }, [open, fetchTeamMetrics]);

  const projectSummary = data?.project || {};

  // Keep "Unassigned" at top, rest alphabetically
  const members = useMemo(() => {
    const raw = Array.isArray(data?.members) ? data.members : [];
    const list = [...raw];
    list.sort((a, b) => {
      const aUn = (a?.name || '').toLowerCase() === 'unassigned';
      const bUn = (b?.name || '').toLowerCase() === 'unassigned';
      if (aUn && !bUn) return -1;
      if (!aUn && bUn) return 1;
      return (a?.name || '').localeCompare(b?.name || '');
    });
    return list;
  }, [data?.members]);

  // Colors that respect theme/dark-mode via alpha
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

  const renderProjectIcon = () => {
    const raw = String(project?.icon || '').trim();
    const key = normalizeIconKey(raw);
    const IconComp = ICON_MAP[key];

    const bg = project?.color || theme.palette.primary.main;
    const fg = theme.palette.getContrastText(bg);

    if (raw && raw.length <= 2 && !IconComp) {
      return <Box component="span" sx={{ fontSize: 16, lineHeight: 1, color: fg }}>{raw}</Box>;
    }
    if (IconComp) return <IconComp sx={{ fontSize: 18, color: fg }} />;

    const firstLetter = String(project?.name || '?').trim()[0]?.toUpperCase() || '?';
    return <Box component="span" sx={{ fontSize: 14, fontWeight: 900, lineHeight: 1, color: fg }}>{firstLetter}</Box>;
  };

  const projectBg = project?.color || theme.palette.primary.main;
  const projectFg = theme.palette.getContrastText(projectBg);

  const totalTasks = toNum(projectSummary.total_tasks);
  const openTasks = toNum(projectSummary.open_tasks);
  const completedTasks = toNum(projectSummary.completed_tasks);

  const completionRate = useMemo(() => {
    const denom = totalTasks > 0 ? totalTasks : 0;
    if (!denom) return 0;
    return Math.round((completedTasks / denom) * 100);
  }, [totalTasks, completedTasks]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle sx={{ pb: 1.5 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, minWidth: 0 }}>
            <Box
              sx={{
                width: 42,
                height: 42,
                borderRadius: 1.5,
                bgcolor: projectBg,
                color: projectFg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flex: '0 0 auto',
                overflow: 'hidden',
              }}
            >
              {renderProjectIcon()}
            </Box>

            <Box sx={{ minWidth: 0 }}>
              <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {project?.name || 'Project'}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.25 }}>
                Team Performance Metrics
                {lastRefreshed ? ` • Last refreshed ${lastRefreshed.toLocaleTimeString()}` : ''}
              </Typography>
            </Box>
          </Box>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
            <Tooltip title="Refresh">
              <span>
                <IconButton onClick={fetchTeamMetrics} size="small" aria-label="Refresh team metrics" disabled={loading}>
                  <RefreshIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
            <IconButton onClick={onClose} size="small" aria-label="Close">
              <CloseIcon fontSize="small" />
            </IconButton>
          </Box>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 5 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert
            severity="error"
            action={
              <Tooltip title="Retry">
                <span>
                  <IconButton onClick={fetchTeamMetrics} size="small" aria-label="Retry" disabled={loading}>
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            }
          >
            {error}
          </Alert>
        ) : (
          <Box>
            {/* Project Summary */}
            <Box sx={{ mb: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: 700 }}>
                  Project Summary
                </Typography>
                <Chip
                  label={`Completion: ${completionRate}%`}
                  size="small"
                  sx={{
                    borderRadius: 999,
                    fontWeight: 800,
                    bgcolor: alpha(theme.palette.primary.main, 0.12),
                    color: theme.palette.primary.dark,
                  }}
                />
              </Box>

              <Grid container spacing={2} sx={{ mt: 0.5 }}>
                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Team Size
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                        {toNum(projectSummary.team_size)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Total Tasks
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                        {totalTasks}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Open Tasks
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                        {openTasks}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={3}>
                  <Card variant="outlined" sx={{ borderRadius: 2 }}>
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Completed
                      </Typography>
                      <Typography variant="h4" sx={{ fontWeight: 900, mt: 0.5 }}>
                        {completedTasks}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>

              <Grid container spacing={2} sx={{ mt: 1 }}>
                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      bgcolor: COLORS.errorBg,
                      borderColor: alpha(theme.palette.error.main, 0.25),
                    }}
                  >
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Target Overdue (Open)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: COLORS.errorFg, mt: 0.5 }}>
                        {toNum(projectSummary.target_overdue_open)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      bgcolor: COLORS.errorBg,
                      borderColor: alpha(theme.palette.error.main, 0.25),
                    }}
                  >
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Due Overdue (Open)
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: COLORS.errorFg, mt: 0.5 }}>
                        {toNum(projectSummary.due_overdue_open)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>

                <Grid item xs={12} sm={6} md={4}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 2,
                      bgcolor: COLORS.errorBg,
                      borderColor: alpha(theme.palette.error.main, 0.25),
                    }}
                  >
                    <CardContent>
                      <Typography variant="body2" color="text.secondary">
                        Critical Late
                      </Typography>
                      <Typography variant="h5" sx={{ fontWeight: 900, color: COLORS.errorFg, mt: 0.5 }}>
                        {toNum(projectSummary.critical_late)}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              </Grid>
            </Box>

            <Divider sx={{ my: 3 }} />

            {/* Member Metrics */}
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 700 }}>
                Team Member Metrics
              </Typography>

              {members.length === 0 ? (
                <Alert severity="info">No team members found</Alert>
              ) : (
                <TableContainer component={Paper} variant="outlined" sx={{ mt: 2, borderRadius: 2, overflowX: 'auto' }}>
                  <Table size="small" stickyHeader sx={{ minWidth: 980 }}>
                    <TableHead>
                      <TableRow sx={{ bgcolor: 'grey.50' }}>
                        <TableCell sx={{ whiteSpace: 'nowrap' }}>Member</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Open</TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>Completed</TableCell>
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
                          <Tooltip title="Late vs target but within due">
                            <span>Recovered</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Crossed due date">
                            <span>Critical</span>
                          </Tooltip>
                        </TableCell>
                        <TableCell align="center" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Average slippage in days (target vs completion)">
                            <span>Avg Slippage</span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    </TableHead>

                    <TableBody>
                      {members.map((member, idx) => {
                        const name = member?.name || '—';
                        const isUnassigned = name.toLowerCase() === 'unassigned';

                        const assignedOpen = toNum(member?.assigned_open);
                        const completed = toNum(member?.completed);

                        const onTarget = toNum(member?.on_target_completed);
                        const lateTarget = toNum(member?.late_vs_target_completed);
                        const targetOverdue = toNum(member?.target_overdue_open);

                        const onDue = toNum(member?.on_due_completed);
                        const lateDue = toNum(member?.late_vs_due_completed);
                        const dueOverdue = toNum(member?.due_overdue_open);

                        const recovered = toNum(member?.recovered);
                        const critical = toNum(member?.critical_late);

                        const avgSlip = toNum(member?.avg_slippage_days, 0);

                        const avatarText = member?.avatar || getInitials(name);

                        return (
                          <TableRow
                            key={member?.id || idx}
                            hover
                            sx={{
                              '&:nth-of-type(odd)': { bgcolor: alpha(theme.palette.text.primary, 0.015) },
                            }}
                          >
                            <TableCell>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                                <Avatar
                                  sx={{
                                    width: 34,
                                    height: 34,
                                    bgcolor: isUnassigned ? theme.palette.grey[500] : theme.palette.secondary.main,
                                    color: theme.palette.getContrastText(
                                      isUnassigned ? theme.palette.grey[500] : theme.palette.secondary.main
                                    ),
                                    fontSize: '0.85rem',
                                    fontWeight: 800,
                                  }}
                                >
                                  {avatarText}
                                </Avatar>

                                <Box>
                                  <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                    {name}
                                  </Typography>
                                  {member?.role ? (
                                    <Typography variant="caption" color="text.secondary">
                                      {member.role}
                                    </Typography>
                                  ) : null}
                                </Box>
                              </Box>
                            </TableCell>

                            <TableCell align="center">
                              <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                {assignedOpen}
                              </Typography>
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
                              <Tooltip title="Late vs target but within due">
                                <Chip label={recovered} size="small" sx={metricChipSx(COLORS.infoBg, COLORS.infoFg)} />
                              </Tooltip>
                            </TableCell>

                            <TableCell align="center">
                              <Tooltip title="Crossed due date (high risk)">
                                <Chip
                                  label={critical}
                                  size="small"
                                  color={critical > 0 ? 'error' : 'default'}
                                  sx={{ fontWeight: 800, borderRadius: 999, minWidth: 36 }}
                                />
                              </Tooltip>
                            </TableCell>

                            <TableCell align="center">
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {avgSlip > 0 ? `${Math.round(avgSlip)}d` : '—'}
                              </Typography>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </Box>
          </Box>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ProjectTeamMetricsDialog;
