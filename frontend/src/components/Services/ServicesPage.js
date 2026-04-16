import React, { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  MenuItem,
  Paper,
  Stack,
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
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import {
  createService,
  deleteService,
  getServices,
  updateService,
} from '../../apiClient';

const initialForm = {
  name: '',
  description: '',
  category: '',
  status: 'active',
};

function ServicesPage({ workspace }) {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(initialForm);

  const canManage = ['Owner', 'Admin', 'ProjectAdmin'].includes(workspace?.role);

  const loadServices = useCallback(async () => {
    if (!workspace?.id) {
      setServices([]);
      setError('Select a workspace to view services');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await getServices(workspace.id, { include_inactive: 'true' });
      setServices(response.data || []);
      setError('');
    } catch (err) {
      console.error('Failed to load services:', err);
      setServices([]);
      const message = err?.response?.status === 401
        ? 'Your session expired. Please sign in again.'
        : '';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    loadServices();
  }, [loadServices]);

  const handleSubmit = async () => {
    try {
      if (editing) {
        await updateService(editing.id, form);
      } else {
        await createService(workspace.id, form);
      }
      setOpen(false);
      setEditing(null);
      setForm(initialForm);
      await loadServices();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to save service');
    }
  };

  const openCreate = () => {
    setEditing(null);
    setForm(initialForm);
    setOpen(true);
  };

  const openEdit = (service) => {
    setEditing(service);
    setForm({
      name: service.name || '',
      description: service.description || '',
      category: service.category || '',
      status: service.status || 'active',
    });
    setOpen(true);
  };

  const handleDelete = async (service) => {
    if (!window.confirm(`Delete service "${service.name}"?`)) return;
    try {
      await deleteService(service.id);
      await loadServices();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to delete service');
    }
  };

  return (
    <Box sx={{ p: { xs: 1.25, sm: 3 } }}>
      <Paper sx={{ p: { xs: 2, sm: 3 }, borderRadius: 3, mb: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={2}>
          <Box>
            <Typography sx={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.12em', color: '#0f766e', mb: 0.75 }}>
              MASTER DATA
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 800 }}>Services</Typography>
            <Typography variant="body2" color="text.secondary">
              Manage reusable services and link them consistently to tasks and projects.
            </Typography>
          </Box>
          {canManage ? (
            <Button startIcon={<AddIcon />} variant="contained" onClick={openCreate}>
              New Service
            </Button>
          ) : null}
        </Stack>
      </Paper>

      {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}

      <TableContainer component={Paper} sx={{ borderRadius: 3 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Service</TableCell>
              <TableCell>Category</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Projects</TableCell>
              <TableCell>Tasks</TableCell>
              <TableCell>Created By</TableCell>
              {canManage ? <TableCell align="right">Actions</TableCell> : null}
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && services.length === 0 ? (
              <TableRow>
                <TableCell colSpan={canManage ? 7 : 6}>
                  <Typography variant="body2" color="text.secondary" sx={{ py: 3, textAlign: 'center' }}>
                    No services added yet.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : null}
            {services.map((service) => (
              <TableRow key={service.id} hover>
                <TableCell>
                  <Typography variant="body2" sx={{ fontWeight: 700 }}>{service.name}</Typography>
                  <Typography variant="caption" color="text.secondary">{service.description || 'No description'}</Typography>
                </TableCell>
                <TableCell>{service.category || '-'}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    label={service.status}
                    sx={{
                      bgcolor: service.status === 'active' ? '#dcfce7' : '#e5e7eb',
                      color: service.status === 'active' ? '#166534' : '#374151',
                      fontWeight: 700,
                    }}
                  />
                </TableCell>
                <TableCell>{service.project_count || 0}</TableCell>
                <TableCell>{service.task_count || 0}</TableCell>
                <TableCell>{service.created_by_name || '-'}</TableCell>
                {canManage ? (
                  <TableCell align="right">
                    <IconButton onClick={() => openEdit(service)}><EditIcon fontSize="small" /></IconButton>
                    <IconButton color="error" onClick={() => handleDelete(service)}><DeleteIcon fontSize="small" /></IconButton>
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Service' : 'Create Service'}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label="Service Name" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} fullWidth />
            <TextField label="Description" value={form.description} onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))} fullWidth multiline minRows={3} />
            <TextField label="Category" value={form.category} onChange={(e) => setForm((prev) => ({ ...prev, category: e.target.value }))} fullWidth />
            <TextField select label="Status" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))} fullWidth>
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </TextField>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSubmit} disabled={!form.name.trim()}>
            {editing ? 'Save' : 'Create'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ServicesPage;
