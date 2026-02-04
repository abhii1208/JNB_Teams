/**
 * ChecklistReports - Summary and detailed reports with export functionality
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  CircularProgress,
  Alert,
  Chip,
  LinearProgress,
  Grid,
  Tabs,
  Tab,
} from '@mui/material';
import { formatShortDateIST, formatTimeIST } from '../../utils/dateUtils';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import TableChartIcon from '@mui/icons-material/TableChart';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import {
  getChecklistSummaryReport,
  getChecklistDetailedReport,
  getChecklistUserPerformance,
  exportChecklistCSV,
  exportChecklistPDF,
} from '../../apiClient';

function ChecklistReports({ workspaceId, clientId }) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [exporting, setExporting] = useState(false);
  
  // Filters
  const [dateRange, setDateRange] = useState({
    startDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [frequencyFilter, setFrequencyFilter] = useState('all');

  // Report data
  const [summary, setSummary] = useState(null);
  const [detailed, setDetailed] = useState([]);
  const [userPerformance, setUserPerformance] = useState([]);

  // Fetch summary report
  const fetchSummary = useCallback(async () => {
    try {
      const response = await getChecklistSummaryReport(workspaceId, {
        clientId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        frequency: frequencyFilter !== 'all' ? frequencyFilter : undefined,
      });
      setSummary(response.data);
    } catch (err) {
      console.error('Error fetching summary:', err);
      throw err;
    }
  }, [workspaceId, clientId, dateRange, frequencyFilter]);

  // Fetch detailed report
  const fetchDetailed = useCallback(async () => {
    try {
      const response = await getChecklistDetailedReport(workspaceId, {
        clientId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        frequency: frequencyFilter !== 'all' ? frequencyFilter : undefined,
      });
      setDetailed(response.data || []);
    } catch (err) {
      console.error('Error fetching detailed:', err);
      throw err;
    }
  }, [workspaceId, clientId, dateRange, frequencyFilter]);

  // Fetch user performance
  const fetchUserPerformance = useCallback(async () => {
    try {
      const response = await getChecklistUserPerformance(workspaceId, {
        clientId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      });
      setUserPerformance(response.data || []);
    } catch (err) {
      console.error('Error fetching user performance:', err);
      throw err;
    }
  }, [workspaceId, clientId, dateRange]);

  // Fetch all data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      await Promise.all([fetchSummary(), fetchDetailed(), fetchUserPerformance()]);
    } catch (err) {
      setError('Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, [fetchSummary, fetchDetailed, fetchUserPerformance]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle CSV export
  const handleExportCSV = async () => {
    try {
      setExporting(true);
      const response = await exportChecklistCSV(workspaceId, {
        clientId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        frequency: frequencyFilter !== 'all' ? frequencyFilter : undefined,
      });
      
      // Create download
      const blob = new Blob([response.data], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-report-${dateRange.startDate}-to-${dateRange.endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export CSV');
    } finally {
      setExporting(false);
    }
  };

  // Handle PDF export
  const handleExportPDF = async () => {
    try {
      setExporting(true);
      const response = await exportChecklistPDF(workspaceId, {
        clientId,
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        frequency: frequencyFilter !== 'all' ? frequencyFilter : undefined,
      });
      
      // Create download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `checklist-report-${dateRange.startDate}-to-${dateRange.endDate}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Export error:', err);
      setError('Failed to export PDF');
    } finally {
      setExporting(false);
    }
  };

  // Calculate completion rate color
  const getCompletionRateColor = (rate) => {
    if (rate >= 90) return '#16a34a';
    if (rate >= 70) return '#ca8a04';
    return '#dc2626';
  };

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

      {/* Filters */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap', alignItems: 'center' }}>
            <TextField
              label="Start Date"
              type="date"
              value={dateRange.startDate}
              onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <TextField
              label="End Date"
              type="date"
              value={dateRange.endDate}
              onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
              InputLabelProps={{ shrink: true }}
              size="small"
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Frequency</InputLabel>
              <Select
                value={frequencyFilter}
                label="Frequency"
                onChange={(e) => setFrequencyFilter(e.target.value)}
              >
                <MenuItem value="all">All</MenuItem>
                <MenuItem value="daily">Daily</MenuItem>
                <MenuItem value="weekly">Weekly</MenuItem>
                <MenuItem value="monthly">Monthly</MenuItem>
              </Select>
            </FormControl>
            <Button variant="outlined" onClick={fetchData}>Apply</Button>
            <Box sx={{ flex: 1 }} />
            <Button
              variant="outlined"
              startIcon={<TableChartIcon />}
              onClick={handleExportCSV}
              disabled={exporting}
            >
              Export CSV
            </Button>
            <Button
              variant="outlined"
              startIcon={<PictureAsPdfIcon />}
              onClick={handleExportPDF}
              disabled={exporting}
            >
              Export PDF
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      {summary && (
        <Grid container spacing={2} sx={{ mb: 3 }}>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%', backgroundColor: '#f0fdf4' }}>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#16a34a' }}>
                  {summary.completionRate?.toFixed(1)}%
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Overall Completion Rate
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={summary.completionRate || 0}
                  sx={{ 
                    mt: 1,
                    height: 8,
                    borderRadius: 4,
                    backgroundColor: '#dcfce7',
                    '& .MuiLinearProgress-bar': { backgroundColor: '#16a34a', borderRadius: 4 }
                  }}
                />
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%' }}>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#0f766e' }}>
                  {summary.totalOccurrences || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Total Occurrences
                </Typography>
                <Box sx={{ mt: 1, display: 'flex', gap: 1 }}>
                  <Chip label={`${summary.confirmed || 0} confirmed`} size="small" color="success" />
                  <Chip label={`${summary.missed || 0} missed`} size="small" color="error" />
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%', backgroundColor: '#fef3c7' }}>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#b45309' }}>
                  {summary.lateConfirmed || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Late Confirmations
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {summary.lateRate?.toFixed(1)}% of total confirmations
                </Typography>
              </CardContent>
            </Card>
          </Grid>
          <Grid item xs={12} md={3}>
            <Card sx={{ height: '100%', backgroundColor: '#dbeafe' }}>
              <CardContent>
                <Typography variant="h3" sx={{ fontWeight: 700, color: '#1d4ed8' }}>
                  {summary.exempt || 0}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Holiday Exemptions
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Items skipped due to holidays
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onChange={(e, v) => setActiveTab(v)} sx={{ mb: 2 }}>
        <Tab label="Item Performance" />
        <Tab label="User Performance" />
        <Tab label="Detailed Log" />
      </Tabs>

      {/* Item Performance Tab */}
      {activeTab === 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Frequency</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Total</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Confirmed</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Missed</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Completion Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {summary?.byItem?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No data for selected period</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                summary?.byItem?.map((item) => (
                  <TableRow key={item.item_id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {item.title}
                      </Typography>
                    </TableCell>
                    <TableCell>
                      <Chip label={item.frequency} size="small" />
                    </TableCell>
                    <TableCell>{item.client_name}</TableCell>
                    <TableCell align="center">{item.total}</TableCell>
                    <TableCell align="center">
                      <Typography color="success.main">{item.confirmed}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography color="error.main">{item.missed}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Typography sx={{ fontWeight: 600, color: getCompletionRateColor(item.rate) }}>
                          {item.rate?.toFixed(1)}%
                        </Typography>
                        {item.rate >= 90 ? (
                          <TrendingUpIcon sx={{ color: '#16a34a', fontSize: 18 }} />
                        ) : item.rate < 70 ? (
                          <TrendingDownIcon sx={{ color: '#dc2626', fontSize: 18 }} />
                        ) : null}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* User Performance Tab */}
      {activeTab === 1 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow sx={{ backgroundColor: '#f8fafc' }}>
                <TableCell sx={{ fontWeight: 600 }}>User</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Assigned Items</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Confirmed On Time</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Late Confirmed</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Missed</TableCell>
                <TableCell sx={{ fontWeight: 600 }} align="center">Completion Rate</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {userPerformance.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No data for selected period</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                userPerformance.map((user) => (
                  <TableRow key={user.user_id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {user.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {user.email}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">{user.assigned}</TableCell>
                    <TableCell align="center">
                      <Typography color="success.main">{user.on_time}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography color="warning.main">{user.late}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Typography color="error.main">{user.missed}</Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1 }}>
                        <Typography sx={{ fontWeight: 600, color: getCompletionRateColor(user.rate) }}>
                          {user.rate?.toFixed(1)}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={user.rate || 0}
                          sx={{
                            width: 60,
                            height: 6,
                            borderRadius: 3,
                            backgroundColor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': {
                              backgroundColor: getCompletionRateColor(user.rate),
                              borderRadius: 3,
                            }
                          }}
                        />
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Detailed Log Tab */}
      {activeTab === 2 && (
        <TableContainer component={Paper} sx={{ maxHeight: 500 }}>
          <Table stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Date</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Item</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Client</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Confirmed By</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Time</TableCell>
                <TableCell sx={{ fontWeight: 600, backgroundColor: '#f8fafc' }}>Remarks</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {detailed.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <Typography color="text.secondary">No detailed records for selected period</Typography>
                  </TableCell>
                </TableRow>
              ) : (
                detailed.map((record, index) => (
                  <TableRow key={index} hover>
                    <TableCell>
                      {formatShortDateIST(record.occurrence_date)}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {record.title}
                      </Typography>
                    </TableCell>
                    <TableCell>{record.client_name}</TableCell>
                    <TableCell>
                      <Chip
                        label={record.status}
                        size="small"
                        sx={{
                          backgroundColor: {
                            confirmed: '#dcfce7',
                            late_confirmed: '#fef3c7',
                            missed: '#fee2e2',
                            exempt: '#dbeafe',
                            pending: '#f1f5f9',
                          }[record.status],
                          color: {
                            confirmed: '#16a34a',
                            late_confirmed: '#b45309',
                            missed: '#dc2626',
                            exempt: '#1d4ed8',
                            pending: '#64748b',
                          }[record.status],
                        }}
                      />
                    </TableCell>
                    <TableCell>{record.confirmed_by || '—'}</TableCell>
                    <TableCell>
                      {record.confirmed_at 
                        ? formatTimeIST(record.confirmed_at)
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {record.remarks || '—'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}

export default ChecklistReports;
