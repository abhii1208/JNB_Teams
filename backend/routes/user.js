const express = require('express');
const router = express.Router();
const { pool } = require('../db');
const bcrypt = require('bcrypt');

// Get user settings
router.get('/settings', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, first_name, last_name, license_type, created_at FROM users WHERE id = $1',
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

// Update user profile
router.put('/profile', async (req, res) => {
  const { first_name, last_name } = req.body;
  
  try {
    const result = await pool.query(
      'UPDATE users SET first_name = $1, last_name = $2 WHERE id = $3 RETURNING id, username, email, first_name, last_name',
      [first_name, last_name, req.userId]
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
