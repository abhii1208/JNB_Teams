import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  IconButton,
  Button,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Tooltip,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Collapse,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import AttachFileIcon from '@mui/icons-material/AttachFile';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import DescriptionIcon from '@mui/icons-material/Description';
import TableChartIcon from '@mui/icons-material/TableChart';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { uploadAttachments, getAttachments, downloadAttachment, deleteAttachment } from '../../apiClient';

const FILE_ICONS = {
  'image/jpeg': ImageIcon,
  'image/png': ImageIcon,
  'image/gif': ImageIcon,
  'image/webp': ImageIcon,
  'image/svg+xml': ImageIcon,
  'application/pdf': PictureAsPdfIcon,
  'application/msword': DescriptionIcon,
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': DescriptionIcon,
  'application/vnd.ms-excel': TableChartIcon,
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': TableChartIcon,
  'text/plain': DescriptionIcon,
  'text/csv': TableChartIcon,
};

const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const getFileIcon = (mimeType) => {
  const IconComponent = FILE_ICONS[mimeType] || InsertDriveFileIcon;
  return IconComponent;
};

const getFileColor = (mimeType) => {
  if (mimeType?.startsWith('image/')) return '#10b981';
  if (mimeType === 'application/pdf') return '#ef4444';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return '#3b82f6';
  if (mimeType?.includes('excel') || mimeType?.includes('spreadsheet') || mimeType === 'text/csv') return '#22c55e';
  return '#64748b';
};

function FileAttachments({
  entityType, // 'task' | 'client' | 'chat_message'
  entityId,
  workspaceId,
  canEdit = true,
  showTitle = true,
  compact = false,
  maxFiles = 5,
  onAttachmentsChange,
}) {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  // eslint-disable-next-line no-unused-vars
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState(null);
  const [expanded, setExpanded] = useState(true);
  const [deleteDialog, setDeleteDialog] = useState({ open: false, attachment: null });
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  // Fetch attachments
  const fetchAttachments = useCallback(async () => {
    if (!entityId || !entityType) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await getAttachments(entityType, entityId);
      setAttachments(response.data || []);
      if (onAttachmentsChange) {
        onAttachmentsChange(response.data || []);
      }
    } catch (err) {
      console.error('Failed to fetch attachments:', err);
      setError('Failed to load attachments');
    } finally {
      setLoading(false);
    }
  }, [entityId, entityType, onAttachmentsChange]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  // Handle file upload
  const handleUpload = async (files) => {
    if (!files || files.length === 0) return;
    if (files.length > maxFiles) {
      setError(`Maximum ${maxFiles} files can be uploaded at once`);
      return;
    }

    const formData = new FormData();
    formData.append('entity_type', entityType);
    formData.append('entity_id', entityId);
    formData.append('workspace_id', workspaceId);
    
    for (const file of files) {
      // Validate file size (10MB max)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 10MB limit`);
        return;
      }
      formData.append('files', file);
    }

    setUploading(true);
    setUploadProgress(0);
    setError(null);

    try {
      await uploadAttachments(formData);
      await fetchAttachments();
      setUploadProgress(100);
    } catch (err) {
      console.error('Upload failed:', err);
      setError(err.response?.data?.error || 'Failed to upload files');
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle file download
  const handleDownload = async (attachment) => {
    try {
      const response = await downloadAttachment(attachment.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', attachment.original_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Download failed:', err);
      setError('Failed to download file');
    }
  };

  // Handle file delete
  const handleDelete = async () => {
    if (!deleteDialog.attachment) return;
    
    try {
      await deleteAttachment(deleteDialog.attachment.id);
      await fetchAttachments();
      setDeleteDialog({ open: false, attachment: null });
    } catch (err) {
      console.error('Delete failed:', err);
      setError(err.response?.data?.error || 'Failed to delete file');
    }
  };

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (!canEdit) return;
    
    const files = Array.from(e.dataTransfer.files);
    handleUpload(files);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    handleUpload(files);
  };

  // Render compact version
  if (compact) {
    return (
      <Box>
        {/* Upload button */}
        {canEdit && entityId && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              style={{ display: 'none' }}
              accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
            />
            <Tooltip title="Attach files">
              <IconButton
                size="small"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                sx={{
                  border: '1px dashed',
                  borderColor: 'divider',
                  borderRadius: 1,
                }}
              >
                <AttachFileIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            {attachments.length > 0 && (
              <Chip
                size="small"
                label={`${attachments.length} file${attachments.length !== 1 ? 's' : ''}`}
                onClick={() => setExpanded(!expanded)}
                icon={expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              />
            )}
          </Box>
        )}

        {uploading && <LinearProgress sx={{ mb: 1 }} />}

        {/* Compact file list */}
        <Collapse in={expanded && attachments.length > 0}>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
            {attachments.map((attachment) => {
              const IconComponent = getFileIcon(attachment.mime_type);
              const color = getFileColor(attachment.mime_type);
              return (
                <Chip
                  key={attachment.id}
                  icon={<IconComponent sx={{ color: `${color} !important`, fontSize: 16 }} />}
                  label={attachment.original_name}
                  size="small"
                  onDelete={canEdit ? () => setDeleteDialog({ open: true, attachment }) : undefined}
                  onClick={() => handleDownload(attachment)}
                  sx={{
                    maxWidth: 200,
                    '& .MuiChip-label': {
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    },
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                  }}
                />
              );
            })}
          </Box>
        </Collapse>

        {error && (
          <Alert severity="error" sx={{ mt: 1 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Delete confirmation dialog */}
        <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, attachment: null })}>
          <DialogTitle>Delete Attachment</DialogTitle>
          <DialogContent>
            <Typography>
              Are you sure you want to delete "{deleteDialog.attachment?.original_name}"?
            </Typography>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDeleteDialog({ open: false, attachment: null })}>Cancel</Button>
            <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
          </DialogActions>
        </Dialog>
      </Box>
    );
  }

  // Full version
  return (
    <Paper
      variant="outlined"
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: dragActive ? 'primary.main' : 'divider',
        borderStyle: dragActive ? 'dashed' : 'solid',
        bgcolor: dragActive ? 'action.hover' : 'background.paper',
        transition: 'all 0.2s',
      }}
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
    >
      {/* Header */}
      {showTitle && (
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AttachFileIcon sx={{ color: 'text.secondary' }} />
            <Typography variant="subtitle2" fontWeight={700}>
              Attachments
            </Typography>
            {attachments.length > 0 && (
              <Chip size="small" label={attachments.length} sx={{ height: 20 }} />
            )}
          </Box>
          {attachments.length > 0 && (
            <IconButton size="small" onClick={() => setExpanded(!expanded)}>
              {expanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            </IconButton>
          )}
        </Box>
      )}

      {/* Upload area */}
      {canEdit && entityId && (
        <Box
          sx={{
            border: '2px dashed',
            borderColor: dragActive ? 'primary.main' : 'divider',
            borderRadius: 2,
            p: 2,
            textAlign: 'center',
            bgcolor: dragActive ? 'primary.lighter' : 'grey.50',
            cursor: 'pointer',
            transition: 'all 0.2s',
            '&:hover': {
              borderColor: 'primary.main',
              bgcolor: 'primary.lighter',
            },
          }}
          onClick={() => fileInputRef.current?.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={handleFileSelect}
            style={{ display: 'none' }}
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv,.zip,.rar,.7z"
          />
          {uploading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}>
              <CircularProgress size={32} />
              <Typography variant="body2" color="text.secondary">
                Uploading...
              </Typography>
            </Box>
          ) : (
            <>
              <CloudUploadIcon sx={{ fontSize: 40, color: 'text.secondary', mb: 1 }} />
              <Typography variant="body2" color="text.secondary">
                Drag & drop files here or click to browse
              </Typography>
              <Typography variant="caption" color="text.disabled">
                Max {maxFiles} files, 10MB each • Images, PDFs, Docs, Excel, CSV
              </Typography>
            </>
          )}
        </Box>
      )}

      {uploading && <LinearProgress variant="indeterminate" sx={{ mt: 1 }} />}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Attachments list */}
      <Collapse in={expanded}>
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}>
            <CircularProgress size={24} />
          </Box>
        ) : attachments.length > 0 ? (
          <List dense sx={{ mt: 1 }}>
            {attachments.map((attachment) => {
              const IconComponent = getFileIcon(attachment.mime_type);
              const color = getFileColor(attachment.mime_type);
              return (
                <ListItem
                  key={attachment.id}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: 'grey.50',
                    '&:hover': { bgcolor: 'grey.100' },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 40 }}>
                    <IconComponent sx={{ color }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={
                      <Typography
                        variant="body2"
                        fontWeight={500}
                        sx={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: 200,
                        }}
                      >
                        {attachment.original_name}
                      </Typography>
                    }
                    secondary={
                      <Typography variant="caption" color="text.secondary">
                        {formatFileSize(attachment.file_size)} • {attachment.uploaded_by_name}
                      </Typography>
                    }
                  />
                  <ListItemSecondaryAction>
                    <Tooltip title="Download">
                      <IconButton size="small" onClick={() => handleDownload(attachment)}>
                        <DownloadIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    {canEdit && (
                      <Tooltip title="Delete">
                        <IconButton
                          size="small"
                          onClick={() => setDeleteDialog({ open: true, attachment })}
                          sx={{ color: 'error.main' }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </ListItemSecondaryAction>
                </ListItem>
              );
            })}
          </List>
        ) : entityId ? (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2, textAlign: 'center' }}>
            No attachments yet
          </Typography>
        ) : null}
      </Collapse>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteDialog.open} onClose={() => setDeleteDialog({ open: false, attachment: null })}>
        <DialogTitle>Delete Attachment</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{deleteDialog.attachment?.original_name}"?
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog({ open: false, attachment: null })}>Cancel</Button>
          <Button onClick={handleDelete} color="error" variant="contained">Delete</Button>
        </DialogActions>
      </Dialog>
    </Paper>
  );
}

export default FileAttachments;
