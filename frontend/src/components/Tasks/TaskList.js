import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  FormControl,
  Grid,
  IconButton,
  InputAdornment,
  InputLabel,
  Menu,
  MenuItem,
  Select,
  TextField,
  Typography,
  Avatar,
   Table,
   TableHead,
   TableRow,
   TableCell,
   TableBody,
   TableContainer,
   Paper,
   TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import PersonIcon from '@mui/icons-material/Person';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import TableRowsIcon from '@mui/icons-material/TableRows';
import { getWorkspaceTasks } from '../../apiClient';

// Mock data
const mockTasks = [
  {
    id: 1,
    name: 'Design homepage mockup',
    project: 'Website Redesign',
    assignee: 'John Doe',
    assigneeAvatar: 'JD',
    stage: 'In-process',
    status: 'Open',
    dueDate: '2026-01-06',
    targetDate: '2026-01-07',
    createdDate: '2026-01-02',
    createdBy: 'Sarah Miller',
    collaborators: ['SM', 'AK'],
  },
  {
    id: 2,
    name: 'Setup CI/CD pipeline',
    project: 'Backend Services',
    assignee: 'Sarah Miller',
    assigneeAvatar: 'SM',
    stage: 'Completed',
    status: 'Pending Approval',
    dueDate: '2026-01-05',
    createdDate: '2026-01-01',
    createdBy: 'John Doe',
    collaborators: ['JD'],
  },
  {
    id: 3,
    name: 'Write user documentation',
    project: 'Website Redesign',
    assignee: 'Alex Kim',
    assigneeAvatar: 'AK',
    stage: 'Completed',
    status: 'Pending Approval',
    dueDate: '2026-01-05',
    createdDate: '2025-12-28',
    createdBy: 'John Doe',
    collaborators: ['PL'],
  },
  {
    id: 4,
    name: 'API integration testing',
    project: 'Mobile App v2',
    assignee: 'Patricia Lee',
    assigneeAvatar: 'PL',
    stage: 'Planned',
    status: 'Open',
    dueDate: '2026-01-08',
    targetDate: '2026-01-08',
    createdDate: '2026-01-03',
    createdBy: 'Mike Roberts',
    collaborators: [],
  },
  {
    id: 5,
    name: 'Database optimization',
    project: 'Backend Services',
    assignee: 'Mike Roberts',
    assigneeAvatar: 'MR',
    stage: 'Completed',
    status: 'Closed',
    dueDate: '2026-01-04',
    createdDate: '2025-12-20',
    createdBy: 'John Doe',
    collaborators: ['SM'],
  },
  {
    id: 6,
    name: 'User feedback analysis',
    project: 'Product Design',
    assignee: 'Sarah Miller',
    assigneeAvatar: 'SM',
    stage: 'On-hold',
    status: 'Open',
    dueDate: '2026-01-15',
    targetDate: '2026-01-16',
    createdDate: '2026-01-04',
    createdBy: 'Alex Kim',
    collaborators: ['AK', 'PL'],
  },
  {
    id: 7,
    name: 'Security audit',
    project: 'Backend Services',
    assignee: 'John Doe',
    assigneeAvatar: 'JD',
    stage: 'In-process',
    status: 'Open',
    dueDate: '2026-01-10',
    createdDate: '2026-01-05',
    createdBy: 'Sarah Miller',
    collaborators: ['SM', 'MR'],
  },
  {
    id: 8,
    name: 'Marketing email template',
    project: 'Marketing Campaign Q1',
    assignee: 'Patricia Lee',
    assigneeAvatar: 'PL',
    stage: 'Dropped',
    status: 'Open',
    dueDate: '2026-01-12',
    targetDate: '2026-01-11',
    createdDate: '2025-12-30',
    createdBy: 'Sarah Miller',
    collaborators: [],
  },
];

const stageColors = {
  'Planned': { bg: '#e0e7ff', text: '#3730a3' },
  'In-process': { bg: '#fef3c7', text: '#92400e' },
  'Completed': { bg: '#d1fae5', text: '#065f46' },
  'Dropped': { bg: '#fee2e2', text: '#991b1b' },
  'On-hold': { bg: '#f3e8ff', text: '#6b21a8' },
};

const statusColors = {
  'Open': { bg: '#fef3c7', text: '#92400e' },
  'Pending Approval': { bg: '#fee2e2', text: '#991b1b' },
  'Closed': { bg: '#e2e8f0', text: '#475569' },
  'Rejected': { bg: '#fee2e2', text: '#991b1b' },
};

function TaskList({ onSelectTask, workspace }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStage, setFilterStage] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedTask, setSelectedTask] = useState(null);
  const [viewMode, setViewMode] = useState('board'); // 'board' or 'table'
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(50);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleMenuOpen = (event, task) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedTask(task);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedTask(null);
  };

  const filteredTasks = mockTasks.filter((task) => {
    const matchesSearch =
      task.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      task.project.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStage = filterStage === 'all' || task.stage === filterStage;
    const matchesStatus = filterStatus === 'all' || task.status === filterStatus;
    return matchesSearch && matchesStage && matchesStatus;
  });

  // Replace mockTasks with backend data when available
  const [remoteTasks, setRemoteTasks] = useState(null);

  useEffect(() => {
    const fetchTasks = async () => {
      const wsId = workspace?.id || Number(localStorage.getItem('currentWorkspaceId'));
      if (!wsId) return;
      setLoading(true);
      setError(null);
      try {
        const params = { page: 1, limit: 200 };
        const res = await getWorkspaceTasks(wsId, params);
        const items = (res.data && res.data.tasks) || [];

        // Map backend task shape to component shape
        const mapped = items.map(t => ({
          id: t.id,
          name: t.name,
          project: t.project_name || (t.project && t.project.name) || '-',
          assignee: t.assignee_name || null,
          assigneeAvatar: t.assignee_name ? (t.assignee_name.split(' ').map(n=>n[0]).join('').slice(0,2)) : '',
          stage: t.stage || t.stage || 'Planned',
          status: t.status || 'Open',
          dueDate: t.due_date ? t.due_date.split('T')[0] : null,
          targetDate: t.target_date ? (t.target_date.split('T')[0] || t.target_date) : null,
          createdDate: t.created_at ? t.created_at.split('T')[0] : null,
          createdBy: t.created_by_name || (t.created_by || '-'),
          collaborators: Array.isArray(t.collaborators) ? t.collaborators.map(c => c.name || c.email || c.id) : (t.collaborators ? [t.collaborators] : []),
        }));

        setRemoteTasks(mapped);
      } catch (err) {
        console.error('Failed to fetch tasks for TaskList:', err);
        setError('Failed to load tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [workspace]);

  const tasksSource = remoteTasks || filteredTasks;

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const today = new Date().toISOString().slice(0, 10);
    return dateStr === today;
  };

  const pendingApprovalTasks = tasksSource.filter(t => t.status === 'Pending Approval');
  const otherTasks = tasksSource.filter(t => t.status !== 'Pending Approval');

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Tasks
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Manage and track your tasks across all projects
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{
            px: 3,
            py: 1.5,
            borderRadius: 2,
            textTransform: 'none',
            fontWeight: 600,
          }}
        >
          Create Task
        </Button>
      </Box>

      {/* Search & Filters */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4, flexWrap: 'wrap' }}>
        <TextField
          placeholder="Search tasks..."
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
            flex: '1 1 300px',
            maxWidth: 400,
            '& .MuiOutlinedInput-root': {
              borderRadius: 2,
              backgroundColor: '#fff',
            },
          }}
        />
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Stage</InputLabel>
          <Select
            value={filterStage}
            label="Stage"
            onChange={(e) => setFilterStage(e.target.value)}
            sx={{ borderRadius: 2, backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All Stages</MenuItem>
            <MenuItem value="Planned">Planned</MenuItem>
            <MenuItem value="In-process">In-process</MenuItem>
            <MenuItem value="Completed">Completed</MenuItem>
            <MenuItem value="On-hold">On-hold</MenuItem>
            <MenuItem value="Dropped">Dropped</MenuItem>
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Status</InputLabel>
          <Select
            value={filterStatus}
            label="Status"
            onChange={(e) => setFilterStatus(e.target.value)}
            sx={{ borderRadius: 2, backgroundColor: '#fff' }}
          >
            <MenuItem value="all">All Status</MenuItem>
            <MenuItem value="Open">Open</MenuItem>
            <MenuItem value="Pending Approval">Pending Approval</MenuItem>
            <MenuItem value="Closed">Closed</MenuItem>
          </Select>
        </FormControl>
        <Box sx={{ display: 'flex', alignItems: 'center', ml: 'auto', gap: 1 }}>
          <IconButton
            color={viewMode === 'board' ? 'primary' : 'default'}
            onClick={() => setViewMode('board')}
            size="large"
          >
            <ViewModuleIcon />
          </IconButton>
          <IconButton
            color={viewMode === 'table' ? 'primary' : 'default'}
            onClick={() => setViewMode('table')}
            size="large"
          >
            <TableRowsIcon />
          </IconButton>
        </Box>
      </Box>

      {/* Pending Approval Section */}
      {pendingApprovalTasks.length > 0 && (
        <>
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, mb: 2 }}>
              Awaiting Approval ({pendingApprovalTasks.length})
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              These tasks require your approval to be closed
            </Typography>
          </Box>

          <Grid container spacing={2} sx={{ mb: 5 }}>
            {pendingApprovalTasks.map((task) => (
              <Grid item xs={12} key={task.id}>
                <Card
                  elevation={0}
                  onClick={() => onSelectTask(task)}
                  sx={{
                    border: '2px solid #fee2e2',
                    borderRadius: 3,
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    backgroundColor: 'rgba(254, 226, 226, 0.2)',
                    '&:hover': {
                      transform: 'translateY(-2px)',
                      boxShadow: '0 8px 24px rgba(239, 68, 68, 0.15)',
                      borderColor: '#ef4444',
                    },
                  }}
                >
                  <CardContent sx={{ p: 3 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 3 }}>
                      <Avatar sx={{ bgcolor: '#ef4444', width: 48, height: 48, fontWeight: 600 }}>
                        {task.assigneeAvatar}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="h6" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {task.name}
                        </Typography>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          {task.project} • Assigned to {task.assignee}
                        </Typography>
                        <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
                          <Chip
                            label={task.stage}
                            size="small"
                            sx={{
                              backgroundColor: stageColors[task.stage]?.bg,
                              color: stageColors[task.stage]?.text,
                              fontWeight: 500,
                            }}
                          />
                          <Chip
                            label={task.status}
                            size="small"
                            sx={{
                              backgroundColor: statusColors[task.status]?.bg,
                              color: statusColors[task.status]?.text,
                              fontWeight: 500,
                            }}
                          />
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                            <CalendarTodayIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                            <Typography variant="caption" color="text.secondary">
                              Due {task.dueDate}
                            </Typography>
                          </Box>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          variant="contained"
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle approve
                          }}
                          sx={{
                            textTransform: 'none',
                            bgcolor: '#0f766e',
                            '&:hover': { bgcolor: '#115e59' },
                          }}
                        >
                          Approve
                        </Button>
                        <Button
                          variant="outlined"
                          size="small"
                          color="error"
                          onClick={(e) => {
                            e.stopPropagation();
                            // Handle reject
                          }}
                          sx={{ textTransform: 'none' }}
                        >
                          Reject
                        </Button>
                        <IconButton size="small" onClick={(e) => handleMenuOpen(e, task)}>
                          <MoreVertIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </>
      )}

      {/* All Tasks */}
      <Typography variant="h6" sx={{ fontWeight: 600, mb: 3 }}>
        All Tasks ({otherTasks.length})
      </Typography>

      {viewMode === 'board' ? (
        <Grid container spacing={2}>
          {otherTasks.map((task) => (
            <Grid item xs={12} md={6} key={task.id}>
              <Card
                elevation={0}
                onClick={() => onSelectTask(task)}
                sx={{
                  border: '1px solid rgba(148, 163, 184, 0.2)',
                  borderRadius: 3,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  '&:hover': {
                    transform: 'translateY(-4px)',
                    boxShadow: '0 12px 40px rgba(15, 23, 42, 0.1)',
                    borderColor: '#0f766e',
                  },
                }}
              >
                <CardContent sx={{ p: 3 }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                    <Box sx={{ display: 'flex', gap: 2, flex: 1, minWidth: 0 }}>
                      <Avatar sx={{ bgcolor: '#0f766e', width: 40, height: 40, fontWeight: 600 }}>
                        {task.assigneeAvatar}
                      </Avatar>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Typography variant="body1" sx={{ fontWeight: 600, mb: 0.5 }}>
                          {task.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {task.project}
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                          Created {task.createdDate} • By {task.createdBy}
                        </Typography>
                      </Box>
                    </Box>
                    <IconButton size="small" onClick={(e) => handleMenuOpen(e, task)}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </Box>

                  <Box sx={{ display: 'flex', gap: 1, mb: 2, flexWrap: 'wrap' }}>
                    <Chip
                      label={task.stage}
                      size="small"
                      sx={{
                        backgroundColor: stageColors[task.stage]?.bg,
                        color: stageColors[task.stage]?.text,
                        fontWeight: 500,
                        fontSize: '0.75rem',
                      }}
                    />
                    <Chip
                      label={task.status}
                      size="small"
                      sx={{
                        backgroundColor: statusColors[task.status]?.bg,
                        color: statusColors[task.status]?.text,
                        fontWeight: 500,
                        fontSize: '0.75rem',
                      }}
                    />
                    <Chip label={`Target: ${task.targetDate || '-'} `} size="small" />
                  </Box>

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 14, color: isToday(task.dueDate) ? 'error.main' : 'text.secondary' }} />
                      <Typography variant="caption" color={isToday(task.dueDate) ? 'error.main' : 'text.secondary'}>
                        Due {task.dueDate}{isToday(task.dueDate) ? ' • Today' : ''}
                      </Typography>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                      <PersonIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        +{task.collaborators.length}
                      </Typography>
                    </Box>
                  </Box>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      ) : (
        <TableContainer component={Paper} sx={{ borderRadius: 2 }}>
          <Table>
            <TableHead>
              <TableRow>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Task</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Project</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Stage</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', px: 1 }}>Status</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Assignee</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Collaborators</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Target Date</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Due Date</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Created Date</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>Created By</TableCell>
                  <TableCell />
              </TableRow>
            </TableHead>
            <TableBody>
              {otherTasks.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage).map((task) => (
                <TableRow key={task.id} hover onClick={() => onSelectTask(task)} sx={{ cursor: 'pointer' }}>
                  <TableCell sx={{ maxWidth: 300, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.name}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{task.project}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{task.stage}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', px: 1 }}>{task.status}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{task.assignee}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{(task.collaborators || []).join(', ') || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{task.targetDate || '-'}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CalendarTodayIcon sx={{ fontSize: 16, color: isToday(task.dueDate) ? '#dc2626' : 'text.secondary' }} />
                      <Typography variant="body2" sx={{ color: isToday(task.dueDate) ? '#dc2626' : 'text.secondary' }} noWrap>
                        {task.dueDate}
                      </Typography>
                    </Box>
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{task.createdDate}</TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap' }}>{task.createdBy}</TableCell>
                  <TableCell>
                    <IconButton size="small" onClick={(e) => { e.stopPropagation(); handleMenuOpen(e, task); }}>
                      <MoreVertIcon fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <TablePagination
            component="div"
            count={otherTasks.length}
            page={page}
            onPageChange={(e, newPage) => setPage(newPage)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
            rowsPerPageOptions={[10, 25, 50]}
          />
        </TableContainer>
      )}

      {/* Context Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
        PaperProps={{
          sx: { borderRadius: 2, minWidth: 180 },
        }}
      >
        <MenuItem onClick={handleMenuClose}>View Details</MenuItem>
        <MenuItem onClick={handleMenuClose}>Edit Task</MenuItem>
        <MenuItem onClick={handleMenuClose}>Change Stage</MenuItem>
        <MenuItem onClick={handleMenuClose}>Reassign</MenuItem>
        {selectedTask?.status === 'Open' && (
          <MenuItem onClick={handleMenuClose}>Request Closure</MenuItem>
        )}
        <MenuItem onClick={handleMenuClose} sx={{ color: 'error.main' }}>
          Delete Task
        </MenuItem>
      </Menu>
    </Box>
  );
}

export default TaskList;
