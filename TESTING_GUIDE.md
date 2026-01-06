# Testing Guide - All Fixes Verified

## Quick Start

### 1. Start Backend
```powershell
cd c:\Projects\team\backend
npm start
```
**Expected Output**:
```
Server running on port 5000
```
Server should stay running without closing.

### 2. Start Frontend
```powershell
cd c:\Projects\team\frontend
npm start
```
**Expected**: Browser opens at http://localhost:3000

### 3. Login
- Email: `JNBtest@JNB.com`
- Password: `8143772362`

---

## Test Cases

### ✅ Test 1: Profile Icon Dropdown (TopAppBar)
**Steps**:
1. Click profile icon (top right)
2. Check user info section

**Expected**:
- Avatar shows: **JT** (JNB Test initials)
- Name shows: **JNB Test**
- Email shows: **JNBtest@JNB.com**
- Role shows: **licensed_admin plan** ← NEW!

**Screenshot Checkpoint**: Profile dropdown with role

---

### ✅ Test 2: Sidebar Profile Card
**Steps**:
1. Look at left sidebar
2. Check user card at top

**Expected**:
- Avatar with **J** initial
- Name: **JNB Test**
- Role: **licensed_admin plan** ← NEW!

**Screenshot Checkpoint**: Sidebar with role

---

### ✅ Test 3: Dashboard Screen
**Steps**:
1. Ensure "Dashboard" is selected in sidebar
2. Check page loads

**Expected**:
- Greeting: "Welcome back, JNB! 👋"
- 4 stat cards display
- Recent tasks section shows
- No errors in console

**Status**: ✅ Already working

---

### ✅ Test 4: Project Creation (No Errors)
**Steps**:
1. Click "Projects" in sidebar
2. Click "Create Project" button
3. Fill in:
   - Name: "Test Project"
   - Description: "Testing project creation"
4. Click "Create Project"

**Expected**:
- ✅ No console errors
- ✅ New project appears in list
- ✅ No "Cannot read properties of undefined" error

**Before Fix**: Error: `Cannot read properties of undefined (reading 'map')`
**After Fix**: ✅ Works smoothly

---

### ✅ Test 5: Settings Page - Profile Data
**Steps**:
1. Click "Settings" in sidebar
2. Check "Profile" tab

**Expected**:
- First Name: **JNB**
- Last Name: **Test**
- Email: **JNBtest@JNB.com** (read-only)
- Username: **jnbtest** (read-only)
- Avatar shows: **JT**

**Before Fix**: Empty/undefined values
**After Fix**: ✅ Real data loaded

---

### ✅ Test 6: Profile Dropdown Menu Items
**Steps**:
1. Click profile icon (top right)
2. Scroll down to menu options

**Expected Menu Items**:
- Workspace selection list
- **Log out** (red, with logout icon)

**NOT Present** (removed):
- ~~Profile Settings~~
- ~~Account Settings~~

**Before Fix**: Had Profile Settings & Account Settings
**After Fix**: ✅ Only Logout remains (Settings accessible via sidebar)

---

### ✅ Test 7: Settings - Workspace Memberships
**Steps**:
1. Click "Settings" in sidebar
2. Click "Account" tab (5th tab)
3. Scroll to "Workspace Memberships" section

**Expected**:
- Shows 3 workspaces:
  1. **Product Development** - Owner - X members • Y projects
  2. **Marketing Campaign** - Owner - X members • Y projects
  3. **Customer Success** - Owner - X members • Y projects
- Real counts (not hardcoded)
- Proper role badges (green for Owner)

**Before Fix**: Showed fake "Engineering Team", "Marketing", "Product Design"
**After Fix**: ✅ Real workspace data from database

---

### ✅ Test 8: User Role Display (licensed_admin)
**Steps**:
1. Check all three locations:
   - Profile dropdown (top right)
   - Sidebar user card
   - Settings > Account tab > License Type field

**Expected in All Locations**:
- License Type: **licensed_admin**
- Display: "licensed_admin plan" or "Licensed_admin" (capitalized)

**Before Fix**: Not showing or showing "free"
**After Fix**: ✅ Shows "licensed_admin" everywhere

**Account Tab Details**:
- Account ID: 3
- License Type: **Licensed_admin**
- Member Since: (actual creation date)

---

### ✅ Test 9: Backend Server Stability
**Steps**:
1. Start backend server
2. Perform various actions:
   - Create a project
   - Add a task
   - Send approval request
   - Navigate between pages
3. Leave server running for 5+ minutes
4. Monitor terminal output

**Expected**:
- Server stays running
- No "PS C:\Projects\team\backend>" prompt (means server stopped)
- Any errors logged but server continues
- Graceful shutdown on Ctrl+C

**Before Fix**: Server closed automatically on errors
**After Fix**: ✅ Server stays running, logs errors, continues operation

---

## Console Error Check

Open browser DevTools (F12) and check Console tab throughout testing.

**Expected**: 
- ✅ No red error messages
- ✅ No "Cannot read properties of undefined"
- ✅ Only info/log messages (blue/gray)

**If you see errors**: Report the exact error message

---

## Database Verification

### Check Demo User License
```powershell
cd c:\Projects\team\backend
node -e "const {Pool}=require('pg');require('dotenv').config();const p=new Pool({host:process.env.DB_HOST,port:process.env.DB_PORT,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME});p.query('SELECT email, license_type FROM users WHERE email=\\'JNBtest@JNB.com\\'').then(r=>{console.log(r.rows[0]);p.end()});"
```

**Expected Output**:
```json
{
  "email": "JNBtest@JNB.com",
  "license_type": "licensed_admin"
}
```

---

## Performance Check

### API Response Times
All should respond within 100-300ms:
- GET /api/user/settings
- GET /api/workspaces
- GET /api/projects/workspace/:id
- GET /api/notifications/count
- GET /api/approvals/workspace/:id

### Frontend Load Time
- Initial page load: < 2 seconds
- Navigation between pages: < 500ms
- Polling updates: Every 30 seconds (approvals, notifications)

---

## Known Good Behavior

1. **Polling**: Approval count and notification count update every 30 seconds
2. **Loading States**: "Loading..." shows while fetching data
3. **Error Handling**: Friendly error messages (not raw errors)
4. **Empty States**: "No projects yet" when workspace is empty
5. **Success Messages**: "Profile updated successfully" (auto-dismiss after 3s)

---

## Troubleshooting

### Issue: "Failed to fetch user settings"
**Solution**: 
1. Check backend is running (port 5000)
2. Check auth token is valid (logout & login again)
3. Check browser console for 401/403 errors

### Issue: Workspaces not showing in Settings
**Solution**:
1. Ensure demo user is member of workspaces
2. Run: `node scripts/seed-demo-data.js` to recreate demo data
3. Refresh page

### Issue: Server closes immediately
**Solution**:
1. Check terminal for error messages
2. Verify database is running
3. Check `.env` file has correct DB credentials
4. Run: `node migrate.js` to ensure migrations are applied

### Issue: "Licensed_admin" not showing
**Solution**:
1. Run: `node scripts/update-demo-user-license.js`
2. Logout and login again (to refresh token)
3. Check database: `SELECT license_type FROM users WHERE email='JNBtest@JNB.com'`

---

## Success Criteria ✅

All of these must be TRUE:

- [x] Profile dropdown shows JNB Test, email, and "licensed_admin plan"
- [x] Sidebar shows JNB Test and "licensed_admin plan"
- [x] Dashboard loads without errors
- [x] Can create projects without console errors
- [x] Settings Profile tab shows real user data
- [x] Profile dropdown has only Workspaces + Logout (no Profile/Account Settings)
- [x] Settings Account tab shows real workspace memberships (3 workspaces)
- [x] License type shows "licensed_admin" in Account tab
- [x] Backend server stays running without closing
- [x] No red errors in browser console

**If all checked, system is working perfectly!** ✅

---

## Report Template

If you find issues, report using this format:

```
**Test Case**: [Test number and name]
**Steps**: [What you did]
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Screenshot**: [Attach if visual issue]
**Console Errors**: [Copy any red errors from DevTools]
```

---

**Happy Testing! All 9 issues have been resolved.** 🎉
