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
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import BlockIcon from '@mui/icons-material/Block';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreHorizIcon from '@mui/icons-material/MoreHoriz';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import {
  getChecklistGrid,
  confirmChecklistOccurrence,
  adminUpdateChecklistConfirmation,
  lateConfirmChecklistOccurrence,
  getChecklistCategories,
  updateChecklistOccurrenceCustomFields,
} from '../../apiClient';
import { formatDateTimeIST } from '../../utils/dateUtils';
import {
  buildInitialCustomFieldDraft,
  formatCustomFieldValue,
  getCustomFieldResolvedValue,
  isCustomFieldValueEmpty,
} from './customFieldUtils';

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

const WEEKDAY_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function getOccurrenceScheduleLabel(occurrence) {
  if (!occurrence) return '-';

  if (occurrence.frequency === 'daily') {
    return 'Only on that day';
  }

  if (occurrence.frequency === 'weekly') {
    if (occurrence.weekly_schedule_type === 'specific_day') {
      const dayLabel = WEEKDAY_LABELS[Number(occurrence.weekly_day_of_week)] || 'Selected day';
      return `Particular day: ${dayLabel}`;
    }
    return 'Any day in week';
  }

  if (occurrence.frequency === 'monthly') {
    if (occurrence.monthly_schedule_type === 'month_end') {
      return 'Month-end only';
    }
    if (occurrence.monthly_schedule_type === 'specific_day') {
      return `Particular day: ${occurrence.monthly_day_of_month || 1}`;
    }
    return 'Any day in month';
  }

  return '-';
}

function parseIsoDateLocal(dateStr) {
  if (!dateStr) return null;
  const [year, month, day] = String(dateStr).split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
}

function ChecklistGrid({ workspaceId, clientId, year, month, isAdmin, userId, refreshToken = 0 }) {
  const gridRootRef = React.useRef(null);
  const [occurrences, setOccurrences] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  
  // Filters
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [itemFilter, setItemFilter] = useState('');
  const [sortBy, setSortBy] = useState('item_asc');
  const [showFilters, setShowFilters] = useState(false);

  // Confirmation dialog
  const [selectedOccurrence, setSelectedOccurrence] = useState(null);
  const [confirmRemarks, setConfirmRemarks] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [updatingConfirmation, setUpdatingConfirmation] = useState(false);
  const [lateConfirmUserId, setLateConfirmUserId] = useState('');
  const [lateConfirmReason, setLateConfirmReason] = useState('');
  const [adminEditUserId, setAdminEditUserId] = useState('');
  const [adminEditRemarks, setAdminEditRemarks] = useState('');
  const [customFieldDraft, setCustomFieldDraft] = useState({});
  const [updatingCustomFields, setUpdatingCustomFields] = useState(false);

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
  }, [fetchData, refreshToken]);

  const categoryNameById = React.useMemo(() => {
    const lookup = new Map();
    categories.forEach((cat) => {
      lookup.set(String(cat.id), cat.name);
    });
    return lookup;
  }, [categories]);

  const resolveCategoryName = useCallback((rawCategory) => {
    if (rawCategory === null || rawCategory === undefined || rawCategory === '') {
      return '';
    }
    return categoryNameById.get(String(rawCategory)) || String(rawCategory);
  }, [categoryNameById]);

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
          categoryName: resolveCategoryName(occ.category),
          frequency: occ.frequency,
          weeklyScheduleType: occ.weekly_schedule_type || 'any_day',
          weeklyDayOfWeek: occ.weekly_day_of_week,
          monthlyScheduleType: occ.monthly_schedule_type || 'any_day',
          monthlyDayOfMonth: occ.monthly_day_of_month,
          completionRule: occ.completion_rule,
          remarksRequired: occ.remarks_required,
          assignees: occ.assignees || [],
          days: {},
        };
      }
      
      const occDate = parseIsoDateLocal(occ.occurrence_date);
      const periodEndDate = parseIsoDateLocal(occ.period_end_date);
      const isAnyDayWeekly = occ.frequency === 'weekly' && occ.weekly_schedule_type === 'any_day';
      const isAnyDayMonthly = occ.frequency === 'monthly' && occ.monthly_schedule_type === 'any_day';

      if (occDate && periodEndDate && (isAnyDayWeekly || isAnyDayMonthly)) {
        for (let d = new Date(occDate); d <= periodEndDate; d.setDate(d.getDate() + 1)) {
          if (d.getFullYear() !== year || d.getMonth() + 1 !== month) {
            continue;
          }
          groups[key].days[d.getDate()] = occ;
        }
      } else if (occDate) {
        groups[key].days[occDate.getDate()] = occ;
      }
    });

    return Object.values(groups);
  }, [occurrences, resolveCategoryName, year, month]);

  const displayedItems = React.useMemo(() => {
    const normalizedItemFilter = itemFilter.trim().toLowerCase();
    const normalizedCategoryFilter = categoryFilter ? String(categoryFilter) : '';
    const normalizedFrequencyFilter = frequencyFilter || '';

    const filtered = groupedItems.filter((item) => {
      if (normalizedItemFilter && !item.title?.toLowerCase().includes(normalizedItemFilter)) {
        return false;
      }

      if (normalizedCategoryFilter && String(item.category ?? '') !== normalizedCategoryFilter) {
        return false;
      }

      if (normalizedFrequencyFilter && item.frequency !== normalizedFrequencyFilter) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTitle = a.title || '';
      const bTitle = b.title || '';
      const aCategory = a.categoryName || '';
      const bCategory = b.categoryName || '';
      const aFrequency = a.frequency || '';
      const bFrequency = b.frequency || '';

      switch (sortBy) {
        case 'item_desc':
          return bTitle.localeCompare(aTitle);
        case 'category_asc':
          return aCategory.localeCompare(bCategory) || aTitle.localeCompare(bTitle);
        case 'category_desc':
          return bCategory.localeCompare(aCategory) || aTitle.localeCompare(bTitle);
        case 'frequency_asc':
          return aFrequency.localeCompare(bFrequency) || aTitle.localeCompare(bTitle);
        case 'frequency_desc':
          return bFrequency.localeCompare(aFrequency) || aTitle.localeCompare(bTitle);
        case 'item_asc':
        default:
          return aTitle.localeCompare(bTitle);
      }
    });

    return sorted;
  }, [groupedItems, itemFilter, categoryFilter, frequencyFilter, sortBy]);

  const hasUserConfirmed = (occurrence) => {
    return occurrence?.confirmations?.some(c => c.user_id === userId);
  };

  const hasActiveFilters = Boolean(
    itemFilter ||
    frequencyFilter ||
    categoryFilter ||
    statusFilter ||
    sortBy !== 'item_asc'
  );

  // Check if user can confirm an occurrence
  const canConfirm = (occurrence) => {
    if (!occurrence || occurrence.status === 'exempt' || occurrence.status === 'late_confirmed' || occurrence.status === 'missed') {
      return false;
    }

    if (hasUserConfirmed(occurrence)) {
      return false;
    }

    const myAssignment = occurrence.assignees?.find((a) => Number(a.user_id) === Number(userId));
    if (!myAssignment) return false;

    const hasActivePrimary = occurrence.assignees?.some((a) => a.assignment_role === 'primary');
    if (myAssignment.assignment_role === 'secondary' && hasActivePrimary) {
      return false;
    }

    // If item is already fully confirmed under "any" rule, still allow other assignees
    // to add their own confirmation/remarks within the open window.
    if (occurrence.status === 'confirmed') {
      if (occurrence.completion_rule !== 'any') return false;
    }

    // Check if within window (simplified - backend handles full validation)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const occDate = parseIsoDateLocal(occurrence.occurrence_date);
    const periodEnd = parseIsoDateLocal(occurrence.period_end_date);
    if (!occDate || !periodEnd) return false;
    occDate.setHours(0, 0, 0, 0);
    periodEnd.setHours(0, 0, 0, 0);

    if (occurrence.frequency === 'daily') {
      return today.getTime() === occDate.getTime();
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

    setSelectedOccurrence(occurrence);
    setConfirmRemarks('');
    setLateConfirmUserId('');
    setLateConfirmReason('');
    setAdminEditUserId('');
    setAdminEditRemarks('');
    setCustomFieldDraft(buildInitialCustomFieldDraft(occurrence.custom_fields || []));
  };

  const handleClearFilters = () => {
    setItemFilter('');
    setFrequencyFilter('');
    setCategoryFilter('');
    setStatusFilter('');
    setSortBy('item_asc');
  };

  const handleToggleFullscreen = async () => {
    const root = gridRootRef.current;
    if (!root) return;

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else if (root.requestFullscreen) {
        await root.requestFullscreen();
      }
    } catch (err) {
      console.error('Unable to toggle fullscreen mode:', err);
    }
  };

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === gridRootRef.current);
    };

    document.addEventListener('fullscreenchange', onFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  // Handle confirmation
  const handleConfirm = async () => {
    if (!selectedOccurrence) return;

    const missingFields = getMissingRequiredCustomFields(selectedOccurrence);
    if (missingFields.length > 0) {
      setError(`Required custom fields missing: ${missingFields.join(', ')}`);
      return;
    }

    try {
      setConfirming(true);
      await confirmChecklistOccurrence(
        selectedOccurrence.id,
        confirmRemarks,
        customFieldDraft
      );
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

  const handleAdminUpdateConfirmation = async () => {
    if (!selectedOccurrence || !adminEditUserId) return;

    try {
      setUpdatingConfirmation(true);
      await adminUpdateChecklistConfirmation(
        selectedOccurrence.id,
        Number(adminEditUserId),
        adminEditRemarks || null,
        customFieldDraft
      );
      setSelectedOccurrence(null);
      fetchData();
    } catch (err) {
      console.error('Error updating confirmation:', err);
      setError(err.response?.data?.error || 'Failed to update confirmation');
    } finally {
      setUpdatingConfirmation(false);
    }
  };

  useEffect(() => {
    if (!selectedOccurrence || !adminEditUserId) return;

    const selectedUserConfirmation = selectedOccurrence.confirmations?.find(
      (conf) => String(conf.user_id) === String(adminEditUserId)
    );
    setAdminEditRemarks(selectedUserConfirmation?.remarks || '');
  }, [selectedOccurrence, adminEditUserId]);

  useEffect(() => {
    if (!selectedOccurrence) {
      setCustomFieldDraft({});
    }
  }, [selectedOccurrence]);

  const getOccurrenceCustomFields = useCallback((occurrence) => (
    Array.isArray(occurrence?.custom_fields) ? occurrence.custom_fields : []
  ), []);

  const getMissingRequiredCustomFields = useCallback((occurrence) => {
    if (!occurrence) {
      return [];
    }
    return getOccurrenceCustomFields(occurrence)
      .filter((field) => field.required)
      .filter((field) => isCustomFieldValueEmpty(getCustomFieldResolvedValue(field, customFieldDraft), field.field_type))
      .map((field) => field.label);
  }, [customFieldDraft, getOccurrenceCustomFields]);

  const handleCustomFieldValueChange = useCallback((fieldId, value) => {
    setCustomFieldDraft((prev) => ({
      ...prev,
      [String(fieldId)]: value
    }));
  }, []);

  const handleAdminSaveCustomFields = async () => {
    if (!selectedOccurrence || !isAdmin) return;

    try {
      setUpdatingCustomFields(true);
      await updateChecklistOccurrenceCustomFields(selectedOccurrence.id, customFieldDraft);
      setSelectedOccurrence(null);
      await fetchData();
    } catch (err) {
      console.error('Error updating custom fields:', err);
      setError(err.response?.data?.error || 'Failed to update custom fields');
    } finally {
      setUpdatingCustomFields(false);
    }
  };

  // Render status cell
  const renderCustomFieldEditor = (field, readOnly = false) => {
    const value = getCustomFieldResolvedValue(field, customFieldDraft);
    const label = `${field.label}${field.required ? ' *' : ''}`;

    if (readOnly) {
      return (
        <TextField
          fullWidth
          size="small"
          label={label}
          value={formatCustomFieldValue(value, field.field_type)}
          InputProps={{ readOnly: true }}
        />
      );
    }

    if (field.field_type === 'text') {
      return (
        <TextField
          fullWidth
          size="small"
          label={label}
          value={value ?? ''}
          onChange={(e) => handleCustomFieldValueChange(field.id, e.target.value)}
        />
      );
    }

    if (field.field_type === 'number') {
      return (
        <TextField
          fullWidth
          size="small"
          type="number"
          label={label}
          value={value ?? ''}
          onChange={(e) => handleCustomFieldValueChange(field.id, e.target.value === '' ? null : Number(e.target.value))}
        />
      );
    }

    if (field.field_type === 'date') {
      return (
        <TextField
          fullWidth
          size="small"
          type="date"
          label={label}
          value={value ?? ''}
          InputLabelProps={{ shrink: true }}
          onChange={(e) => handleCustomFieldValueChange(field.id, e.target.value || null)}
        />
      );
    }

    if (field.field_type === 'date_range') {
      const rangeValue = value && typeof value === 'object' ? value : {};
      return (
        <Box sx={{ border: '1px solid #e2e8f0', borderRadius: 1, p: 1.5 }}>
          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
            {label}
          </Typography>
          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              type="date"
              label="Start"
              value={rangeValue.startDate || ''}
              InputLabelProps={{ shrink: true }}
              onChange={(e) =>
                (() => {
                  const nextRange = {
                    startDate: e.target.value || '',
                    endDate: rangeValue.endDate || ''
                  };
                  const normalized = nextRange.startDate || nextRange.endDate ? nextRange : null;
                  handleCustomFieldValueChange(field.id, normalized);
                })()
              }
            />
            <TextField
              fullWidth
              size="small"
              type="date"
              label="End"
              value={rangeValue.endDate || ''}
              InputLabelProps={{ shrink: true }}
              onChange={(e) =>
                (() => {
                  const nextRange = {
                    startDate: rangeValue.startDate || '',
                    endDate: e.target.value || ''
                  };
                  const normalized = nextRange.startDate || nextRange.endDate ? nextRange : null;
                  handleCustomFieldValueChange(field.id, normalized);
                })()
              }
            />
          </Box>
        </Box>
      );
    }

    if (field.field_type === 'boolean') {
      return (
        <FormControl fullWidth size="small">
          <InputLabel>{label}</InputLabel>
          <Select
            value={value === null || value === undefined ? '' : value === true ? 'yes' : 'no'}
            label={label}
            onChange={(e) => {
              const next = e.target.value;
              handleCustomFieldValueChange(field.id, next === '' ? null : next === 'yes');
            }}
          >
            <MenuItem value="">Select</MenuItem>
            <MenuItem value="yes">Yes</MenuItem>
            <MenuItem value="no">No</MenuItem>
          </Select>
        </FormControl>
      );
    }

    const options = Array.isArray(field.options) ? field.options : [];
    return (
      <FormControl fullWidth size="small">
        <InputLabel>{label}</InputLabel>
        <Select
          value={value ?? ''}
          label={label}
          onChange={(e) => handleCustomFieldValueChange(field.id, e.target.value || null)}
        >
          <MenuItem value="">Select</MenuItem>
          {options.map((option) => (
            <MenuItem key={`${field.id}-${option}`} value={option}>
              {option}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    );
  };

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
    const isAnyDayCell = (
      (occurrence.frequency === 'weekly' && occurrence.weekly_schedule_type === 'any_day') ||
      (occurrence.frequency === 'monthly' && occurrence.monthly_schedule_type === 'any_day')
    );
    const iconToRender = occurrence.status === 'pending' && isAnyDayCell
      ? <MoreHorizIcon fontSize="small" />
      : statusStyle.icon;
    const canClick = Boolean(occurrence);

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
              {occurrence.status === 'pending' && isAnyDayCell && (
                <Typography variant="caption" display="block">
                  Any day window
                </Typography>
              )}
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
            {iconToRender}
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
    <Box
      ref={gridRootRef}
      sx={isFullscreen ? { backgroundColor: '#fff', p: 2, height: '100%', overflow: 'auto' } : undefined}
    >
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
        <Button
          onClick={handleClearFilters}
          variant="text"
          size="small"
          disabled={!hasActiveFilters}
        >
          Clear Filters
        </Button>

        {showFilters && (
          <>
            <TextField
              size="small"
              label="Checklist Item"
              placeholder="Search item"
              value={itemFilter}
              onChange={(e) => setItemFilter(e.target.value)}
              sx={{ minWidth: 220 }}
            />

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
                  <MenuItem key={cat.id} value={String(cat.id)}>{cat.name}</MenuItem>
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

            <FormControl size="small" sx={{ minWidth: 180 }}>
              <InputLabel>Sort By</InputLabel>
              <Select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                label="Sort By"
              >
                <MenuItem value="item_asc">Item A-Z</MenuItem>
                <MenuItem value="item_desc">Item Z-A</MenuItem>
                <MenuItem value="category_asc">Category A-Z</MenuItem>
                <MenuItem value="category_desc">Category Z-A</MenuItem>
                <MenuItem value="frequency_asc">Frequency A-Z</MenuItem>
                <MenuItem value="frequency_desc">Frequency Z-A</MenuItem>
              </Select>
            </FormControl>
          </>
        )}

        {/* Legend */}
        <Box sx={{ display: 'flex', gap: 2, ml: 'auto' }}>
          <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}>
            <IconButton size="small" onClick={handleToggleFullscreen}>
              {isFullscreen ? <FullscreenExitIcon fontSize="small" /> : <FullscreenIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
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
      {displayedItems.length === 0 ? (
        <Alert severity="info">
          No checklist items found for this month. {isAdmin && 'Go to "Manage Items" to create checklist items.'}
        </Alert>
      ) : (
        <TableContainer sx={{ maxHeight: isFullscreen ? 'calc(100vh - 220px)' : 'calc(100vh - 400px)', overflow: 'auto' }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell 
                  sx={{ 
                    position: 'sticky', 
                    left: 0, 
                    zIndex: 3, 
                    backgroundColor: '#f8fafc',
                    minWidth: 300,
                    fontWeight: 700,
                  }}
                >
                  Checklist Item
                </TableCell>
                <TableCell sx={{ minWidth: 160, fontWeight: 700, backgroundColor: '#f8fafc' }}>
                  Category
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
              {displayedItems.map((item) => (
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
                    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        {item.title}
                      </Typography>
                      {item.assignees?.length > 0 && (
                        <AvatarGroup max={3} sx={{ '& .MuiAvatar-root': { width: 20, height: 20, fontSize: '0.6rem' } }}>
                          {item.assignees.map((a) => (
                            <Tooltip
                              key={a.user_id}
                              title={`${a.user_name} (${a.assignment_role === 'primary' ? 'Primary' : 'Secondary'})`}
                            >
                              <Avatar sx={{ bgcolor: a.assignment_role === 'primary' ? '#1d4ed8' : '#0f766e' }}>
                                {a.user_name?.charAt(0).toUpperCase()}
                              </Avatar>
                            </Tooltip>
                          ))}
                        </AvatarGroup>
                      )}
                    </Box>
                  </TableCell>
                  <TableCell>
                    {item.categoryName ? (
                      <Chip label={item.categoryName} size="small" sx={{ height: 22, fontSize: '0.7rem' }} />
                    ) : (
                      <Typography color="text.secondary">-</Typography>
                    )}
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
          {canConfirm(selectedOccurrence)
            ? 'Confirm Checklist Item'
            : selectedOccurrence?.status === 'confirmed' || selectedOccurrence?.status === 'late_confirmed'
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
                {FREQUENCY_LABELS[selectedOccurrence.frequency]} | {getOccurrenceScheduleLabel(selectedOccurrence)} |{' '}
                {selectedOccurrence.occurrence_date} to {selectedOccurrence.period_end_date}
              </Typography>

              {getOccurrenceCustomFields(selectedOccurrence).length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Custom Fields
                  </Typography>
                  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
                    {getOccurrenceCustomFields(selectedOccurrence).map((field) => {
                      const fieldHasStoredValue = !isCustomFieldValueEmpty(
                        getCustomFieldResolvedValue(field, {}),
                        field.field_type
                      );
                      const readOnlyForUser = !isAdmin && (!canConfirm(selectedOccurrence) || fieldHasStoredValue);
                      return (
                        <Box key={`grid-custom-field-${selectedOccurrence.id}-${field.id}`}>
                          {renderCustomFieldEditor(field, readOnlyForUser)}
                        </Box>
                      );
                    })}
                  </Box>

                  {getMissingRequiredCustomFields(selectedOccurrence).length > 0 && (
                    <Alert severity="warning" sx={{ mt: 1.5 }}>
                      Required fields missing: {getMissingRequiredCustomFields(selectedOccurrence).join(', ')}
                    </Alert>
                  )}
                </Box>
              )}

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

              {isAdmin && selectedOccurrence.confirmations?.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2" sx={{ mb: 1 }}>
                    Admin Edit Confirmation
                  </Typography>
                  <FormControl fullWidth sx={{ mb: 1.5 }}>
                    <InputLabel>User</InputLabel>
                    <Select
                      value={adminEditUserId}
                      onChange={(e) => setAdminEditUserId(e.target.value)}
                      label="User"
                    >
                      {selectedOccurrence.confirmations.map((conf) => (
                        <MenuItem key={conf.user_id} value={conf.user_id}>
                          {conf.user_name}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    fullWidth
                    label="Update Remarks"
                    multiline
                    rows={2}
                    value={adminEditRemarks}
                    onChange={(e) => setAdminEditRemarks(e.target.value)}
                    disabled={!adminEditUserId}
                  />
                </Box>
              )}

              {/* Confirmation form - only show if can confirm */}
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

              {selectedOccurrence.status === 'pending' && (
                <>
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
                              {a.user_name} ({a.assignment_role === 'primary' ? 'Primary' : 'Secondary'})
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
                          {a.user_name} ({a.assignment_role === 'primary' ? 'Primary' : 'Secondary'})
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
          
          {canConfirm(selectedOccurrence) && (
            <Button 
              onClick={handleConfirm} 
              variant="contained" 
              disabled={
                confirming
                || updatingConfirmation
                || updatingCustomFields
                || (selectedOccurrence.remarks_required && !confirmRemarks.trim())
                || getMissingRequiredCustomFields(selectedOccurrence).length > 0
              }
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
              disabled={confirming || updatingConfirmation || !lateConfirmUserId || !lateConfirmReason.trim()}
            >
              {confirming ? <CircularProgress size={20} /> : 'Late Confirm'}
            </Button>
          )}

          {isAdmin && getOccurrenceCustomFields(selectedOccurrence).length > 0 && (
            <Button
              onClick={handleAdminSaveCustomFields}
              variant="contained"
              color="inherit"
              disabled={
                confirming
                || updatingConfirmation
                || updatingCustomFields
                || getMissingRequiredCustomFields(selectedOccurrence).length > 0
              }
            >
              {updatingCustomFields ? <CircularProgress size={20} /> : 'Save Fields'}
            </Button>
          )}

          {isAdmin && selectedOccurrence?.confirmations?.length > 0 && (
            <Button
              onClick={handleAdminUpdateConfirmation}
              variant="contained"
              color="secondary"
              disabled={confirming || updatingConfirmation || updatingCustomFields || !adminEditUserId}
            >
              {updatingConfirmation ? <CircularProgress size={20} /> : 'Update Confirmation'}
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChecklistGrid;
