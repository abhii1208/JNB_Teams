import React from 'react';
import {
  Avatar,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import {
  askWorkspaceAssistant,
  getCorporateEvents,
  getHelpQueries,
  getNewsTopics,
  getProjects,
  getServices,
  getWorkspaceTasks,
} from '../../apiClient';

const DEFAULT_SUGGESTIONS = [
  'Daily workspace update',
  'What deadlines are at risk?',
  'Show team workload',
  'Summarize open help queries',
  'Which project needs attention?',
  'What events are coming up?',
];

const buildWelcomeMessage = (workspaceName) => ({
  id: `assistant-${Date.now()}`,
  role: 'assistant',
  content: `Hi, I'm JNB chatbot. I can analyze your app data for ${workspaceName || 'your workspace'} and help with project status, workload, deadlines, services, events, and helpdesk summaries.`,
});

const safeDate = (value) => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const formatShortDate = (value) => {
  const date = safeDate(value);
  return date ? date.toISOString().slice(0, 10) : 'no date';
};

const isCompletedTask = (task) =>
  ['Closed', 'Completed'].includes(String(task.status || '')) || String(task.stage || '') === 'Completed';

const getTaskAssigneeName = (task) =>
  String(task.assignee_name || task.assignee?.name || 'Unassigned').trim() || 'Unassigned';

const summarizeTaskLoad = (tasks) => {
  const byPerson = new Map();
  tasks.forEach((task) => {
    const person = getTaskAssigneeName(task);
    byPerson.set(person, (byPerson.get(person) || 0) + 1);
  });
  return Array.from(byPerson.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, count]) => `${name}: ${count}`)
    .join('; ');
};

const buildSmartWorkspaceReply = (context, message) => {
  const lower = String(message || '').toLowerCase();
  const tasks = context.tasks;
  const activeTasks = tasks.filter((task) => !isCompletedTask(task));
  const completedTasks = tasks.filter(isCompletedTask);
  const overdueTasks = activeTasks.filter((task) => {
    const dueDate = safeDate(task.due_date);
    return dueDate && dueDate.getTime() < Date.now();
  });
  const dueSoonTasks = activeTasks.filter((task) => {
    const dueDate = safeDate(task.due_date);
    if (!dueDate) return false;
    const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    return diffDays >= 0 && diffDays <= 7;
  });
  const topProjects = context.projects
    .map((project) => ({
      ...project,
      taskCount: tasks.filter((task) => Number(task.project_id) === Number(project.id)).length,
    }))
    .sort((a, b) => b.taskCount - a.taskCount)
    .slice(0, 3);
  const openQueries = context.helpQueries.filter(
    (query) => !['closed', 'resolved'].includes(String(query.status || '').toLowerCase())
  );
  const nextEvents = context.events
    .filter((event) => {
      const eventDate = safeDate(event.event_start);
      return eventDate && eventDate.getTime() >= Date.now();
    })
    .sort((a, b) => safeDate(a.event_start) - safeDate(b.event_start))
    .slice(0, 3);
  const likelyProject = context.projects.find((project) =>
    lower.includes(String(project.name || '').toLowerCase())
  );
  const likelyService = context.services.find((service) =>
    lower.includes(String(service.name || '').toLowerCase())
  );
  const likelyTask = tasks.find((task) => lower.includes(String(task.name || '').toLowerCase()));

  if (lower.includes('finance') || lower.includes('news')) {
    if (context.newsTopics.length) {
      return `Smart workspace mode is limited to app data, so I cannot fetch live external news here. Your configured watchlist topics are ${context.newsTopics.slice(0, 5).map((topic) => topic.topic).join(', ')}. I can still summarize workspace risks, project status, and team workload from current app data.`;
    }
    return 'Smart workspace mode is limited to app data, so I cannot fetch live external news here yet. I can still produce project, task, deadline, workload, service, and helpdesk intelligence from your workspace data.';
  }

  if (likelyTask && (lower.includes('task') || lower.includes('status') || lower.includes('update') || lower.includes('summary'))) {
    return [
      `${likelyTask.name} is currently in ${likelyTask.stage || likelyTask.status || 'an active state'} in ${likelyTask.project_name || 'its project'}.`,
      `Priority is ${likelyTask.priority || 'not set'}, due date is ${formatShortDate(likelyTask.due_date)}, and the assignee is ${getTaskAssigneeName(likelyTask)}.`,
      likelyTask.description
        ? `Context: ${String(likelyTask.description).slice(0, 220)}.`
        : 'This task would benefit from a fuller description or next-step note if the team needs more clarity.',
    ].join(' ');
  }

  if (likelyProject || lower.includes('project')) {
    const project = likelyProject || topProjects[0];
    const projectTasks = tasks.filter((task) => Number(task.project_id) === Number(project?.id));
    const projectActive = projectTasks.filter((task) => !isCompletedTask(task));
    const projectOverdue = projectActive.filter((task) => {
      const dueDate = safeDate(task.due_date);
      return dueDate && dueDate.getTime() < Date.now();
    });

    return [
      `${project?.name || 'This project'} has ${projectTasks.length || 0} tasks in current workspace data, with ${projectActive.length || 0} still active.`,
      projectOverdue.length
        ? `Current risk items are ${projectOverdue.slice(0, 3).map((task) => `${task.name} due ${formatShortDate(task.due_date)}`).join('; ')}.`
        : 'There are no overdue tasks flagged for this project right now.',
      projectActive.length
        ? `Immediate focus items are ${projectActive.slice(0, 3).map((task) => `${task.name} (${task.stage || task.status || 'open'})`).join('; ')}.`
        : 'The project currently has no active work items in scope.',
    ].join(' ');
  }

  if (likelyService || lower.includes('service')) {
    if (!context.services.length) {
      return `There are no active services configured yet in ${context.workspaceName}.`;
    }

    const service = likelyService || context.services[0];
    const relatedTasks = tasks.filter(
      (task) => String(task.service_name || '').toLowerCase() === String(service.name || '').toLowerCase()
    );

    return [
      `${service.name} is ${service.status || 'active'}${service.category ? ` in the ${service.category} category` : ''}.`,
      `${relatedTasks.length} tasks in current workspace data are linked to this service.`,
      relatedTasks.length
        ? `Recent linked tasks include ${relatedTasks.slice(0, 3).map((task) => `${task.name} (${task.project_name})`).join('; ')}.`
        : 'No active tasks are linked to this service right now.',
    ].join(' ');
  }

  if (lower.includes('help') || lower.includes('query') || lower.includes('support')) {
    return [
      `${openQueries.length} helpdesk queries are still open in ${context.workspaceName}.`,
      openQueries.length
        ? `Current open items include ${openQueries.slice(0, 3).map((query) => `${query.title} [${query.priority || 'normal'} / ${query.status || 'open'}]`).join('; ')}.`
        : 'There are no unresolved helpdesk items right now.',
    ].join(' ');
  }

  if (lower.includes('event') || lower.includes('meeting') || lower.includes('calendar')) {
    return nextEvents.length
      ? `Upcoming events are ${nextEvents.map((event) => `${event.title} on ${formatShortDate(event.event_start)}${event.location ? ` at ${event.location}` : ''}`).join('; ')}.`
      : `There are no upcoming corporate events scheduled in ${context.workspaceName} right now.`;
  }

  if (lower.includes('deadline') || lower.includes('overdue') || lower.includes('risk')) {
    if (!overdueTasks.length && !dueSoonTasks.length) {
      return `There are no immediate deadline risks in ${context.workspaceName} based on current app data.`;
    }

    return [
      `Deadline risk summary for ${context.workspaceName}:`,
      overdueTasks.length
        ? `Overdue tasks: ${overdueTasks.slice(0, 4).map((task) => `${task.name} (${task.project_name}, due ${formatShortDate(task.due_date)})`).join('; ')}.`
        : 'No overdue tasks detected.',
      dueSoonTasks.length
        ? `Due within 7 days: ${dueSoonTasks.slice(0, 4).map((task) => `${task.name} (${task.project_name}, due ${formatShortDate(task.due_date)})`).join('; ')}.`
        : 'No near-term deadline tasks detected.',
    ].join(' ');
  }

  if (lower.includes('team') || lower.includes('workload') || lower.includes('who')) {
    return [
      `Current workload snapshot for ${context.workspaceName}:`,
      summarizeTaskLoad(activeTasks) || 'No active task ownership data is available right now.',
      overdueTasks.length
        ? `Overdue work is concentrated in ${summarizeTaskLoad(overdueTasks)}.`
        : 'No overdue workload concentration is visible right now.',
    ].join(' ');
  }

  if (lower.includes('daily') || lower.includes('update') || lower.includes('summary') || lower.includes('status')) {
    return [
      `Workspace update for ${context.workspaceName}:`,
      `${context.projects.length} active projects, ${activeTasks.length} active tasks, and ${completedTasks.length} completed tasks are currently in scope.`,
      topProjects.length
        ? `Most active projects: ${topProjects.map((project) => `${project.name} (${project.taskCount} tasks)`).join('; ')}.`
        : 'No project activity is visible right now.',
      overdueTasks.length
        ? `Top risks: ${overdueTasks.slice(0, 3).map((task) => `${task.name} in ${task.project_name}`).join('; ')}.`
        : 'No overdue task risks are currently flagged.',
      openQueries.length ? `${openQueries.length} support queries are awaiting resolution.` : 'Support queue is clear.',
    ].join(' ');
  }

  return [
    `I’m in smart workspace mode for ${context.workspaceName}, using only secure app data.`,
    `${context.projects.length} projects, ${activeTasks.length} active tasks, ${context.services.length} services, ${openQueries.length} open help queries, and ${nextEvents.length} upcoming events are currently available.`,
    'Ask me for a daily update, deadline risks, project status, workload summary, service overview, helpdesk status, or upcoming events.',
  ].join(' ');
};

const buildLocalFallbackReply = async (workspaceId, workspaceName, message) => {
  const [projectsResult, tasksResult, servicesResult, helpQueriesResult, eventsResult, newsTopicsResult] = await Promise.allSettled([
    getProjects(workspaceId, false),
    getWorkspaceTasks(workspaceId, { limit: 200, hide_completed: 'false' }),
    getServices(workspaceId, { status: 'active' }),
    getHelpQueries(workspaceId),
    getCorporateEvents(workspaceId),
    getNewsTopics(workspaceId),
  ]);

  const projects = projectsResult.status === 'fulfilled'
    ? (Array.isArray(projectsResult.value.data) ? projectsResult.value.data.filter((project) => !project.archived) : [])
    : [];
  const taskPayload = tasksResult.status === 'fulfilled' ? tasksResult.value.data : null;
  const tasks = Array.isArray(taskPayload?.tasks) ? taskPayload.tasks : [];
  const services = servicesResult.status === 'fulfilled' ? (servicesResult.value.data || []) : [];
  const helpQueries = helpQueriesResult.status === 'fulfilled' ? (helpQueriesResult.value.data || []) : [];
  const events = eventsResult.status === 'fulfilled' ? (eventsResult.value.data || []) : [];
  const newsTopics = newsTopicsResult.status === 'fulfilled' ? (newsTopicsResult.value.data || []) : [];

  if (!projects.length && !tasks.length) {
    return `I could not find enough workspace data to summarize ${workspaceName || 'this workspace'} yet.`;
  }

  return buildSmartWorkspaceReply(
    {
      workspaceName: workspaceName || 'this workspace',
      projects,
      tasks,
      services,
      helpQueries,
      events,
      newsTopics,
    },
    message
  );
};

function JnbChatbotPanel({ workspace, user, floating = false }) {
  const [messages, setMessages] = React.useState(() => [buildWelcomeMessage(workspace?.name)]);
  const [input, setInput] = React.useState('');
  const [loading, setLoading] = React.useState(false);
  const [statusText, setStatusText] = React.useState('');
  const [suggestions, setSuggestions] = React.useState(DEFAULT_SUGGESTIONS);

  React.useEffect(() => {
    setMessages([buildWelcomeMessage(workspace?.name)]);
    setStatusText('');
    setSuggestions(DEFAULT_SUGGESTIONS);
  }, [workspace?.id, workspace?.name]);

  const handleSend = async (value = input) => {
    const message = String(value || '').trim();
    if (!workspace?.id || !message || loading) return;
    setStatusText('');

    const userMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: message,
    };

    const nextMessages = [...messages, userMessage];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const history = nextMessages.slice(-8).map((item) => ({
        role: item.role,
        content: item.content,
      }));

      const response = await askWorkspaceAssistant(workspace.id, {
        message,
        history,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `assistant-${Date.now()}`,
          role: 'assistant',
          content: response.data?.reply || 'I could not generate a response right now.',
        },
      ]);

      if (Array.isArray(response.data?.suggestions) && response.data.suggestions.length > 0) {
        setSuggestions(response.data.suggestions);
      }

      if (response.data?.mode && response.data.mode !== 'provider') {
        setStatusText('Smart workspace mode is active and using secure app data.');
      }
    } catch (error) {
      console.error('JNB chatbot failed:', error);

      try {
        const fallbackReply = await buildLocalFallbackReply(workspace.id, workspace.name, message);
        setStatusText('Smart workspace mode is active and using secure app data.');
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: fallbackReply,
          },
        ]);
      } catch (fallbackError) {
        console.error('JNB chatbot fallback failed:', fallbackError);
        setStatusText(error?.response?.data?.error || error?.message || 'Assistant request failed');
        setMessages((prev) => [
          ...prev,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: 'I could not respond right now. Please try again in a moment.',
          },
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Paper
      elevation={0}
      sx={{
        mb: floating ? 0 : 3,
        p: { xs: 2, md: 2.25 },
        maxWidth: floating ? '100%' : 920,
        mx: floating ? 0 : 'auto',
        border: '1px solid rgba(148, 163, 184, 0.15)',
        borderRadius: 3,
        background: 'linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(240,249,255,0.92) 100%)',
        boxShadow: floating ? '0 20px 45px rgba(15, 23, 42, 0.16)' : 'none',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5, mb: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
          <Avatar sx={{ bgcolor: '#0f766e', width: 42, height: 42 }}>
            <SmartToyIcon sx={{ fontSize: 22 }} />
          </Avatar>
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#0f172a', lineHeight: 1.1 }}>
              JNB chatbot
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Ask about tasks, deadlines, workload, services, helpdesk status, or workspace updates.
            </Typography>
          </Box>
        </Box>

        <Chip
          size="small"
          icon={<AutoAwesomeIcon sx={{ fontSize: '1rem !important' }} />}
          label="Ask AI"
          sx={{
            bgcolor: 'rgba(15,118,110,0.10)',
            color: '#0f766e',
            fontWeight: 700,
          }}
        />
      </Box>

      <Stack direction="row" spacing={0.75} useFlexGap flexWrap="wrap" sx={{ mb: 1.75 }}>
        {suggestions.map((suggestion) => (
          <Chip
            key={suggestion}
            size="small"
            label={suggestion}
            onClick={() => handleSend(suggestion)}
            clickable
            sx={{
              borderRadius: 999,
              bgcolor: '#ffffff',
              border: '1px solid rgba(15,118,110,0.14)',
              '&:hover': {
                bgcolor: 'rgba(15,118,110,0.06)',
              },
            }}
          />
        ))}
      </Stack>

      <Paper
        elevation={0}
        sx={{
          borderRadius: 3,
          border: '1px solid rgba(148, 163, 184, 0.14)',
          backgroundColor: '#ffffff',
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            maxHeight: 240,
            minHeight: 160,
            overflowY: 'auto',
            p: 1.5,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.25,
            background: 'linear-gradient(180deg, rgba(248,250,252,0.75) 0%, rgba(255,255,255,1) 100%)',
          }}
        >
          {messages.map((message) => (
            <Box
              key={message.id}
              sx={{
                display: 'flex',
                justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
              }}
            >
              <Box
                sx={{
                  maxWidth: { xs: '100%', md: '72%' },
                  px: 1.5,
                  py: 1,
                  borderRadius: 3,
                  bgcolor: message.role === 'user' ? '#0f766e' : '#f8fafc',
                  color: message.role === 'user' ? '#ffffff' : '#0f172a',
                  boxShadow: message.role === 'user'
                    ? '0 10px 18px rgba(15,118,110,0.18)'
                    : '0 8px 18px rgba(15,23,42,0.05)',
                  border: message.role === 'assistant' ? '1px solid rgba(148,163,184,0.14)' : 'none',
                }}
              >
                <Typography variant="caption" sx={{ display: 'block', fontWeight: 800, mb: 0.35, opacity: 0.8 }}>
                  {message.role === 'user'
                    ? `${user?.first_name || user?.username || 'You'}`
                    : 'JNB chatbot'}
                </Typography>
                <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                  {message.content}
                </Typography>
              </Box>
            </Box>
          ))}

          {loading && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
              <CircularProgress size={18} />
              <Typography variant="body2">JNB chatbot is thinking...</Typography>
            </Box>
          )}
        </Box>

        <Divider />

        <Box sx={{ p: 1.5, display: 'flex', alignItems: 'flex-end', gap: 1 }}>
          <TextField
            fullWidth
            multiline
            minRows={1}
            maxRows={3}
            size="small"
            placeholder="Ask about tasks, deadlines, project status, workload, services, help queries, or a daily workspace update..."
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                handleSend();
              }
            }}
          />
          <IconButton
            onClick={() => handleSend()}
            disabled={!workspace?.id || !input.trim() || loading}
            sx={{
              width: 44,
              height: 44,
              bgcolor: '#0f766e',
              color: '#ffffff',
              '&:hover': { bgcolor: '#115e59' },
              '&.Mui-disabled': {
                bgcolor: '#cbd5e1',
                color: '#64748b',
              },
            }}
          >
            <SendIcon />
          </IconButton>
        </Box>
      </Paper>

      <Box sx={{ mt: 1.25, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1.5, flexWrap: 'wrap' }}>
        <Typography variant="caption" color={statusText ? 'primary.main' : 'text.secondary'}>
          {statusText || 'Ask for a daily update, deadline risks, workload, service insights, helpdesk summaries, or upcoming events.'}
        </Typography>
        <Button
          size="small"
          variant="text"
          onClick={() => handleSend('Daily workspace update')}
          disabled={!workspace?.id || loading}
        >
          Daily workspace update
        </Button>
      </Box>
    </Paper>
  );
}

export default JnbChatbotPanel;
