const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { pool } = require('../db');
const notificationService = require('../services/notificationService');

// Configure multer for file uploads
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const entityType = req.body.entity_type || 'general';
    const uploadPath = path.join(UPLOAD_DIR, entityType);
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, `${uniqueSuffix}${ext}`);
  }
});

// File filter for allowed types
const fileFilter = (req, file, cb) => {
  // Allow common file types
  const allowedMimes = [
    // Images
    'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    // Text
    'text/plain', 'text/csv',
    // Archives
    'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed',
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type ${file.mimetype} is not allowed`), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5, // Max 5 files at once
  }
});

// Helper to verify entity access
async function verifyEntityAccess(entityType, entityId, userId, pool) {
  switch (entityType) {
    case 'task': {
      const result = await pool.query(`
        SELECT t.id, p.workspace_id
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        JOIN project_members pm ON p.id = pm.project_id
        WHERE t.id = $1 AND pm.user_id = $2
      `, [entityId, userId]);
      return result.rows[0] || null;
    }
    case 'client': {
      const result = await pool.query(`
        SELECT c.id, c.workspace_id
        FROM clients c
        JOIN workspace_members wm ON c.workspace_id = wm.workspace_id
        WHERE c.id = $1 AND wm.user_id = $2
      `, [entityId, userId]);
      return result.rows[0] || null;
    }
    case 'chat_message': {
      const result = await pool.query(`
        SELECT m.id, t.workspace_id
        FROM chat_messages m
        JOIN chat_threads t ON m.thread_id = t.id
        JOIN chat_thread_members tm ON t.id = tm.thread_id
        WHERE m.id = $1 AND tm.user_id = $2
      `, [entityId, userId]);
      return result.rows[0] || null;
    }
    default:
      return null;
  }
}

// Upload attachments
router.post('/', upload.array('files', 5), async (req, res) => {
  const { entity_type, entity_id, workspace_id, description } = req.body;

  if (!entity_type || !entity_id || !workspace_id) {
    // Clean up uploaded files if validation fails
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
    }
    return res.status(400).json({ error: 'entity_type, entity_id, and workspace_id are required' });
  }

  if (!['task', 'client', 'chat_message'].includes(entity_type)) {
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
    }
    return res.status(400).json({ error: 'Invalid entity_type. Must be task, client, or chat_message' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No files uploaded' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify access to the entity
    const entityAccess = await verifyEntityAccess(entity_type, entity_id, req.userId, client);
    if (!entityAccess) {
      // Clean up files
      req.files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Access denied to this entity' });
    }

    const attachments = [];
    for (const file of req.files) {
      const result = await client.query(`
        INSERT INTO attachments 
        (entity_type, entity_id, file_name, original_name, file_size, mime_type, file_path, description, uploaded_by, workspace_id)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `, [
        entity_type,
        entity_id,
        file.filename,
        file.originalname,
        file.size,
        file.mimetype,
        file.path.replace(UPLOAD_DIR, ''), // Store relative path
        description || null,
        req.userId,
        workspace_id
      ]);
      attachments.push(result.rows[0]);
    }
    
    // Send notifications for task attachments
    if (entity_type === 'task') {
      try {
        const taskResult = await client.query(
          'SELECT t.name, t.project_id, p.workspace_id FROM tasks t JOIN projects p ON t.project_id = p.id WHERE t.id = $1',
          [entity_id]
        );
        if (taskResult.rows.length > 0) {
          const task = taskResult.rows[0];
          const followers = await notificationService.getTaskFollowers(entity_id, req.userId);
          
          for (const file of req.files) {
            await notificationService.notifyTaskAttachment({
              taskId: parseInt(entity_id),
              taskName: task.name,
              attachmentName: file.originalname,
              uploaderId: req.userId,
              projectId: task.project_id,
              workspaceId: task.workspace_id,
              followers,
            });
          }
        }
      } catch (notifErr) {
        console.error('Failed to send attachment notifications:', notifErr);
      }
    }

    await client.query('COMMIT');
    res.status(201).json(attachments);
  } catch (err) {
    await client.query('ROLLBACK');
    // Clean up files on error
    if (req.files) {
      req.files.forEach(file => {
        fs.unlink(file.path, () => {});
      });
    }
    console.error('Upload attachment error:', err);
    res.status(500).json({ error: 'Failed to upload attachments' });
  } finally {
    client.release();
  }
});

// Get attachments for an entity
router.get('/:entityType/:entityId', async (req, res) => {
  const { entityType, entityId } = req.params;

  if (!['task', 'client', 'chat_message'].includes(entityType)) {
    return res.status(400).json({ error: 'Invalid entity type' });
  }

  try {
    // Verify access
    const entityAccess = await verifyEntityAccess(entityType, entityId, req.userId, pool);
    if (!entityAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await pool.query(`
      SELECT a.*, u.first_name || ' ' || u.last_name as uploaded_by_name
      FROM attachments a
      JOIN users u ON a.uploaded_by = u.id
      WHERE a.entity_type = $1 AND a.entity_id = $2 AND a.deleted_at IS NULL
      ORDER BY a.created_at DESC
    `, [entityType, entityId]);

    res.json(result.rows);
  } catch (err) {
    console.error('Get attachments error:', err);
    res.status(500).json({ error: 'Failed to fetch attachments' });
  }
});

// Download attachment
router.get('/download/:attachmentId', async (req, res) => {
  const { attachmentId } = req.params;

  try {
    const result = await pool.query(`
      SELECT * FROM attachments WHERE id = $1 AND deleted_at IS NULL
    `, [attachmentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];

    // Verify access
    const entityAccess = await verifyEntityAccess(
      attachment.entity_type,
      attachment.entity_id,
      req.userId,
      pool
    );
    if (!entityAccess) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const filePath = path.join(UPLOAD_DIR, attachment.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found on server' });
    }

    res.download(filePath, attachment.original_name);
  } catch (err) {
    console.error('Download attachment error:', err);
    res.status(500).json({ error: 'Failed to download attachment' });
  }
});

// Delete attachment (soft delete)
router.delete('/:attachmentId', async (req, res) => {
  const { attachmentId } = req.params;

  try {
    const result = await pool.query(`
      SELECT * FROM attachments WHERE id = $1 AND deleted_at IS NULL
    `, [attachmentId]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = result.rows[0];

    // Check if user has permission (uploaded by them or admin/owner)
    if (attachment.uploaded_by !== req.userId) {
      // Check workspace role
      const roleResult = await pool.query(
        'SELECT role FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [attachment.workspace_id, req.userId]
      );
      if (roleResult.rows.length === 0 || !['Owner', 'Admin'].includes(roleResult.rows[0].role)) {
        return res.status(403).json({ error: 'Only the uploader or admin/owner can delete attachments' });
      }
    }

    // Soft delete
    await pool.query(
      'UPDATE attachments SET deleted_at = CURRENT_TIMESTAMP WHERE id = $1',
      [attachmentId]
    );

    res.json({ message: 'Attachment deleted' });
  } catch (err) {
    console.error('Delete attachment error:', err);
    res.status(500).json({ error: 'Failed to delete attachment' });
  }
});

module.exports = router;
