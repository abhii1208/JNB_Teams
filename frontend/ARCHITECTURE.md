# Component Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                              App.js                                  │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │  Theme Provider + Snackbar Provider                         │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                          ↓                                           │
│           ┌──────────────┴──────────────┐                           │
│           │                             │                           │
│      Auth.js (Not logged in)      Landing.js (Logged in)           │
│                                         ↓                            │
│                                  MainLayout.js                       │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                         MainLayout.js                                │
│  ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓   │
│  ┃                                                              ┃   │
│  ┃  ┌──────────────┐  ┌─────────────────────────────────┐    ┃   │
│  ┃  │  Sidebar.js  │  │      Content Area              │    ┃   │
│  ┃  │              │  │                                 │    ┃   │
│  ┃  │  • Dashboard │  │  Renders based on currentPage:  │    ┃   │
│  ┃  │  • Workspaces│  │                                 │    ┃   │
│  ┃  │  • Projects  │  │  ┌───────────────────────────┐ │    ┃   │
│  ┃  │  • Tasks     │  │  │  Dashboard Component      │ │    ┃   │
│  ┃  │  • Team      │  │  │  OR                       │ │    ┃   │
│  ┃  │  • Settings  │  │  │  WorkspaceList/Detail     │ │    ┃   │
│  ┃  │  • Logout    │  │  │  OR                       │ │    ┃   │
│  ┃  │              │  │  │  ProjectList/Detail       │ │    ┃   │
│  ┃  │  User Info   │  │  │  OR                       │ │    ┃   │
│  ┃  │  [JD] John   │  │  │  TaskList/Detail          │ │    ┃   │
│  ┃  │              │  │  │  OR                       │ │    ┃   │
│  ┃  └──────────────┘  │  │  TeamPage                 │ │    ┃   │
│  ┃                     │  │  OR                       │ │    ┃   │
│  ┃                     │  │  SettingsPage             │ │    ┃   │
│  ┃                     │  └───────────────────────────┘ │    ┃   │
│  ┃                     └─────────────────────────────────┘    ┃   │
│  ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛   │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│                    Page Component Hierarchy                          │
└─────────────────────────────────────────────────────────────────────┘

1. Dashboard.js
   ├── Stat Cards (4)
   ├── Recent Tasks Section
   │   └── Task Cards (4)
   ├── Project Progress Section
   │   └── Progress Bars (3)
   └── Team Activity Section
       └── Avatar Group

2. WorkspaceList.js
   ├── Header (Create Workspace Button)
   ├── Search Bar
   └── Workspace Grid
       ├── Workspace Card 1
       ├── Workspace Card 2
       └── Workspace Card 3
           ├── Role Badge
           ├── Stats (projects, members)
           └── Context Menu

3. WorkspaceDetail.js
   ├── Header (Back Button, Settings)
   └── Tabs
       ├── Projects Tab
       │   ├── Project Cards Grid
       │   └── Create Project Button
       ├── Members Tab
       │   ├── Member List
       │   ├── Role Badges
       │   └── Invite Member Button
       └── Settings Tab
           └── Settings Form

4. ProjectList.js
   ├── Header (Create Project Button)
   ├── Search & Filter Bar
   └── Project Grid
       ├── Project Card 1
       ├── Project Card 2
       └── Project Card 3
           ├── Role Badge
           ├── Status Badge
           ├── Progress Bar
           ├── Stats (Open/Pending/Done)
           ├── Member Avatars
           └── Context Menu

5. ProjectDetail.js
   ├── Header (Back, Settings, New Task)
   ├── Stat Cards (4) - Open/Pending/Closed/Progress
   └── Tabs
       ├── Tasks Tab ⭐
       │   ├── Pending Approval Section (Highlighted)
       │   │   └── Task Cards with Approve/Reject
       │   ├── Open Tasks Section
       │   │   └── Task Cards
       │   └── Completed Tasks Section
       │       └── Task Cards
       ├── Members Tab
       │   ├── Member List
       │   ├── Role Badges
       │   └── Add Member Button
       └── Settings Tab ⭐⭐⭐ (IMPORTANT)
           ├── Task Creation Toggle
           ├── Task Closure Toggle
           ├── Admins Can Approve Toggle
           ├── Only Owner Approves Toggle
           ├── Require Rejection Reason Toggle
           └── Auto-close After Days Input

6. TaskList.js
   ├── Header (Create Task Button)
   ├── Search & Filter Bar
   ├── Pending Approval Section ⭐ (Highlighted)
   │   └── Task Cards with Quick Actions
   │       ├── Approve Button
   │       └── Reject Button
   └── All Tasks Grid
       └── Task Cards

7. TaskDetail.js ⭐⭐⭐ (MOST IMPORTANT PAGE)
   ├── Header (Back, Edit, Stage/Status Badges)
   ├── Pending Approval Alert (if applicable)
   │   ├── Approve Button
   │   └── Reject Button
   ├── Main Content (2 columns)
   │   ├── Left Column
   │   │   ├── Task Details Section
   │   │   │   ├── Description
   │   │   │   └── Request Closure Button ⭐
   │   │   │       └── Opens Confirmation Modal
   │   │   └── Activity & Comments Section
   │   │       ├── Activity Timeline
   │   │       └── Comment Input
   │   └── Right Column (Sidebar)
   │       ├── Task Information
   │       │   ├── Assignee
   │       │   ├── Collaborators
   │       │   ├── Due Date
   │       │   └── Created Date
   │       └── Task Lifecycle
   │           ├── Stage Chip
   │           └── Status Chip
   └── Dialogs
       ├── Request Closure Dialog ⭐
       │   ├── Explanation Text
       │   ├── Info Alert
       │   └── Confirm/Cancel Buttons
       ├── Approval Dialog
       │   ├── Success Alert
       │   └── Approve/Cancel Buttons
       └── Rejection Dialog ⭐
           ├── Rejection Reason TextField (Required)
           ├── Warning Alert
           └── Reject/Cancel Buttons

8. TeamPage.js
   ├── Access Control Check (Owner/Admin only)
   ├── Header (Invite Member Button)
   ├── Role Description Cards (3)
   ├── Search Bar
   └── Member List
       ├── Member Item 1
       ├── Member Item 2
       └── Member Item 3
           ├── Avatar
           ├── Name & Email
           ├── Role Badge
           ├── Stats (workspaces, projects)
           └── Context Menu (if Owner/Admin)

9. SettingsPage.js
   └── Tabs
       ├── Profile Tab
       │   ├── Avatar
       │   ├── Personal Info Form
       │   └── Timezone/Language Selects
       ├── Notifications Tab ⭐
       │   ├── Task Notifications Toggles
       │   ├── Project Notifications Toggles
       │   └── Email Digest Frequency
       ├── Preferences Tab
       │   ├── Theme Select
       │   ├── Compact View Toggle
       │   └── Show Completed Tasks Toggle
       └── Security Tab
           ├── Password Change Form
           └── Delete Account (Danger Zone)

┌─────────────────────────────────────────────────────────────────────┐
│                         Data Flow                                    │
└─────────────────────────────────────────────────────────────────────┘

Navigation State (in MainLayout):
  currentPage → Determines which component to render
  selectedWorkspace → Workspace context
  selectedProject → Project context
  selectedTask → Task context

  handleNavigate(page) → Changes currentPage, resets selections
  handleSelectWorkspace(workspace) → Sets selectedWorkspace
  handleSelectProject(project) → Sets selectedProject
  handleSelectTask(task) → Sets selectedTask
  handleBack() → Navigates back up the hierarchy

User Actions:
  1. Click Workspace → WorkspaceList → WorkspaceDetail
  2. Click Project → ProjectList → ProjectDetail
  3. Click Task → TaskList → TaskDetail
  4. Request Closure → Opens Modal → Changes Status
  5. Approve Task → Opens Modal → Closes Task
  6. Reject Task → Opens Modal (requires reason) → Reopens Task

┌─────────────────────────────────────────────────────────────────────┐
│                    Task Closure Workflow Diagram                     │
└─────────────────────────────────────────────────────────────────────┘

  Member View:                          Owner/Admin View:
  
  ┌──────────────┐                      ┌──────────────┐
  │ Task: Open   │                      │ Task List    │
  │ Stage: Work  │                      │              │
  └──────┬───────┘                      └──────────────┘
         │                                       
         │ Complete Work                         
         ↓                                       
  ┌──────────────────┐                           
  │ Stage → Completed│                           
  └──────┬───────────┘                           
         │                                       
         │ Click "Request Closure" Button        
         ↓                                       
  ┌─────────────────────────┐                    
  │ Confirmation Modal      │                    
  │ "Are you sure?"         │                    
  │ [Cancel] [Confirm]      │                    
  └──────┬──────────────────┘                    
         │ Confirm                               
         ↓                                       
  ┌──────────────────────────┐         ┌──────────────────────┐
  │ Status → Pending Approval│────────→│ Notification Sent    │
  │ Task now read-only       │         │ "Task needs approval"│
  └──────────────────────────┘         └──────┬───────────────┘
                                              │
                                              ↓
                                   ┌─────────────────────────┐
                                   │ Pending Approval Section│
                                   │ [Approve] [Reject]      │
                                   └──────┬──────────────────┘
                                          │
                        ┌─────────────────┴─────────────────┐
                        │                                   │
                        ↓ Approve                           ↓ Reject
              ┌─────────────────┐              ┌─────────────────────┐
              │ Approval Modal  │              │ Rejection Modal     │
              │ "Confirm?"      │              │ "Provide reason"    │
              │ [Yes]           │              │ [Required Field]    │
              └────┬────────────┘              └────┬────────────────┘
                   │                                │
                   ↓                                ↓
         ┌──────────────────┐           ┌──────────────────────┐
         │ Status → Closed  │           │ Status → Open        │
         │ Stage → Completed│           │ Add rejection comment│
         │ Task locked      │           │ Notify assignee      │
         │ Notify assignee  │           └──────────────────────┘
         └──────────────────┘           

┌─────────────────────────────────────────────────────────────────────┐
│                         Key Interactions                             │
└─────────────────────────────────────────────────────────────────────┘

1. ⭐ Request Task Closure (TaskDetail.js)
   - Only visible if: status=Open, stage=Completed, user is assignee
   - Button (NOT checkbox!)
   - Opens confirmation modal
   - Explains what happens next
   - On confirm: status → Pending Approval

2. ⭐ Approve Task (TaskDetail.js or TaskList.js)
   - Only visible if: status=Pending Approval, user is owner/admin
   - Button with green color
   - Opens approval modal
   - Shows what will happen
   - On confirm: status → Closed, stage → Completed, task locked

3. ⭐ Reject Task (TaskDetail.js or TaskList.js)
   - Only visible if: status=Pending Approval, user is owner/admin
   - Button with red color
   - Opens rejection modal
   - Requires rejection reason (TextField)
   - On confirm: status → Open, adds comment, notifies assignee

4. Edit Task (TaskDetail.js)
   - Only if: status ≠ Closed
   - Edit button in header
   - Toggles edit mode
   - Inline editing of fields

5. Change Stage (TaskDetail.js or TaskList.js)
   - Dropdown in edit mode
   - Options: Planned, In-process, Completed, On-hold, Dropped
   - Does NOT change status automatically

6. Project Settings (ProjectDetail.js)
   - Settings tab
   - Toggles for permissions
   - Affects what actions members can take
   - Saved per project

┌─────────────────────────────────────────────────────────────────────┐
│                     Permission Matrix                                │
└─────────────────────────────────────────────────────────────────────┘

                    │ Workspace │ Workspace │ Workspace │
                    │   Owner   │   Admin   │  Member   │
────────────────────┼───────────┼───────────┼───────────┤
Create Workspace    │    ✅     │    ❌     │    ❌     │
Delete Workspace    │    ✅     │    ❌     │    ❌     │
Manage Workspace    │    ✅     │    ✅     │    ❌     │
Invite Members      │    ✅     │    ✅     │    ❌     │
Remove Members      │    ✅     │    ✅     │    ❌     │
View Team Page      │    ✅     │    ✅     │    ❌     │
Create Projects     │    ✅     │    ✅     │    ❌*    │
Access Projects     │    ✅     │    ✅     │    ✅     │

* Project Admins can create projects (Workspace Member + Project Admin role)

                    │ Project   │ Project   │ Project   │
                    │   Owner   │   Admin   │  Member   │
────────────────────┼───────────┼───────────┼───────────┤
Delete Project      │    ✅     │    ❌     │    ❌     │
Edit Project        │    ✅     │    ✅     │    ❌     │
Project Settings    │    ✅     │    ✅     │    ❌     │
Add Members         │    ✅     │    ✅     │    ❌     │
Remove Members      │    ✅     │    ✅     │    ❌     │
Create Tasks        │    ✅     │    ✅     │    ✅*    │
Edit Tasks          │    ✅     │    ✅     │    ✅     │
Delete Tasks        │    ✅     │    ✅     │    ❌     │
Approve Closures    │    ✅     │    ✅*    │    ❌     │
Request Closure     │    ✅     │    ✅     │    ✅*    │

* Depends on project settings toggles

┌─────────────────────────────────────────────────────────────────────┐
│                    Color Coding Reference                            │
└─────────────────────────────────────────────────────────────────────┘

Primary: #0f766e  ████  Teal (main actions, buttons)
Secondary: #f59e0b ████  Amber (highlights, warnings)

Roles:
  Owner:   #065f46  ████  Dark Green
  Admin:   #3730a3  ████  Indigo
  Member:  #6b21a8  ████  Purple

Task Stages:
  Planned:     #3730a3  ████  Indigo
  In-process:  #92400e  ████  Orange
  Completed:   #065f46  ████  Green
  On-hold:     #6b21a8  ████  Purple
  Dropped:     #991b1b  ████  Red

Task Status:
  Open:              #92400e  ████  Orange
  Pending Approval:  #991b1b  ████  Red
  Closed:            #475569  ████  Gray
  Rejected:          #991b1b  ████  Red

┌─────────────────────────────────────────────────────────────────────┐
│                         File Dependencies                            │
└─────────────────────────────────────────────────────────────────────┘

App.js
  ├── imports Auth.js
  ├── imports Landing.js
  └── provides theme & snackbar

Landing.js
  └── imports MainLayout.js

MainLayout.js
  ├── imports Sidebar.js
  ├── imports Dashboard.js
  ├── imports WorkspaceList.js
  ├── imports WorkspaceDetail.js
  ├── imports ProjectList.js
  ├── imports ProjectDetail.js
  ├── imports TaskList.js
  ├── imports TaskDetail.js
  ├── imports TeamPage.js
  └── imports SettingsPage.js

All components import:
  ├── React
  ├── Material-UI components
  └── Material-UI icons

No external state management (Redux, etc.)
No routing library (handled manually in MainLayout)
No API client (mock data only)
```

This diagram shows the complete component architecture and data flow! 🎉
