const express = require('express');
const multer = require('multer');
const XLSX = require('xlsx');
const { pool } = require('../db');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024, files: 1 } });

const PRIORITY_VALUES = new Set(['Critical', 'High', 'Medium', 'Low']);
const STATUS_VALUES = new Set(['Open', 'In Progress', 'Under Review', 'Completed', 'Closed', 'Pending Approval', 'Rejected', 'Blocked']);
const STAGE_VALUES = new Set(['Planned', 'In-process', 'Completed', 'On-hold', 'Dropped']);
const MAX_IMPORT_ROWS = 1000;

function normalizeHeader(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function normalizeMappedRow(row) {
  const mapped = {};
  Object.entries(row || {}).forEach(([key, value]) => {
    const header = normalizeHeader(key);
    if (!header) return;
    if (['task title', 'title', 'task name', 'name'].includes(header)) mapped.title = value;
    if (header === 'description') mapped.description = value;
    if (['assignee', 'assignee email', 'assignee username'].includes(header)) mapped.assignee = value;
    if (['project', 'project name'].includes(header)) mapped.project = value;
    if (['due date', 'duedate'].includes(header)) mapped.due_date = value;
    if (header === 'priority') mapped.priority = value;
    if (header === 'status') mapped.status = value;
    if (['service', 'service name'].includes(header)) mapped.service = value;
    if (['estimated hours', 'estimate hours', 'estimatedhrs'].includes(header)) mapped.estimated_hours = value;
    if (['worked hours', 'hours worked'].includes(header)) mapped.worked_hours = value;
    if (['start time', 'start'].includes(header)) mapped.start_time = value;
    if (['end time', 'end'].includes(header)) mapped.end_time = value;
    if (header === 'category') mapped.category = value;
    if (header === 'section') mapped.section = value;
    if (header === 'notes') mapped.notes = value;
    if (header === 'stage') mapped.stage = value;
  });
  return mapped;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeImportSubmissionRow(row) {
  if (!row || typeof row !== 'object') return {};
  if (row.raw && typeof row.raw === 'object') return row.raw;

  const normalized = row.normalized && typeof row.normalized === 'object' ? row.normalized : row;
  return {
    'Task Title': normalized.title || '',
    Description: normalized.description || '',
    Assignee: normalized.assignee || normalized.assignee_name || '',
    Project: normalized.project || normalized.project_name || '',
    'Due Date': normalized.due_date || '',
    Priority: normalized.priority || '',
    Status: normalized.status || '',
    Service: normalized.service || normalized.service_name || '',
    'Estimated Hours': normalized.estimated_hours ?? '',
    'Worked Hours': normalized.worked_hours ?? '',
    'Start Time': normalized.start_time || '',
    'End Time': normalized.end_time || '',
    Category: normalized.category || '',
    Section: normalized.section || '',
    Notes: normalized.notes || '',
    Stage: normalized.stage || '',
  };
}

async function getWorkspaceRole(workspaceId, userId) {
  const result = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, userId]
  );
  return result.rows[0]?.role || null;
}

async function loadWorkspaceImportReferenceData(workspaceId, userId, workspaceRole) {
  const canManageAll = ['Owner', 'Admin', 'ProjectAdmin'].includes(workspaceRole);

  const [projectsResult, usersResult, servicesResult] = await Promise.all([
    pool.query(
      canManageAll
        ? `SELECT p.id, p.name, COALESCE(p.members_can_create_tasks, TRUE) AS members_can_create_tasks
           FROM projects p
           WHERE p.workspace_id = $1`
        : `SELECT p.id, p.name, COALESCE(p.members_can_create_tasks, TRUE) AS members_can_create_tasks
           FROM projects p
           JOIN project_members pm ON pm.project_id = p.id
           WHERE p.workspace_id = $1 AND pm.user_id = $2`,
      canManageAll ? [workspaceId] : [workspaceId, userId]
    ),
    pool.query(
      `SELECT u.id, u.email, u.username, u.first_name, u.last_name
       FROM users u
       JOIN workspace_members wm ON wm.user_id = u.id
       WHERE wm.workspace_id = $1`,
      [workspaceId]
    ),
    pool.query(
      `SELECT id, name
       FROM services
       WHERE workspace_id = $1 AND deleted_at IS NULL`,
      [workspaceId]
    ),
  ]);

  return {
    projects: projectsResult.rows,
    users: usersResult.rows,
    services: servicesResult.rows,
    canManageAll,
  };
}

function resolveUser(users, rawAssignee) {
  const input = String(rawAssignee || '').trim().toLowerCase();
  if (!input) return null;
  return users.find((user) => {
    const fullName = `${user.first_name || ''} ${user.last_name || ''}`.trim().toLowerCase();
    return user.email?.toLowerCase() === input
      || user.username?.toLowerCase() === input
      || (fullName && fullName === input);
  }) || null;
}

function resolveByName(list, rawValue) {
  const input = String(rawValue || '').trim().toLowerCase();
  if (!input) return null;
  return list.find((item) => String(item.name || '').trim().toLowerCase() === input) || null;
}

function validateAndNormalizeRows(rows, referenceData) {
  return rows.map((rawRow, index) => {
    const mapped = normalizeMappedRow(rawRow);
    const errors = [];

    const title = String(mapped.title || '').trim();
    if (!title) errors.push('Task title is required');

    const project = resolveByName(referenceData.projects, mapped.project);
    if (!project) {
      errors.push('Project is required and must be accessible');
    } else if (!referenceData.canManageAll && project.members_can_create_tasks === false) {
      errors.push('You do not have permission to create tasks in this project');
    }

    const assignee = mapped.assignee ? resolveUser(referenceData.users, mapped.assignee) : null;
    if (mapped.assignee && !assignee) errors.push('Assignee was not found in this workspace');

    const service = mapped.service ? resolveByName(referenceData.services, mapped.service) : null;
    if (mapped.service && !service) errors.push('Service was not found in this workspace');

    const priority = mapped.priority ? String(mapped.priority).trim() : 'Medium';
    if (priority && !PRIORITY_VALUES.has(priority)) errors.push('Priority must be Critical, High, Medium, or Low');

    const status = mapped.status ? String(mapped.status).trim() : 'Open';
    if (status && !STATUS_VALUES.has(status)) errors.push('Status is invalid');

    const stage = mapped.stage ? String(mapped.stage).trim() : (status === 'Completed' || status === 'Closed' ? 'Completed' : 'Planned');
    if (stage && !STAGE_VALUES.has(stage)) errors.push('Stage is invalid');

    const dueDate = mapped.due_date ? parseDateValue(mapped.due_date) : null;
    if (mapped.due_date && !dueDate) errors.push('Due date is invalid');

    const startTime = mapped.start_time ? parseDateValue(mapped.start_time) : null;
    if (mapped.start_time && !startTime) errors.push('Start time is invalid');

    const endTime = mapped.end_time ? parseDateValue(mapped.end_time) : null;
    if (mapped.end_time && !endTime) errors.push('End time is invalid');

    const estimatedHours = parseNumber(mapped.estimated_hours);
    if (mapped.estimated_hours && estimatedHours === null) errors.push('Estimated hours must be numeric');

    const workedHours = parseNumber(mapped.worked_hours);
    if (mapped.worked_hours && workedHours === null) errors.push('Worked hours must be numeric');

    const normalized = {
      title,
      description: String(mapped.description || '').trim() || null,
      project_id: project?.id || null,
      project_name: project?.name || null,
      assignee_id: assignee?.id || null,
      assignee_name: assignee ? `${assignee.first_name || ''} ${assignee.last_name || ''}`.trim() || assignee.email : null,
      due_date: dueDate,
      priority,
      status,
      stage,
      service_id: service?.id || null,
      service_name: service?.name || null,
      estimated_hours: estimatedHours,
      worked_hours: workedHours,
      start_time: startTime,
      end_time: endTime,
      category: String(mapped.category || '').trim() || null,
      section: String(mapped.section || '').trim() || null,
      notes: String(mapped.notes || '').trim() || null,
    };

    return {
      row_number: index + 2,
      raw: rawRow,
      normalized,
      errors,
      is_valid: errors.length === 0,
    };
  });
}

router.get('/workspace/:workspaceId/template', async (_req, res) => {
  const workbook = XLSX.utils.book_new();
  const worksheet = XLSX.utils.json_to_sheet([
    {
      'Task Title': 'Finalize vendor contract',
      Description: 'Review the final contract and send for signature',
      Assignee: 'employee@example.com',
      Project: 'Website Revamp',
      'Due Date': '2026-04-30',
      Priority: 'High',
      Status: 'Open',
      Service: 'Consulting',
      'Estimated Hours': 6,
      'Worked Hours': 0,
      'Start Time': '2026-04-25T10:00:00',
      'End Time': '2026-04-25T16:00:00',
      Category: 'Legal',
      Section: 'Operations',
      Notes: 'Bulk upload sample row',
    },
  ]);
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Tasks');
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
  res.setHeader('Content-Disposition', 'attachment; filename="task-bulk-upload-template.xlsx"');
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.send(buffer);
});

router.post('/workspace/:workspaceId/preview', upload.single('file'), async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  if (!req.file) return res.status(400).json({ error: 'Excel file is required' });

  try {
    const workspaceRole = await getWorkspaceRole(workspaceId, req.userId);
    if (!workspaceRole) return res.status(403).json({ error: 'Not a member of this workspace' });

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer', cellDates: true });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) return res.status(400).json({ error: 'The uploaded workbook is empty' });

    const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '', raw: false });
    if (!rows.length) return res.status(400).json({ error: 'No task rows were found in the uploaded file' });

    const referenceData = await loadWorkspaceImportReferenceData(workspaceId, req.userId, workspaceRole);
    const previewRows = validateAndNormalizeRows(rows, referenceData);
    const validRows = previewRows.filter((row) => row.is_valid).length;

    res.json({
      file_name: req.file.originalname,
      total_rows: previewRows.length,
      valid_rows: validRows,
      invalid_rows: previewRows.length - validRows,
      rows: previewRows,
    });
  } catch (err) {
    console.error('Bulk task preview error:', err);
    res.status(500).json({ error: 'Failed to preview bulk task upload' });
  }
});

router.post('/workspace/:workspaceId/import', async (req, res) => {
  const workspaceId = Number(req.params.workspaceId);
  const rows = Array.isArray(req.body.rows) ? req.body.rows : [];
  if (!rows.length) return res.status(400).json({ error: 'No validated rows were provided for import' });
  if (rows.length > MAX_IMPORT_ROWS) {
    return res.status(400).json({ error: `You can import up to ${MAX_IMPORT_ROWS} tasks at a time` });
  }

  const client = await pool.connect();
  try {
    const workspaceRole = await getWorkspaceRole(workspaceId, req.userId);
    if (!workspaceRole) return res.status(403).json({ error: 'Not a member of this workspace' });

    const referenceData = await loadWorkspaceImportReferenceData(workspaceId, req.userId, workspaceRole);
    const revalidatedRows = validateAndNormalizeRows(
      rows.map((row) => normalizeImportSubmissionRow(row)),
      referenceData
    );
    const invalidRows = revalidatedRows.filter((row) => !row.is_valid);
    if (invalidRows.length) {
      return res.status(400).json({
        error: 'Some rows are no longer valid for import',
        invalid_rows: invalidRows,
      });
    }

    await client.query('BEGIN');
    const inserted = [];

    for (const row of revalidatedRows) {
      const task = row.normalized;
      if (!task.project_id || !task.title) continue;

      const result = await client.query(
        `INSERT INTO tasks
         (name, description, project_id, assignee_id, service_id, stage, status, priority, due_date, notes, category, section, estimated_hours, created_by, worked_hours, start_time, end_time)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
         RETURNING id, name`,
        [
          task.title,
          task.description || null,
          task.project_id,
          task.assignee_id || null,
          task.service_id || null,
          task.stage || 'Planned',
          task.status || 'Open',
          task.priority || 'Medium',
          task.due_date || null,
          task.notes || null,
          task.category || null,
          task.section || null,
          task.estimated_hours ?? null,
          req.userId,
          task.worked_hours ?? null,
          task.start_time || null,
          task.end_time || null,
        ]
      );

      inserted.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ imported_count: inserted.length, tasks: inserted });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Bulk task import error:', err);
    res.status(500).json({ error: 'Failed to import bulk tasks' });
  } finally {
    client.release();
  }
});

module.exports = router;
