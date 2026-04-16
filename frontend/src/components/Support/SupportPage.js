import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Avatar,
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  List,
  ListItemButton,
  ListItemText,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ForumIcon from '@mui/icons-material/Forum';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RefreshIcon from '@mui/icons-material/Refresh';
import RateReviewOutlinedIcon from '@mui/icons-material/RateReviewOutlined';
import SupportAgentIcon from '@mui/icons-material/SupportAgent';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import { useSnackbar } from 'notistack';
import {
  addSupportTicketComment,
  createSupportTicket,
  deleteSupportTicket,
  getSupportTicket,
  getSupportTicketComments,
  listSupportTickets,
  updateSupportTicket,
} from '../../apiClient';

const defaultForm = {
  category: 'Technical',
  title: '',
  description: '',
};

const statusColors = {
  Open: { bg: 'rgba(14, 165, 233, 0.12)', color: '#0369a1' },
  'In Progress': { bg: 'rgba(245, 158, 11, 0.14)', color: '#b45309' },
  Closed: { bg: 'rgba(34, 197, 94, 0.14)', color: '#15803d' },
  Resolved: { bg: 'rgba(34, 197, 94, 0.14)', color: '#15803d' },
};

const hubTabMeta = {
  open: {
    label: 'Open Tickets',
    icon: <ForumIcon fontSize="small" />,
    color: '#0369a1',
    bg: 'rgba(14, 165, 233, 0.12)',
  },
  closed: {
    label: 'Closed Tickets',
    icon: <TaskAltOutlinedIcon fontSize="small" />,
    color: '#15803d',
    bg: 'rgba(34, 197, 94, 0.10)',
  },
  suggestions: {
    label: 'Suggestions',
    icon: <LightbulbOutlinedIcon fontSize="small" />,
    color: '#b45309',
    bg: 'rgba(245, 158, 11, 0.12)',
  },
  feedback: {
    label: 'Feedback',
    icon: <RateReviewOutlinedIcon fontSize="small" />,
    color: '#0f766e',
    bg: 'rgba(15, 118, 110, 0.10)',
  },
};

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

function getInitials(name) {
  const parts = String(name || 'U').trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() || '').join('') || 'U';
}

function isSpecialTicketCategory(category) {
  return ['Suggestion', 'Feedback'].includes(String(category || ''));
}

function SupportPage({ workspace, user, navigationState, onNavigationConsumed }) {
  const { enqueueSnackbar } = useSnackbar();
  const [tickets, setTickets] = useState([]);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState(null);
  const [categories, setCategories] = useState(['Technical', 'HR', 'General', 'Billing', 'Access', 'Suggestion', 'Feedback']);
  const [statuses, setStatuses] = useState(['Open', 'In Progress', 'Resolved']);
  const [canManage, setCanManage] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(defaultForm);
  const [creating, setCreating] = useState(false);
  const [comment, setComment] = useState('');
  const [commenting, setCommenting] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [hubOpen, setHubOpen] = useState(false);
  const [hubTab, setHubTab] = useState('open');

  const loadTicketDetail = async (ticketId) => {
    if (!ticketId) {
      setSelectedTicket(null);
      setComments([]);
      return;
    }

    try {
      setDetailLoading(true);
      const [ticketRes, commentsRes] = await Promise.all([
        getSupportTicket(ticketId),
        getSupportTicketComments(ticketId),
      ]);
      setSelectedTicket(ticketRes.data);
      setComments(Array.isArray(commentsRes.data) ? commentsRes.data : []);
    } catch (err) {
      console.error('Failed to load support ticket detail:', err);
      setError(err.response?.data?.error || 'Failed to load ticket details');
    } finally {
      setDetailLoading(false);
    }
  };

  const loadTickets = async (preferredTicketId = null) => {
    if (!workspace?.id) return;

    try {
      setLoading(true);
      setError(null);
      const ticketsRes = await listSupportTickets(workspace.id);
      const nextTickets = Array.isArray(ticketsRes.data?.tickets) ? ticketsRes.data.tickets : [];
      setTickets(nextTickets);
      setCanManage(Boolean(ticketsRes.data?.can_manage));
      setCategories(ticketsRes.data?.categories || ['Technical', 'HR', 'General', 'Billing', 'Access', 'Suggestion', 'Feedback']);
      setStatuses(ticketsRes.data?.statuses || ['Open', 'In Progress', 'Resolved']);

      const regularTickets = nextTickets.filter((ticket) => !isSpecialTicketCategory(ticket.category));
      const preferredRegularTicketId = regularTickets.find((ticket) => ticket.id === preferredTicketId)?.id || null;
      const selectedRegularTicketId = regularTickets.find((ticket) => ticket.id === selectedTicketId)?.id || null;
      const nextSelectedId = preferredRegularTicketId || selectedRegularTicketId || regularTickets[0]?.id || null;
      setSelectedTicketId(nextSelectedId);
      if (nextSelectedId) {
        await loadTicketDetail(nextSelectedId);
      } else {
        setSelectedTicket(null);
        setComments([]);
      }
    } catch (err) {
      console.error('Failed to load support tickets:', err);
      setError(err.response?.data?.error || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTickets(navigationState?.ticketId || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  useEffect(() => {
    if (navigationState?.ticketId) {
      setSelectedTicketId(navigationState.ticketId);
      loadTicketDetail(navigationState.ticketId);
      onNavigationConsumed?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigationState?.ticketId]);

  const regularTickets = useMemo(
    () => tickets.filter((ticket) => !isSpecialTicketCategory(ticket.category)),
    [tickets]
  );

  const filteredTickets = regularTickets.filter((ticket) => {
    if (statusFilter !== 'All' && ticket.status !== statusFilter) return false;
    if (categoryFilter !== 'All' && ticket.category !== categoryFilter) return false;
    if (!search.trim()) return true;

    const haystack = [
      ticket.title,
      ticket.description,
      ticket.category,
      ticket.creator_name,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(search.trim().toLowerCase());
  });

  const counts = {
    total: regularTickets.length,
    open: regularTickets.filter((ticket) => ticket.status === 'Open').length,
    progress: regularTickets.filter((ticket) => ticket.status === 'In Progress').length,
    closed: regularTickets.filter((ticket) => ['Closed', 'Resolved'].includes(ticket.status)).length,
  };

  const openTickets = useMemo(
    () => tickets.filter((ticket) => (
      ['Open', 'In Progress'].includes(ticket.status)
      && !['Suggestion', 'Feedback'].includes(ticket.category)
    )),
    [tickets]
  );

  const closedTickets = useMemo(
    () => tickets.filter((ticket) => (
      ['Closed', 'Resolved'].includes(ticket.status)
      && !['Suggestion', 'Feedback'].includes(ticket.category)
    )),
    [tickets]
  );

  const suggestionTickets = useMemo(
    () => tickets.filter((ticket) => ticket.category === 'Suggestion'),
    [tickets]
  );

  const feedbackTickets = useMemo(
    () => tickets.filter((ticket) => ticket.category === 'Feedback'),
    [tickets]
  );

  const mainPageCategories = useMemo(
    () => categories.filter((category) => !isSpecialTicketCategory(category)),
    [categories]
  );

  const canUpdateStatus = Boolean(
    selectedTicket &&
      (selectedTicket.can_manage || Number(selectedTicket.created_by) === Number(user?.id))
  );

  const canDeleteTicket = Boolean(
    selectedTicket &&
      (selectedTicket.can_manage || Number(selectedTicket.created_by) === Number(user?.id))
  );

  const statusChoices = selectedTicket?.can_manage ? statuses : ['Open', 'Resolved'];

  const openCreateDialog = (category = categories[0] || 'Technical') => {
    setCreateForm({
      category,
      title: '',
      description: '',
    });
    setCreateOpen(true);
  };

  const handleSelectTicket = async (ticketId) => {
    setSelectedTicketId(ticketId);
    await loadTicketDetail(ticketId);
  };

  const handleCreateTicket = async () => {
    if (!createForm.title.trim() || !createForm.description.trim()) {
      enqueueSnackbar('Title and description are required', { variant: 'warning' });
      return;
    }

    try {
      setCreating(true);
      const response = await createSupportTicket(workspace.id, {
        category: createForm.category,
        title: createForm.title.trim(),
        description: createForm.description.trim(),
      });
      const createdCategory = createForm.category;
      enqueueSnackbar(`${createForm.category} created`, { variant: 'success' });
      setCreateOpen(false);
      setCreateForm({ ...defaultForm });
      if (isSpecialTicketCategory(createdCategory)) {
        setHubTab(createdCategory === 'Suggestion' ? 'suggestions' : 'feedback');
        setHubOpen(true);
        setSelectedTicketId(null);
        setSelectedTicket(null);
        setComments([]);
        await loadTickets(null);
      } else {
        await loadTickets(response.data?.id);
      }
    } catch (err) {
      console.error('Failed to create support ticket:', err);
      enqueueSnackbar(err.response?.data?.error || 'Failed to create ticket', { variant: 'error' });
    } finally {
      setCreating(false);
    }
  };

  const handlePostComment = async () => {
    if (!selectedTicketId || !comment.trim()) return;

    try {
      setCommenting(true);
      await addSupportTicketComment(selectedTicketId, comment.trim());
      setComment('');
      enqueueSnackbar('Reply posted', { variant: 'success' });
      await loadTickets(selectedTicketId);
    } catch (err) {
      console.error('Failed to add support ticket comment:', err);
      enqueueSnackbar(err.response?.data?.error || 'Failed to post reply', { variant: 'error' });
    } finally {
      setCommenting(false);
    }
  };

  const handleStatusChange = async (event) => {
    const nextStatus = event.target.value;
    if (!selectedTicketId || !nextStatus || nextStatus === selectedTicket?.status) return;

    try {
      setUpdatingStatus(true);
      await updateSupportTicket(selectedTicketId, { status: nextStatus });
      enqueueSnackbar(`Ticket marked ${nextStatus}`, { variant: 'success' });
      await loadTickets(selectedTicketId);
    } catch (err) {
      console.error('Failed to update support ticket status:', err);
      enqueueSnackbar(err.response?.data?.error || 'Failed to update status', { variant: 'error' });
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleDeleteTicket = async () => {
    if (!selectedTicketId || !selectedTicket) return;

    const confirmed = window.confirm(`Delete ticket "${selectedTicket.title}"?`);
    if (!confirmed) return;

    try {
      await deleteSupportTicket(selectedTicketId);
      enqueueSnackbar('Ticket deleted', { variant: 'success' });
      const remainingTickets = tickets.filter((ticket) => ticket.id !== selectedTicketId);
      const nextTicketId = remainingTickets[0]?.id || null;
      setSelectedTicketId(nextTicketId);
      await loadTickets(nextTicketId);
    } catch (err) {
      console.error('Failed to delete support ticket:', err);
      enqueueSnackbar(err.response?.data?.error || 'Failed to delete ticket', { variant: 'error' });
    }
  };

  const handleHubTicketSelect = async (ticketId) => {
    setHubOpen(false);
    await handleSelectTicket(ticketId);
  };

  const renderHubTicketList = (items, emptyLabel) => {
    if (items.length === 0) {
      return (
        <Box
          sx={{
            py: 8,
            textAlign: 'center',
            border: '1px dashed rgba(148,163,184,0.35)',
            borderRadius: 3,
            bgcolor: 'rgba(248,250,252,0.8)',
          }}
        >
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 0.75 }}>
            {emptyLabel}
          </Typography>
        </Box>
      );
    }

    return (
      <Grid container spacing={2}>
        {items.map((ticket) => {
          const colors = statusColors[ticket.status] || statusColors.Open;
          return (
            <Grid item xs={12} md={6} key={ticket.id}>
              <Card
                elevation={0}
                sx={{
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid rgba(148,163,184,0.16)',
                  cursor: 'pointer',
                }}
              >
                <ListItemButton onClick={() => handleHubTicketSelect(ticket.id)} sx={{ alignItems: 'flex-start', p: 2.25 }}>
                  <ListItemText
                    primary={(
                      <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
                        <Typography variant="body1" sx={{ fontWeight: 700, color: '#0f172a' }}>
                          {ticket.title}
                        </Typography>
                        <Chip
                          size="small"
                          label={ticket.status}
                          sx={{ bgcolor: colors.bg, color: colors.color, fontWeight: 700, height: 24 }}
                        />
                      </Stack>
                    )}
                    secondary={(
                      <Box>
                        <Typography
                          variant="body2"
                          color="text.secondary"
                          sx={{
                            display: '-webkit-box',
                            WebkitLineClamp: 3,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                            mb: 1,
                            lineHeight: 1.65,
                          }}
                        >
                          {ticket.description}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.35 }}>
                          Created date: {formatDateTime(ticket.created_at)}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
                          Created by: {ticket.creator_name || 'Unknown'}
                        </Typography>
                        <Stack direction="row" spacing={0.75} sx={{ mb: 1, flexWrap: 'wrap' }}>
                          <Chip size="small" label={ticket.category} sx={{ height: 22, bgcolor: 'rgba(15,23,42,0.06)' }} />
                          <Chip size="small" label={`${ticket.comment_count || 0} replies`} sx={{ height: 22, bgcolor: 'rgba(15,118,110,0.08)', color: '#0f766e' }} />
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {ticket.creator_name} • Updated {formatDateTime(ticket.updated_at)}
                        </Typography>
                      </Box>
                    )}
                  />
                </ListItemButton>
              </Card>
            </Grid>
          );
        })}
      </Grid>
    );
  };

  return (
    <Box sx={{ p: { xs: 1.25, md: 4 } }}>
      <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 3 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Help & Support
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.75 }}>
            Raise workspace issues, track progress, and keep the conversation in one ticket thread.
          </Typography>
        </Box>
        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Button
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={() => loadTickets(selectedTicketId)}
            sx={{ textTransform: 'none', borderRadius: 999 }}
          >
            Refresh
          </Button>
          <Button
            variant="outlined"
            startIcon={<ForumIcon />}
            onClick={() => {
              setHubTab('open');
              setHubOpen(true);
            }}
            sx={{
              textTransform: 'none',
              borderRadius: 999,
              borderColor: 'rgba(15,118,110,0.35)',
              color: '#0f766e',
              '&:hover': { borderColor: '#0f766e', backgroundColor: 'rgba(15,118,110,0.05)' },
            }}
          >
            Ticket Views
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => openCreateDialog()}
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#be185d', '&:hover': { bgcolor: '#9d174d' } }}
          >
            New Ticket
          </Button>
        </Stack>
      </Stack>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.25} sx={{ mb: 3, flexWrap: 'wrap' }} useFlexGap>
        <Chip label={`${counts.total} Total`} sx={{ bgcolor: 'rgba(15,118,110,0.10)', color: '#0f766e', fontWeight: 700 }} />
        <Chip label={`${counts.open} Open`} sx={{ bgcolor: statusColors.Open.bg, color: statusColors.Open.color, fontWeight: 700 }} />
        <Chip label={`${counts.progress} In Progress`} sx={{ bgcolor: statusColors['In Progress'].bg, color: statusColors['In Progress'].color, fontWeight: 700 }} />
        <Chip label={`${counts.closed} Closed / Resolved`} sx={{ bgcolor: statusColors.Resolved.bg, color: statusColors.Resolved.color, fontWeight: 700 }} />
        <Chip
          label={canManage ? 'Viewing all workspace tickets' : 'Viewing your tickets'}
          icon={<SupportAgentIcon />}
          sx={{ ml: { md: 'auto' }, bgcolor: 'rgba(190,24,93,0.10)', color: '#be185d', fontWeight: 700 }}
        />
      </Stack>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper elevation={0} sx={{ p: 2.5, borderRadius: 3, border: '1px solid rgba(148,163,184,0.18)', height: '100%' }}>
            <Stack spacing={1.5} sx={{ mb: 2 }}>
              <TextField
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search tickets"
                size="small"
                fullWidth
              />
              <Stack direction="row" spacing={1}>
                <Select
                  value={statusFilter}
                  size="small"
                  fullWidth
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <MenuItem value="All">All statuses</MenuItem>
                  {statuses.map((status) => (
                    <MenuItem key={status} value={status}>
                      {status}
                    </MenuItem>
                  ))}
                </Select>
                <Select
                  value={categoryFilter}
                  size="small"
                  fullWidth
                  onChange={(event) => setCategoryFilter(event.target.value)}
                >
                  <MenuItem value="All">All categories</MenuItem>
                  {mainPageCategories.map((category) => (
                    <MenuItem key={category} value={category}>
                      {category}
                    </MenuItem>
                  ))}
                </Select>
              </Stack>
            </Stack>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
                <CircularProgress />
              </Box>
            ) : filteredTickets.length === 0 ? (
              <Box sx={{ py: 8, textAlign: 'center' }}>
                <ForumIcon sx={{ fontSize: 42, color: '#94a3b8', mb: 1 }} />
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  No tickets found
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Try a different filter or raise a new support request.
                </Typography>
              </Box>
            ) : (
              <List disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {filteredTickets.map((ticket) => {
                  const colors = statusColors[ticket.status] || statusColors.Open;
                  return (
                    <Card
                      key={ticket.id}
                      elevation={0}
                      sx={{
                        borderRadius: 2.5,
                        border: selectedTicketId === ticket.id ? '1px solid rgba(190,24,93,0.28)' : '1px solid rgba(148,163,184,0.16)',
                        backgroundColor: selectedTicketId === ticket.id ? 'rgba(252,231,243,0.45)' : '#fff',
                      }}
                    >
                      <ListItemButton onClick={() => handleSelectTicket(ticket.id)} sx={{ alignItems: 'flex-start', px: 2, py: 1.75 }}>
                        <ListItemText
                          primary={(
                            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700, color: '#0f172a' }}>
                                {ticket.title}
                              </Typography>
                              <Chip
                                size="small"
                                label={ticket.status}
                                sx={{ bgcolor: colors.bg, color: colors.color, fontWeight: 700, height: 24 }}
                              />
                            </Stack>
                          )}
                          secondary={(
                            <Box>
                              <Stack direction="row" spacing={0.75} sx={{ mb: 0.8, flexWrap: 'wrap' }}>
                                <Chip size="small" label={ticket.category} sx={{ height: 22, bgcolor: 'rgba(15,23,42,0.06)' }} />
                                <Chip size="small" label={`${ticket.comment_count || 0} replies`} sx={{ height: 22, bgcolor: 'rgba(15,118,110,0.08)', color: '#0f766e' }} />
                              </Stack>
                              <Typography
                                variant="body2"
                                color="text.secondary"
                                sx={{
                                  display: '-webkit-box',
                                  WebkitLineClamp: 2,
                                  WebkitBoxOrient: 'vertical',
                                  overflow: 'hidden',
                                  mb: 0.75,
                                }}
                              >
                                {ticket.description}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {ticket.creator_name} • Updated {formatDateTime(ticket.updated_at)}
                              </Typography>
                            </Box>
                          )}
                        />
                      </ListItemButton>
                    </Card>
                  );
                })}
              </List>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper elevation={0} sx={{ p: 3, borderRadius: 3, border: '1px solid rgba(148,163,184,0.18)', minHeight: 640 }}>
            {detailLoading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', py: 12 }}>
                <CircularProgress />
              </Box>
            ) : !selectedTicket ? (
              <Box sx={{ py: 12, textAlign: 'center' }}>
                <SupportAgentIcon sx={{ fontSize: 48, color: '#94a3b8', mb: 1.5 }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Select a ticket
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Pick a ticket from the list to review updates and reply in the thread.
                </Typography>
              </Box>
            ) : (
              <Box>
                <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                  <Box>
                    <Typography variant="h5" sx={{ fontWeight: 700, mb: 1 }}>
                      {selectedTicket.title}
                    </Typography>
                    <Stack direction="row" spacing={1} flexWrap="wrap">
                      <Chip label={selectedTicket.category} size="small" />
                      <Chip
                        label={selectedTicket.status}
                        size="small"
                        sx={{
                          bgcolor: (statusColors[selectedTicket.status] || statusColors.Open).bg,
                          color: (statusColors[selectedTicket.status] || statusColors.Open).color,
                          fontWeight: 700,
                        }}
                      />
                    </Stack>
                  </Box>
                  <Stack spacing={1} sx={{ minWidth: { xs: '100%', sm: 220 } }}>
                    <Box>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                        Status
                      </Typography>
                      <Select
                        value={selectedTicket.status}
                        onChange={handleStatusChange}
                        size="small"
                        fullWidth
                        disabled={!canUpdateStatus || updatingStatus}
                      >
                        {statusChoices.map((status) => (
                          <MenuItem key={status} value={status}>
                            {status}
                          </MenuItem>
                        ))}
                      </Select>
                    </Box>
                    {canDeleteTicket && (
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<DeleteOutlineIcon />}
                        onClick={handleDeleteTicket}
                        sx={{ textTransform: 'none', borderRadius: 999, alignSelf: { xs: 'stretch', sm: 'flex-end' } }}
                      >
                        Delete Ticket
                      </Button>
                    )}
                  </Stack>
                </Stack>

                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Raised by {selectedTicket.creator_name} on {formatDateTime(selectedTicket.created_at)}
                </Typography>

                <Paper
                  elevation={0}
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    border: '1px solid rgba(148,163,184,0.16)',
                    bgcolor: '#f8fafc',
                    mb: 3,
                  }}
                >
                  <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.7 }}>
                    {selectedTicket.description}
                  </Typography>
                </Paper>

                <Typography variant="h6" sx={{ fontWeight: 700, mb: 1.5 }}>
                  Conversation
                </Typography>

                <Stack spacing={1.25} sx={{ mb: 2.5, maxHeight: 360, overflow: 'auto', pr: 0.5 }}>
                  {comments.length === 0 ? (
                    <Box
                      sx={{
                        p: 3,
                        borderRadius: 3,
                        border: '1px dashed rgba(148,163,184,0.35)',
                        bgcolor: 'rgba(248,250,252,0.8)',
                        textAlign: 'center',
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                        No replies yet
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Add the first response to move the ticket forward.
                      </Typography>
                    </Box>
                  ) : (
                    comments.map((item) => (
                      <Paper
                        key={item.id}
                        elevation={0}
                        sx={{ p: 2, borderRadius: 3, border: '1px solid rgba(148,163,184,0.16)' }}
                      >
                        <Stack direction="row" spacing={1.5} alignItems="flex-start">
                          <Avatar sx={{ bgcolor: '#0f766e', fontWeight: 700 }}>
                            {getInitials(item.user_name)}
                          </Avatar>
                          <Box sx={{ flex: 1 }}>
                            <Stack direction="row" justifyContent="space-between" spacing={1} sx={{ mb: 0.75 }}>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {item.user_name}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDateTime(item.created_at)}
                              </Typography>
                            </Stack>
                            <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', lineHeight: 1.65 }}>
                              {item.comment}
                            </Typography>
                          </Box>
                        </Stack>
                      </Paper>
                    ))
                  )}
                </Stack>

                <Divider sx={{ mb: 2 }} />

                <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                  Reply inside the ticket to keep the full support conversation in one place.
                </Typography>
                <TextField
                  fullWidth
                  multiline
                  minRows={3}
                  value={comment}
                  onChange={(event) => setComment(event.target.value)}
                  placeholder="Write your response, follow-up, or resolution details..."
                  sx={{ mb: 1.5 }}
                />
                <Stack direction="row" justifyContent="flex-end">
                  <Button
                    variant="contained"
                    onClick={handlePostComment}
                    disabled={!comment.trim() || commenting}
                    sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#0f766e', '&:hover': { bgcolor: '#115e59' } }}
                  >
                    Post Reply
                  </Button>
                </Stack>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={hubOpen} onClose={() => setHubOpen(false)} fullWidth maxWidth="lg">
        <DialogTitle>Ticket Views</DialogTitle>
        <DialogContent sx={{ pt: '8px !important' }}>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review support tickets by status. Only ticket records are shown here.
          </Typography>

          <Tabs
            value={hubTab}
            onChange={(_event, nextValue) => setHubTab(nextValue)}
            variant="fullWidth"
            sx={{ mb: 2.5 }}
          >
            {Object.entries(hubTabMeta).map(([key, meta]) => (
              <Tab
                key={key}
                value={key}
                icon={meta.icon}
                iconPosition="start"
                label={meta.label}
                sx={{ textTransform: 'none', fontWeight: 700 }}
              />
            ))}
          </Tabs>

          <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap' }} useFlexGap>
            <Chip
              label={`${openTickets.length} Open Tickets`}
              icon={<ForumIcon />}
              sx={{ bgcolor: hubTabMeta.open.bg, color: hubTabMeta.open.color, fontWeight: 700 }}
            />
            <Chip
              label={`${closedTickets.length} Closed Tickets`}
              icon={<TaskAltOutlinedIcon />}
              sx={{ bgcolor: hubTabMeta.closed.bg, color: hubTabMeta.closed.color, fontWeight: 700 }}
            />
            <Chip
              label={`${suggestionTickets.length} Suggestions`}
              icon={<LightbulbOutlinedIcon />}
              sx={{ bgcolor: hubTabMeta.suggestions.bg, color: hubTabMeta.suggestions.color, fontWeight: 700 }}
            />
            <Chip
              label={`${feedbackTickets.length} Feedback`}
              icon={<RateReviewOutlinedIcon />}
              sx={{ bgcolor: hubTabMeta.feedback.bg, color: hubTabMeta.feedback.color, fontWeight: 700 }}
            />
          </Stack>

          {hubTab === 'open' && renderHubTicketList(openTickets, 'No open tickets available')}
          {hubTab === 'closed' && renderHubTicketList(closedTickets, 'No closed tickets available')}
          {hubTab === 'suggestions' && renderHubTicketList(suggestionTickets, 'No suggestions available')}
          {hubTab === 'feedback' && renderHubTicketList(feedbackTickets, 'No feedback available')}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setHubOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
        <DialogTitle>Raise a support ticket</DialogTitle>
        <DialogContent sx={{ pt: '10px !important' }}>
          <Stack spacing={2}>
            <Select
              value={createForm.category}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, category: event.target.value }))}
              size="small"
              fullWidth
            >
              {categories.map((category) => (
                <MenuItem key={category} value={category}>
                  {category}
                </MenuItem>
              ))}
            </Select>
            <TextField
              label="Title"
              value={createForm.title}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, title: event.target.value }))}
              fullWidth
            />
            <TextField
              label={createForm.category === 'Suggestion' ? 'Describe the suggestion' : createForm.category === 'Feedback' ? 'Share the feedback' : 'Describe the issue'}
              value={createForm.description}
              onChange={(event) => setCreateForm((prev) => ({ ...prev, description: event.target.value }))}
              fullWidth
              multiline
              minRows={4}
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setCreateOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            onClick={handleCreateTicket}
            variant="contained"
            disabled={creating}
            sx={{ textTransform: 'none', borderRadius: 999, bgcolor: '#be185d', '&:hover': { bgcolor: '#9d174d' } }}
          >
            Create Ticket
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default SupportPage;
