import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Button,
  IconButton,
  TextField,
  Switch,
  FormControlLabel,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Divider,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Tooltip,
  Paper,
  Collapse,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CategoryIcon from '@mui/icons-material/Category';
import ViewModuleIcon from '@mui/icons-material/ViewModule';

import {
  getProjectColumnOptions,
  createProjectColumnOption,
  updateProjectColumnOption,
  deleteProjectColumnOption,
  getCopyableProjects,
  copyColumnOptionsFromProject,
  getProjectColumnSettings,
  updateProjectColumnSettings,
} from '../../apiClient';

// Column type definitions
const COLUMN_TYPES = [
  { 
    id: 'category', 
    label: 'Category', 
    description: 'Categorize tasks by type or department',
    icon: <CategoryIcon />,
    color: '#4338ca',
    bgColor: '#e0e7ff',
  },
  { 
    id: 'section', 
    label: 'Section', 
    description: 'Group tasks into sections or phases',
    icon: <ViewModuleIcon />,
    color: '#be185d',
    bgColor: '#fce7f3',
  },
];

// Additional custom columns that can be enabled/disabled
const ADDITIONAL_COLUMNS = [
  { id: 'estimated_hours', label: 'Estimated Hours', description: 'Track estimated time for tasks' },
  { id: 'actual_hours', label: 'Actual Hours', description: 'Track actual time spent on tasks' },
  { id: 'completion_percentage', label: 'Completion %', description: 'Show task progress as percentage' },
  { id: 'tags', label: 'Tags', description: 'Add tags for filtering and organization' },
  { id: 'external_id', label: 'External ID', description: 'Link to external systems (Jira, etc.)' },
];

export default function CustomColumnSettings({ 
  projectId, 
  userRole,
  onSettingsChange,
}) {
  const isOwner = userRole === 'Owner';
  
  // State for column options (Category/Section dropdown values)
  const [columnOptions, setColumnOptions] = useState({ category: [], section: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // State for column settings (enable/disable)
  const [columnSettings, setColumnSettings] = useState({
    enable_category: false,
    enable_section: false,
    enable_estimated_hours: false,
    enable_actual_hours: false,
    enable_completion_percentage: false,
    enable_tags: false,
    enable_external_id: false,
  });
  
  // UI state
  const [expandedType, setExpandedType] = useState(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [currentColumnType, setCurrentColumnType] = useState('category');
  const [editingOption, setEditingOption] = useState(null);
  const [newOptionValue, setNewOptionValue] = useState('');
  const [newOptionColor, setNewOptionColor] = useState('#6366f1');
  
  // Copy state
  const [copyableProjects, setCopyableProjects] = useState([]);
  const [selectedSourceProject, setSelectedSourceProject] = useState('');
  const [copyStrategy, setCopyStrategy] = useState('merge');
  const [copyColumnTypes, setCopyColumnTypes] = useState(['category', 'section']);
  
  // Saving state
  const [saving, setSaving] = useState(false);

  const normalizeOptions = (res, columnType) => {
    const data = res?.data;
    if (Array.isArray(data)) return data;
    if (Array.isArray(data?.grouped?.[columnType])) return data.grouped[columnType];
    if (Array.isArray(data?.options)) {
      return data.options.filter((option) => option.column_name === columnType);
    }
    return [];
  };

  // Fetch column options and settings
  const fetchData = useCallback(async () => {
    if (!projectId) return;
    
    setLoading(true);
    setError(null);
    
    try {
      // Fetch column options for both types
      const [categoryRes, sectionRes, settingsRes] = await Promise.all([
        getProjectColumnOptions(projectId, 'category'),
        getProjectColumnOptions(projectId, 'section'),
        getProjectColumnSettings(projectId),
      ]);
      
      const categoryOptions = normalizeOptions(categoryRes, 'category');
      const sectionOptions = normalizeOptions(sectionRes, 'section');

      setColumnOptions({
        category: categoryOptions,
        section: sectionOptions,
      });
      
      if (settingsRes.data) {
        setColumnSettings(settingsRes.data);
      }
    } catch (err) {
      console.error('Failed to fetch column data:', err);
      setError('Failed to load column settings');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle toggle column enabled/disabled
  const handleToggleColumn = async (columnKey) => {
    if (!isOwner) return;
    
    const newSettings = {
      ...columnSettings,
      [columnKey]: !columnSettings[columnKey],
    };
    
    setSaving(true);
    try {
      await updateProjectColumnSettings(projectId, newSettings);
      setColumnSettings(newSettings);
      onSettingsChange?.(newSettings);
    } catch (err) {
      console.error('Failed to update column settings:', err);
      setError('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  // Handle add new option
  const handleAddOption = async () => {
    if (!newOptionValue.trim() || !isOwner) return;
    
    setSaving(true);
    try {
      await createProjectColumnOption(projectId, {
        column_name: currentColumnType,
        option_value: newOptionValue.trim(),
        color: newOptionColor,
      });
      
      await fetchData();
      setAddDialogOpen(false);
      setNewOptionValue('');
    } catch (err) {
      console.error('Failed to add option:', err);
      setError('Failed to add option');
    } finally {
      setSaving(false);
    }
  };

  // Handle edit option
  const handleEditOption = async () => {
    if (!editingOption || !newOptionValue.trim() || !isOwner) return;
    
    setSaving(true);
    try {
      await updateProjectColumnOption(projectId, editingOption.id, {
        option_value: newOptionValue.trim(),
        color: newOptionColor,
      });
      
      await fetchData();
      setEditDialogOpen(false);
      setEditingOption(null);
      setNewOptionValue('');
    } catch (err) {
      console.error('Failed to update option:', err);
      setError('Failed to update option');
    } finally {
      setSaving(false);
    }
  };

  // Handle delete option
  const handleDeleteOption = async (optionId) => {
    if (!isOwner) return;
    
    if (!window.confirm('Are you sure you want to delete this option? Tasks using this value will retain the value but it won\'t appear in dropdowns.')) {
      return;
    }
    
    setSaving(true);
    try {
      await deleteProjectColumnOption(projectId, optionId);
      await fetchData();
    } catch (err) {
      console.error('Failed to delete option:', err);
      setError('Failed to delete option');
    } finally {
      setSaving(false);
    }
  };

  // Open copy dialog and fetch copyable projects
  const handleOpenCopyDialog = async () => {
    try {
      const res = await getCopyableProjects(projectId);
      setCopyableProjects(res.data || []);
      setCopyDialogOpen(true);
    } catch (err) {
      console.error('Failed to fetch copyable projects:', err);
      setError('Failed to load projects');
    }
  };

  // Handle copy from another project
  const handleCopyOptions = async () => {
    if (!selectedSourceProject || !isOwner) return;
    
    setSaving(true);
    try {
      await copyColumnOptionsFromProject(projectId, selectedSourceProject, copyColumnTypes, copyStrategy);
      await fetchData();
      setCopyDialogOpen(false);
      setSelectedSourceProject('');
    } catch (err) {
      console.error('Failed to copy options:', err);
      setError('Failed to copy options');
    } finally {
      setSaving(false);
    }
  };

  // Open add dialog
  const openAddDialog = (columnType) => {
    setCurrentColumnType(columnType);
    setNewOptionValue('');
    setNewOptionColor(COLUMN_TYPES.find(t => t.id === columnType)?.color || '#6366f1');
    setAddDialogOpen(true);
  };

  // Open edit dialog
  const openEditDialog = (option, columnType) => {
    setCurrentColumnType(columnType);
    setEditingOption(option);
    setNewOptionValue(option.option_value);
    setNewOptionColor(option.color || '#6366f1');
    setEditDialogOpen(true);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress size={32} />
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

      {!isOwner && (
        <Alert severity="info" sx={{ mb: 2 }}>
          Only the Project Owner can manage custom column settings.
        </Alert>
      )}

      {/* Category and Section columns with dropdown value management */}
      <Typography variant="h6" sx={{ mb: 2 }}>Custom Dropdown Columns</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Create Category and Section dropdown options that team members can use when creating or editing tasks.
      </Typography>

      {COLUMN_TYPES.map((colType) => {
        const isExpanded = expandedType === colType.id;
        const isEnabled = columnSettings[`enable_${colType.id}`];
        const options = Array.isArray(columnOptions[colType.id]) ? columnOptions[colType.id] : [];

        return (
          <Paper key={colType.id} sx={{ mb: 2, overflow: 'hidden' }}>
            {/* Header */}
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                p: 2,
                cursor: 'pointer',
                bgcolor: isEnabled ? colType.bgColor : 'grey.50',
                '&:hover': { bgcolor: isEnabled ? colType.bgColor : 'grey.100' },
              }}
              onClick={() => setExpandedType(isExpanded ? null : colType.id)}
            >
              <Box sx={{ color: colType.color, mr: 2 }}>
                {colType.icon}
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="subtitle1" fontWeight={600}>
                  {colType.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {colType.description}
                </Typography>
              </Box>
              <FormControlLabel
                control={
                  <Switch
                    checked={isEnabled}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleColumn(`enable_${colType.id}`);
                    }}
                    disabled={!isOwner || saving}
                  />
                }
                label=""
                onClick={(e) => e.stopPropagation()}
                sx={{ mr: 1 }}
              />
              <Chip 
                label={`${options.length} options`} 
                size="small" 
                sx={{ mr: 1 }}
              />
              <IconButton size="small">
                {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
              </IconButton>
            </Box>

            {/* Expanded content */}
            <Collapse in={isExpanded}>
              <Divider />
              <Box sx={{ p: 2 }}>
                {!isEnabled ? (
                  <Alert severity="info" sx={{ mb: 2 }}>
                    Enable this column to manage dropdown options.
                  </Alert>
                ) : (
                  <>
                    {/* Options list */}
                    {options.length === 0 ? (
                      <Typography variant="body2" color="text.secondary" sx={{ py: 2, textAlign: 'center' }}>
                        No options defined yet. Add your first {colType.label.toLowerCase()} option below.
                      </Typography>
                    ) : (
                      <List dense sx={{ mb: 2 }}>
                        {options.map((option) => (
                          <ListItem
                            key={option.id}
                            sx={{
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              mb: 1,
                            }}
                          >
                            <Box
                              sx={{
                                width: 12,
                                height: 12,
                                borderRadius: '50%',
                                bgcolor: option.color || colType.color,
                                mr: 2,
                              }}
                            />
                            <ListItemText
                              primary={option.option_value}
                              secondary={option.usage_count ? `Used in ${option.usage_count} tasks` : 'Not used yet'}
                            />
                            <ListItemSecondaryAction>
                              <Tooltip title="Edit">
                                <IconButton
                                  size="small"
                                  onClick={() => openEditDialog(option, colType.id)}
                                  disabled={!isOwner}
                                >
                                  <EditIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                              <Tooltip title="Delete">
                                <IconButton
                                  size="small"
                                  onClick={() => handleDeleteOption(option.id)}
                                  disabled={!isOwner}
                                >
                                  <DeleteIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </ListItemSecondaryAction>
                          </ListItem>
                        ))}
                      </List>
                    )}

                    {/* Add button */}
                    {isOwner && (
                      <Button
                        startIcon={<AddIcon />}
                        onClick={() => openAddDialog(colType.id)}
                        variant="outlined"
                        size="small"
                      >
                        Add {colType.label} Option
                      </Button>
                    )}
                  </>
                )}
              </Box>
            </Collapse>
          </Paper>
        );
      })}

      {/* Copy from another project */}
      {isOwner && (
        <Box sx={{ mb: 4 }}>
          <Button
            startIcon={<ContentCopyIcon />}
            onClick={handleOpenCopyDialog}
            variant="text"
            size="small"
          >
            Copy options from another project
          </Button>
        </Box>
      )}

      <Divider sx={{ my: 4 }} />

      {/* Additional columns toggle section */}
      <Typography variant="h6" sx={{ mb: 2 }}>Additional Task Fields</Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Enable additional fields for tracking time, progress, and external references.
      </Typography>

      {ADDITIONAL_COLUMNS.map((col) => {
        const isEnabled = columnSettings[`enable_${col.id}`];
        
        return (
          <FormControlLabel
            key={col.id}
            control={
              <Switch
                checked={isEnabled}
                onChange={() => handleToggleColumn(`enable_${col.id}`)}
                disabled={!isOwner || saving}
              />
            }
            label={
              <Box>
                <Typography variant="body2" fontWeight={500}>
                  {col.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {col.description}
                </Typography>
              </Box>
            }
            sx={{ mb: 2, alignItems: 'flex-start', display: 'flex' }}
          />
        );
      })}

      {/* Add Option Dialog */}
      <Dialog open={addDialogOpen} onClose={() => setAddDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Add {COLUMN_TYPES.find(t => t.id === currentColumnType)?.label} Option
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Option Value"
            value={newOptionValue}
            onChange={(e) => setNewOptionValue(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
            placeholder={`Enter ${currentColumnType} name...`}
          />
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Color (optional)
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6b7280'].map(
                (color) => (
                  <Box
                    key={color}
                    onClick={() => setNewOptionColor(color)}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: color,
                      cursor: 'pointer',
                      border: newOptionColor === color ? '3px solid #000' : '2px solid transparent',
                      '&:hover': { opacity: 0.8 },
                    }}
                  />
                )
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAddDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleAddOption} 
            variant="contained" 
            disabled={!newOptionValue.trim() || saving}
          >
            {saving ? 'Adding...' : 'Add Option'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Option Dialog */}
      <Dialog open={editDialogOpen} onClose={() => setEditDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          Edit {COLUMN_TYPES.find(t => t.id === currentColumnType)?.label} Option
        </DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Option Value"
            value={newOptionValue}
            onChange={(e) => setNewOptionValue(e.target.value)}
            sx={{ mt: 2, mb: 2 }}
          />
          <Box sx={{ mb: 2 }}>
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Color
            </Typography>
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              {['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#0ea5e9', '#6b7280'].map(
                (color) => (
                  <Box
                    key={color}
                    onClick={() => setNewOptionColor(color)}
                    sx={{
                      width: 28,
                      height: 28,
                      borderRadius: '50%',
                      bgcolor: color,
                      cursor: 'pointer',
                      border: newOptionColor === color ? '3px solid #000' : '2px solid transparent',
                      '&:hover': { opacity: 0.8 },
                    }}
                  />
                )
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setEditDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleEditOption} 
            variant="contained" 
            disabled={!newOptionValue.trim() || saving}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Copy Options Dialog */}
      <Dialog open={copyDialogOpen} onClose={() => setCopyDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Copy Options from Another Project</DialogTitle>
        <DialogContent>
          <Alert severity="info" sx={{ mb: 2 }}>
            You can only copy from projects where you are the Owner.
          </Alert>
          
          <FormControl fullWidth sx={{ mb: 2, mt: 1 }}>
            <InputLabel>Source Project</InputLabel>
            <Select
              value={selectedSourceProject}
              onChange={(e) => setSelectedSourceProject(e.target.value)}
              label="Source Project"
            >
              {copyableProjects.map((project) => (
                <MenuItem key={project.id} value={project.id}>
                  {project.name}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          <Typography variant="body2" fontWeight={500} sx={{ mb: 1 }}>
            Column types to copy:
          </Typography>
          <Box sx={{ display: 'flex', gap: 1, mb: 2 }}>
            {COLUMN_TYPES.map((type) => (
              <Chip
                key={type.id}
                label={type.label}
                onClick={() => {
                  setCopyColumnTypes(prev =>
                    prev.includes(type.id)
                      ? prev.filter(t => t !== type.id)
                      : [...prev, type.id]
                  );
                }}
                color={copyColumnTypes.includes(type.id) ? 'primary' : 'default'}
                variant={copyColumnTypes.includes(type.id) ? 'filled' : 'outlined'}
              />
            ))}
          </Box>

          <FormControl fullWidth sx={{ mb: 2 }}>
            <InputLabel>Copy Strategy</InputLabel>
            <Select
              value={copyStrategy}
              onChange={(e) => setCopyStrategy(e.target.value)}
              label="Copy Strategy"
            >
              <MenuItem value="merge">Merge - Add to existing options</MenuItem>
              <MenuItem value="replace">Replace - Remove existing and copy all</MenuItem>
            </Select>
          </FormControl>

          {copyStrategy === 'replace' && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              This will delete all existing options and replace them with the source project's options.
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCopyDialogOpen(false)}>Cancel</Button>
          <Button
            onClick={handleCopyOptions}
            variant="contained"
            disabled={!selectedSourceProject || copyColumnTypes.length === 0 || saving}
          >
            {saving ? 'Copying...' : 'Copy Options'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
