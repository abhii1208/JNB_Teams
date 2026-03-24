/**
 * ChecklistItemManager - Admin UI for creating and managing checklist items
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  Card,
  CardContent,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  FormControlLabel,
  Switch,
  Autocomplete,
  Alert,
  CircularProgress,
  Tooltip,
  Tabs,
  Tab,
  Divider,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import SettingsIcon from '@mui/icons-material/Settings';
import {
  getChecklistItems,
  createChecklistItem,
  updateChecklistItem,
  updateChecklistAssignments,
  deleteChecklistItem,
  getChecklistCategories,
  createChecklistCategory,
  getWorkspaceMembers,
  getWorkspaceChecklistSettings,
  updateWorkspaceChecklistSettings,
  deactivateChecklistCustomField,
} from '../../apiClient';
import { CUSTOM_FIELD_TYPES } from './customFieldUtils';

const INITIAL_ITEM = {
  title: '',
  description: '',
  frequency: 'daily',
  category_id: '',
  completion_rule: 'all',
  remarks_required: false,
  weekly_schedule_type: 'any_day',
  weekly_day_of_week: 1,
  monthly_schedule_type: 'any_day',
  monthly_day_of_month: 1,
  primary_assignee_ids: [],
  secondary_assignee_ids: [],
  custom_fields: [],
  is_active: true,
};

const WEEKDAY_OPTIONS = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' },
];

function getScheduleSummary(item) {
  if (item.frequency === 'daily') {
    return 'Only on that day';
  }

  if (item.frequency === 'weekly') {
    if (item.weekly_schedule_type === 'specific_day') {
      const label = WEEKDAY_OPTIONS.find(d => d.value === Number(item.weekly_day_of_week))?.label || 'Selected day';
      return `${label} only`;
    }
    return 'Any day in the week';
  }

  if (item.frequency === 'monthly') {
    if (item.monthly_schedule_type === 'month_end') {
      return 'Month-end only';
    }
    if (item.monthly_schedule_type === 'specific_day') {
      return `Day ${item.monthly_day_of_month || 1} only`;
    }
    return 'Any day in the month';
  }

  return '-';
}

function ChecklistItemManager({ workspaceId, clientId, isAdmin }) {
  const [items, setItems] = useState([]);
  const [categories, setCategories] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Item dialog state
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [itemForm, setItemForm] = useState(INITIAL_ITEM);
  const [saving, setSaving] = useState(false);
  const [customFieldDisableDates, setCustomFieldDisableDates] = useState({});
  const [deactivatingFieldId, setDeactivatingFieldId] = useState(null);

  // Category dialog state
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState('');

  // Settings dialog state
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [settingsForm, setSettingsForm] = useState({});

  // Active tab
  const [activeTab, setActiveTab] = useState(0);
  const [itemSearch, setItemSearch] = useState('');
  const [frequencyFilter, setFrequencyFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [sortBy, setSortBy] = useState('title_asc');

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const filters = clientId ? { clientId } : {};
      
      const [itemsRes, categoriesRes, membersRes, settingsRes] = await Promise.all([
        getChecklistItems(workspaceId, filters),
        getChecklistCategories(workspaceId),
        getWorkspaceMembers(workspaceId),
        getWorkspaceChecklistSettings(workspaceId),
      ]);
      
      setItems(itemsRes.data || []);
      setCategories(categoriesRes.data || []);
      setMembers(membersRes.data || []);
      setSettingsForm(settingsRes.data || {});
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load checklist data');
    } finally {
      setLoading(false);
    }
  }, [workspaceId, clientId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const categoryNameById = React.useMemo(() => {
    const lookup = new Map();
    categories.forEach((cat) => {
      lookup.set(String(cat.id), cat.name);
    });
    return lookup;
  }, [categories]);

  const resolveCategoryName = useCallback((item) => {
    const rawCategory = item?.category_name ?? item?.category ?? item?.category_id;
    if (rawCategory === null || rawCategory === undefined || rawCategory === '') {
      return '';
    }
    return categoryNameById.get(String(rawCategory)) || String(rawCategory);
  }, [categoryNameById]);

  const getAssigneeId = useCallback((assignee) => {
    const raw = assignee?.id ?? assignee?.user_id;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
  }, []);

  const getAssigneeName = useCallback((assignee) => (
    assignee?.name || assignee?.user_name || assignee?.username || assignee?.email || 'Unknown'
  ), []);

  const parseAssigneesByRole = useCallback((item) => {
    const assignees = Array.isArray(item?.assignees) ? item.assignees : [];
    const explicitPrimary = assignees
      .filter((a) => a.assignment_role === 'primary')
      .map((a) => getAssigneeId(a))
      .filter(Number.isFinite);

    const primaryIds = explicitPrimary.length > 0
      ? explicitPrimary
      : assignees
        .map((a) => getAssigneeId(a))
        .filter(Number.isFinite);

    const primarySet = new Set(primaryIds);

    const secondaryIds = assignees
      .filter((a) => !primarySet.has(getAssigneeId(a)))
      .filter((a) => a.assignment_role === 'secondary' || !a.assignment_role)
      .map((a) => getAssigneeId(a))
      .filter(Number.isFinite);

    return {
      primaryIds,
      secondaryIds
    };
  }, [getAssigneeId]);

  const normalizeCustomFieldsForForm = useCallback((customFields) => {
    if (!Array.isArray(customFields)) {
      return [];
    }

    return customFields.map((field, index) => ({
      id: field.id,
      label: field.label || '',
      field_type: field.field_type || 'text',
      required: field.required === true,
      options: Array.isArray(field.options)
        ? field.options
        : String(field.options || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      display_order: Number.isFinite(Number(field.display_order)) ? Number(field.display_order) : index,
      effective_from: field.effective_from ? String(field.effective_from).slice(0, 10) : null,
      disabled_from: field.disabled_from ? String(field.disabled_from).slice(0, 10) : null,
      is_active: field.is_active !== false,
      options_input: Array.isArray(field.options)
        ? field.options.join(', ')
        : String(field.options || '')
    }));
  }, []);

  const validateCustomFields = useCallback((fields) => {
    if (!Array.isArray(fields)) {
      return [];
    }

    return fields.map((field, index) => {
      const label = String(field.label || '').trim();
      const fieldType = String(field.field_type || '').trim();
      const required = field.required === true;
      const displayOrder = Number.isFinite(Number(field.display_order))
        ? Number(field.display_order)
        : index;

      if (!label) {
        throw new Error(`Custom field #${index + 1} label is required`);
      }

      if (!CUSTOM_FIELD_TYPES.some((option) => option.value === fieldType)) {
        throw new Error(`Custom field "${label}" has invalid type`);
      }

      const normalizedField = {
        label,
        fieldType,
        required,
        displayOrder,
      };

      if (fieldType === 'dropdown') {
        const options = String(field.options_input || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean);
        const uniqueOptions = [];
        const seen = new Set();
        options.forEach((option) => {
          const key = option.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            uniqueOptions.push(option);
          }
        });
        if (uniqueOptions.length === 0) {
          throw new Error(`Custom field "${label}" requires at least one option`);
        }
        normalizedField.options = uniqueOptions;
      }

      return normalizedField;
    });
  }, []);

  // Handle item dialog open
  const handleOpenItemDialog = (item = null) => {
    if (item) {
      const assignmentRoles = parseAssigneesByRole(item);
      const normalizedCustomFields = normalizeCustomFieldsForForm(item.custom_fields || []);
      setEditingItem(item);
      setItemForm({
        title: item.title,
        description: item.description || '',
        frequency: item.frequency,
        category_id: item.category_id || item.category || '',
        completion_rule: item.completion_rule,
        remarks_required: item.remarks_required,
        weekly_schedule_type: item.weekly_schedule_type || 'any_day',
        weekly_day_of_week: Number.isNaN(Number(item.weekly_day_of_week)) ? 1 : Number(item.weekly_day_of_week),
        monthly_schedule_type: item.monthly_schedule_type || 'any_day',
        monthly_day_of_month: Number(item.monthly_day_of_month) || 1,
        primary_assignee_ids: assignmentRoles.primaryIds,
        secondary_assignee_ids: assignmentRoles.secondaryIds,
        custom_fields: normalizedCustomFields,
        is_active: item.is_active,
      });
      setCustomFieldDisableDates(
        normalizedCustomFields.reduce((acc, field) => {
          if (field.id) {
            acc[field.id] = field.disabled_from || new Date().toISOString().split('T')[0];
          }
          return acc;
        }, {})
      );
    } else {
      setEditingItem(null);
      setItemForm(INITIAL_ITEM);
      setCustomFieldDisableDates({});
    }
    setItemDialogOpen(true);
  };

  // Handle dialog close
  const handleCloseDialog = () => {
    setItemForm(INITIAL_ITEM);
    setEditingItem(null);
    setError(null);
    setCustomFieldDisableDates({});
    setDeactivatingFieldId(null);
    setItemDialogOpen(false);
  };

  const handleAddCustomField = () => {
    setItemForm((prev) => ({
      ...prev,
      custom_fields: [
        ...(Array.isArray(prev.custom_fields) ? prev.custom_fields : []),
        {
          label: '',
          field_type: 'text',
          required: false,
          options: [],
          options_input: '',
          display_order: (prev.custom_fields?.length || 0),
          is_active: true
        }
      ]
    }));
  };

  const handleUpdateCustomFieldDraft = (index, patch) => {
    setItemForm((prev) => {
      const current = Array.isArray(prev.custom_fields) ? prev.custom_fields : [];
      const next = current.map((field, fieldIndex) => (
        fieldIndex === index
          ? { ...field, ...patch }
          : field
      ));
      return {
        ...prev,
        custom_fields: next
      };
    });
  };

  const handleRemoveCustomFieldDraft = (index) => {
    setItemForm((prev) => {
      const current = Array.isArray(prev.custom_fields) ? prev.custom_fields : [];
      const next = current
        .filter((_, fieldIndex) => fieldIndex !== index)
        .map((field, fieldIndex) => ({ ...field, display_order: fieldIndex }));
      return {
        ...prev,
        custom_fields: next
      };
    });
  };

  const handleDeactivateCustomField = async (fieldId) => {
    if (!editingItem || !fieldId) {
      return;
    }

    const disabledFrom = customFieldDisableDates[fieldId] || new Date().toISOString().split('T')[0];
    try {
      setDeactivatingFieldId(fieldId);
      setError(null);
      await deactivateChecklistCustomField(editingItem.id, fieldId, disabledFrom);

      setItemForm((prev) => ({
        ...prev,
        custom_fields: (prev.custom_fields || []).map((field) => (
          field.id === fieldId
            ? { ...field, disabled_from: disabledFrom }
            : field
        ))
      }));
      await fetchData();
    } catch (err) {
      console.error('Error deactivating custom field:', err);
      setError(err.response?.data?.error || 'Failed to deactivate custom field');
    } finally {
      setDeactivatingFieldId(null);
    }
  };

  // Handle item save
  const handleSaveItem = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!itemForm.title.trim()) {
        setError('Title is required');
        return;
      }

      if (!Array.isArray(itemForm.primary_assignee_ids) || itemForm.primary_assignee_ids.length === 0) {
        setError('At least one primary assignee is required');
        return;
      }

      const primarySet = new Set(itemForm.primary_assignee_ids.map((id) => Number(id)));
      const hasOverlap = itemForm.secondary_assignee_ids.some((id) => primarySet.has(Number(id)));
      if (hasOverlap) {
        setError('Primary assignees cannot also be selected as secondary');
        return;
      }

      if (itemForm.frequency === 'weekly' && itemForm.weekly_schedule_type === 'specific_day') {
        if (itemForm.weekly_day_of_week === '' || itemForm.weekly_day_of_week === null || itemForm.weekly_day_of_week === undefined) {
          setError('Select a weekday for weekly specific-day items');
          return;
        }
      }

      if (itemForm.frequency === 'monthly' && itemForm.monthly_schedule_type === 'specific_day') {
        if (!itemForm.monthly_day_of_month || itemForm.monthly_day_of_month < 1 || itemForm.monthly_day_of_month > 31) {
          setError('Select a valid day (1-31) for monthly specific-day items');
          return;
        }
      }

      const draftCustomFields = editingItem
        ? (itemForm.custom_fields || []).filter((field) => !field.id)
        : (itemForm.custom_fields || []);
      const normalizedCustomFields = validateCustomFields(draftCustomFields);

      // Prepare data for API - map frontend form fields to backend expected fields
      const apiData = {
        clientId: clientId,
        title: itemForm.title,
        description: itemForm.description,
        category: itemForm.category_id || null,
        frequency: itemForm.frequency,
        weeklyScheduleType: itemForm.weekly_schedule_type,
        weeklyDayOfWeek: itemForm.weekly_schedule_type === 'specific_day' ? Number(itemForm.weekly_day_of_week) : null,
        monthlyScheduleType: itemForm.monthly_schedule_type,
        monthlyDayOfMonth: itemForm.monthly_schedule_type === 'specific_day' ? Number(itemForm.monthly_day_of_month) : null,
        effectiveFrom: new Date().toISOString().split('T')[0], // Today's date
        completionRule: itemForm.completion_rule,
        remarksRequired: itemForm.remarks_required,
        primaryAssigneeIds: itemForm.primary_assignee_ids.map(Number),
        secondaryAssigneeIds: itemForm.secondary_assignee_ids.map(Number),
        customFields: normalizedCustomFields,
        isActive: itemForm.is_active,
      };

      console.log('Sending checklist item data:', apiData);
      console.log('Form data:', JSON.stringify(itemForm, null, 2));
      console.log('Category from form:', itemForm.category_id);
      console.log('Primary assignees from form:', itemForm.primary_assignee_ids);
      console.log('Secondary assignees from form:', itemForm.secondary_assignee_ids);

      if (editingItem) {
        await updateChecklistItem(editingItem.id, apiData);

        // Keep assignments in sync for existing items
        const previousRoles = parseAssigneesByRole(editingItem);
        const previousPrimary = previousRoles.primaryIds
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);
        const previousSecondary = previousRoles.secondaryIds
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);
        const nextPrimary = [...itemForm.primary_assignee_ids]
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);
        const nextSecondary = [...itemForm.secondary_assignee_ids]
          .map(Number)
          .filter(Number.isFinite)
          .sort((a, b) => a - b);

        const assignmentsChanged =
          previousPrimary.length !== nextPrimary.length ||
          previousPrimary.some((id, index) => id !== nextPrimary[index]) ||
          previousSecondary.length !== nextSecondary.length ||
          previousSecondary.some((id, index) => id !== nextSecondary[index]);

        if (assignmentsChanged) {
          await updateChecklistAssignments(
            editingItem.id,
            {
              primaryAssigneeIds: nextPrimary,
              secondaryAssigneeIds: nextSecondary,
              effectiveFrom: new Date().toISOString().split('T')[0]
            }
          );
        }
      } else {
        await createChecklistItem(workspaceId, apiData);
      }

      // Reset form and close dialog
      handleCloseDialog();
      fetchData();
    } catch (err) {
      console.error('Error saving item:', err);
      console.error('Error response:', err.response);
      console.error('Error status:', err.response?.status);
      console.error('Error data:', err.response?.data);
      setError(err.response?.data?.error || 'Failed to save item');
    } finally {
      setSaving(false);
    }
  };

  // Handle item delete
  const handleDeleteItem = async (item) => {
    if (!window.confirm(`Are you sure you want to delete "${item.title}"?`)) {
      return;
    }

    try {
      await deleteChecklistItem(item.id);
      fetchData();
    } catch (err) {
      console.error('Error deleting item:', err);
      setError(err.response?.data?.error || 'Failed to delete item');
    }
  };

  // Handle item duplicate
  const handleDuplicateItem = (item) => {
    const assignmentRoles = parseAssigneesByRole(item);
    const normalizedCustomFields = normalizeCustomFieldsForForm(item.custom_fields || []);
    setEditingItem(null);
    setItemForm({
      title: `${item.title} (Copy)`,
      description: item.description || '',
      frequency: item.frequency,
      category_id: item.category_id || item.category || '',
      completion_rule: item.completion_rule,
      remarks_required: item.remarks_required,
      weekly_schedule_type: item.weekly_schedule_type || 'any_day',
      weekly_day_of_week: Number.isNaN(Number(item.weekly_day_of_week)) ? 1 : Number(item.weekly_day_of_week),
      monthly_schedule_type: item.monthly_schedule_type || 'any_day',
      monthly_day_of_month: Number(item.monthly_day_of_month) || 1,
      primary_assignee_ids: assignmentRoles.primaryIds,
      secondary_assignee_ids: assignmentRoles.secondaryIds,
      custom_fields: normalizedCustomFields.map((field, index) => ({
        ...field,
        id: undefined,
        disabled_from: null,
        display_order: index
      })),
      is_active: true,
    });
    setCustomFieldDisableDates({});
    setItemDialogOpen(true);
  };

  // Handle category save
  const handleSaveCategory = async () => {
    try {
      setSaving(true);
      if (!newCategory.trim()) {
        setError('Category name is required');
        return;
      }
      await createChecklistCategory(workspaceId, { name: newCategory.trim() });
      setCategoryDialogOpen(false);
      setNewCategory('');
      fetchData();
    } catch (err) {
      console.error('Error saving category:', err);
      setError(err.response?.data?.error || 'Failed to save category');
    } finally {
      setSaving(false);
    }
  };

  // Handle settings save
  const handleSaveSettings = async () => {
    try {
      setSaving(true);
      await updateWorkspaceChecklistSettings(workspaceId, settingsForm);
      setSettingsDialogOpen(false);
      fetchData();
    } catch (err) {
      console.error('Error saving settings:', err);
      setError(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Filter and sort items
  const filteredItems = React.useMemo(() => {
    const tabFrequency = activeTab === 0 ? '' : ['daily', 'weekly', 'monthly'][activeTab - 1];
    const searchLower = itemSearch.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (tabFrequency && item.frequency !== tabFrequency) {
        return false;
      }

      if (frequencyFilter && item.frequency !== frequencyFilter) {
        return false;
      }

      if (categoryFilter && String(item.category ?? item.category_id ?? '') !== String(categoryFilter)) {
        return false;
      }

      if (searchLower && !item.title?.toLowerCase().includes(searchLower)) {
        return false;
      }

      return true;
    });

    const sorted = [...filtered].sort((a, b) => {
      const aTitle = a.title || '';
      const bTitle = b.title || '';
      const aCategory = resolveCategoryName(a);
      const bCategory = resolveCategoryName(b);
      const aFrequency = a.frequency || '';
      const bFrequency = b.frequency || '';

      switch (sortBy) {
        case 'title_desc':
          return bTitle.localeCompare(aTitle);
        case 'category_asc':
          return aCategory.localeCompare(bCategory) || aTitle.localeCompare(bTitle);
        case 'category_desc':
          return bCategory.localeCompare(aCategory) || aTitle.localeCompare(bTitle);
        case 'frequency_asc':
          return aFrequency.localeCompare(bFrequency) || aTitle.localeCompare(bTitle);
        case 'frequency_desc':
          return bFrequency.localeCompare(aFrequency) || aTitle.localeCompare(bTitle);
        case 'title_asc':
        default:
          return aTitle.localeCompare(bTitle);
      }
    });

    return sorted;
  }, [activeTab, itemSearch, frequencyFilter, categoryFilter, sortBy, items, resolveCategoryName]);

  const hasActiveTableFilters = Boolean(
    itemSearch ||
    frequencyFilter ||
    categoryFilter ||
    sortBy !== 'title_asc'
  );

  const handleClearTableFilters = () => {
    setItemSearch('');
    setFrequencyFilter('');
    setCategoryFilter('');
    setSortBy('title_asc');
  };

  const customFieldEntries = React.useMemo(
    () => (itemForm.custom_fields || []).map((field, index) => ({ field, index })),
    [itemForm.custom_fields]
  );
  const existingCustomFieldEntries = React.useMemo(
    () => customFieldEntries.filter(({ field }) => Boolean(field.id)),
    [customFieldEntries]
  );
  const draftCustomFieldEntries = React.useMemo(
    () => customFieldEntries.filter(({ field }) => !field.id),
    [customFieldEntries]
  );

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

      {/* Action Buttons */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => handleOpenItemDialog()}
          disabled={!isAdmin}
        >
          Add Checklist Item
        </Button>
        <Button
          variant="outlined"
          onClick={() => setCategoryDialogOpen(true)}
          disabled={!isAdmin}
        >
          Manage Categories
        </Button>
        <Button
          variant="outlined"
          startIcon={<SettingsIcon />}
          onClick={() => setSettingsDialogOpen(true)}
          disabled={!isAdmin}
        >
          Workspace Settings
        </Button>
      </Box>

      {/* Summary Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
        <Card sx={{ flex: 1, backgroundColor: '#dbeafe' }}>
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
              {items.filter(i => i.frequency === 'daily').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Daily Items</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, backgroundColor: '#fef3c7' }}>
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#b45309' }}>
              {items.filter(i => i.frequency === 'weekly').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Weekly Items</Typography>
          </CardContent>
        </Card>
        <Card sx={{ flex: 1, backgroundColor: '#f3e8ff' }}>
          <CardContent>
            <Typography variant="h4" sx={{ fontWeight: 700, color: '#7c3aed' }}>
              {items.filter(i => i.frequency === 'monthly').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">Monthly Items</Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs for filtering */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label={`All (${items.length})`} />
        <Tab label={`Daily (${items.filter(i => i.frequency === 'daily').length})`} />
        <Tab label={`Weekly (${items.filter(i => i.frequency === 'weekly').length})`} />
        <Tab label={`Monthly (${items.filter(i => i.frequency === 'monthly').length})`} />
      </Tabs>

      {/* Table Filters & Sorting */}
      <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
        <TextField
          size="small"
          label="Checklist Item"
          placeholder="Search title"
          value={itemSearch}
          onChange={(e) => setItemSearch(e.target.value)}
          sx={{ minWidth: 220 }}
        />
        <FormControl size="small" sx={{ minWidth: 140 }}>
          <InputLabel>Category</InputLabel>
          <Select
            value={categoryFilter}
            label="Category"
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            {categories.map((cat) => (
              <MenuItem key={cat.id} value={String(cat.id)}>{cat.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 130 }}>
          <InputLabel>Frequency</InputLabel>
          <Select
            value={frequencyFilter}
            label="Frequency"
            onChange={(e) => setFrequencyFilter(e.target.value)}
          >
            <MenuItem value="">All</MenuItem>
            <MenuItem value="daily">Daily</MenuItem>
            <MenuItem value="weekly">Weekly</MenuItem>
            <MenuItem value="monthly">Monthly</MenuItem>
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Sort By</InputLabel>
          <Select
            value={sortBy}
            label="Sort By"
            onChange={(e) => setSortBy(e.target.value)}
          >
            <MenuItem value="title_asc">Item A-Z</MenuItem>
            <MenuItem value="title_desc">Item Z-A</MenuItem>
            <MenuItem value="category_asc">Category A-Z</MenuItem>
            <MenuItem value="category_desc">Category Z-A</MenuItem>
            <MenuItem value="frequency_asc">Frequency A-Z</MenuItem>
            <MenuItem value="frequency_desc">Frequency Z-A</MenuItem>
          </Select>
        </FormControl>
        <Button
          size="small"
          variant="text"
          onClick={handleClearTableFilters}
          disabled={!hasActiveTableFilters}
        >
          Clear Filters
        </Button>
      </Box>

      {/* Items Table */}
      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: '#f8fafc' }}>
              <TableCell sx={{ fontWeight: 600 }}>Title</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Completion Rule</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Assignees</TableCell>
              <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 600, textAlign: 'center' }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filteredItems.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                  <Typography color="text.secondary">
                    No checklist items found. Click "Add Checklist Item" to create one.
                  </Typography>
                </TableCell>
              </TableRow>
            ) : (
              filteredItems.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.title}
                    </Typography>
                    {item.description && (
                      <Typography variant="caption" color="text.secondary">
                        {item.description}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Box>
                      <Chip
                        label={item.frequency}
                        size="small"
                        sx={{
                          backgroundColor: {
                            daily: '#dbeafe',
                            weekly: '#fef3c7',
                            monthly: '#f3e8ff',
                          }[item.frequency],
                          color: {
                            daily: '#1d4ed8',
                            weekly: '#b45309',
                            monthly: '#7c3aed',
                          }[item.frequency],
                        }}
                      />
                      <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                        {getScheduleSummary(item)}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell>
                    {resolveCategoryName(item) || <Typography color="text.secondary">-</Typography>}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.completion_rule === 'all' ? 'All primary must confirm' : 'Any primary can confirm'}
                      size="small"
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {(() => {
                      const assignmentRoles = parseAssigneesByRole(item);
                      const primaryAssignees = (item.assignees || []).filter((a) =>
                        assignmentRoles.primaryIds.includes(getAssigneeId(a))
                      );
                      const secondaryAssignees = (item.assignees || []).filter(
                        (a) => assignmentRoles.secondaryIds.includes(getAssigneeId(a))
                      );

                      return (
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
                          {primaryAssignees.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {primaryAssignees.slice(0, 2).map((a) => (
                                <Chip
                                  key={getAssigneeId(a) ?? `${item.id}-primary`}
                                  size="small"
                                  color="primary"
                                  label={`Primary: ${getAssigneeName(a)}`}
                                />
                              ))}
                              {primaryAssignees.length > 2 && (
                                <Chip
                                  size="small"
                                  color="primary"
                                  variant="outlined"
                                  label={`+${primaryAssignees.length - 2} primary`}
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No primary</Typography>
                          )}
                          {secondaryAssignees.length > 0 ? (
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {secondaryAssignees.slice(0, 2).map((a) => (
                                <Chip
                                  key={getAssigneeId(a) ?? `${item.id}-secondary`}
                                  size="small"
                                  variant="outlined"
                                  label={`Secondary: ${getAssigneeName(a)}`}
                                />
                              ))}
                              {secondaryAssignees.length > 2 && (
                                <Chip
                                  size="small"
                                  variant="outlined"
                                  label={`+${secondaryAssignees.length - 2} secondary`}
                                />
                              )}
                            </Box>
                          ) : (
                            <Typography variant="caption" color="text.secondary">No secondary</Typography>
                          )}
                        </Box>
                      );
                    })()}
                  </TableCell>
                  <TableCell>
                    <Chip 
                      label={item.is_active ? 'Active' : 'Inactive'}
                      size="small"
                      color={item.is_active ? 'success' : 'default'}
                    />
                  </TableCell>
                  <TableCell align="center">
                    <Tooltip title="Edit">
                      <IconButton size="small" onClick={() => handleOpenItemDialog(item)} disabled={!isAdmin}>
                        <EditIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Duplicate">
                      <IconButton size="small" onClick={() => handleDuplicateItem(item)} disabled={!isAdmin}>
                        <ContentCopyIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Tooltip title="Delete">
                      <IconButton size="small" onClick={() => handleDeleteItem(item)} disabled={!isAdmin} color="error">
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Item Dialog */}
      <Dialog open={itemDialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingItem ? 'Edit Checklist Item' : 'New Checklist Item'}
        </DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Title"
              fullWidth
              required
              value={itemForm.title}
              onChange={(e) => setItemForm({ ...itemForm, title: e.target.value })}
            />
            <TextField
              label="Description"
              fullWidth
              multiline
              rows={2}
              value={itemForm.description}
              onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
            />
            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControl fullWidth>
                <InputLabel>Frequency</InputLabel>
                <Select
                  value={itemForm.frequency}
                  label="Frequency"
                  onChange={(e) => {
                    const nextFrequency = e.target.value;
                    setItemForm({
                      ...itemForm,
                      frequency: nextFrequency,
                      weekly_schedule_type: nextFrequency === 'weekly' ? itemForm.weekly_schedule_type : 'any_day',
                      weekly_day_of_week: nextFrequency === 'weekly' ? itemForm.weekly_day_of_week : 1,
                      monthly_schedule_type: nextFrequency === 'monthly' ? itemForm.monthly_schedule_type : 'any_day',
                      monthly_day_of_month: nextFrequency === 'monthly' ? itemForm.monthly_day_of_month : 1,
                    });
                  }}
                >
                  <MenuItem value="daily">Daily</MenuItem>
                  <MenuItem value="weekly">Weekly</MenuItem>
                  <MenuItem value="monthly">Monthly</MenuItem>
                </Select>
              </FormControl>
              <FormControl fullWidth>
                <InputLabel>Category</InputLabel>
                <Select
                  value={itemForm.category_id}
                  label="Category"
                  onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                >
                  <MenuItem value="">None</MenuItem>
                  {categories.map((cat) => (
                    <MenuItem key={cat.id} value={cat.id}>{cat.name}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Box>

            {itemForm.frequency === 'weekly' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Weekly Option</InputLabel>
                  <Select
                    value={itemForm.weekly_schedule_type}
                    label="Weekly Option"
                    onChange={(e) => setItemForm({ ...itemForm, weekly_schedule_type: e.target.value })}
                  >
                    <MenuItem value="any_day">Any day in the week</MenuItem>
                    <MenuItem value="specific_day">Particular day in the week</MenuItem>
                  </Select>
                </FormControl>
                {itemForm.weekly_schedule_type === 'specific_day' && (
                  <FormControl fullWidth>
                    <InputLabel>Weekday</InputLabel>
                    <Select
                      value={itemForm.weekly_day_of_week}
                      label="Weekday"
                      onChange={(e) => setItemForm({ ...itemForm, weekly_day_of_week: Number(e.target.value) })}
                    >
                      {WEEKDAY_OPTIONS.map((day) => (
                        <MenuItem key={day.value} value={day.value}>{day.label}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            )}

            {itemForm.frequency === 'monthly' && (
              <Box sx={{ display: 'flex', gap: 2 }}>
                <FormControl fullWidth>
                  <InputLabel>Monthly Option</InputLabel>
                  <Select
                    value={itemForm.monthly_schedule_type}
                    label="Monthly Option"
                    onChange={(e) => setItemForm({ ...itemForm, monthly_schedule_type: e.target.value })}
                  >
                    <MenuItem value="any_day">Any day in the month</MenuItem>
                    <MenuItem value="specific_day">Particular day in the month</MenuItem>
                    <MenuItem value="month_end">Month-end</MenuItem>
                  </Select>
                </FormControl>
                {itemForm.monthly_schedule_type === 'specific_day' && (
                  <FormControl fullWidth>
                    <InputLabel>Day of Month</InputLabel>
                    <Select
                      value={itemForm.monthly_day_of_month}
                      label="Day of Month"
                      onChange={(e) => setItemForm({ ...itemForm, monthly_day_of_month: Number(e.target.value) })}
                    >
                      {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                        <MenuItem key={day} value={day}>{day}</MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                )}
              </Box>
            )}

            <FormControl fullWidth>
              <InputLabel>Completion Rule</InputLabel>
              <Select
                value={itemForm.completion_rule}
                label="Completion Rule"
                onChange={(e) => setItemForm({ ...itemForm, completion_rule: e.target.value })}
              >
                <MenuItem value="all">All primary assignees must confirm</MenuItem>
                <MenuItem value="any">Any primary assignee can confirm</MenuItem>
              </Select>
            </FormControl>
            <Autocomplete
              multiple
              options={members}
              getOptionLabel={(option) => option.name || option.email}
              value={members.filter((m) => itemForm.primary_assignee_ids.includes(Number(m.id)))}
              onChange={(e, newValue) => {
                const nextPrimaryIds = newValue.map((v) => Number(v.id));
                const nextPrimarySet = new Set(nextPrimaryIds);
                setItemForm((prev) => ({
                  ...prev,
                  primary_assignee_ids: nextPrimaryIds,
                  secondary_assignee_ids: prev.secondary_assignee_ids.filter((id) => !nextPrimarySet.has(Number(id)))
                }));
              }}
              renderInput={(params) => <TextField {...params} label="Primary Assignees" required />}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key ?? option.id}
                      color="primary"
                      label={option.name || option.email}
                      {...tagProps}
                    />
                  );
                })
              }
            />

            <Autocomplete
              multiple
              options={members.filter((m) => !itemForm.primary_assignee_ids.includes(Number(m.id)))}
              getOptionLabel={(option) => option.name || option.email}
              value={members.filter((m) => itemForm.secondary_assignee_ids.includes(Number(m.id)))}
              onChange={(e, newValue) =>
                setItemForm((prev) => ({
                  ...prev,
                  secondary_assignee_ids: newValue.map((v) => Number(v.id))
                }))
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  label="Secondary Assignees (Fallback)"
                  helperText="Secondary can confirm only when no active primary assignee is available."
                />
              )}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key, ...tagProps } = getTagProps({ index });
                  return (
                    <Chip
                      key={key ?? option.id}
                      label={option.name || option.email}
                      {...tagProps}
                    />
                  );
                })
              }
            />

            <Divider />
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                Custom Fields
              </Typography>
              <Button size="small" variant="outlined" onClick={handleAddCustomField}>
                Add Field
              </Button>
            </Box>

            {!editingItem && draftCustomFieldEntries.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No custom fields added. Use this only when assignees must capture extra structured data.
              </Typography>
            )}

            {editingItem && (
              <Typography variant="caption" color="text.secondary">
                Existing fields are immutable. You can disable existing fields for future dates and add new fields below.
              </Typography>
            )}

            {draftCustomFieldEntries.map(({ field, index }) => (
              <Box
                key={`draft-custom-field-${index}`}
                sx={{ border: '1px solid #e2e8f0', borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
              >
                <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'flex-start' }}>
                  <TextField
                    label="Field Label"
                    value={field.label}
                    onChange={(e) => handleUpdateCustomFieldDraft(index, { label: e.target.value })}
                    fullWidth
                    required
                  />
                  <FormControl sx={{ minWidth: 180 }}>
                    <InputLabel>Type</InputLabel>
                    <Select
                      value={field.field_type || 'text'}
                      label="Type"
                      onChange={(e) => handleUpdateCustomFieldDraft(index, { field_type: e.target.value })}
                    >
                      {CUSTOM_FIELD_TYPES.map((typeOption) => (
                        <MenuItem key={typeOption.value} value={typeOption.value}>
                          {typeOption.label}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Tooltip title="Remove field">
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveCustomFieldDraft(index)}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>

                {field.field_type === 'dropdown' && (
                  <TextField
                    label="Dropdown Options"
                    placeholder="Option 1, Option 2, Option 3"
                    value={field.options_input || ''}
                    onChange={(e) => handleUpdateCustomFieldDraft(index, { options_input: e.target.value })}
                    helperText="Comma separated values"
                    fullWidth
                  />
                )}

                <FormControlLabel
                  control={(
                    <Switch
                      checked={field.required === true}
                      onChange={(e) => handleUpdateCustomFieldDraft(index, { required: e.target.checked })}
                    />
                  )}
                  label="Mandatory"
                />
              </Box>
            ))}

            {editingItem && (
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                {existingCustomFieldEntries.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No custom fields configured for this checklist item.
                  </Typography>
                ) : (
                  existingCustomFieldEntries.map(({ field }) => (
                    <Box
                      key={`existing-custom-field-${field.id}`}
                      sx={{ border: '1px solid #e2e8f0', borderRadius: 1, p: 1.5, display: 'flex', flexDirection: 'column', gap: 1.5 }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {field.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {CUSTOM_FIELD_TYPES.find((typeOption) => typeOption.value === field.field_type)?.label || field.field_type}
                            {field.required ? ' | Mandatory' : ' | Optional'}
                          </Typography>
                        </Box>
                        <Chip
                          size="small"
                          label={field.disabled_from ? `Disabled from ${field.disabled_from}` : 'Active'}
                          color={field.disabled_from ? 'default' : 'success'}
                          variant={field.disabled_from ? 'outlined' : 'filled'}
                        />
                      </Box>

                      {field.field_type === 'dropdown' && (
                        <Typography variant="caption" color="text.secondary">
                          Options: {(field.options || []).join(', ') || '-'}
                        </Typography>
                      )}

                      {!field.disabled_from && (
                        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', flexWrap: 'wrap' }}>
                          <TextField
                            size="small"
                            label="Apply from date"
                            type="date"
                            InputLabelProps={{ shrink: true }}
                            value={customFieldDisableDates[field.id] || new Date().toISOString().split('T')[0]}
                            onChange={(e) =>
                              setCustomFieldDisableDates((prev) => ({
                                ...prev,
                                [field.id]: e.target.value
                              }))
                            }
                            sx={{ maxWidth: 220 }}
                          />
                          <Button
                            size="small"
                            color="warning"
                            variant="outlined"
                            disabled={deactivatingFieldId === field.id}
                            onClick={() => handleDeactivateCustomField(field.id)}
                          >
                            {deactivatingFieldId === field.id ? 'Applying...' : 'Disable For Future'}
                          </Button>
                        </Box>
                      )}
                    </Box>
                  ))
                )}
              </Box>
            )}

            <Box sx={{ display: 'flex', gap: 2 }}>
              <FormControlLabel
                control={
                  <Switch
                    checked={itemForm.remarks_required}
                    onChange={(e) => setItemForm({ ...itemForm, remarks_required: e.target.checked })}
                  />
                }
                label="Remarks Required"
              />
              <FormControlLabel
                control={
                  <Switch
                    checked={itemForm.is_active}
                    onChange={(e) => setItemForm({ ...itemForm, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button 
            variant="contained" 
            onClick={handleSaveItem}
            disabled={saving}
          >
            {saving ? <CircularProgress size={20} /> : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Manage Categories</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
            <TextField
              label="New Category Name"
              fullWidth
              size="small"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
            />
            <Button variant="contained" onClick={handleSaveCategory} disabled={saving}>
              Add
            </Button>
          </Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>Existing Categories:</Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {categories.map((cat) => (
              <Chip key={cat.id} label={cat.name} />
            ))}
            {categories.length === 0 && (
              <Typography color="text.secondary">No categories yet</Typography>
            )}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>

      {/* Settings Dialog */}
      <Dialog open={settingsDialogOpen} onClose={() => setSettingsDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Workspace Checklist Settings</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="Daily Reminder Time"
              type="time"
              fullWidth
              value={settingsForm.daily_reminder_time || '09:00'}
              onChange={(e) => setSettingsForm({ ...settingsForm, daily_reminder_time: e.target.value })}
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Weekly Reminder Day"
              select
              fullWidth
              value={settingsForm.weekly_reminder_day || 3}
              onChange={(e) => setSettingsForm({ ...settingsForm, weekly_reminder_day: Number(e.target.value) })}
            >
              <MenuItem value={1}>Monday</MenuItem>
              <MenuItem value={2}>Tuesday</MenuItem>
              <MenuItem value={3}>Wednesday</MenuItem>
              <MenuItem value={4}>Thursday</MenuItem>
              <MenuItem value={5}>Friday</MenuItem>
              <MenuItem value={6}>Saturday</MenuItem>
              <MenuItem value={7}>Sunday</MenuItem>
            </TextField>
            <TextField
              label="Monthly Reminder Day"
              type="number"
              fullWidth
              value={settingsForm.monthly_reminder_day || 25}
              onChange={(e) => setSettingsForm({ ...settingsForm, monthly_reminder_day: parseInt(e.target.value) })}
              InputProps={{ inputProps: { min: 1, max: 28 } }}
              helperText="Day of month to send monthly reminders (1-28)"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settingsForm.auto_mark_missed ?? true}
                  onChange={(e) => setSettingsForm({ ...settingsForm, auto_mark_missed: e.target.checked })}
                />
              }
              label="Auto-mark as missed when deadline passes"
            />
            <FormControlLabel
              control={
                <Switch
                  checked={settingsForm.allow_late_confirmation ?? true}
                  onChange={(e) => setSettingsForm({ ...settingsForm, allow_late_confirmation: e.target.checked })}
                />
              }
              label="Allow late confirmation (admin only)"
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSettingsDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSaveSettings} disabled={saving}>
            {saving ? <CircularProgress size={20} /> : 'Save Settings'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ChecklistItemManager;

