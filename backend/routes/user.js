const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const bcrypt = require('bcrypt');

// Get user settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         username,
         email,
         first_name,
         last_name,
         date_of_birth,
         manager_user_id,
         license_type,
         created_at,
         last_workspace_id,
         app_sidebar_collapsed,
         app_presence_status
       FROM users
       WHERE id = $1`,
      [req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Get settings error:', err);
    res.status(500).json({ error: 'Failed to fetch settings' });
  }
});

router.patch('/preferences', async (req, res) => {
  const { last_workspace_id, app_sidebar_collapsed, app_presence_status } = req.body || {};
  const allowedPresence = new Set(['online', 'busy', 'away']);

  if (
    last_workspace_id === undefined
    && app_sidebar_collapsed === undefined
    && app_presence_status === undefined
  ) {
    return res.status(400).json({ error: 'No preference updates provided' });
  }

  try {
    if (app_presence_status !== undefined && !allowedPresence.has(app_presence_status)) {
      return res.status(400).json({ error: 'Invalid presence status' });
    }

    if (last_workspace_id !== undefined && last_workspace_id !== null) {
      const membership = await pool.query(
        'SELECT 1 FROM workspace_members WHERE user_id = $1 AND workspace_id = $2',
        [req.userId, last_workspace_id]
      );

      if (membership.rows.length === 0) {
        return res.status(403).json({ error: 'Workspace access denied' });
      }
    }

    const updates = [];
    const values = [];

    if (last_workspace_id !== undefined) {
      values.push(last_workspace_id);
      updates.push(`last_workspace_id = $${values.length}`);
    }

    if (app_sidebar_collapsed !== undefined) {
      values.push(Boolean(app_sidebar_collapsed));
      updates.push(`app_sidebar_collapsed = $${values.length}`);
    }

    if (app_presence_status !== undefined) {
      values.push(app_presence_status);
      updates.push(`app_presence_status = $${values.length}`);
    }

    values.push(req.userId);

    const result = await pool.query(
      `UPDATE users
       SET ${updates.join(', ')}
       WHERE id = $${values.length}
       RETURNING
         id,
         username,
         email,
         first_name,
         last_name,
         date_of_birth,
         manager_user_id,
         license_type,
         created_at,
         last_workspace_id,
         app_sidebar_collapsed,
         app_presence_status`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update user preferences error:', err);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Update user profile
router.put('/profile', async (req, res) => {
  const { first_name, last_name, date_of_birth } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE users
       SET first_name = $1,
           last_name = $2,
           date_of_birth = $3
       WHERE id = $4
       RETURNING id, username, email, first_name, last_name, date_of_birth, manager_user_id`,
      [first_name, last_name, date_of_birth || null, req.userId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Change password
router.put('/password', async (req, res) => {
  const { current_password, new_password } = req.body;
  
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Current and new passwords are required' });
  }
  
  if (new_password.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  
  try {
    // Verify current password
    const userResult = await pool.query(
      'SELECT password_hash FROM users WHERE id = $1',
      [req.userId]
    );
    
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const isValid = await bcrypt.compare(current_password, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }
    
    // Hash new password
    const hash = await bcrypt.hash(new_password, 12);
    
    // Update password
    await pool.query(
      'UPDATE users SET password_hash = $1 WHERE id = $2',
      [hash, req.userId]
    );
    
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

module.exports = router;
