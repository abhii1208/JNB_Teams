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
  completionRule = 'any',
  remarksRequired = false,
  assigneeIds = [],
  createdBy
}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Insert checklist item
    const itemResult = await client.query(
      `INSERT INTO checklist_items 
       (client_id, workspace_id, title, description, category, frequency, 
        effective_from, effective_to, completion_rule, remarks_required, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [clientId, workspaceId, title, description, category, frequency,
       effectiveFrom, effectiveTo, completionRule, remarksRequired, createdBy]
    );

    const item = itemResult.rows[0];

    // Add assignments
    if (assigneeIds.length > 0) {
      for (const userId of assigneeIds) {
        await client.query(
          `INSERT INTO checklist_assignments 
           (checklist_item_id, user_id, assigned_from, assigned_by)
           VALUES ($1, $2, $3, $4)`,
          [item.id, userId, effectiveFrom, createdBy]
        );
      }
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
  const { title, description, category, effectiveTo, completionRule, remarksRequired, isActive } = updates;
  
  const result = await pool.query(
    `UPDATE checklist_items 
     SET title = COALESCE($1, title),
         description = COALESCE($2, description),
         category = COALESCE($3, category),
         effective_to = COALESCE($4, effective_to),
         completion_rule = COALESCE($5, completion_rule),
         remarks_required = COALESCE($6, remarks_required),
         is_active = COALESCE($7, is_active),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $8
     RETURNING *`,
    [title, description, category, effectiveTo, completionRule, remarksRequired, isActive, itemId]
  );

  return result.rows[0];
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
           'name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
           'username', u.username,
           'assigned_from', ca.assigned_from,
           'assigned_to', ca.assigned_to,
           'is_active', ca.is_active
         )), '[]'::json)
         FROM checklist_assignments ca
         JOIN users u ON ca.user_id = u.id
         WHERE ca.checklist_item_id = ci.id
       ) as assignees
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
          'name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'username', u.username,
          'assigned_from', ca.assigned_from,
          'assigned_to', ca.assigned_to,
          'is_active', ca.is_active
        )), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
      ) as assignees
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
  const { includeInactive = false, clientId, frequency, category, assigneeId } = options;
  
  let query = `
    SELECT ci.*,
      c.client_name,
      ci.category as category_name,
      (
        SELECT COALESCE(json_agg(json_build_object(
          'id', ca.user_id,
          'name', COALESCE(u.first_name || ' ' || u.last_name, u.username),
          'username', u.username,
          'assigned_from', ca.assigned_from,
          'assigned_to', ca.assigned_to,
          'is_active', ca.is_active
        )), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
      ) as assignees
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
async function addAssignment(checklistItemId, userId, assignedFrom, assignedBy) {
  const result = await pool.query(
    `INSERT INTO checklist_assignments 
     (checklist_item_id, user_id, assigned_from, assigned_by)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (checklist_item_id, user_id, assigned_from) 
     DO UPDATE SET is_active = TRUE
     RETURNING *`,
    [checklistItemId, userId, assignedFrom, assignedBy]
  );
  return result.rows[0];
}

/**
 * Remove/deactivate assignment
 */
async function removeAssignment(checklistItemId, userId, endDate) {
  const result = await pool.query(
    `UPDATE checklist_assignments 
     SET assigned_to = $3, is_active = FALSE, updated_at = CURRENT_TIMESTAMP
     WHERE checklist_item_id = $1 AND user_id = $2 AND is_active = TRUE
     RETURNING *`,
    [checklistItemId, userId, endDate]
  );
  return result.rows[0];
}

/**
 * Update assignments for an item (replace all)
 */
async function updateAssignments(checklistItemId, assigneeIds, effectiveFrom, assignedBy) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Deactivate existing assignments
    await client.query(
      `UPDATE checklist_assignments 
       SET assigned_to = $2, is_active = FALSE
       WHERE checklist_item_id = $1 AND is_active = TRUE AND assigned_to IS NULL`,
      [checklistItemId, effectiveFrom]
    );

    // Add new assignments
    for (const userId of assigneeIds) {
      await client.query(
        `INSERT INTO checklist_assignments 
         (checklist_item_id, user_id, assigned_from, assigned_by)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (checklist_item_id, user_id, assigned_from) 
         DO UPDATE SET is_active = TRUE`,
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
  const { id: itemId, client_id: clientId, workspace_id: workspaceId, frequency, effective_from: effectiveFrom } = item;
  
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

    if (frequency === 'daily') {
      occurrenceDate = currentDate.toISOString().split('T')[0];
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
      occurrenceDate = getWeekStart(currentDate.toISOString().split('T')[0]);
      periodEndDate = getWeekEnd(currentDate.toISOString().split('T')[0]);

      // Check if any holiday in the week
      const weekStart = new Date(occurrenceDate);
      const weekEnd = new Date(periodEndDate);
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        if (holidays.has(d.toISOString().split('T')[0])) {
          status = 'exempt';
          exemptionReason = 'Holiday in period';
          break;
        }
      }

      // Move to next week
      currentDate = new Date(periodEndDate);
      currentDate.setDate(currentDate.getDate() + 1);
    } 
    else if (frequency === 'monthly') {
      occurrenceDate = getMonthStart(currentDate.toISOString().split('T')[0]);
      periodEndDate = getMonthEnd(currentDate.toISOString().split('T')[0]);

      // Check if any holiday in the month
      const monthStart = new Date(occurrenceDate);
      const monthEnd = new Date(periodEndDate);
      for (let d = new Date(monthStart); d <= monthEnd; d.setDate(d.getDate() + 1)) {
        if (holidays.has(d.toISOString().split('T')[0])) {
          status = 'exempt';
          exemptionReason = 'Holiday in period';
          break;
        }
      }

      // Move to next month
      currentDate = new Date(periodEndDate);
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
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username)
        )), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
        AND ca.assigned_from <= co.occurrence_date
        AND (ca.assigned_to IS NULL OR ca.assigned_to >= co.period_end_date)
      ) as assignees
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
async function getTodaysItems(workspaceId, userId, clientId = null) {
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
      c.client_name,
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
      ) as confirmations
    FROM checklist_occurrences co
    JOIN checklist_items ci ON co.checklist_item_id = ci.id
    JOIN clients c ON co.client_id = c.id
    JOIN checklist_assignments ca ON ca.checklist_item_id = ci.id
    WHERE co.workspace_id = $1
    AND ca.user_id = $2
    AND ca.is_active = TRUE
    AND ca.assigned_from <= $3
    AND (ca.assigned_to IS NULL OR ca.assigned_to >= $3)
    AND co.status IN ('pending', 'confirmed')
    AND (
      (co.frequency = 'daily' AND co.occurrence_date = $3)
      OR (co.frequency IN ('weekly', 'monthly') AND $3 BETWEEN co.occurrence_date AND co.period_end_date)
    )
  `;

  const params = [workspaceId, userId, today];
  let paramIndex = 4;

  if (clientId) {
    query += ` AND co.client_id = $${paramIndex}`;
    params.push(clientId);
    paramIndex++;
  }

  query += ' ORDER BY c.client_name, ci.category, ci.title';

  const result = await pool.query(query, params);
  return result.rows;
}

// ============================================
// CONFIRMATIONS
// ============================================

/**
 * Confirm an occurrence
 */
async function confirmOccurrence(occurrenceId, userId, remarks = null, workspaceId) {
  const timezone = await getWorkspaceTimezone(workspaceId);
  const today = getCurrentDateInTimezone(timezone);

  // Get occurrence details
  const occResult = await pool.query(
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

  // Check if user is assigned
  const isAssigned = await isAssignedToItem(userId, occurrence.checklist_item_id, occurrence.occurrence_date);
  if (!isAssigned) {
    throw new Error('User is not assigned to this item');
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
  const existingResult = await pool.query(
    'SELECT id FROM checklist_confirmations WHERE occurrence_id = $1 AND user_id = $2',
    [occurrenceId, userId]
  );

  if (existingResult.rows.length > 0) {
    // Update remarks if already confirmed
    await pool.query(
      'UPDATE checklist_confirmations SET remarks = $3 WHERE occurrence_id = $1 AND user_id = $2',
      [occurrenceId, userId, remarks]
    );
  } else {
    // Insert new confirmation
    await pool.query(
      `INSERT INTO checklist_confirmations (occurrence_id, user_id, remarks, confirmation_date)
       VALUES ($1, $2, $3, $4)`,
      [occurrenceId, userId, remarks, today]
    );
  }

  // Update occurrence status based on completion rule
  await updateOccurrenceStatus(occurrenceId);

  return await getOccurrenceById(occurrenceId);
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
async function updateOccurrenceStatus(occurrenceId) {
  const result = await pool.query(
    `SELECT co.*, ci.completion_rule,
       (SELECT COUNT(*) FROM checklist_assignments ca 
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
        AND ca.assigned_from <= co.occurrence_date
        AND (ca.assigned_to IS NULL OR ca.assigned_to >= co.period_end_date)
       ) as total_assignees,
       (SELECT COUNT(*) FROM checklist_confirmations cc WHERE cc.occurrence_id = co.id) as total_confirmations
     FROM checklist_occurrences co
     JOIN checklist_items ci ON co.checklist_item_id = ci.id
     WHERE co.id = $1`,
    [occurrenceId]
  );

  if (result.rows.length === 0) return;

  const { completion_rule, total_assignees, total_confirmations, status } = result.rows[0];

  if (status === 'exempt' || status === 'late_confirmed') return;

  let newStatus = 'pending';
  
  if (completion_rule === 'any' && total_confirmations > 0) {
    newStatus = 'confirmed';
  } else if (completion_rule === 'all' && total_confirmations >= total_assignees) {
    newStatus = 'confirmed';
  }

  if (newStatus !== status) {
    await pool.query(
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
          'user_name', COALESCE(u.first_name || ' ' || u.last_name, u.username)
        )), '[]'::json)
        FROM checklist_assignments ca
        JOIN users u ON ca.user_id = u.id
        WHERE ca.checklist_item_id = ci.id AND ca.is_active = TRUE
      ) as assignees
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
  const { clientId, year, month, frequency, assigneeId } = options;

  let whereClause = 'WHERE co.workspace_id = $1';
  const params = [workspaceId];
  let paramIndex = 2;

  if (clientId) {
    whereClause += ` AND co.client_id = $${paramIndex}`;
    params.push(clientId);
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
  const { clientId, year, month, frequency, status, assigneeId, category } = options;

  let whereClause = 'WHERE co.workspace_id = $1';
  const params = [workspaceId];
  let paramIndex = 2;

  if (clientId) {
    whereClause += ` AND co.client_id = $${paramIndex}`;
    params.push(clientId);
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
  const { clientId, startDate: startDateParam, endDate: endDateParam } = options;
  
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
  // Soft delete - mark as inactive and deleted
  const result = await pool.query(
    `UPDATE checklist_items 
     SET is_active = FALSE, deleted_at = CURRENT_TIMESTAMP
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
  
  // Occurrences
  generateOccurrencesForItem,
  getOccurrencesForGrid,
  getTodaysItems,
  getOccurrenceById,
  
  // Confirmations
  confirmOccurrence,
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
