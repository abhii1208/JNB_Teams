import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Paper,
  Typography,
  Card,
  CardContent,
  IconButton,
  LinearProgress,
  Avatar,
  AvatarGroup,
  Chip,
} from '@mui/material';
import FolderIcon from '@mui/icons-material/Folder';
import TaskAltIcon from '@mui/icons-material/TaskAlt';
import PendingActionsIcon from '@mui/icons-material/PendingActions';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import { getProjects, getApprovalCount } from '../../apiClient';
import api from '../../apiClient';

const stageColors = {
  'Planned': { bg: '#e0e7ff', text: '#3730a3' },
  'In-process': { bg: '#fef3c7', text: '#92400e' },
  'Completed': { bg: '#d1fae5', text: '#065f46' },
  'Dropped': { bg: '#fee2e2', text: '#991b1b' },
  'On-hold': { bg: '#f3e8ff', text: '#6b21a8' },
};

function Dashboard({ user, workspace, onNavigate }) {
  const [statCards, setStatCards] = React.useState([
    {
      title: 'Active Projects',
      value: '0',
      icon: <FolderIcon />,
      color: '#7c3aed',
      bgColor: 'rgba(124, 58, 237, 0.1)',
    },
    {
      title: 'Tasks Due Today',
      value: '0',
      icon: <TaskAltIcon />,
      color: '#f59e0b',
      bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
      title: 'Pending Approvals',
      value: '0',
      icon: <PendingActionsIcon />,
      color: '#ef4444',
      bgColor: 'rgba(239, 68, 68, 0.1)',
    },
    {
      title: 'Completion Rate',
      value: '0%',
      icon: <TrendingUpIcon />,
      color: '#0f766e',
      bgColor: 'rgba(15, 118, 110, 0.1)',
    },
  ]);

  const [recentTasks, setRecentTasks] = React.useState([]);
  const [topProjects, setTopProjects] = React.useState([]);

  React.useEffect(() => {
    const fetchDashboardData = async () => {
      if (!workspace?.id) return;
      
      try {
        // Fetch projects
        const projectsResponse = await getProjects(workspace.id, false);
        const projects = projectsResponse.data || [];
        const activeProjects = projects.filter(p => !p.archived);
        
        // Fetch all tasks across projects
        let allTasks = [];
        for (const project of activeProjects) {
          try {
            const tasksResponse = await api.get(`/api/tasks/project/${project.id}`);
            const projectTasks = (tasksResponse.data || []).map(t => ({
              ...t,
              project_name: project.name,
              project_id: project.id,
            }));
            allTasks = [...allTasks, ...projectTasks];
          } catch (err) {
            console.error(`Failed to fetch tasks for project ${project.id}:`, err);
          }
        }
        
        // Fetch pending approvals
        const approvalsResponse = await getApprovalCount(workspace.id);
        const pendingApprovals = approvalsResponse.data.count || 0;
        
        // Calculate stats
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tasksDueToday = allTasks.filter(t => {
          if (!t.due_date) return false;
          const dueDate = new Date(t.due_date);
          dueDate.setHours(0, 0, 0, 0);
          return dueDate.getTime() === today.getTime();
        }).length;
        
        const completedTasks = allTasks.filter(t => t.status === 'Closed').length;
        const completionRate = allTasks.length > 0 
          ? Math.round((completedTasks / allTasks.length) * 100) 
          : 0;
        
        setStatCards([
          {
            title: 'Active Projects',
            value: String(activeProjects.length),
            icon: <FolderIcon />,
            color: '#7c3aed',
            bgColor: 'rgba(124, 58, 237, 0.1)',
          },
          {
            title: 'Tasks Due Today',
            value: String(tasksDueToday),
            icon: <TaskAltIcon />,
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.1)',
          },
          {
            title: 'Pending Approvals',
            value: String(pendingApprovals),
            icon: <PendingActionsIcon />,
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.1)',
          },
          {
            title: 'Completion Rate',
            value: `${completionRate}%`,
            icon: <TrendingUpIcon />,
            color: '#0f766e',
            bgColor: 'rgba(15, 118, 110, 0.1)',
          },
        ]);
        
        // Get recent tasks (upcoming due dates)
        const upcomingTasks = allTasks
          .filter(t => t.due_date && t.status !== 'Closed')
          .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))
          .slice(0, 4);
        
        setRecentTasks(upcomingTasks);
        
        // Get top projects by task count
        const projectTaskCounts = activeProjects.map(p => ({
          ...p,
          taskCount: allTasks.filter(t => t.project_id === p.id).length,
          completedCount: allTasks.filter(t => t.project_id === p.id && t.status === 'Closed').length,
        }));
        
        const top3 = projectTaskCounts
          .sort((a, b) => b.taskCount - a.taskCount)
          .slice(0, 3);
        
        setTopProjects(top3);
        
      } catch (error) {
        console.error('Failed to fetch dashboard data:', error);
      }
    };
    
    fetchDashboardData();
  }, [workspace]);

  return (
    <Box sx={{ p: 4 }}>
      {/* Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Welcome back, {user?.first_name} {user?.last_name}! 👋
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Here's what's happening with your projects today.
        </Typography>
      </Box>

      {/* Stats Grid */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        {statCards.map((stat, index) => (
          <Grid item xs={12} sm={6} md={3} key={index}>
            <Card
              elevation={0}
              sx={{
                border: '1px solid rgba(148, 163, 184, 0.2)',
                borderRadius: 3,
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: '0 12px 40px rgba(15, 23, 42, 0.1)',
                },
              }}
            >
              <CardContent sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                  <Box
                    sx={{
                      width: 48,
                      height: 48,
                      borderRadius: 2,
                      backgroundColor: stat.bgColor,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: stat.color,
                    }}
                  >
                    {stat.icon}
                  </Box>
                  <IconButton size="small" sx={{ color: 'text.secondary' }}>
                    <ArrowForwardIcon fontSize="small" />
                  </IconButton>
                </Box>
                <Typography variant="h3" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {stat.value}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {stat.title}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Grid container spacing={3}>
        {/* Recent Tasks */}
        <Grid item xs={12} md={8}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
            }}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Recent Tasks</Typography>
              <Chip
                label="View all"
                size="small"
                onClick={() => onNavigate('tasks')}
                sx={{
                  cursor: 'pointer',
                  '&:hover': { backgroundColor: 'rgba(15, 118, 110, 0.1)' },
                }}
              />
            </Box>
            
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {recentTasks.length === 0 ? (
                <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                  No upcoming tasks
                </Typography>
              ) : (
                recentTasks.map((task) => {
                  // Format due date
                  let dueDateText = 'No due date';
                  if (task.due_date) {
                    const dueDate = new Date(task.due_date);
                    const today = new Date();
                    today.setHours(0, 0, 0, 0);
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    const dueDateOnly = new Date(dueDate);
                    dueDateOnly.setHours(0, 0, 0, 0);
                    
                    if (dueDateOnly.getTime() === today.getTime()) {
                      dueDateText = 'Due Today';
                    } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
                      dueDateText = 'Due Tomorrow';
                    } else {
                      dueDateText = `Due ${dueDate.toLocaleDateString()}`;
                    }
                  }
                  
                  // Get assignee initials
                  const assigneeInitials = task.assignee_name 
                    ? task.assignee_name.split(' ').map(n => n[0]).join('').toUpperCase()
                    : 'UN';

                  return (
                    <Box
                      key={task.id}
                      sx={{
                        p: 2,
                        borderRadius: 2,
                        backgroundColor: '#f8fafc',
                        border: '1px solid rgba(148, 163, 184, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        transition: 'all 0.2s ease',
                        cursor: 'pointer',
                        '&:hover': {
                          backgroundColor: '#f1f5f9',
                          borderColor: 'rgba(15, 118, 110, 0.3)',
                        },
                      }}
                    >
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1 }}>
                        <Avatar
                          sx={{
                            width: 36,
                            height: 36,
                            fontSize: '0.8rem',
                            fontWeight: 600,
                            bgcolor: '#0f766e',
                          }}
                        >
                          {assigneeInitials}
                        </Avatar>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {task.name}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {task.project_name}
                          </Typography>
                        </Box>
                      </Box>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <Chip
                          label={task.stage}
                          size="small"
                          sx={{
                            backgroundColor: stageColors[task.stage]?.bg || '#e0e7ff',
                            color: stageColors[task.stage]?.text || '#3730a3',
                            fontWeight: 500,
                            fontSize: '0.75rem',
                          }}
                        />
                        <Typography variant="caption" color="text.secondary">
                          {dueDateText}
                        </Typography>
                      </Box>
                    </Box>
                  );
                })
              )}
            </Box>
          </Paper>
        </Grid>

        {/* Activity & Progress */}
        <Grid item xs={12} md={4}>
          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
              mb: 3,
            }}
          >
            <Typography variant="h6" sx={{ mb: 3 }}>
              Project Progress
            </Typography>
            
            {topProjects.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                No projects yet
              </Typography>
            ) : (
              topProjects.map((project, index) => {
                const progress = project.taskCount > 0 
                  ? Math.round((project.completedCount / project.taskCount) * 100) 
                  : 0;
                const colors = ['#0f766e', '#7c3aed', '#f59e0b'];
                const color = colors[index % colors.length];
                
                return (
                  <Box key={project.id} sx={{ mb: 3 }}>
                    <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {project.name}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {progress}%
                      </Typography>
                    </Box>
                    <LinearProgress
                      variant="determinate"
                      value={progress}
                      sx={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: `${color}15`,
                        '& .MuiLinearProgress-bar': {
                          borderRadius: 4,
                          backgroundColor: color,
                        },
                      }}
                    />
                  </Box>
                );
              })
            )}
          </Paper>

          <Paper
            elevation={0}
            sx={{
              p: 3,
              border: '1px solid rgba(148, 163, 184, 0.2)',
              borderRadius: 3,
            }}
          >
            <Typography variant="h6" sx={{ mb: 2 }}>
              Team Activity
            </Typography>
            <AvatarGroup max={5} sx={{ justifyContent: 'flex-start', mb: 2 }}>
              <Avatar sx={{ bgcolor: '#0f766e' }}>JD</Avatar>
              <Avatar sx={{ bgcolor: '#7c3aed' }}>SM</Avatar>
              <Avatar sx={{ bgcolor: '#f59e0b' }}>AK</Avatar>
              <Avatar sx={{ bgcolor: '#ef4444' }}>PL</Avatar>
              <Avatar sx={{ bgcolor: '#06b6d4' }}>MR</Avatar>
            </AvatarGroup>
            <Typography variant="body2" color="text.secondary">
              5 team members active today
            </Typography>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}

export default Dashboard;
