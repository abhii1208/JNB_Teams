const checklistService = require('../services/checklistService');
const { pool } = require('../db');

function addDays(dateString, days) {
  const [year, month, day] = String(dateString).split('-').map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const da = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${da}`;
}

async function findSmokeContext() {
  const result = await pool.query(
    `SELECT
       wm.workspace_id,
       wm.user_id as admin_user_id,
       c.id as client_id
     FROM workspace_members wm
     JOIN clients c ON c.workspace_id = wm.workspace_id
     WHERE wm.role IN ('Owner', 'Admin')
       AND (c.status IS NULL OR LOWER(c.status) = 'active')
     ORDER BY wm.workspace_id, c.id
     LIMIT 1`
  );

  if (result.rows.length === 0) {
    throw new Error('No workspace/admin/client combination found for smoke test');
  }

  const row = result.rows[0];

  const memberResult = await pool.query(
    `SELECT user_id
     FROM workspace_members
     WHERE workspace_id = $1
       AND user_id <> $2
     ORDER BY user_id
     LIMIT 1`,
    [row.workspace_id, row.admin_user_id]
  );

  return {
    workspaceId: row.workspace_id,
    adminUserId: row.admin_user_id,
    clientId: row.client_id,
    secondaryUserId: memberResult.rows[0]?.user_id || null
  };
}

function buildCustomValueMap(customFields, today) {
  const byLabel = new Map(
    customFields.map((field) => [String(field.label || '').trim().toLowerCase(), field])
  );

  const textField = byLabel.get('smoke text');
  const numberField = byLabel.get('smoke number');
  const dateField = byLabel.get('smoke date');
  const rangeField = byLabel.get('smoke range');
  const flagField = byLabel.get('smoke flag');
  const choiceField = byLabel.get('smoke choice');

  if (!textField || !dateField || !choiceField) {
    throw new Error('Expected custom fields are missing in occurrence payload');
  }

  const values = {
    [String(textField.id)]: 'Smoke text value',
    [String(dateField.id)]: today,
    [String(choiceField.id)]: 'Option A'
  };

  if (numberField) values[String(numberField.id)] = 123.45;
  if (rangeField) values[String(rangeField.id)] = { startDate: today, endDate: today };
  if (flagField) values[String(flagField.id)] = true;

  return values;
}

async function run() {
  let createdItemId = null;
  const startedAt = new Date().toISOString();

  try {
    const context = await findSmokeContext();
    const timezone = await checklistService.getWorkspaceTimezone(context.workspaceId);
    const today = checklistService.getCurrentDateInTimezone(timezone);
    const tomorrow = addDays(today, 1);

    const title = `SMOKE-CF-${Date.now()}`;

    const createPayload = {
      clientId: context.clientId,
      workspaceId: context.workspaceId,
      title,
      description: 'Smoke test item for custom fields',
      category: null,
      frequency: 'daily',
      effectiveFrom: today,
      effectiveTo: null,
      completionRule: 'any',
      remarksRequired: true,
      primaryAssigneeIds: [context.adminUserId],
      secondaryAssigneeIds: context.secondaryUserId ? [context.secondaryUserId] : [],
      customFields: [
        { label: 'Smoke Text', fieldType: 'text', required: true, displayOrder: 0 },
        { label: 'Smoke Number', fieldType: 'number', required: false, displayOrder: 1 },
        { label: 'Smoke Date', fieldType: 'date', required: true, displayOrder: 2 },
        { label: 'Smoke Range', fieldType: 'date_range', required: false, displayOrder: 3 },
        { label: 'Smoke Flag', fieldType: 'boolean', required: false, displayOrder: 4 },
        {
          label: 'Smoke Choice',
          fieldType: 'dropdown',
          required: true,
          options: ['Option A', 'Option B'],
          displayOrder: 5
        }
      ],
      createdBy: context.adminUserId
    };

    const createdItem = await checklistService.createChecklistItem(createPayload);
    createdItemId = createdItem.id;

    const todayItems = await checklistService.getTodaysItems(
      context.workspaceId,
      context.adminUserId,
      context.clientId,
      { includeSecondary: true }
    );

    const createdTodayItem = todayItems.find((item) => Number(item.checklist_item_id) === Number(createdItem.id));
    if (!createdTodayItem) {
      throw new Error('Created item not found in today items');
    }

    const occurrenceId = createdTodayItem.id;
    const occurrenceBefore = await checklistService.getOccurrenceById(occurrenceId);
    const customFieldValues = buildCustomValueMap(occurrenceBefore.custom_fields || [], today);

    const confirmedOccurrence = await checklistService.confirmOccurrence(
      occurrenceId,
      context.adminUserId,
      'Smoke remarks',
      context.workspaceId,
      customFieldValues
    );

    if (!confirmedOccurrence || !['pending', 'confirmed'].includes(confirmedOccurrence.status)) {
      throw new Error('Unexpected status after confirm');
    }

    const afterConfirm = await checklistService.getOccurrenceById(occurrenceId);
    const myConfirmation = (afterConfirm.confirmations || []).find(
      (row) => Number(row.user_id) === Number(context.adminUserId)
    );
    if (!myConfirmation) {
      throw new Error('Confirmation row not found for admin user');
    }

    const textField = (afterConfirm.custom_fields || []).find((field) => field.label === 'Smoke Text');
    if (!textField || String(textField.value_text || '') !== 'Smoke text value') {
      throw new Error('Custom text field value not saved during confirm');
    }

    const updateResult = await checklistService.adminUpdateOccurrenceCustomFields(
      occurrenceId,
      { [String(textField.id)]: 'Edited by admin' },
      context.adminUserId,
      context.workspaceId
    );

    const afterAdminUpdate = updateResult.occurrence;
    const updatedTextField = (afterAdminUpdate.custom_fields || []).find((field) => field.label === 'Smoke Text');
    if (!updatedTextField || String(updatedTextField.value_text || '') !== 'Edited by admin') {
      throw new Error('Admin custom-field update did not persist');
    }

    const fieldToDeactivate = (createdItem.custom_fields || [])[0];
    if (!fieldToDeactivate?.id) {
      throw new Error('Could not resolve created custom field ID for deactivation');
    }

    const deactivated = await checklistService.deactivateItemCustomField(
      createdItem.id,
      fieldToDeactivate.id,
      tomorrow,
      context.adminUserId
    );

    if (String(deactivated.disabled_from || '').slice(0, 10) !== tomorrow) {
      throw new Error('Custom field deactivation date mismatch');
    }

    const month = Number(today.slice(5, 7));
    const year = Number(today.slice(0, 4));
    const gridRows = await checklistService.getOccurrencesForGrid(
      context.workspaceId,
      context.clientId,
      year,
      month
    );
    const inGrid = gridRows.some((row) => Number(row.checklist_item_id) === Number(createdItem.id));
    if (!inGrid) {
      throw new Error('Created item occurrence not found in monthly grid query');
    }

    await checklistService.deleteChecklistItem(createdItem.id);
    createdItemId = null;

    const summary = {
      success: true,
      startedAt,
      finishedAt: new Date().toISOString(),
      workspaceId: context.workspaceId,
      clientId: context.clientId,
      adminUserId: context.adminUserId,
      testedOccurrenceId: occurrenceId,
      createdItemTitle: title,
      checks: [
        'create item with custom fields',
        'today query includes created item',
        'confirm with required custom fields',
        'admin update custom fields',
        'deactivate custom field with apply-from date',
        'monthly grid includes created occurrence',
        'cleanup soft-delete item'
      ]
    };

    console.log(JSON.stringify(summary, null, 2));
  } catch (err) {
    console.error('SMOKE_TEST_FAILED');
    console.error(err.stack || err.message || err);

    if (createdItemId) {
      try {
        await checklistService.deleteChecklistItem(createdItemId);
      } catch (cleanupErr) {
        console.error('CLEANUP_FAILED', cleanupErr.message || cleanupErr);
      }
    }

    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  run();
}

