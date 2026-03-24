/**
 * Checklist Service
 * Business logic for Monthly Client Checklist module
 */
const { pool } = require('../db');

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Get workspace timezone
 */
async function getWorkspaceTimezone(workspaceId) {
  const result = await pool.query(
    'SELECT timezone FROM workspaces WHERE id = $1',
    [workspaceId]
  );
  return result.rows[0]?.timezone || 'Asia/Kolkata';
}

/**
 * Get current date in workspace timezone
 */
function getCurrentDateInTimezone(timezone = 'Asia/Kolkata') {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now); // Returns YYYY-MM-DD
}

/**
 * Get week start (Monday) for a given date
 */
function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

/**
 * Get week end (Sunday) for a given date
 */
function getWeekEnd(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() + (day === 0 ? 0 : 7 - day);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

/**
 * Get month start for a given date
 */
function getMonthStart(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split('T')[0];
}

/**
 * Get month end for a given date
 */
function getMonthEnd(date) {
  const d = new Date(date);
  return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split('T')[0];
}

/**
 * Check if a date is a weekend
 */
function isWeekend(date) {
  const d = new Date(date);
  const day = d.getDay();
  return day === 0 || day === 6; // Sunday or Saturday
}

/**
 * Clamp a number between min/max
 */
function clampNumber(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize checklist schedule options by frequency
 */
function normalizeScheduleOptions({
  frequency,
  weeklyScheduleType,
  weeklyDayOfWeek,
  monthlyScheduleType,
  monthlyDayOfMonth
}) {
  if (!['daily', 'weekly', 'monthly'].includes(frequency)) {
    throw new Error('Invalid frequency. Use daily, weekly, or monthly.');
  }

  if (frequency === 'daily') {
    return {
      weekly_schedule_type: null,
      weekly_day_of_week: null,
      monthly_schedule_type: null,
      monthly_day_of_month: null
    };
  }

  if (frequency === 'weekly') {
    const scheduleType = weeklyScheduleType === 'specific_day' ? 'specific_day' : 'any_day';
    let dayOfWeek = null;

    if (scheduleType === 'specific_day') {
      const parsed = Number.parseInt(weeklyDayOfWeek, 10);
      if (Number.isNaN(parsed) || parsed < 0 || parsed > 6) {
        throw new Error('Weekly specific-day mode requires weeklyDayOfWeek between 0 and 6');
      }
      dayOfWeek = parsed;
    }

    return {
      weekly_schedule_type: scheduleType,
      weekly_day_of_week: dayOfWeek,
      monthly_schedule_type: null,
      monthly_day_of_month: null
    };
  }

  const scheduleType = ['any_day', 'specific_day', 'month_end'].includes(monthlyScheduleType)
    ? monthlyScheduleType
    : 'any_day';
  let dayOfMonth = null;

  if (scheduleType === 'specific_day') {
    const parsed = Number.parseInt(monthlyDayOfMonth, 10);
    if (Number.isNaN(parsed) || parsed < 1 || parsed > 31) {
      throw new Error('Monthly specific-day mode requires monthlyDayOfMonth between 1 and 31');
    }
    dayOfMonth = parsed;
  }

  return {
    weekly_schedule_type: null,
    weekly_day_of_week: null,
    monthly_schedule_type: scheduleType,
    monthly_day_of_month: dayOfMonth
  };
}

/**
 * Check if user is admin/owner of workspace
 */
async function isWorkspaceAdmin(userId, workspaceId) {
  const result = await pool.query(
    `SELECT role FROM workspace_members 
     WHERE user_id = $1 AND workspace_id = $2 AND role IN ('Owner', 'Admin')`,
    [userId, workspaceId]
  );
  return result.rows.length > 0;
}

/**
 * Check if user is assigned to a checklist item
 */
async function isAssignedToItem(userId, checklistItemId, date = null) {
  const currentDate = date || new Date().toISOString().split('T')[0];
  const result = await pool.query(
    `SELECT id FROM checklist_assignments 
     WHERE checklist_item_id = $1 AND user_id = $2 AND is_active = TRUE
     AND assigned_from <= $3 AND (assigned_to IS NULL OR assigned_to >= $3)`,
    [checklistItemId, userId, currentDate]
  );
  return result.rows.length > 0;
}

function normalizeUserIds(values) {
  if (!Array.isArray(values)) return [];

  const seen = new Set();
  const normalized = [];
  values.forEach((value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || seen.has(parsed)) {
      return;
    }
    seen.add(parsed);
    normalized.push(parsed);
  });

  return normalized;
}

function normalizeAssigneeRoles({
  primaryAssigneeId = null,
  primaryAssigneeIds = [],
  secondaryAssigneeIds = [],
  assigneeIds = []
}) {
  const fallbackAssignees = normalizeUserIds(assigneeIds);

  let normalizedPrimary = normalizeUserIds(primaryAssigneeIds);
  const parsedSinglePrimary = Number.parseInt(primaryAssigneeId, 10);

  if (normalizedPrimary.length === 0 && Number.isFinite(parsedSinglePrimary) && parsedSinglePrimary > 0) {
    normalizedPrimary = [parsedSinglePrimary];
  }

  // Backward compatibility: if only legacy assigneeIds are provided,
  // treat all as primary assignees.
  if (normalizedPrimary.length === 0 && fallbackAssignees.length > 0) {
    normalizedPrimary = [...fallbackAssignees];
  }

  let normalizedSecondary = normalizeUserIds(secondaryAssigneeIds);
  const primarySet = new Set(normalizedPrimary);
  normalizedSecondary = normalizedSecondary.filter((id) => !primarySet.has(id));

  if (normalizedPrimary.length === 0) {
    throw new Error('At least one primary assignee is required');
  }

  return {
    primaryAssigneeIds: normalizedPrimary,
    secondaryAssigneeIds: normalizedSecondary
  };
}

const CUSTOM_FIELD_TYPES = new Set(['text', 'number', 'date', 'date_range', 'boolean', 'dropdown']);

function normalizeCustomFieldDefinitions(definitions = [], effectiveFrom = null) {
  if (!Array.isArray(definitions)) {
    return [];
  }

  const normalized = [];

  definitions.forEach((definition, index) => {
    if (!definition || typeof definition !== 'object') {
      return;
    }

    const label = String(definition.label || '').trim();
    const fieldType = String(definition.fieldType || definition.field_type || '').trim();
    const required = definition.required === true;

    if (!label) {
      throw new Error(`Custom field #${index + 1} label is required`);
    }

    if (!CUSTOM_FIELD_TYPES.has(fieldType)) {
      throw new Error(`Custom field "${label}" has invalid type`);
    }

    const normalizedField = {
      label,
      fieldType,
      required,
      displayOrder: Number.isInteger(definition.displayOrder)
        ? definition.displayOrder
        : Number.parseInt(definition.displayOrder, 10) || normalized.length,
      options: [],
      effectiveFrom: null
    };

    const explicitEffectiveFrom = definition.effectiveFrom || definition.effective_from || effectiveFrom || null;
    if (explicitEffectiveFrom) {
      const dateValue = String(explicitEffectiveFrom).slice(0, 10);
      if (!isValidDateString(dateValue)) {
        throw new Error(`Custom field "${label}" has invalid apply-from date`);
      }
      normalizedField.effectiveFrom = dateValue;
    }

    if (fieldType === 'dropdown') {
      const rawOptions = Array.isArray(definition.options)
        ? definition.options
        : String(definition.options || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);

      const unique = [];
      const seen = new Set();
      rawOptions.forEach((option) => {
        const labelValue = String(option).trim();
        if (!labelValue || seen.has(labelValue.toLowerCase())) {
          return;
        }
        seen.add(labelValue.toLowerCase());
        unique.push(labelValue);
      });

      if (unique.length === 0) {
        throw new Error(`Custom field "${label}" requires at least one dropdown option`);
      }
      normalizedField.options = unique;
    }

    normalized.push(normalizedField);
  });

  if (normalized.length > 20) {
    throw new Error('A checklist item supports at most 20 custom fields');
  }

  return normalized;
}

function normalizeCustomFieldInputMap(customFieldValues) {
  const map = new Map();
  if (!customFieldValues) {
    return map;
  }

  if (Array.isArray(customFieldValues)) {
    customFieldValues.forEach((entry) => {
      if (!entry || typeof entry !== 'object') return;
      const fieldId = Number.parseInt(entry.fieldId ?? entry.field_id, 10);
      if (!Number.isInteger(fieldId) || fieldId <= 0) return;
      map.set(fieldId, entry.value);
    });
    return map;
  }

  if (typeof customFieldValues === 'object') {
    Object.entries(customFieldValues).forEach(([rawFieldId, value]) => {
      const fieldId = Number.parseInt(rawFieldId, 10);
      if (!Number.isInteger(fieldId) || fieldId <= 0) return;
      map.set(fieldId, value);
    });
  }

  return map;
}

function isValidDateString(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const [year, month, day] = value.split('-').map((v) => Number.parseInt(v, 10));
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year
    && date.getUTCMonth() + 1 === month
    && date.getUTCDate() === day
  );
}

function extractStoredCustomFieldValue(field) {
  if (!field) return null;

  switch (field.field_type) {
    case 'text':
    case 'dropdown':
      return field.value_text ?? null;
    case 'number':
      return field.value_number !== null && field.value_number !== undefined
        ? Number(field.value_number)
        : null;
    case 'date':
      return field.value_date ? String(field.value_date).slice(0, 10) : null;
    case 'boolean':
      return typeof field.value_boolean === 'boolean' ? field.value_boolean : null;
    case 'date_range':
      return field.value_json && typeof field.value_json === 'object' ? field.value_json : null;
    default:
      return null;
  }
}

function normalizeCustomFieldValue(field, rawValue) {
  if (rawValue === undefined) {
    return {
      provided: false,
      value: undefined
    };
  }

  if (rawValue === null || rawValue === '') {
    return {
      provided: true,
      value: null
    };
  }

  switch (field.field_type) {
    case 'text': {
      const value = String(rawValue).trim();
      return {
        provided: true,
        value: value || null
      };
    }
    case 'number': {
      const parsed = Number(rawValue);
      if (!Number.isFinite(parsed)) {
        throw new Error(`"${field.label}" must be a valid number`);
      }
      return {
        provided: true,
        value: parsed
      };
    }
    case 'date': {
      const value = String(rawValue).slice(0, 10);
      if (!isValidDateString(value)) {
        throw new Error(`"${field.label}" must be a valid date (YYYY-MM-DD)`);
      }
      return {
        provided: true,
        value
      };
    }
    case 'date_range': {
      const payload = typeof rawValue === 'string'
        ? (() => {
            try {
              return JSON.parse(rawValue);
            } catch (_err) {
              return {};
            }
          })()
        : rawValue;
      const startDate = String(payload?.startDate || payload?.start || '').slice(0, 10);
      const endDate = String(payload?.endDate || payload?.end || '').slice(0, 10);

      if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
        throw new Error(`"${field.label}" requires a valid start and end date`);
      }
      if (startDate > endDate) {
        throw new Error(`"${field.label}" requires start date before end date`);
      }

      return {
        provided: true,
        value: { startDate, endDate }
      };
    }
    case 'boolean': {
      if (typeof rawValue === 'boolean') {
        return { provided: true, value: rawValue };
      }

      const lowered = String(rawValue).trim().toLowerCase();
      if (['yes', 'true', '1'].includes(lowered)) {
        return { provided: true, value: true };
      }
      if (['no', 'false', '0'].includes(lowered)) {
        return { provided: true, value: false };
      }
      throw new Error(`"${field.label}" must be Yes or No`);
    }
    case 'dropdown': {
      const selected = String(rawValue).trim();
      const options = Array.isArray(field.options) ? field.options : [];
      if (!options.includes(selected)) {
        throw new Error(`"${field.label}" has invalid selection`);
      }
      return {
        provided: true,
        value: selected
      };
    }
    default:
      throw new Error(`Unsupported custom field type for "${field.label}"`);
  }
}

function isCustomFieldValueEmpty(value, fieldType) {
  if (value === null || value === undefined) return true;
  if (fieldType === 'text' || fieldType === 'dropdown') {
    return String(value).trim() === '';
  }
  if (fieldType === 'date_range') {
    return !value.startDate || !value.endDate;
  }
  return false;
}

function mapValueToColumns(fieldType, value) {
  const mapped = {
    valueText: null,
    valueNumber: null,
    valueDate: null,
    valueBoolean: null,
    valueJson: null
  };

  if (value === null || value === undefined) {
    return mapped;
  }

  switch (fieldType) {
    case 'text':
    case 'dropdown':
      mapped.valueText = String(value);
      break;
    case 'number':
      mapped.valueNumber = Number(value);
      break;
    case 'date':
      mapped.valueDate = String(value).slice(0, 10);
      break;
    case 'boolean':
      mapped.valueBoolean = value === true;
      break;
    case 'date_range':
      mapped.valueJson = JSON.stringify(value);
      break;
    default:
      break;
  }

  return mapped;
}

async function getOccurrenceCustomFieldRows(db, occurrenceId) {
  const result = await db.query(
    `SELECT
       cf.id,
       cf.label,
       cf.field_type,
       cf.required,
       cf.options,
       cf.display_order,
       cf.effective_from,
       cf.disabled_from,
       ccfv.id as value_id,
       ccfv.value_text,
       ccfv.value_number,
       ccfv.value_date,
       ccfv.value_boolean,
       ccfv.value_json
     FROM checklist_occurrences co
     JOIN checklist_item_custom_fields cf
       ON cf.checklist_item_id = co.checklist_item_id
      AND cf.is_active = TRUE
      AND cf.effective_from <= co.occurrence_date
     LEFT JOIN checklist_occurrence_custom_field_values ccfv
       ON ccfv.occurrence_id = co.id
      AND ccfv.field_id = cf.id
     WHERE co.id = $1
       AND (cf.disabled_from IS NULL OR co.occurrence_date < cf.disabled_from OR ccfv.id IS NOT NULL)
     ORDER BY cf.display_order, cf.id`,
    [occurrenceId]
  );
  return result.rows;
}

async function upsertOccurrenceCustomFieldValues({
  db,
  occurrenceId,
  actorUserId,
  customFieldValues,
  requireRequired = true
}) {
  const fields = await getOccurrenceCustomFieldRows(db, occurrenceId);
  if (fields.length === 0) {
    return [];
  }

  const inputMap = normalizeCustomFieldInputMap(customFieldValues);
  const byId = new Map(fields.map((field) => [field.id, field]));

  for (const fieldId of inputMap.keys()) {
    if (!byId.has(fieldId)) {
      throw new Error('Custom field payload contains invalid field reference');
    }
  }

  const updates = [];
  const finalValues = new Map();

  fields.forEach((field) => {
    const currentValue = extractStoredCustomFieldValue(field);
    const normalized = normalizeCustomFieldValue(field, inputMap.get(field.id));

    const nextValue = normalized.provided ? normalized.value : currentValue;
    finalValues.set(field.id, nextValue);

    if (normalized.provided) {
      updates.push({
        field,
        value: normalized.value
      });
    }
  });

  if (requireRequired) {
    fields.forEach((field) => {
      if (!field.required) {
        return;
      }
      const value = finalValues.get(field.id);
      if (isCustomFieldValueEmpty(value, field.field_type)) {
        throw new Error(`"${field.label}" is required`);
      }
    });
  }

  for (const update of updates) {
    const mapped = mapValueToColumns(update.field.field_type, update.value);
    await db.query(
      `INSERT INTO checklist_occurrence_custom_field_values
       (occurrence_id, field_id, value_text, value_number, value_date, value_boolean, value_json, updated_by, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, CURRENT_TIMESTAMP)
       ON CONFLICT (occurrence_id, field_id)
       DO UPDATE SET
         value_text = EXCLUDED.value_text,
         value_number = EXCLUDED.value_number,
         value_date = EXCLUDED.value_date,
         value_boolean = EXCLUDED.value_boolean,
         value_json = EXCLUDED.value_json,
         updated_by = EXCLUDED.updated_by,
         updated_at = CURRENT_TIMESTAMP`,
      [
        occurrenceId,
        update.field.id,
        mapped.valueText,
        mapped.valueNumber,
        mapped.valueDate,
        mapped.valueBoolean,
        mapped.valueJson,
        actorUserId
      ]
    );
  }

  return fields.map((field) => ({
    fieldId: field.id,
    value: finalValues.get(field.id)
  }));
}

// ============================================
// CHECKLIST ITEMS CRUD
// ============================================

/**
 * Create a new checklist item
 */
async function createChecklistItem({
  clientId,
  workspaceId,
  title,
  description,
  category,
  frequency,
  effectiveFrom,
  effectiveTo,
  completionRule = 'all',
  remarksRequired = false,
  weeklyScheduleType = 'any_day',
  weeklyDayOfWeek = null,
  monthlyScheduleType = 'any_day',
  monthlyDayOfMonth = null,
  primaryAssigneeId = null,
  primaryAssigneeIds = [],
  secondaryAssigneeIds = [],
  assigneeIds = [],
  customFields = [],
  createdBy
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedSchedule = normalizeScheduleOptions({
      frequency,
      weeklyScheduleType,
      weeklyDayOfWeek,
      monthlyScheduleType,
      monthlyDayOfMonth
    });

    // Insert checklist item
    const itemResult = await client.query(
      `INSERT INTO checklist_items 
       (client_id, workspace_id, title, description, category, frequency, 
        weekly_schedule_type, weekly_day_of_week, monthly_schedule_type, monthly_day_of_month,
        effective_from, effective_to, completion_rule, remarks_required, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
       RETURNING *`,
      [clientId, workspaceId, title, description, category, frequency,
       normalizedSchedule.weekly_schedule_type,
       normalizedSchedule.weekly_day_of_week,
       normalizedSchedule.monthly_schedule_type,
       normalizedSchedule.monthly_day_of_month,
       effectiveFrom, effectiveTo, completionRule, remarksRequired, createdBy]
    );

    const item = itemResult.rows[0];

    const normalizedAssignments = normalizeAssigneeRoles({
      primaryAssigneeId,
      primaryAssigneeIds,
      secondaryAssigneeIds,
      assigneeIds
    });

    const normalizedCustomFields = normalizeCustomFieldDefinitions(customFields, effectiveFrom);

    // Add primary assignments
    for (const userId of normalizedAssignments.primaryAssigneeIds) {
      await client.query(
        `INSERT INTO checklist_assignments 
         (checklist_item_id, user_id, assignment_role, assigned_from, assigned_by)
         VALUES ($1, $2, 'primary', $3, $4)`,
        [item.id, userId, effectiveFrom, createdBy]
      );
    }

    // Add secondary assignments
    for (const userId of normalizedAssignments.secondaryAssigneeIds) {
      await client.query(
        `INSERT INTO checklist_assignments 
         (checklist_item_id, user_id, assignment_role, assigned_from, assigned_by)
         VALUES ($1, $2, 'secondary', $3, $4)`,
        [item.id, userId, effectiveFrom, createdBy]
      );
    }

    // Add custom field definitions (immutable after creation; only future deactivation allowed).
    for (const field of normalizedCustomFields) {
      await client.query(
        `INSERT INTO checklist_item_custom_fields
         (checklist_item_id, label, field_type, required, options, display_order, effective_from, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
        [
          item.id,
          field.label,
          field.fieldType,
          field.required,
          JSON.stringify(field.options || []),
          field.displayOrder,
          field.effectiveFrom || effectiveFrom,
          createdBy
        ]
      );
    }

    // Generate occurrences from effective_from
    await generateOccurrencesForItem(client, item);

    await client.query('COMMIT');

    // Fetch complete item with assignments
    return await getChecklistItemById(item.id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Update checklist item
 */
async function updateChecklistItem(itemId, updates, userId) {
  const {
    title,
    description,
    category,
    frequency,
    effectiveTo,
    completionRule,
    remarksRequired,
    isActive,
    weeklyScheduleType,
    weeklyDayOfWeek,
    monthlyScheduleType,
    monthlyDayOfMonth,
    customFields = []
  } = updates;

  const existingResult = await pool.query('SELECT * FROM checklist_items WHERE id = $1', [itemId]);
  if (existingResult.rows.length === 0) return null;

  const existing = existingResult.rows[0];
  const mergedFrequency = frequency || existing.frequency;
  const normalizedSchedule = normalizeScheduleOptions({
    frequency: mergedFrequency,
    weeklyScheduleType: weeklyScheduleType ?? existing.weekly_schedule_type,
    weeklyDayOfWeek: weeklyDayOfWeek ?? existing.weekly_day_of_week,
    monthlyScheduleType: monthlyScheduleType ?? existing.monthly_schedule_type,
    monthlyDayOfMonth: monthlyDayOfMonth ?? existing.monthly_day_of_month
  });

  const timezone = await getWorkspaceTimezone(existing.workspace_id);
  const defaultCustomFieldEffectiveFrom = getCurrentDateInTimezone(timezone);
  const newCustomFieldDefinitions = Array.isArray(customFields)
    ? customFields.filter((field) => !(field && (field.id || field.fieldId || field.field_id)))
    : [];
  const normalizedNewCustomFields = normalizeCustomFieldDefinitions(
    newCustomFieldDefinitions,
    defaultCustomFieldEffectiveFrom
  );

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(
      `UPDATE checklist_items 
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           category = COALESCE($3, category),
           frequency = COALESCE($4, frequency),
           weekly_schedule_type = $5,
           weekly_day_of_week = $6,
           monthly_schedule_type = $7,
           monthly_day_of_month = $8,
           effective_to = COALESCE($9, effective_to),
           completion_rule = COALESCE($10, completion_rule),
           remarks_required = COALESCE($11, remarks_required),
           is_active = COALESCE($12, is_active),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $13
       RETURNING *`,
      [
        title,
        description,
        category,
        frequency,
        normalizedSchedule.weekly_schedule_type,
        normalizedSchedule.weekly_day_of_week,
        normalizedSchedule.monthly_schedule_type,
        normalizedSchedule.monthly_day_of_month,
        effectiveTo,
        completionRule,
        remarksRequired,
        isActive,
        itemId
      ]
    );

    if (normalizedNewCustomFields.length > 0) {
      const maxOrderResult = await client.query(
        `SELECT COALESCE(MAX(display_order), -1) AS max_order
         FROM checklist_item_custom_fields
         WHERE checklist_item_id = $1`,
        [itemId]
      );
      const baseOrder = Number.parseInt(maxOrderResult.rows[0]?.max_order, 10);
      const startOrder = Number.isFinite(baseOrder) ? baseOrder + 1 : 0;

      for (let index = 0; index < normalizedNewCustomFields.length; index += 1) {
        const field = normalizedNewCustomFields[index];
        await client.query(
          `INSERT INTO checklist_item_custom_fields
           (checklist_item_id, label, field_type, required, options, display_order, effective_from, created_by)
           VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
          [
            itemId,
            field.label,
            field.fieldType,
            field.required,
            JSON.stringify(field.options || []),
            startOrder + index,
            field.effectiveFrom || defaultCustomFieldEffectiveFrom,
            userId
          ]
        );
      }
    }

    await client.query('COMMIT');
    return await getChecklistItemById(itemId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Get checklist item by ID with assignments
 */
async function getChecklistItemById(itemId) {
  const result = await pool.query(
    `SELECT ci.*,
       c.client_name,
       ci.category as category_name,
       (
         SELECT COALESCE(json_agg(json_build_object(
           'id', ca.user_id,
           'user_id', ca.user_id,
           'name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
           'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
           'username', u.username,
           'assignment_role', ca.assignment_role,
           'assigned_from', ca.assigned_from,
           'assigned_to', ca.assigned_to,
           'is_active', ca.is_active
         ) ORDER BY
           CASE WHEN ca.assignment_role = 'primary' THEN 0 ELSE 1 END,
           COALESCE(u.first_name || ' ' || u.last_name, u.username)
         ), '[]'::json)
         FROM checklist_assignments ca
         JOIN users u ON ca.user_id = u.id
         WHERE ca.checklist_item_id = ci.id
       ) as assignees,
       (
         SELECT COALESCE(json_agg(json_build_object(
           'id', cf.id,
           'label', cf.label,
           'field_type', cf.field_type,
           'required', cf.required,
           'options', cf.options,
           'display_order', cf.display_order,
           'effective_from', cf.effective_from,
           'disabled_from', cf.disabled_from,
           'is_active', cf.is_active
         ) ORDER BY cf.display_order, cf.id), '[]'::json)
         FROM checklist_item_custom_fields cf
         WHERE cf.checklist_item_id = ci.id
           AND cf.is_active = TRUE
       ) as custom_fields
     FROM checklist_items ci
     JOIN clients c ON ci.client_id = c.id
     WHERE ci.id = $1`,
    [itemId]
  );
  return result.rows[0];
}

/**
 * Get all checklist items for a client
 */
async function getChecklistItemsByClient(clientId, options = {}) {
  const { includeInactive = false, frequency, category } = options;
  
  let query = `
    SELECT ci.*,
      c.client_name,
      ci.category as category_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', ca.user_id,
          'user_id', ca.user_id,
          'name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'username', u.username,
          'assignment_role', ca.assignment_role,
          'assigned_from', ca.assigned_from,
          'assigned_to', ca.assigned_to,
          'is_active', ca.is_active
        ) ORDER BY
          CASE WHEN ca.assignment_role = 'primary' THEN 0 ELSE 1 END,
          COALESCE(u.first_name || ' ' || u.last_name, u.username)
        ), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
      ) as assignees,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cf.id,
          'label', cf.label,
          'field_type', cf.field_type,
          'required', cf.required,
          'options', cf.options,
          'display_order', cf.display_order,
          'effective_from', cf.effective_from,
          'disabled_from', cf.disabled_from,
          'is_active', cf.is_active
        ) ORDER BY cf.display_order, cf.id), '[]'::json)
        FROM checklist_item_custom_fields cf
        WHERE cf.checklist_item_id = ci.id
          AND cf.is_active = TRUE
      ) as custom_fields
    FROM checklist_items ci
    JOIN clients c ON ci.client_id = c.id
    WHERE ci.client_id = $1
  `;
  
  const params = [clientId];
  let paramIndex = 2;

  if (!includeInactive) {
    query += ' AND ci.is_active = TRUE';
  }

  if (frequency) {
    query += ` AND ci.frequency = $${paramIndex}`;
    params.push(frequency);
    paramIndex++;
  }

  if (category) {
    query += ` AND ci.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  query += ' ORDER BY ci.category, ci.title';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get all checklist items for a workspace
 */
async function getChecklistItemsByWorkspace(workspaceId, options = {}) {
  const {
    includeInactive = false,
    clientId,
    frequency,
    category,
    assigneeId,
    allowedClientIds = null
  } = options;
  
  let query = `
    SELECT ci.*,
      c.client_name,
      ci.category as category_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', ca.user_id,
          'user_id', ca.user_id,
          'name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'username', u.username,
          'assignment_role', ca.assignment_role,
          'assigned_from', ca.assigned_from,
          'assigned_to', ca.assigned_to,
          'is_active', ca.is_active
        ) ORDER BY
          CASE WHEN ca.assignment_role = 'primary' THEN 0 ELSE 1 END,
          COALESCE(u.first_name || ' ' || u.last_name, u.username)
        ), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
      ) as assignees,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cf.id,
          'label', cf.label,
          'field_type', cf.field_type,
          'required', cf.required,
          'options', cf.options,
          'display_order', cf.display_order,
          'effective_from', cf.effective_from,
          'disabled_from', cf.disabled_from,
          'is_active', cf.is_active
        ) ORDER BY cf.display_order, cf.id), '[]'::json)
        FROM checklist_item_custom_fields cf
        WHERE cf.checklist_item_id = ci.id
          AND cf.is_active = TRUE
      ) as custom_fields
    FROM checklist_items ci
    JOIN clients c ON ci.client_id = c.id
    WHERE ci.workspace_id = $1
  `;
  
  const params = [workspaceId];
  let paramIndex = 2;

  if (!includeInactive) {
    query += ' AND ci.is_active = TRUE';
  }

  if (clientId) {
    query += ` AND ci.client_id = $${paramIndex}`;
    params.push(clientId);
    paramIndex++;
  } else if (Array.isArray(allowedClientIds)) {
    if (allowedClientIds.length === 0) {
      return [];
    }
    query += ` AND ci.client_id = ANY($${paramIndex})`;
    params.push(allowedClientIds);
    paramIndex++;
  }

  if (frequency) {
    query += ` AND ci.frequency = $${paramIndex}`;
    params.push(frequency);
    paramIndex++;
  }

  if (category) {
    query += ` AND ci.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (assigneeId) {
    query += ` AND EXISTS (
      SELECT 1 FROM checklist_assignments ca2 
      WHERE ca2.checklist_item_id = ci.id AND ca2.user_id = $${paramIndex} AND ca2.is_active = TRUE
    )`;
    params.push(assigneeId);
    paramIndex++;
  }

  query += ' ORDER BY c.client_name, ci.category, ci.title';

  const result = await pool.query(query, params);
  return result.rows;
}

// ============================================
// ASSIGNMENTS
// ============================================

/**
 * Add assignee to checklist item
 */
async function addAssignment(checklistItemId, userId, assignedFrom, assignedBy, assignmentRole = 'secondary') {
  const result = await pool.query(
    `INSERT INTO checklist_assignments 
     (checklist_item_id, user_id, assignment_role, assigned_from, assigned_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (checklist_item_id, user_id, assigned_from) 
     DO UPDATE SET is_active = TRUE, assignment_role = EXCLUDED.assignment_role
     RETURNING *`,
    [checklistItemId, userId, assignmentRole, assignedFrom, assignedBy]
  );
  return result.rows[0];
}

/**
 * Remove/deactivate assignment
 */
async function removeAssignment(checklistItemId, userId, endDate) {
  const result = await pool.query(
    `UPDATE checklist_assignments 
     SET assigned_to = $3, is_active = FALSE
     WHERE checklist_item_id = $1 AND user_id = $2 AND is_active = TRUE
     RETURNING *`,
    [checklistItemId, userId, endDate]
  );
  return result.rows[0];
}

/**
 * Update assignments for an item (replace all)
 */
async function updateAssignments(checklistItemId, assignmentInput, effectiveFrom, assignedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const normalizedAssignments = Array.isArray(assignmentInput)
      ? normalizeAssigneeRoles({
          assigneeIds: assignmentInput
        })
      : normalizeAssigneeRoles({
          primaryAssigneeId: assignmentInput?.primaryAssigneeId,
          primaryAssigneeIds: assignmentInput?.primaryAssigneeIds,
          secondaryAssigneeIds: assignmentInput?.secondaryAssigneeIds,
          assigneeIds: assignmentInput?.assigneeIds
        });

    // Deactivate existing assignments
    await client.query(
      `UPDATE checklist_assignments 
       SET assigned_to = $2, is_active = FALSE
       WHERE checklist_item_id = $1 AND is_active = TRUE AND assigned_to IS NULL`,
      [checklistItemId, effectiveFrom]
    );

    // Add primary assignments
    for (const userId of normalizedAssignments.primaryAssigneeIds) {
      await client.query(
        `INSERT INTO checklist_assignments 
         (checklist_item_id, user_id, assignment_role, assigned_from, assigned_by)
         VALUES ($1, $2, 'primary', $3, $4)
         ON CONFLICT (checklist_item_id, user_id, assigned_from) 
         DO UPDATE SET is_active = TRUE, assignment_role = EXCLUDED.assignment_role`,
        [checklistItemId, userId, effectiveFrom, assignedBy]
      );
    }

    // Add secondary assignments
    for (const userId of normalizedAssignments.secondaryAssigneeIds) {
      await client.query(
        `INSERT INTO checklist_assignments 
         (checklist_item_id, user_id, assignment_role, assigned_from, assigned_by)
         VALUES ($1, $2, 'secondary', $3, $4)
         ON CONFLICT (checklist_item_id, user_id, assigned_from) 
         DO UPDATE SET is_active = TRUE, assignment_role = EXCLUDED.assignment_role`,
        [checklistItemId, userId, effectiveFrom, assignedBy]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ============================================
// HOLIDAYS
// ============================================

const AUTO_WEEKEND_DESCRIPTION_PREFIX = '[AUTO_WEEKEND]';
const AUTO_WEEKEND_NAME = 'Weekend Exemption';
const AUTO_WEEKEND_DESCRIPTION = `${AUTO_WEEKEND_DESCRIPTION_PREFIX} Auto-generated weekend exemption`;

function formatDateToYmd(value) {
  if (value instanceof Date) {
    return value.toISOString().split('T')[0];
  }
  return String(value || '').slice(0, 10);
}

function getAllWeekdayDatesForYear(year, weekday) {
  const dates = [];
  const cursor = new Date(Date.UTC(year, 0, 1));
  while (cursor.getUTCFullYear() === year) {
    if (cursor.getUTCDay() === weekday) {
      dates.push(cursor.toISOString().split('T')[0]);
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function getNthSaturdayDatesForYear(year, nth) {
  const dates = [];
  for (let month = 0; month < 12; month += 1) {
    let saturdayCount = 0;
    const cursor = new Date(Date.UTC(year, month, 1));
    while (cursor.getUTCMonth() === month) {
      if (cursor.getUTCDay() === 6) {
        saturdayCount += 1;
        if (saturdayCount === nth) {
          dates.push(cursor.toISOString().split('T')[0]);
          break;
        }
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  }
  return dates;
}

function buildWeekendDateSetForYear(year, rules) {
  const dateSet = new Set();
  if (rules.sunday) {
    getAllWeekdayDatesForYear(year, 0).forEach((date) => dateSet.add(date));
  }
  if (rules.allSaturday) {
    getAllWeekdayDatesForYear(year, 6).forEach((date) => dateSet.add(date));
  } else {
    if (rules.secondSaturday) {
      getNthSaturdayDatesForYear(year, 2).forEach((date) => dateSet.add(date));
    }
    if (rules.fourthSaturday) {
      getNthSaturdayDatesForYear(year, 4).forEach((date) => dateSet.add(date));
    }
  }
  return dateSet;
}

function normalizeWeekendRules(rules = {}) {
  return {
    sunday: rules.sunday === true,
    secondSaturday: rules.secondSaturday === true,
    fourthSaturday: rules.fourthSaturday === true,
    allSaturday: rules.allSaturday === true
  };
}

function normalizeYears(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  const unique = new Set();
  values.forEach((value) => {
    const year = Number.parseInt(value, 10);
    if (!Number.isInteger(year) || year < 2000 || year > 2100) {
      return;
    }
    unique.add(year);
  });

  return Array.from(unique).sort((a, b) => a - b);
}

function isAutoWeekendDescription(description) {
  return String(description || '').startsWith(AUTO_WEEKEND_DESCRIPTION_PREFIX);
}

/**
 * Get holidays for a client
 */
async function getClientHolidays(clientId, year = null) {
  let query = 'SELECT * FROM client_holidays WHERE client_id = $1';
  const params = [clientId];

  if (year) {
    query += ' AND EXTRACT(YEAR FROM holiday_date) = $2';
    params.push(year);
  }

  query += ' ORDER BY holiday_date';
  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Add holiday for a client
 */
async function addClientHoliday(clientId, holidayDate, name, description, createdBy) {
  const result = await pool.query(
    `INSERT INTO client_holidays (client_id, holiday_date, name, description, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (client_id, holiday_date) DO UPDATE SET name = $3, description = $4
     RETURNING *`,
    [clientId, holidayDate, name, description, createdBy]
  );

  // Update affected occurrences to exempt status
  await updateHolidayAffectedOccurrences(clientId, holidayDate);

  return result.rows[0];
}

async function insertClientHolidayIfMissing(clientId, holidayDate, name, description, createdBy) {
  const result = await pool.query(
    `INSERT INTO client_holidays (client_id, holiday_date, name, description, created_by)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (client_id, holiday_date) DO NOTHING
     RETURNING *`,
    [clientId, holidayDate, name, description, createdBy]
  );

  if (result.rows.length > 0) {
    await updateHolidayAffectedOccurrences(clientId, holidayDate);
  }

  return result.rows[0] || null;
}

/**
 * Remove holiday
 */
async function removeClientHoliday(clientId, holidayDate) {
  const result = await pool.query(
    'DELETE FROM client_holidays WHERE client_id = $1 AND holiday_date = $2 RETURNING *',
    [clientId, holidayDate]
  );

  // Revert affected occurrences if needed
  if (result.rows.length > 0) {
    await revertHolidayAffectedOccurrences(clientId, holidayDate);
  }

  return result.rows[0];
}

/**
 * Copy holidays from one client to another
 */
async function copyHolidays(sourceClientId, targetClientId, year, createdBy) {
  const result = await pool.query(
    `INSERT INTO client_holidays (client_id, holiday_date, name, description, created_by)
     SELECT $2, holiday_date, name, description, $4
     FROM client_holidays 
     WHERE client_id = $1 AND EXTRACT(YEAR FROM holiday_date) = $3
     ON CONFLICT (client_id, holiday_date) DO NOTHING
     RETURNING *`,
    [sourceClientId, targetClientId, year, createdBy]
  );

  // Update affected occurrences
  for (const holiday of result.rows) {
    await updateHolidayAffectedOccurrences(targetClientId, holiday.holiday_date);
  }

  return result.rows;
}

/**
 * Sync auto weekend holidays for one or more years.
 * Manual holidays are never overwritten/removed.
 */
async function syncWeekendAutoHolidays(clientId, years, rules, createdBy) {
  const normalizedYears = normalizeYears(years);
  if (normalizedYears.length === 0) {
    throw new Error('At least one valid year is required');
  }

  const normalizedRules = normalizeWeekendRules(rules);
  const summary = [];
  let totalAdded = 0;
  let totalRemoved = 0;
  let totalManualProtected = 0;
  let totalUnchangedAuto = 0;

  for (const year of normalizedYears) {
    const targetDates = buildWeekendDateSetForYear(year, normalizedRules);
    const existingResult = await pool.query(
      `SELECT id, holiday_date, description
       FROM client_holidays
       WHERE client_id = $1
         AND EXTRACT(YEAR FROM holiday_date) = $2
       ORDER BY holiday_date`,
      [clientId, year]
    );

    const existingByDate = new Map();
    existingResult.rows.forEach((row) => {
      existingByDate.set(formatDateToYmd(row.holiday_date), row);
    });

    let added = 0;
    let removed = 0;
    let manualProtected = 0;
    let unchangedAuto = 0;

    for (const date of targetDates) {
      const existing = existingByDate.get(date);
      if (!existing) {
        const inserted = await insertClientHolidayIfMissing(
          clientId,
          date,
          AUTO_WEEKEND_NAME,
          AUTO_WEEKEND_DESCRIPTION,
          createdBy
        );
        if (inserted) {
          added += 1;
        }
        continue;
      }

      if (isAutoWeekendDescription(existing.description)) {
        unchangedAuto += 1;
      } else {
        manualProtected += 1;
      }
    }

    for (const row of existingResult.rows) {
      const date = formatDateToYmd(row.holiday_date);
      if (targetDates.has(date)) {
        continue;
      }

      if (!isAutoWeekendDescription(row.description)) {
        continue;
      }

      const deleted = await removeClientHoliday(clientId, date);
      if (deleted) {
        removed += 1;
      }
    }

    totalAdded += added;
    totalRemoved += removed;
    totalManualProtected += manualProtected;
    totalUnchangedAuto += unchangedAuto;

    summary.push({
      year,
      targetDates: targetDates.size,
      added,
      removed,
      manualProtected,
      unchangedAuto
    });
  }

  return {
    years: summary,
    rules: normalizedRules,
    totalAdded,
    totalRemoved,
    totalManualProtected,
    totalUnchangedAuto
  };
}

/**
 * Update occurrences affected by a holiday
 */
async function updateHolidayAffectedOccurrences(clientId, holidayDate) {
  // Daily items on this exact date become exempt
  await pool.query(
    `UPDATE checklist_occurrences 
     SET status = 'exempt', exemption_reason = 'Holiday', updated_at = CURRENT_TIMESTAMP
     WHERE client_id = $1 AND frequency = 'daily' AND occurrence_date = $2 AND status = 'pending'`,
    [clientId, holidayDate]
  );

  // Weekly items that include this date become exempt
  await pool.query(
    `UPDATE checklist_occurrences 
     SET status = 'exempt', exemption_reason = 'Holiday in period', updated_at = CURRENT_TIMESTAMP
     WHERE client_id = $1 AND frequency = 'weekly' 
     AND $2 BETWEEN occurrence_date AND period_end_date AND status = 'pending'`,
    [clientId, holidayDate]
  );

  // Monthly items that include this date become exempt
  await pool.query(
    `UPDATE checklist_occurrences 
     SET status = 'exempt', exemption_reason = 'Holiday in period', updated_at = CURRENT_TIMESTAMP
     WHERE client_id = $1 AND frequency = 'monthly' 
     AND $2 BETWEEN occurrence_date AND period_end_date AND status = 'pending'`,
    [clientId, holidayDate]
  );
}

/**
 * Revert occurrences when holiday is removed
 */
async function revertHolidayAffectedOccurrences(clientId, holidayDate) {
  // Check if there are other holidays in the same periods
  // Only revert if no other holidays affect the occurrence
  
  // Daily - simple revert
  await pool.query(
    `UPDATE checklist_occurrences 
     SET status = 'pending', exemption_reason = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE client_id = $1 AND frequency = 'daily' AND occurrence_date = $2 
     AND status = 'exempt' AND exemption_reason = 'Holiday'`,
    [clientId, holidayDate]
  );

  // Weekly/Monthly - only revert if no other holidays in period
  await pool.query(
    `UPDATE checklist_occurrences co
     SET status = 'pending', exemption_reason = NULL, updated_at = CURRENT_TIMESTAMP
     WHERE co.client_id = $1 
     AND co.frequency IN ('weekly', 'monthly')
     AND $2 BETWEEN co.occurrence_date AND co.period_end_date
     AND co.status = 'exempt'
     AND co.exemption_reason = 'Holiday in period'
     AND NOT EXISTS (
       SELECT 1 FROM client_holidays ch 
       WHERE ch.client_id = $1 
       AND ch.holiday_date BETWEEN co.occurrence_date AND co.period_end_date
       AND ch.holiday_date != $2
     )`,
    [clientId, holidayDate]
  );
}

// ============================================
// OCCURRENCES
// ============================================

/**
 * Generate occurrences for a checklist item
 */
async function generateOccurrencesForItem(client, item, endDate = null) {
  const {
    id: itemId,
    client_id: clientId,
    workspace_id: workspaceId,
    frequency,
    effective_from: effectiveFrom,
    weekly_schedule_type: weeklyScheduleType = 'any_day',
    weekly_day_of_week: weeklyDayOfWeek,
    monthly_schedule_type: monthlyScheduleType = 'any_day',
    monthly_day_of_month: monthlyDayOfMonth
  } = item;
  
  // Default to end of next month if not specified
  const end = endDate || getMonthEnd(new Date(new Date().getFullYear(), new Date().getMonth() + 1, 1).toISOString());
  
  // Get client settings for weekend exemption
  const settingsResult = await client.query(
    'SELECT weekend_exemption FROM client_checklist_settings WHERE client_id = $1',
    [clientId]
  );
  const weekendExemption = settingsResult.rows[0]?.weekend_exemption || false;

  // Get holidays for the date range
  const holidaysResult = await client.query(
    'SELECT holiday_date FROM client_holidays WHERE client_id = $1 AND holiday_date >= $2 AND holiday_date <= $3',
    [clientId, effectiveFrom, end]
  );
  const holidays = new Set(holidaysResult.rows.map(h => {
    // Handle both string and Date types for holiday_date
    const date = h.holiday_date instanceof Date ? h.holiday_date : new Date(h.holiday_date);
    return date.toISOString().split('T')[0];
  }));

  let currentDate = new Date(effectiveFrom);
  const endDateObj = new Date(end);

  while (currentDate <= endDateObj) {
    let occurrenceDate, periodEndDate, status = 'pending', exemptionReason = null;
    const currentDateStr = currentDate.toISOString().split('T')[0];

    if (frequency === 'daily') {
      occurrenceDate = currentDateStr;
      periodEndDate = occurrenceDate;

      // Check weekend exemption
      if (weekendExemption && isWeekend(occurrenceDate)) {
        status = 'exempt';
        exemptionReason = 'Weekend';
      }
      // Check holiday
      else if (holidays.has(occurrenceDate)) {
        status = 'exempt';
        exemptionReason = 'Holiday';
      }

      currentDate.setDate(currentDate.getDate() + 1);
    } 
    else if (frequency === 'weekly') {
      const weekStartStr = getWeekStart(currentDateStr);
      const weekEndStr = getWeekEnd(currentDateStr);

      if (weeklyScheduleType === 'specific_day') {
        const weekStartDate = new Date(weekStartStr);
        const targetDow = clampNumber(
          Number.isInteger(weeklyDayOfWeek) ? weeklyDayOfWeek : 1,
          0,
          6
        );
        const offset = (targetDow - weekStartDate.getDay() + 7) % 7;
        const targetDate = new Date(weekStartDate);
        targetDate.setDate(targetDate.getDate() + offset);

        occurrenceDate = targetDate.toISOString().split('T')[0];
        periodEndDate = occurrenceDate;

        if (occurrenceDate < effectiveFrom) {
          currentDate = new Date(weekEndStr);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        if (holidays.has(occurrenceDate)) {
          status = 'exempt';
          exemptionReason = 'Holiday';
        }
      } else {
        occurrenceDate = weekStartStr;
        periodEndDate = weekEndStr;

        // Check if any holiday in the week
        const weekStartDate = new Date(occurrenceDate);
        const weekEndDate = new Date(periodEndDate);
        for (let d = new Date(weekStartDate); d <= weekEndDate; d.setDate(d.getDate() + 1)) {
          if (holidays.has(d.toISOString().split('T')[0])) {
            status = 'exempt';
            exemptionReason = 'Holiday in period';
            break;
          }
        }
      }

      // Move to next week
      currentDate = new Date(weekEndStr);
      currentDate.setDate(currentDate.getDate() + 1);
    } 
    else if (frequency === 'monthly') {
      const monthStartStr = getMonthStart(currentDateStr);
      const monthEndStr = getMonthEnd(currentDateStr);

      if (monthlyScheduleType === 'month_end') {
        occurrenceDate = monthEndStr;
        periodEndDate = occurrenceDate;

        if (occurrenceDate < effectiveFrom) {
          currentDate = new Date(monthEndStr);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        if (holidays.has(occurrenceDate)) {
          status = 'exempt';
          exemptionReason = 'Holiday';
        }
      } else if (monthlyScheduleType === 'specific_day') {
        const monthStartDate = new Date(monthStartStr);
        const monthEndDate = new Date(monthEndStr);
        const rawDay = Number.isInteger(monthlyDayOfMonth) ? monthlyDayOfMonth : 1;
        const targetDay = clampNumber(rawDay, 1, monthEndDate.getDate());
        const targetDate = new Date(monthStartDate.getFullYear(), monthStartDate.getMonth(), targetDay);

        occurrenceDate = targetDate.toISOString().split('T')[0];
        periodEndDate = occurrenceDate;

        if (occurrenceDate < effectiveFrom) {
          currentDate = new Date(monthEndStr);
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }

        if (holidays.has(occurrenceDate)) {
          status = 'exempt';
          exemptionReason = 'Holiday';
        }
      } else {
        occurrenceDate = monthStartStr;
        periodEndDate = monthEndStr;

        // Check if any holiday in the month
        const monthStartDate = new Date(occurrenceDate);
        const monthEndDate = new Date(periodEndDate);
        for (let d = new Date(monthStartDate); d <= monthEndDate; d.setDate(d.getDate() + 1)) {
          if (holidays.has(d.toISOString().split('T')[0])) {
            status = 'exempt';
            exemptionReason = 'Holiday in period';
            break;
          }
        }
      }

      // Move to next month
      currentDate = new Date(monthEndStr);
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Insert occurrence (ignore if already exists)
    await client.query(
      `INSERT INTO checklist_occurrences 
       (checklist_item_id, client_id, workspace_id, occurrence_date, period_end_date, frequency, status, exemption_reason)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (checklist_item_id, occurrence_date) DO NOTHING`,
      [itemId, clientId, workspaceId, occurrenceDate, periodEndDate, frequency, status, exemptionReason]
    );
  }
}

/**
 * Get occurrences for monthly grid view
 */
async function getOccurrencesForGrid(workspaceId, clientId, year, month, options = {}) {
  const { assigneeId, frequency, category, status: statusFilter } = options;

  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = getMonthEnd(startDate);

  let query = `
    SELECT 
      co.*,
      ci.title,
      ci.description,
      ci.category,
      ci.completion_rule,
      ci.remarks_required,
      ci.weekly_schedule_type,
      ci.weekly_day_of_week,
      ci.monthly_schedule_type,
      ci.monthly_day_of_month,
      c.client_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cc.id,
          'user_id', cc.user_id,
          'username', u.username,
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'confirmed_at', cc.confirmed_at,
          'confirmation_date', cc.confirmation_date,
          'remarks', cc.remarks,
          'is_late_confirm', cc.is_late_confirm
        )), '[]'::json)
        FROM checklist_confirmations cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.occurrence_id = co.id
      ) as confirmations,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'user_id', ca.user_id,
          'username', u.username,
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'assignment_role', ca.assignment_role
        ) ORDER BY
          CASE WHEN ca.assignment_role = 'primary' THEN 0 ELSE 1 END,
          COALESCE(u.first_name || ' ' || u.last_name, u.username)
        ), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
        AND ca.assigned_from <= co.occurrence_date
        AND (ca.assigned_to IS NULL OR ca.assigned_to >= co.period_end_date)
      ) as assignees,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cf.id,
          'label', cf.label,
          'field_type', cf.field_type,
          'required', cf.required,
          'options', cf.options,
          'display_order', cf.display_order,
          'effective_from', cf.effective_from,
          'disabled_from', cf.disabled_from,
          'value_text', ccfv.value_text,
          'value_number', ccfv.value_number,
          'value_date', ccfv.value_date,
          'value_boolean', ccfv.value_boolean,
          'value_json', ccfv.value_json,
          'updated_by', ccfv.updated_by,
          'updated_at', ccfv.updated_at,
          'updated_by_name', COALESCE(uv.first_name || ' ' || uv.last_name, uv.username)
        ) ORDER BY cf.display_order, cf.id), '[]'::json)
        FROM checklist_item_custom_fields cf
        LEFT JOIN checklist_occurrence_custom_field_values ccfv
          ON ccfv.field_id = cf.id
         AND ccfv.occurrence_id = co.id
        LEFT JOIN users uv ON uv.id = ccfv.updated_by
        WHERE cf.checklist_item_id = ci.id
          AND cf.is_active = TRUE
          AND cf.effective_from <= co.occurrence_date
          AND (cf.disabled_from IS NULL OR co.occurrence_date < cf.disabled_from OR ccfv.id IS NOT NULL)
      ) as custom_fields
    FROM checklist_occurrences co
    JOIN checklist_items ci ON co.checklist_item_id = ci.id
    JOIN clients c ON co.client_id = c.id
    WHERE co.workspace_id = $1 
    AND co.client_id = $2
    AND co.occurrence_date >= $3
    AND co.occurrence_date <= $4
  `;

  const params = [workspaceId, clientId, startDate, endDate];
  let paramIndex = 5;

  if (frequency) {
    query += ` AND co.frequency = $${paramIndex}`;
    params.push(frequency);
    paramIndex++;
  }

  if (category) {
    query += ` AND ci.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (statusFilter) {
    query += ` AND co.status = $${paramIndex}`;
    params.push(statusFilter);
    paramIndex++;
  }

  if (assigneeId) {
    query += ` AND EXISTS (
      SELECT 1 FROM checklist_assignments ca2 
      WHERE ca2.checklist_item_id = ci.id 
      AND ca2.user_id = $${paramIndex} 
      AND ca2.is_active = TRUE
      AND ca2.assigned_from <= co.occurrence_date
      AND (ca2.assigned_to IS NULL OR ca2.assigned_to >= co.period_end_date)
    )`;
    params.push(assigneeId);
    paramIndex++;
  }

  query += ' ORDER BY ci.category, ci.title, co.occurrence_date';

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get today's pending items for a user
 */
async function getTodaysItems(workspaceId, userId, clientId = null, options = {}) {
  const {
    allowedClientIds = null,
    includeSecondary = false
  } = options;
  const timezone = await getWorkspaceTimezone(workspaceId);
  const today = getCurrentDateInTimezone(timezone);

  let query = `
    SELECT 
      co.*,
      ci.title,
      ci.description,
      ci.category,
      ci.completion_rule,
      ci.remarks_required,
      ci.weekly_schedule_type,
      ci.weekly_day_of_week,
      ci.monthly_schedule_type,
      ci.monthly_day_of_month,
      c.client_name,
      ac.my_assignment_role,
      ac.active_primary_assignee_count,
      ac.active_secondary_assignee_count,
      CASE
        WHEN ac.active_primary_assignee_count > 0 THEN ac.active_primary_assignee_count
        ELSE ac.active_secondary_assignee_count
      END as required_confirmation_count,
      (
        SELECT COUNT(DISTINCT cc2.user_id)::int
        FROM checklist_confirmations cc2
        JOIN checklist_assignments ca3 ON ca3.checklist_item_id = ci.id
         AND ca3.user_id = cc2.user_id
         AND ca3.is_active = TRUE
         AND ca3.assigned_from <= co.occurrence_date
         AND (ca3.assigned_to IS NULL OR ca3.assigned_to >= co.period_end_date)
        WHERE cc2.occurrence_id = co.id
          AND (
            (ac.active_primary_assignee_count > 0 AND ca3.assignment_role = 'primary')
            OR (ac.active_primary_assignee_count = 0 AND ca3.assignment_role = 'secondary')
          )
      ) as eligible_confirmation_count,
      CASE
        WHEN ac.my_assignment_role = 'primary' THEN TRUE
        WHEN ac.my_assignment_role = 'secondary' AND ac.active_primary_assignee_count = 0 THEN TRUE
        ELSE FALSE
      END as can_current_user_confirm,
      CASE
        WHEN ac.my_assignment_role = 'secondary' AND ac.active_primary_assignee_count > 0 THEN TRUE
        ELSE FALSE
      END as waiting_for_primary,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cc.id,
          'user_id', cc.user_id,
          'username', u.username,
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'confirmed_at', cc.confirmed_at,
          'remarks', cc.remarks
        )), '[]'::json)
        FROM checklist_confirmations cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.occurrence_id = co.id
      ) as confirmations,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'user_id', ca2.user_id,
          'username', u.username,
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'assignment_role', ca2.assignment_role
        ) ORDER BY
          CASE WHEN ca2.assignment_role = 'primary' THEN 0 ELSE 1 END,
          COALESCE(u.first_name || ' ' || u.last_name, u.username)
        ), '[]'::json)
        FROM checklist_assignments ca2
        JOIN users u ON ca2.user_id = u.id
        WHERE ca2.checklist_item_id = ci.id
          AND ca2.is_active = TRUE
          AND ca2.assigned_from <= co.occurrence_date
          AND (ca2.assigned_to IS NULL OR ca2.assigned_to >= co.period_end_date)
      ) as assignees,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cf.id,
          'label', cf.label,
          'field_type', cf.field_type,
          'required', cf.required,
          'options', cf.options,
          'display_order', cf.display_order,
          'effective_from', cf.effective_from,
          'disabled_from', cf.disabled_from,
          'value_text', ccfv.value_text,
          'value_number', ccfv.value_number,
          'value_date', ccfv.value_date,
          'value_boolean', ccfv.value_boolean,
          'value_json', ccfv.value_json,
          'updated_by', ccfv.updated_by,
          'updated_at', ccfv.updated_at,
          'updated_by_name', COALESCE(uv.first_name || ' ' || uv.last_name, uv.username)
        ) ORDER BY cf.display_order, cf.id), '[]'::json)
        FROM checklist_item_custom_fields cf
        LEFT JOIN checklist_occurrence_custom_field_values ccfv
          ON ccfv.field_id = cf.id
         AND ccfv.occurrence_id = co.id
        LEFT JOIN users uv ON uv.id = ccfv.updated_by
        WHERE cf.checklist_item_id = ci.id
          AND cf.is_active = TRUE
          AND cf.effective_from <= co.occurrence_date
          AND (cf.disabled_from IS NULL OR co.occurrence_date < cf.disabled_from OR ccfv.id IS NOT NULL)
      ) as custom_fields
    FROM checklist_occurrences co
    JOIN checklist_items ci ON co.checklist_item_id = ci.id
    JOIN clients c ON co.client_id = c.id
    JOIN LATERAL (
      SELECT
        COALESCE(
          MAX(CASE WHEN ca.user_id = $2 AND ca.assignment_role = 'primary' THEN 'primary' END),
          MAX(CASE WHEN ca.user_id = $2 AND ca.assignment_role = 'secondary' THEN 'secondary' END)
        ) as my_assignment_role,
        COUNT(*) FILTER (WHERE ca.assignment_role = 'primary')::int as active_primary_assignee_count,
        COUNT(*) FILTER (WHERE ca.assignment_role = 'secondary')::int as active_secondary_assignee_count
      FROM checklist_assignments ca
      WHERE ca.checklist_item_id = ci.id
        AND ca.is_active = TRUE
        AND ca.assigned_from <= $3
        AND (ca.assigned_to IS NULL OR ca.assigned_to >= $3)
    ) ac ON TRUE
    WHERE co.workspace_id = $1
    AND ac.my_assignment_role IS NOT NULL
    AND ($4::boolean = TRUE OR ac.my_assignment_role = 'primary')
    AND co.status IN ('pending', 'confirmed')
    AND (
      (co.frequency = 'daily' AND co.occurrence_date = $3)
      OR (co.frequency IN ('weekly', 'monthly') AND $3 BETWEEN co.occurrence_date AND co.period_end_date)
    )
  `;

  const params = [workspaceId, userId, today, includeSecondary];
  let paramIndex = 5;

  if (clientId) {
    query += ` AND co.client_id = $${paramIndex}`;
    params.push(clientId);
    paramIndex++;
  } else if (Array.isArray(allowedClientIds)) {
    if (allowedClientIds.length === 0) {
      return [];
    }
    query += ` AND co.client_id = ANY($${paramIndex})`;
    params.push(allowedClientIds);
    paramIndex++;
  }

  query += ' ORDER BY c.client_name, ci.category, ci.title';

  const result = await pool.query(query, params);
  return result.rows;
}

// ============================================
// CONFIRMATIONS
// ============================================

async function getUserConfirmationContext(checklistItemId, userId, referenceDate) {
  const result = await pool.query(
    `SELECT
       COALESCE(
         MAX(CASE WHEN ca.user_id = $2 AND ca.assignment_role = 'primary' THEN 'primary' END),
         MAX(CASE WHEN ca.user_id = $2 AND ca.assignment_role = 'secondary' THEN 'secondary' END)
       ) as my_role,
       COUNT(*) FILTER (WHERE ca.assignment_role = 'primary')::int as active_primary_assignee_count
     FROM checklist_assignments ca
     WHERE ca.checklist_item_id = $1
       AND ca.is_active = TRUE
       AND ca.assigned_from <= $3
       AND (ca.assigned_to IS NULL OR ca.assigned_to >= $3)`,
    [checklistItemId, userId, referenceDate]
  );

  const row = result.rows[0] || {};
  const myRole = row.my_role || null;
  const activePrimaryAssigneeCount = Number.parseInt(row.active_primary_assignee_count, 10) || 0;
  const canConfirm = myRole === 'primary'
    || (myRole === 'secondary' && activePrimaryAssigneeCount === 0);

  return {
    myRole,
    activePrimaryAssigneeCount,
    canConfirm
  };
}

/**
 * Confirm an occurrence
 */
async function confirmOccurrence(occurrenceId, userId, remarks = null, workspaceId, customFieldValues = null) {
  const timezone = await getWorkspaceTimezone(workspaceId);
  const today = getCurrentDateInTimezone(timezone);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Get occurrence details
    const occResult = await client.query(
      `SELECT co.*, ci.completion_rule, ci.remarks_required
       FROM checklist_occurrences co
       JOIN checklist_items ci ON co.checklist_item_id = ci.id
       WHERE co.id = $1`,
      [occurrenceId]
    );

    if (occResult.rows.length === 0) {
      throw new Error('Occurrence not found');
    }

    const occurrence = occResult.rows[0];

    const confirmationContext = await getUserConfirmationContext(
      occurrence.checklist_item_id,
      userId,
      today
    );

    if (!confirmationContext.myRole) {
      throw new Error('User is not assigned to this item');
    }

    if (!confirmationContext.canConfirm) {
      throw new Error('Secondary assignee can confirm only when no active primary assignee is available.');
    }

    // Check if within confirmation window
    const canConfirm = await isWithinConfirmationWindow(occurrence, today);
    if (!canConfirm) {
      throw new Error('Confirmation window has passed. Contact admin for late confirmation.');
    }

    // Check if remarks required
    if (occurrence.remarks_required && (!remarks || remarks.trim() === '')) {
      throw new Error('Remarks are required for this item');
    }

    // Check if already confirmed by this user
    const existingResult = await client.query(
      'SELECT id FROM checklist_confirmations WHERE occurrence_id = $1 AND user_id = $2',
      [occurrenceId, userId]
    );

    if (existingResult.rows.length > 0) {
      throw new Error('You have already confirmed this item. Only admin can modify confirmations.');
    }

    // Validate and persist custom fields before confirmation is recorded.
    await upsertOccurrenceCustomFieldValues({
      db: client,
      occurrenceId,
      actorUserId: userId,
      customFieldValues,
      requireRequired: true
    });

    // Insert new confirmation
    await client.query(
      `INSERT INTO checklist_confirmations (occurrence_id, user_id, remarks, confirmation_date)
       VALUES ($1, $2, $3, $4)`,
      [occurrenceId, userId, remarks, today]
    );

    // Update occurrence status based on completion rule
    await updateOccurrenceStatus(occurrenceId, client);

    await client.query('COMMIT');
    return await getOccurrenceById(occurrenceId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/**
 * Admin override confirmation (insert/update remarks for a specific user)
 */
async function adminUpdateConfirmation(
  occurrenceId,
  targetUserId,
  remarks = null,
  adminId,
  workspaceId,
  customFieldValues = null
) {
  const timezone = await getWorkspaceTimezone(workspaceId);
  const today = getCurrentDateInTimezone(timezone);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Validate occurrence and checklist item
    const occResult = await client.query(
      `SELECT co.id, co.checklist_item_id
       FROM checklist_occurrences co
       WHERE co.id = $1`,
      [occurrenceId]
    );

    if (occResult.rows.length === 0) {
      throw new Error('Occurrence not found');
    }

    const checklistItemId = occResult.rows[0].checklist_item_id;
    const isAssigned = await isAssignedToItem(targetUserId, checklistItemId, today);
    if (!isAssigned) {
      throw new Error('Target user is not assigned to this checklist item');
    }

    await upsertOccurrenceCustomFieldValues({
      db: client,
      occurrenceId,
      actorUserId: adminId,
      customFieldValues,
      requireRequired: true
    });

    const existingResult = await client.query(
      'SELECT id FROM checklist_confirmations WHERE occurrence_id = $1 AND user_id = $2',
      [occurrenceId, targetUserId]
    );

    if (existingResult.rows.length > 0) {
      await client.query(
        'UPDATE checklist_confirmations SET remarks = $3 WHERE occurrence_id = $1 AND user_id = $2',
        [occurrenceId, targetUserId, remarks]
      );
    } else {
      await client.query(
        `INSERT INTO checklist_confirmations (occurrence_id, user_id, remarks, confirmation_date)
         VALUES ($1, $2, $3, $4)`,
        [occurrenceId, targetUserId, remarks, today]
      );
    }

    await client.query(
      `INSERT INTO checklist_audit_log (occurrence_id, action, performed_by, reason)
       VALUES ($1, 'admin_update_confirmation', $2, $3)`,
      [occurrenceId, adminId, 'Admin updated confirmation details']
    );

    await updateOccurrenceStatus(occurrenceId, client);
    await client.query('COMMIT');
    return await getOccurrenceById(occurrenceId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getPrimaryAssigneesForOccurrence(occurrenceId) {
  const result = await pool.query(
    `SELECT DISTINCT ca.user_id
     FROM checklist_occurrences co
     JOIN checklist_assignments ca ON ca.checklist_item_id = co.checklist_item_id
     WHERE co.id = $1
       AND ca.assignment_role = 'primary'
       AND ca.is_active = TRUE
       AND ca.assigned_from <= co.occurrence_date
       AND (ca.assigned_to IS NULL OR ca.assigned_to >= co.period_end_date)`,
    [occurrenceId]
  );

  return result.rows.map((row) => row.user_id);
}

async function adminUpdateOccurrenceCustomFields(occurrenceId, customFieldValues, adminId, workspaceId) {
  const timezone = await getWorkspaceTimezone(workspaceId);
  const today = getCurrentDateInTimezone(timezone);
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const occurrenceResult = await client.query(
      `SELECT co.id, co.workspace_id, co.client_id, co.occurrence_date, ci.title
       FROM checklist_occurrences co
       JOIN checklist_items ci ON ci.id = co.checklist_item_id
       WHERE co.id = $1`,
      [occurrenceId]
    );

    if (occurrenceResult.rows.length === 0) {
      throw new Error('Occurrence not found');
    }

    await upsertOccurrenceCustomFieldValues({
      db: client,
      occurrenceId,
      actorUserId: adminId,
      customFieldValues,
      requireRequired: true
    });

    await client.query(
      `INSERT INTO checklist_audit_log (occurrence_id, action, performed_by, reason, metadata)
       VALUES ($1, 'admin_update_custom_fields', $2, $3, $4::jsonb)`,
      [
        occurrenceId,
        adminId,
        'Admin updated checklist custom field values',
        JSON.stringify({
          updatedAt: today
        })
      ]
    );

    await client.query('COMMIT');

    const primaryAssigneeIds = await getPrimaryAssigneesForOccurrence(occurrenceId);
    return {
      occurrence: await getOccurrenceById(occurrenceId),
      primaryAssigneeIds
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function deactivateItemCustomField(itemId, fieldId, disabledFrom, actorUserId) {
  if (!disabledFrom || !isValidDateString(disabledFrom)) {
    throw new Error('A valid apply-from date is required');
  }

  const result = await pool.query(
    `UPDATE checklist_item_custom_fields
     SET disabled_from = $3,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND checklist_item_id = $2
       AND is_active = TRUE
     RETURNING *`,
    [fieldId, itemId, disabledFrom]
  );

  if (result.rows.length === 0) {
    throw new Error('Custom field not found for this checklist item');
  }

  const field = result.rows[0];
  await pool.query(
    `INSERT INTO checklist_audit_log (occurrence_id, action, performed_by, reason, metadata)
     SELECT
       co.id,
       'custom_field_deactivated',
       $3,
       $4,
       $5::jsonb
     FROM checklist_occurrences co
     WHERE co.checklist_item_id = $1
       AND co.occurrence_date >= $2`,
    [
      itemId,
      disabledFrom,
      actorUserId,
      `Custom field "${field.label}" disabled for future occurrences`,
      JSON.stringify({
        fieldId: field.id,
        label: field.label,
        disabledFrom
      })
    ]
  );

  return field;
}

/**
 * Admin late confirm
 */
async function lateConfirmOccurrence(occurrenceId, userId, reason, adminId, workspaceId) {
  const timezone = await getWorkspaceTimezone(workspaceId);
  const today = getCurrentDateInTimezone(timezone);

  // Get occurrence
  const occResult = await pool.query(
    'SELECT * FROM checklist_occurrences WHERE id = $1',
    [occurrenceId]
  );

  if (occResult.rows.length === 0) {
    throw new Error('Occurrence not found');
  }

  const occurrence = occResult.rows[0];
  const previousStatus = occurrence.status;

  // Insert/update confirmation with late flag
  await pool.query(
    `INSERT INTO checklist_confirmations 
     (occurrence_id, user_id, confirmation_date, is_late_confirm, late_confirm_reason, late_confirmed_by)
     VALUES ($1, $2, $3, TRUE, $4, $5)
     ON CONFLICT (occurrence_id, user_id) 
     DO UPDATE SET is_late_confirm = TRUE, late_confirm_reason = $4, late_confirmed_by = $5`,
    [occurrenceId, userId, today, reason, adminId]
  );

  // Update occurrence status to late_confirmed
  await pool.query(
    `UPDATE checklist_occurrences SET status = 'late_confirmed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
    [occurrenceId]
  );

  // Add audit log
  await pool.query(
    `INSERT INTO checklist_audit_log 
     (occurrence_id, action, performed_by, previous_status, new_status, reason)
     VALUES ($1, 'late_confirm', $2, $3, 'late_confirmed', $4)`,
    [occurrenceId, adminId, previousStatus, reason]
  );

  return await getOccurrenceById(occurrenceId);
}

/**
 * Check if within confirmation window
 */
async function isWithinConfirmationWindow(occurrence, currentDate) {
  const { frequency, occurrence_date: occDate, period_end_date: periodEnd } = occurrence;
  const current = new Date(currentDate);
  const start = new Date(occDate);
  const end = new Date(periodEnd);

  if (frequency === 'daily') {
    // Daily: only same day
    return current.toISOString().split('T')[0] === start.toISOString().split('T')[0];
  } else {
    // Weekly/Monthly: within the period
    return current >= start && current <= end;
  }
}

/**
 * Update occurrence status based on confirmations
 */
async function updateOccurrenceStatus(occurrenceId, db = pool) {
  const result = await db.query(
    `SELECT
       co.*,
       ci.completion_rule,
       assignment_counts.primary_assignees,
       assignment_counts.secondary_assignees,
       CASE
         WHEN assignment_counts.primary_assignees > 0 THEN assignment_counts.primary_assignees
         ELSE assignment_counts.secondary_assignees
       END as total_assignees,
       (
         SELECT COUNT(DISTINCT cc.user_id)::int
         FROM checklist_confirmations cc
         JOIN checklist_assignments ca ON ca.checklist_item_id = ci.id
          AND ca.user_id = cc.user_id
          AND ca.is_active = TRUE
          AND ca.assigned_from <= co.occurrence_date
          AND (ca.assigned_to IS NULL OR ca.assigned_to >= co.period_end_date)
         WHERE cc.occurrence_id = co.id
           AND (
             (assignment_counts.primary_assignees > 0 AND ca.assignment_role = 'primary')
             OR (assignment_counts.primary_assignees = 0 AND ca.assignment_role = 'secondary')
           )
       ) as total_confirmations
     FROM checklist_occurrences co
     JOIN checklist_items ci ON co.checklist_item_id = ci.id
     JOIN LATERAL (
       SELECT
         COUNT(*) FILTER (WHERE ca.assignment_role = 'primary')::int as primary_assignees,
         COUNT(*) FILTER (WHERE ca.assignment_role = 'secondary')::int as secondary_assignees
       FROM checklist_assignments ca
       WHERE ca.checklist_item_id = ci.id
         AND ca.is_active = TRUE
         AND ca.assigned_from <= co.occurrence_date
         AND (ca.assigned_to IS NULL OR ca.assigned_to >= co.period_end_date)
     ) assignment_counts ON TRUE
     WHERE co.id = $1`,
    [occurrenceId]
  );

  if (result.rows.length === 0) return;

  const { completion_rule, total_assignees, total_confirmations, status } = result.rows[0];

  if (status === 'exempt' || status === 'late_confirmed') return;

  let newStatus = 'pending';

  if (total_assignees > 0) {
    if (completion_rule === 'any' && total_confirmations > 0) {
      newStatus = 'confirmed';
    } else if (completion_rule === 'all' && total_confirmations >= total_assignees) {
      newStatus = 'confirmed';
    }
  }

  if (newStatus !== status) {
    await db.query(
      'UPDATE checklist_occurrences SET status = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
      [occurrenceId, newStatus]
    );
  }
}

/**
 * Get occurrence by ID
 */
async function getOccurrenceById(occurrenceId) {
  const result = await pool.query(
    `SELECT 
      co.*,
      ci.title,
      ci.description,
      ci.category,
      ci.completion_rule,
      ci.remarks_required,
      ci.weekly_schedule_type,
      ci.weekly_day_of_week,
      ci.monthly_schedule_type,
      ci.monthly_day_of_month,
      c.client_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cc.id,
          'user_id', cc.user_id,
          'username', u.username,
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'confirmed_at', cc.confirmed_at,
          'confirmation_date', cc.confirmation_date,
          'remarks', cc.remarks,
          'is_late_confirm', cc.is_late_confirm,
          'late_confirm_reason', cc.late_confirm_reason
        )), '[]'::json)
        FROM checklist_confirmations cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.occurrence_id = co.id
      ) as confirmations,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'user_id', ca.user_id,
          'username', u.username,
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'assignment_role', ca.assignment_role
        ) ORDER BY
          CASE WHEN ca.assignment_role = 'primary' THEN 0 ELSE 1 END,
          COALESCE(u.first_name || ' ' || u.last_name, u.username)
        ), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
      ) as assignees,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', cf.id,
          'label', cf.label,
          'field_type', cf.field_type,
          'required', cf.required,
          'options', cf.options,
          'display_order', cf.display_order,
          'effective_from', cf.effective_from,
          'disabled_from', cf.disabled_from,
          'value_text', ccfv.value_text,
          'value_number', ccfv.value_number,
          'value_date', ccfv.value_date,
          'value_boolean', ccfv.value_boolean,
          'value_json', ccfv.value_json,
          'updated_by', ccfv.updated_by,
          'updated_at', ccfv.updated_at,
          'updated_by_name', COALESCE(uv.first_name || ' ' || uv.last_name, uv.username)
        ) ORDER BY cf.display_order, cf.id), '[]'::json)
        FROM checklist_item_custom_fields cf
        LEFT JOIN checklist_occurrence_custom_field_values ccfv
          ON ccfv.field_id = cf.id
         AND ccfv.occurrence_id = co.id
        LEFT JOIN users uv ON uv.id = ccfv.updated_by
        WHERE cf.checklist_item_id = ci.id
          AND cf.is_active = TRUE
          AND cf.effective_from <= co.occurrence_date
          AND (cf.disabled_from IS NULL OR co.occurrence_date < cf.disabled_from OR ccfv.id IS NOT NULL)
      ) as custom_fields
    FROM checklist_occurrences co
    JOIN checklist_items ci ON co.checklist_item_id = ci.id
    JOIN clients c ON co.client_id = c.id
    WHERE co.id = $1`,
    [occurrenceId]
  );
  return result.rows[0];
}

// ============================================
// REPORTING
// ============================================

/**
 * Get summary report
 */
async function getSummaryReport(workspaceId, options = {}) {
  const { clientId, year, month, frequency, allowedClientIds = null } = options;

  let whereClause = 'WHERE co.workspace_id = $1';
  const params = [workspaceId];
  let paramIndex = 2;

  if (clientId) {
    whereClause += ` AND co.client_id = $${paramIndex}`;
    params.push(clientId);
    paramIndex++;
  } else if (Array.isArray(allowedClientIds)) {
    if (allowedClientIds.length === 0) {
      return [];
    }
    whereClause += ` AND co.client_id = ANY($${paramIndex})`;
    params.push(allowedClientIds);
    paramIndex++;
  }

  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = getMonthEnd(startDate);
    whereClause += ` AND co.occurrence_date >= $${paramIndex} AND co.occurrence_date <= $${paramIndex + 1}`;
    params.push(startDate, endDate);
    paramIndex += 2;
  } else if (year) {
    whereClause += ` AND EXTRACT(YEAR FROM co.occurrence_date) = $${paramIndex}`;
    params.push(year);
    paramIndex++;
  }

  if (frequency) {
    whereClause += ` AND co.frequency = $${paramIndex}`;
    params.push(frequency);
    paramIndex++;
  }

  const query = `
    SELECT 
      co.client_id,
      c.client_name,
      co.frequency,
      COUNT(*) as total_items,
      COUNT(*) FILTER (WHERE co.status = 'confirmed') as confirmed,
      COUNT(*) FILTER (WHERE co.status = 'missed') as missed,
      COUNT(*) FILTER (WHERE co.status = 'late_confirmed') as late_confirmed,
      COUNT(*) FILTER (WHERE co.status = 'exempt') as exempt,
      COUNT(*) FILTER (WHERE co.status = 'pending') as pending,
      ROUND(
        (COUNT(*) FILTER (WHERE co.status IN ('confirmed', 'late_confirmed'))::NUMERIC / 
         NULLIF(COUNT(*) FILTER (WHERE co.status != 'exempt'), 0) * 100), 2
      ) as completion_percentage
    FROM checklist_occurrences co
    JOIN clients c ON co.client_id = c.id
    ${whereClause}
    GROUP BY co.client_id, c.client_name, co.frequency
    ORDER BY c.client_name, co.frequency
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get detailed report
 */
async function getDetailedReport(workspaceId, options = {}) {
  const { clientId, year, month, frequency, status, category, allowedClientIds = null } = options;

  let whereClause = 'WHERE co.workspace_id = $1';
  const params = [workspaceId];
  let paramIndex = 2;

  if (clientId) {
    whereClause += ` AND co.client_id = $${paramIndex}`;
    params.push(clientId);
    paramIndex++;
  } else if (Array.isArray(allowedClientIds)) {
    if (allowedClientIds.length === 0) {
      return [];
    }
    whereClause += ` AND co.client_id = ANY($${paramIndex})`;
    params.push(allowedClientIds);
    paramIndex++;
  }

  if (year && month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = getMonthEnd(startDate);
    whereClause += ` AND co.occurrence_date >= $${paramIndex} AND co.occurrence_date <= $${paramIndex + 1}`;
    params.push(startDate, endDate);
    paramIndex += 2;
  }

  if (frequency) {
    whereClause += ` AND co.frequency = $${paramIndex}`;
    params.push(frequency);
    paramIndex++;
  }

  if (status) {
    whereClause += ` AND co.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (category) {
    whereClause += ` AND ci.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  const query = `
    SELECT 
      co.*,
      ci.title,
      ci.category,
      c.client_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'confirmed_at', cc.confirmed_at,
          'remarks', cc.remarks,
          'is_late_confirm', cc.is_late_confirm
        )), '[]'::json)
        FROM checklist_confirmations cc
        JOIN users u ON cc.user_id = u.id
        WHERE cc.occurrence_id = co.id
      ) as confirmations
    FROM checklist_occurrences co
    JOIN checklist_items ci ON co.checklist_item_id = ci.id
    JOIN clients c ON co.client_id = c.id
    ${whereClause}
    ORDER BY c.client_name, co.occurrence_date, ci.title
  `;

  const result = await pool.query(query, params);
  return result.rows;
}

/**
 * Get user performance report
 */
async function getUserPerformanceReport(workspaceId, options = {}) {
  const { clientId, startDate: startDateParam, endDate: endDateParam, allowedClientIds = null } = options;
  
  // Default to current month if no dates provided
  const now = new Date();
  const startDate = startDateParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const endDate = endDateParam || getMonthEnd(startDate);

  let query = `
    SELECT 
      ca.user_id,
      u.email,
      COALESCE(u.first_name || ' ' || u.last_name, u.username) as name,
      COUNT(DISTINCT co.id) as assigned,
      COUNT(DISTINCT CASE WHEN cc.id IS NOT NULL AND cc.is_late_confirm IS NOT TRUE THEN co.id END) as on_time,
      COUNT(DISTINCT CASE WHEN cc.is_late_confirm = TRUE THEN co.id END) as late,
      COUNT(DISTINCT CASE WHEN co.status = 'missed' AND cc.id IS NULL THEN co.id END) as missed,
      ROUND(
        (COUNT(DISTINCT cc.id)::NUMERIC / NULLIF(COUNT(DISTINCT co.id), 0) * 100), 2
      ) as rate
    FROM checklist_assignments ca
    JOIN checklist_items ci ON ca.checklist_item_id = ci.id
    JOIN clients c ON ci.client_id = c.id
    JOIN checklist_occurrences co ON ci.id = co.checklist_item_id
    JOIN users u ON ca.user_id = u.id
    LEFT JOIN checklist_confirmations cc ON co.id = cc.occurrence_id AND ca.user_id = cc.user_id
    WHERE c.workspace_id = $1
    AND ca.is_active = TRUE
    AND co.occurrence_date >= $2
    AND co.occurrence_date <= $3
    AND ca.assigned_from <= co.occurrence_date
    AND (ca.assigned_to IS NULL OR ca.assigned_to >= co.period_end_date)
  `;

  const params = [workspaceId, startDate, endDate];
  
  if (clientId) {
    query += ` AND ci.client_id = $${params.length + 1}`;
    params.push(clientId);
  } else if (Array.isArray(allowedClientIds)) {
    if (allowedClientIds.length === 0) {
      return [];
    }
    query += ` AND ci.client_id = ANY($${params.length + 1})`;
    params.push(allowedClientIds);
  }

  query += ` GROUP BY ca.user_id, u.email, u.first_name, u.last_name, u.username
    ORDER BY name`;

  const result = await pool.query(query, params);
  return result.rows;
}

// ============================================
// CATEGORIES
// ============================================

/**
 * Get categories for workspace
 */
async function getCategories(workspaceId) {
  const result = await pool.query(
    'SELECT * FROM checklist_categories WHERE workspace_id = $1 AND is_active = TRUE ORDER BY display_order, name',
    [workspaceId]
  );
  return result.rows;
}

/**
 * Create category
 */
async function createCategory(workspaceId, name, color, icon) {
  const result = await pool.query(
    `INSERT INTO checklist_categories (workspace_id, name, color, icon)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [workspaceId, name, color, icon]
  );
  return result.rows[0];
}

// ============================================
// MISSED ITEMS PROCESSING (Called by Job)
// ============================================

/**
 * Mark overdue occurrences as missed
 */
async function processOverdueOccurrences() {
  // Get all workspaces with their timezones
  const workspaces = await pool.query('SELECT id, timezone FROM workspaces');

  for (const workspace of workspaces.rows) {
    const today = getCurrentDateInTimezone(workspace.timezone);
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];

    // Mark daily items from yesterday as missed
    await pool.query(
      `UPDATE checklist_occurrences 
       SET status = 'missed', updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = $1 
       AND frequency = 'daily' 
       AND occurrence_date < $2
       AND status = 'pending'`,
      [workspace.id, today]
    );

    // Mark weekly items where period_end_date has passed as missed
    await pool.query(
      `UPDATE checklist_occurrences 
       SET status = 'missed', updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = $1 
       AND frequency = 'weekly' 
       AND period_end_date < $2
       AND status = 'pending'`,
      [workspace.id, today]
    );

    // Mark monthly items where period_end_date has passed as missed
    await pool.query(
      `UPDATE checklist_occurrences 
       SET status = 'missed', updated_at = CURRENT_TIMESTAMP
       WHERE workspace_id = $1 
       AND frequency = 'monthly' 
       AND period_end_date < $2
       AND status = 'pending'`,
      [workspace.id, today]
    );
  }
}

/**
 * Generate occurrences for future periods
 */
async function generateFutureOccurrences() {
  const client = await pool.connect();
  try {
    // Get all active checklist items
    const items = await client.query(
      `SELECT * FROM checklist_items 
       WHERE is_active = TRUE 
       AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)`
    );

    for (const item of items.rows) {
      await generateOccurrencesForItem(client, item);
    }
  } finally {
    client.release();
  }
}

// ============================================
// CLIENT CHECKLIST SETTINGS
// ============================================

/**
 * Get client checklist settings
 */
async function getClientChecklistSettings(clientId) {
  const result = await pool.query(
    'SELECT * FROM client_checklist_settings WHERE client_id = $1',
    [clientId]
  );
  
  if (result.rows.length === 0) {
    // Return defaults
    return { client_id: clientId, weekend_exemption: false };
  }
  
  return result.rows[0];
}

/**
 * Update client checklist settings
 */
async function updateClientChecklistSettings(clientId, settings) {
  const { weekendExemption } = settings;
  
  const result = await pool.query(
    `INSERT INTO client_checklist_settings (client_id, weekend_exemption)
     VALUES ($1, $2)
     ON CONFLICT (client_id) 
     DO UPDATE SET weekend_exemption = $2, updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [clientId, weekendExemption]
  );
  
  return result.rows[0];
}

// ============================================
// WORKSPACE CHECKLIST SETTINGS
// ============================================

/**
 * Get workspace checklist settings
 */
async function getWorkspaceChecklistSettings(workspaceId) {
  const result = await pool.query(
    'SELECT * FROM workspace_checklist_settings WHERE workspace_id = $1',
    [workspaceId]
  );
  
  if (result.rows.length === 0) {
    // Return defaults
    return { 
      workspace_id: workspaceId, 
      daily_reminder_time: '09:00',
      weekly_reminder_day: 3, // Wednesday
      monthly_reminder_day: 25,
      auto_mark_missed: true,
      allow_late_confirmation: true
    };
  }
  
  return result.rows[0];
}

/**
 * Update workspace checklist settings
 */
async function updateWorkspaceChecklistSettings(workspaceId, settings) {
  const { 
    daily_reminder_time,
    weekly_reminder_day,
    monthly_reminder_day,
    auto_mark_missed,
    allow_late_confirmation
  } = settings;
  
  const result = await pool.query(
    `INSERT INTO workspace_checklist_settings 
     (workspace_id, daily_reminder_time, weekly_reminder_day, monthly_reminder_day, auto_mark_missed, allow_late_confirmation)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (workspace_id) 
     DO UPDATE SET 
       daily_reminder_time = COALESCE($2, workspace_checklist_settings.daily_reminder_time),
       weekly_reminder_day = COALESCE($3, workspace_checklist_settings.weekly_reminder_day),
       monthly_reminder_day = COALESCE($4, workspace_checklist_settings.monthly_reminder_day),
       auto_mark_missed = COALESCE($5, workspace_checklist_settings.auto_mark_missed),
       allow_late_confirmation = COALESCE($6, workspace_checklist_settings.allow_late_confirmation),
       updated_at = CURRENT_TIMESTAMP
     RETURNING *`,
    [workspaceId, daily_reminder_time, weekly_reminder_day, monthly_reminder_day, auto_mark_missed, allow_late_confirmation]
  );
  
  return result.rows[0];
}

// ============================================
// DELETE CHECKLIST ITEM
// ============================================

/**
 * Delete checklist item (soft delete)
 */
async function deleteChecklistItem(itemId) {
  // Soft delete - mark as inactive
  const result = await pool.query(
    `UPDATE checklist_items 
     SET is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
     RETURNING *`,
    [itemId]
  );
  
  if (result.rows.length === 0) {
    throw new Error('Item not found');
  }
  
  return result.rows[0];
}

// ============================================
// EXPORTS
// ============================================

module.exports = {
  // Helpers
  getWorkspaceTimezone,
  getCurrentDateInTimezone,
  isWorkspaceAdmin,
  isAssignedToItem,
  
  // Checklist Items
  createChecklistItem,
  updateChecklistItem,
  getChecklistItemById,
  getChecklistItemsByClient,
  getChecklistItemsByWorkspace,
  
  // Assignments
  addAssignment,
  removeAssignment,
  updateAssignments,
  
  // Holidays
  getClientHolidays,
  addClientHoliday,
  removeClientHoliday,
  copyHolidays,
  syncWeekendAutoHolidays,
  
  // Occurrences
  generateOccurrencesForItem,
  getOccurrencesForGrid,
  getTodaysItems,
  getOccurrenceById,
  
  // Confirmations
  confirmOccurrence,
  adminUpdateConfirmation,
  adminUpdateOccurrenceCustomFields,
  deactivateItemCustomField,
  lateConfirmOccurrence,
  isWithinConfirmationWindow,
  
  // Reporting
  getSummaryReport,
  getDetailedReport,
  getUserPerformanceReport,
  
  // Categories
  getCategories,
  createCategory,
  
  // Jobs
  processOverdueOccurrences,
  generateFutureOccurrences,
  
  // Settings
  getClientChecklistSettings,
  updateClientChecklistSettings,
  getWorkspaceChecklistSettings,
  updateWorkspaceChecklistSettings,
  
  // Delete
  deleteChecklistItem,
};
