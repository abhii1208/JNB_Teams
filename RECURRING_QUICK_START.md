# Recurring Module - Quick Start Guide

## 🚀 Getting Started

### 1. Restart Backend Server
```bash
cd backend
npm start
```

### 2. Verify Fix
```bash
# Run validation script
node scripts/validate-recurring-fixes.js
```

Expected output:
```
✓ tasks.series_id type: uuid
✓ recurring_series.id type: uuid
✓ Query executed successfully
✅ Validation complete!
```

---

## 📝 Using Recurring Series

### Create a Recurring Series
```bash
curl -X POST http://localhost:5000/api/recurring \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "workspace_id": 1,
    "project_id": 1,
    "title": "Daily Standup",
    "recurrence_rule": {
      "frequency": "daily",
      "interval": 1,
      "byWeekday": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    },
    "start_date": "2026-01-15",
    "timezone": "UTC"
  }'
```

### List Recurring Series
```bash
curl http://localhost:5000/api/recurring/workspace/1 \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Pause a Series
```bash
curl -X POST http://localhost:5000/api/recurring/1/pause \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🎨 Bulk Operations (NEW!)

### Pause Multiple Series
```bash
curl -X POST http://localhost:5000/api/recurring/bulk/pause \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"series_ids": [1, 2, 3]}'
```

### Resume Multiple Series
```bash
curl -X POST http://localhost:5000/api/recurring/bulk/resume \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"series_ids": [1, 2, 3]}'
```

### Update Multiple Series
```bash
curl -X PUT http://localhost:5000/api/recurring/bulk/update \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "series_ids": [1, 2],
    "updates": {
      "static_assignee_id": 5,
      "auto_close_after_days": 7
    }
  }'
```

### Get Status of Multiple Series
```bash
curl "http://localhost:5000/api/recurring/bulk/status?series_ids=1,2,3" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

---

## 🧪 Testing

### Run Full Test Suite
```bash
cd backend
node scripts/test-recurring-module.js
```

### Run Specific Tests
You can modify the test script to run only specific tests by commenting out others.

---

## 🐛 Troubleshooting

### Issue: "Invalid series ID" error
**Solution:** Ensure you're using numeric IDs. The API now validates all IDs.

### Issue: Empty series list
**Solution:** 
1. Check that you have series in the database
2. Verify workspace membership
3. Check `includePaused` and `includeDeleted` parameters

### Issue: Type mismatch errors
**Solution:** Restart the backend server to ensure all fixes are loaded.

---

## 📖 API Reference

### Recurring Series Endpoints
- `GET /api/recurring/presets` - Get recurrence presets
- `POST /api/recurring/validate` - Validate recurrence rule
- `POST /api/recurring/preview` - Preview occurrences
- `GET /api/recurring/workspace/:workspaceId` - List series
- `GET /api/recurring/:id` - Get single series
- `POST /api/recurring` - Create series
- `PUT /api/recurring/:id` - Update series
- `POST /api/recurring/:id/pause` - Pause series
- `POST /api/recurring/:id/resume` - Resume series
- `DELETE /api/recurring/:id` - Delete series
- `POST /api/recurring/:id/exception` - Add exception
- `POST /api/recurring/:id/generate` - Generate instances
- `GET /api/recurring/:id/audit` - Get audit history

### Bulk Operations Endpoints (NEW!)
- `POST /api/recurring/bulk/pause` - Pause multiple
- `POST /api/recurring/bulk/resume` - Resume multiple
- `POST /api/recurring/bulk/delete` - Delete multiple
- `PUT /api/recurring/bulk/update` - Update multiple
- `POST /api/recurring/bulk/generate` - Generate for multiple
- `GET /api/recurring/bulk/status` - Get status of multiple

---

## 🎯 Common Use Cases

### Daily Standup (Weekdays Only)
```json
{
  "title": "Daily Standup",
  "recurrence_rule": {
    "frequency": "daily",
    "interval": 1,
    "byWeekday": ["monday", "tuesday", "wednesday", "thursday", "friday"]
  },
  "start_date": "2026-01-15"
}
```

### Weekly Team Meeting (Every Monday)
```json
{
  "title": "Weekly Team Meeting",
  "recurrence_rule": {
    "frequency": "weekly",
    "interval": 1,
    "byWeekday": ["monday"]
  },
  "start_date": "2026-01-15"
}
```

### Monthly Review (Last Friday)
```json
{
  "title": "Monthly Review",
  "recurrence_rule": {
    "frequency": "monthly",
    "interval": 1,
    "byWeekday": ["friday"],
    "bySetPos": -1
  },
  "start_date": "2026-01-31"
}
```

### Quarterly Planning
```json
{
  "title": "Quarterly Planning",
  "recurrence_rule": {
    "frequency": "monthly",
    "interval": 3
  },
  "start_date": "2026-01-01"
}
```

---

## 🔍 Frontend Integration Example

```javascript
// React component example
import { useState, useEffect } from 'react';
import axios from 'axios';

function RecurringSeriesList() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchSeries();
  }, []);
  
  const fetchSeries = async () => {
    try {
      const response = await axios.get(
        `/api/recurring/workspace/${workspaceId}`,
        {
          params: {
            includePaused: true,
            includeDeleted: false
          }
        }
      );
      setSeries(response.data);
    } catch (error) {
      console.error('Failed to fetch series:', error);
    } finally {
      setLoading(false);
    }
  };
  
  const handleBulkPause = async (selectedIds) => {
    try {
      await axios.post('/api/recurring/bulk/pause', {
        series_ids: selectedIds
      });
      fetchSeries(); // Refresh list
    } catch (error) {
      console.error('Bulk pause failed:', error);
    }
  };
  
  if (loading) return <div>Loading...</div>;
  
  return (
    <div>
      <h2>Recurring Series</h2>
      {series.map(s => (
        <div key={s.id}>
          <h3>{s.title}</h3>
          <p>{s.rule_summary}</p>
          <span>{s.is_active ? '🟢 Active' : '🔴 Paused'}</span>
        </div>
      ))}
    </div>
  );
}
```

---

## 📚 Additional Resources

- **Full Documentation:** `backend/docs/RECURRING_FIX_SUMMARY.md`
- **Enhancement Roadmap:** `backend/docs/RECURRING_ENHANCEMENTS.md`
- **API Reference:** `backend/docs/RECURRING_API.md`
- **Test Scripts:** `backend/scripts/test-recurring-module.js`

---

## ✅ Verification Checklist

- [ ] Backend server restarted
- [ ] Validation script passes
- [ ] Can list recurring series
- [ ] Can create new series
- [ ] Can pause/resume series
- [ ] Bulk operations work
- [ ] Frontend loads without errors
- [ ] No console errors

---

**Need Help?** Check the full documentation in `RECURRING_MODULE_COMPLETE.md`
