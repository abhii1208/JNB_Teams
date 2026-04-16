import React from 'react';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import FolderRoundedIcon from '@mui/icons-material/FolderRounded';
import AssignmentRoundedIcon from '@mui/icons-material/AssignmentRounded';
import ChatBubbleRoundedIcon from '@mui/icons-material/ChatBubbleRounded';
import AppsRoundedIcon from '@mui/icons-material/AppsRounded';
import RepeatRoundedIcon from '@mui/icons-material/RepeatRounded';
import PlaylistAddCheckRoundedIcon from '@mui/icons-material/PlaylistAddCheckRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import InsightsRoundedIcon from '@mui/icons-material/InsightsRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import ThumbUpAltRoundedIcon from '@mui/icons-material/ThumbUpAltRounded';
import AdminPanelSettingsRoundedIcon from '@mui/icons-material/AdminPanelSettingsRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import TimelineRoundedIcon from '@mui/icons-material/TimelineRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';

export const PAGE_TITLES = {
  dashboard: 'Home',
  projects: 'Projects',
  tasks: 'Tasks',
  chat: 'Chat',
  recurring: 'Recurring',
  checklist: 'Checklist',
  clients: 'Clients',
  services: 'Services',
  operations: 'Operations',
  support: 'Support',
  team: 'Team',
  approvals: 'Approvals',
  admin: 'Admin',
  notifications: 'Notifications',
  activity: 'Activity',
  settings: 'Settings',
};

export function getPrimaryMobileNav({ canViewChat }) {
  return [
    { id: 'dashboard', label: 'Home', icon: <DashboardRoundedIcon /> },
    { id: 'projects', label: 'Projects', icon: <FolderRoundedIcon /> },
    { id: 'tasks', label: 'Tasks', icon: <AssignmentRoundedIcon /> },
    ...(canViewChat ? [{ id: 'chat', label: 'Chat', icon: <ChatBubbleRoundedIcon /> }] : []),
    { id: 'more', label: 'More', icon: <AppsRoundedIcon /> },
  ];
}

export function getSecondaryMobileNav({
  isPersonalWorkspace,
  canViewClients,
  canViewTeam,
  canViewApprovals,
  canViewAdmin,
  canViewSupport,
}) {
  return [
    { id: 'recurring', label: 'Recurring', icon: <RepeatRoundedIcon /> },
    ...(!isPersonalWorkspace ? [{ id: 'checklist', label: 'Checklist', icon: <PlaylistAddCheckRoundedIcon /> }] : []),
    ...(canViewClients ? [{ id: 'clients', label: 'Clients', icon: <BusinessRoundedIcon /> }] : []),
    ...(!isPersonalWorkspace ? [{ id: 'services', label: 'Services', icon: <HandymanRoundedIcon /> }] : []),
    ...(!isPersonalWorkspace ? [{ id: 'operations', label: 'Operations', icon: <InsightsRoundedIcon /> }] : []),
    ...(canViewSupport ? [{ id: 'support', label: 'Support', icon: <SupportAgentRoundedIcon /> }] : []),
    ...(canViewTeam ? [{ id: 'team', label: 'Team', icon: <GroupRoundedIcon /> }] : []),
    ...(canViewApprovals ? [{ id: 'approvals', label: 'Approvals', icon: <ThumbUpAltRoundedIcon /> }] : []),
    ...(canViewAdmin ? [{ id: 'admin', label: 'Admin', icon: <AdminPanelSettingsRoundedIcon /> }] : []),
    { id: 'notifications', label: 'Notifications', icon: <NotificationsRoundedIcon /> },
    { id: 'activity', label: 'Activity', icon: <TimelineRoundedIcon /> },
    { id: 'settings', label: 'Settings', icon: <SettingsRoundedIcon /> },
  ];
}

export const MOBILE_ACTION_ITEMS = [
  { id: 'logout', label: 'Log out', icon: <LogoutRoundedIcon /> },
];
