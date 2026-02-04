/**
 * ChecklistGrid - Monthly grid view showing status by day
 * Columns: days 1-31, Rows: checklist items
 * Status color-coded cells with confirmation dialog
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  CircularProgress,
  Alert,
  Avatar,
  AvatarGroup,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BlockIcon from '@mui/icons-material/Block';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import {
  getChecklistGrid,
  confirmChecklistOccurrence,
  lateConfirmChecklistOccurrence,
  getChecklistCategories,
} from '../../apiClient';
import { formatDateTimeIST } from '../../utils/dateUtils';

const STATUS_COLORS = {
  pending: { bg: '#f1f5f9', color: '#64748b', icon: <HelpOutlineIcon fontSize="small" /> },
  confirmed: { bg: '#dcfce7', color: '#16a34a', icon: <CheckCircleIcon fontSize="small" /> },
  late_confirmed: { bg: '#fed7aa', color: '#ea580c', icon: <AccessTimeIcon fontSize="small" /> },
  missed: { bg: '#fee2e2', color: '#dc2626', icon: <CancelIcon fontSize="small" /> },
  exempt: { bg: '#e0e7ff', color: '#4f46e5', icon: <BlockIcon fontSize="small" /> },
};

const FREQUENCY_LABELS = {
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

function ChecklistGrid({ workspaceId, clientId, year, month, isAdmin, userId }) {
  const [occurrences, setOccurrences] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Filters
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Confirmation dialog
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [confirmRemarks, setConfirmRemarks] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [lateConfirmUserId, setLateConfirmUserId] = useState('');
  const [lateConfirmReason, setLateConfirmReason] = useState('');

  // Calculate days in month
  const daysInMonth = new Date(year, month, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);

  // Get today's date for highlighting
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() + 1 === month;
  const todayDay = isCurrentMonth ? today.getDate() : null;

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [gridResponse, categoriesResponse] = await Promise.all([
        getChecklistGrid(workspaceId, clientId, year, month, {
          frequency: frequencyFilter || undefined,
          category: categoryFilter || undefined,
          status: statusFilter || undefined,
        }),
        getChecklistCategories(workspaceId),
      ]);

      setOccurrences(gridResponse.data || []);
      setCategories(categoriesResponse.data || []);
    } catch (err) {
      console.error('Error fetching checklist grid:', err);
      setError('Failed to load checklist data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, clientId, year, month, frequencyFilter, categoryFilter, statusFilter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Group occurrences by checklist item
  const groupedItems = React.useMemo(() => {
    const groups = {};
    
    occurrences.forEach((occ) => {
      const key = occ.checklist_item_id;
      if (!groups[key]) {
        groups[key] = {
          itemId: occ.checklist_item_id,
          title: occ.title,
          category: occ.category,
          frequency: occ.frequency,
          completionRule: occ.completion_rule,
          remarksRequired: occ.remarks_required,
          assignees: occ.assignees || [],
          days: {},
        };
      }
      
      // For daily items, use the day number directly
      // For weekly/monthly, we show on occurrence_date
      const occDate = new Date(occ.occurrence_date);
      const day = occDate.getDate();
      
      groups[key].days[day] = occ;
    });

    return Object.values(groups);
  }, [occurrences]);

  // Check if user can confirm an occurrence
  const canConfirm = (occurrence) => {
    if (!occurrence || occurrence.status === 'confirmed' || occurrence.status === 'exempt') {
      return false;
    }

    // Check if user is assigned
    const isAssigned = occurrence.assignees?.some(a => a.user_id === userId);
    if (!isAssigned && !isAdmin) return false;

    // Check if within window (simplified - backend handles full validation)
    const today = new Date();
    const occDate = new Date(occurrence.occurrence_date);
    const periodEnd = new Date(occurrence.period_end_date);

    if (occurrence.frequency === 'daily') {
      return today.toDateString() === occDate.toDateString();
    } else {
      return today >= occDate && today <= periodEnd;
    }
  };

  // Check if occurrence is past its window
  const isPastWindow = (occurrence) => {
    if (!occurrence) return false;
    const today = new Date();
    const periodEnd = new Date(occurrence.period_end_date);
    return today > periodEnd;
  };

  // Handle cell click
  const handleCellClick = (occurrence) => {
    if (!occurrence) return;
    
    if (occurrence.status === 'exempt') {
      // Show exemption reason
      return;
    }

    setSelectedOccurrence(occurrence);
    setConfirmRemarks('');
    setLateConfirmUserId('');
    setLateConfirmReason('');
  };

  // Handle confirmation
  const handleConfirm = async () => {
    if (!selectedOccurrence) return;

    try {
      setConfirming(true);
      await confirmChecklistOccurrence(selectedOccurrence.id, confirmRemarks);
      setSelectedOccurrence(null);
      fetchData();
    } catch (err) {
      console.error('Error confirming:', err);
      setError(err.response?.data?.error || 'Failed to confirm');
    } finally {
      setConfirming(false);
    }
  };

  // Handle late confirmation (admin only)
  const handleLateConfirm = async () => {
    if (!selectedOccurrence || !lateConfirmUserId || !lateConfirmReason) return;

    try {
      setConfirming(true);
      await lateConfirmChecklistOccurrence(
        selectedOccurrence.id,
        parseInt(lateConfirmUserId),
        lateConfirmReason
      );
      setSelectedOccurrence(null);
      fetchData();
    } catch (err) {
      console.error('Error late confirming:', err);
      setError(err.response?.data?.error || 'Failed to late confirm');
    } finally {
      setConfirming(false);
    }
  };

  // Render status cell
  const renderStatusCell = (item, day) => {
    const occurrence = item.days[day];
    
    if (!occurrence) {
      // No occurrence for this day
      return (
        <TableCell 
          key={day} 
          align="center" 
          sx={{ 
            p: 0.5, 
            minWidth: 28, 
            backgroundColor: '#fafafa',
            borderRight: day === todayDay ? '2px solid #0f766e' : '1px solid #e2e8f0',
            borderLeft: day === todayDay ? '2px solid #0f766e' : undefined,
          }}
        >
          <Box sx={{ width: 24, height: 24 }} />
        </TableCell>
      );
    }

    const statusStyle = STATUS_COLORS[occurrence.status] || STATUS_COLORS.pending;
    const canClick = canConfirm(occurrence) || (isAdmin && isPastWindow(occurrence)) || occurrence.confirmations?.length > 0;

    return (
      <TableCell 
        key={day} 
        align="center" 
        sx={{ 
          p: 0.5, 
          minWidth: 28,
          backgroundColor: statusStyle.bg,
          borderRight: day === todayDay ? '2px solid #0f766e' : '1px solid #e2e8f0',
          borderLeft: day === todayDay ? '2px solid #0f766e' : undefined,
          cursor: canClick ? 'pointer' : 'default',
          '&:hover': canClick ? { opacity: 0.8 } : {},
        }}
        onClick={() => canClick && handleCellClick(occurrence)}
      >
        <Tooltip 
          title={
            <Box>
              <Typography variant="caption" sx={{ fontWeight: 600 }}>
                {occurrence.status.replace('_', ' ').toUpperCase()}
              </Typography>
              {occurrence.exemption_reason && (
                <Typography variant="caption" display="block">
                  Reason: {occurrence.exemption_reason}
                </Typography>
              )}
              {occurrence.confirmations?.length > 0 && (
                <Typography variant="caption" display="block">
                  Confirmed by: {occurrence.confirmations.map(c => c.user_name).join(', ')}
                </Typography>
              )}
            </Box>
          }
          arrow
        >
          <Box 
            sx={{ 
              width: 24, 
              height: 24, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: statusStyle.color,
            }}
          >
            {statusStyle.icon}
          </Box>
        </Tooltip>
      </TableCell>
    );
  };

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

      {/* Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3, alignItems: 'center', flexWrap: 'wrap' }}>
        <Button
          startIcon={<FilterListIcon />}
          onClick={() => setShowFilters(!showFilters)}
          variant={showFilters ? 'contained' : 'outlined'}
          size="small"
        >
          Filters
        </Button>

        {showFilters && (
          <>
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={frequencyFilter}
                onChange={(e) => setFrequencyFilter(e.target.value)}
                label="Frequency"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Category</InputLabel>
              <Select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                label="Category"
              >
                <MenuItem value="">All</MenuItem>
                {categories.map((cat) => (
                  <MenuItem key={cat.id} value={cat.name}>{cat.name}</MenuItem>
                ))}
              </Select>
            </FormControl>

            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                label="Status"
              >
                <MenuItem value="">All</MenuItem>
                <MenuItem value="pending">Pending</MenuItem>
                <MenuItem value="confirmed">Confirmed</MenuItem>
                <MenuItem value="missed">Missed</MenuItem>
                <MenuItem value="late_confirmed">Late Confirmed</MenuItem>
                <MenuItem value="exempt">Exempt</MenuItem>
              </Select>
            </FormControl>
          </>
        )}

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
          {Object.entries(STATUS_COLORS).map(([status, style]) => (
            <Chip
              key={status}
              label={status.replace('_', ' ')}
              size="small"
              icon={style.icon}
              sx={{ 
                backgroundColor: style.bg, 
                color: style.color,
                '& .MuiChip-icon': { color: style.color }
              }}
            />
          ))}
        </Box>
      </Box>

      {/* Grid Table */}
      {groupedItems.length === 0 ? (
        <Alert severity="info">
          No checklist items found for this month. {isAdmin && 'Go to "Manage Items" to create checklist items.'}
        </Alert>
      ) : (
        <TableContainer sx={{ maxHeight: 'calc(100vh - 400px)', overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 3, 
                    backgroundColor: '#f8fafc',
                    minWidth: 250,
                    fontWeight: 700,
                  }}
                >
                  Checklist Item
                </TableCell>
                <TableCell sx={{ minWidth: 80, fontWeight: 700, backgroundColor: '#f8fafc' }}>
                  Freq
                </TableCell>
                {days.map((day) => (
                  <TableCell 
                    key={day} 
                    align="center"
                    sx={{ 
                      minWidth: 28, 
                      p: 0.5, 
                      fontWeight: day === todayDay ? 700 : 600,
                      backgroundColor: day === todayDay ? '#0f766e' : '#f8fafc',
                      color: day === todayDay ? '#fff' : 'inherit',
                    }}
                  >
                    {day}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {groupedItems.map((item) => (
                <TableRow key={item.itemId} hover>
                  <TableCell 
                    sx={{ 
                      position: 'sticky', 
                      left: 0, 
                      backgroundColor: '#fff',
                      zIndex: 1,
                      borderRight: '2px solid #e2e8f0',
                    }}
                  >
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.title}
                      </Typography>
                      {item.category && (
                        <Chip label={item.category} size="small" sx={{ mt: 0.5, height: 20, fontSize: '0.7rem' }} />
                      )}
                      {item.assignees?.length > 0 && (
                        <AvatarGroup max={3} sx={{ mt: 0.5, '& .MuiAvatar-root': { width: 20, height: 20, fontSize: '0.6rem' } }}>
                          {item.assignees.map((a) => (
                            <Tooltip key={a.user_id} title={a.user_name}>
                              <Avatar sx={{ bgcolor: '#0f766e' }}>
                                {a.user_name?.charAt(0).toUpperCase()}
                              </Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={FREQUENCY_LABELS[item.frequency]} 
                      size="small" 
                      sx={{ 
                        height: 22,
                        fontSize: '0.7rem',
                        backgroundColor: item.frequency === 'daily' ? '#dbeafe' : 
                                        item.frequency === 'weekly' ? '#fef3c7' : '#f3e8ff',
                        color: item.frequency === 'daily' ? '#1d4ed8' : 
                               item.frequency === 'weekly' ? '#b45309' : '#7c3aed',
                      }}
                    />
                  </TableCell>
                  {days.map((day) => renderStatusCell(item, day))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Confirmation Dialog */}
      <Dialog 
        open={!!selectedOccurrence} 
        onClose={() => setSelectedOccurrence(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {selectedOccurrence?.status === 'confirmed' || selectedOccurrence?.status === 'late_confirmed'
            ? 'Confirmation Details'
            : isPastWindow(selectedOccurrence) && isAdmin
            ? 'Late Confirmation (Admin)'
            : 'Confirm Checklist Item'}
        </DialogTitle>
        <DialogContent>
          {selectedOccurrence && (
            <Box sx={{ mt: 2 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {selectedOccurrence.title}
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {FREQUENCY_LABELS[selectedOccurrence.frequency]} • 
                {selectedOccurrence.occurrence_date} to {selectedOccurrence.period_end_date}
              </Typography>

              {/* Show existing confirmations */}
              {selectedOccurrence.confirmations?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>Confirmations:</Typography>
                  {selectedOccurrence.confirmations.map((conf, idx) => (
                    <Box key={idx} sx={{ mb: 1, p: 1, backgroundColor: '#f8fafc', borderRadius: 1 }}>
                      <Typography variant="body2">
                        <strong>{conf.user_name}</strong> • {formatDateTimeIST(conf.confirmed_at)}
                        {conf.is_late_confirm && <Chip label="Late" size="small" color="warning" sx={{ ml: 1 }} />}
                      </Typography>
                      {conf.remarks && (
                        <Typography variant="body2" color="text.secondary">
                          Remarks: {conf.remarks}
                        </Typography>
                      )}
                    </Box>
                  ))}
                </Box>
              )}

              {/* Confirmation form - only show if can confirm */}
              {selectedOccurrence.status === 'pending' && (
                <>
                  {canConfirm(selectedOccurrence) && (
                    <TextField
                      fullWidth
                      label={selectedOccurrence.remarks_required ? 'Remarks (Required)' : 'Remarks (Optional)'}
                      multiline
                      rows={3}
                      value={confirmRemarks}
                      onChange={(e) => setConfirmRemarks(e.target.value)}
                      sx={{ mb: 2 }}
                    />
                  )}

                  {/* Late confirm form for admin */}
                  {isAdmin && isPastWindow(selectedOccurrence) && (
                    <>
                      <Alert severity="warning" sx={{ mb: 2 }}>
                        This item's confirmation window has passed. You can perform a late confirmation.
                      </Alert>
                      
                      <FormControl fullWidth sx={{ mb: 2 }}>
                        <InputLabel>Confirm for User</InputLabel>
                        <Select
                          value={lateConfirmUserId}
                          onChange={(e) => setLateConfirmUserId(e.target.value)}
                          label="Confirm for User"
                        >
                          {selectedOccurrence.assignees?.map((a) => (
                            <MenuItem key={a.user_id} value={a.user_id}>
                              {a.user_name}
                            </MenuItem>
                          ))}
                        </Select>
                      </FormControl>

                      <TextField
                        fullWidth
                        label="Reason for Late Confirmation (Required)"
                        multiline
                        rows={2}
                        value={lateConfirmReason}
                        onChange={(e) => setLateConfirmReason(e.target.value)}
                        sx={{ mb: 2 }}
                      />
                    </>
                  )}
                </>
              )}

              {selectedOccurrence.status === 'missed' && isAdmin && (
                <>
                  <Alert severity="error" sx={{ mb: 2 }}>
                    This item was missed. You can perform a late confirmation as admin.
                  </Alert>
                  
                  <FormControl fullWidth sx={{ mb: 2 }}>
                    <InputLabel>Confirm for User</InputLabel>
                    <Select
                      value={lateConfirmUserId}
                      onChange={(e) => setLateConfirmUserId(e.target.value)}
                      label="Confirm for User"
                    >
                      {selectedOccurrence.assignees?.map((a) => (
                        <MenuItem key={a.user_id} value={a.user_id}>
                          {a.user_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>

                  <TextField
                    fullWidth
                    label="Reason for Late Confirmation (Required)"
                    multiline
                    rows={2}
                    value={lateConfirmReason}
                    onChange={(e) => setLateConfirmReason(e.target.value)}
                    sx={{ mb: 2 }}
                  />
                </>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedOccurrence(null)}>Close</Button>
          
          {selectedOccurrence?.status === 'pending' && canConfirm(selectedOccurrence) && (
            <Button 
              onClick={handleConfirm} 
              variant="contained" 
              disabled={confirming || (selectedOccurrence.remarks_required && !confirmRemarks.trim())}
            >
              {confirming ? <CircularProgress size={20} /> : 'Confirm'}
            </Button>
          )}

          {isAdmin && (selectedOccurrence?.status === 'pending' || selectedOccurrence?.status === 'missed') && 
           (isPastWindow(selectedOccurrence) || selectedOccurrence?.status === 'missed') && (
            <Button 
              onClick={handleLateConfirm} 
              variant="contained" 
              color="warning"
              disabled={confirming || !lateConfirmUserId || !lateConfirmReason.trim()}
            >
              {confirming ? <CircularProgress size={20} /> : 'Late Confirm'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChecklistGrid;
