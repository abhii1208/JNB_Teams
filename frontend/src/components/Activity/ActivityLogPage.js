import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
  Avatar,
  IconButton,
  InputAdornment,
  Pagination,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import FolderIcon from '@mui/icons-material/Folder';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import EditIcon from '@mui/icons-material/Edit';
import { getActivity } from '../../apiClient';

// Mock activity data
const mockActivities = [
  {
    id: 1,
    type: 'Task',
    action: 'Completed',
    item: 'Complete API Integration',
    project: 'Website Redesign',
    user: { name: 'Sarah Miller', avatar: 'SM' },
    timestamp: '2026-01-05T14:30:00',
    details: 'Marked task as completed',
  },
  {
    id: 2,
    type: 'Project',
    action: 'Created',
    item: 'Mobile App v2',
    project: 'Mobile App v2',
    user: { name: 'John Doe', avatar: 'JD' },
    timestamp: '2026-01-05T12:15:00',
    details: 'Created new project',
  },
  {
    id: 3,
    type: 'Member',
    action: 'Added',
    item: 'Alex Kim',
    project: 'Website Redesign',
    user: { name: 'John Doe', avatar: 'JD' },
    timestamp: '2026-01-05T10:45:00',
    details: 'Added team member to project',
  },
  {
    id: 4,
    type: 'Task',
    action: 'Updated',
    item: 'Review Database Schema',
    project: 'Website Redesign',
    user: { name: 'Patricia Lee', avatar: 'PL' },
    timestamp: '2026-01-04T16:20:00',
    details: 'Updated task priority to High',
  },
  {
    id: 5,
    type: 'Task',
    action: 'Created',
    item: 'Mobile Testing Phase',
    project: 'Mobile App v2',
    user: { name: 'Mike Roberts', avatar: 'MR' },
    timestamp: '2026-01-04T14:10:00',
    details: 'Created new task',
  },
  {
    id: 6,
    type: 'Project',
    action: 'Updated',
    item: 'Marketing Campaign Q1',
    project: 'Marketing Campaign Q1',
    user: { name: 'Sarah Miller', avatar: 'SM' },
    timestamp: '2026-01-04T11:30:00',
    details: 'Updated project status',
  },
  {
    id: 7,
    type: 'Member',
    action: 'Removed',
    item: 'Alex Kim',
    project: 'Mobile App v2',
    user: { name: 'John Doe', avatar: 'JD' },
    timestamp: '2026-01-03T15:45:00',
    details: 'Removed team member from project',
  },
  {
    id: 8,
    type: 'Task',
    action: 'Completed',
    item: 'API Documentation',
    project: 'Website Redesign',
    user: { name: 'Mike Roberts', avatar: 'MR' },
    timestamp: '2026-01-03T13:20:00',
    details: 'Marked task as completed',
  },
];

const typeColors = {
  'Task': { bg: '#e0e7ff', text: '#3730a3', icon: <CheckCircleIcon fontSize="small" /> },
  'Project': { bg: '#ddd6fe', text: '#5b21b6', icon: <FolderIcon fontSize="small" /> },
  'Member': { bg: '#fce7f3', text: '#9f1239', icon: <PersonAddIcon fontSize="small" /> },
};

const actionColors = {
  'Created': '#16a34a',
  'Updated': '#0284c7',
  'Completed': '#065f46',
  'Added': '#7c3aed',
  'Removed': '#991b1b',
};

function ActivityLogPage({ workspace }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dateFilter, setDateFilter] = useState('All Time');
  const [page, setPage] = useState(1);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    const fetchActivities = async () => {
      if (!workspace?.id) return;
      try {
        setLoading(true);
        const filters = {
          workspace_id: workspace.id,
          page: page,
          limit: 10
        };
        if (typeFilter !== 'All') filters.type = typeFilter;
        const response = await getActivity(filters);
        setActivities(response.data.activities || []);
        setTotalPages(response.data.pages || 1);
      } catch (error) {
        console.error('Failed to fetch activities:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchActivities();
  }, [workspace, page, typeFilter]);

  const filteredActivities = activities.filter(activity => {
    const matchesSearch = 
      activity.item_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      activity.user_name?.toLowerCase().includes(searchQuery.toLowerCase());
    
    let matchesDate = true;
    if (dateFilter === 'Today') {
      const today = new Date().toDateString();
      matchesDate = new Date(activity.created_at).toDateString() === today;
    } else if (dateFilter === 'This Week') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      matchesDate = new Date(activity.created_at) >= weekAgo;
    }
    
    return matchesSearch && matchesDate;
  });

  const paginatedActivities = filteredActivities;

  const formatTimestamp = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Activity Log
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Track all activities across projects and tasks
        </Typography>
      </Box>

      {/* Filters */}
      <Card elevation={0} sx={{ p: 3, mb: 3, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
        <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
          <TextField
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon sx={{ color: 'text.secondary' }} />
                </InputAdornment>
              ),
            }}
            sx={{
              flex: 1,
              minWidth: 250,
              '& .MuiOutlinedInput-root': {
                borderRadius: 2,
              },
            }}
          />
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Type</InputLabel>
            <Select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              label="Type"
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="All">All Types</MenuItem>
              <MenuItem value="Task">Tasks</MenuItem>
              <MenuItem value="Project">Projects</MenuItem>
              <MenuItem value="Member">Members</MenuItem>
            </Select>
          </FormControl>

          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Date Range</InputLabel>
            <Select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              label="Date Range"
              sx={{ borderRadius: 2 }}
            >
              <MenuItem value="All Time">All Time</MenuItem>
              <MenuItem value="Today">Today</MenuItem>
              <MenuItem value="This Week">This Week</MenuItem>
            </Select>
          </FormControl>
        </Box>
      </Card>

      {/* Activity Table */}
      <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Action</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Details</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {paginatedActivities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No activities found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                paginatedActivities.map((activity) => (
                  <TableRow key={activity.id} hover>
                    <TableCell>
                      <Chip
                        icon={typeColors[activity.type].icon}
                        label={activity.type}
                        size="small"
                        sx={{
                          backgroundColor: typeColors[activity.type].bg,
                          color: typeColors[activity.type].text,
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={activity.action}
                        size="small"
                        sx={{
                          backgroundColor: `${actionColors[activity.action]}15`,
                          color: actionColors[activity.action],
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {activity.item_name}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {activity.project_id}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Avatar
                          sx={{
                            width: 32,
                            height: 32,
                            bgcolor: '#0f766e',
                            fontSize: '0.875rem',
                          }}
                        >
                          {activity.user_name?.charAt(0) || 'U'}
                        </Avatar>
                        <Typography variant="body2">{activity.user_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {formatTimestamp(activity.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" color="text.secondary">
                        {activity.details}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>

        {/* Pagination */}
        {totalPages > 1 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
            <Pagination
              count={totalPages}
              page={page}
              onChange={(e, value) => setPage(value)}
              color="primary"
            />
          </Box>
        )}
      </Card>
    </Box>
  );
}

export default ActivityLogPage;
