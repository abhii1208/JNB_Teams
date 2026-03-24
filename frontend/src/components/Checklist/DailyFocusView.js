/**
 * DailyFocusView - Today's checklist items in table format
 * Includes row confirm, remarks, select all, and bulk confirm
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Button,
  IconButton,
  Tooltip,
  Chip,
  TextField,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Checkbox,
  FormControlLabel,
  Switch,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ClearAllIcon from '@mui/icons-material/ClearAll';
import AssessmentIcon from '@mui/icons-material/Assessment';
import EditNoteIcon from '@mui/icons-material/EditNote';
import {
  getTodaysChecklistItems,
  confirmChecklistOccurrence,
  getFullUserPreferences,
  patchUserPreferences,
  getChecklistCategories,
} from '../../apiClient';
import {
  buildInitialCustomFieldDraft,
  getCustomFieldResolvedValue,
  isCustomFieldValueEmpty,
} from './customFieldUtils';

const FREQUENCY_COLORS = {
  daily: { bg: '#dbeafe', color: '#1d4ed8' },
  weekly: { bg: '#fef3c7', color: '#b45309' },
  monthly: { bg: '#f3e8ff', color: '#7c3aed' },
};

function DailyFocusView({ workspaceId, clientId, userId }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [remarks, setRemarks] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});
  const [confirming, setConfirming] = useState(null);
  const [bulkConfirming, setBulkConfirming] = useState(false);
  const [selectedRows, setSelectedRows] = useState({});
  const [showOnlyPendingAction, setShowOnlyPendingAction] = useState(false);
  const [bulkRemarksTemplate, setBulkRemarksTemplate] = useState('');
  const [includeSecondaryAssignments, setIncludeSecondaryAssignments] = useState(false);
  const [categories, setCategories] = useState([]);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportClientFilter, setReportClientFilter] = useState('');
  const [customFieldDialogItem, setCustomFieldDialogItem] = useState(null);

  const fetchItems = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await getTodaysChecklistItems(workspaceId, clientId, {
        includeSecondary: includeSecondaryAssignments
      });
      setItems(response.data || []);
    } catch (err) {
      console.error('Error fetching today items:', err);
      setError('Failed to load today\'s items');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, clientId, includeSecondaryAssignments]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  useEffect(() => {
    let ignore = false;

    const loadCategories = async () => {
      try {
        const response = await getChecklistCategories(workspaceId);
        if (!ignore) {
          setCategories(response.data || []);
        }
      } catch (err) {
        console.warn('Unable to load checklist categories:', err);
      }
    };

    loadCategories();

    return () => {
      ignore = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    let ignore = false;

    const loadPreference = async () => {
      try {
        const response = await getFullUserPreferences(workspaceId);
        const savedPreference = response?.data?.checklist_include_secondary;
        if (!ignore && typeof savedPreference === 'boolean') {
          setIncludeSecondaryAssignments(savedPreference);
        }
      } catch (err) {
        console.warn('Unable to load checklist secondary-assignee preference:', err);
      }
    };

    loadPreference();

    return () => {
      ignore = true;
    };
  }, [workspaceId]);

  useEffect(() => {
    // Keep selection only for rows still present after refresh
    setSelectedRows((prev) => {
      const next = {};
      items.forEach((item) => {
        if (prev[item.id]) next[item.id] = true;
      });
      return next;
    });
  }, [items]);

  useEffect(() => {
    setCustomFieldValues((prev) => {
      const next = {};

      items.forEach((item) => {
        const fields = Array.isArray(item.custom_fields) ? item.custom_fields : [];
        const existingDraft = prev[item.id] || {};
        const defaults = buildInitialCustomFieldDraft(fields);
        next[item.id] = { ...defaults, ...existingDraft };
      });

      return next;
    });
  }, [items]);

  const hasUserConfirmed = (occurrence) => {
    return occurrence.confirmations?.some((c) => c.user_id === userId);
  };

  const isFullyConfirmed = (occurrence) => {
    return occurrence.status === 'confirmed';
  };

  const isSecondaryBlockedByPrimary = (occurrence) => {
    if (!occurrence) return false;
    if (occurrence.waiting_for_primary === true) return true;
    if (occurrence.my_assignment_role !== 'secondary') return false;
    return Number(occurrence.active_primary_assignee_count || 0) > 0;
  };

  // "any" rule still allows unconfirmed assignees to add their confirmation within window
  const canUserConfirm = (occurrence) => {
    if (!occurrence || ['exempt', 'late_confirmed', 'missed'].includes(occurrence.status)) {
      return false;
    }
    if (hasUserConfirmed(occurrence)) {
      return false;
    }
    if (typeof occurrence.can_current_user_confirm === 'boolean' && !occurrence.can_current_user_confirm) {
      return false;
    }
    if (isSecondaryBlockedByPrimary(occurrence)) {
      return false;
    }
    if (occurrence.status === 'pending') {
      return true;
    }
    return occurrence.status === 'confirmed' && occurrence.completion_rule === 'any';
  };

  const getCannotConfirmReason = (occurrence) => {
    if (!occurrence) return 'Confirmation unavailable';
    if (hasUserConfirmed(occurrence)) return 'You already confirmed this item';
    if (['exempt', 'late_confirmed', 'missed'].includes(occurrence.status)) {
      return 'This item is not confirmable in current status';
    }
    if (isSecondaryBlockedByPrimary(occurrence)) {
      return 'Secondary assignee can confirm only when no active primary assignee is available';
    }
    if (occurrence.status === 'confirmed' && occurrence.completion_rule !== 'any') {
      return 'Already completed based on completion rule';
    }
    return 'Confirmation unavailable';
  };

  const getOccurrenceFields = (occurrence) => (
    Array.isArray(occurrence?.custom_fields) ? occurrence.custom_fields : []
  );

  const getMissingRequiredCustomFields = useCallback((occurrence) => {
    const draft = customFieldValues[occurrence.id] || {};
    return getOccurrenceFields(occurrence)
      .filter((field) => field.required)
      .filter((field) => {
        const resolved = getCustomFieldResolvedValue(field, draft);
        return isCustomFieldValueEmpty(resolved, field.field_type);
      })
      .map((field) => field.label);
  }, [customFieldValues]);

  const getCustomFieldValidationError = useCallback((occurrence) => {
    const missing = getMissingRequiredCustomFields(occurrence);
    if (missing.length === 0) {
      return '';
    }
    return `Required custom fields missing: ${missing.join(', ')}`;
  }, [getMissingRequiredCustomFields]);

  const handleCustomFieldValueChange = useCallback((occurrenceId, fieldId, value) => {
    setCustomFieldValues((prev) => ({
      ...prev,
      [occurrenceId]: {
        ...(prev[occurrenceId] || {}),
        [String(fieldId)]: value
      }
    }));
  }, []);

  const sortedItems = useMemo(
    () =>
      [...items].sort((a, b) =>
        `${a.client_name || ''}|${a.category || ''}|${a.title || ''}`.localeCompare(
          `${b.client_name || ''}|${b.category || ''}|${b.title || ''}`
        )
      ),
    [items]
  );

  const confirmableItems = sortedItems.filter(canUserConfirm);
  const displayedItems = showOnlyPendingAction
    ? sortedItems.filter(canUserConfirm)
    : sortedItems;
  const visibleConfirmableItems = displayedItems.filter(canUserConfirm);

  const selectedConfirmableItems = confirmableItems.filter((item) => selectedRows[item.id]);
  const selectedVisibleCount = visibleConfirmableItems.filter((item) => selectedRows[item.id]).length;
  const selectedCount = selectedConfirmableItems.length;
  const selectedMissingRemarksCount = selectedConfirmableItems.filter(
    (item) => item.remarks_required && !remarks[item.id]?.trim()
  ).length;
  const selectedMissingCustomFieldsCount = selectedConfirmableItems.filter(
    (item) => getMissingRequiredCustomFields(item).length > 0
  ).length;
  const allSelected = visibleConfirmableItems.length > 0 && selectedVisibleCount === visibleConfirmableItems.length;
  const partiallySelected = selectedVisibleCount > 0 && selectedVisibleCount < visibleConfirmableItems.length;

  const handleToggleSelectAll = (checked) => {
    setSelectedRows((prev) => {
      const next = { ...prev };
      if (checked) {
        visibleConfirmableItems.forEach((item) => {
          next[item.id] = true;
        });
      } else {
        visibleConfirmableItems.forEach((item) => {
          delete next[item.id];
        });
      }
      return next;
    });
  };

  const handleToggleRow = (id) => {
    setSelectedRows((prev) => {
      const next = { ...prev };
      if (next[id]) {
        delete next[id];
      } else {
        next[id] = true;
      }
      return next;
    });
  };

  const handleToggleIncludeSecondary = async (checked) => {
    setIncludeSecondaryAssignments(checked);
    try {
      await patchUserPreferences(workspaceId, { checklist_include_secondary: checked });
    } catch (err) {
      console.error('Unable to save checklist secondary-assignee preference:', err);
    }
  };

  const handleConfirm = async (occurrence) => {
    const missingFields = getMissingRequiredCustomFields(occurrence);
    if (missingFields.length > 0) {
      setError(`Required custom fields missing: ${missingFields.join(', ')}`);
      setCustomFieldDialogItem(occurrence);
      return;
    }

    try {
      setConfirming(occurrence.id);
      await confirmChecklistOccurrence(
        occurrence.id,
        remarks[occurrence.id] || null,
        customFieldValues[occurrence.id] || {}
      );

      setRemarks((prev) => ({ ...prev, [occurrence.id]: '' }));
      setSelectedRows((prev) => {
        const next = { ...prev };
        delete next[occurrence.id];
        return next;
      });

      await fetchItems();
    } catch (err) {
      console.error('Error confirming:', err);
      setError(err.response?.data?.error || 'Failed to confirm');
    } finally {
      setConfirming(null);
    }
  };

  const handleBulkConfirm = async () => {
    if (selectedCount === 0) return;

    const missingRemarks = selectedConfirmableItems.find(
      (item) => item.remarks_required && !remarks[item.id]?.trim()
    );

    if (missingRemarks) {
      setError(`Remarks are required for "${missingRemarks.title}" before bulk confirm`);
      return;
    }

    const missingCustomFieldsItem = selectedConfirmableItems.find(
      (item) => getMissingRequiredCustomFields(item).length > 0
    );
    if (missingCustomFieldsItem) {
      const missingLabels = getMissingRequiredCustomFields(missingCustomFieldsItem);
      setError(`Required custom fields missing for "${missingCustomFieldsItem.title}": ${missingLabels.join(', ')}`);
      setCustomFieldDialogItem(missingCustomFieldsItem);
      return;
    }

    try {
      setBulkConfirming(true);
      setError(null);

      const results = await Promise.allSettled(
        selectedConfirmableItems.map((item) =>
          confirmChecklistOccurrence(
            item.id,
            remarks[item.id] || null,
            customFieldValues[item.id] || {}
          )
        )
      );

      const successIds = [];
      let failedCount = 0;

      results.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          successIds.push(selectedConfirmableItems[index].id);
        } else {
          failedCount += 1;
        }
      });

      if (successIds.length > 0) {
        setRemarks((prev) => {
          const next = { ...prev };
          successIds.forEach((id) => {
            next[id] = '';
          });
          return next;
        });

        setSelectedRows((prev) => {
          const next = { ...prev };
          successIds.forEach((id) => {
            delete next[id];
          });
          return next;
        });
      }

      if (failedCount > 0) {
        setError(`Bulk confirm completed with ${failedCount} failure(s)`);
      }

      await fetchItems();
    } catch (err) {
      console.error('Error bulk confirming:', err);
      setError(err.response?.data?.error || 'Failed to bulk confirm');
    } finally {
      setBulkConfirming(false);
    }
  };

  const handleApplyBulkTemplate = () => {
    if (selectedCount === 0) return;

    setRemarks((prev) => {
      const next = { ...prev };
      selectedConfirmableItems.forEach((item) => {
        next[item.id] = bulkRemarksTemplate;
      });
      return next;
    });
  };

  const getStatusChip = (item) => {
    const confirmed = hasUserConfirmed(item);
    const fullyConfirmed = isFullyConfirmed(item);
    const canConfirmNow = canUserConfirm(item);
    const waitingForPrimary = isSecondaryBlockedByPrimary(item);

    if (confirmed) {
      return <Chip label="Confirmed" size="small" color="warning" />;
    }
    if (waitingForPrimary) {
      return <Chip label="Waiting for primary" size="small" variant="outlined" color="default" />;
    }
    if (fullyConfirmed) {
      return <Chip label="Completed by team" size="small" color="success" />;
    }
    if (canConfirmNow) {
      return <Chip label="Pending" size="small" variant="outlined" />;
    }

    return (
      <Chip
        label={item.status?.replace('_', ' ') || 'pending'}
        size="small"
        variant="outlined"
      />
    );
  };

  const categoryNameById = useMemo(() => {
    const lookup = new Map();
    categories.forEach((cat) => {
      lookup.set(String(cat.id), cat.name);
    });
    return lookup;
  }, [categories]);

  const reportRows = useMemo(() => {
    return items.map((item) => {
      const myConfirmation = item.confirmations?.find((c) => Number(c.user_id) === Number(userId));
      const isConfirmed = Boolean(myConfirmation) || item.status === 'confirmed';
      return {
        id: item.id,
        client: item.client_name || 'Unknown Client',
        item: item.title || '-',
        category: item.category_name || categoryNameById.get(String(item.category)) || item.category || '-',
        status: isConfirmed ? 'Confirm' : 'Not Confirmed',
        remarks: myConfirmation?.remarks || remarks[item.id] || '-',
      };
    });
  }, [items, remarks, userId, categoryNameById]);

  const reportClients = useMemo(() => {
    return Array.from(new Set(reportRows.map((row) => row.client))).sort((a, b) => a.localeCompare(b));
  }, [reportRows]);

  const filteredReportRows = useMemo(() => {
    if (!reportClientFilter) {
      return reportRows;
    }
    return reportRows.filter((row) => row.client === reportClientFilter);
  }, [reportRows, reportClientFilter]);

  const renderCustomFieldInput = (occurrence, field) => {
    const draft = customFieldValues[occurrence.id] || {};
    const value = getCustomFieldResolvedValue(field, draft);
    const commonProps = {
      fullWidth: true,
      size: 'small',
    };

    if (field.field_type === 'text') {
      return (
        <TextField
          {...commonProps}
          value={value ?? ''}
          onChange={(e) => handleCustomFieldValueChange(occurrence.id, field.id, e.target.value)}
          placeholder={field.required ? 'Required' : 'Optional'}
        />
      );
    }

    if (field.field_type === 'number') {
      return (
        <TextField
          {...commonProps}
          type="number"
          value={value ?? ''}
          onChange={(e) => handleCustomFieldValueChange(occurrence.id, field.id, e.target.value === '' ? null : Number(e.target.value))}
          placeholder={field.required ? 'Required' : 'Optional'}
        />
      );
    }

    if (field.field_type === 'date') {
      return (
        <TextField
          {...commonProps}
          type="date"
          value={value ?? ''}
          InputLabelProps={{ shrink: true }}
          onChange={(e) => handleCustomFieldValueChange(occurrence.id, field.id, e.target.value || null)}
        />
      );
    }

    if (field.field_type === 'date_range') {
      const rangeValue = value && typeof value === 'object' ? value : {};
      return (
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            {...commonProps}
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
                handleCustomFieldValueChange(occurrence.id, field.id, normalized);
              })()
            }
          />
          <TextField
            {...commonProps}
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
                handleCustomFieldValueChange(occurrence.id, field.id, normalized);
              })()
            }
          />
        </Box>
      );
    }

    if (field.field_type === 'boolean') {
      return (
        <FormControl fullWidth size="small">
          <InputLabel>Value</InputLabel>
          <Select
            value={value === null || value === undefined ? '' : value === true ? 'yes' : 'no'}
            label="Value"
            onChange={(e) => {
              const nextValue = e.target.value;
              handleCustomFieldValueChange(
                occurrence.id,
                field.id,
                nextValue === '' ? null : nextValue === 'yes'
              );
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
        <InputLabel>Value</InputLabel>
        <Select
          value={value ?? ''}
          label="Value"
          onChange={(e) => handleCustomFieldValueChange(occurrence.id, field.id, e.target.value || null)}
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

  const totalItems = items.length;

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

      {totalItems === 0 ? (
        <Alert severity="info">
          No checklist items require confirmation today. Great job!
        </Alert>
      ) : (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2, flexWrap: 'wrap' }}>
              <Checkbox
                checked={allSelected}
                indeterminate={partiallySelected}
                onChange={(e) => handleToggleSelectAll(e.target.checked)}
                disabled={visibleConfirmableItems.length === 0 || bulkConfirming || !!confirming}
              />
              <Typography variant="body2">
                Select all
              </Typography>
              <FormControlLabel
                sx={{ ml: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={showOnlyPendingAction}
                    onChange={(e) => setShowOnlyPendingAction(e.target.checked)}
                  />
                }
                label="Pending"
              />
              <FormControlLabel
                sx={{ ml: 0 }}
                control={
                  <Switch
                    size="small"
                    checked={includeSecondaryAssignments}
                    onChange={(e) => handleToggleIncludeSecondary(e.target.checked)}
                  />
                }
                label="Secondary"
              />
              <Chip label={`${selectedCount} / ${visibleConfirmableItems.length}`} size="small" />
              <TextField
                size="small"
                placeholder="Bulk remarks template"
                value={bulkRemarksTemplate}
                onChange={(e) => setBulkRemarksTemplate(e.target.value)}
                sx={{ width: 120 }}
              />
              <Button
                variant="outlined"
                onClick={handleApplyBulkTemplate}
                disabled={
                  selectedCount === 0 ||
                  bulkConfirming ||
                  !!confirming ||
                  !bulkRemarksTemplate.trim()
                }
              >
                Apply
              </Button>
              <Tooltip title="Clear selection">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setSelectedRows({})}
                    disabled={selectedCount === 0 || bulkConfirming || !!confirming}
                  >
                    <ClearAllIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Bulk confirm">
                <span>
                  <IconButton
                    color="primary"
                    onClick={handleBulkConfirm}
                    disabled={
                      selectedCount === 0
                      || bulkConfirming
                      || !!confirming
                      || selectedMissingRemarksCount > 0
                      || selectedMissingCustomFieldsCount > 0
                    }
                  >
                    {bulkConfirming ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                  </IconButton>
                </span>
              </Tooltip>
              <Tooltip title="Today Report">
                <span>
                  <IconButton
                    size="small"
                    onClick={() => setReportOpen(true)}
                  >
                    <AssessmentIcon fontSize="small" />
                  </IconButton>
                </span>
              </Tooltip>
            </Box>

            <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1 }}>
              <Table
                size="small"
                sx={{
                  '& th, & td': {
                    whiteSpace: 'nowrap'
                  }
                }}
              >
                <TableHead>
                  <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                    <TableCell padding="checkbox" sx={{ fontWeight: 600 }}>Select</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>My Role</TableCell>
                    <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                    <TableCell sx={{ fontWeight: 600, minWidth: 280 }}>Remarks</TableCell>
                    <TableCell sx={{ fontWeight: 600, width: 140 }}>Action</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {displayedItems.map((item) => {
                    const canConfirmNow = canUserConfirm(item);
                    const requiredRemarksMissing = item.remarks_required && !remarks[item.id]?.trim();
                    const requiredCustomMissing = getMissingRequiredCustomFields(item).length > 0;

                    return (
                      <TableRow
                        key={item.id}
                        hover
                        sx={{ backgroundColor: canConfirmNow ? '#f8fafc' : 'inherit' }}
                      >
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={!!selectedRows[item.id]}
                            onChange={() => handleToggleRow(item.id)}
                            disabled={!canConfirmNow || bulkConfirming || confirming === item.id}
                          />
                        </TableCell>
                        <TableCell>{item.client_name || 'Unknown Client'}</TableCell>
                        <TableCell>
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                            <Typography variant="body2" sx={{ fontWeight: 600 }} noWrap>
                              {item.title}
                            </Typography>
                            {item.description && (
                              <Typography variant="caption" color="text.secondary" noWrap>
                                ({item.description})
                              </Typography>
                            )}
                          </Box>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={item.frequency}
                            size="small"
                            sx={{
                              height: 22,
                              fontSize: '0.7rem',
                              ...FREQUENCY_COLORS[item.frequency],
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          {item.my_assignment_role ? (
                            <Chip
                              size="small"
                              variant={item.my_assignment_role === 'primary' ? 'filled' : 'outlined'}
                              color={item.my_assignment_role === 'primary' ? 'primary' : 'default'}
                              label={item.my_assignment_role === 'primary' ? 'Primary' : 'Secondary'}
                            />
                          ) : (
                            <Typography variant="caption" color="text.secondary">-</Typography>
                          )}
                        </TableCell>
                        <TableCell>{getStatusChip(item)}</TableCell>
                        <TableCell>
                          <TextField
                            fullWidth
                            size="small"
                            placeholder={item.remarks_required ? 'Remarks (Required)' : 'Remarks (Optional)'}
                            value={remarks[item.id] || ''}
                            onChange={(e) =>
                              setRemarks((prev) => ({ ...prev, [item.id]: e.target.value }))
                            }
                            disabled={!canConfirmNow || bulkConfirming || confirming === item.id}
                          />
                        </TableCell>
                        <TableCell>
                          {getOccurrenceFields(item).length > 0 && (
                            <Tooltip title="Edit custom fields">
                              <IconButton
                                size="small"
                                onClick={() => setCustomFieldDialogItem(item)}
                                sx={{ mr: 1 }}
                              >
                                <EditNoteIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          )}
                          <Tooltip
                            title={
                              requiredRemarksMissing
                                ? 'Remarks are required before confirming'
                                : requiredCustomMissing
                                  ? getCustomFieldValidationError(item)
                                  : canConfirmNow
                                    ? 'Confirm'
                                    : getCannotConfirmReason(item)
                            }
                          >
                            <span>
                              <IconButton
                                color="primary"
                                onClick={() => handleConfirm(item)}
                                disabled={
                                  !canConfirmNow ||
                                  bulkConfirming ||
                                  confirming === item.id ||
                                  requiredRemarksMissing ||
                                  requiredCustomMissing
                                }
                              >
                                {confirming === item.id ? <CircularProgress size={18} /> : <CheckCircleIcon />}
                              </IconButton>
                            </span>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>

            {selectedMissingRemarksCount > 0 && (
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={`${selectedMissingRemarksCount} selected item(s) need remarks`}
                  color="warning"
                  size="small"
                />
              </Box>
            )}

            {selectedMissingCustomFieldsCount > 0 && (
              <Box sx={{ mt: 1 }}>
                <Chip
                  label={`${selectedMissingCustomFieldsCount} selected item(s) need required custom fields`}
                  color="warning"
                  variant="outlined"
                  size="small"
                />
              </Box>
            )}
          </CardContent>
        </Card>
      )}

      <Dialog
        open={Boolean(customFieldDialogItem)}
        onClose={() => setCustomFieldDialogItem(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Custom Fields</DialogTitle>
        <DialogContent>
          {customFieldDialogItem && (
            <Box sx={{ mt: 1, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
              <Typography variant="subtitle2">
                {customFieldDialogItem.title}
              </Typography>
              {getOccurrenceFields(customFieldDialogItem).length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No custom fields for this item.
                </Typography>
              ) : (
                getOccurrenceFields(customFieldDialogItem).map((field) => (
                  <Box key={`daily-custom-field-${customFieldDialogItem.id}-${field.id}`}>
                    <Typography variant="caption" sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}>
                      {field.label}{field.required ? ' *' : ''}
                    </Typography>
                    {renderCustomFieldInput(customFieldDialogItem, field)}
                  </Box>
                ))
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomFieldDialogItem(null)}>Done</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={reportOpen} onClose={() => setReportOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Today Report</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 1, mb: 2 }}>
            <FormControl size="small" sx={{ minWidth: 220 }}>
              <InputLabel>Client</InputLabel>
              <Select
                value={reportClientFilter}
                label="Client"
                onChange={(e) => setReportClientFilter(e.target.value)}
              >
                <MenuItem value="">All Clients</MenuItem>
                {reportClients.map((client) => (
                  <MenuItem key={client} value={client}>{client}</MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>

          <TableContainer sx={{ border: '1px solid #e2e8f0', borderRadius: 1 }}>
            <Table size="small">
              <TableHead>
                <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                  <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Remarks</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {filteredReportRows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} align="center">
                      <Typography variant="body2" color="text.secondary">No report rows</Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredReportRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>{row.client}</TableCell>
                      <TableCell>{row.item}</TableCell>
                      <TableCell>{row.category}</TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={row.status}
                          color={row.status === 'Confirm' ? 'success' : 'default'}
                          variant={row.status === 'Confirm' ? 'filled' : 'outlined'}
                        />
                      </TableCell>
                      <TableCell>{row.remarks || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setReportOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DailyFocusView;
