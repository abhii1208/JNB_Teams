import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Switch,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Chip,
  Avatar,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  IconButton,
  Tooltip,
  Paper,
  Grid,
  Divider,
  LinearProgress,
  Skeleton,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import SecurityIcon from '@mui/icons-material/Security';
import GroupIcon from '@mui/icons-material/Group';
import NotificationsActiveIcon from '@mui/icons-material/NotificationsActive';
import ViewColumnIcon from '@mui/icons-material/ViewColumn';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import DeleteIcon from '@mui/icons-material/Delete';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import WarningIcon from '@mui/icons-material/Warning';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import LockIcon from '@mui/icons-material/Lock';
import TimerIcon from '@mui/icons-material/Timer';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import LinkIcon from '@mui/icons-material/Link';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import {
  getProjectApprovers,
  addProjectApprover,
  removeProjectApprover,
  getEscalationSettings,
  updateEscalationSettings,
} from '../../apiClient';

// Compact Switch Component
const CompactSwitch = ({ checked, onChange, label, description, disabled, icon }) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      py: 1,
      px: 1.5,
      borderRadius: 1.5,
      bgcolor: checked ? 'rgba(15, 118, 110, 0.04)' : 'transparent',
      border: '1px solid',
      borderColor: checked ? 'rgba(15, 118, 110, 0.2)' : 'divider',
      transition: 'all 0.2s ease',
      '&:hover': {
        bgcolor: checked ? 'rgba(15, 118, 110, 0.08)' : 'action.hover',
      },
    }}
  >
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, flex: 1 }}>
      {icon && (
        <Box sx={{ color: checked ? 'primary.main' : 'text.secondary', display: 'flex' }}>
          {icon}
        </Box>
      )}
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2" sx={{ fontWeight: 500, color: disabled ? 'text.disabled' : 'text.primary' }}>
          {label}
        </Typography>
        {description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.3 }}>
            {description}
          </Typography>
        )}
      </Box>
    </Box>
    <Switch
      size="small"
      checked={checked}
      onChange={onChange}
      disabled={disabled}
      sx={{
        '& .MuiSwitch-switchBase.Mui-checked': {
          color: '#0f766e',
        },
        '& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track': {
          backgroundColor: '#0f766e',
        },
      }}
    />
  </Box>
);

// Section Header
const SectionHeader = ({ icon, title, count, color = 'primary.main' }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
    <Box
      sx={{
        width: 32,
        height: 32,
        borderRadius: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        bgcolor: `${color}15`,
        color: color,
      }}
    >
      {icon}
    </Box>
    <Typography variant="subtitle1" sx={{ fontWeight: 600, flex: 1 }}>
      {title}
    </Typography>
    {count !== undefined && (
      <Chip
        label={count}
        size="small"
        sx={{
          height: 20,
          fontSize: '0.7rem',
          bgcolor: `${color}15`,
          color: color,
        }}
      />
    )}
  </Box>
);

// Quick Stat Card
const QuickStatCard = ({ icon, label, value, color, active }) => (
  <Paper
    elevation={0}
    sx={{
      p: 1.5,
      borderRadius: 2,
      border: '1px solid',
      borderColor: active ? color : 'divider',
      bgcolor: active ? `${color}08` : 'background.paper',
      textAlign: 'center',
      transition: 'all 0.2s',
    }}
  >
    <Box sx={{ color: active ? color : 'text.secondary', mb: 0.5 }}>
      {icon}
    </Box>
    <Typography variant="h6" sx={{ fontWeight: 700, color: active ? color : 'text.primary' }}>
      {value}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      {label}
    </Typography>
  </Paper>
);

export default function ProjectSettings({
  project,
  projectSettings,
  setProjectSettings,
  members,
  user,
  userRole,
  onSaveSettings,
  settingsSaving,
  showToast,
  onOpenOwnershipTransfer,
}) {
  const [expandedSection, setExpandedSection] = useState('task-management');
  const [projectApprovers, setProjectApprovers] = useState([]);
  const [loadingApprovers, setLoadingApprovers] = useState(false);
  const [newApproverMember, setNewApproverMember] = useState('');
  const [escalationSettings, setEscalationSettings] = useState({
    escalation_enabled: true,
    escalation_hours: 24,
    escalation_levels: 2,
    notify_requester_on_escalation: true,
  });
  const [savingEscalation, setSavingEscalation] = useState(false);

  // Load approvers and escalation settings
  useEffect(() => {
    if (!project?.id) return;
    
    const fetchData = async () => {
      setLoadingApprovers(true);
      try {
        const [approversRes, escalationRes] = await Promise.all([
          getProjectApprovers(project.id),
          getEscalationSettings(project.id),
        ]);
        setProjectApprovers(approversRes.data || []);
        setEscalationSettings(escalationRes.data || {
          escalation_enabled: true,
          escalation_hours: 24,
          escalation_levels: 2,
          notify_requester_on_escalation: true,
        });
      } catch (err) {
        console.error('Failed to load settings data:', err);
      } finally {
        setLoadingApprovers(false);
      }
    };
    
    fetchData();
  }, [project?.id]);

  const handleAddApprover = async () => {
    if (!newApproverMember || !project?.id) return;
    try {
      await addProjectApprover(project.id, parseInt(newApproverMember, 10), 1);
      const res = await getProjectApprovers(project.id);
      setProjectApprovers(res.data || []);
      setNewApproverMember('');
      showToast('success', 'Approver added successfully');
    } catch (err) {
      console.error('Failed to add approver:', err);
      showToast('error', 'Failed to add approver');
    }
  };

  const handleRemoveApprover = async (userId) => {
    if (!project?.id) return;
    try {
      await removeProjectApprover(project.id, userId);
      const res = await getProjectApprovers(project.id);
      setProjectApprovers(res.data || []);
      showToast('success', 'Approver removed');
    } catch (err) {
      console.error('Failed to remove approver:', err);
      showToast('error', 'Failed to remove approver');
    }
  };

  const handleSaveEscalationSettings = async () => {
    if (!project?.id || savingEscalation) return;
    setSavingEscalation(true);
    try {
      const res = await updateEscalationSettings(project.id, escalationSettings);
      setEscalationSettings(res.data || escalationSettings);
      showToast('success', 'Escalation settings saved');
    } catch (err) {
      console.error('Failed to save escalation settings:', err);
      showToast('error', 'Failed to save escalation settings');
    } finally {
      setSavingEscalation(false);
    }
  };

  const handleAccordionChange = (panel) => (event, isExpanded) => {
    setExpandedSection(isExpanded ? panel : false);
  };

  // Calculate stats
  const activeSettings = [
    projectSettings.membersCanCreateTasks,
    projectSettings.membersCanCloseTasks,
    projectSettings.taskApprovalRequired,
    projectSettings.requireRejectionReason,
    escalationSettings.escalation_enabled,
  ].filter(Boolean).length;

  const accordionSx = {
    border: '1px solid',
    borderColor: 'divider',
    borderRadius: '12px !important',
    mb: 1.5,
    '&:before': { display: 'none' },
    '&.Mui-expanded': {
      margin: '0 0 12px 0',
      borderColor: 'primary.main',
      boxShadow: '0 4px 12px rgba(15, 118, 110, 0.08)',
    },
    overflow: 'hidden',
  };

  const accordionSummarySx = {
    minHeight: 56,
    '&.Mui-expanded': { minHeight: 56 },
    '& .MuiAccordionSummary-content': { my: 1 },
  };

  return (
    <Box sx={{ maxWidth: 720, mx: 'auto' }}>
      {/* Header Stats */}
      <Paper
        elevation={0}
        sx={{
          p: 2,
          mb: 3,
          borderRadius: 3,
          background: 'linear-gradient(135deg, #0f766e 0%, #115e59 100%)',
          color: 'white',
        }}
      >
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
            <SettingsIcon />
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Project Settings
            </Typography>
          </Box>
          <Chip
            label={`${activeSettings} active`}
            size="small"
            sx={{ bgcolor: 'rgba(255,255,255,0.2)', color: 'white' }}
          />
        </Box>
        
        <Grid container spacing={1.5}>
          <Grid item xs={3}>
            <QuickStatCard
              icon={<TaskAltIcon fontSize="small" />}
              label="Approvers"
              value={projectApprovers.length}
              color="#0f766e"
              active={projectApprovers.length > 0}
            />
          </Grid>
          <Grid item xs={3}>
            <QuickStatCard
              icon={<GroupIcon fontSize="small" />}
              label="Members"
              value={members?.length || 0}
              color="#7c3aed"
              active={true}
            />
          </Grid>
          <Grid item xs={3}>
            <QuickStatCard
              icon={<SecurityIcon fontSize="small" />}
              label="Approval"
              value={projectSettings.taskApprovalRequired ? 'ON' : 'OFF'}
              color={projectSettings.taskApprovalRequired ? '#059669' : '#dc2626'}
              active={projectSettings.taskApprovalRequired}
            />
          </Grid>
          <Grid item xs={3}>
            <QuickStatCard
              icon={<TimerIcon fontSize="small" />}
              label="Escalation"
              value={escalationSettings.escalation_enabled ? `${escalationSettings.escalation_hours}h` : 'OFF'}
              color={escalationSettings.escalation_enabled ? '#f59e0b' : '#6b7280'}
              active={escalationSettings.escalation_enabled}
            />
          </Grid>
        </Grid>
      </Paper>

      {/* Task Management Section */}
      <Accordion
        expanded={expandedSection === 'task-management'}
        onChange={handleAccordionChange('task-management')}
        sx={accordionSx}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
          <SectionHeader
            icon={<TaskAltIcon fontSize="small" />}
            title="Task Creation & Management"
            color="#0f766e"
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <CompactSwitch
              checked={projectSettings.membersCanCreateTasks}
              onChange={(e) => setProjectSettings({ ...projectSettings, membersCanCreateTasks: e.target.checked })}
              label="Members can create tasks"
              description="Allow project members to add new tasks"
              icon={<PersonAddIcon fontSize="small" />}
            />
            <CompactSwitch
              checked={projectSettings.membersCanCloseTasks}
              onChange={(e) => setProjectSettings({ ...projectSettings, membersCanCloseTasks: e.target.checked })}
              label="Members can request task closure"
              description="Tasks will require approval before being marked as closed"
              icon={<CheckCircleIcon fontSize="small" />}
            />
            <CompactSwitch
              checked={projectSettings.enableMultiProjectLinks}
              onChange={(e) => setProjectSettings({ ...projectSettings, enableMultiProjectLinks: e.target.checked })}
              label="Enable multi-project linking"
              description="Allow tasks to appear in other projects as linked references"
              icon={<LinkIcon fontSize="small" />}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Approval Workflow Section */}
      <Accordion
        expanded={expandedSection === 'approval-workflow'}
        onChange={handleAccordionChange('approval-workflow')}
        sx={accordionSx}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
          <SectionHeader
            icon={<VerifiedUserIcon fontSize="small" />}
            title="Approval Workflow"
            color="#7c3aed"
            count={projectSettings.taskApprovalRequired ? 'Active' : 'Disabled'}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Alert 
            severity={projectSettings.taskApprovalRequired ? 'success' : 'warning'} 
            sx={{ mb: 2, py: 0.5 }}
            icon={projectSettings.taskApprovalRequired ? <CheckCircleIcon fontSize="small" /> : <WarningIcon fontSize="small" />}
          >
            <Typography variant="caption">
              {projectSettings.taskApprovalRequired 
                ? 'Task approval is required before closing tasks'
                : 'Tasks will be auto-closed without approval'}
            </Typography>
          </Alert>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <CompactSwitch
              checked={projectSettings.taskApprovalRequired}
              onChange={(e) => setProjectSettings({ ...projectSettings, taskApprovalRequired: e.target.checked })}
              label="Require task approval"
              description="When disabled, completed tasks will be auto-closed"
              icon={<SecurityIcon fontSize="small" />}
            />
            
            <Divider sx={{ my: 1 }} />
            
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', px: 1 }}>
              Who Can Approve
            </Typography>
            
            <CompactSwitch
              checked={projectSettings.adminsCanApprove}
              onChange={(e) => setProjectSettings({ ...projectSettings, adminsCanApprove: e.target.checked })}
              disabled={projectSettings.onlyOwnerApproves}
              label="Admins can approve"
              description="Both Owner and Admins can approve task closures"
              icon={<AdminPanelSettingsIcon fontSize="small" />}
            />
            <CompactSwitch
              checked={projectSettings.onlyOwnerApproves}
              onChange={(e) => setProjectSettings({ 
                ...projectSettings, 
                onlyOwnerApproves: e.target.checked, 
                adminsCanApprove: !e.target.checked 
              })}
              label="Only Owner can approve (Strict Mode)"
              description="Only the project owner has final approval authority"
              icon={<LockIcon fontSize="small" />}
            />
            
            <Divider sx={{ my: 1 }} />
            
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', px: 1 }}>
              Auto-Approval Rules
            </Typography>
            
            <CompactSwitch
              checked={projectSettings.autoApproveOwnerTasks}
              onChange={(e) => setProjectSettings({ ...projectSettings, autoApproveOwnerTasks: e.target.checked })}
              label="Auto-approve owner's tasks"
              description="Tasks completed by owner bypass approval"
              icon={<AutorenewIcon fontSize="small" />}
            />
            <CompactSwitch
              checked={projectSettings.autoApproveAdminTasks}
              onChange={(e) => setProjectSettings({ ...projectSettings, autoApproveAdminTasks: e.target.checked })}
              label="Auto-approve admin's tasks"
              description="Tasks completed by admins bypass approval"
              icon={<AutorenewIcon fontSize="small" />}
            />
            
            <Divider sx={{ my: 1 }} />
            
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, textTransform: 'uppercase', px: 1 }}>
              Task Creation Approval
            </Typography>
            
            <CompactSwitch
              checked={projectSettings.memberTaskApproval}
              onChange={(e) => setProjectSettings({ ...projectSettings, memberTaskApproval: e.target.checked })}
              label="Approve member-created tasks"
              description="Member-created tasks require approval before being active"
              icon={<PersonIcon fontSize="small" />}
            />
            <CompactSwitch
              checked={projectSettings.adminTaskApproval}
              onChange={(e) => setProjectSettings({ ...projectSettings, adminTaskApproval: e.target.checked })}
              label="Approve admin-created tasks"
              description="Admin-created tasks require approval before being active"
              icon={<AdminPanelSettingsIcon fontSize="small" />}
            />
            
            <Divider sx={{ my: 1 }} />
            
            <CompactSwitch
              checked={projectSettings.requireRejectionReason}
              onChange={(e) => setProjectSettings({ ...projectSettings, requireRejectionReason: e.target.checked })}
              label="Require rejection reason"
              description="Approvers must explain when rejecting task closures"
              icon={<InfoOutlinedIcon fontSize="small" />}
            />
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Designated Approvers Section */}
      <Accordion
        expanded={expandedSection === 'approvers'}
        onChange={handleAccordionChange('approvers')}
        sx={accordionSx}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
          <SectionHeader
            icon={<GroupIcon fontSize="small" />}
            title="Designated Approvers"
            color="#059669"
            count={projectApprovers.length}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          {/* Tagged Approver Selection */}
          <Box sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
              <PersonIcon fontSize="small" /> Tagged Approver
            </Typography>
            <FormControl fullWidth size="small">
              <InputLabel>Select Tagged Approver</InputLabel>
              <Select
                value={projectSettings.approvalTaggedMemberId?.toString() || ''}
                label="Select Tagged Approver"
                onChange={(e) => {
                  const newValue = e.target.value === '' ? null : parseInt(e.target.value, 10);
                  setProjectSettings({ ...projectSettings, approvalTaggedMemberId: newValue });
                }}
              >
                <MenuItem value="">
                  <em>None - Use default approval flow</em>
                </MenuItem>
                {(members || []).filter(m => m && m.id).map(member => (
                  <MenuItem key={member.id} value={member.id.toString()}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Avatar sx={{ width: 24, height: 24, fontSize: '0.7rem' }}>
                        {member.first_name?.[0]}{member.last_name?.[0]}
                      </Avatar>
                      <Typography variant="body2">
                        {member.first_name} {member.last_name}
                      </Typography>
                      <Chip label={member.role} size="small" sx={{ height: 18, fontSize: '0.65rem' }} />
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <Divider sx={{ my: 2 }} />

          {/* Multiple Approvers */}
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Additional Approvers
          </Typography>
          
          {loadingApprovers ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
              <Skeleton variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
            </Box>
          ) : projectApprovers.length > 0 ? (
            <List dense sx={{ mb: 2, bgcolor: 'grey.50', borderRadius: 2, p: 0.5 }}>
              {projectApprovers.map((approver) => (
                <ListItem
                  key={approver.id}
                  sx={{
                    bgcolor: 'background.paper',
                    borderRadius: 1.5,
                    mb: 0.5,
                    '&:last-child': { mb: 0 },
                  }}
                  secondaryAction={
                    <Tooltip title="Remove approver">
                      <IconButton edge="end" size="small" onClick={() => handleRemoveApprover(approver.user_id)}>
                        <DeleteIcon fontSize="small" color="error" />
                      </IconButton>
                    </Tooltip>
                  }
                >
                  <ListItemAvatar>
                    <Avatar sx={{ width: 32, height: 32, fontSize: '0.8rem', bgcolor: '#059669' }}>
                      {approver.user_name?.split(' ').map(n => n[0]).join('') || 'U'}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={<Typography variant="body2" sx={{ fontWeight: 500 }}>{approver.user_name}</Typography>}
                    secondary={<Typography variant="caption" color="text.secondary">Added by {approver.added_by_name || 'Unknown'}</Typography>}
                  />
                </ListItem>
              ))}
            </List>
          ) : (
            <Alert severity="info" sx={{ mb: 2, py: 0.5 }}>
              <Typography variant="caption">No additional approvers configured</Typography>
            </Alert>
          )}

          {/* Add Approver */}
          <Box sx={{ display: 'flex', gap: 1 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Add Approver</InputLabel>
              <Select
                value={newApproverMember}
                label="Add Approver"
                onChange={(e) => setNewApproverMember(e.target.value)}
              >
                <MenuItem value=""><em>Select member</em></MenuItem>
                {(members || [])
                  .filter(m => m && m.id && !projectApprovers.some(pa => pa.user_id === m.id))
                  .map(member => (
                    <MenuItem key={member.id} value={member.id.toString()}>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar sx={{ width: 20, height: 20, fontSize: '0.65rem' }}>
                          {member.first_name?.[0]}{member.last_name?.[0]}
                        </Avatar>
                        <Typography variant="body2">{member.first_name} {member.last_name}</Typography>
                      </Box>
                    </MenuItem>
                  ))}
              </Select>
            </FormControl>
            <Button
              variant="contained"
              size="small"
              onClick={handleAddApprover}
              disabled={!newApproverMember}
              sx={{ minWidth: 80, bgcolor: '#059669', '&:hover': { bgcolor: '#047857' } }}
            >
              Add
            </Button>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Escalation Settings Section */}
      <Accordion
        expanded={expandedSection === 'escalation'}
        onChange={handleAccordionChange('escalation')}
        sx={accordionSx}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
          <SectionHeader
            icon={<NotificationsActiveIcon fontSize="small" />}
            title="Auto-Escalation"
            color="#f59e0b"
            count={escalationSettings.escalation_enabled ? 'Active' : 'Disabled'}
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <CompactSwitch
            checked={escalationSettings.escalation_enabled}
            onChange={(e) => setEscalationSettings({ ...escalationSettings, escalation_enabled: e.target.checked })}
            label="Enable auto-escalation"
            description="Automatically escalate pending approvals if not reviewed in time"
            icon={<TimerIcon fontSize="small" />}
          />

          {escalationSettings.escalation_enabled && (
            <Box sx={{ mt: 2, pl: 1 }}>
              <Grid container spacing={2}>
                <Grid item xs={6}>
                  <TextField
                    fullWidth
                    size="small"
                    type="number"
                    label="Escalation Time (hours)"
                    value={escalationSettings.escalation_hours}
                    onChange={(e) => setEscalationSettings({
                      ...escalationSettings,
                      escalation_hours: parseInt(e.target.value, 10) || 24
                    })}
                    inputProps={{ min: 1, max: 168 }}
                    helperText="1-168 hours"
                  />
                </Grid>
                <Grid item xs={6}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Escalation Levels</InputLabel>
                    <Select
                      value={escalationSettings.escalation_levels}
                      label="Escalation Levels"
                      onChange={(e) => setEscalationSettings({
                        ...escalationSettings,
                        escalation_levels: e.target.value
                      })}
                    >
                      <MenuItem value={1}>1 - Admins only</MenuItem>
                      <MenuItem value={2}>2 - Admins, then Owner</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
              </Grid>

              <Box sx={{ mt: 2 }}>
                <CompactSwitch
                  checked={escalationSettings.notify_requester_on_escalation}
                  onChange={(e) => setEscalationSettings({ 
                    ...escalationSettings, 
                    notify_requester_on_escalation: e.target.checked 
                  })}
                  label="Notify requester on escalation"
                  description="Send notification to the person who submitted the approval"
                  icon={<NotificationsActiveIcon fontSize="small" />}
                />
              </Box>

              <Button
                variant="outlined"
                size="small"
                onClick={handleSaveEscalationSettings}
                disabled={savingEscalation}
                sx={{ mt: 2 }}
              >
                {savingEscalation ? 'Saving...' : 'Save Escalation Settings'}
              </Button>
            </Box>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Column & Display Settings */}
      <Accordion
        expanded={expandedSection === 'columns'}
        onChange={handleAccordionChange('columns')}
        sx={accordionSx}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
          <SectionHeader
            icon={<ViewColumnIcon fontSize="small" />}
            title="Column & Display Settings"
            color="#6366f1"
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1.5 }}>
            Freeze Columns
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
            Select columns to freeze when scrolling horizontally
          </Typography>
          
          <Grid container spacing={1}>
            {['Task Name', 'Assignee', 'Stage', 'Status'].map((col) => (
              <Grid item xs={6} key={col}>
                <CompactSwitch
                  checked={projectSettings.freezeColumns?.includes(col)}
                  onChange={(e) => {
                    const newFrozen = e.target.checked
                      ? [...(projectSettings.freezeColumns || []), col]
                      : (projectSettings.freezeColumns || []).filter(c => c !== col);
                    setProjectSettings({ ...projectSettings, freezeColumns: newFrozen });
                  }}
                  label={col}
                />
              </Grid>
            ))}
          </Grid>

          <Divider sx={{ my: 2 }} />

          <TextField
            fullWidth
            size="small"
            type="number"
            label="Auto-close after (days)"
            value={projectSettings.autoCloseAfterDays}
            onChange={(e) => setProjectSettings({ 
              ...projectSettings, 
              autoCloseAfterDays: parseInt(e.target.value) || 0 
            })}
            helperText="Automatically close tasks after X days with no response (0 = disabled)"
          />
        </AccordionDetails>
      </Accordion>

      {/* Permissions & Visibility */}
      <Accordion
        expanded={expandedSection === 'permissions'}
        onChange={handleAccordionChange('permissions')}
        sx={accordionSx}
      >
        <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={accordionSummarySx}>
          <SectionHeader
            icon={<SecurityIcon fontSize="small" />}
            title="Permissions & Visibility"
            color="#dc2626"
          />
        </AccordionSummary>
        <AccordionDetails sx={{ pt: 0 }}>
          <CompactSwitch
            checked={projectSettings.showSettingsToAdmin}
            onChange={(e) => setProjectSettings({ ...projectSettings, showSettingsToAdmin: e.target.checked })}
            label="Show settings to admins"
            description="Allow project admins to view and modify these settings"
            icon={<AdminPanelSettingsIcon fontSize="small" />}
          />

          {userRole === 'Owner' && (
            <>
              <Divider sx={{ my: 2 }} />
              <Alert severity="warning" sx={{ mb: 2, py: 0.5 }}>
                <Typography variant="caption">
                  <strong>Danger Zone:</strong> The following action cannot be undone
                </Typography>
              </Alert>
              <Button
                variant="outlined"
                color="warning"
                size="small"
                startIcon={<SwapHorizIcon />}
                onClick={onOpenOwnershipTransfer}
              >
                Transfer Project Ownership
              </Button>
            </>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Save Button */}
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          size="large"
          onClick={onSaveSettings}
          disabled={settingsSaving}
          sx={{
            minWidth: 200,
            bgcolor: '#0f766e',
            '&:hover': { bgcolor: '#115e59' },
            borderRadius: 2,
            py: 1.5,
          }}
        >
          {settingsSaving ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <LinearProgress sx={{ width: 20 }} />
              Saving...
            </Box>
          ) : (
            'Save All Settings'
          )}
        </Button>
      </Box>
    </Box>
  );
}
