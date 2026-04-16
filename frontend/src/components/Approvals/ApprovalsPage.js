import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Menu,
  MenuItem,
  useMediaQuery,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import { getApprovals, approveApproval, rejectApproval } from '../../apiClient';
import { formatShortDateIST } from '../../utils/dateUtils';

const statusColors = {
  'Pending': { bg: '#fef3c7', text: '#92400e' },
  'Approved': { bg: '#d1fae5', text: '#065f46' },
  'Rejected': { bg: '#fee2e2', text: '#991b1b' },
};

const typeColors = {
  'Task Status Change': '#0284c7',
  'Project Budget': '#7c3aed',
  'Task Assignment': '#0f766e',
  'Deadline Extension': '#ea580c',
  'Resource Allocation': '#16a34a',
};

function ApprovalsPage({ user, workspace }) {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const [activeTab, setActiveTab] = useState(0);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvals, setApprovals] = useState([]);
  const [sortConfig, setSortConfig] = useState({ key: 'date', direction: 'desc' });
  const [columnFilters, setColumnFilters] = useState({
    type: 'All',
    task: 'All',
    project: 'All',
    requester: 'All',
    date: 'All',
    status: 'All',
  });
  const [filterAnchors, setFilterAnchors] = useState({});

  useEffect(() => {
    const fetchApprovals = async () => {
      if (!workspace?.id) return;
      try {
        const response = await getApprovals({ workspace_id: workspace.id });
        setApprovals(response.data);
      } catch (error) {
        console.error('Failed to fetch approvals:', error);
      }
    };
    
    fetchApprovals();
  }, [workspace]);

  const handleViewDetails = (approval) => {
    setSelectedApproval(approval);
    setDetailsDialogOpen(true);
  };

  const handleApprove = async (approvalId) => {
    try {
      await approveApproval(approvalId);
      setApprovals(approvals.map(a => 
        a.id === approvalId ? { ...a, status: 'Approved' } : a
      ));
    } catch (error) {
      console.error('Failed to approve:', error);
      alert('Failed to approve. Please try again.');
    }
  };

  const handleOpenReject = (approval) => {
    setSelectedApproval(approval);
    setRejectDialogOpen(true);
  };

  const handleReject = async () => {
    if (!selectedApproval?.id) return;
    try {
      await rejectApproval(selectedApproval.id, rejectReason);
      setApprovals(approvals.map(a => 
        a.id === selectedApproval.id ? { ...a, status: 'Rejected', reject_reason: rejectReason } : a
      ));
      setRejectDialogOpen(false);
      setRejectReason('');
      setSelectedApproval(null);
    } catch (error) {
      console.error('Failed to reject:', error);
      alert('Failed to reject. Please try again.');
    }
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { key, direction: 'asc' };
    });
  };

  const handleFilterOpen = (key, event) => {
    setFilterAnchors((prev) => ({ ...prev, [key]: event.currentTarget }));
  };

  const handleFilterClose = (key) => {
    setFilterAnchors((prev) => ({ ...prev, [key]: null }));
  };

  const handleFilterChange = (key, value) => {
    setColumnFilters((prev) => ({ ...prev, [key]: value }));
    handleFilterClose(key);
  };

  const tabFilteredApprovals = approvals.filter(approval => {
    if (activeTab === 0) return approval.status === 'Pending';
    if (activeTab === 1) return approval.status === 'Approved';
    if (activeTab === 2) return approval.status === 'Rejected';
    return true;
  });

  const filteredApprovals = tabFilteredApprovals.filter((approval) => {
    const taskText = `${approval.task_name || ''} ${approval.reason || ''}`.toLowerCase();
    const dateText = formatShortDateIST(approval.created_at).toLowerCase();
    return (
      (columnFilters.type === 'All' || approval.type === columnFilters.type) &&
      (columnFilters.task === 'All' || taskText === columnFilters.task.toLowerCase()) &&
      (columnFilters.project === 'All' || approval.project_name === columnFilters.project) &&
      (columnFilters.requester === 'All' || approval.requester_name === columnFilters.requester) &&
      (columnFilters.date === 'All' || dateText === columnFilters.date.toLowerCase()) &&
      (columnFilters.status === 'All' || approval.status === columnFilters.status)
    );
  });

  const sortedApprovals = [...filteredApprovals].sort((a, b) => {
    const direction = sortConfig.direction === 'asc' ? 1 : -1;
    if (sortConfig.key === 'date') {
      const aTime = new Date(a.created_at).getTime();
      const bTime = new Date(b.created_at).getTime();
      return (aTime - bTime) * direction;
    }
    const getText = (approval, key) => {
      if (key === 'type') return approval.type || '';
      if (key === 'task') return `${approval.task_name || ''} ${approval.reason || ''}`.trim();
      if (key === 'project') return approval.project_name || '';
      if (key === 'requester') return approval.requester_name || '';
      if (key === 'status') return approval.status || '';
      return '';
    };
    const aText = getText(a, sortConfig.key).toLowerCase();
    const bText = getText(b, sortConfig.key).toLowerCase();
    if (aText < bText) return -1 * direction;
    if (aText > bText) return 1 * direction;
    return 0;
  });

  const pendingCount = approvals.filter(a => a.status === 'Pending').length;
  const taskOptions = Array.from(new Set(
    tabFilteredApprovals.map((approval) => `${approval.task_name || ''} ${approval.reason || ''}`.trim())
  )).filter(Boolean);
  const dateOptions = Array.from(new Set(
    tabFilteredApprovals.map((approval) => formatShortDateIST(approval.created_at))
  )).filter(Boolean);
  const typeOptions = Array.from(new Set(tabFilteredApprovals.map((approval) => approval.type))).filter(Boolean);
  const projectOptions = Array.from(new Set(tabFilteredApprovals.map((approval) => approval.project_name))).filter(Boolean);
  const requesterOptions = Array.from(new Set(tabFilteredApprovals.map((approval) => approval.requester_name))).filter(Boolean);
  const statusOptions = Array.from(new Set(tabFilteredApprovals.map((approval) => approval.status))).filter(Boolean);

  return (
    <Box sx={{ p: { xs: 2, sm: 3 }, minWidth: 0 }}>
      {/* Header */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.75 }}>
          Approvals
        </Typography>
        <Typography variant="body2" color="text.secondary">
          Review pending approvals and track completed decisions
        </Typography>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        variant={isMobile ? 'scrollable' : 'standard'}
        scrollButtons={isMobile ? 'auto' : false}
        sx={{
          mb: 2,
          '& .MuiTab-root': {
            textTransform: 'none',
            fontWeight: 600,
            minWidth: 100,
          },
        }}
      >
        <Tab label={`Pending (${pendingCount})`} />
        <Tab label="Approved" />
        <Tab label="Rejected" />
        <Tab label="All" />
      </Tabs>

      {/* Approvals Table */}
      <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 3 }}>
        <TableContainer sx={{ overflowX: 'auto' }}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TableSortLabel
                      active={sortConfig.key === 'type'}
                      direction={sortConfig.key === 'type' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('type')}
                    >
                      Type
                    </TableSortLabel>
                    <IconButton size="small" onClick={(e) => handleFilterOpen('type', e)}>
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={filterAnchors.type}
                      open={Boolean(filterAnchors.type)}
                      onClose={() => handleFilterClose('type')}
                    >
                      <MenuItem onClick={() => handleFilterChange('type', 'All')}>All</MenuItem>
                      {typeOptions.map((option) => (
                        <MenuItem key={option} onClick={() => handleFilterChange('type', option)}>
                          {option}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TableSortLabel
                      active={sortConfig.key === 'task'}
                      direction={sortConfig.key === 'task' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('task')}
                    >
                      Task/Request
                    </TableSortLabel>
                    <IconButton size="small" onClick={(e) => handleFilterOpen('task', e)}>
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={filterAnchors.task}
                      open={Boolean(filterAnchors.task)}
                      onClose={() => handleFilterClose('task')}
                    >
                      <MenuItem onClick={() => handleFilterChange('task', 'All')}>All</MenuItem>
                      {taskOptions.map((option) => (
                        <MenuItem key={option} onClick={() => handleFilterChange('task', option)}>
                          {option}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TableSortLabel
                      active={sortConfig.key === 'project'}
                      direction={sortConfig.key === 'project' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('project')}
                    >
                      Project
                    </TableSortLabel>
                    <IconButton size="small" onClick={(e) => handleFilterOpen('project', e)}>
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={filterAnchors.project}
                      open={Boolean(filterAnchors.project)}
                      onClose={() => handleFilterClose('project')}
                    >
                      <MenuItem onClick={() => handleFilterChange('project', 'All')}>All</MenuItem>
                      {projectOptions.map((option) => (
                        <MenuItem key={option} onClick={() => handleFilterChange('project', option)}>
                          {option}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TableSortLabel
                      active={sortConfig.key === 'requester'}
                      direction={sortConfig.key === 'requester' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('requester')}
                    >
                      Requester
                    </TableSortLabel>
                    <IconButton size="small" onClick={(e) => handleFilterOpen('requester', e)}>
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={filterAnchors.requester}
                      open={Boolean(filterAnchors.requester)}
                      onClose={() => handleFilterClose('requester')}
                    >
                      <MenuItem onClick={() => handleFilterChange('requester', 'All')}>All</MenuItem>
                      {requesterOptions.map((option) => (
                        <MenuItem key={option} onClick={() => handleFilterChange('requester', option)}>
                          {option}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TableSortLabel
                      active={sortConfig.key === 'date'}
                      direction={sortConfig.key === 'date' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('date')}
                    >
                      Date
                    </TableSortLabel>
                    <IconButton size="small" onClick={(e) => handleFilterOpen('date', e)}>
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={filterAnchors.date}
                      open={Boolean(filterAnchors.date)}
                      onClose={() => handleFilterClose('date')}
                    >
                      <MenuItem onClick={() => handleFilterChange('date', 'All')}>All</MenuItem>
                      {dateOptions.map((option) => (
                        <MenuItem key={option} onClick={() => handleFilterChange('date', option)}>
                          {option}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <TableSortLabel
                      active={sortConfig.key === 'status'}
                      direction={sortConfig.key === 'status' ? sortConfig.direction : 'asc'}
                      onClick={() => handleSort('status')}
                    >
                      Status
                    </TableSortLabel>
                    <IconButton size="small" onClick={(e) => handleFilterOpen('status', e)}>
                      <ArrowDropDownIcon fontSize="small" />
                    </IconButton>
                    <Menu
                      anchorEl={filterAnchors.status}
                      open={Boolean(filterAnchors.status)}
                      onClose={() => handleFilterClose('status')}
                    >
                      <MenuItem onClick={() => handleFilterChange('status', 'All')}>All</MenuItem>
                      {statusOptions.map((option) => (
                        <MenuItem key={option} onClick={() => handleFilterChange('status', option)}>
                          {option}
                        </MenuItem>
                      ))}
                    </Menu>
                  </Box>
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {sortedApprovals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No approvals found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                sortedApprovals.map((approval) => (
                  <TableRow key={approval.id} hover>
                    <TableCell>
                      <Chip
                        label={approval.type}
                        size="small"
                        sx={{
                          backgroundColor: `${typeColors[approval.type]}15`,
                          color: typeColors[approval.type],
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {approval.task_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {approval.reason}
                      </Typography>
                    </TableCell>
                    <TableCell>{approval.project_name}</TableCell>
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
                          {approval.requester_name?.charAt(0) || 'U'}
                        </Avatar>
                        <Typography variant="body2">{approval.requester_name}</Typography>
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2">
                        {formatShortDateIST(approval.created_at)}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip
                        label={approval.status}
                        size="small"
                        sx={{
                          backgroundColor: statusColors[approval.status].bg,
                          color: statusColors[approval.status].text,
                          fontWeight: 500,
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 0.5 }}>
                        <IconButton
                          size="small"
                          onClick={() => handleViewDetails(approval)}
                          sx={{ color: 'text.secondary' }}
                        >
                          <InfoIcon fontSize="small" />
                        </IconButton>
                        {approval.status === 'Pending' && approval.can_review && (
                          <>
                            <IconButton
                              size="small"
                              onClick={() => handleApprove(approval.id)}
                              sx={{ color: '#065f46' }}
                            >
                              <CheckIcon fontSize="small" />
                            </IconButton>
                            <IconButton
                              size="small"
                              onClick={() => handleOpenReject(approval)}
                              sx={{ color: '#991b1b' }}
                            >
                              <CloseIcon fontSize="small" />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Card>

      {/* Details Dialog */}
      <Dialog
        open={detailsDialogOpen}
        onClose={() => setDetailsDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Approval Details
          </Typography>
        </DialogTitle>
        <DialogContent>
          {selectedApproval && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Type
                </Typography>
                <Chip
                  label={selectedApproval.type}
                  size="small"
                  sx={{
                    mt: 0.5,
                    backgroundColor: `${typeColors[selectedApproval.type]}15`,
                    color: typeColors[selectedApproval.type],
                  }}
                />
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Task/Request
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 600 }}>
                  {selectedApproval.task_name}
                </Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Project
                </Typography>
                <Typography variant="body1">{selectedApproval.project_name}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Reason
                </Typography>
                <Typography variant="body1">{selectedApproval.reason}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Details
                </Typography>
                <Typography variant="body1">{selectedApproval.details}</Typography>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Requested By
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 0.5 }}>
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#0f766e' }}>
                    {selectedApproval.requester_name?.charAt(0) || 'U'}
                  </Avatar>
                  <Typography variant="body1">{selectedApproval.requester_name}</Typography>
                </Box>
              </Box>
              <Box>
                <Typography variant="caption" color="text.secondary">
                  Date
                </Typography>
                <Typography variant="body1">
                  {formatShortDateIST(selectedApproval.created_at)}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, pt: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() => setDetailsDialogOpen(false)}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog
        open={rejectDialogOpen}
        onClose={() => setRejectDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ pb: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 700 }}>
            Reject Approval
          </Typography>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Reason for rejection"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            multiline
            rows={3}
            placeholder="Provide a reason for rejection (optional)"
            sx={{
              mt: 1,
              '& .MuiOutlinedInput-root': { borderRadius: 2 },
            }}
          />
        </DialogContent>
        <DialogActions sx={{ p: { xs: 2, sm: 3 }, pt: 2, flexWrap: 'wrap', gap: 1 }}>
          <Button
            onClick={() => setRejectDialogOpen(false)}
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReject}
            variant="contained"
            color="error"
            sx={{ textTransform: 'none', borderRadius: 2 }}
          >
            Reject
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default ApprovalsPage;
