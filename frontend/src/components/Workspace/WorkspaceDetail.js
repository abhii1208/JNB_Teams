import React, { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Dialog,
          {/* Projects Tab */}
          {activeTab === 0 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Projects</Typography>
                {['Owner','Admin','ProjectAdmin'].includes(workspace?.role) && (
                <Button
                  variant="contained"
                  startIcon={<AddIcon />}
                  onClick={() => setCreateProjectOpen(true)}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  New Project
                </Button>
                )}
              </Box>

              <Grid container spacing={2}>
                {/* Projects will be rendered here by parent list; placeholder kept intentionally empty */}
              </Grid>
            </>
          )}

          {/* Members Tab */}
          {activeTab === 1 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Members ({members.length})</Typography>
                {['Owner','Admin'].includes(workspace?.role) && (
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={() => setInviteDialogOpen(true)}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Invite Member
                </Button>
                )}
              </Box>

              <List sx={{ mx: -2 }}>
                {members.map((member) => {
                  const name = (member.first_name || '') + (member.last_name ? ' ' + member.last_name : '');
                  const initials = (member.first_name ? member.first_name.charAt(0) : '') + (member.last_name ? member.last_name.charAt(0) : '');
                  const role = member.role || 'Member';
                  return (
                  <ListItem
                    key={member.id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#0f766e', fontWeight: 600 }}>
                        {member.avatar || initials}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={name || member.username || member.email}
                      secondary={member.email}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                    <Chip
                      label={role}
                      size="small"
                      sx={{
                        backgroundColor: roleColors[role]?.bg,
                        color: roleColors[role]?.text,
                        fontWeight: 500,
                      }}
                    />
                  </ListItem>
                )})}
              </List>
            </>
          )}
                  <Grid item xs={12} sm={6} lg={4} key={project.id}>
                    <Card
                      elevation={0}
                      onClick={() => onSelectProject(project)}
                      sx={{
                        border: '1px solid rgba(148, 163, 184, 0.2)',
                        borderRadius: 2,
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        '&:hover': {
                          borderColor: '#0f766e',
                          backgroundColor: 'rgba(15, 118, 110, 0.02)',
                        },
                      }}
                    >
                      <CardContent>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 2 }}>
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 1.5,
                              backgroundColor: 'rgba(15, 118, 110, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#0f766e',
                            }}
                          >
                            <FolderIcon />
                          </Box>
                          <Box sx={{ flex: 1 }}>
                            <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                              {project.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {project.completedTasks}/{project.taskCount} tasks
                            </Typography>
                          </Box>
                          <Chip
                            label={project.status}
                            size="small"
                            sx={{
                              backgroundColor: project.status === 'Active' ? '#d1fae5' : '#e2e8f0',
                              color: project.status === 'Active' ? '#065f46' : '#475569',
                              fontWeight: 500,
                              fontSize: '0.7rem',
                            }}
                          />
                        </Box>
                        <Box
                          sx={{
                            height: 6,
                            backgroundColor: 'rgba(148, 163, 184, 0.2)',
                            borderRadius: 3,
                            overflow: 'hidden',
                          }}
                        >
                          <Box
                            sx={{
                              height: '100%',
                              width: `${(project.completedTasks / project.taskCount) * 100}%`,
                              backgroundColor: '#0f766e',
                              borderRadius: 3,
                            }}
                          />
                        </Box>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </>
          )}

          {/* Members Tab */}
          {activeTab === 1 && (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                <Typography variant="h6">Members ({mockMembers.length})</Typography>
                <Button
                  variant="contained"
                  startIcon={<PersonAddIcon />}
                  onClick={() => setInviteDialogOpen(true)}
                  sx={{ textTransform: 'none', borderRadius: 2 }}
                >
                  Invite Member
                </Button>
              </Box>

              <List sx={{ mx: -2 }}>
                {mockMembers.map((member) => (
                  <ListItem
                    key={member.id}
                    sx={{
                      borderRadius: 2,
                      mb: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(148, 163, 184, 0.1)',
                      },
                    }}
                  >
                    <ListItemAvatar>
                      <Avatar sx={{ bgcolor: '#0f766e', fontWeight: 600 }}>
                        {member.avatar}
                      </Avatar>
                    </ListItemAvatar>
                    <ListItemText
                      primary={member.name}
                      secondary={member.email}
                      primaryTypographyProps={{ fontWeight: 500 }}
                    />
                    <Chip
                      label={member.role}
                      size="small"
                      sx={{
                        backgroundColor: roleColors[member.role]?.bg,
                        color: roleColors[member.role]?.text,
                        fontWeight: 500,
                        fontSize: '0.75rem',
                        mr: 2,
                      }}
                    />
                    <ListItemSecondaryAction>
                      <IconButton size="small">
                        <MoreVertIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            </>
          )}

          {/* Settings Tab */}
          {activeTab === 2 && (
            <Box sx={{ maxWidth: 600 }}>
              <Typography variant="h6" sx={{ mb: 3 }}>Workspace Settings</Typography>
              
              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600 }}>
                  General Information
                </Typography>
                <TextField
                  fullWidth
                  label="Workspace Name"
                  defaultValue={workspace.name}
                  sx={{ mb: 2 }}
                />
                <TextField
                  fullWidth
                  label="Description"
                  defaultValue={workspace.description}
                  multiline
                  rows={3}
                />
              </Box>

              <Divider sx={{ my: 3 }} />

              <Box sx={{ mb: 4 }}>
                <Typography variant="subtitle2" sx={{ mb: 2, fontWeight: 600, color: 'error.main' }}>
                  Danger Zone
                </Typography>
                <Button variant="outlined" color="error" sx={{ textTransform: 'none' }}>
                  Delete Workspace
                </Button>
              </Box>
            </Box>
          )}
        </Box>
      </Paper>

      {/* Invite Member Dialog */}
      <Dialog
        open={inviteDialogOpen}
        onClose={() => setInviteDialogOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Invite Team Member</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Email Address"
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            sx={{ mb: 3, mt: 1 }}
          />
          <FormControl fullWidth>
            <InputLabel>Role</InputLabel>
            <Select
              value={inviteRole}
              label="Role"
              onChange={(e) => setInviteRole(e.target.value)}
            >
              <MenuItem value="Admin">Admin (Same as Owner)</MenuItem>
              <MenuItem value="Project Admin">Project Admin (Can create projects)</MenuItem>
              <MenuItem value="Member">Member</MenuItem>
            </Select>
          </FormControl>
          <Box sx={{ mt: 2, p: 2, borderRadius: 2, backgroundColor: '#f8fafc' }}>
            <Typography variant="caption" color="text.secondary">
              <strong>Owner/Admin:</strong> Full access to workspace settings, members, and all projects<br />
              <strong>Project Admin:</strong> Can create and manage projects<br />
              <strong>Member:</strong> Can view and work on assigned projects
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setInviteDialogOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" sx={{ textTransform: 'none', px: 3 }}>
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create Project Dialog */}
      <Dialog
        open={createProjectOpen}
        onClose={() => setCreateProjectOpen(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{ sx: { borderRadius: 3 } }}
      >
        <DialogTitle sx={{ fontWeight: 600 }}>Create New Project</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Project Name"
            value={newProject.name}
            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
            sx={{ mb: 3, mt: 1 }}
          />
          <TextField
            fullWidth
            label="Description"
            value={newProject.description}
            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
            multiline
            rows={3}
          />
        </DialogContent>
        <DialogActions sx={{ p: 3, pt: 0 }}>
          <Button onClick={() => setCreateProjectOpen(false)} sx={{ textTransform: 'none' }}>
            Cancel
          </Button>
          <Button variant="contained" sx={{ textTransform: 'none', px: 3 }}>
            Create Project
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default WorkspaceDetail;