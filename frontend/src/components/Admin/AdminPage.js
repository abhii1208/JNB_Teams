import React, { useState, useEffect } from 'react';
import {
  Box,
  Tab,
  Tabs,
  Typography,
  Paper,
  Alert,
} from '@mui/material';
import AdminProjectsTab from './AdminProjectsTab';
import AdminTeamTab from './AdminTeamTab';
import AdminDateRangeControl from './AdminDateRangeControl';
import AdminShareLinksTab from './AdminShareLinksTab';
import AdminManagerDashboardTab from './AdminManagerDashboardTab';
import WorklogsPage from '../Worklogs/WorklogsPage';

function AdminPage({ workspace, user }) {

  const [activeTab, setActiveTab] = useState(0);
  // Separate state for preset and for from/to
  const [preset, setPreset] = useState('last30');
  const [dateRange, setDateRange] = useState(() => {
    const today = new Date();
    let from = new Date(today);
    from.setDate(from.getDate() - 30);
    return { preset: 'last30', from, to: today };
  });

  // Check if user has admin access
  const hasAdminAccess = workspace?.role === 'Owner' || workspace?.role === 'Admin';

  useEffect(() => {
    const today = new Date();
    let from = null;
    let to = new Date(today);

    if (preset === 'last7') {
      from = new Date(today);
      from.setDate(from.getDate() - 7);
    } else if (preset === 'last30') {
      from = new Date(today);
      from.setDate(from.getDate() - 30);
    } else if (preset === 'last90') {
      from = new Date(today);
      from.setDate(from.getDate() - 90);
    }
    // Only update if not custom
    if (preset !== 'custom') {
      setDateRange({ preset, from, to });
    }
  }, [preset]);

  // Handler for date range change (from AdminDateRangeControl)
  const handleDateRangeChange = (newRange) => {
    if (newRange.preset === 'custom') {
      setDateRange(newRange);
      setPreset('custom');
    } else {
      setPreset(newRange.preset);
    }
  };

  if (!workspace) {
    return (
      <Box sx={{ p: 4 }}>
        <Alert severity="error">No workspace selected</Alert>
      </Box>
    );
  }

  if (!hasAdminAccess) {
    return (
      <Box sx={{ p: 6, maxWidth: 600 }}>
        <Alert severity="warning">
          <Typography variant="h6" gutterBottom>
            Access Restricted
          </Typography>
          <Typography variant="body2">
            The Admin module is only available to Workspace Owners and Admins. 
            Please contact your workspace administrator if you need access.
          </Typography>
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <Box sx={{ p: 3, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h4" sx={{ fontWeight: 700 }}>
            Admin Dashboard
          </Typography>
          <AdminDateRangeControl dateRange={dateRange} onDateRangeChange={handleDateRangeChange} />
        </Box>
        
        <Typography variant="body2" color="text.secondary">
          View-only analytics for workspace performance and team metrics
        </Typography>
      </Box>

      {/* Tabs */}
      <Paper sx={{ borderBottom: 1, borderColor: 'divider', borderRadius: 0 }} elevation={0}>
        <Tabs
          value={activeTab}
          onChange={(e, newValue) => setActiveTab(newValue)}
          sx={{
            px: 2,
            '& .MuiTab-root': {
              textTransform: 'none',
              fontSize: '1rem',
              fontWeight: 600,
              minHeight: 56,
            },
          }}
        >
          <Tab label="Projects" />
          <Tab label="Team" />
          <Tab label="Manager" />
          <Tab label="Worklogs" />
          <Tab label="Links" />
        </Tabs>
      </Paper>

      {/* Tab Content */}
      <Box sx={{ flex: 1, overflow: 'auto', p: 3 }}>
        {activeTab === 0 && (
          <AdminProjectsTab workspace={workspace} dateRange={dateRange} />
        )}
        {activeTab === 1 && (
          <AdminTeamTab workspace={workspace} dateRange={dateRange} />
        )}
        {activeTab === 2 && (
          <AdminManagerDashboardTab workspace={workspace} dateRange={dateRange} />
        )}
        {activeTab === 3 && (
          <WorklogsPage workspace={workspace} />
        )}
        {activeTab === 4 && (
          <AdminShareLinksTab workspace={workspace} />
        )}
      </Box>
    </Box>
  );
}

export default AdminPage;
