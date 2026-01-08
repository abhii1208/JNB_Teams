# Recurring Module API Documentation

## Overview

The Recurring Module provides a comprehensive system for managing recurring tasks with support for flexible recurrence rules, exceptions, assignment rotation, and automated task generation.

## Base URL

```
/api/recurring
```

## Authentication

All endpoints require authentication via Bearer token:

```
Authorization: Bearer <token>
```

---

## Endpoints

### 1. List All Series

**GET** `/api/recurring`

Returns all recurring series for the current workspace.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `workspace_id` | integer | Filter by workspace (optional) |
| `project_id` | integer | Filter by project (optional) |
| `status` | string | Filter: `active`, `paused`, `ended` (optional) |

#### Response

```json
[
  {
    "id": 1,
    "title": "Weekly Team Meeting",
    "description": "Regular sync-up meeting",
    "recurrence_rule": {
      "frequency": "weekly",
      "interval": 1,
      "byDayOfWeek": ["MO"],
      "timeOfDay": "10:00"
    },
    "start_date": "2024-01-01",
    "end_date": null,
    "timezone": "America/New_York",
    "lead_days": 3,
    "assignment_strategy": "fixed",
    "paused_at": null,
    "total_instances": 10,
    "completed_instances": 5,
    "rule_summary": "Every Monday at 10:00 AM",
    "project_name": "Team Operations",
    "created_at": "2024-01-01T00:00:00Z"
  }
]
```

---

### 2. Get Series Details

**GET** `/api/recurring/:id`

Returns detailed information about a specific series including recent instances, exceptions, and rotation members.

#### Response

```json
{
  "id": 1,
  "title": "Weekly Team Meeting",
  "description": "Regular sync-up meeting",
  "recurrence_rule": { ... },
  "start_date": "2024-01-01",
  "end_date": null,
  "timezone": "America/New_York",
  "lead_days": 3,
  "assignment_strategy": "fixed",
  "default_assignee_id": 1,
  "assignee_name": "John Doe",
  "requires_approval": false,
  "approver_id": null,
  "auto_close_after_days": null,
  "paused_at": null,
  "rule_summary": "Every Monday at 10:00 AM",
  "recent_instances": [
    {
      "id": 101,
      "title": "Weekly Team Meeting",
      "due_date": "2024-01-08",
      "status": "Completed",
      "assignee_name": "John Doe",
      "is_exception": false
    }
  ],
  "exceptions": [
    {
      "id": 1,
      "original_date": "2024-01-15",
      "exception_type": "skip",
      "new_date": null,
      "reason": "Holiday"
    }
  ],
  "rotation_members": []
}
```

---

### 3. Create Series

**POST** `/api/recurring`

Creates a new recurring series.

#### Request Body

```json
{
  "title": "Weekly Team Meeting",
  "description": "Regular sync-up meeting every Monday",
  "recurrence_rule": {
    "frequency": "weekly",
    "interval": 1,
    "byDayOfWeek": ["MO"],
    "timeOfDay": "10:00"
  },
  "start_date": "2024-01-01",
  "end_date": null,
  "timezone": "America/New_York",
  "lead_days": 3,
  "assignment_strategy": "fixed",
  "default_assignee_id": 1,
  "requires_approval": false,
  "approver_id": null,
  "auto_close_after_days": null,
  "workspace_id": 1,
  "project_id": 1,
  "rotation_members": []
}
```

#### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | string | Series title |
| `recurrence_rule` | object | RRULE specification (see below) |
| `start_date` | date | First occurrence date |

#### Optional Fields

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `description` | string | null | Series description |
| `end_date` | date | null | Last occurrence date |
| `timezone` | string | UTC | IANA timezone |
| `lead_days` | integer | 1 | Days before due date to create task |
| `assignment_strategy` | string | "fixed" | `fixed`, `round_robin`, `unassigned` |
| `default_assignee_id` | integer | null | Default assignee user ID |
| `requires_approval` | boolean | false | Require approval for tasks |
| `approver_id` | integer | null | Approver user ID |
| `auto_close_after_days` | integer | null | Auto-close incomplete tasks after N days |
| `project_id` | integer | null | Associated project |
| `rotation_members` | array | [] | User IDs for round-robin rotation |

#### Response

```json
{
  "id": 1,
  "title": "Weekly Team Meeting",
  "created_at": "2024-01-01T00:00:00Z"
}
```

---

### 4. Update Series

**PUT** `/api/recurring/:id`

Updates an existing series.

#### Request Body

All fields from create are optional. Additional field:

| Field | Type | Options | Description |
|-------|------|---------|-------------|
| `scope` | string | `this_only`, `this_and_future`, `all` | Edit scope |

```json
{
  "title": "Updated Title",
  "scope": "this_and_future"
}
```

#### Scope Behavior

- **`this_only`**: Only update metadata, not future instances
- **`this_and_future`**: Split series, apply changes from now onward
- **`all`**: Update all aspects including past (where applicable)

---

### 5. Delete Series

**DELETE** `/api/recurring/:id`

Soft-deletes a series. Existing generated tasks are preserved.

#### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `delete_tasks` | boolean | Also delete future pending tasks (default: false) |

---

### 6. Pause Series

**POST** `/api/recurring/:id/pause`

Pauses a series. No new tasks will be generated while paused.

#### Response

```json
{
  "message": "Series paused",
  "paused_at": "2024-01-15T10:00:00Z"
}
```

---

### 7. Resume Series

**POST** `/api/recurring/:id/resume`

Resumes a paused series.

#### Response

```json
{
  "message": "Series resumed",
  "resumed_at": "2024-01-20T09:00:00Z"
}
```

---

### 8. Add Exception

**POST** `/api/recurring/:id/exception`

Adds an exception (skip or move) for a specific date.

#### Request Body

```json
{
  "original_date": "2024-01-22",
  "exception_type": "skip",
  "new_date": null,
  "reason": "Holiday"
}
```

#### Exception Types

- **`skip`**: Don't generate task for this date
- **`move`**: Generate task on `new_date` instead

---

### 9. Remove Exception

**DELETE** `/api/recurring/:id/exception/:date`

Removes an exception by original date.

---

### 10. Preview Occurrences

**POST** `/api/recurring/:id/preview`

Preview next N occurrence dates without generating tasks.

#### Request Body

```json
{
  "count": 10,
  "from_date": "2024-01-01"
}
```

#### Response

```json
{
  "dates": [
    "2024-01-08",
    "2024-01-15",
    "2024-01-22",
    "2024-01-29"
  ]
}
```

---

### 11. Manual Generation

**POST** `/api/recurring/:id/generate`

Manually trigger task generation for the series.

#### Response

```json
{
  "generated": 3,
  "tasks": [
    { "id": 101, "due_date": "2024-01-22" },
    { "id": 102, "due_date": "2024-01-29" },
    { "id": 103, "due_date": "2024-02-05" }
  ]
}
```

---

### 12. Get Audit Log

**GET** `/api/recurring/:id/audit`

Returns the audit history for a series.

#### Response

```json
[
  {
    "id": 1,
    "action": "created",
    "changes": null,
    "performed_by": 1,
    "user_name": "Admin User",
    "created_at": "2024-01-01T00:00:00Z"
  },
  {
    "id": 2,
    "action": "updated",
    "changes": { "title": { "from": "Old Title", "to": "New Title" } },
    "performed_by": 1,
    "user_name": "Admin User",
    "created_at": "2024-01-10T00:00:00Z"
  }
]
```

---

## Recurrence Rule Specification

The `recurrence_rule` object follows RFC 5545 (iCalendar) patterns:

### Schema

```typescript
interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly';
  interval?: number;           // Every N periods (default: 1)
  byDayOfWeek?: DayCode[];     // ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU']
  byMonthDay?: number[];       // [1-31 or -1 for last day]
  byMonth?: number[];          // [1-12]
  bySetPos?: number[];         // Position in set (e.g., [1] for first, [-1] for last)
  timeOfDay?: string;          // 'HH:MM' format
  count?: number;              // Stop after N occurrences
  until?: string;              // Stop after this date (ISO)
}
```

### Examples

**Every weekday at 9 AM:**
```json
{
  "frequency": "weekly",
  "interval": 1,
  "byDayOfWeek": ["MO", "TU", "WE", "TH", "FR"],
  "timeOfDay": "09:00"
}
```

**First Monday of every month:**
```json
{
  "frequency": "monthly",
  "interval": 1,
  "byDayOfWeek": ["MO"],
  "bySetPos": [1],
  "timeOfDay": "10:00"
}
```

**Every 2 weeks on Friday:**
```json
{
  "frequency": "weekly",
  "interval": 2,
  "byDayOfWeek": ["FR"],
  "timeOfDay": "15:00"
}
```

**Last day of every month:**
```json
{
  "frequency": "monthly",
  "interval": 1,
  "byMonthDay": [-1],
  "timeOfDay": "17:00"
}
```

**Quarterly (every 3 months):**
```json
{
  "frequency": "monthly",
  "interval": 3,
  "byMonthDay": [1],
  "timeOfDay": "09:00"
}
```

---

## Assignment Strategies

| Strategy | Description |
|----------|-------------|
| `fixed` | Always assign to `default_assignee_id` |
| `round_robin` | Rotate through `rotation_members` |
| `unassigned` | Leave task unassigned |

---

## Error Responses

### 400 Bad Request

```json
{
  "error": "Validation failed",
  "details": [
    {
      "field": "recurrence_rule.frequency",
      "message": "must be one of: daily, weekly, monthly, yearly"
    }
  ]
}
```

### 401 Unauthorized

```json
{
  "error": "Authentication required"
}
```

### 404 Not Found

```json
{
  "error": "Series not found"
}
```

### 500 Internal Server Error

```json
{
  "error": "Internal server error"
}
```

---

## Rate Limiting

- Standard rate limits apply (1000 requests/minute)
- Manual generation endpoint limited to 10 calls/minute per series

---

## Webhooks (Future)

Coming soon: Webhooks for:
- `recurring.series.created`
- `recurring.series.updated`
- `recurring.instance.generated`
- `recurring.instance.completed`

---

## Related Tables

| Table | Purpose |
|-------|---------|
| `recurring_series` | Main series configuration |
| `recurrence_exceptions` | Skip/move exceptions |
| `assignment_rotation` | Round-robin member order |
| `task_reminders` | Reminder configuration |
| `generation_log` | Task generation audit |
| `series_audit_log` | Series change history |

---

## Best Practices

1. **Always set timezone** - Ensures correct date calculation
2. **Use lead_days wisely** - Give users enough time to prepare
3. **Preview before creating** - Use preview endpoint to verify rule
4. **Handle exceptions gracefully** - Skip holidays proactively
5. **Monitor generation logs** - Track what's being created

---

## Support

For issues or feature requests, contact the development team.
