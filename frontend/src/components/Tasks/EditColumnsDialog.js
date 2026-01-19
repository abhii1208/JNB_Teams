import React, { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  List,
  ListItem,
  ListItemText,
  Checkbox,
  IconButton,
  Typography,
  Box,
  Divider,
  Tooltip,
  Switch,
  FormControlLabel,
  Chip,
} from '@mui/material';
import {
  KeyboardArrowUp as MoveUpIcon,
  KeyboardArrowDown as MoveDownIcon,
  ViewColumn as ColumnIcon,
  Visibility as VisibleIcon,
  VisibilityOff as HiddenIcon,
  RestartAlt as ResetIcon,
} from '@mui/icons-material';

// Default columns available in the Tasks table
const ALL_COLUMNS = [
  { id: 'name', label: 'Task Name', required: true, defaultVisible: true },
  { id: 'project_name', label: 'Project', required: false, defaultVisible: true },
  { id: 'client_name', label: 'Client', required: false, defaultVisible: true },
  { id: 'stage', label: 'Stage', required: false, defaultVisible: true },
  { id: 'status', label: 'Status', required: false, defaultVisible: true },
  { id: 'priority', label: 'Priority', required: false, defaultVisible: true },
  { id: 'assignee_name', label: 'Assignee', required: false, defaultVisible: true },
  { id: 'collaborators', label: 'Collaborators', required: false, defaultVisible: false },
  { id: 'due_date', label: 'Due Date', required: false, defaultVisible: true },
  { id: 'target_date', label: 'Target Date', required: false, defaultVisible: false },
  { id: 'created_by_name', label: 'Created By', required: false, defaultVisible: false },
  { id: 'created_at', label: 'Created At', required: false, defaultVisible: false },
  { id: 'notes', label: 'Notes', required: false, defaultVisible: false },
  // New custom columns
  { id: 'category', label: 'Category', required: false, defaultVisible: false, custom: true },
  { id: 'section', label: 'Section', required: false, defaultVisible: false, custom: true },
  { id: 'estimated_hours', label: 'Est. Hours', required: false, defaultVisible: false, custom: true },
  { id: 'actual_hours', label: 'Actual Hours', required: false, defaultVisible: false, custom: true },
  { id: 'completion_percentage', label: 'Completion %', required: false, defaultVisible: false, custom: true },
  { id: 'tags', label: 'Tags', required: false, defaultVisible: false, custom: true },
  { id: 'external_id', label: 'External ID', required: false, defaultVisible: false, custom: true },
];

// Default column order for reset
const DEFAULT_COLUMN_ORDER = ALL_COLUMNS.map(c => c.id);
const DEFAULT_VISIBLE_COLUMNS = ALL_COLUMNS.filter(c => c.defaultVisible).map(c => c.id);

export default function EditColumnsDialog({
  open,
  onClose,
  visibleColumns = DEFAULT_VISIBLE_COLUMNS,
  columnOrder = DEFAULT_COLUMN_ORDER,
  onSave,
  enabledProjectColumns = {}, // Which custom columns are enabled for any selected project
}) {
  const [localVisible, setLocalVisible] = useState(visibleColumns);
  const [localOrder, setLocalOrder] = useState(columnOrder);
  const [showOnlyVisible, setShowOnlyVisible] = useState(false);

  // Reset local state when dialog opens
  useEffect(() => {
    if (open) {
      setLocalVisible(visibleColumns);
      // Merge any missing columns into the order
      const existingIds = new Set(columnOrder);
      const missingColumns = ALL_COLUMNS.filter(c => !existingIds.has(c.id)).map(c => c.id);
      setLocalOrder([...columnOrder, ...missingColumns]);
    }
  }, [open, visibleColumns, columnOrder]);

  // Get column metadata by id
  const getColumnById = useCallback((id) => {
    return ALL_COLUMNS.find(c => c.id === id) || { id, label: id, required: false };
  }, []);

  // Check if a custom column is enabled in any project
  const isCustomColumnEnabled = useCallback((columnId) => {
    const column = getColumnById(columnId);
    if (!column.custom) return true; // Non-custom columns are always available
    
    // Check if this column type is enabled in the enabledProjectColumns
    const settingKey = `enable_${columnId}`;
    return enabledProjectColumns[settingKey] === true;
  }, [getColumnById, enabledProjectColumns]);

  // Toggle column visibility
  const handleToggleColumn = (columnId) => {
    const column = getColumnById(columnId);
    if (column.required) return; // Can't hide required columns
    
    setLocalVisible(prev => {
      if (prev.includes(columnId)) {
        return prev.filter(id => id !== columnId);
      } else {
        return [...prev, columnId];
      }
    });
  };

  // Move column up in order
  const handleMoveUp = (columnId) => {
    const index = localOrder.indexOf(columnId);
    if (index <= 0) return;
    
    const newOrder = [...localOrder];
    [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
    setLocalOrder(newOrder);
  };

  // Move column down in order
  const handleMoveDown = (columnId) => {
    const index = localOrder.indexOf(columnId);
    if (index < 0 || index >= localOrder.length - 1) return;
    
    const newOrder = [...localOrder];
    [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
    setLocalOrder(newOrder);
  };

  // Show all columns
  const handleShowAll = () => {
    const allIds = ALL_COLUMNS.filter(c => isCustomColumnEnabled(c.id)).map(c => c.id);
    setLocalVisible(allIds);
  };

  // Show only default columns
  const handleShowDefault = () => {
    setLocalVisible(DEFAULT_VISIBLE_COLUMNS.filter(id => isCustomColumnEnabled(id)));
  };

  // Reset to defaults (visibility and order)
  const handleReset = () => {
    setLocalVisible(DEFAULT_VISIBLE_COLUMNS.filter(id => isCustomColumnEnabled(id)));
    setLocalOrder([...DEFAULT_COLUMN_ORDER]);
  };

  // Save and close
  const handleSave = () => {
    onSave({
      visibleColumns: localVisible,
      columnOrder: localOrder,
    });
    onClose();
  };

  // Get display columns based on filter
  const displayColumns = showOnlyVisible
    ? localOrder.filter(id => localVisible.includes(id))
    : localOrder;

  const visibleCount = localVisible.length;
  const totalCount = ALL_COLUMNS.filter(c => isCustomColumnEnabled(c.id)).length;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{ sx: { maxHeight: '80vh' } }}
    >
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <ColumnIcon color="primary" />
        Edit Columns
        <Chip 
          label={`${visibleCount}/${totalCount} visible`}
          size="small"
          sx={{ ml: 'auto' }}
        />
      </DialogTitle>
      
      <Box sx={{ px: 3, pb: 1 }}>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', alignItems: 'center' }}>
          <Button size="small" onClick={handleShowAll}>
            Show All
          </Button>
          <Button size="small" onClick={handleShowDefault}>
            Show Default
          </Button>
          <Tooltip title="Reset to default visibility and order">
            <IconButton size="small" onClick={handleReset}>
              <ResetIcon />
            </IconButton>
          </Tooltip>
          <FormControlLabel
            control={
              <Switch
                size="small"
                checked={showOnlyVisible}
                onChange={(e) => setShowOnlyVisible(e.target.checked)}
              />
            }
            label="Show visible only"
            sx={{ ml: 'auto' }}
          />
        </Box>
      </Box>
      
      <Divider />
      
      <DialogContent sx={{ p: 0 }}>
        <Typography 
          variant="caption" 
          color="text.secondary" 
          sx={{ px: 2, py: 1, display: 'block' }}
        >
          Use arrows to reorder • Click checkbox to show/hide
        </Typography>
        
        <List dense sx={{ pt: 0 }}>
          {displayColumns.map((columnId, index) => {
            const column = getColumnById(columnId);
            const isVisible = localVisible.includes(columnId);
            const isEnabled = isCustomColumnEnabled(columnId);
            
            if (!isEnabled) return null;
            
            const isFirst = index === 0;
            const isLast = index === displayColumns.length - 1;
            
            return (
              <ListItem
                key={columnId}
                sx={{
                  opacity: isVisible ? 1 : 0.6,
                  borderLeft: column.custom ? '3px solid' : 'none',
                  borderLeftColor: column.custom ? 'secondary.main' : 'transparent',
                }}
                secondaryAction={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <Tooltip title="Move up">
                      <span>
                        <IconButton 
                          size="small" 
                          onClick={() => handleMoveUp(columnId)}
                          disabled={isFirst || column.required}
                        >
                          <MoveUpIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Move down">
                      <span>
                        <IconButton 
                          size="small" 
                          onClick={() => handleMoveDown(columnId)}
                          disabled={isLast || column.required}
                        >
                          <MoveDownIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Checkbox
                      edge="end"
                      checked={isVisible}
                      disabled={column.required}
                      onChange={() => handleToggleColumn(columnId)}
                      icon={<HiddenIcon />}
                      checkedIcon={<VisibleIcon />}
                    />
                  </Box>
                }
              >
                <ListItemText
                  primary={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      {column.label}
                      {column.required && (
                        <Chip label="Required" size="small" variant="outlined" />
                      )}
                      {column.custom && (
                        <Chip label="Custom" size="small" color="secondary" variant="outlined" />
                      )}
                    </Box>
                  }
                />
              </ListItem>
            );
          })}
        </List>
        
        {/* Info about custom columns */}
        <Box sx={{ px: 2, py: 1, bgcolor: 'action.hover' }}>
          <Typography variant="caption" color="text.secondary">
            <strong>Custom columns</strong> (Category, Section, etc.) must be enabled in 
            Project Settings before they appear in tasks. Only Project Owners can manage 
            custom column options.
          </Typography>
        </Box>
      </DialogContent>
      
      <Divider />
      
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained">
          Save Column Settings
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Export column utilities for use in other components
export { ALL_COLUMNS, DEFAULT_COLUMN_ORDER, DEFAULT_VISIBLE_COLUMNS };
