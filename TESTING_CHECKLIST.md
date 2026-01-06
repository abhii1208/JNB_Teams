# Testing Checklist

## 🔐 Authentication Testing
- [ ] Login with valid credentials
- [ ] Login with invalid credentials
- [ ] Sign up new user
- [ ] Token persistence across page refreshes
- [ ] Logout functionality
- [ ] Auto-redirect on 401 errors

## 🏢 Workspace Management
- [ ] View list of workspaces
- [ ] Create new workspace
- [ ] Switch between workspaces
- [ ] Workspace persists after page refresh
- [ ] Empty workspace state handling
- [ ] View workspace members
- [ ] Invite new member to workspace
- [ ] Member roles display correctly

## 📁 Project Management
- [ ] View projects in current workspace
- [ ] Create new project with icon and color
- [ ] Edit existing project
- [ ] Project stats display correctly (task counts)
- [ ] Project members display correctly
- [ ] Filter/search projects
- [ ] Empty projects state

## ✅ Task Management
- [ ] View tasks in project (table view)
- [ ] View tasks in list view
- [ ] View tasks in board view
- [ ] View tasks in calendar view
- [ ] Create new task with all fields
- [ ] Edit existing task
- [ ] Change task stage
- [ ] Change task status
- [ ] Change task priority
- [ ] Assign task to user
- [ ] Add collaborators to task
- [ ] Set due date and target date
- [ ] Add notes to task
- [ ] Task filtering works
- [ ] Task sorting works
- [ ] Task grouping works

## 👥 Team Management
- [ ] View team members
- [ ] Invite new member
- [ ] Member roles display correctly
- [ ] Search members
- [ ] Member project counts accurate

## ✓ Approvals
- [ ] View all approvals
- [ ] Filter by Pending
- [ ] Filter by Approved
- [ ] Filter by Rejected
- [ ] Approve an approval
- [ ] Reject an approval with reason
- [ ] View approval details
- [ ] Approval count badge updates
- [ ] Approval status updates in real-time

## 📊 Activity Log
- [ ] View all activities
- [ ] Filter by activity type (Task/Project/Member)
- [ ] Filter by date (Today/This Week/All Time)
- [ ] Search activities
- [ ] Pagination works
- [ ] Activity details display correctly
- [ ] Timestamps format correctly
- [ ] User avatars display

## 🔔 Notifications
- [ ] View all notifications
- [ ] Filter by Unread
- [ ] Filter by Read
- [ ] Mark single notification as read
- [ ] Mark all as read
- [ ] Delete notification
- [ ] Notification count updates
- [ ] Notification timestamps
- [ ] Actionable notifications work

## 🎨 UI/UX Testing
- [ ] Loading states display correctly
- [ ] Error messages display properly
- [ ] Empty states show helpful messages
- [ ] Dialogs open and close smoothly
- [ ] Forms validate input
- [ ] Buttons disabled during API calls
- [ ] Success messages after actions
- [ ] Responsive design on mobile
- [ ] Color schemes consistent
- [ ] Icons display correctly

## 🔧 Error Handling
- [ ] Network errors handled gracefully
- [ ] 401 errors redirect to login
- [ ] Duplicate entries prevented
- [ ] Invalid data rejected
- [ ] Foreign key violations handled
- [ ] Empty required fields prevented

## 🚀 Performance Testing
- [ ] Initial load time acceptable
- [ ] API response times < 1 second
- [ ] No unnecessary re-renders
- [ ] Pagination reduces load
- [ ] Large lists perform well
- [ ] Multiple concurrent users supported

## 🔐 Security Testing
- [ ] JWT tokens in Authorization header
- [ ] Tokens expire correctly
- [ ] Unauthorized access blocked
- [ ] SQL injection prevented (parameterized queries)
- [ ] XSS prevention
- [ ] CORS configured correctly
- [ ] Sensitive data not exposed in API responses

## 🗄️ Database Testing
- [ ] Foreign key constraints work
- [ ] CASCADE deletes work correctly
- [ ] Unique constraints enforced
- [ ] CHECK constraints validated
- [ ] Indexes improve query performance
- [ ] Transactions rollback on errors

## 🔄 Integration Testing
- [ ] Create workspace → Add members → Create project flow
- [ ] Create project → Add tasks → Complete tasks flow
- [ ] Create task → Assign → Complete → Approve flow
- [ ] Activity logs generated for all actions
- [ ] Notifications triggered correctly
- [ ] Approval count updates everywhere

## Known Issues / Future Enhancements
- [ ] Settings page not yet integrated
- [ ] Notification badge count not real-time in TopAppBar
- [ ] Dashboard stats not implemented
- [ ] Rate limiting only on auth endpoints
- [ ] No WebSocket for real-time updates
- [ ] No email notifications
- [ ] No file attachments
- [ ] No task comments
- [ ] No project archiving
- [ ] No workspace deletion

## Priority Fixes
1. Test all CRUD operations end-to-end
2. Verify approval workflow completely
3. Test multi-user scenarios
4. Implement rate limiting on all endpoints
5. Add input validation to all API endpoints
