import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, MenuItem, Paper, Stack, Tab, Tabs, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { addHelpQueryMessage, createCorporateEvent, createHelpQuery, createLeaveRequest, createNewsTopic, createRating, getAiSettings, getCorporateEvents, getEmailRules, getHelpQueries, getHelpQueryMessages, getLeaveRequests, getManagerHoursChart, getNewsTopics, getRatings, getWorkspaceMembers, getWorkspacePerformance, updateAiSettings, updateEmailRule, updateLeaveApprovalStage } from '../../apiClient';

const emailRuleKeys = ['task_assigned', 'due_date_approaching', 'status_changed', 'comment_added', 'help_query_replied', 'leave_submitted', 'leave_approved'];
const fmt = (value) => {
  if (!value) return '-';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
};

function EmptyState({ message }) {
  return <Paper variant="outlined" sx={{ p: 3, borderRadius: 3, textAlign: 'center' }}><Typography variant="body2" color="text.secondary">{message}</Typography></Paper>;
}

function OperationsPage({ workspace, user }) {
  const [tab, setTab] = useState(0);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [performance, setPerformance] = useState([]);
  const [managerHours, setManagerHours] = useState([]);
  const [helpQueries, setHelpQueries] = useState([]);
  const [queryMessages, setQueryMessages] = useState([]);
  const [selectedQuery, setSelectedQuery] = useState(null);
  const [events, setEvents] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [leaveRequests, setLeaveRequests] = useState([]);
  const [aiSettings, setAiSettings] = useState({ enabled: false, config: {} });
  const [newsTopics, setNewsTopics] = useState([]);
  const [emailRules, setEmailRules] = useState([]);
  const [workspaceMembers, setWorkspaceMembers] = useState([]);
  const [dialog, setDialog] = useState('');
  const [form, setForm] = useState({});

  const canManage = ['Owner', 'Admin', 'ProjectAdmin'].includes(workspace?.role);

  const loadData = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      setError('');
      const results = await Promise.allSettled([
        getWorkspaceMembers(workspace.id),
        getWorkspacePerformance(workspace.id),
        getManagerHoursChart(workspace.id),
        getHelpQueries(workspace.id),
        getCorporateEvents(workspace.id),
        getRatings(workspace.id),
        getLeaveRequests(workspace.id),
        getAiSettings(workspace.id),
        getNewsTopics(workspace.id),
        getEmailRules(workspace.id),
      ]);
      setWorkspaceMembers(results[0].status === 'fulfilled' ? (results[0].value.data || []) : []);
      setPerformance(results[1].status === 'fulfilled' ? (results[1].value.data || []) : []);
      setManagerHours(results[2].status === 'fulfilled' ? (results[2].value.data || []) : []);
      setHelpQueries(results[3].status === 'fulfilled' ? (results[3].value.data || []) : []);
      setEvents(results[4].status === 'fulfilled' ? (results[4].value.data || []) : []);
      setRatings(results[5].status === 'fulfilled' ? (results[5].value.data || []) : []);
      setLeaveRequests(results[6].status === 'fulfilled' ? (results[6].value.data || []) : []);
      setAiSettings(results[7].status === 'fulfilled' ? (results[7].value.data || { enabled: false, config: {} }) : { enabled: false, config: {} });
      setNewsTopics(results[8].status === 'fulfilled' ? (results[8].value.data || []) : []);
      setEmailRules(results[9].status === 'fulfilled' ? (results[9].value.data || []) : []);
    } catch (_err) {
      setError('Failed to load operations data');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openDialog = (type) => {
    setError('');
    setForm({});
    setDialog(type);
  };

  const closeDialog = () => {
    setDialog('');
    setForm({});
  };

  const saveDialog = async () => {
    try {
      setSaving(true);
      if (dialog === 'query') await createHelpQuery(workspace.id, form);
      if (dialog === 'event') await createCorporateEvent(workspace.id, form);
      if (dialog === 'rating') await createRating(workspace.id, form);
      if (dialog === 'leave') await createLeaveRequest(workspace.id, form);
      if (dialog === 'news') await createNewsTopic(workspace.id, form);
      closeDialog();
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openQuery = async (query) => {
    try {
      setSelectedQuery(query);
      const response = await getHelpQueryMessages(query.id);
      setQueryMessages(response.data || []);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to open query thread');
    }
  };

  const replyToQuery = async () => {
    if (!selectedQuery || !form.query_reply?.trim()) return;
    try {
      await addHelpQueryMessage(selectedQuery.id, form.query_reply.trim());
      const response = await getHelpQueryMessages(selectedQuery.id);
      setQueryMessages(response.data || []);
      setForm((prev) => ({ ...prev, query_reply: '' }));
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to send reply');
    }
  };

  const saveAi = async () => {
    try {
      await updateAiSettings(workspace.id, aiSettings);
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save AI settings');
    }
  };

  const toggleRule = async (ruleKey, enabled) => {
    try {
      await updateEmailRule(workspace.id, ruleKey, { enabled, channels: enabled ? ['in_app', 'email'] : ['in_app'] });
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update email rule');
    }
  };

  const handleLeaveStageAction = async (leaveRequest, stage, action) => {
    try {
      await updateLeaveApprovalStage(leaveRequest.id, stage.id, { action });
      await loadData();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to update leave approval stage');
    }
  };

  const canSaveDialog = (() => {
    if (dialog === 'query') return Boolean(form.title?.trim() && form.description?.trim());
    if (dialog === 'event') return Boolean(form.title?.trim() && form.event_start);
    if (dialog === 'rating') return Boolean(form.employee_id && form.rating_score);
    if (dialog === 'leave') return Boolean(form.leave_type?.trim() && form.start_date && form.end_date && form.total_days);
    if (dialog === 'news') return Boolean(form.topic?.trim());
    return true;
  })();

  const dialogFields = () => {
    if (dialog === 'query') return <Stack spacing={2} sx={{ mt: 1 }}><TextField label="Title" value={form.title || ''} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} fullWidth /><TextField label="Description" value={form.description || ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} fullWidth multiline minRows={4} /><TextField label="Category" value={form.category || ''} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} fullWidth /><TextField select label="Priority" value={form.priority || 'medium'} onChange={(e) => setForm((prev) => ({ ...prev, priority: e.target.value }))} fullWidth><MenuItem value="low">Low</MenuItem><MenuItem value="medium">Medium</MenuItem><MenuItem value="high">High</MenuItem><MenuItem value="critical">Critical</MenuItem></TextField></Stack>;
    if (dialog === 'event') return <Stack spacing={2} sx={{ mt: 1 }}><TextField label="Title" value={form.title || ''} onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))} fullWidth /><TextField label="Description" value={form.description || ''} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} fullWidth multiline minRows={3} /><TextField type="datetime-local" label="Start" InputLabelProps={{ shrink: true }} value={form.event_start || ''} onChange={(e) => setForm((prev) => ({ ...prev, event_start: e.target.value }))} fullWidth /><TextField type="datetime-local" label="End" InputLabelProps={{ shrink: true }} value={form.event_end || ''} onChange={(e) => setForm((prev) => ({ ...prev, event_end: e.target.value }))} fullWidth /><TextField label="Category" value={form.category || ''} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} fullWidth /><TextField label="Audience" value={form.audience || ''} onChange={(e) => setForm((prev) => ({ ...prev, audience: e.target.value }))} fullWidth /><TextField label="Location" value={form.location || ''} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} fullWidth /></Stack>;
    if (dialog === 'rating') return <Stack spacing={2} sx={{ mt: 1 }}><TextField select label="Employee" value={form.employee_id || ''} onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))} fullWidth>{workspaceMembers.map((member) => <MenuItem key={member.id} value={member.id}>{`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}</MenuItem>)}</TextField><TextField type="number" label="Rating Score" value={form.rating_score || ''} onChange={(e) => setForm((prev) => ({ ...prev, rating_score: e.target.value }))} fullWidth inputProps={{ min: 1, max: 5, step: 0.5 }} /><TextField label="Period" value={form.period_label || ''} onChange={(e) => setForm((prev) => ({ ...prev, period_label: e.target.value }))} fullWidth /><TextField label="Remarks" value={form.remarks || ''} onChange={(e) => setForm((prev) => ({ ...prev, remarks: e.target.value }))} multiline minRows={3} fullWidth /></Stack>;
    if (dialog === 'leave') return <Stack spacing={2} sx={{ mt: 1 }}><TextField label="Leave Type" value={form.leave_type || ''} onChange={(e) => setForm((prev) => ({ ...prev, leave_type: e.target.value }))} fullWidth /><TextField type="date" label="Start Date" InputLabelProps={{ shrink: true }} value={form.start_date || ''} onChange={(e) => setForm((prev) => ({ ...prev, start_date: e.target.value }))} fullWidth /><TextField type="date" label="End Date" InputLabelProps={{ shrink: true }} value={form.end_date || ''} onChange={(e) => setForm((prev) => ({ ...prev, end_date: e.target.value }))} fullWidth /><TextField type="number" label="Total Days" value={form.total_days || ''} onChange={(e) => setForm((prev) => ({ ...prev, total_days: e.target.value }))} fullWidth inputProps={{ min: 0.5, step: 0.5 }} /><TextField label="Reason" value={form.reason || ''} onChange={(e) => setForm((prev) => ({ ...prev, reason: e.target.value }))} multiline minRows={3} fullWidth /></Stack>;
    if (dialog === 'news') return <Stack spacing={2} sx={{ mt: 1 }}><TextField label="Topic" value={form.topic || ''} onChange={(e) => setForm((prev) => ({ ...prev, topic: e.target.value }))} fullWidth /><TextField label="Category" value={form.category || ''} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} fullWidth /></Stack>;
    return null;
  };

  return (
    <Box sx={{ p: { xs: 1.25, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, mb: 2 }}>
        <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#0f766e', mb: 0.75 }}>OPERATIONS HUB</Typography>
        <Typography variant="h5" sx={{ fontWeight: 800 }}>Operations</Typography>
        <Typography variant="body2" color="text.secondary">Workspace operations for performance, helpdesk, events, AI/news, ratings, leave, and email rules.</Typography>
      </Paper>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <Paper sx={{ borderRadius: 3, overflow: 'hidden' }}>
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto">
          <Tab label="Performance" />
          <Tab label="Help Desk" />
          <Tab label="Events" />
          <Tab label="AI & News" />
          <Tab label="Ratings & Leave" />
          <Tab label="Email Rules" />
        </Tabs>

        <Box sx={{ p: 2.5 }}>
          {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box> : null}

          {!loading && tab === 0 && (
            <Stack spacing={2}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Employee Performance</Typography>
              {performance.length ? (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Assigned</TableCell><TableCell>Completed</TableCell><TableCell>Overdue</TableCell><TableCell>Hours</TableCell><TableCell>Avg Closure (hrs)</TableCell><TableCell>Rating</TableCell></TableRow></TableHead><TableBody>{performance.map((row) => <TableRow key={row.user_id}><TableCell>{row.user_name}</TableCell><TableCell>{row.tasks_assigned || 0}</TableCell><TableCell>{row.tasks_completed || 0}</TableCell><TableCell>{row.tasks_overdue || 0}</TableCell><TableCell>{row.hours_worked || 0}</TableCell><TableCell>{row.average_closure_hours || '-'}</TableCell><TableCell>{row.manager_rating || '-'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
              ) : <EmptyState message="No performance metrics are available yet." />}
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Manager Work Chart</Typography>
              {managerHours.length ? (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Date</TableCell><TableCell>Employee</TableCell><TableCell>Task</TableCell><TableCell>Project</TableCell><TableCell>Service</TableCell><TableCell>Hours</TableCell></TableRow></TableHead><TableBody>{managerHours.slice(0, 25).map((row, index) => <TableRow key={`${row.task_id}-${index}`}><TableCell>{row.work_date}</TableCell><TableCell>{row.user_name}</TableCell><TableCell>{row.task_name}</TableCell><TableCell>{row.project_name}</TableCell><TableCell>{row.service_name || '-'}</TableCell><TableCell>{row.hours}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
              ) : <EmptyState message={canManage ? 'No work log entries found yet.' : 'Manager-only chart data will appear here when work logs are available.'} />}
            </Stack>
          )}

          {!loading && tab === 1 && (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Help / Queries</Typography><Button variant="contained" onClick={() => openDialog('query')}>Raise Query</Button></Stack>
              {helpQueries.length ? (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Title</TableCell><TableCell>Priority</TableCell><TableCell>Status</TableCell><TableCell>Raised By</TableCell><TableCell>Updated</TableCell><TableCell /></TableRow></TableHead><TableBody>{helpQueries.map((query) => <TableRow key={query.id}><TableCell>{query.title}</TableCell><TableCell><Chip size="small" label={query.priority} /></TableCell><TableCell><Chip size="small" label={query.status} /></TableCell><TableCell>{query.raised_by_name}</TableCell><TableCell>{fmt(query.updated_at)}</TableCell><TableCell align="right"><Button size="small" onClick={() => openQuery(query)}>Open</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>
              ) : <EmptyState message="No help queries have been raised yet." />}
              {selectedQuery ? (
                <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>{selectedQuery.title}</Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{selectedQuery.description}</Typography>
                  <Stack spacing={1.25} sx={{ mb: 1.5 }}>{queryMessages.length ? queryMessages.map((message) => <Paper key={message.id} variant="outlined" sx={{ p: 1.5, borderRadius: 2 }}><Typography variant="body2" sx={{ fontWeight: 700 }}>{message.user_name}</Typography><Typography variant="body2" color="text.secondary">{message.message}</Typography><Typography variant="caption" color="text.secondary">{fmt(message.created_at)}</Typography></Paper>) : <Typography variant="body2" color="text.secondary">No replies yet.</Typography>}</Stack>
                  <Stack direction="row" spacing={1}><TextField fullWidth size="small" placeholder="Reply to this query" value={form.query_reply || ''} onChange={(e) => setForm((prev) => ({ ...prev, query_reply: e.target.value }))} /><Button variant="contained" disabled={!form.query_reply?.trim()} onClick={replyToQuery}>Reply</Button></Stack>
                </Paper>
              ) : null}
            </Stack>
          )}

          {!loading && tab === 2 && (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Corporate Events</Typography>{canManage ? <Button variant="contained" onClick={() => openDialog('event')}>Add Event</Button> : null}</Stack>
              {events.length ? events.map((event) => <Paper key={event.id} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Typography variant="subtitle2" sx={{ fontWeight: 800 }}>{event.title}</Typography><Typography variant="body2" color="text.secondary">{event.description || 'No description'}</Typography><Typography variant="caption" color="text.secondary">{fmt(event.event_start)}{event.location ? ` • ${event.location}` : ''}</Typography></Paper>) : <EmptyState message="No corporate events have been scheduled yet." />}
            </Stack>
          )}

          {!loading && tab === 3 && (
            <Stack spacing={2}>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Typography variant="subtitle1" sx={{ fontWeight: 800, mb: 1 }}>AI Assistant Shell</Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>This shell is ready for provider integration without hardcoded secrets.</Typography>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}><TextField label="Provider" value={aiSettings?.provider || ''} onChange={(e) => setAiSettings((prev) => ({ ...(prev || {}), provider: e.target.value }))} fullWidth /><TextField label="Model" value={aiSettings?.model || ''} onChange={(e) => setAiSettings((prev) => ({ ...(prev || {}), model: e.target.value }))} fullWidth /></Stack>
                <TextField sx={{ mt: 1.5 }} fullWidth multiline minRows={3} label="Config JSON" value={JSON.stringify(aiSettings?.config || {}, null, 2)} onChange={(e) => { try { const parsed = JSON.parse(e.target.value || '{}'); setAiSettings((prev) => ({ ...(prev || {}), config: parsed })); } catch (_err) {} }} />
                {canManage ? <Button sx={{ mt: 1.5 }} variant="contained" onClick={saveAi}>Save AI Settings</Button> : null}
              </Paper>
              <Paper variant="outlined" sx={{ p: 2, borderRadius: 3 }}>
                <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>News Topics</Typography>{canManage ? <Button variant="contained" onClick={() => openDialog('news')}>Add Topic</Button> : null}</Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>{newsTopics.length ? newsTopics.map((topic) => <Chip key={topic.id} label={`${topic.topic}${topic.category ? ` • ${topic.category}` : ''}`} />) : <Typography variant="body2" color="text.secondary">No news topics configured yet.</Typography>}</Stack>
              </Paper>
            </Stack>
          )}

          {!loading && tab === 4 && (
            <Stack spacing={2}>
              <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Ratings</Typography>{canManage ? <Button variant="contained" onClick={() => openDialog('rating')}>Add Rating</Button> : null}</Stack>
              {ratings.length ? (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Employee</TableCell><TableCell>Reviewer</TableCell><TableCell>Score</TableCell><TableCell>Period</TableCell><TableCell>Remarks</TableCell></TableRow></TableHead><TableBody>{ratings.map((rating) => <TableRow key={rating.id}><TableCell>{rating.employee_name}</TableCell><TableCell>{rating.reviewer_name}</TableCell><TableCell>{rating.rating_score}</TableCell><TableCell>{rating.period_label || '-'}</TableCell><TableCell>{rating.remarks || '-'}</TableCell></TableRow>)}</TableBody></Table></TableContainer>
              ) : <EmptyState message="No team ratings recorded yet." />}
              <Stack direction="row" justifyContent="space-between"><Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Leave Requests</Typography><Button variant="contained" onClick={() => openDialog('leave')}>Request Leave</Button></Stack>
              {leaveRequests.length ? (
                <TableContainer component={Paper} variant="outlined"><Table size="small"><TableHead><TableRow><TableCell>Requester</TableCell><TableCell>Type</TableCell><TableCell>Dates</TableCell><TableCell>Days</TableCell><TableCell>Status</TableCell><TableCell>Approval Flow</TableCell></TableRow></TableHead><TableBody>{leaveRequests.map((request) => { const stages = request.approval_stages || []; const currentStage = stages.find((stage) => stage.status === 'pending'); const canAct = currentStage && Number(currentStage.approver_id) === Number(user?.id); return <TableRow key={request.id}><TableCell>{request.requester_name}</TableCell><TableCell>{request.leave_type}</TableCell><TableCell>{request.start_date} to {request.end_date}</TableCell><TableCell>{request.total_days}</TableCell><TableCell><Chip size="small" label={request.status} /></TableCell><TableCell><Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>{stages.length ? stages.map((stage) => <Chip key={stage.id} size="small" label={`S${stage.stage_order}: ${stage.status}`} />) : <Typography variant="caption" color="text.secondary">Auto-approved</Typography>}{canAct ? <><Button size="small" variant="contained" onClick={() => handleLeaveStageAction(request, currentStage, 'approve')}>Approve</Button><Button size="small" color="error" variant="outlined" onClick={() => handleLeaveStageAction(request, currentStage, 'reject')}>Reject</Button></> : null}</Stack></TableCell></TableRow>; })}</TableBody></Table></TableContainer>
              ) : <EmptyState message="No leave requests found yet." />}
            </Stack>
          )}

          {!loading && tab === 5 && (
            <Stack spacing={1.5}>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>Email Notification Rules</Typography>
              {emailRuleKeys.map((ruleKey) => {
                const currentRule = emailRules.find((rule) => rule.rule_key === ruleKey);
                return <Paper key={ruleKey} variant="outlined" sx={{ p: 2, borderRadius: 3 }}><Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography variant="body2" sx={{ fontWeight: 700 }}>{ruleKey.replace(/_/g, ' ')}</Typography><Typography variant="caption" color="text.secondary">Channels: {(currentRule?.channels || ['in_app']).join(', ')}</Typography></Box>{canManage ? <Stack direction="row" spacing={1}><Button size="small" variant={currentRule?.enabled === false ? 'outlined' : 'contained'} onClick={() => toggleRule(ruleKey, true)}>Enable</Button><Button size="small" color="inherit" variant={currentRule?.enabled === false ? 'contained' : 'outlined'} onClick={() => toggleRule(ruleKey, false)}>Disable</Button></Stack> : null}</Stack></Paper>;
              })}
            </Stack>
          )}
        </Box>
      </Paper>

      <Dialog open={Boolean(dialog)} onClose={closeDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Create {dialog}</DialogTitle>
        <DialogContent>{dialogFields()}</DialogContent>
        <DialogActions><Button onClick={closeDialog}>Cancel</Button><Button variant="contained" onClick={saveDialog} disabled={!canSaveDialog || saving}>{saving ? 'Saving...' : 'Save'}</Button></DialogActions>
      </Dialog>
    </Box>
  );
}

export default OperationsPage;
