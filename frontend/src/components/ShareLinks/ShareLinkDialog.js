import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Checkbox,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import InsertLinkIcon from '@mui/icons-material/InsertLink';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { createShareLink } from '../../apiClient';
import { DEFAULT_SHARE_COLUMNS, SHAREABLE_FIELDS, ADMIN_ONLY_FIELDS } from './shareLinkFields';

const DEFAULT_EXPIRY_DAYS = 15;

const toInputDateTime = (date) => {
  if (!date) return '';
  const offset = date.getTimezoneOffset() * 60000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
};

const buildExpiry = (days) => toInputDateTime(new Date(Date.now() + days * 24 * 60 * 60 * 1000));

export default function ShareLinkDialog({
  open,
  onClose,
  workspaceId,
  taskIds,
  defaultColumns,
  workspaceRole,
  onCreated,
}) {
  const [selectedColumns, setSelectedColumns] = useState(DEFAULT_SHARE_COLUMNS);
  const [protection, setProtection] = useState('open');
  const [password, setPassword] = useState('');
  const [linkName, setLinkName] = useState('');
  const [expiresAt, setExpiresAt] = useState(buildExpiry(DEFAULT_EXPIRY_DAYS));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdLink, setCreatedLink] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const isAdmin = workspaceRole === 'Owner' || workspaceRole === 'Admin';

  const defaultSelection = useMemo(() => {
    const fallback = DEFAULT_SHARE_COLUMNS.filter(
      (column) => isAdmin || !ADMIN_ONLY_FIELDS.includes(column)
    );
    if (Array.isArray(defaultColumns) && defaultColumns.length > 0) {
      return defaultColumns.filter((column) => isAdmin || !ADMIN_ONLY_FIELDS.includes(column));
    }
    return fallback;
  }, [defaultColumns, isAdmin]);

  useEffect(() => {
    if (!open) return;
    setSelectedColumns(defaultSelection);
    setProtection('open');
    setPassword('');
    setLinkName('');
    setExpiresAt(buildExpiry(DEFAULT_EXPIRY_DAYS));
    setLoading(false);
    setError('');
    setCreatedLink(null);
    setShowPassword(false);
  }, [open, defaultSelection, taskIds?.length]);

  const handleToggleColumn = (columnKey) => {
    setSelectedColumns((prev) => {
      if (prev.includes(columnKey)) {
        return prev.filter((key) => key !== columnKey);
      }
      return [...prev, columnKey];
    });
  };

  const canSubmit = selectedColumns.length > 0
    && (!loading)
    && (protection === 'open' || password.trim().length >= 8);

  const handleCopy = async (value) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
    } catch (err) {
      console.error('Failed to copy share link:', err);
    }
  };

  const handleSubmit = async () => {
    if (!workspaceId || !Array.isArray(taskIds) || taskIds.length === 0) {
      setError('Select at least one task to share.');
      return;
    }

    if (protection === 'password' && password.trim().length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const payload = {
        workspaceId,
        taskIds,
        allowedColumns: selectedColumns,
        protection,
      };

      if (linkName.trim()) {
        payload.name = linkName.trim();
      }

      if (protection === 'password') {
        payload.password = password.trim();
      }

      if (expiresAt) {
        payload.expiresAt = new Date(expiresAt).toISOString();
      } else {
        payload.expiresAt = null;
      }

      const res = await createShareLink(payload);
      setCreatedLink(res.data);
      if (typeof onCreated === 'function') {
        onCreated(res.data);
      }
    } catch (err) {
      console.error('Failed to create share link:', err);
      setError('Failed to create share link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{ sx: { width: { xs: 'calc(100vw - 16px)', sm: '100%' }, m: { xs: 1, sm: 2 }, maxHeight: { xs: 'calc(100dvh - 16px)', sm: 'calc(100vh - 32px)' } } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap', pr: 6 }}>
        <InsertLinkIcon color="primary" />
        Generate Share Link
        <Chip
          label={`${taskIds?.length || 0} tasks`}
          size="small"
          sx={{ ml: 'auto' }}
        />
      </DialogTitle>
      <DialogContent sx={{ px: { xs: 2, sm: 3 } }}>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {createdLink ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <Alert severity="success">Share link created.</Alert>
            {createdLink.name && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Link name
                </Typography>
                <TextField
                  value={createdLink.name}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                />
              </Box>
            )}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Public Link
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  value={createdLink.url || ''}
                  fullWidth
                  size="small"
                  InputProps={{ readOnly: true }}
                />
                <Tooltip title="Copy link">
                  <IconButton onClick={() => handleCopy(createdLink.url)} size="small">
                    <ContentCopyIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {protection === 'password' && password && (
              <Box>
                <Typography variant="subtitle2" gutterBottom>
                  Password
                </Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', flexWrap: 'wrap' }}>
                <TextField
                  value={password}
                  fullWidth
                    size="small"
                    InputProps={{ readOnly: true }}
                  />
                  <Tooltip title="Copy password">
                    <IconButton onClick={() => handleCopy(password)} size="small">
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  <Tooltip title="Copy link + password">
                    <IconButton
                      onClick={() => handleCopy(`${createdLink.url}\nPassword: ${password}`)}
                      size="small"
                    >
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              </Box>
            )}
          </Box>
        ) : (
          <>
            <TextField
              label="Link name (optional)"
              value={linkName}
              onChange={(event) => setLinkName(event.target.value)}
              fullWidth
              size="small"
              sx={{ mb: 2 }}
              helperText="Shown in the public view and links manager"
              inputProps={{ maxLength: 120 }}
            />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Choose columns to expose
            </Typography>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', sm: 'repeat(auto-fit, minmax(200px, 1fr))' },
                gap: 1,
                mb: 2,
              }}
            >
              {SHAREABLE_FIELDS.map((field) => {
                const disabled = field.adminOnly && !isAdmin;
                return (
                  <FormControlLabel
                    key={field.key}
                    control={
                      <Checkbox
                        checked={selectedColumns.includes(field.key)}
                        onChange={() => handleToggleColumn(field.key)}
                        disabled={disabled}
                      />
                    }
                    label={(
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <span>{field.label}</span>
                        {field.adminOnly && (
                          <Chip label="Admin only" size="small" variant="outlined" />
                        )}
                      </Box>
                    )}
                  />
                );
              })}
            </Box>

            <Divider sx={{ my: 2 }} />

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Protection
            </Typography>
            <ToggleButtonGroup
              value={protection}
              exclusive
              onChange={(event, value) => value && setProtection(value)}
              size="small"
              sx={{ mb: 2, width: { xs: '100%', sm: 'auto' } }}
            >
              <ToggleButton value="open">Open</ToggleButton>
              <ToggleButton value="password">Password</ToggleButton>
            </ToggleButtonGroup>

            {protection === 'password' && (
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
                InputProps={{
                  endAdornment: (
                    <IconButton onClick={() => setShowPassword((prev) => !prev)} size="small">
                      {showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                    </IconButton>
                  ),
                }}
                helperText="Minimum 8 characters"
              />
            )}

            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              Expiry
            </Typography>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
              <TextField
                type="datetime-local"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                size="small"
                sx={{ minWidth: { xs: '100%', sm: 240 }, flex: { xs: '1 1 100%', sm: '0 0 auto' } }}
              />
              <Button size="small" onClick={() => setExpiresAt(buildExpiry(1))}>
                1 day
              </Button>
              <Button size="small" onClick={() => setExpiresAt(buildExpiry(7))}>
                7 days
              </Button>
              <Button size="small" onClick={() => setExpiresAt(buildExpiry(15))}>
                15 days
              </Button>
              <Button size="small" onClick={() => setExpiresAt(buildExpiry(30))}>
                30 days
              </Button>
              <Button size="small" color="inherit" onClick={() => setExpiresAt('')}>
                No expiry
              </Button>
            </Box>
          </>
        )}
      </DialogContent>
      <DialogActions sx={{ px: { xs: 2, sm: 3 }, py: 2, flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose} color="inherit" sx={{ width: { xs: '100%', sm: 'auto' } }}>
          {createdLink ? 'Close' : 'Cancel'}
        </Button>
        {!createdLink && (
          <Button onClick={handleSubmit} variant="contained" disabled={!canSubmit} sx={{ width: { xs: '100%', sm: 'auto' } }}>
            {loading ? 'Creating...' : 'Generate Link'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
