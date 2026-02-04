/**
 * DailyFocusView - Today's checklist items with quick confirm
 * Shows only items that can be confirmed today by the current user
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Button,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  Collapse,
  IconButton,
  Divider,
  LinearProgress,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PendingIcon from '@mui/icons-material/Pending';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import BusinessIcon from '@mui/icons-material/Business';
import {
  getTodaysChecklistItems,
  confirmChecklistOccurrence,
} from '../../apiClient';

const FREQUENCY_COLORS = {
  daily: { bg: '#dbeafe', color: '#1d4ed8' },
  weekly: { bg: '#fef3c7', color: '#b45309' },
  monthly: { bg: '#f3e8ff', color: '#7c3aed' },
};

function DailyFocusView({ workspaceId, clientId, userId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedItem, setExpandedItem] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [confirming, setConfirming] = useState(null);

  // Fetch today's items
  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTodaysChecklistItems(workspaceId, clientId);
      setItems(response.data || []);
    } catch (err) {
      console.error('Error fetching today items:', err);
      setError('Failed to load today\'s items');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, clientId]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Handle confirmation
  const handleConfirm = async (occurrence) => {
    try {
      setConfirming(occurrence.id);
      await confirmChecklistOccurrence(occurrence.id, remarks[occurrence.id] || null);
      setRemarks((prev) => ({ ...prev, [occurrence.id]: '' }));
      fetchItems();
    } catch (err) {
      console.error('Error confirming:', err);
      setError(err.response?.data?.error || 'Failed to confirm');
    } finally {
      setConfirming(null);
    }
  };

  // Check if user already confirmed this occurrence
  const hasUserConfirmed = (occurrence) => {
    return occurrence.confirmations?.some((c) => c.user_id === userId);
  };

  // Check if occurrence is fully confirmed
  const isFullyConfirmed = (occurrence) => {
    return occurrence.status === 'confirmed';
  };

  // Calculate progress
  const totalItems = items.length;
  const confirmedItems = items.filter((item) => hasUserConfirmed(item) || isFullyConfirmed(item)).length;
  const progress = totalItems > 0 ? (confirmedItems / totalItems) * 100 : 0;

  // Group items by client
  const groupedByClient = React.useMemo(() => {
    const groups = {};
    items.forEach((item) => {
      const clientName = item.client_name || 'Unknown Client';
      if (!groups[clientName]) {
        groups[clientName] = [];
      }
      groups[clientName].push(item);
    });
    return groups;
  }, [items]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Progress Card */}
      <Card sx={{ mb: 3, backgroundColor: '#f8fafc' }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
            <Typography variant="h6" sx={{ fontWeight: 600 }}>
              Today's Progress
            </Typography>
            <Typography variant="h5" sx={{ fontWeight: 700, color: '#0f766e' }}>
              {confirmedItems} / {totalItems}
            </Typography>
          </Box>
          <LinearProgress 
            variant="determinate" 
            value={progress} 
            sx={{ 
              height: 10, 
              borderRadius: 5,
              backgroundColor: '#e2e8f0',
              '& .MuiLinearProgress-bar': {
                backgroundColor: progress === 100 ? '#16a34a' : '#0f766e',
                borderRadius: 5,
              }
            }}
          />
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            {progress === 100 
              ? '🎉 All items confirmed for today!' 
              : `${totalItems - confirmedItems} item(s) pending confirmation`}
          </Typography>
        </CardContent>
      </Card>

      {/* Items List */}
      {totalItems === 0 ? (
        <Alert severity="info">
          No checklist items require confirmation today. Great job!
        </Alert>
      ) : (
        Object.entries(groupedByClient).map(([clientName, clientItems]) => (
          <Card key={clientName} sx={{ mb: 2 }}>
            <CardContent sx={{ pb: 1 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                <BusinessIcon color="action" />
                <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                  {clientName}
                </Typography>
                <Chip 
                  label={`${clientItems.filter(i => hasUserConfirmed(i) || isFullyConfirmed(i)).length}/${clientItems.length}`}
                  size="small"
                  color={clientItems.every(i => hasUserConfirmed(i) || isFullyConfirmed(i)) ? 'success' : 'default'}
                />
              </Box>

              <List disablePadding>
                {clientItems.map((item, index) => {
                  const confirmed = hasUserConfirmed(item);
                  const fullyConfirmed = isFullyConfirmed(item);
                  const isExpanded = expandedItem === item.id;

                  return (
                    <React.Fragment key={item.id}>
                      {index > 0 && <Divider />}
                      <ListItem 
                        sx={{ 
                          py: 2,
                          backgroundColor: fullyConfirmed ? '#f0fdf4' : confirmed ? '#fefce8' : 'transparent',
                          borderRadius: 1,
                          my: 0.5,
                        }}
                      >
                        <ListItemIcon>
                          {fullyConfirmed ? (
                            <CheckCircleIcon sx={{ color: '#16a34a' }} />
                          ) : confirmed ? (
                            <CheckCircleIcon sx={{ color: '#ca8a04' }} />
                          ) : (
                            <PendingIcon sx={{ color: '#64748b' }} />
                          )}
                        </ListItemIcon>

                        <ListItemText
                          primary={
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body1" sx={{ fontWeight: 600 }}>
                                {item.title}
                              </Typography>
                              <Chip 
                                label={item.frequency}
                                size="small"
                                sx={{ 
                                  height: 20,
                                  fontSize: '0.7rem',
                                  ...FREQUENCY_COLORS[item.frequency]
                                }}
                              />
                              {item.category && (
                                <Chip 
                                  label={item.category}
                                  size="small"
                                  variant="outlined"
                                  sx={{ height: 20, fontSize: '0.7rem' }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <Box sx={{ mt: 0.5 }}>
                              {item.description && (
                                <Typography variant="body2" color="text.secondary">
                                  {item.description}
                                </Typography>
                              )}
                              {item.completion_rule === 'all' && (
                                <Typography variant="caption" color="text.secondary">
                                  All assignees must confirm • 
                                  {item.confirmations?.length || 0} of {item.assignees?.length || 0} confirmed
                                </Typography>
                              )}
                              {fullyConfirmed && item.confirmations?.length > 0 && (
                                <Typography variant="caption" color="success.main">
                                  ✓ Confirmed by {item.confirmations.map(c => c.user_name).join(', ')}
                                </Typography>
                              )}
                            </Box>
                          }
                        />

                        <ListItemSecondaryAction>
                          {!fullyConfirmed && !confirmed && (
                            <IconButton onClick={() => setExpandedItem(isExpanded ? null : item.id)}>
                              {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                            </IconButton>
                          )}
                          {confirmed && !fullyConfirmed && (
                            <Chip label="Your confirmation done" size="small" color="warning" />
                          )}
                        </ListItemSecondaryAction>
                      </ListItem>

                      {/* Expanded confirmation form */}
                      <Collapse in={isExpanded}>
                        <Box sx={{ pl: 7, pr: 2, pb: 2 }}>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder={item.remarks_required ? "Remarks (Required)" : "Remarks (Optional)"}
                            value={remarks[item.id] || ''}
                            onChange={(e) => setRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))}
                            multiline
                            rows={2}
                            sx={{ mb: 1 }}
                          />
                          <Button
                            variant="contained"
                            size="small"
                            onClick={() => handleConfirm(item)}
                            disabled={confirming === item.id || (item.remarks_required && !remarks[item.id]?.trim())}
                            startIcon={confirming === item.id ? <CircularProgress size={16} /> : <CheckCircleIcon />}
                          >
                            {confirming === item.id ? 'Confirming...' : 'Confirm'}
                          </Button>
                        </Box>
                      </Collapse>
                    </React.Fragment>
                  );
                })}
              </List>
            </CardContent>
          </Card>
        ))
      )}
    </Box>
  );
}

export default DailyFocusView;
