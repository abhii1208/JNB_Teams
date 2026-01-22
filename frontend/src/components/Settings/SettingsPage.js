import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
  Avatar,
  Alert,
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import NotificationsIcon from '@mui/icons-material/Notifications';
import SecurityIcon from '@mui/icons-material/Security';
import PaletteIcon from '@mui/icons-material/Palette';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import { getUserSettings, updateUserProfile, changePassword, getWorkspaces, updateWorkspace } from '../../apiClient';

function SettingsPage({ user, workspace }) {
  const [activeTab, setActiveTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    email: '',
    username: '',
    userId: '',
    licenseType: '',
    createdAt: ''
  });
  const [workspaceMemberships, setWorkspaceMemberships] = useState([]);
  const [workspaceLogoUrl, setWorkspaceLogoUrl] = useState('');
  const [workspaceSaving, setWorkspaceSaving] = useState(false);

  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  // Fetch user settings and workspaces on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        setLoading(true);
        const [userData, workspacesData] = await Promise.all([
          getUserSettings(),
          getWorkspaces()
        ]);
        
        setProfile({
          firstName: userData.data.first_name || '',
          lastName: userData.data.last_name || '',
          email: userData.data.email || '',
          username: userData.data.username || '',
          userId: userData.data.id || '',
          licenseType: userData.data.license_type || 'free',
          createdAt: userData.data.created_at || ''
        });
        
        setWorkspaceMemberships(workspacesData.data || []);
        setError(null);
      } catch (err) {
        console.error('Error fetching user settings:', err);
        setError('Failed to load user settings');
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, []);

  useEffect(() => {
    if (!workspace) return;
    setWorkspaceLogoUrl(workspace.logo_url || workspace.logoUrl || '');
  }, [workspace?.id, workspace?.logo_url, workspace?.logoUrl]);

  const [notifications, setNotifications] = useState({
    taskAssigned: true,
    taskClosed: true,
    taskApproval: true,
    taskRejected: true,
    projectInvite: true,
    overdueReminders: true,
    emailDigest: 'daily',
  });

  const [preferences, setPreferences] = useState({
    theme: 'light',
    compactView: false,
    showCompletedTasks: false,
  });

  const handleSaveProfile = async () => {
    try {
      setLoading(true);
      await updateUserProfile({
        first_name: profile.firstName,
        last_name: profile.lastName,
      });
      setSuccess('Profile updated successfully');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating profile:', err);
      setError(err.response?.data?.error || 'Failed to update profile');
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setError('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      setError('New password must be at least 6 characters');
      return;
    }

    try {
      setLoading(true);
      await changePassword(passwordData.currentPassword, passwordData.newPassword);
      setSuccess('Password changed successfully');
      setError(null);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err.response?.data?.error || 'Failed to change password');
      setSuccess(null);
    } finally {
      setLoading(false);
    }
  };

  const canEditWorkspace = workspace?.role === 'Owner' || workspace?.role === 'Admin';

  const handleSaveWorkspaceBranding = async () => {
    if (!workspace?.id) return;
    if (!canEditWorkspace) {
      setError('Only workspace owners and admins can update branding.');
      return;
    }

    setWorkspaceSaving(true);
    try {
      const trimmed = workspaceLogoUrl.trim();
      const payload = { logo_url: trimmed || null };
      const res = await updateWorkspace(workspace.id, payload);
      setWorkspaceLogoUrl(res.data.logo_url || '');
      setSuccess('Workspace branding updated successfully');
      setError(null);
      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error('Error updating workspace branding:', err);
      setError(err.response?.data?.error || 'Failed to update workspace branding');
      setSuccess(null);
    } finally {
      setWorkspaceSaving(false);
    }
  };

  if (loading && !profile.email) {
    return (
      <Box sx={{ p: 4, display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
        <Typography>Loading...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Settings
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Manage your account settings and preferences
        </Typography>
      </Box>

      <Paper
        elevation={0}
        sx={{
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: 3,
        }}
      >
        <Tabs
          value={activeTab}
          onChange={(e, v) => setActiveTab(v)}
          sx={{
            px: 3,
            borderBottom: '1px solid rgba(148, 163, 184, 0.2)',
            '& .MuiTab-root': {
              textTransform: 'none',
              fontWeight: 500,
              minHeight: 56,
            },
          }}
        >
          <Tab icon={<PersonIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Profile" />
          <Tab icon={<NotificationsIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Notifications" />
          <Tab icon={<PaletteIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Preferences" />
          <Tab icon={<SecurityIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Security" />
          <Tab icon={<AccountCircleIcon sx={{ fontSize: 20 }} />} iconPosition="start" label="Account" />
        </Tabs>

        <Box sx={{ p: 4 }}>
          {/* Error/Success Messages */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 3 }} onClose={() => setSuccess(null)}>
              {success}
            </Alert>
          )}

          {/* Profile Tab */}
          {activeTab === 0 && (
            <Box sx={{ maxWidth: 600 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 3, mb: 4 }}>
                <Avatar
                  sx={{
                    bgcolor: '#0f766e',
                    width: 80,
                    height: 80,
                    fontSize: '2rem',
                    fontWeight: 600,
                  }}
                >
                  {profile.firstName?.[0] || 'U'}{profile.lastName?.[0] || ''}
                </Avatar>
                <Box>
                  <Typography variant="h6" sx={{ fontWeight: 600 }}>
                    {profile.firstName} {profile.lastName}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {profile.email}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    @{profile.username}
                  </Typography>
                </Box>
              </Box>

              <Typography variant="h6" sx={{ mb: 3 }}>
                Personal Information
              </Typography>

              <TextField
                fullWidth
                label="First Name"
                value={profile.firstName}
                onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                sx={{ mb: 3 }}
              />

              <TextField
                fullWidth
                label="Last Name"
                value={profile.lastName}
                onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                sx={{ mb: 3 }}
              />

              <TextField
                fullWidth
                label="Email"
                type="email"
                value={profile.email}
                disabled
                helperText="Email cannot be changed"
                sx={{ mb: 3 }}
              />

              <TextField
                fullWidth
                label="Username"
                value={profile.username}
                disabled
                helperText="Username cannot be changed"
                sx={{ mb: 3 }}
              />

              <Button
                variant="contained"
                sx={{ textTransform: 'none', px: 4 }}
                onClick={handleSaveProfile}
                disabled={loading}
              >
                {loading ? 'Saving...' : 'Save Changes'}
              </Button>
            </Box>
          )}

          {/* Notifications Tab */}
          {activeTab === 1 && (
            <Box sx={{ maxWidth: 700 }}>
              <Alert severity="info" sx={{ mb: 4, borderRadius: 2 }}>
                <Typography variant="body2">
                  Choose which notifications you want to receive. We'll send them via email and in-app.
                </Typography>
              </Alert>

              <Typography variant="h6" sx={{ mb: 3 }}>
                Task Notifications
              </Typography>

              <Box sx={{ mb: 4 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.taskAssigned}
                      onChange={(e) =>
                        setNotifications({ ...notifications, taskAssigned: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Task assignments
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        When a task is assigned to you
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.taskClosed}
                      onChange={(e) =>
                        setNotifications({ ...notifications, taskClosed: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Task closures
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        When your tasks are closed or approved
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.taskApproval}
                      onChange={(e) =>
                        setNotifications({ ...notifications, taskApproval: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Approval requests
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        When tasks require your approval
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.taskRejected}
                      onChange={(e) =>
                        setNotifications({ ...notifications, taskRejected: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Task rejections
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        When your task closure requests are rejected
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />

                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.overdueReminders}
                      onChange={(e) =>
                        setNotifications({ ...notifications, overdueReminders: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Overdue task reminders
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Daily reminders for overdue tasks
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 3 }}>
                Project & Team Notifications
              </Typography>

              <Box sx={{ mb: 4 }}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={notifications.projectInvite}
                      onChange={(e) =>
                        setNotifications({ ...notifications, projectInvite: e.target.checked })
                      }
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        Project invitations
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        When you're added to a new project
                      </Typography>
                    </Box>
                  }
                  sx={{ mb: 2, alignItems: 'flex-start' }}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Typography variant="h6" sx={{ mb: 3 }}>
                Email Digest
              </Typography>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Email Digest Frequency</InputLabel>
                <Select
                  value={notifications.emailDigest}
                  label="Email Digest Frequency"
                  onChange={(e) =>
                    setNotifications({ ...notifications, emailDigest: e.target.value })
                  }
                >
                  <MenuItem value="realtime">Real-time (as they happen)</MenuItem>
                  <MenuItem value="hourly">Hourly digest</MenuItem>
                  <MenuItem value="daily">Daily digest</MenuItem>
                  <MenuItem value="weekly">Weekly digest</MenuItem>
                  <MenuItem value="never">Never (disable email)</MenuItem>
                </Select>
              </FormControl>

              <Button
                variant="contained"
                sx={{ textTransform: 'none', px: 4 }}
              >
                Save Notification Settings
              </Button>
            </Box>
          )}

          {/* Preferences Tab */}
          {activeTab === 2 && (
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Display & Appearance
              </Typography>

              <FormControl fullWidth sx={{ mb: 3 }}>
                <InputLabel>Theme</InputLabel>
                <Select
                  value={preferences.theme}
                  label="Theme"
                  onChange={(e) => setPreferences({ ...preferences, theme: e.target.value })}
                >
                  <MenuItem value="light">Light</MenuItem>
                  <MenuItem value="dark">Dark</MenuItem>
                  <MenuItem value="auto">Auto (system default)</MenuItem>
                </Select>
              </FormControl>

              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.compactView}
                    onChange={(e) =>
                      setPreferences({ ...preferences, compactView: e.target.checked })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Compact view
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Show more content on screen with reduced spacing
                    </Typography>
                  </Box>
                }
                sx={{ mb: 2, alignItems: 'flex-start' }}
              />

              <FormControlLabel
                control={
                  <Switch
                    checked={preferences.showCompletedTasks}
                    onChange={(e) =>
                      setPreferences({ ...preferences, showCompletedTasks: e.target.checked })
                    }
                  />
                }
                label={
                  <Box>
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      Show completed tasks
                    </Typography>
                    <Typography variant="caption" color="text.secondary">
                      Display completed tasks in task lists by default
                    </Typography>
                  </Box>
                }
                sx={{ mb: 3, alignItems: 'flex-start' }}
              />

              <Button
                variant="contained"
                sx={{ textTransform: 'none', px: 4 }}
              >
                Save Preferences
              </Button>
            </Box>
          )}

          {/* Security Tab */}
          {activeTab === 3 && (
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>
                Change Password
              </Typography>

              <TextField
                fullWidth
                label="Current Password"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="New Password"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                helperText="At least 6 characters"
                sx={{ mb: 2 }}
              />

              <TextField
                fullWidth
                label="Confirm New Password"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                error={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword}
                helperText={passwordData.confirmPassword && passwordData.newPassword !== passwordData.confirmPassword ? "Passwords don't match" : ""}
                sx={{ mb: 3 }}
              />

              <Button
                variant="contained"
                sx={{ textTransform: 'none', px: 4, mb: 4 }}
                onClick={handleChangePassword}
                disabled={loading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
              >
                {loading ? 'Changing...' : 'Change Password'}
              </Button>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" sx={{ mb: 2, color: 'error.main' }}>
                Danger Zone
              </Typography>

              <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Delete Account
                </Typography>
                <Typography variant="caption">
                  Once you delete your account, there is no going back. This action is permanent.
                </Typography>
              </Alert>

              <Button
                variant="outlined"
                color="error"
                sx={{ textTransform: 'none' }}
              >
                Delete My Account
              </Button>
            </Box>
          )}

          {/* Account Tab */}
          {activeTab === 4 && (
            <Box sx={{ maxWidth: 600 }}>
              {workspace && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                    Workspace Branding
                  </Typography>

                  <Card elevation={0} sx={{ mb: 3, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
                    <CardContent>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                        <Avatar
                          src={workspaceLogoUrl || ''}
                          sx={{ width: 56, height: 56, bgcolor: '#0f766e' }}
                        >
                          {workspace.name?.[0] || 'W'}
                        </Avatar>
                        <Box>
                          <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                            {workspace.name}
                          </Typography>
                          <Typography variant="body2" color="text.secondary">
                            Logo is used on public share pages
                          </Typography>
                        </Box>
                      </Box>
                      <TextField
                        fullWidth
                        label="Logo URL"
                        value={workspaceLogoUrl}
                        onChange={(e) => setWorkspaceLogoUrl(e.target.value)}
                        helperText="Use a full https URL. Leave blank to remove."
                        sx={{ mb: 2 }}
                        disabled={!canEditWorkspace}
                      />
                      {!canEditWorkspace && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                          Only workspace owners and admins can update branding.
                        </Alert>
                      )}
                      <Button
                        variant="contained"
                        onClick={handleSaveWorkspaceBranding}
                        disabled={!canEditWorkspace || workspaceSaving}
                        sx={{ textTransform: 'none' }}
                      >
                        {workspaceSaving ? 'Saving...' : 'Save Branding'}
                      </Button>
                    </CardContent>
                  </Card>

                  <Divider sx={{ my: 4 }} />
                </>
              )}

              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Account Information
              </Typography>

              <Card elevation={0} sx={{ mb: 3, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    License Type
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500, mb: 2, textTransform: 'capitalize' }}>
                    {profile.licenseType}
                  </Typography>

                  <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1 }}>
                    Member Since
                  </Typography>
                  <Typography variant="body1" sx={{ fontWeight: 500 }}>
                    {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A'}
                  </Typography>
                </CardContent>
              </Card>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Workspace Memberships
              </Typography>

              {workspaceMemberships.length > 0 ? (
                <Card elevation={0} sx={{ mb: 3, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
                  <CardContent>
                    {workspaceMemberships.map((workspace, index) => (
                      <React.Fragment key={workspace.id}>
                        {index > 0 && <Divider sx={{ my: 2 }} />}
                        <Box>
                          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                            <Typography variant="body1" sx={{ fontWeight: 600 }}>
                              {workspace.name}
                            </Typography>
                            <Typography 
                              variant="caption" 
                              sx={{ 
                                px: 1.5, 
                                py: 0.5, 
                                borderRadius: 1, 
                                backgroundColor: workspace.role === 'Owner' ? '#d1fae5' : workspace.role === 'Admin' ? '#e0e7ff' : '#f3e8ff',
                                color: workspace.role === 'Owner' ? '#065f46' : workspace.role === 'Admin' ? '#3730a3' : '#6b21a8',
                                textTransform: 'capitalize'
                              }}
                            >
                              {workspace.role}
                            </Typography>
                          </Box>
                          <Typography variant="body2" color="text.secondary">
                            {workspace.members || 0} members • {workspace.projects || 0} projects
                          </Typography>
                        </Box>
                      </React.Fragment>
                    ))}
                  </CardContent>
                </Card>
              ) : (
                <Card elevation={0} sx={{ mb: 3, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
                  <CardContent>
                    <Typography variant="body2" color="text.secondary">
                      No workspace memberships yet.
                    </Typography>
                  </CardContent>
                </Card>
              )}

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Billing & Subscription
              </Typography>

              <Card elevation={0} sx={{ mb: 3, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="body1" sx={{ fontWeight: 600, mb: 1 }}>
                    Free Plan
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Perfect for small teams getting started
                  </Typography>
                  <Button variant="contained" sx={{ textTransform: 'none' }}>
                    Upgrade to Pro
                  </Button>
                </CardContent>
              </Card>

              <Divider sx={{ my: 4 }} />

              <Typography variant="h6" sx={{ mb: 3, fontWeight: 600 }}>
                Data Management
              </Typography>

              <Card elevation={0} sx={{ mb: 3, border: '1px solid rgba(148, 163, 184, 0.2)', borderRadius: 2 }}>
                <CardContent>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    Download a copy of your data including projects, tasks, and activity logs.
                  </Typography>
                  <Button variant="outlined" sx={{ textTransform: 'none' }}>
                    Export Data
                  </Button>
                </CardContent>
              </Card>
            </Box>
          )}
        </Box>
      </Paper>
    </Box>
  );
}

export default SettingsPage;
