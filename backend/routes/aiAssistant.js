const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const { generateAssistantReply } = require('../services/aiAssistantService');

async function requireWorkspaceMember(req, res, next) {
  const workspaceId = parseInt(req.params.workspaceId, 10);

  if (!workspaceId) {
    return res.status(400).json({ error: 'Valid workspaceId is required' });
  }

  try {
    const result = await pool.query(
      `SELECT 1
       FROM workspace_members
       WHERE workspace_id = $1 AND user_id = $2`,
      [workspaceId, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Access denied to this workspace' });
    }

    req.workspaceId = workspaceId;
    next();
  } catch (error) {
    console.error('AI assistant workspace check failed:', error);
    res.status(500).json({ error: 'Failed to validate workspace access' });
  }
}

router.post('/workspace/:workspaceId/chat', requireWorkspaceMember, async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const history = req.body?.history || [];

  if (!message) {
    return res.status(400).json({ error: 'message is required' });
  }

  try {
    const result = await generateAssistantReply({
      workspaceId: req.workspaceId,
      userId: req.userId,
      message,
      history,
    });

    res.json(result);
  } catch (error) {
    console.error('AI assistant chat failed:', error);
    res.status(error.status || 500).json({
      error: error.status === 403 ? error.message : 'Failed to generate AI response',
    });
  }
});

module.exports = router;
