const { pool } = require('../db');
const { detectNewsTopic, refreshNewsDigest } = require('./newsDigestService');

const MAX_HISTORY_ITEMS = 10;
const MAX_PROJECTS = 12;
const MAX_TASKS = 80;
const MAX_CHATS = 8;

function normalizeHistory(history = []) {
  if (!Array.isArray(history)) return [];
  return history
    .filter((item) => item && typeof item.role === 'string' && typeof item.content === 'string')
    .slice(-MAX_HISTORY_ITEMS)
    .map((item) => ({
      role: item.role === 'assistant' ? 'assistant' : 'user',
      content: item.content.trim().slice(0, 2000),
    }))
    .filter((item) => item.content);
}

function safeDate(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatDate(value) {
  const date = safeDate(value);
  if (!date) return 'No date';
  return date.toISOString().slice(0, 10);
}

function daysUntil(value) {
  const date = safeDate(value);
  if (!date) return null;
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

function truncate(value, length = 180) {
  const text = String(value || '').trim();
  if (text.length <= length) return text;
  return `${text.slice(0, length - 1)}...`;
}

function buildWorkspaceSummary(context) {
  const overdueTasks = context.tasks.filter((task) => task.isOverdue && !task.isCompleted);
  const dueSoonTasks = context.tasks.filter((task) => {
    const dueInDays = task.dueInDays;
    return !task.isCompleted && dueInDays !== null && dueInDays >= 0 && dueInDays <= 7;
  });
  const completedTasks = context.tasks.filter((task) => task.isCompleted);

  return {
    workspace_name: context.workspace.name,
    project_count: context.projects.length,
    task_count: context.tasks.length,
    completed_task_count: completedTasks.length,
    overdue_task_count: overdueTasks.length,
    due_soon_task_count: dueSoonTasks.length,
    top_projects: context.projects.slice(0, 5).map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      task_count: project.task_count,
      completed_count: project.completed_count,
    })),
    overdue_tasks: overdueTasks.slice(0, 6).map((task) => ({
      id: task.id,
      name: task.name,
      project_name: task.project_name,
      due_date: task.due_date,
      assignee_name: task.assignee_name,
      status: task.status,
      stage: task.stage,
    })),
    due_soon_tasks: dueSoonTasks.slice(0, 6).map((task) => ({
      id: task.id,
      name: task.name,
      project_name: task.project_name,
      due_date: task.due_date,
      assignee_name: task.assignee_name,
      status: task.status,
      stage: task.stage,
    })),
    recent_chat_topics: context.recentChats.map((chat) => ({
      thread_name: chat.thread_name,
      preview: chat.preview,
      updated_at: chat.updated_at,
    })),
  };
}

async function getWorkspaceContext(workspaceId, userId) {
  const workspaceResult = await pool.query(
    `SELECT w.id, w.name
     FROM workspaces w
     JOIN workspace_members wm ON wm.workspace_id = w.id
     WHERE w.id = $1 AND wm.user_id = $2`,
    [workspaceId, userId]
  );

  if (workspaceResult.rows.length === 0) {
    const error = new Error('Access denied to this workspace');
    error.status = 403;
    throw error;
  }

  const workspace = workspaceResult.rows[0];

  const projectsResult = await pool.query(
    `SELECT
      p.id,
      p.name,
      p.status,
      p.archived,
      COUNT(t.id)::int AS task_count,
      COUNT(*) FILTER (
        WHERE t.status IN ('Closed', 'Completed') OR t.stage = 'Completed'
      )::int AS completed_count
     FROM projects p
     LEFT JOIN tasks t
       ON t.project_id = p.id
       AND t.deleted_at IS NULL
     WHERE p.workspace_id = $1
       AND p.archived = FALSE
     GROUP BY p.id
     ORDER BY p.updated_at DESC
     LIMIT $2`,
    [workspaceId, MAX_PROJECTS]
  );

  const tasksResult = await pool.query(
    `SELECT
      t.id,
      t.name,
      t.description,
      t.status,
      t.stage,
      t.priority,
      t.due_date,
      t.target_date,
      t.notes,
      t.completion_percentage,
      p.id AS project_id,
      p.name AS project_name,
      COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''), u.username, 'Unassigned') AS assignee_name
     FROM tasks t
     JOIN projects p ON p.id = t.project_id
     LEFT JOIN users u ON u.id = t.assignee_id
     WHERE p.workspace_id = $1
       AND t.deleted_at IS NULL
       AND t.archived_at IS NULL
     ORDER BY
       CASE WHEN t.due_date IS NULL THEN 1 ELSE 0 END,
       t.due_date ASC NULLS LAST,
       t.updated_at DESC
     LIMIT $2`,
    [workspaceId, MAX_TASKS]
  );

  const recentChatsResult = await pool.query(
    `SELECT
      ct.id,
      COALESCE(NULLIF(ct.name, ''), 'Direct message') AS thread_name,
      ct.type,
      ct.updated_at,
      COALESCE(cm.content, '[Attachment or empty message]') AS preview
     FROM chat_threads ct
     JOIN chat_thread_members ctm
       ON ctm.thread_id = ct.id
       AND ctm.user_id = $2
     LEFT JOIN LATERAL (
       SELECT content
       FROM chat_messages
       WHERE thread_id = ct.id
       ORDER BY created_at DESC
       LIMIT 1
     ) cm ON TRUE
     WHERE ct.workspace_id = $1
     ORDER BY ct.updated_at DESC
     LIMIT $3`,
    [workspaceId, userId, MAX_CHATS]
  );

  const tasks = tasksResult.rows.map((task) => {
    const dueInDays = daysUntil(task.due_date);
    const isCompleted = task.status === 'Closed' || task.status === 'Completed' || task.stage === 'Completed';
    return {
      ...task,
      dueInDays,
      isCompleted,
      isOverdue: dueInDays !== null && dueInDays < 0,
      due_date: task.due_date ? formatDate(task.due_date) : null,
      target_date: task.target_date ? formatDate(task.target_date) : null,
    };
  });

  return {
    workspace,
    projects: projectsResult.rows,
    tasks,
    recentChats: recentChatsResult.rows.map((chat) => ({
      ...chat,
      preview: truncate(chat.preview, 120),
      updated_at: chat.updated_at ? formatDate(chat.updated_at) : null,
    })),
  };
}

function findProjectMention(context, message) {
  const lower = message.toLowerCase();
  return context.projects.find((project) => lower.includes(String(project.name || '').toLowerCase()));
}

function findTaskMention(context, message) {
  const lower = message.toLowerCase();
  return context.tasks.find((task) => lower.includes(String(task.name || '').toLowerCase()));
}

function buildTaskSummary(context) {
  const total = context.tasks.length;
  const completed = context.tasks.filter((task) => task.isCompleted).length;
  const overdue = context.tasks.filter((task) => task.isOverdue && !task.isCompleted);
  const dueSoon = context.tasks.filter((task) => !task.isCompleted && task.dueInDays !== null && task.dueInDays >= 0 && task.dueInDays <= 7);

  const lines = [
    `Here is the task summary for ${context.workspace.name}.`,
    `${total} active task records are in scope, with ${completed} completed and ${overdue.length} overdue.`,
  ];

  if (dueSoon.length > 0) {
    lines.push(
      `The next deadlines are ${dueSoon
        .slice(0, 5)
        .map((task) => `${task.name} (${task.project_name}, due ${task.due_date})`)
        .join('; ')}.`
    );
  }

  if (overdue.length > 0) {
    lines.push(
      `The main overdue tasks are ${overdue
        .slice(0, 5)
        .map((task) => `${task.name} assigned to ${task.assignee_name} (was due ${task.due_date})`)
        .join('; ')}.`
    );
  }

  return lines.join(' ');
}

function buildChatSummary(context) {
  if (context.recentChats.length === 0) {
    return `There are no recent team chats to summarize in ${context.workspace.name}.`;
  }

  return [
    `Here is a short chat summary for ${context.workspace.name}.`,
    ...context.recentChats.slice(0, 5).map((chat) => `${chat.thread_name}: ${chat.preview}`),
  ].join(' ');
}

function buildProjectSummary(project, context) {
  const relatedTasks = context.tasks.filter((task) => Number(task.project_id) === Number(project.id));
  const overdue = relatedTasks.filter((task) => task.isOverdue && !task.isCompleted);
  const dueSoon = relatedTasks.filter((task) => !task.isCompleted && task.dueInDays !== null && task.dueInDays >= 0 && task.dueInDays <= 7);

  const parts = [
    `${project.name} currently has ${project.task_count} tasks in the dashboard data, with ${project.completed_count} completed.`,
  ];

  if (dueSoon.length > 0) {
    parts.push(`Upcoming work: ${dueSoon.slice(0, 4).map((task) => `${task.name} due ${task.due_date}`).join('; ')}.`);
  }
  if (overdue.length > 0) {
    parts.push(`Risks: ${overdue.slice(0, 4).map((task) => `${task.name} overdue since ${task.due_date}`).join('; ')}.`);
  }

  return parts.join(' ');
}

function buildTaskImprovementAdvice(task) {
  const suggestions = [];

  if (!task.description) suggestions.push('add a clearer task description with the expected outcome');
  if (!task.priority) suggestions.push('set an explicit priority so the team can sequence work');
  if (!task.due_date) suggestions.push('add a due date to avoid hidden deadline risk');
  if (!task.assignee_name || task.assignee_name === 'Unassigned') suggestions.push('assign an owner so progress is accountable');
  if (!task.notes) suggestions.push('capture notes or acceptance criteria for reviewers');
  if (suggestions.length === 0) suggestions.push('break the work into smaller milestones and post a short status update');

  return `For "${task.name}", I would suggest: ${suggestions.join(', ')}.`;
}

function buildReport(context) {
  const overdue = context.tasks.filter((task) => task.isOverdue && !task.isCompleted);
  const dueSoon = context.tasks.filter((task) => !task.isCompleted && task.dueInDays !== null && task.dueInDays >= 0 && task.dueInDays <= 7);

  return [
    `Daily update for ${context.workspace.name}:`,
    `Projects in view: ${context.projects.length}.`,
    `Tracked tasks: ${context.tasks.length}.`,
    `Overdue tasks: ${overdue.length}.`,
    `Due this week: ${dueSoon.length}.`,
    overdue.length
      ? `Key blockers: ${overdue.slice(0, 3).map((task) => `${task.name} (${task.project_name})`).join('; ')}.`
      : 'No overdue blockers were detected in the dashboard data.',
  ].join(' ');
}

function buildReplySuggestion(context, message) {
  const task = findTaskMention(context, message);
  if (task) {
    return `Suggested reply: "Update on ${task.name}: the task is currently in ${task.stage || task.status}. Next step is to confirm ownership, close any blockers, and target ${task.due_date || 'a due date'} for the next milestone."`;
  }

  return 'Suggested reply: "Quick update from the team side: I reviewed the current tasks and deadlines, and I will share the top priorities, risks, and next steps in a concise update shortly."';
}

function buildLocalAssistantReply(context, message) {
  const lower = message.toLowerCase();
  const mentionedProject = findProjectMention(context, lower);
  const mentionedTask = findTaskMention(context, lower);

  if (lower.includes('summary') && lower.includes('chat')) return buildChatSummary(context);
  if (lower.includes('summary') || lower.includes('summarize') || lower.includes('tasks') || lower.includes('deadline') || lower.includes('overdue')) {
    if (mentionedProject) return buildProjectSummary(mentionedProject, context);
    return buildTaskSummary(context);
  }
  if (lower.includes('project') && mentionedProject) return buildProjectSummary(mentionedProject, context);
  if (lower.includes('improve') || lower.includes('improvement') || lower.includes('suggest')) {
    if (mentionedTask) return buildTaskImprovementAdvice(mentionedTask);
    const overdueTask = context.tasks.find((task) => task.isOverdue && !task.isCompleted) || context.tasks[0];
    return overdueTask
      ? buildTaskImprovementAdvice(overdueTask)
      : `I do not have a task in scope to improve right now, but I can review any named task in ${context.workspace.name}.`;
  }
  if (lower.includes('report') || lower.includes('update')) return buildReport(context);
  if (lower.includes('reply') || lower.includes('respond') || lower.includes('draft')) return buildReplySuggestion(context, message);

  return [
    `I can help with tasks, deadlines, project status, chat summaries, reply drafts, and report generation for ${context.workspace.name}.`,
    buildTaskSummary(context),
    'Try asking me to summarize tasks, highlight deadline risks, draft a project update, or suggest improvements for a specific task.',
  ].join(' ');
}

function getProviderConfig() {
  const apiKey = process.env.AI_API_KEY || process.env.OPENAI_API_KEY || '';
  const model = process.env.AI_MODEL || process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const apiUrl = process.env.AI_API_URL || process.env.OPENAI_API_URL || 'https://api.openai.com/v1/chat/completions';

  if (!apiKey) return null;
  return { apiKey, model, apiUrl };
}

async function callProviderAssistant({ context, message, history }) {
  const provider = getProviderConfig();
  if (!provider) return null;

  const summary = buildWorkspaceSummary(context);
  const systemPrompt = [
    'You are JNB chatbot, an internal AI assistant for team coordination.',
    'Answer using the provided workspace context only.',
    'Be concise, practical, and action-oriented.',
    'If data is not in the context, say so clearly and offer the closest useful answer.',
    `Workspace context: ${JSON.stringify(summary)}`,
  ].join(' ');

  const messages = [
    { role: 'system', content: systemPrompt },
    ...history,
    { role: 'user', content: message },
  ];

  const response = await fetch(provider.apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify({
      model: provider.model,
      temperature: 0.3,
      messages,
    }),
  });

  if (!response.ok) {
    throw new Error(`AI provider request failed with status ${response.status}`);
  }

  const data = await response.json();
  return data?.choices?.[0]?.message?.content?.trim() || null;
}

async function generateAssistantReply({ workspaceId, userId, message, history = [] }) {
  const newsTopic = detectNewsTopic(message);
  if (newsTopic) {
    const digest = await refreshNewsDigest(newsTopic);
    return {
      reply: digest.summary,
      mode: digest.source === 'external_api' ? 'news' : digest.source,
      suggestions: [
        'Show latest finance news',
        "Today's news headlines",
        'Summarize our tasks',
        'Draft a team update',
      ],
    };
  }

  const context = await getWorkspaceContext(workspaceId, userId);
  const normalizedHistory = normalizeHistory(history);

  let reply = null;
  let mode = 'workspace';

  try {
    reply = await callProviderAssistant({ context, message, history: normalizedHistory });
    if (reply) mode = 'provider';
  } catch (error) {
    console.error('AI provider fallback triggered:', error.message);
  }

  if (!reply) {
    reply = buildLocalAssistantReply(context, message);
  }

  return {
    reply,
    mode,
    suggestions: [
      'Show latest finance news',
      'Daily workspace update',
      'Summarize our tasks',
      'What deadlines are at risk?',
      'Draft a team update',
      'Suggest task improvements',
    ],
  };
}

module.exports = {
  generateAssistantReply,
};
