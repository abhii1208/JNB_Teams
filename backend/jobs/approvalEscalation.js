/**
 * Approval Escalation Job
 * Handles automatic escalation of approvals that haven't been actioned within the deadline
 */
const { pool } = require('../db');

const JOB_NAME = 'ApprovalEscalation';

async function checkAndEscalateApprovals() {
  const client = await pool.connect();
  
  try {
    console.log(`[${JOB_NAME}] Checking for approvals to escalate...`);
    
    // Find pending approvals past their escalation deadline
    const pendingApprovals = await client.query(`
      SELECT 
        a.id,
        a.requester_id,
        a.project_id,
        a.task_id,
        a.type,
        a.reason,
        a.created_at,
        a.escalation_deadline,
        a.escalation_level,
        a.last_reminder_sent_at,
        p.name as project_name,
        p.created_by as project_owner_id,
        t.name as task_name,
        u.first_name || ' ' || u.last_name as requester_name,
        COALESCE(pes.escalation_enabled, TRUE) as escalation_enabled,
        COALESCE(pes.escalation_hours, 24) as escalation_hours,
        COALESCE(pes.escalation_levels, 2) as escalation_levels,
        COALESCE(pes.send_reminders, TRUE) as send_reminders,
        COALESCE(pes.reminder_interval_hours, 8) as reminder_interval_hours,
        COALESCE(pes.notify_requester_on_escalation, TRUE) as notify_requester_on_escalation
      FROM approvals a
      JOIN projects p ON a.project_id = p.id
      LEFT JOIN tasks t ON a.task_id = t.id
      JOIN users u ON a.requester_id = u.id
      LEFT JOIN project_escalation_settings pes ON pes.project_id = p.id
      WHERE a.status = 'Pending'
        AND a.escalation_deadline IS NOT NULL
        AND a.escalation_deadline < CURRENT_TIMESTAMP
      ORDER BY a.escalation_deadline ASC
    `);
    
    if (pendingApprovals.rows.length === 0) {
      console.log(`[${JOB_NAME}] No approvals to escalate`);
      return { escalated: 0, reminders: 0 };
    }
    
    console.log(`[${JOB_NAME}] Found ${pendingApprovals.rows.length} approvals past deadline`);
    
    let escalatedCount = 0;
    let reminderCount = 0;
    
    for (const approval of pendingApprovals.rows) {
      if (!approval.escalation_enabled) {
        continue;
      }
      
      await client.query('BEGIN');
      
      try {
        const hoursSinceCreation = (Date.now() - new Date(approval.created_at).getTime()) / (1000 * 60 * 60);
        const currentLevel = approval.escalation_level || 0;
        
        let newLevel = currentLevel;
        let escalationAction = null;
        
        // Determine escalation level based on hours and configured levels
        // Level 1 = escalate to admins at escalation_hours
        // Level 2 = escalate to owner at 2x escalation_hours (if escalation_levels >= 2)
        const firstEscalationHours = approval.escalation_hours;
        const secondEscalationHours = approval.escalation_hours * 2;
        
        if (approval.escalation_levels >= 2 && hoursSinceCreation >= secondEscalationHours && currentLevel < 2) {
          newLevel = 2;
          escalationAction = 'escalated_to_owner';
        } else if (hoursSinceCreation >= firstEscalationHours && currentLevel < 1) {
          newLevel = 1;
          escalationAction = 'escalated_to_admins';
        }
        
        if (escalationAction && newLevel > currentLevel) {
          // Update approval escalation status
          await client.query(`
            UPDATE approvals 
            SET escalated = TRUE, 
                escalated_at = CURRENT_TIMESTAMP,
                escalation_level = $1,
                escalation_deadline = CURRENT_TIMESTAMP + INTERVAL '${approval.escalation_hours} hours'
            WHERE id = $2
          `, [newLevel, approval.id]);
          
          // Log audit trail
          await client.query(`
            INSERT INTO approval_audit_log (approval_id, action, performed_by, notes, metadata)
            VALUES ($1, $2, NULL, $3, $4)
          `, [
            approval.id,
            escalationAction,
            `Automatically escalated to level ${newLevel} after ${Math.round(hoursSinceCreation)} hours`,
            JSON.stringify({ 
              hours_since_creation: Math.round(hoursSinceCreation),
              previous_level: currentLevel,
              new_level: newLevel
            })
          ]);
          
          // Get approvers to notify based on escalation level
          let notifyUserIds = [];
          
          if (newLevel === 1) {
            // First escalation: notify all project approvers and admins
            const approvers = await client.query(`
              SELECT DISTINCT user_id FROM (
                SELECT user_id FROM project_approvers WHERE project_id = $1 AND is_active = TRUE
                UNION
                SELECT user_id FROM project_members WHERE project_id = $1 AND role IN ('Admin', 'Owner')
              ) combined
            `, [approval.project_id]);
            notifyUserIds = approvers.rows.map(r => r.user_id);
          } else if (newLevel === 2 && approval.escalation_levels >= 2) {
            // Second escalation: notify project owner directly
            notifyUserIds = [approval.project_owner_id];
          }
          
          // Create notifications for escalation
          for (const userId of notifyUserIds) {
            await client.query(`
              INSERT INTO notifications (user_id, type, title, message, task_id, project_id)
              VALUES ($1, 'Escalation', $2, $3, $4, $5)
            `, [
              userId,
              `⚠️ Approval Escalated - ${approval.project_name}`,
              `Approval request for "${approval.task_name || approval.type}" from ${approval.requester_name} has been pending for ${Math.round(hoursSinceCreation)} hours and requires immediate attention.`,
              approval.task_id,
              approval.project_id
            ]);
          }
          
          // Notify requester if enabled
          if (approval.notify_requester_on_escalation) {
            await client.query(`
              INSERT INTO notifications (user_id, type, title, message, task_id, project_id)
              VALUES ($1, 'Escalation', $2, $3, $4, $5)
            `, [
              approval.requester_id,
              `Your approval request has been escalated`,
              `Your "${approval.type}" approval for "${approval.task_name || 'task'}" has been escalated to ${newLevel === 2 ? 'project owner' : 'admins'} for review.`,
              approval.task_id,
              approval.project_id
            ]);
          }
          
          escalatedCount++;
          console.log(`[${JOB_NAME}] Escalated approval ${approval.id} to level ${newLevel}`);
        }
        
        // Send reminders if configured and not recently sent
        if (approval.send_reminders) {
          const hoursSinceLastReminder = approval.last_reminder_sent_at 
            ? (Date.now() - new Date(approval.last_reminder_sent_at).getTime()) / (1000 * 60 * 60)
            : approval.reminder_interval_hours + 1; // Ensure first reminder is sent
            
          if (hoursSinceLastReminder >= approval.reminder_interval_hours) {
            // Get current approvers
            const approvers = await client.query(`
              SELECT user_id FROM project_approvers 
              WHERE project_id = $1 AND is_active = TRUE
            `, [approval.project_id]);
            
            for (const approver of approvers.rows) {
              await client.query(`
                INSERT INTO notifications (user_id, type, title, message, task_id, project_id)
                VALUES ($1, 'Reminder', $2, $3, $4, $5)
              `, [
                approver.user_id,
                `🔔 Pending Approval Reminder`,
                `Approval request for "${approval.task_name || approval.type}" from ${approval.requester_name} is still pending (${Math.round(hoursSinceCreation)} hours).`,
                approval.task_id,
                approval.project_id
              ]);
            }
            
            // Update last reminder time
            await client.query(`
              UPDATE approvals SET last_reminder_sent_at = CURRENT_TIMESTAMP WHERE id = $1
            `, [approval.id]);
            
            reminderCount++;
          }
        }
        
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.error(`[${JOB_NAME}] Error processing approval ${approval.id}:`, err.message);
      }
    }
    
    console.log(`[${JOB_NAME}] Completed: ${escalatedCount} escalated, ${reminderCount} reminders sent`);
    return { escalated: escalatedCount, reminders: reminderCount };
    
  } catch (err) {
    console.error(`[${JOB_NAME}] Error:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

module.exports = {
  name: JOB_NAME,
  run: checkAndEscalateApprovals,
  interval: 15 * 60 * 1000, // Run every 15 minutes
};
