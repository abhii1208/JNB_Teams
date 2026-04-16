import React from 'react';
import {
  Box,
  Button,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  LinearProgress,
  Avatar,
  Chip,
  Switch,
  Stack,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AssignmentIcon from '@mui/icons-material/Assignment';
import AssignmentLateIcon from '@mui/icons-material/AssignmentLate';
import { acceptRuleBook, getApprovalCount, getCorporateEvents, getCurrentRuleBook, getNewsTopics, getProjects, getTodaysBirthdays, listWorkspaceAnnouncements } from '../../apiClient';
import api from '../../apiClient';
import JnbChatbotPanel from './JnbChatbotPanel';
import { 
  isTodayIST, 
  isTomorrowIST, 
  formatDateIST, 
  getNowIST,
  isPastIST 
} from '../../utils/dateUtils';

// Date utility functions
const stageColors = {
  Planned: { bg: '#e0e7ff', text: '#3730a3' },
  'In-process': { bg: '#fef3c7', text: '#92400e' },
  Completed: { bg: '#d1fae5', text: '#065f46' },
  Dropped: { bg: '#fee2e2', text: '#991b1b' },
  'On-hold': { bg: '#f3e8ff', text: '#6b21a8' },
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

  if (isTodayIST(d)) return `${labelPrefix} Today`;
  if (isTomorrowIST(d)) return `${labelPrefix} Tomorrow`;
  return `${labelPrefix} ${formatDateIST(d, 'MMM d, yyyy')}`;
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
  const [todaysBirthdays, setTodaysBirthdays] = React.useState([]);
  const [upcomingEvents, setUpcomingEvents] = React.useState([]);
  const [newsTopics, setNewsTopics] = React.useState([]);
  const [announcements, setAnnouncements] = React.useState([]);
  const [ruleBook, setRuleBook] = React.useState(null);
  const [ruleBookTimer, setRuleBookTimer] = React.useState(120);
  const [ruleBookScrolled, setRuleBookScrolled] = React.useState(false);
  const [ruleBookDialogOpen, setRuleBookDialogOpen] = React.useState(false);

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

        const [birthdaysResponse, ruleBookResponse, eventsResponse, newsTopicsResponse, announcementsResponse] = await Promise.allSettled([
          getTodaysBirthdays(workspace.id),
          getCurrentRuleBook(workspace.id),
          getCorporateEvents(workspace.id),
          getNewsTopics(workspace.id),
          listWorkspaceAnnouncements(workspace.id),
        ]);

        if (birthdaysResponse.status === 'fulfilled') {
          setTodaysBirthdays(birthdaysResponse.value.data || []);
        }

        if (ruleBookResponse.status === 'fulfilled') {
          const currentRuleBook = ruleBookResponse.value.data || null;
          setRuleBook(currentRuleBook);
          setRuleBookTimer(currentRuleBook?.timer_seconds || 120);
        }

        if (eventsResponse.status === 'fulfilled') {
          const nextEvents = (eventsResponse.value.data || [])
            .filter((event) => event?.event_start)
            .sort((a, b) => new Date(a.event_start) - new Date(b.event_start))
            .slice(0, 3);
          setUpcomingEvents(nextEvents);
        }

        if (newsTopicsResponse.status === 'fulfilled') {
          setNewsTopics((newsTopicsResponse.value.data || []).filter((topic) => topic.is_active !== false).slice(0, 6));
        }

        if (announcementsResponse.status === 'fulfilled') {
          setAnnouncements((announcementsResponse.value.data?.announcements || []).slice(0, 3));
        }

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

  React.useEffect(() => {
    if (!ruleBook || ruleBook.accepted_at || ruleBookTimer <= 0) return undefined;
    const interval = window.setInterval(() => {
      setRuleBookTimer((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => window.clearInterval(interval);
  }, [ruleBook, ruleBookTimer]);

  // Stats for scorecards (toggle applies here)
  const stats = React.useMemo(() => {
    const todayIST = getNowIST();
    const tomorrowTime = new Date(todayIST.getTime() + 24 * 60 * 60 * 1000);
    const day3Time = new Date(todayIST.getTime() + 3 * 24 * 60 * 60 * 1000);

    const modeLabel = dateMode === 'due' ? 'Due' : 'Target';

    const tasks = (allTasks || []).filter(isActiveTask);

    const getD = (t) => safeDate(getModeDate(t, dateMode));

    const countToday = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      return isTodayIST(d);
    }).length;

    const countTomorrow = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      return isTomorrowIST(d);
    }).length;

    // Soon = after tomorrow up to next 3 days
    const countSoon = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      const taskTime = new Date(d).getTime();
      return taskTime > tomorrowTime.getTime() && taskTime <= day3Time.getTime();
    }).length;

    const countOverdue = tasks.filter((t) => {
      const d = getD(t);
      if (!d) return false;
      return isPastIST(d) && !isTodayIST(d);
    }).length;

    const countNoDate = tasks.filter((t) => !getD(t)).length;

    return { modeLabel, countToday, countTomorrow, countSoon, countOverdue, countNoDate };
  }, [allTasks, dateMode]);

  const dateField = dateMode === 'due' ? 'due_date' : 'target_date';
  // Upcoming list:
  // ✅ show ALL tasks that have due/target date filled (based on toggle)
  // ✅ sort old -> new (earliest -> latest), includes overdue at top
  // ✅ hide completed tasks
  const upcomingTasks = React.useMemo(() => {
    const tasks = (allTasks || []).filter(isActiveTask);

    // Deduplicate tasks by ID
    const uniqueTasks = Array.from(
      new Map(tasks.map(task => [task.id, task])).values()
    );

    return uniqueTasks
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
        navigateTo: 'projects',
      },
      {
        title: `Tasks ${modeLabel} Today`,
        value: String(stats.countToday || 0),
        icon: <TaskAltIcon />,
        color: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.1)',
        navigateTo: 'tasks',
        taskFilter: { field: dateField, bucket: 'today' },
      },
      {
        title: `Tasks ${modeLabel} Tomorrow`,
        value: String(stats.countTomorrow || 0),
        icon: <TaskAltIcon />,
        color: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.1)',
        navigateTo: 'tasks',
        taskFilter: { field: dateField, bucket: 'tomorrow' },
      },
      {
        title: `${modeLabel} Soon (3 days)`,
        value: String(stats.countSoon || 0),
        icon: <TrendingUpIcon />,
        color: '#0f766e',
        bgColor: 'rgba(15, 118, 110, 0.1)',
        navigateTo: 'tasks',
        taskFilter: { field: dateField, bucket: 'soon' },
      },
      {
        title: `${modeLabel} Overdue`,
        value: String(stats.countOverdue || 0),
        icon: <AssignmentLateIcon />,
        color: '#dc2626',
        bgColor: 'rgba(220, 38, 38, 0.10)',
        navigateTo: 'tasks',
        taskFilter: { field: dateField, bucket: 'overdue' },
      },
      {
        title: `No ${modeLabel} Date`,
        value: String(stats.countNoDate || 0),
        icon: <AssignmentIcon />,
        color: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
        navigateTo: 'tasks',
        taskFilter: { field: dateField, bucket: 'none' },
      },
      {
        title: 'Pending Approvals',
        value: String(pendingApprovals || 0),
        icon: <PendingActionsIcon />,
        color: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.1)',
        navigateTo: 'approvals',
      },
    ];
  }, [activeProjectsCount, pendingApprovals, stats, dateField]);

  const handleStatCardClick = (stat) => {
    if (!stat?.navigateTo || typeof onNavigate !== 'function') return;
    if (stat.taskFilter) {
      onNavigate(stat.navigateTo, { taskFilter: stat.taskFilter });
      return;
    }
    onNavigate(stat.navigateTo);
  };

  const quickActionCards = [
    {
      title: 'Create Project',
      subtitle: 'Set up a new workspace stream',
      tone: '#166534',
      background: '#f0fdf4',
      border: '#86efac',
      onClick: () => onNavigate('projects'),
    },
    {
      title: 'Add Task',
      subtitle: 'Capture and assign work quickly',
      tone: '#1d4ed8',
      background: '#eff6ff',
      border: '#93c5fd',
      onClick: () => onNavigate('tasks'),
    },
    {
      title: 'Review Approvals',
      subtitle: 'Clear pending decisions for the team',
      tone: '#92400e',
      background: '#fef3c7',
      border: '#fcd34d',
      onClick: () => onNavigate('approvals'),
    },
  ];

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
    <Box sx={{ p: { xs: 0.5, sm: 3, lg: 4 }, backgroundColor: 'transparent', minHeight: '100%' }}>
      {/* Header + Toggle on opposite side */}
      <Paper
        sx={{
          mb: { xs: 2, sm: 4 },
          p: { xs: 2.25, sm: 3 },
          borderRadius: { xs: 4, sm: 3 },
          border: '1px solid rgba(148, 163, 184, 0.12)',
          background: 'linear-gradient(135deg, #0f766e 0%, #0891b2 100%)',
          color: '#ffffff',
          boxShadow: '0 20px 44px rgba(15, 23, 42, 0.12)',
        }}
      >
      <Box
        sx={{
          display: 'flex',
          alignItems: { xs: 'stretch', sm: 'flex-start' },
          justifyContent: 'space-between',
          gap: 2,
          flexDirection: { xs: 'column', sm: 'row' },
        }}
      >
        <Box>
          <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', opacity: 0.82, mb: 0.8 }}>
            TODAY&apos;S OVERVIEW
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.75, color: '#ffffff', fontSize: { xs: '1.45rem', sm: '2.125rem' }, lineHeight: { xs: 1.16, sm: 1.2 }, maxWidth: { xs: '14ch', sm: 'none' } }}>
            Welcome back, {user?.first_name} {user?.last_name}!
          </Typography>
          <Typography variant="body1" sx={{ fontSize: { xs: '0.9rem', sm: '1rem' }, maxWidth: { xs: 240, sm: 'none' }, lineHeight: 1.45, color: 'rgba(255,255,255,0.88)' }}>
            Here&apos;s what&apos;s happening with your projects today.
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mt: 1.75, flexWrap: 'wrap', rowGap: 1 }}>
            <Chip
              label={`${activeProjectsCount || 0} active projects`}
              size="small"
              sx={{
                backgroundColor: 'rgba(255,255,255,0.16)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            />
            <Chip
              label={`${pendingApprovals || 0} pending approvals`}
              size="small"
              sx={{
                backgroundColor: 'rgba(255,255,255,0.12)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.14)',
              }}
            />
          </Stack>
        </Box>

        {/* Toggle */}
        <Box
          sx={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: { xs: 'space-between', sm: 'flex-start' },
            gap: 1,
            mt: 0.5,
            p: 1,
            borderRadius: 2,
            border: '1px solid rgba(255,255,255,0.16)',
            backgroundColor: 'rgba(255,255,255,0.08)',
            width: { xs: '100%', sm: 'auto' },
          }}
        >
          <Typography variant="caption" sx={{ fontWeight: 800, opacity: dateMode === 'due' ? 1 : 0.45, color: '#ffffff' }}>
            Due
          </Typography>
          <Switch
            checked={dateMode === 'target'}
            onChange={(e) => setDateMode(e.target.checked ? 'target' : 'due')}
            sx={iphoneSwitchSx}
          />
          <Typography variant="caption" sx={{ fontWeight: 800, opacity: dateMode === 'target' ? 1 : 0.45, color: '#ffffff' }}>
            Target
          </Typography>
        </Box>
      </Box>

      {/* ✅ Scorecards: 7 in one line on desktop + equal widths */}
      </Paper>
      <Box
        sx={{
          mb: 3.5,
          display: 'grid',
          gap: { xs: 1.25, sm: 3 },
          gridTemplateColumns: {
            xs: 'repeat(2, minmax(0, 1fr))',
            sm: 'repeat(2, 1fr)',
            md: 'repeat(7, 1fr)', // ✅ one line for 7 cards
          },
        }}
      >
        {statCards.map((stat, index) => (
          <Card
            key={index}
            elevation={0}
            onClick={() => handleStatCardClick(stat)}
            sx={{
              height: { xs: 156, md: SCORECARD_HEIGHT },
              minWidth: 0, // ✅ prevents weird width expansion
              border: '1px solid rgba(148, 163, 184, 0.15)',
              borderRadius: { xs: 3.5, sm: 3 },
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
                p: { xs: 2, sm: 3 },
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Box
                  sx={{
                    width: { xs: 44, sm: 56 },
                    height: { xs: 44, sm: 56 },
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
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5, color: '#0f172a', fontSize: { xs: '1.7rem', sm: '3rem' } }}>
                  {stat.value}
                </Typography>
                <Typography
                  variant="body2"
                  color="text.secondary"
                  sx={{ fontWeight: 600, lineHeight: 1.25, fontSize: { xs: '0.76rem', sm: '0.875rem' } }}
                >
                  {stat.title}
                </Typography>
              </Box>
            </CardContent>
          </Card>
        ))}
      </Box>

      {/* Upcoming Tasks (shows ALL dated tasks, sorted old -> new) */}
      {todaysBirthdays.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 3,
            border: '1px solid rgba(251, 191, 36, 0.28)',
            background: 'linear-gradient(135deg, #fff7ed 0%, #fffbeb 100%)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.5 }}>
            Birthday Reminder
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {todaysBirthdays.map((person) => person.user_name).join(', ')} {todaysBirthdays.length === 1 ? 'has' : 'have'} a birthday today.
          </Typography>
        </Paper>
      )}

      {upcomingEvents.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 3,
            border: '1px solid rgba(14, 165, 233, 0.22)',
            background: 'linear-gradient(135deg, #eff6ff 0%, #f8fafc 100%)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Corporate Events
          </Typography>
          <Stack spacing={1}>
            {upcomingEvents.map((event) => (
              <Box key={event.id} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {event.title}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {event.location || event.category || 'Internal event'}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  {formatDateIST(event.event_start, 'MMM d, yyyy h:mm a')}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {newsTopics.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 3,
            border: '1px solid rgba(15, 118, 110, 0.18)',
            background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fafc 100%)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            News Watchlist
          </Typography>
          <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
            {newsTopics.map((topic) => (
              <Chip
                key={topic.id}
                label={`${topic.topic}${topic.category ? ` • ${topic.category}` : ''}`}
                size="small"
                sx={{ backgroundColor: 'rgba(15, 118, 110, 0.08)', color: '#0f766e', fontWeight: 600 }}
              />
            ))}
          </Stack>
        </Paper>
      )}

      {announcements.length > 0 && (
        <Paper
          elevation={0}
          sx={{
            p: { xs: 2, sm: 2.5 },
            mb: 3,
            borderRadius: 3,
            border: '1px solid rgba(99, 102, 241, 0.18)',
            background: 'linear-gradient(135deg, #eef2ff 0%, #f8fafc 100%)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Announcements
          </Typography>
          <Stack spacing={1.25}>
            {announcements.map((announcement) => (
              <Box key={announcement.id}>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>
                  {announcement.title}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {announcement.category || 'Update'}{announcement.creator_name ? ` • ${announcement.creator_name}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {announcement.description}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Paper>
      )}

      {!workspace?.is_personal && workspace?.name !== 'Personal' ? (
        <JnbChatbotPanel workspace={workspace} user={user} />
      ) : null}

      <Paper
        elevation={0}
        sx={{
          p: { xs: 2, sm: 3 },
          border: '1px solid rgba(148, 163, 184, 0.15)',
          borderRadius: 3,
          height: { xs: 'auto', md: FIXED_TASK_BOX_HEIGHT },
          minHeight: { xs: 320, md: FIXED_TASK_BOX_HEIGHT },
          display: 'flex',
          flexDirection: 'column',
          mb: 3,
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, gap: 1, flexWrap: 'wrap' }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Upcoming Tasks ({dateMode === 'due' ? 'Due Date' : 'Target Date'})
          </Typography>

          <Chip
            label="View all"
            size="small"
            onClick={() => onNavigate('tasks')}
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
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.75 }}>
                  Quick Actions
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Jump straight into the actions your team uses most.
                </Typography>

                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                  {quickActionCards.map((action) => (
                    <Box
                      key={action.title}
                      sx={{
                        p: 2,
                        borderRadius: 2.5,
                        backgroundColor: action.background,
                        border: `1px solid ${action.border}`,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          transform: 'translateX(4px)',
                          boxShadow: '0 10px 24px rgba(15, 23, 42, 0.08)',
                        },
                      }}
                      onClick={action.onClick}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 700, color: action.tone }}>
                        {action.title}
                      </Typography>
                      <Typography variant="caption" sx={{ color: action.tone, opacity: 0.8 }}>
                        {action.subtitle}
                      </Typography>
                    </Box>
                  ))}
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

                  {ruleBook ? (
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => setRuleBookDialogOpen(true)}
                      sx={{
                        mt: 1,
                        alignSelf: 'flex-start',
                        color: '#fff',
                        borderColor: 'rgba(255,255,255,0.28)',
                        '&:hover': { borderColor: 'rgba(255,255,255,0.45)' },
                      }}
                    >
                      View Rule Book
                    </Button>
                  ) : null}
                </Box>
              </Paper>
            </Grid>
          </Grid>
        </Grid>
      </Grid>

      <Dialog
        open={Boolean(ruleBook && ((ruleBook.mandatory && !ruleBook.accepted_at) || ruleBookDialogOpen))}
        maxWidth="md"
        fullWidth
        onClose={() => {
          if (!(ruleBook?.mandatory && !ruleBook?.accepted_at)) {
            setRuleBookDialogOpen(false);
          }
        }}
      >
        <DialogTitle>Rule Book Acknowledgement</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
            Please review the current policy before continuing. Acceptance is enabled after the 2 minute timer and full scroll.
          </Typography>
          <Box
            onScroll={(event) => {
              const target = event.currentTarget;
              if (target.scrollTop + target.clientHeight >= target.scrollHeight - 8) {
                setRuleBookScrolled(true);
              }
            }}
            sx={{
              maxHeight: 360,
              overflowY: 'auto',
              p: 2,
              borderRadius: 2,
              border: '1px solid rgba(148,163,184,0.2)',
              whiteSpace: 'pre-wrap',
              backgroundColor: '#fff',
            }}
          >
            {ruleBook?.content || 'No rule book content available.'}
          </Box>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1.5, display: 'block' }}>
            Timer remaining: {ruleBookTimer}s • Scroll completed: {ruleBookScrolled ? 'Yes' : 'No'}
          </Typography>
        </DialogContent>
        <DialogActions>
          {!(ruleBook?.mandatory && !ruleBook?.accepted_at) ? (
            <Button onClick={() => setRuleBookDialogOpen(false)}>Close</Button>
          ) : null}
          <Button
            variant="contained"
            disabled={Boolean(ruleBook?.accepted_at) || ruleBookTimer > 0 || !ruleBookScrolled}
            onClick={async () => {
              await acceptRuleBook(ruleBook.id, { scroll_completed: true, timer_completed: true });
              const refreshed = await getCurrentRuleBook(workspace.id);
              setRuleBook(refreshed.data || null);
              setRuleBookDialogOpen(false);
            }}
          >
            {ruleBook?.accepted_at ? 'Accepted' : 'Accept'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default Dashboard;
