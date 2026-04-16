import React, { useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DownloadIcon from '@mui/icons-material/Download';
import { getTaskBulkTemplate, importTaskBulkUpload, previewTaskBulkUpload } from '../../apiClient';

function BulkTaskUploadDialog({ open, onClose, workspaceId, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');

  const resetState = () => {
    setFile(null);
    setPreview(null);
    setLoading(false);
    setImporting(false);
    setError('');
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const handleDownloadTemplate = async () => {
    try {
      const response = await getTaskBulkTemplate(workspaceId);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'task-bulk-upload-template.xlsx';
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (_err) {
      setError('Failed to download the bulk upload template');
    }
  };

  const handlePreview = async (selectedFile) => {
    if (!selectedFile) return;
    setError('');
    setLoading(true);
    setPreview(null);
    setFile(selectedFile);

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      const response = await previewTaskBulkUpload(workspaceId, formData);
      setPreview(response.data);
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to preview the uploaded file');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const validRows = (preview?.rows || []).filter((row) => row.is_valid);
    if (!validRows.length) return;

    setImporting(true);
    setError('');
    try {
      await importTaskBulkUpload(workspaceId, validRows);
      onImported?.(validRows.length);
      handleClose();
    } catch (err) {
      setError(err?.response?.data?.error || 'Failed to import tasks');
    } finally {
      setImporting(false);
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="lg" fullWidth>
      <DialogTitle>Bulk Task Upload</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error ? <Alert severity="error">{error}</Alert> : null}

          <Paper variant="outlined" sx={{ p: 2.5, borderRadius: 3 }}>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', sm: 'center' }}>
              <Button startIcon={<DownloadIcon />} variant="outlined" onClick={handleDownloadTemplate}>
                Download Template
              </Button>
              <Button variant="contained" component="label" startIcon={<UploadFileIcon />}>
                Select Excel File
                <input
                  hidden
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={(event) => handlePreview(event.target.files?.[0])}
                />
              </Button>
              <Typography variant="body2" color="text.secondary">
                {file ? file.name : 'Upload an Excel file to validate and preview tasks before import.'}
              </Typography>
            </Stack>
          </Paper>

          {loading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
              <CircularProgress />
            </Box>
          ) : null}

          {preview ? (
            <>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                <Alert severity="info" sx={{ flex: 1 }}>
                  Total rows: {preview.total_rows} | Valid: {preview.valid_rows} | Invalid: {preview.invalid_rows}
                </Alert>
              </Stack>

              <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 420 }}>
                <Table size="small" stickyHeader>
                  <TableHead>
                    <TableRow>
                      <TableCell>Row</TableCell>
                      <TableCell>Task</TableCell>
                      <TableCell>Project</TableCell>
                      <TableCell>Assignee</TableCell>
                      <TableCell>Service</TableCell>
                      <TableCell>Status</TableCell>
                      <TableCell>Validation</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {preview.rows.map((row) => (
                      <TableRow key={row.row_number} hover>
                        <TableCell>{row.row_number}</TableCell>
                        <TableCell>{row.normalized?.title || '-'}</TableCell>
                        <TableCell>{row.normalized?.project_name || row.raw?.Project || '-'}</TableCell>
                        <TableCell>{row.normalized?.assignee_name || row.raw?.Assignee || '-'}</TableCell>
                        <TableCell>{row.normalized?.service_name || row.raw?.Service || '-'}</TableCell>
                        <TableCell>{row.normalized?.status || '-'}</TableCell>
                        <TableCell>
                          {row.is_valid ? (
                            <Typography variant="caption" sx={{ color: '#166534', fontWeight: 700 }}>
                              Ready
                            </Typography>
                          ) : (
                            <Stack spacing={0.5}>
                              {row.errors.map((message) => (
                                <Typography key={message} variant="caption" sx={{ color: '#b91c1c', display: 'block' }}>
                                  {message}
                                </Typography>
                              ))}
                            </Stack>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            </>
          ) : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={importing || !preview?.valid_rows}
        >
          {importing ? 'Importing...' : `Import ${preview?.valid_rows || 0} Tasks`}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default BulkTaskUploadDialog;
