import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
  Avatar,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
} from '@mui/material';
import CheckIcon from '@mui/icons-material/Check';
import CloseIcon from '@mui/icons-material/Close';
import InfoIcon from '@mui/icons-material/InfoOutlined';
import { getApprovals, approveApproval, rejectApproval } from '../../apiClient';

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
  const [activeTab, setActiveTab] = useState(0);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [rejectDialogOpen, setRejectDialogOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [approvals, setApprovals] = useState([]);

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

  const filteredApprovals = approvals.filter(approval => {
    if (activeTab === 0) return approval.status === 'Pending';
    if (activeTab === 1) return approval.status === 'Approved';
    if (activeTab === 2) return approval.status === 'Rejected';
    return true;
  });

  const pendingCount = approvals.filter(a => a.status === 'Pending').length;

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Approvals
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Review and manage pending approval requests
        </Typography>
      </Box>

      {/* Stats Cards */}
      <Box sx={{ display: 'flex', gap: 2, mb: 4 }}>
        <Card elevation={0} sx={{ flex: 1, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 700, color: '#92400e', mb: 0.5 }}>
              {pendingCount}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Pending Approvals
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ flex: 1, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 700, color: '#065f46', mb: 0.5 }}>
              {approvals.filter(a => a.status === 'Approved').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Approved
            </Typography>
          </CardContent>
        </Card>
        <Card elevation={0} sx={{ flex: 1, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
          <CardContent>
            <Typography variant="h3" sx={{ fontWeight: 700, color: '#991b1b', mb: 0.5 }}>
              {approvals.filter(a => a.status === 'Rejected').length}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              Rejected
            </Typography>
          </CardContent>
        </Card>
      </Box>

      {/* Tabs */}
      <Tabs
        value={activeTab}
        onChange={(e, newValue) => setActiveTab(newValue)}
        sx={{
          mb: 3,
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
      <Card elevation={0} sx={{ border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Type</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Task/Request</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Project</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Requester</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredApprovals.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography variant="body2" color="text.secondary">
                      No approvals found
                    </Typography>
                  </TableCell>
                </TableRow>
              ) : (
                filteredApprovals.map((approval) => (
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
                        {new Date(approval.created_at).toLocaleDateString()}
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
                  {new Date(selectedApproval.created_at).toLocaleDateString()}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 2 }}>
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
        <DialogActions sx={{ p: 3, pt: 2 }}>
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
