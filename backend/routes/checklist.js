/**
 * Checklist Routes
 * API endpoints for Monthly Client Checklist module
 */
const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const checklistService = require('../services/checklistService');
const PDFDocument = require('pdfkit');
const { Parser } = require('json2csv');

// ============================================
// MIDDLEWARE - Check workspace access
// ============================================

async function requireWorkspaceAccess(req, res, next) {
  const workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
  
  if (!workspaceId) {
    return res.status(400).json({ error: 'Workspace ID required' });
  }

  const result = await pool.query(
    'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
    [workspaceId, req.userId]
  );

  if (result.rows.length === 0) {
    return res.status(403).json({ error: 'Access denied to this workspace' });
  }

  req.workspaceRole = result.rows[0].role;
  req.workspaceId = parseInt(workspaceId);
  next();
}

async function requireAdmin(req, res, next) {
  if (!['Owner', 'Admin'].includes(req.workspaceRole)) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// ============================================
// CHECKLIST ITEMS
// ============================================

// Get all checklist items for workspace
router.get('/workspace/:workspaceId/items', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId, frequency, category, assigneeId, includeInactive } = req.query;
    
    const items = await checklistService.getChecklistItemsByWorkspace(req.workspaceId, {
      clientId: clientId ? parseInt(clientId) : null,
      frequency,
      category,
      assigneeId: assigneeId ? parseInt(assigneeId) : null,
      includeInactive: includeInactive === 'true'
    });

    res.json(items);
  } catch (err) {
    console.error('Error fetching checklist items:', err);
    res.status(500).json({ error: 'Failed to fetch checklist items' });
  }
});

// Get checklist items for a specific client
router.get('/client/:clientId/items', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { frequency, category, includeInactive } = req.query;

    // Verify user has access to this client's workspace
    const clientResult = await pool.query(
      `SELECT c.workspace_id FROM clients c 
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2`,
      [clientId, req.userId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const items = await checklistService.getChecklistItemsByClient(parseInt(clientId), {
      frequency,
      category,
      includeInactive: includeInactive === 'true'
    });

    res.json(items);
  } catch (err) {
    console.error('Error fetching client checklist items:', err);
    res.status(500).json({ error: 'Failed to fetch checklist items' });
  }
});

// Get single checklist item
router.get('/items/:itemId', async (req, res) => {
  try {
    const item = await checklistService.getChecklistItemById(parseInt(req.params.itemId));
    
    if (!item) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    // Verify access
    const accessResult = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [item.workspace_id, req.userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(item);
  } catch (err) {
    console.error('Error fetching checklist item:', err);
    res.status(500).json({ error: 'Failed to fetch checklist item' });
  }
});

// Create checklist item (Admin only)
router.post('/workspace/:workspaceId/items', requireWorkspaceAccess, requireAdmin, async (req, res) => {
  try {
    const {
      clientId,
      title,
      description,
      category,
      frequency,
      effectiveFrom,
      effectiveTo,
      completionRule,
      remarksRequired,
      assigneeIds
    } = req.body;

    console.log('Creating checklist item with data:', req.body);

    if (!clientId || !title || !frequency || !effectiveFrom) {
      console.log('Validation failed:', { clientId, title, frequency, effectiveFrom });
      return res.status(400).json({ error: 'Client ID, title, frequency, and effective from date are required' });
    }

    // Verify client belongs to workspace
    const clientResult = await pool.query(
      'SELECT id FROM clients WHERE id = $1 AND workspace_id = $2',
      [clientId, req.workspaceId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(400).json({ error: 'Client not found in this workspace' });
    }

    const item = await checklistService.createChecklistItem({
      clientId: parseInt(clientId),
      workspaceId: req.workspaceId,
      title,
      description,
      category,
      frequency,
      effectiveFrom,
      effectiveTo,
      completionRule,
      remarksRequired,
      assigneeIds: assigneeIds || [],
      createdBy: req.userId
    });

    res.status(201).json(item);
  } catch (err) {
    console.error('Error creating checklist item:', err);
    res.status(500).json({ error: 'Failed to create checklist item' });
  }
});

// Update checklist item (Admin only)
router.put('/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Get item and verify admin access
    const item = await checklistService.getChecklistItemById(parseInt(itemId));
    if (!item) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    const isAdmin = await checklistService.isWorkspaceAdmin(req.userId, item.workspace_id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const updatedItem = await checklistService.updateChecklistItem(parseInt(itemId), req.body, req.userId);
    res.json(updatedItem);
  } catch (err) {
    console.error('Error updating checklist item:', err);
    res.status(500).json({ error: 'Failed to update checklist item' });
  }
});

// Update assignments for an item (Admin only)
router.put('/items/:itemId/assignments', async (req, res) => {
  try {
    const { itemId } = req.params;
    const { assigneeIds, effectiveFrom } = req.body;

    // Get item and verify admin access
    const item = await checklistService.getChecklistItemById(parseInt(itemId));
    if (!item) {
      return res.status(404).json({ error: 'Checklist item not found' });
    }

    const isAdmin = await checklistService.isWorkspaceAdmin(req.userId, item.workspace_id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    await checklistService.updateAssignments(
      parseInt(itemId),
      assigneeIds,
      effectiveFrom || new Date().toISOString().split('T')[0],
      req.userId
    );

    const updatedItem = await checklistService.getChecklistItemById(parseInt(itemId));
    res.json(updatedItem);
  } catch (err) {
    console.error('Error updating assignments:', err);
    res.status(500).json({ error: 'Failed to update assignments' });
  }
});

// ============================================
// HOLIDAYS
// ============================================

// Get holidays for a client
router.get('/client/:clientId/holidays', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { year } = req.query;

    // Verify access
    const clientResult = await pool.query(
      `SELECT c.workspace_id FROM clients c 
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2`,
      [clientId, req.userId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const holidays = await checklistService.getClientHolidays(
      parseInt(clientId),
      year ? parseInt(year) : null
    );

    console.log('Holidays being returned to frontend:', JSON.stringify(holidays, null, 2));
    res.json(holidays);
  } catch (err) {
    console.error('Error fetching holidays:', err);
    res.status(500).json({ error: 'Failed to fetch holidays' });
  }
});

// Add holiday (Admin only)
router.post('/client/:clientId/holidays', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { holidayDate, name, description } = req.body;

    console.log('Holiday creation request:', { clientId, holidayDate, name, description });

    // Validate required fields
    if (!holidayDate) {
      return res.status(400).json({ error: 'Holiday date is required' });
    }
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Holiday name is required' });
    }

    // Parse and validate date
    const parsedDate = new Date(holidayDate);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid holiday date format' });
    }

    // Verify admin access
    const clientResult = await pool.query(
      `SELECT c.workspace_id FROM clients c 
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2 AND wm.role IN ('Owner', 'Admin')`,
      [clientId, req.userId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const holiday = await checklistService.addClientHoliday(
      parseInt(clientId),
      parsedDate.toISOString().split('T')[0], // Format as YYYY-MM-DD
      name.trim(),
      description?.trim() || null,
      req.userId
    );

    res.status(201).json(holiday);
  } catch (err) {
    console.error('Error adding holiday:', err);
    res.status(500).json({ error: 'Failed to add holiday' });
  }
});

// Delete holiday (Admin only)
router.delete('/client/:clientId/holidays/:holidayDate', async (req, res) => {
  try {
    const { clientId, holidayDate } = req.params;

    // Verify admin access
    const clientResult = await pool.query(
      `SELECT c.workspace_id FROM clients c 
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2 AND wm.role IN ('Owner', 'Admin')`,
      [clientId, req.userId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const deleted = await checklistService.removeClientHoliday(parseInt(clientId), holidayDate);
    
    if (!deleted) {
      return res.status(404).json({ error: 'Holiday not found' });
    }

    res.json({ message: 'Holiday deleted successfully' });
  } catch (err) {
    console.error('Error deleting holiday:', err);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// Copy holidays from another client (Admin only)
router.post('/client/:clientId/holidays/copy', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { sourceClientId, year } = req.body;

    // Verify admin access to both clients
    const accessResult = await pool.query(
      `SELECT DISTINCT c.id FROM clients c 
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
       WHERE c.id IN ($1, $2) AND wm.user_id = $3 AND wm.role IN ('Owner', 'Admin')`,
      [clientId, sourceClientId, req.userId]
    );

    if (accessResult.rows.length < 2) {
      return res.status(403).json({ error: 'Admin access required to both clients' });
    }

    const copied = await checklistService.copyHolidays(
      parseInt(sourceClientId),
      parseInt(clientId),
      parseInt(year),
      req.userId
    );

    res.json({ message: `Copied ${copied.length} holidays`, holidays: copied });
  } catch (err) {
    console.error('Error copying holidays:', err);
    res.status(500).json({ error: 'Failed to copy holidays' });
  }
});

// ============================================
// OCCURRENCES & GRID VIEW
// ============================================

// Get monthly grid data
router.get('/workspace/:workspaceId/grid', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId, year, month, frequency, category, status, assigneeId } = req.query;

    if (!clientId || !year || !month) {
      return res.status(400).json({ error: 'Client ID, year, and month are required' });
    }

    const occurrences = await checklistService.getOccurrencesForGrid(
      req.workspaceId,
      parseInt(clientId),
      parseInt(year),
      parseInt(month),
      {
        frequency,
        category,
        status,
        assigneeId: assigneeId ? parseInt(assigneeId) : null
      }
    );

    res.json(occurrences);
  } catch (err) {
    console.error('Error fetching grid data:', err);
    res.status(500).json({ error: 'Failed to fetch grid data' });
  }
});

// Get today's items for current user
router.get('/workspace/:workspaceId/today', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId } = req.query;

    const items = await checklistService.getTodaysItems(
      req.workspaceId,
      req.userId,
      clientId ? parseInt(clientId) : null
    );

    res.json(items);
  } catch (err) {
    console.error('Error fetching today items:', err);
    res.status(500).json({ error: 'Failed to fetch today items' });
  }
});

// Get single occurrence
router.get('/occurrences/:occurrenceId', async (req, res) => {
  try {
    const occurrence = await checklistService.getOccurrenceById(parseInt(req.params.occurrenceId));
    
    if (!occurrence) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    // Verify access
    const accessResult = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [occurrence.workspace_id, req.userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(occurrence);
  } catch (err) {
    console.error('Error fetching occurrence:', err);
    res.status(500).json({ error: 'Failed to fetch occurrence' });
  }
});

// ============================================
// CONFIRMATIONS
// ============================================

// Confirm an occurrence
router.post('/occurrences/:occurrenceId/confirm', async (req, res) => {
  try {
    const { occurrenceId } = req.params;
    const { remarks } = req.body;

    // Get occurrence to find workspace
    const occResult = await pool.query(
      'SELECT workspace_id FROM checklist_occurrences WHERE id = $1',
      [occurrenceId]
    );

    if (occResult.rows.length === 0) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    const occurrence = await checklistService.confirmOccurrence(
      parseInt(occurrenceId),
      req.userId,
      remarks,
      occResult.rows[0].workspace_id
    );

    res.json(occurrence);
  } catch (err) {
    console.error('Error confirming occurrence:', err);
    res.status(400).json({ error: err.message || 'Failed to confirm occurrence' });
  }
});

// Late confirm (Admin only)
router.post('/occurrences/:occurrenceId/late-confirm', async (req, res) => {
  try {
    const { occurrenceId } = req.params;
    const { userId, reason } = req.body;

    if (!userId || !reason) {
      return res.status(400).json({ error: 'User ID and reason are required' });
    }

    // Get occurrence and verify admin access
    const occResult = await pool.query(
      'SELECT workspace_id FROM checklist_occurrences WHERE id = $1',
      [occurrenceId]
    );

    if (occResult.rows.length === 0) {
      return res.status(404).json({ error: 'Occurrence not found' });
    }

    const isAdmin = await checklistService.isWorkspaceAdmin(req.userId, occResult.rows[0].workspace_id);
    if (!isAdmin) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const occurrence = await checklistService.lateConfirmOccurrence(
      parseInt(occurrenceId),
      parseInt(userId),
      reason,
      req.userId,
      occResult.rows[0].workspace_id
    );

    res.json(occurrence);
  } catch (err) {
    console.error('Error late confirming:', err);
    res.status(400).json({ error: err.message || 'Failed to late confirm' });
  }
});

// ============================================
// REPORTING
// ============================================

// Get summary report
router.get('/workspace/:workspaceId/reports/summary', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId, year, month, frequency } = req.query;

    const report = await checklistService.getSummaryReport(req.workspaceId, {
      clientId: clientId ? parseInt(clientId) : null,
      year: year ? parseInt(year) : null,
      month: month ? parseInt(month) : null,
      frequency
    });

    res.json(report);
  } catch (err) {
    console.error('Error fetching summary report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Get detailed report
router.get('/workspace/:workspaceId/reports/detailed', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId, year, month, frequency, status, category } = req.query;

    const report = await checklistService.getDetailedReport(req.workspaceId, {
      clientId: clientId ? parseInt(clientId) : null,
      year: year ? parseInt(year) : null,
      month: month ? parseInt(month) : null,
      frequency,
      status,
      category
    });

    res.json(report);
  } catch (err) {
    console.error('Error fetching detailed report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Get user performance report
router.get('/workspace/:workspaceId/reports/performance', requireWorkspaceAccess, async (req, res) => {
  try {
    const { year, month } = req.query;

    if (!year || !month) {
      return res.status(400).json({ error: 'Year and month are required' });
    }

    const report = await checklistService.getUserPerformanceReport(
      req.workspaceId,
      parseInt(year),
      parseInt(month)
    );

    res.json(report);
  } catch (err) {
    console.error('Error fetching performance report:', err);
    res.status(500).json({ error: 'Failed to fetch report' });
  }
});

// Export report as CSV
router.get('/workspace/:workspaceId/reports/export/csv', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId, year, month, frequency, status, category } = req.query;

    const report = await checklistService.getDetailedReport(req.workspaceId, {
      clientId: clientId ? parseInt(clientId) : null,
      year: year ? parseInt(year) : null,
      month: month ? parseInt(month) : null,
      frequency,
      status,
      category
    });

    // Transform data for CSV
    const csvData = report.map(item => ({
      'Client': item.client_name,
      'Item': item.title,
      'Category': item.category || '-',
      'Frequency': item.frequency,
      'Date': item.occurrence_date,
      'Period End': item.period_end_date,
      'Status': item.status,
      'Confirmations': item.confirmations.map(c => `${c.user_name} (${c.confirmed_at})`).join('; ') || '-',
      'Remarks': item.confirmations.map(c => c.remarks).filter(Boolean).join('; ') || '-'
    }));

    const parser = new Parser();
    const csv = parser.parse(csvData);

    res.header('Content-Type', 'text/csv');
    res.attachment(`checklist-report-${year || 'all'}-${month || 'all'}.csv`);
    res.send(csv);
  } catch (err) {
    console.error('Error exporting CSV:', err);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// Export report as PDF
router.get('/workspace/:workspaceId/reports/export/pdf', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId, year, month, frequency, status, category } = req.query;

    const report = await checklistService.getDetailedReport(req.workspaceId, {
      clientId: clientId ? parseInt(clientId) : null,
      year: year ? parseInt(year) : null,
      month: month ? parseInt(month) : null,
      frequency,
      status,
      category
    });

    // Create PDF
    const doc = new PDFDocument({ margin: 50 });
    
    res.header('Content-Type', 'application/pdf');
    res.attachment(`checklist-report-${year || 'all'}-${month || 'all'}.pdf`);
    
    doc.pipe(res);

    // Title
    doc.fontSize(20).text('Checklist Report', { align: 'center' });
    doc.moveDown();
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`, { align: 'center' });
    doc.moveDown(2);

    // Summary
    const summary = {
      total: report.length,
      confirmed: report.filter(r => r.status === 'confirmed').length,
      missed: report.filter(r => r.status === 'missed').length,
      lateConfirmed: report.filter(r => r.status === 'late_confirmed').length,
      exempt: report.filter(r => r.status === 'exempt').length,
      pending: report.filter(r => r.status === 'pending').length
    };

    doc.fontSize(14).text('Summary', { underline: true });
    doc.fontSize(11);
    doc.text(`Total Items: ${summary.total}`);
    doc.text(`Confirmed: ${summary.confirmed}`);
    doc.text(`Missed: ${summary.missed}`);
    doc.text(`Late Confirmed: ${summary.lateConfirmed}`);
    doc.text(`Exempt: ${summary.exempt}`);
    doc.text(`Pending: ${summary.pending}`);
    doc.moveDown(2);

    // Details table
    doc.fontSize(14).text('Details', { underline: true });
    doc.moveDown();

    // Table header
    doc.fontSize(9);
    const tableTop = doc.y;
    const colWidths = [100, 120, 60, 60, 60, 80];
    const headers = ['Client', 'Item', 'Frequency', 'Date', 'Status', 'Confirmed By'];
    
    let x = 50;
    headers.forEach((header, i) => {
      doc.text(header, x, tableTop, { width: colWidths[i], align: 'left' });
      x += colWidths[i];
    });

    doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

    // Table rows
    let y = tableTop + 20;
    report.slice(0, 50).forEach(item => { // Limit to 50 rows for PDF
      if (y > 700) {
        doc.addPage();
        y = 50;
      }

      x = 50;
      const rowData = [
        item.client_name.substring(0, 15),
        item.title.substring(0, 20),
        item.frequency,
        item.occurrence_date,
        item.status,
        item.confirmations[0]?.user_name?.substring(0, 12) || '-'
      ];

      rowData.forEach((cell, i) => {
        doc.text(cell, x, y, { width: colWidths[i], align: 'left' });
        x += colWidths[i];
      });

      y += 15;
    });

    if (report.length > 50) {
      doc.moveDown(2);
      doc.text(`... and ${report.length - 50} more items. Please export to CSV for complete data.`);
    }

    doc.end();
  } catch (err) {
    console.error('Error exporting PDF:', err);
    res.status(500).json({ error: 'Failed to export report' });
  }
});

// ============================================
// CATEGORIES
// ============================================

// Get categories
router.get('/workspace/:workspaceId/categories', requireWorkspaceAccess, async (req, res) => {
  try {
    const categories = await checklistService.getCategories(req.workspaceId);
    res.json(categories);
  } catch (err) {
    console.error('Error fetching categories:', err);
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

// Create category (Admin only)
router.post('/workspace/:workspaceId/categories', requireWorkspaceAccess, requireAdmin, async (req, res) => {
  try {
    const { name, color, icon } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Category name is required' });
    }

    const category = await checklistService.createCategory(req.workspaceId, name, color, icon);
    res.status(201).json(category);
  } catch (err) {
    console.error('Error creating category:', err);
    if (err.code === '23505') { // Unique violation
      return res.status(400).json({ error: 'Category already exists' });
    }
    res.status(500).json({ error: 'Failed to create category' });
  }
});

// ============================================
// CLIENT SETTINGS
// ============================================

// Get client checklist settings
router.get('/client/:clientId/settings', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Verify access
    const clientResult = await pool.query(
      `SELECT c.workspace_id FROM clients c 
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2`,
      [clientId, req.userId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const settings = await checklistService.getClientChecklistSettings(parseInt(clientId));
    res.json(settings);
  } catch (err) {
    console.error('Error fetching client settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update client checklist settings (Admin only)
router.put('/client/:clientId/settings', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Verify admin access
    const clientResult = await pool.query(
      `SELECT c.workspace_id FROM clients c 
       JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
       WHERE c.id = $1 AND wm.user_id = $2 AND wm.role IN ('Owner', 'Admin')`,
      [clientId, req.userId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const settings = await checklistService.updateClientChecklistSettings(parseInt(clientId), req.body);
    res.json(settings);
  } catch (err) {
    console.error('Error updating client settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================
// WORKSPACE SETTINGS
// ============================================

// Get workspace checklist settings
router.get('/workspace/:workspaceId/settings', requireWorkspaceAccess, async (req, res) => {
  try {
    const settings = await checklistService.getWorkspaceChecklistSettings(req.workspaceId);
    res.json(settings);
  } catch (err) {
    console.error('Error fetching workspace settings:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

// Update workspace checklist settings (Admin only)
router.put('/workspace/:workspaceId/settings', requireWorkspaceAccess, requireAdmin, async (req, res) => {
  try {
    const settings = await checklistService.updateWorkspaceChecklistSettings(req.workspaceId, req.body);
    res.json(settings);
  } catch (err) {
    console.error('Error updating workspace settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// ============================================
// DELETE ITEM
// ============================================

// Delete checklist item (Admin only)
router.delete('/items/:itemId', async (req, res) => {
  try {
    const { itemId } = req.params;
    
    // Get item to check workspace access
    const itemResult = await pool.query(
      `SELECT ci.id, ci.client_id, c.workspace_id 
       FROM checklist_items ci
       JOIN clients c ON ci.client_id = c.id
       WHERE ci.id = $1`,
      [itemId]
    );
    
    if (itemResult.rows.length === 0) {
      return res.status(404).json({ error: 'Item not found' });
    }
    
    const workspaceId = itemResult.rows[0].workspace_id;
    
    // Check admin access
    const accessResult = await pool.query(
      `SELECT role FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 AND role IN ('Owner', 'Admin')`,
      [workspaceId, req.userId]
    );
    
    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await checklistService.deleteChecklistItem(parseInt(itemId));
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting item:', err);
    res.status(500).json({ error: 'Failed to delete item' });
  }
});

// ============================================
// USER PERFORMANCE REPORT
// ============================================

// Get user performance report
router.get('/workspace/:workspaceId/reports/user-performance', requireWorkspaceAccess, async (req, res) => {
  try {
    const { clientId, startDate, endDate } = req.query;
    
    const report = await checklistService.getUserPerformanceReport(req.workspaceId, {
      clientId: clientId ? parseInt(clientId) : null,
      startDate,
      endDate
    });
    
    res.json(report);
  } catch (err) {
    console.error('Error fetching user performance report:', err);
    res.status(500).json({ error: 'Failed to fetch user performance report' });
  }
});

// ============================================
// DELETE HOLIDAY BY ID
// ============================================

// Delete client holiday by ID
router.delete('/holidays/:holidayId', async (req, res) => {
  try {
    const { holidayId } = req.params;
    
    // Get holiday to check access
    const holidayResult = await pool.query(
      `SELECT ch.id, ch.client_id, c.workspace_id 
       FROM client_holidays ch
       JOIN clients c ON ch.client_id = c.id
       WHERE ch.id = $1`,
      [holidayId]
    );
    
    if (holidayResult.rows.length === 0) {
      return res.status(404).json({ error: 'Holiday not found' });
    }
    
    const workspaceId = holidayResult.rows[0].workspace_id;
    
    // Check admin access
    const accessResult = await pool.query(
      `SELECT role FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 AND role IN ('Owner', 'Admin')`,
      [workspaceId, req.userId]
    );
    
    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    await pool.query('DELETE FROM client_holidays WHERE id = $1', [holidayId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting holiday:', err);
    res.status(500).json({ error: 'Failed to delete holiday' });
  }
});

// ============================================
// CLIENT USER ASSIGNMENTS
// ============================================

// Get all client-user assignments for a workspace
router.get('/workspace/:workspaceId/client-assignments', requireWorkspaceAccess, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        cua.id,
        cua.client_id,
        cua.user_id,
        cua.assigned_at,
        cua.is_active,
        cua.notes,
        c.client_name,
        c.client_code,
        u.username,
        COALESCE(u.first_name || ' ' || u.last_name, u.username) as user_name,
        u.email as user_email,
        ab.username as assigned_by_username,
        COALESCE(ab.first_name || ' ' || ab.last_name, ab.username) as assigned_by_name
      FROM client_user_assignments cua
      JOIN clients c ON cua.client_id = c.id
      JOIN users u ON cua.user_id = u.id
      LEFT JOIN users ab ON cua.assigned_by = ab.id
      WHERE cua.workspace_id = $1
      ORDER BY c.client_name, u.first_name
    `, [req.workspaceId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching client assignments:', err);
    res.status(500).json({ error: 'Failed to fetch client assignments' });
  }
});

// Get assignments for a specific client
router.get('/client/:clientId/assignments', async (req, res) => {
  try {
    const { clientId } = req.params;

    // Get client's workspace for access check
    const clientResult = await pool.query(
      'SELECT workspace_id FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const workspaceId = clientResult.rows[0].workspace_id;

    // Verify workspace access
    const accessResult = await pool.query(
      'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, req.userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT 
        cua.id,
        cua.user_id,
        cua.assigned_at,
        cua.is_active,
        cua.notes,
        u.username,
        COALESCE(u.first_name || ' ' || u.last_name, u.username) as user_name,
        u.email
      FROM client_user_assignments cua
      JOIN users u ON cua.user_id = u.id
      WHERE cua.client_id = $1 AND cua.is_active = TRUE
      ORDER BY u.first_name
    `, [clientId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching client assignments:', err);
    res.status(500).json({ error: 'Failed to fetch client assignments' });
  }
});

// Get clients assigned to a specific user
router.get('/workspace/:workspaceId/user/:userId/assigned-clients', requireWorkspaceAccess, async (req, res) => {
  try {
    const { userId } = req.params;

    const result = await pool.query(`
      SELECT 
        c.id,
        c.client_name as name,
        c.client_code as code,
        c.status,
        cua.assigned_at
      FROM client_user_assignments cua
      JOIN clients c ON cua.client_id = c.id
      WHERE cua.workspace_id = $1 
        AND cua.user_id = $2 
        AND cua.is_active = TRUE
        AND c.status = 'Active'
      ORDER BY c.client_name
    `, [req.workspaceId, userId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Error fetching assigned clients:', err);
    res.status(500).json({ error: 'Failed to fetch assigned clients' });
  }
});

// Assign user to client (Admin only)
router.post('/client/:clientId/assignments', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { userId, notes } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'User ID is required' });
    }

    // Get client's workspace
    const clientResult = await pool.query(
      'SELECT workspace_id FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const workspaceId = clientResult.rows[0].workspace_id;

    // Verify admin access
    const accessResult = await pool.query(
      `SELECT role FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 AND role IN ('Owner', 'Admin')`,
      [workspaceId, req.userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Verify target user is in the workspace
    const userResult = await pool.query(
      'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
      [workspaceId, userId]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ error: 'User is not a member of this workspace' });
    }

    // Create or update assignment
    const result = await pool.query(`
      INSERT INTO client_user_assignments (client_id, user_id, workspace_id, assigned_by, notes)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (client_id, user_id) 
      DO UPDATE SET is_active = TRUE, assigned_by = $4, assigned_at = CURRENT_TIMESTAMP, notes = $5
      RETURNING id
    `, [clientId, userId, workspaceId, req.userId, notes || null]);

    res.status(201).json({ 
      success: true, 
      assignmentId: result.rows[0].id,
      message: 'User assigned to client successfully' 
    });
  } catch (err) {
    console.error('Error assigning user to client:', err);
    res.status(500).json({ error: 'Failed to assign user to client' });
  }
});

// Remove user from client (Admin only)
router.delete('/client/:clientId/assignments/:userId', async (req, res) => {
  try {
    const { clientId, userId } = req.params;

    // Get client's workspace
    const clientResult = await pool.query(
      'SELECT workspace_id FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const workspaceId = clientResult.rows[0].workspace_id;

    // Verify admin access
    const accessResult = await pool.query(
      `SELECT role FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 AND role IN ('Owner', 'Admin')`,
      [workspaceId, req.userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // Soft delete - set is_active to false
    await pool.query(`
      UPDATE client_user_assignments 
      SET is_active = FALSE 
      WHERE client_id = $1 AND user_id = $2
    `, [clientId, userId]);

    res.json({ success: true, message: 'User removed from client' });
  } catch (err) {
    console.error('Error removing user from client:', err);
    res.status(500).json({ error: 'Failed to remove user from client' });
  }
});

// Bulk assign users to a client (Admin only)
router.post('/client/:clientId/assignments/bulk', async (req, res) => {
  try {
    const { clientId } = req.params;
    const { userIds } = req.body;

    if (!userIds || !Array.isArray(userIds)) {
      return res.status(400).json({ error: 'User IDs array is required' });
    }

    // Filter out null, undefined, and empty values
    const validUserIds = userIds.filter(id => id != null && id !== '' && !isNaN(id));
    
    console.log('Original userIds:', userIds);
    console.log('Valid userIds:', validUserIds);

    // Get client's workspace
    const clientResult = await pool.query(
      'SELECT workspace_id FROM clients WHERE id = $1',
      [clientId]
    );

    if (clientResult.rows.length === 0) {
      return res.status(404).json({ error: 'Client not found' });
    }

    const workspaceId = clientResult.rows[0].workspace_id;

    // Verify admin access
    const accessResult = await pool.query(
      `SELECT role FROM workspace_members 
       WHERE workspace_id = $1 AND user_id = $2 AND role IN ('Owner', 'Admin')`,
      [workspaceId, req.userId]
    );

    if (accessResult.rows.length === 0) {
      return res.status(403).json({ error: 'Admin access required' });
    }

    // First, deactivate all current assignments
    await pool.query(`
      UPDATE client_user_assignments 
      SET is_active = FALSE 
      WHERE client_id = $1
    `, [clientId]);

    // Then create/reactivate assignments for the provided users
    for (const userId of validUserIds) {
      console.log('Processing userId:', userId);
      await pool.query(`
        INSERT INTO client_user_assignments (client_id, user_id, workspace_id, assigned_by)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (client_id, user_id) 
        DO UPDATE SET is_active = TRUE, assigned_by = $4, assigned_at = CURRENT_TIMESTAMP
      `, [clientId, userId, workspaceId, req.userId]);
    }

    res.json({ success: true, message: `${validUserIds.length} user(s) assigned to client` });
  } catch (err) {
    console.error('Error bulk assigning users:', err);
    res.status(500).json({ error: 'Failed to assign users to client' });
  }
});

module.exports = router;
