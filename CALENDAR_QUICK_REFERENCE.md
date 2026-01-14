# Calendar Features - Quick Reference Card

## 🎯 ONE-PAGE CHEAT SHEET

### Top Controls (Header Row)
```
[←] [→] January 2026 [Today]  [Day][Week][Month]  [Compact][Comfortable]  [Filter]
```

| Control | Action |
|---------|--------|
| `← →` | Navigate month/week/day |
| `[Today]` | Jump to today |
| `[Day][Week][Month]` | Change view mode |
| `[Compact][Comfortable]` | Change density |
| `[Filter]` | Open filter menu |

### Date Mode Toggle (Center)
```
[🎯 Due Date] ↔ [📅 Target Date]
```
- Click to switch between due dates and target dates
- Preference saved automatically

### Calendar Cells
```
┌────────────┐
│ 15    [3]  │ ← Click date number for task list
│ Task 1 🔁  │ ← Drag task to reschedule
│ Task 2 ⚠️  │ ← Click task to edit
│ +1 more    │ ← Click to see all tasks
└────────────┘
```

### Task Chip Colors
| Color | Meaning |
|-------|---------|
| **Left Border** | Priority (Red=Critical, Orange=High, Yellow=Medium, Green=Low) |
| **Text** | Date urgency (Red=Overdue, Orange=Today, Blue=Soon, Gray=Future) |
| **Background** | Status (Blue=Open, Yellow=In Progress, Purple=Review, Green=Done) |

### Icons
| Icon | Meaning |
|------|---------|
| 🔁 | Recurring task (purple) |
| ⚠️ | Overdue task (red) |
| 🔴 | Today's date (red circle) |

### Quick Actions
| Action | How To |
|--------|--------|
| **View tasks for a date** | Click the date number |
| **Edit a task** | Click task chip OR click date → click task in dialog |
| **Reschedule a task** | Drag task chip to new date |
| **Filter tasks** | Click filter icon → select status/priority |
| **Change view** | Click Day/Week/Month buttons |
| **Adjust density** | Click Compact/Comfortable buttons |
| **Switch date mode** | Click Due Date or Target Date toggle |

### Keyboard Shortcuts (Future)
- `j/k` - Navigate dates
- `t` - Go to today
- `f` - Open filters
- `Esc` - Close dialogs

### Legend (Bottom of Calendar)
Always visible, explains all colors and icons

---

## 📊 Feature Matrix

| Feature | Location | Keyboard | Persistent |
|---------|----------|----------|------------|
| Date Mode Toggle | Center header | Tab + Enter | ✅ Yes |
| View Mode | Top right | Tab + Enter | ❌ No |
| Density | Top right | Tab + Enter | ✅ Yes |
| Filters | Top right | Tab + Enter | ❌ No |
| Date Dialog | Click date | Enter | N/A |
| Task Edit | Click task | Enter | N/A |
| Drag & Drop | Drag task | N/A | N/A |

---

## 🎨 Color Reference

### Priority Colors (Left Border)
```
███ #dc2626 - Critical
███ #ea580c - High
███ #ca8a04 - Medium
███ #16a34a - Low
```

### Date-Based Text Colors
```
Red    #dc2626 - Overdue
Orange #f97316 - Due today
Blue   #3b82f6 - Next 3 days
Gray   #64748b - Future
```

### Status Background Colors
```
Light Blue   #eff6ff  - Open
Light Yellow #fef3c7  - In Progress
Light Purple #f3e8ff  - Under Review
Light Green  #dcfce7  - Completed
Light Gray   #f1f5f9  - Closed
```

### Special Highlights
```
Red Circle #dc2626 - Today's date
Red Badge  #dc2626 - Today's task count
Red Tint   #fef2f2 - Today's cell background
```

---

## 🔧 Troubleshooting

| Problem | Solution |
|---------|----------|
| **Tasks showing on wrong date** | Fixed! Date-only strings prevent timezone issues |
| **Date dialog not opening** | Ensure you click the date number, not the cell |
| **Drag not working** | Click and hold task chip, then drag to date |
| **Filters not applying** | Click "Apply" button after selecting filters |
| **Toggle not persisting** | Check browser localStorage is enabled |
| **Tasks not updating** | Check network tab for API errors |

---

## 💡 Pro Tips

1. **Weekly Planning**: Use Week view + Due Date mode
2. **Daily Focus**: Use Day view + filters for today's priorities
3. **Month Overview**: Use Month view + Compact density
4. **Task Rescheduling**: Drag & drop is faster than editing
5. **Quick Task Details**: Click date number instead of scrolling through chips
6. **Filter Combinations**: Combine Status + Priority for precise views
7. **Persistent Preferences**: Date mode and density save automatically
8. **Today Navigation**: Use [Today] button when lost in calendar
9. **Dense Data**: Switch to Compact when many tasks per day
10. **Target vs Due**: Use Target for planning, Due for deadlines

---

## 📱 View Recommendations

| Scenario | Best View | Best Density |
|----------|-----------|--------------|
| Weekly planning | Week | Comfortable |
| Daily execution | Day | Comfortable |
| Month overview | Month | Compact |
| Team standup | Week | Comfortable |
| Sprint planning | Month | Compact |
| Personal tasks | Day | Comfortable |
| Project timeline | Month | Comfortable |
| Quick check | Month | Compact |

---

## 🎯 Common Workflows

### Workflow 1: Reschedule Overdue Tasks
1. Look for red text (overdue tasks)
2. Drag task to new date
3. Success notification confirms

### Workflow 2: Plan Next Week
1. Click [Week] view
2. Click → to go to next week
3. Review task distribution
4. Drag tasks to balance load

### Workflow 3: Focus on Today
1. Click [Day] view
2. Click [Today] button
3. Click [Filter] → Select priorities
4. Execute tasks in order

### Workflow 4: Review Monthly Goals
1. Click [Month] view
2. Click [Compact] for overview
3. Click date numbers to see details
4. Adjust dates as needed

### Workflow 5: Switch Between Dates
1. Toggle [Target Date] to see deadlines
2. Toggle [Due Date] to see commitments
3. Compare and adjust

---

## 📊 Data Display Limits

| View | Max Visible Tasks/Cell | "+X more" Link |
|------|------------------------|----------------|
| Month (Comfortable) | 3 | Yes |
| Month (Compact) | 2 | Yes |
| Week (Comfortable) | 8 | Yes |
| Week (Compact) | 8 | Yes |
| Day | 8+ | Yes |

All tasks are always accessible via date dialog.

---

## ✅ Testing Checklist (User)

Quick verification before using:

- [ ] Can switch between Due/Target dates
- [ ] Can switch between Month/Week/Day views
- [ ] Can click date to see task list
- [ ] Can edit task from dialog
- [ ] Can drag task to new date
- [ ] Can filter by status
- [ ] Can filter by priority
- [ ] Today's date is highlighted in red
- [ ] Overdue tasks show ⚠️ icon
- [ ] Recurring tasks show 🔁 icon
- [ ] Legend explains all colors
- [ ] Task count badges display correctly

If all checked ✅, calendar is working perfectly!

---

## 🚀 Performance Expectations

| Action | Expected Speed |
|--------|----------------|
| View switch | <50ms |
| Filter apply | <10ms |
| Date navigation | <50ms |
| Dialog open | <20ms |
| Drag & drop | <100ms |
| Task update | <500ms (API) |

If slower, check network connection or API performance.

---

## 🎉 Summary

**What's New**:
- ✅ 11 major features
- ✅ 1 critical bug fix
- ✅ Professional UI/UX
- ✅ Fast & responsive
- ✅ Production-ready

**How to Use**:
- Click, drag, toggle
- Everything is intuitive
- Legend explains everything
- Preferences persist

**Best Practices**:
- Use Week view for planning
- Use Day view for execution
- Use filters to focus
- Use drag & drop to reschedule
- Check legend if confused

**Ready to go!** 🚀
