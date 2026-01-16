import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Paper,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import { createClient, deactivateClient, getClientDetails, getClients, updateClient } from '../../apiClient';

const statusColors = {
  Active: { bg: '#d1fae5', text: '#065f46' },
  Inactive: { bg: '#e2e8f0', text: '#475569' },
};

function normalizeTagsForInput(tags) {
  if (!Array.isArray(tags)) return '';
  return tags.join(', ');
}

function parseTagsInput(value) {
  return String(value || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);
}

function ClientsPage({ workspace }) {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [menuAnchor, setMenuAnchor] = useState(null);
  const [selectedClient, setSelectedClient] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailClient, setDetailClient] = useState(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editingClient, setEditingClient] = useState(null);

  const [formValues, setFormValues] = useState({
    name: '',
    client_group: '',
    series_no: '',
    legal_name: '',
    gstin: '',
    billing_address: '',
    default_payment_terms: '',
    status: 'Active',
    notes: '',
    tags: '',
  });

  const canManage = ['Owner', 'Admin'].includes(workspace?.role);

  const fetchClients = async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const response = await getClients(workspace.id);
      setClients(response.data || []);
    } catch (err) {
      console.error('Failed to fetch clients:', err);
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchClients();
  }, [workspace?.id]);

  const filteredClients = useMemo(() => {
    const query = searchQuery.toLowerCase();
    return clients.filter((client) => {
      return (
        client.name?.toLowerCase().includes(query) ||
        client.code?.toLowerCase().includes(query) ||
        client.client_group?.toLowerCase().includes(query) ||
        client.series_no?.toLowerCase().includes(query)
      );
    });
  }, [clients, searchQuery]);

  const handleMenuOpen = (event, client) => {
    event.stopPropagation();
    setMenuAnchor(event.currentTarget);
    setSelectedClient(client);
  };

  const handleMenuClose = () => {
    setMenuAnchor(null);
    setSelectedClient(null);
  };

  const handleOpenForm = (client = null) => {
    setEditingClient(client);
    setFormValues({
      name: client?.name || '',
      client_group: client?.client_group || '',
      series_no: client?.series_no || '',
      legal_name: client?.legal_name || '',
      gstin: client?.gstin || '',
      billing_address: client?.billing_address || '',
      default_payment_terms: client?.default_payment_terms || '',
      status: client?.status || 'Active',
      notes: client?.notes || '',
      tags: normalizeTagsForInput(client?.tags || []),
    });
    setFormOpen(true);
    handleMenuClose();
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    setEditingClient(null);
  };

  const handleSubmitForm = async () => {
    try {
      const payload = {
        workspace_id: workspace.id,
        client_name: formValues.name.trim(),
        legal_name: formValues.legal_name,
        gstin: formValues.gstin,
        billing_address: formValues.billing_address,
        default_payment_terms: formValues.default_payment_terms,
        status: formValues.status || 'Active',
        client_group: formValues.client_group.trim(),
        series_no: formValues.series_no.trim(),
        notes: formValues.notes,
        tags: parseTagsInput(formValues.tags),
      };

      const attemptSave = async (allowDuplicate = false) => {
        const data = allowDuplicate ? { ...payload, allow_duplicate: true } : payload;
        if (editingClient) {
          await updateClient(editingClient.id, data);
        } else {
          await createClient(data);
        }
      };

      await attemptSave();
      await fetchClients();
      handleCloseForm();
    } catch (err) {
      const similar = err.response?.data?.similar_clients;
      if (err.response?.status === 409 && Array.isArray(similar) && similar.length > 0) {
        const list = similar.map((client) => `${client.name} (${client.code})`).join('\n');
        const proceed = window.confirm(
          `Similar clients found:\n${list}\n\nCreate/update anyway?`
        );
        if (proceed) {
          try {
            const payload = {
              workspace_id: workspace.id,
              client_name: formValues.name.trim(),
              legal_name: formValues.legal_name,
              gstin: formValues.gstin,
              billing_address: formValues.billing_address,
              default_payment_terms: formValues.default_payment_terms,
              status: formValues.status || 'Active',
              client_group: formValues.client_group.trim(),
              series_no: formValues.series_no.trim(),
              notes: formValues.notes,
              tags: parseTagsInput(formValues.tags),
              allow_duplicate: true,
            };
            if (editingClient) {
              await updateClient(editingClient.id, payload);
            } else {
              await createClient(payload);
            }
            await fetchClients();
            handleCloseForm();
            return;
          } catch (retryErr) {
            console.error('Failed to save client after confirmation:', retryErr);
            alert(retryErr.response?.data?.error || 'Failed to save client');
            return;
          }
        }
      }

      console.error('Failed to save client:', err);
      alert(err.response?.data?.error || 'Failed to save client');
    }
  };

  const handleOpenDetail = async (client) => {
    if (!client) return;
    setDetailOpen(true);
    setDetailLoading(true);
    setDetailClient(null);

    try {
      const response = await getClientDetails(client.id);
      setDetailClient(response.data);
    } catch (err) {
      console.error('Failed to fetch client details:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeactivate = async () => {
    if (!selectedClient) return;
    try {
      await deactivateClient(selectedClient.id);
      await fetchClients();
      handleMenuClose();
    } catch (err) {
      console.error('Failed to deactivate client:', err);
      alert(err.response?.data?.error || 'Failed to deactivate client');
    }
  };

  return (
    <Box sx={{ p: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Clients
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage client master data across projects
          </Typography>
        </Box>
        {canManage && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => handleOpenForm()}
            sx={{ px: 3, py: 1.5, borderRadius: 2, textTransform: 'none', fontWeight: 600 }}
          >
            Add Client
          </Button>
        )}
      </Box>

      <TextField
        fullWidth
        placeholder="Search clients..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon sx={{ color: 'text.secondary' }} />
            </InputAdornment>
          ),
        }}
        sx={{
          mb: 3,
          maxWidth: 420,
          '& .MuiOutlinedInput-root': {
            borderRadius: 2,
            backgroundColor: '#fff',
          },
        }}
      />

      <Paper elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 3 }}>
        <Box sx={{ p: 3, borderBottom: '1px solid rgba(148, 163, 184, 0.2)' }}>
          <Typography variant="h6">Client List ({filteredClients.length})</Typography>
        </Box>

        {loading ? (
          <Box sx={{ py: 8, display: 'flex', justifyContent: 'center' }}>
            <CircularProgress />
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Code</TableCell>
                  <TableCell>Group</TableCell>
                  <TableCell>Series No.</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell align="right">#Projects</TableCell>
                  <TableCell align="right"></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow
                    key={client.id}
                    hover
                    onClick={() => handleOpenDetail(client)}
                    sx={{ cursor: 'pointer' }}
                  >
                    <TableCell sx={{ fontWeight: 600 }}>{client.name}</TableCell>
                    <TableCell>{client.code}</TableCell>
                    <TableCell>{client.client_group || '-'}</TableCell>
                    <TableCell>{client.series_no || '-'}</TableCell>
                    <TableCell>
                      <Chip
                        label={client.status}
                        size="small"
                        sx={{
                          backgroundColor: statusColors[client.status]?.bg,
                          color: statusColors[client.status]?.text,
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell align="right">{client.project_count || 0}</TableCell>
                    <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                      <IconButton size="small" onClick={(e) => handleMenuOpen(e, client)}>
                        <MoreVertIcon fontSize="small" />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7}>
                      <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
                        No clients found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Paper>

      <Menu
        anchorEl={menuAnchor}
        open={Boolean(menuAnchor)}
        onClose={handleMenuClose}
        PaperProps={{ sx: { borderRadius: 2, minWidth: 180 } }}
      >
        <MenuItem
          onClick={() => {
            handleMenuClose();
            handleOpenDetail(selectedClient);
          }}
        >
          View Details
        </MenuItem>
        {canManage && (
          <MenuItem onClick={() => handleOpenForm(selectedClient)}>Edit Client</MenuItem>
        )}
        {canManage && selectedClient?.status !== 'Inactive' && (
          <MenuItem onClick={handleDeactivate} sx={{ color: 'error.main' }}>
            Mark Inactive
          </MenuItem>
        )}
      </Menu>

      <Dialog open={formOpen} onClose={handleCloseForm} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>
          {editingClient ? 'Edit Client' : 'Add New Client'}
        </DialogTitle>
        <DialogContent sx={{ pt: 2 }}>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                Client Basics
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Client Name"
                    value={formValues.name}
                    onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                    fullWidth
                    required
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Status</InputLabel>
                    <Select
                      label="Status"
                      value={formValues.status}
                      onChange={(e) => setFormValues({ ...formValues, status: e.target.value })}
                    >
                      <MenuItem value="Active">Active</MenuItem>
                      <MenuItem value="Inactive">Inactive</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Group"
                    value={formValues.client_group}
                    onChange={(e) => setFormValues({ ...formValues, client_group: e.target.value })}
                    fullWidth
                    placeholder="Enterprise"
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Series No."
                    value={formValues.series_no}
                    onChange={(e) => setFormValues({ ...formValues, series_no: e.target.value })}
                    fullWidth
                    placeholder="SER-001"
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                Billing & Tax
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Legal Name"
                    value={formValues.legal_name}
                    onChange={(e) => setFormValues({ ...formValues, legal_name: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="GSTIN"
                    value={formValues.gstin}
                    onChange={(e) => setFormValues({ ...formValues, gstin: e.target.value })}
                    fullWidth
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <FormControl fullWidth>
                    <InputLabel>Default Payment Terms</InputLabel>
                    <Select
                      label="Default Payment Terms"
                      value={formValues.default_payment_terms}
                      onChange={(e) => setFormValues({ ...formValues, default_payment_terms: e.target.value })}
                    >
                      <MenuItem value="">
                        <em>None</em>
                      </MenuItem>
                      <MenuItem value="Net 7">Net 7</MenuItem>
                      <MenuItem value="Net 15">Net 15</MenuItem>
                      <MenuItem value="Net 30">Net 30</MenuItem>
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    label="Billing Address"
                    value={formValues.billing_address}
                    onChange={(e) => setFormValues({ ...formValues, billing_address: e.target.value })}
                    fullWidth
                    multiline
                    rows={2}
                  />
                </Grid>
              </Grid>
            </Box>

            <Divider />

            <Box>
              <Typography variant="subtitle2" sx={{ fontWeight: 700, color: 'text.secondary', mb: 1 }}>
                Notes & Tags
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    label="Tags"
                    value={formValues.tags}
                    onChange={(e) => setFormValues({ ...formValues, tags: e.target.value })}
                    fullWidth
                    placeholder="Retail, Marketplace"
                  />
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    label="Notes"
                    value={formValues.notes}
                    onChange={(e) => setFormValues({ ...formValues, notes: e.target.value })}
                    fullWidth
                    multiline
                    rows={3}
                  />
                </Grid>
              </Grid>
            </Box>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={handleCloseForm} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSubmitForm}
            disabled={!formValues.name.trim()}
            sx={{ textTransform: 'none', px: 3 }}
          >
            {editingClient ? 'Save Changes' : 'Create Client'}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog open={detailOpen} onClose={() => setDetailOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 600 }}>Client Details</DialogTitle>
        <DialogContent>
          {detailLoading ? (
            <Box sx={{ py: 6, display: 'flex', justifyContent: 'center' }}>
              <CircularProgress />
            </Box>
          ) : detailClient ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              <Box>
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  {detailClient.name} ({detailClient.code})
                </Typography>
                <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
                  <Chip
                    label={detailClient.status}
                    size="small"
                    sx={{
                      backgroundColor: statusColors[detailClient.status]?.bg,
                      color: statusColors[detailClient.status]?.text,
                      fontWeight: 500,
                    }}
                  />
                </Box>
              </Box>

              <Divider />

              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Group
                  </Typography>
                  <Typography variant="body2">{detailClient.client_group || '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Series No.
                  </Typography>
                  <Typography variant="body2">{detailClient.series_no || '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Legal Name
                  </Typography>
                  <Typography variant="body2">{detailClient.legal_name || '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    GSTIN
                  </Typography>
                  <Typography variant="body2">{detailClient.gstin || '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Default Payment Terms
                  </Typography>
                  <Typography variant="body2">{detailClient.default_payment_terms || '-'}</Typography>
                </Grid>
                <Grid item xs={12} md={6}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Billing Address
                  </Typography>
                  <Typography variant="body2">{detailClient.billing_address || '-'}</Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Tags
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
                    {(detailClient.tags || []).length > 0 ? (
                      detailClient.tags.map((tag) => <Chip key={tag} label={tag} size="small" />)
                    ) : (
                      <Typography variant="body2">-</Typography>
                    )}
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Typography variant="subtitle2" color="text.secondary">
                    Notes
                  </Typography>
                  <Typography variant="body2">{detailClient.notes || '-'}</Typography>
                </Grid>
              </Grid>

              <Divider />

              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                  Linked Projects
                </Typography>
                {(detailClient.projects || []).length > 0 ? (
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    {detailClient.projects.map((project) => (
                      <Paper
                        key={project.id}
                        variant="outlined"
                        sx={{
                          p: 1.5,
                          borderRadius: 2,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {project.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {project.role}
                          </Typography>
                        </Box>
                        {project.is_primary && (
                          <Chip label="Primary" size="small" color="primary" sx={{ fontWeight: 600 }} />
                        )}
                      </Paper>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="body2" color="text.secondary">
                    No linked projects
                  </Typography>
                )}
              </Box>
            </Box>
          ) : (
            <Typography color="text.secondary">No details available</Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3 }}>
          <Button onClick={() => setDetailOpen(false)} sx={{ textTransform: 'none' }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ClientsPage;
