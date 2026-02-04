/**
 * HolidayManager - Dialog for managing client-specific holidays
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  TextField,
  Box,
  Typography,
  Alert,
  CircularProgress,
  Chip,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import {
  getClientHolidays,
  addClientHoliday,
  deleteClientHolidayById,
} from '../../apiClient';
import { formatShortDateIST, formatDayNameIST } from '../../utils/dateUtils';

function HolidayManager({ open, onClose, clientId, clientName, isAdmin }) {
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // New holiday form
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    description: ''
  });

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    if (!clientId) return;
    try {
      setLoading(true);
      setError(null);
      const response = await getClientHolidays(clientId);
      console.log('Holidays response:', response.data); // Debug log
      setHolidays(response.data || []);
    } catch (err) {
      console.error('Error fetching holidays:', err);
      setError('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [clientId]);

  useEffect(() => {
    if (open) {
      fetchHolidays();
    }
  }, [open, fetchHolidays]);

  // Handle add holiday
  const handleAddHoliday = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!newHoliday.date) {
        setError('Date is required');
        return;
      }
      if (!newHoliday.name.trim()) {
        setError('Holiday name is required');
        return;
      }

      await addClientHoliday(clientId, {
        holidayDate: newHoliday.date,
        name: newHoliday.name,
        description: newHoliday.description || null
      });
      setNewHoliday({ date: '', name: '', description: '' });
      fetchHolidays();
    } catch (err) {
      console.error('Error adding holiday:', err);
      setError(err.response?.data?.error || 'Failed to add holiday');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete holiday
  const handleDeleteHoliday = async (holidayId) => {
    if (!window.confirm('Are you sure you want to delete this holiday?')) {
      return;
    }

    try {
      await deleteClientHolidayById(holidayId);
      fetchHolidays();
    } catch (err) {
      console.error('Error deleting holiday:', err);
      setError(err.response?.data?.error || 'Failed to delete holiday');
    }
  };

  // Group holidays by year
  const groupedHolidays = React.useMemo(() => {
    const groups = {};
    holidays.forEach((holiday) => {
      console.log('Grouping holiday:', holiday);
      const date = new Date(holiday.holiday_date);
      console.log('Date object:', date, 'isValid:', !isNaN(date.getTime()));
      
      if (isNaN(date.getTime())) {
        console.error('Invalid date for holiday:', holiday);
        return; // Skip invalid dates
      }
      
      const year = date.getFullYear();
      if (!groups[year]) {
        groups[year] = [];
      }
      groups[year].push(holiday);
    });
    // Sort years descending
    return Object.entries(groups).sort(([a], [b]) => b - a);
  }, [holidays]);

  // Check if holiday is past
  const isPast = (holidayDate) => {
    return new Date(holidayDate) < new Date(new Date().toDateString());
  };

  // Check if holiday is upcoming (within 30 days)
  const isUpcoming = (holidayDate) => {
    const date = new Date(holidayDate);
    const today = new Date(new Date().toDateString());
    const thirtyDaysLater = new Date(today);
    thirtyDaysLater.setDate(thirtyDaysLater.getDate() + 30);
    return date >= today && date <= thirtyDaysLater;
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarTodayIcon />
          <Typography variant="h6">
            Holidays for {clientName}
          </Typography>
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {/* Add Holiday Form */}
        {isAdmin && (
          <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8fafc' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>Add New Holiday</Typography>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-start' }}>
                <TextField
                  label="Date"
                  type="date"
                  value={newHoliday.date}
                  onChange={(e) => setNewHoliday({ ...newHoliday, date: e.target.value })}
                  InputLabelProps={{ shrink: true }}
                  size="small"
                  sx={{ width: 180 }}
                />
                <TextField
                  label="Holiday Name"
                  value={newHoliday.name}
                  onChange={(e) => setNewHoliday({ ...newHoliday, name: e.target.value })}
                  size="small"
                  sx={{ flex: 1 }}
                  placeholder="e.g., Diwali, Christmas, etc."
                />
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={handleAddHoliday}
                  disabled={saving}
                  sx={{ height: '40px' }}
                >
                  {saving ? <CircularProgress size={20} /> : 'Add'}
                </Button>
              </Box>
              <TextField
                label="Description (Optional)"
                value={newHoliday.description}
                onChange={(e) => setNewHoliday({ ...newHoliday, description: e.target.value })}
                size="small"
                placeholder="Additional details about the holiday"
                multiline
                rows={2}
              />
            </Box>
          </Paper>
        )}

        {/* Quick Add Common Holidays */}
        {isAdmin && (
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Quick Add:</Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {[
                { name: 'Republic Day', month: 0, day: 26 },
                { name: 'Holi', month: 2, day: 14 },
                { name: 'Independence Day', month: 7, day: 15 },
                { name: 'Diwali', month: 9, day: 24 },
                { name: 'Christmas', month: 11, day: 25 },
              ].map((holiday) => {
                const year = new Date().getFullYear();
                const date = new Date(year, holiday.month, holiday.day);
                const dateStr = date.toISOString().split('T')[0];
                return (
                  <Chip
                    key={holiday.name}
                    label={holiday.name}
                    variant="outlined"
                    onClick={() => setNewHoliday({ date: dateStr, name: holiday.name, description: '' })}
                    sx={{ cursor: 'pointer' }}
                  />
                );
              })}
            </Box>
          </Box>
        )}

        {/* Holidays List */}
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
            <CircularProgress />
          </Box>
        ) : groupedHolidays.length === 0 ? (
          <Alert severity="info">
            No holidays configured for this client. Add holidays to exempt checklist items on those days.
          </Alert>
        ) : (
          groupedHolidays.map(([year, yearHolidays]) => (
            <Box key={year} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                {year}
              </Typography>
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                      <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Day</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Holiday Name</TableCell>
                      <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                      {isAdmin && (
                        <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Actions</TableCell>
                      )}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {yearHolidays.map((holiday) => {
                      console.log('Processing holiday:', holiday); // Debug log
                      const holidayDate = new Date(holiday.holiday_date);
                      console.log('Parsed holiday date:', holidayDate, 'from:', holiday.holiday_date); // Debug log
                      
                      const dayName = formatDayNameIST(holiday.holiday_date);
                      const past = isPast(holiday.holiday_date);
                      const upcoming = isUpcoming(holiday.holiday_date);

                      return (
                        <TableRow 
                          key={holiday.id} 
                          sx={{ 
                            backgroundColor: upcoming ? '#fef3c7' : past ? '#f1f5f9' : 'transparent',
                            opacity: past ? 0.7 : 1,
                          }}
                        >
                          <TableCell>
                            {isNaN(holidayDate.getTime()) ? 
                              'Invalid Date' : 
                              formatShortDateIST(holiday.holiday_date)
                            }
                          </TableCell>
                          <TableCell>
                            {isNaN(holidayDate.getTime()) ? 'Invalid Date' : dayName}
                          </TableCell>
                          <TableCell>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              {holiday.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            {upcoming ? (
                              <Chip label="Upcoming" size="small" color="warning" />
                            ) : past ? (
                              <Chip label="Past" size="small" variant="outlined" />
                            ) : (
                              <Chip label="Future" size="small" color="default" />
                            )}
                          </TableCell>
                          {isAdmin && (
                            <TableCell align="center">
                              <Tooltip title="Delete">
                                <IconButton 
                                  size="small" 
                                  onClick={() => handleDeleteHoliday(holiday.id)}
                                  color="error"
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </TableContainer>
            </Box>
          ))
        )}

        {/* Info about holiday effect */}
        <Alert severity="info" sx={{ mt: 2 }}>
          <Typography variant="body2">
            <strong>How holidays affect checklist items:</strong>
          </Typography>
          <ul style={{ margin: '8px 0', paddingLeft: 20 }}>
            <li>Daily items are automatically marked as "Exempt" on holiday dates</li>
            <li>Weekly items are exempt if any day in the week is a holiday</li>
            <li>Monthly items are exempt if any day in the month is a holiday</li>
          </ul>
        </Alert>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}

export default HolidayManager;
