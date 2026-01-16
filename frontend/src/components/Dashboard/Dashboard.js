import React from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  LinearProgress,
  Avatar,
  Chip,
  Switch,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import { getProjects, getApprovalCount } from '../../apiClient';
import api from '../../apiClient';

const stageColors = {
  Planned: { bg: '#e0e7ff', text: '#3730a3' },
  'In-process': { bg: '#fef3c7', text: '#92400e' },
  Completed: { bg: '#d1fae5', text: '#065f46' },
  Dropped: { bg: '#fee2e2', text: '#991b1b' },
  'On-hold': { bg: '#f3e8ff', text: '#6b21a8' },
};

const startOfDay = (d) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

const safeDate = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

// small helper for Due / Target labels
const formatDateLabel = (dateStr, labelPrefix) => {
  if (!dateStr) return `No ${labelPrefix.toLowerCase()} date`;

  const d = safeDate(dateStr);
  if (!d) return `No ${labelPrefix.toLowerCase()} date`;

  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const dateOnly = startOfDay(d);

  if (dateOnly.getTime() === today.getTime()) return `${labelPrefix} Today`;
  if (dateOnly.getTime() === tomorrow.getTime()) return `${labelPrefix} Tomorrow`;
  return `${labelPrefix} ${d.toLocaleDateString()}`;
};

const getDue = (t) => t?.due_date || t?.dueDate || null;
const getTarget = (t) => t?.target_date || t?.targetDate || null;
const getModeDate = (t, mode) => (mode === 'due' ? getDue(t) : getTarget(t));

function Dashboard({ user, workspace, onNavigate }) {
  // Toggle applies to: Today / Tomorrow / Soon / Overdue / No Date + Upcoming list
  const [dateMode, setDateMode] = React.useState('due'); // 'due' | 'target'

  const [activeProjectsCount, setActiveProjectsCount] = React.useState(0);
  const [pendingApprovals, setPendingApprovals] = React.useState(0);
  const [allTasks, setAllTasks] = React.useState([]);
  const [topProjects, setTopProjects] = React.useState([]);

  // Fixed sizes
  const SCORECARD_HEIGHT = 190; // increase this to make cards taller
  const FIXED_TASK_BOX_HEIGHT = 525;

  // Hide completed tasks (both stage Completed and status Closed)
  const isActiveTask = (t) => {
    const stage = (t?.stage || '').toString();
    const status = (t?.status || '').toString();
    return status !== 'Closed' && stage !== 'Completed';
  };

  const iphoneSwitchSx = {
    width: 56,
    height: 32,
    p: 0,
    '& .MuiSwitch-switchBase': {
      p: 0.5,
      '&.Mui-checked': { transform: 'translateX(24px)' },
    },
    '& .MuiSwitch-thumb': {
      width: 26,
      height: 26,
      borderRadius: '50%',
    },
    '& .MuiSwitch-track': {
      borderRadius: 16,
      opacity: 1,
      backgroundColor: 'rgba(15, 118, 110, 0.35)',
    },
  };

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      if (!workspace?.id) return;

      try {
        // Fetch projects
        const projectsResponse = await getProjects(workspace.id, false);
        const projects = projectsResponse.data || [];
        const activeProjects = projects.filter((p) => !p.archived);
        setActiveProjectsCount(activeProjects.length);

        // Fetch all tasks across projects (parallel)
        const taskBatches = await Promise.all(
          activeProjects.map((project) =>
            api
              .get(`/api/tasks/project/${project.id}`)
              .then((res) => ({ project, tasks: res.data || [] }))
              .catch((err) => {
                console.error(`Failed to fetch tasks for project ${project.id}:`, err);
                return { project, tasks: [] };
              })
          )
        );

        const mergedTasks = taskBatches.flatMap(({ project, tasks }) =>
          (tasks || []).map((t) => ({
            ...t,
            project_name: project.name,
            project_id: project.id,
          }))
        );

        setAllTasks(mergedTasks);

        // Fetch pending approvals
        const approvalsResponse = await getApprovalCount(workspace.id);
        setPendingApprovals(approvalsResponse?.data?.count || 0);

        // Top projects by task count
        const projectTaskCounts = activeProjects.map((p) => ({
          ...p,
          taskCount: mergedTasks.filter((t) => t.project_id === p.id).length,
          completedCount: mergedTasks.filter(
            (t) => t.project_id === p.id && (t.status === 'Closed' || t.stage === 'Completed')
          ).length,
        }));

        const top3 = projectTaskCounts.sort((a, b) => b.taskCount - a.taskCount).slice(0, 3);
        setTopProjects(top3);
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };

    fetchDashboardData();
  }, [workspace]);

  // Stats for scorecards (toggle applies here)
  const stats = React.useMemo(() => {
    const today = startOfDay(new Date());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const day3 = new Date(today);
    day3.setDate(day3.getDate() + 3);

    const modeLabel = dateMode === 'due' ? 'Due' : 'Target';

    const tasks = (allTasks || []).filter(isActiveTask);

    const getD = (t) => safeDate(getModeDate(t, dateMode));

    const countToday = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      return startOfDay(d).getTime() === today.getTime();
    }).length;

    const countTomorrow = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      return startOfDay(d).getTime() === tomorrow.getTime();
    }).length;

    // Soon = after tomorrow up to next 3 days
    const countSoon = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      const time = startOfDay(d).getTime();
      return time > tomorrow.getTime() && time <= day3.getTime();
    }).length;

    const countOverdue = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      return startOfDay(d).getTime() < today.getTime();
    }).length;

    const countNoDate = tasks.filter((t) => !getD(t)).length;

    return { modeLabel, countToday, countTomorrow, countSoon, countOverdue, countNoDate };
  }, [allTasks, dateMode]);

  // Upcoming list:
  // ✅ show ALL tasks that have due/target date filled (based on toggle)
  // ✅ sort old -> new (earliest -> latest), includes overdue at top
  // ✅ hide completed tasks
  const upcomingTasks = React.useMemo(() => {
    const tasks = (allTasks || []).filter(isActiveTask);

    return tasks
      .filter((t) => {
        const d = safeDate(getModeDate(t, dateMode));
        return Boolean(d);
      })
      .sort((a, b) => {
        const da = safeDate(getModeDate(a, dateMode));
        const db = safeDate(getModeDate(b, dateMode));
        if (!da && !db) return 0;
        if (!da) return 1;
        if (!db) return -1;
        return da.getTime() - db.getTime();
      });
  }, [allTasks, dateMode]);

  // 7 scorecards (one line) - equal width
  const statCards = React.useMemo(() => {
    const modeLabel = stats.modeLabel;

    return [
      {
        title: 'Active Projects',
        value: String(activeProjectsCount || 0),
        icon: <FolderIcon />,
        color: '#7c3aed',
        bgColor: 'rgba(124, 58, 237, 0.1)',
      },
      {
        title: `Tasks ${modeLabel} Today`,
        value: String(stats.countToday || 0),
        icon: <TaskAltIcon />,
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.1)',
      },
      {
        title: `Tasks ${modeLabel} Tomorrow`,
        value: String(stats.countTomorrow || 0),
        icon: <TaskAltIcon />,
        color: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.1)',
      },
      {
        title: `${modeLabel} Soon (3 days)`,
        value: String(stats.countSoon || 0),
        icon: <TrendingUpIcon />,
        color: '#0f766e',
        bgColor: 'rgba(15, 118, 110, 0.1)',
      },
      {
        title: `${modeLabel} Overdue`,
        value: String(stats.countOverdue || 0),
        icon: <AssignmentLateIcon />,
        color: '#dc2626',
        bgColor: 'rgba(220, 38, 38, 0.10)',
      },
      {
        title: `No ${modeLabel} Date`,
        value: String(stats.countNoDate || 0),
        icon: <AssignmentIcon />,
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
      },
      {
        title: 'Pending Approvals',
        value: String(pendingApprovals || 0),
        icon: <PendingActionsIcon />,
        color: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.1)',
      },
    ];
  }, [activeProjectsCount, pendingApprovals, stats]);

  const renderTaskRow = (task) => {
    const labelPrefix = dateMode === 'due' ? 'Due' : 'Target';
    const dateValue = getModeDate(task, dateMode);
    const dateText = formatDateLabel(dateValue, labelPrefix);

    const assigneeInitials = task.assignee_name
      ? task.assignee_name.split(' ').map((n) => n[0]).join('').toUpperCase()
      : 'UN';

    return (
      <Box
        key={task.id}
        sx={{
          p: 2,
          borderRadius: 2,
          backgroundColor: '#f8fafc',
          border: '1px solid rgba(148, 163, 184, 0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          transition: 'all 0.2s ease',
          cursor: 'pointer',
          '&:hover': {
            backgroundColor: '#f1f5f9',
            borderColor: 'rgba(15, 118, 110, 0.3)',
          },
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0 }}>
          <Avatar
            sx={{
              width: 36,
              height: 36,
              fontSize: '0.8rem',
              fontWeight: 600,
              bgcolor: '#0f766e',
              flexShrink: 0,
            }}
          >
            {assigneeInitials}
          </Avatar>

          <Box sx={{ minWidth: 0 }}>
            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
              {task.name}
            </Typography>
            <Typography variant="caption" color="text.secondary" noWrap>
              {task.project_name}
            </Typography>
          </Box>
        </Box>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}>
          <Chip
            label={task.stage}
            size="small"
            sx={{
              backgroundColor: stageColors[task.stage]?.bg || '#e0e7ff',
              color: stageColors[task.stage]?.text || '#3730a3',
              fontWeight: 500,
              fontSize: '0.75rem',
            }}
          />
          <Typography variant="caption" color="text.secondary">
            {dateText}
          </Typography>
        </Box>
      </Box>
    );
  };

  return (
    <Box sx={{ p: 4, backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      {/* Header + Toggle on opposite side */}
      <Box
        sx={{
          mb: 4,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          gap: 2,
        }}
      >
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1, color: '#0f172a' }}>
            Welcome back, {user?.first_name} {user?.last_name}! 👋
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Here's what's happening with your projects today.
          </Typography>
        </Box>

        {/* Toggle */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            gap: 1,
            mt: 0.5,
            p: 1,
            borderRadius: 2,
            border: '1px solid rgba(148, 163, 184, 0.25)',
            backgroundColor: '#ffffff',
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 800, opacity: dateMode === 'due' ? 1 : 0.45 }}>
            Due
          </Typography>
          <Switch
            checked={dateMode === 'target'}
            onChange={(e) => setDateMode(e.target.checked ? 'target' : 'due')}
            sx={iphoneSwitchSx}
          />
          <Typography variant="caption" sx={{ fontWeight: 800, opacity: dateMode === 'target' ? 1 : 0.45 }}>
            Target
          </Typography>
        </Box>
      </Box>

      {/* ✅ Scorecards: 7 in one line on desktop + equal widths */}
      <Box
        sx={{
          mb: 4,
          display: 'grid',
          gap: 3,
          gridTemplateColumns: {
            xs: 'repeat(1, 1fr)',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(7, 1fr)', // ✅ one line for 7 cards
          },
        }}
      >
        {statCards.map((stat, index) => (
          <Card
            key={index}
            elevation={0}
            sx={{
              height: SCORECARD_HEIGHT, // ✅ fixed same size
              minWidth: 0, // ✅ prevents weird width expansion
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: 3,
              transition: 'all 0.3s ease',
              cursor: 'pointer',
              background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
              '&:hover': {
                transform: 'translateY(-6px)',
                boxShadow: '0 16px 48px rgba(15, 23, 42, 0.12)',
                borderColor: stat.color,
              },
            }}
          >
            <CardContent
              sx={{
                p: 3,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2.5,
                    backgroundColor: stat.bgColor,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: stat.color,
                    flexShrink: 0,
                  }}
                >
                  {stat.icon}
                </Box>
              </Box>

              <Box sx={{ minWidth: 0 }}>
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: '#0f172a' }}>
                  {stat.value}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: 500, lineHeight: 1.2 }}
                >
                  {stat.title}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Upcoming Tasks (shows ALL dated tasks, sorted old -> new) */}
      <Paper
        elevation={0}
        sx={{
          p: 3,
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: 3,
          height: FIXED_TASK_BOX_HEIGHT,
          display: 'flex',
          flexDirection: 'column',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Upcoming Tasks ({dateMode === 'due' ? 'Due Date' : 'Target Date'})
          </Typography>

          <Chip
            label="View all"
            size="small"
            onClick={() => onNavigate('projects')}
            sx={{
              cursor: 'pointer',
              '&:hover': { backgroundColor: 'rgba(15, 118, 110, 0.1)' },
            }}
          />
        </Box>

        <Box sx={{ flex: 1, overflowY: 'auto', pr: 0.5, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {upcomingTasks.length === 0 ? (
            <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
              No tasks with {dateMode === 'due' ? 'due date' : 'target date'} set
            </Typography>
          ) : (
            upcomingTasks.map(renderTaskRow)
          )}
        </Box>
      </Paper>

      <Grid container spacing={3}>
        {/* Widgets Row */}
        <Grid item xs={12}>
          <Grid container spacing={3}>
            {/* Project Progress Widget */}
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: 3,
                  mb: 3,
                  height: 'auto',
                }}
              >
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    Top Projects
                  </Typography>
                  <Chip
                    icon={<TrendingUpIcon sx={{ fontSize: '1rem !important' }} />}
                    label="By tasks"
                    size="small"
                    sx={{
                      backgroundColor: 'rgba(15, 118, 110, 0.1)',
                      color: '#0f766e',
                      fontWeight: 500,
                    }}
                  />
                </Box>

                {topProjects.length === 0 ? (
                  <Box sx={{ textAlign: 'center', py: 4 }}>
                    <FolderIcon sx={{ fontSize: 48, color: 'text.secondary', opacity: 0.3, mb: 1 }} />
                    <Typography variant="body2" color="text.secondary">
                      No projects yet
                    </Typography>
                  </Box>
                ) : (
                  topProjects.map((project, index) => {
                    const progress =
                      project.taskCount > 0
                        ? Math.round((project.completedCount / project.taskCount) * 100)
                        : 0;

                    const colors = ['#0f766e', '#7c3aed', '#f59e0b', '#ef4444', '#06b6d4'];
                    const color = colors[index % colors.length];

                    return (
                      <Box key={project.id} sx={{ mb: 3 }}>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <Box
                              sx={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                backgroundColor: color,
                              }}
                            />
                            <Typography variant="body2" sx={{ fontWeight: 600, color: '#0f172a' }}>
                              {project.name}
                            </Typography>
                          </Box>
                          <Typography variant="body2" sx={{ fontWeight: 600, color: color }}>
                            {progress}%
                          </Typography>
                        </Box>

                        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                          <Typography variant="caption" color="text.secondary">
                            {project.completedCount} of {project.taskCount} tasks
                          </Typography>
                        </Box>

                        <LinearProgress
                          variant="determinate"
                          value={progress}
                          sx={{
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: `${color}15`,
                            '& .MuiLinearProgress-bar': {
                              borderRadius: 3,
                              backgroundColor: color,
                            },
                          }}
                        />
                      </Box>
                    );
                  })
                )}
              </Paper>
            </Grid>

            {/* Quick Actions Widget */}
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: 3,
                  mb: 3,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  Quick Actions
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: '#f0fdf4',
                      border: '1px solid #86efac',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#dcfce7',
                        transform: 'translateX(4px)',
                      },
                    }}
                    onClick={() => onNavigate('projects')}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#166534' }}>
                      📁 Create New Project
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: '#eff6ff',
                      border: '1px solid #93c5fd',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#dbeafe',
                        transform: 'translateX(4px)',
                      },
                    }}
                    onClick={() => onNavigate('projects')}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#1e40af' }}>
                      ✅ Add New Task
                    </Typography>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      backgroundColor: '#fef3c7',
                      border: '1px solid #fcd34d',
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                      '&:hover': {
                        backgroundColor: '#fde68a',
                        transform: 'translateX(4px)',
                      },
                    }}
                    onClick={() => onNavigate('approvals')}
                  >
                    <Typography variant="body2" sx={{ fontWeight: 600, color: '#92400e' }}>
                      ⏰ Pending Approvals
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>

            {/* Workspace Info Widget */}
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  border: '1px solid rgba(148, 163, 184, 0.15)',
                  borderRadius: 3,
                  background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                  color: 'white',
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
                  {workspace?.name || 'My Workspace'}
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Avatar
                      sx={{
                        width: 32,
                        height: 32,
                        bgcolor: 'rgba(255, 255, 255, 0.2)',
                        fontSize: '0.875rem',
                      }}
                    >
                      {user?.first_name?.[0]}
                      {user?.last_name?.[0]}
                    </Avatar>

                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {user?.first_name} {user?.last_name}
                      </Typography>
                      <Typography variant="caption" sx={{ opacity: 0.9 }}>
                        {user?.role || 'Member'}
                      </Typography>
                    </Box>
                  </Box>

                  <Box sx={{ pt: 2, borderTop: '1px solid rgba(255, 255, 255, 0.2)' }}>
                    <Typography variant="caption" sx={{ opacity: 0.9 }}>
                      License: {user?.license_type || 'Free'}
                    </Typography>
                  </Box>
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
