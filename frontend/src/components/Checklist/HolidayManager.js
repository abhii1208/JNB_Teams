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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormGroup,
  FormControlLabel,
  Checkbox,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import {
  getClientHolidays,
  addClientHoliday,
  deleteClientHolidayById,
  syncWeekendHolidayRules,
} from '../../apiClient';
import { formatShortDateIST, formatDayNameIST } from '../../utils/dateUtils';

const AUTO_WEEKEND_DESCRIPTION = '[AUTO_WEEKEND]';

const formatDateToYmd = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getAllWeekdayDates = (year, weekday) => {
  const dates = [];
  const cursor = new Date(year, 0, 1);
  while (cursor.getFullYear() === year) {
    if (cursor.getDay() === weekday) {
      dates.push(formatDateToYmd(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return dates;
};

const getNthSaturdayByMonth = (year, nth) => {
  const dates = [];
  for (let month = 0; month < 12; month += 1) {
    let saturdayCount = 0;
    const cursor = new Date(year, month, 1);
    while (cursor.getMonth() === month) {
      if (cursor.getDay() === 6) {
        saturdayCount += 1;
        if (saturdayCount === nth) {
          dates.push(formatDateToYmd(cursor));
          break;
        }
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  return dates;
};

const isAutoWeekendHoliday = (holiday) => (
  String(holiday?.description || '').startsWith(AUTO_WEEKEND_DESCRIPTION)
);

const buildWeekendDateSet = (year, rules) => {
  const dateSet = new Set();
  if (rules.sunday) {
    getAllWeekdayDates(year, 0).forEach((date) => dateSet.add(date));
  }
  if (rules.allSaturday) {
    getAllWeekdayDates(year, 6).forEach((date) => dateSet.add(date));
  } else {
    if (rules.secondSaturday) {
      getNthSaturdayByMonth(year, 2).forEach((date) => dateSet.add(date));
    }
    if (rules.fourthSaturday) {
      getNthSaturdayByMonth(year, 4).forEach((date) => dateSet.add(date));
    }
  }
  return dateSet;
};

const runInBatches = async (tasks, batchSize = 10) => {
  for (let i = 0; i < tasks.length; i += batchSize) {
    await Promise.all(tasks.slice(i, i + batchSize).map((task) => task()));
  }
};

function HolidayManager({
  open,
  onClose,
  clientId,
  clientName,
  isAdmin,
  clients = [],
  onClientChange,
  onHolidaysChanged,
}) {
  const [holidays, setHolidays] = useState([]);
  const [activeClientId, setActiveClientId] = useState(clientId || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [syncingWeekendRules, setSyncingWeekendRules] = useState(false);
  const [weekendYear, setWeekendYear] = useState(new Date().getFullYear());
  const [weekendRules, setWeekendRules] = useState({
    sunday: false,
    secondSaturday: false,
    fourthSaturday: false,
    allSaturday: false,
  });
  
  // New holiday form
  const [newHoliday, setNewHoliday] = useState({
    date: '',
    name: '',
    description: ''
  });

  useEffect(() => {
    setActiveClientId(clientId || null);
  }, [clientId]);

  const activeClient = React.useMemo(
    () => clients.find((client) => Number(client.id) === Number(activeClientId)),
    [clients, activeClientId]
  );

  const activeClientName = activeClient?.name || activeClient?.client_name || clientName || 'Client';

  const notifyHolidaysChanged = useCallback(() => {
    if (typeof onHolidaysChanged === 'function') {
      onHolidaysChanged();
    }
  }, [onHolidaysChanged]);

  const yearOptions = React.useMemo(() => {
    const baseYear = new Date().getFullYear();
    const years = new Set([baseYear - 1, baseYear, baseYear + 1, baseYear + 2, baseYear + 3]);

    holidays.forEach((holiday) => {
      const match = String(holiday?.holiday_date || '').match(/^(\d{4})-/);
      if (match) {
        years.add(Number(match[1]));
      }
    });

    return Array.from(years).sort((a, b) => a - b);
  }, [holidays]);

  // Fetch holidays
  const fetchHolidays = useCallback(async () => {
    if (!activeClientId) {
      setHolidays([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const response = await getClientHolidays(activeClientId);
      setHolidays(response.data || []);
    } catch (err) {
      console.error('Error fetching holidays:', err);
      setError('Failed to load holidays');
    } finally {
      setLoading(false);
    }
  }, [activeClientId]);

  useEffect(() => {
    if (open) {
      fetchHolidays();
    }
  }, [open, fetchHolidays]);

  useEffect(() => {
    const autoWeekendDateSet = new Set(
      holidays
        .filter(
          (holiday) =>
            isAutoWeekendHoliday(holiday) &&
            String(holiday?.holiday_date || '').startsWith(`${weekendYear}-`)
        )
        .map((holiday) => String(holiday?.holiday_date || '').slice(0, 10))
    );

    const sundayDates = getAllWeekdayDates(weekendYear, 0);
    const saturdayDates = getAllWeekdayDates(weekendYear, 6);
    const secondSaturdayDates = getNthSaturdayByMonth(weekendYear, 2);
    const fourthSaturdayDates = getNthSaturdayByMonth(weekendYear, 4);
    const hasAllSaturday = saturdayDates.length > 0 && saturdayDates.every((date) => autoWeekendDateSet.has(date));

    setWeekendRules({
      sunday: sundayDates.length > 0 && sundayDates.every((date) => autoWeekendDateSet.has(date)),
      allSaturday: hasAllSaturday,
      secondSaturday:
        !hasAllSaturday &&
        secondSaturdayDates.length > 0 &&
        secondSaturdayDates.every((date) => autoWeekendDateSet.has(date)),
      fourthSaturday:
        !hasAllSaturday &&
        fourthSaturdayDates.length > 0 &&
        fourthSaturdayDates.every((date) => autoWeekendDateSet.has(date)),
    });
  }, [holidays, weekendYear]);

  // Handle add holiday
  const handleAddHoliday = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!activeClientId) {
        setError('Please select a client');
        return;
      }

      if (!newHoliday.date) {
        setError('Date is required');
        return;
      }
      if (!newHoliday.name.trim()) {
        setError('Holiday name is required');
        return;
      }

      await addClientHoliday(activeClientId, {
        holidayDate: newHoliday.date,
        name: newHoliday.name,
        description: newHoliday.description || null
      });
      setNewHoliday({ date: '', name: '', description: '' });
      await fetchHolidays();
      notifyHolidaysChanged();
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
      await fetchHolidays();
      notifyHolidaysChanged();
    } catch (err) {
      console.error('Error deleting holiday:', err);
      setError(err.response?.data?.error || 'Failed to delete holiday');
    }
  };

  const syncWeekendRulesViaLegacyOps = useCallback(
    async (years, rules) => {
      if (!activeClientId) return;

      const uniqueYears = Array.from(
        new Set(
          (Array.isArray(years) ? years : [])
            .map((year) => Number.parseInt(year, 10))
            .filter((year) => Number.isInteger(year))
        )
      );

      for (const year of uniqueYears) {
        const targetDates = buildWeekendDateSet(year, rules);
        const holidayByDate = new Map();

        holidays.forEach((holiday) => {
          const holidayDate = String(holiday?.holiday_date || '').slice(0, 10);
          if (!holidayDate.startsWith(`${year}-`)) {
            return;
          }
          if (!holidayByDate.has(holidayDate)) {
            holidayByDate.set(holidayDate, []);
          }
          holidayByDate.get(holidayDate).push(holiday);
        });

        const addTasks = [];
        targetDates.forEach((date) => {
          const sameDateHolidays = holidayByDate.get(date) || [];
          const hasManualHoliday = sameDateHolidays.some((holiday) => !isAutoWeekendHoliday(holiday));
          const hasAutoHoliday = sameDateHolidays.some((holiday) => isAutoWeekendHoliday(holiday));

          if (!hasManualHoliday && !hasAutoHoliday) {
            addTasks.push(() =>
              addClientHoliday(activeClientId, {
                holidayDate: date,
                name: 'Weekend Exemption',
                description: `${AUTO_WEEKEND_DESCRIPTION} Auto-generated weekend exemption`,
              })
            );
          }
        });

        const removeTasks = [];
        holidayByDate.forEach((sameDateHolidays, date) => {
          if (targetDates.has(date)) {
            return;
          }
          sameDateHolidays
            .filter((holiday) => isAutoWeekendHoliday(holiday))
            .forEach((holiday) => {
              removeTasks.push(() => deleteClientHolidayById(holiday.id));
            });
        });

        await runInBatches(addTasks, 10);
        await runInBatches(removeTasks, 10);
      }

      await fetchHolidays();
      notifyHolidaysChanged();
    },
    [activeClientId, holidays, fetchHolidays, notifyHolidaysChanged]
  );

  const syncWeekendRules = useCallback(
    async (nextRules) => {
      if (!activeClientId) {
        setError('Please select a client');
        return;
      }

      try {
        setSyncingWeekendRules(true);
        setError(null);
        await syncWeekendHolidayRules(activeClientId, {
          years: [weekendYear],
          rules: nextRules
        });
        await fetchHolidays();
        notifyHolidaysChanged();
      } catch (err) {
        console.error('Error syncing weekend holidays:', err);
        if (err?.response?.status === 404) {
          try {
            await syncWeekendRulesViaLegacyOps([weekendYear], nextRules);
            return;
          } catch (fallbackErr) {
            console.error('Fallback weekend sync failed:', fallbackErr);
            setError(fallbackErr.response?.data?.error || 'Failed to apply weekend exemptions');
            return;
          }
        }
        setError(err.response?.data?.error || 'Failed to apply weekend exemptions');
      } finally {
        setSyncingWeekendRules(false);
      }
    },
    [activeClientId, weekendYear, fetchHolidays, syncWeekendRulesViaLegacyOps, notifyHolidaysChanged]
  );

  const handleWeekendRuleChange = async (ruleKey, checked) => {
    const nextRules = {
      ...weekendRules,
      [ruleKey]: checked,
    };

    if (ruleKey === 'allSaturday' && checked) {
      nextRules.secondSaturday = false;
      nextRules.fourthSaturday = false;
    }

    setWeekendRules(nextRules);
    await syncWeekendRules(nextRules);
  };

  const handleApplyThisAndNextYear = async () => {
    if (!activeClientId) {
      setError('Please select a client');
      return;
    }

    try {
      setSyncingWeekendRules(true);
      setError(null);
      await syncWeekendHolidayRules(activeClientId, {
        years: [weekendYear, weekendYear + 1],
        rules: weekendRules
      });
      await fetchHolidays();
      notifyHolidaysChanged();
    } catch (err) {
      console.error('Error applying weekend rules for next year:', err);
      if (err?.response?.status === 404) {
        try {
          await syncWeekendRulesViaLegacyOps([weekendYear, weekendYear + 1], weekendRules);
          return;
        } catch (fallbackErr) {
          console.error('Fallback multi-year weekend sync failed:', fallbackErr);
          setError(fallbackErr.response?.data?.error || 'Failed to apply weekend exemptions');
          return;
        }
      }
      setError(err.response?.data?.error || 'Failed to apply weekend exemptions');
    } finally {
      setSyncingWeekendRules(false);
    }
  };

  const handleClientSelect = (nextClientId) => {
    setActiveClientId(nextClientId);
    setNewHoliday({ date: '', name: '', description: '' });
    if (typeof onClientChange === 'function') {
      onClientChange(nextClientId);
    }
  };

  // Group holidays by year
  const groupedHolidays = React.useMemo(() => {
    const groups = {};
    holidays.forEach((holiday) => {
      const date = new Date(holiday.holiday_date);
      
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
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2, flexWrap: 'wrap' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarTodayIcon />
            <Typography variant="h6">
              Holidays for {activeClientName}
            </Typography>
          </Box>
          {clients.length > 0 && (
            <FormControl size="small" sx={{ minWidth: 240 }}>
              <InputLabel>Client</InputLabel>
              <Select
                value={activeClientId || ''}
                label="Client"
                onChange={(e) => handleClientSelect(e.target.value)}
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name || client.client_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
      </DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
            {error}
          </Alert>
        )}

        {isAdmin && (
          <Paper sx={{ p: 2, mb: 3, backgroundColor: '#f8fafc' }}>
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Weekend Auto Exemptions
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap', mb: 1 }}>
              <FormControl size="small" sx={{ width: 120 }}>
                <InputLabel>Year</InputLabel>
                <Select
                  label="Year"
                  value={weekendYear}
                  onChange={(e) => setWeekendYear(Number(e.target.value))}
                  disabled={syncingWeekendRules}
                >
                  {yearOptions.map((year) => (
                    <MenuItem key={year} value={year}>
                      {year}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>

              <Button
                variant="outlined"
                size="small"
                onClick={handleApplyThisAndNextYear}
                disabled={syncingWeekendRules}
              >
                Apply This + Next Year
              </Button>

              <Divider orientation="vertical" flexItem />

              <FormGroup row>
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={weekendRules.sunday}
                      onChange={(e) => handleWeekendRuleChange('sunday', e.target.checked)}
                      disabled={syncingWeekendRules}
                    />
                  )}
                  label="Sundays"
                />
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={weekendRules.secondSaturday}
                      onChange={(e) => handleWeekendRuleChange('secondSaturday', e.target.checked)}
                      disabled={syncingWeekendRules || weekendRules.allSaturday}
                    />
                  )}
                  label="2nd Saturdays"
                />
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={weekendRules.fourthSaturday}
                      onChange={(e) => handleWeekendRuleChange('fourthSaturday', e.target.checked)}
                      disabled={syncingWeekendRules || weekendRules.allSaturday}
                    />
                  )}
                  label="4th Saturdays"
                />
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={weekendRules.allSaturday}
                      onChange={(e) => handleWeekendRuleChange('allSaturday', e.target.checked)}
                      disabled={syncingWeekendRules}
                    />
                  )}
                  label="All Saturdays"
                />
              </FormGroup>

              {syncingWeekendRules && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <CircularProgress size={16} />
                  <Typography variant="caption" color="text.secondary">
                    Applying weekend rules...
                  </Typography>
                </Box>
              )}
            </Box>
            <Typography variant="caption" color="text.secondary">
              Ticking an option directly adds exemptions for the selected year. Unticking removes only auto-generated weekend entries.
            </Typography>
          </Paper>
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
                  disabled={saving || syncingWeekendRules}
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
                      const holidayDate = new Date(holiday.holiday_date);
                      
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
                            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                              <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                {holiday.name}
                              </Typography>
                              {isAutoWeekendHoliday(holiday) && (
                                <Chip label="Auto" size="small" color="info" variant="outlined" />
                              )}
                            </Box>
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
