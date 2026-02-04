import React, { useState } from 'react';
import {
  Box,
  Button,
  Menu,
  MenuItem,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
} from '@mui/material';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import { formatShortDateIST } from '../../utils/dateUtils';

function AdminDateRangeControl({ dateRange, onDateRangeChange }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [customDialogOpen, setCustomDialogOpen] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const presets = [
    { value: 'last7', label: 'Last 7 days' },
    { value: 'last30', label: 'Last 30 days' },
    { value: 'last90', label: 'Last 90 days' },
    { value: 'custom', label: 'Custom range...' },
  ];

  const handlePresetSelect = (preset) => {
    if (preset === 'custom') {
      setCustomDialogOpen(true);
    } else {
      onDateRangeChange({ preset, from: null, to: null });
    }
    setAnchorEl(null);
  };

  const handleCustomApply = () => {
    if (customFrom && customTo) {
      onDateRangeChange({ preset: 'custom', from: customFrom, to: customTo });
      setCustomDialogOpen(false);
    }
  };

  const formatDateRange = () => {
    if (dateRange.preset === 'custom' && dateRange.from && dateRange.to) {
      return `${formatShortDateIST(dateRange.from)} - ${formatShortDateIST(dateRange.to)}`;
    }
    const preset = presets.find(p => p.value === dateRange.preset);
    return preset?.label || 'Last 30 days';
  };

  return (
    <>
      <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
        <Chip
          icon={<CalendarTodayIcon />}
          label={formatDateRange()}
          onClick={(e) => setAnchorEl(e.currentTarget)}
          onDelete={(e) => setAnchorEl(e.currentTarget)}
          deleteIcon={<KeyboardArrowDownIcon />}
          sx={{
            fontSize: '0.875rem',
            fontWeight: 500,
            px: 1,
            '& .MuiChip-deleteIcon': {
              color: 'inherit',
            },
          }}
        />
      </Box>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        PaperProps={{
          sx: { minWidth: 200 },
        }}
      >
        {presets.map(preset => (
          <MenuItem
            key={preset.value}
            onClick={() => handlePresetSelect(preset.value)}
            selected={dateRange.preset === preset.value}
          >
            {preset.label}
          </MenuItem>
        ))}
      </Menu>

      <Dialog open={customDialogOpen} onClose={() => setCustomDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Custom Date Range</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
            <TextField
              label="From"
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
            <TextField
              label="To"
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              fullWidth
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCustomDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCustomApply} variant="contained" disabled={!customFrom || !customTo}>
            Apply
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export default AdminDateRangeControl;
