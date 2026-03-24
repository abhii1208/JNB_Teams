/**
 * ChecklistPage - Main container for Monthly Client Checklist
 * Provides grid view, daily focus, and management tabs
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Typography,
  Tabs,
  Tab,
  Card,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Button,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import TodayIcon from '@mui/icons-material/Today';
import ListAltIcon from '@mui/icons-material/ListAlt';
import PeopleIcon from '@mui/icons-material/People';
import { getClients, getUserAssignedClients } from '../../apiClient';
import ChecklistGrid from './ChecklistGrid';
import DailyFocusView from './DailyFocusView';
import ChecklistItemManager from './ChecklistItemManager';
import HolidayManager from './HolidayManager';
import ClientUserAssignments from './ClientUserAssignments';

function ChecklistPage({ workspace, user }) {
  const TAB_MONTHLY_GRID = 0;
  const TAB_TODAYS_ITEMS = 1;
  const TAB_MANAGE_ITEMS = 2;
  const TAB_CLIENT_ACCESS = 3;

  const [activeTab, setActiveTab] = useState(0);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showHolidayManager, setShowHolidayManager] = useState(false);
  const [gridRefreshToken, setGridRefreshToken] = useState(0);

  const isAdmin = workspace?.role === 'Owner' || workspace?.role === 'Admin';
  const isTodaysItemsTab = activeTab === TAB_TODAYS_ITEMS;
  const isClientAccessTab = isAdmin && activeTab === TAB_CLIENT_ACCESS;
  const showClientSelector = !isTodaysItemsTab && !isClientAccessTab;

  // Fetch clients - for admins get all, for regular users get assigned clients only
  const fetchClients = useCallback(async () => {
    if (!workspace?.id) return;
    
    try {
      setLoading(true);
      let activeClients = [];
      
      if (isAdmin) {
        // Admins see all active clients
        const response = await getClients(workspace.id);
        activeClients = (response.data || []).filter(c => 
          c.status?.toLowerCase() === 'active'
        );
      } else {
        // Regular users see only clients they're assigned to
        const response = await getUserAssignedClients(workspace.id, user?.id);
        activeClients = response.data || [];
      }
      
      setClients(activeClients);
      
      if (activeClients.length > 0 && !selectedClientId) {
        setSelectedClientId(activeClients[0].id);
      } else if (activeClients.length === 0) {
        setSelectedClientId(null);
      }
    } catch (err) {
      console.error('Error fetching clients:', err);
      setError('Failed to load clients');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, user?.id, isAdmin, selectedClientId]);

  useEffect(() => {
    fetchClients();
  }, [fetchClients]);

  const handleTabChange = (event, newValue) => {
    setActiveTab(newValue);
  };

  const handleMonthChange = (direction) => {
    if (direction === 'prev') {
      if (selectedMonth === 1) {
        setSelectedMonth(12);
        setSelectedYear(selectedYear - 1);
      } else {
        setSelectedMonth(selectedMonth - 1);
      }
    } else {
      if (selectedMonth === 12) {
        setSelectedMonth(1);
        setSelectedYear(selectedYear + 1);
      } else {
        setSelectedMonth(selectedMonth + 1);
      }
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  if (loading && clients.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '60vh' }}>
        <CircularProgress />
      </Box>
    );
  }

  if (clients.length === 0) {
    return (
      <Box sx={{ p: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 2 }}>
          Monthly Client Checklist
        </Typography>
        <Alert severity="info">
          No clients found in this workspace. Please add clients first to use the checklist feature.
        </Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Monthly Client Checklist
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
          {/* Client Selector */}
          {showClientSelector && (
            <FormControl size="small" sx={{ minWidth: 200 }}>
              <InputLabel>Client</InputLabel>
              <Select
                value={selectedClientId || ''}
                onChange={(e) => setSelectedClientId(e.target.value)}
                label="Client"
              >
                {clients.map((client) => (
                  <MenuItem key={client.id} value={client.id}>
                    {client.name || client.client_name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}

          {/* Month/Year Selector for Grid view */}
          {activeTab === TAB_MONTHLY_GRID && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Button size="small" onClick={() => handleMonthChange('prev')}>
                ‹
              </Button>
              <Typography sx={{ minWidth: 140, textAlign: 'center', fontWeight: 600 }}>
                {monthNames[selectedMonth - 1]} {selectedYear}
              </Typography>
              <Button size="small" onClick={() => handleMonthChange('next')}>
                ›
              </Button>
            </Box>
          )}

          {isAdmin && (
            <>
              <Tooltip title="Manage Holidays">
                <IconButton onClick={() => setShowHolidayManager(true)}>
                  <CalendarMonthIcon />
                </IconButton>
              </Tooltip>
            </>
          )}

          <Tooltip title="Refresh">
            <IconButton onClick={fetchClients}>
              <RefreshIcon />
            </IconButton>
          </Tooltip>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Show message if no clients assigned */}
      {!loading && clients.length === 0 && !isAdmin && (
        <Alert severity="info" sx={{ mb: 3 }}>
          You have not been assigned to any clients yet. Please contact your workspace administrator to get access to client checklists.
        </Alert>
      )}

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={handleTabChange}
        sx={{
          mb: 3,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 48,
          },
        }}
      >
        <Tab icon={<CalendarMonthIcon />} iconPosition="start" label="Monthly Grid" />
        <Tab icon={<TodayIcon />} iconPosition="start" label="Today's Items" />
        {isAdmin && <Tab icon={<ListAltIcon />} iconPosition="start" label="Manage Items" />}
        {isAdmin && <Tab icon={<PeopleIcon />} iconPosition="start" label="Client Access" />}
      </Tabs>

      {/* Tab Content */}
      <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2, p: 3 }}>
        {activeTab === TAB_MONTHLY_GRID && selectedClientId && (
          <ChecklistGrid
            workspaceId={workspace.id}
            clientId={selectedClientId}
            year={selectedYear}
            month={selectedMonth}
            isAdmin={isAdmin}
            userId={user?.id}
            refreshToken={gridRefreshToken}
          />
        )}

        {activeTab === TAB_TODAYS_ITEMS && (
          <DailyFocusView
            workspaceId={workspace.id}
            userId={user?.id}
          />
        )}

        {activeTab === TAB_MANAGE_ITEMS && isAdmin && selectedClientId && (
          <ChecklistItemManager
            workspaceId={workspace.id}
            clientId={selectedClientId}
            clients={clients}
            isAdmin={isAdmin}
          />
        )}

        {activeTab === TAB_CLIENT_ACCESS && isAdmin && (
          <ClientUserAssignments
            workspaceId={workspace.id}
            clients={clients}
          />
        )}
      </Card>

      {/* Holiday Manager Dialog */}
      {showHolidayManager && selectedClientId && (
        <HolidayManager
          open={showHolidayManager}
          onClose={() => setShowHolidayManager(false)}
          clientId={selectedClientId}
          clientName={clients.find(c => c.id === selectedClientId)?.name || clients.find(c => c.id === selectedClientId)?.client_name || 'Client'}
          isAdmin={isAdmin}
          clients={clients}
          onClientChange={setSelectedClientId}
          onHolidaysChanged={() => setGridRefreshToken((prev) => prev + 1)}
        />
      )}
    </Box>
  );
}

export default ChecklistPage;
