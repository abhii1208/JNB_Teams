# 🔄 RECURRING MODULE IMPLEMENTATION PLAN

## ✅ IMPLEMENTATION STATUS

### Completed Files
| File | Description | Status |
|------|-------------|--------|
| `backend/migrations/008_recurring_module.sql` | Complete database schema | ✅ Created |
| `backend/validators/recurrenceRule.js` | JSON Schema validator + helpers | ✅ Created |
| `backend/services/recurrenceEngine.js` | Date computation engine | ✅ Created |
| `backend/services/instanceGenerator.js` | Task instance generation | ✅ Created |
| `backend/routes/recurring.js` | REST API endpoints | ✅ Created |
| `backend/jobs/index.js` | Background job scheduler | ✅ Created |
| `backend/jobs/sendReminders.js` | Reminder notification job | ✅ Created |
| `backend/jobs/autoCloseTasks.js` | Auto-close overdue tasks | ✅ Created |
| `backend/index.js` | Updated with recurring routes | ✅ Modified |
| `backend/package.json` | Added required dependencies | ✅ Modified |
| `frontend/src/utils/recurrenceHelpers.js` | Frontend utilities | ✅ Created |
| `frontend/src/components/Recurring/RecurrenceRuleBuilder.js` | Rule builder UI | ✅ Created |
| `frontend/src/components/Recurring/SeriesList.js` | Series list page | ✅ Created |
| `frontend/src/components/Recurring/SeriesForm.js` | Create/edit form | ✅ Created |
| `frontend/src/components/Recurring/EditScopeDialog.js` | Edit scope dialog | ✅ Created |
| `frontend/src/components/Recurring/index.js` | Component exports | ✅ Created |

---

## 📊 Current State Analysis

### Existing Infrastructure
- **Database**: PostgreSQL with `pg` driver
- **Backend**: Express.js (v5.1.0)
- **Current Tasks Table**: Basic task management with soft delete, archiving
- **Existing Approvals**: Basic approval workflow exists
- **Activity Logs**: Audit logging infrastructure in place

### Schema Compatibility Issues (CORRECTIONS NEEDED)
1. **ID Type Mismatch**: Your specification uses `UUID`, but existing tables use `SERIAL INTEGER`
2. **User References**: Existing uses `INTEGER` references, spec uses `UUID`
3. **Tasks Table Conflict**: Existing `tasks` table has different structure than proposed

---

## 🎯 IMPLEMENTATION PLAN

### Phase 1: Foundation (Week 1-2)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 1.1 | Create migration 008_recurring_module.sql | Critical | 4h |
| 1.2 | Add `rrule` or `luxon` dependency for date computation | Critical | 1h |
| 1.3 | Create JSON Schema validator (AJV) | Critical | 2h |
| 1.4 | Build recurrence rule engine | Critical | 8h |

### Phase 2: Backend Routes (Week 2-3)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 2.1 | Create `routes/recurring.js` - Series CRUD | Critical | 6h |
| 2.2 | Instance generation service | Critical | 8h |
| 2.3 | Exception handling endpoints | High | 4h |
| 2.4 | Assignment rotation logic | Medium | 4h |

### Phase 3: Background Jobs (Week 3)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 3.1 | Add `node-cron` for scheduled tasks | Critical | 2h |
| 3.2 | Nightly generation job | Critical | 4h |
| 3.3 | Reminder execution job | High | 4h |
| 3.4 | Auto-close overdue job | Medium | 2h |

### Phase 4: Frontend (Week 4-5)
| # | Task | Priority | Effort |
|---|------|----------|--------|
| 4.1 | Recurrence rule builder component | Critical | 8h |
| 4.2 | Series management UI | Critical | 6h |
| 4.3 | Edit scope dialog (this/future/all) | Critical | 4h |
| 4.4 | Calendar integration with recurring icons | Medium | 4h |

---

## 📝 CORRECTIONS & SUGGESTIONS

### ❌ Schema Corrections Required

#### 1. **ID Type Consistency** (CRITICAL)
Your spec uses UUID, but existing schema uses INTEGER. 

**Recommendation**: Keep INTEGER for compatibility
```sql
-- CORRECTED: Use INTEGER to match existing schema
CREATE TABLE recurring_series (
    id SERIAL PRIMARY KEY,
    -- ... rest uses INTEGER REFERENCES
);
```

#### 2. **Foreign Key Alignment** (CRITICAL)
```sql
-- CORRECTED references
static_assignee_id INTEGER REFERENCES users(id),
approver_id INTEGER REFERENCES users(id),
created_by INTEGER NOT NULL REFERENCES users(id)
```

#### 3. **Tasks Table Integration** (CRITICAL)
Don't create new tasks table - ADD columns to existing:
```sql
-- ADD to existing tasks table, don't recreate
ALTER TABLE tasks 
ADD COLUMN series_id INTEGER REFERENCES recurring_series(id) ON DELETE SET NULL,
ADD COLUMN is_exception BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN generated_at TIMESTAMPTZ,
ADD COLUMN approval_status VARCHAR(20) CHECK (approval_status IN ('pending', 'approved', 'rejected'));
```

#### 4. **Missing Project Association** (IMPORTANT)
Your `recurring_series` needs workspace/project context:
```sql
-- ADD to recurring_series
workspace_id INTEGER NOT NULL REFERENCES workspaces(id),
project_id INTEGER REFERENCES projects(id)
```

#### 5. **Reminder Offsets Storage** (MISSING)
Your spec mentions reminders but doesn't store offsets in series:
```sql
-- ADD to recurring_series
reminder_offsets JSONB DEFAULT '[]'  -- e.g., [{"value": 1, "unit": "day"}, {"value": 2, "unit": "hour"}]
```

---

### 💡 SUGGESTIONS FOR IMPROVEMENT

#### 1. **Add Template Fields to Series**
Store full task template in series:
```sql
template JSONB NOT NULL DEFAULT '{}'
-- Contains: priority, notes, collaborators, estimated_hours, etc.
```

#### 2. **Generation Lock Mechanism**
Prevent concurrent generation race conditions:
```sql
ADD COLUMN generation_lock_until TIMESTAMPTZ,
ADD COLUMN generation_lock_by VARCHAR(100)
```

#### 3. **Series Versioning for Audit**
Track series changes:
```sql
ADD COLUMN version INTEGER NOT NULL DEFAULT 1
-- Increment on every update
```

#### 4. **Soft Delete for Series**
Align with existing pattern:
```sql
ADD COLUMN deleted_at TIMESTAMPTZ
```

#### 5. **Performance: Materialized Views**
For reporting queries:
```sql
CREATE MATERIALIZED VIEW recurring_stats AS
SELECT 
    series_id,
    COUNT(*) as total_instances,
    COUNT(*) FILTER (WHERE status = 'completed') as completed,
    COUNT(*) FILTER (WHERE status = 'auto_closed') as auto_closed
FROM tasks 
WHERE series_id IS NOT NULL
GROUP BY series_id;
```

#### 6. **Backfill Policy Column**
Make explicit in schema:
```sql
ADD COLUMN backfill_policy VARCHAR(20) DEFAULT 'skip' 
    CHECK (backfill_policy IN ('skip', 'generate_overdue', 'auto_close'))
```

---

## 📁 FILE STRUCTURE

```
backend/
├── routes/
│   └── recurring.js          # NEW: Series CRUD + instance management
├── services/
│   ├── recurrenceEngine.js   # NEW: Date computation logic
│   ├── instanceGenerator.js  # NEW: Task instance creation
│   └── reminderService.js    # NEW: Reminder scheduling
├── validators/
│   └── recurrenceRule.js     # NEW: JSON Schema validation
├── jobs/
│   ├── index.js              # NEW: Job scheduler setup
│   ├── generateInstances.js  # NEW: Nightly generation
│   ├── sendReminders.js      # NEW: Reminder execution
│   └── autoCloseTasks.js     # NEW: Auto-close overdue
└── migrations/
    └── 008_recurring_module.sql  # NEW: Schema changes

frontend/src/
├── components/
│   └── Recurring/
│       ├── RecurrenceRuleBuilder.js  # NEW: Form-based rule builder
│       ├── SeriesList.js             # NEW: Series management
│       ├── SeriesForm.js             # NEW: Create/edit series
│       ├── EditScopeDialog.js        # NEW: This/future/all dialog
│       └── RecurrencePreview.js      # NEW: Shows next N occurrences
└── utils/
    └── recurrenceHelpers.js          # NEW: Human-readable summaries
```

---

## 🗄️ CORRECTED MIGRATION SCRIPT

```sql
-- Migration: 008_recurring_module.sql
-- Recurring Tasks Module - Complete Schema

-- ============================================
-- 1. RECURRING SERIES (THE BRAIN)
-- ============================================
CREATE TABLE recurring_series (
    id SERIAL PRIMARY KEY,
    
    -- Context
    workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
    project_id INTEGER REFERENCES projects(id) ON DELETE SET NULL,
    
    -- Template
    title VARCHAR(200) NOT NULL,
    description TEXT,
    template JSONB NOT NULL DEFAULT '{}',
    
    -- Recurrence rule (RFC-5545 aligned JSON)
    recurrence_rule JSONB NOT NULL,
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    
    -- Bounds
    start_date DATE NOT NULL,
    end_date DATE,
    
    -- State
    paused_at TIMESTAMPTZ,
    last_generated_at DATE,
    
    -- Behavior
    auto_close_after_days INTEGER,
    backfill_policy VARCHAR(20) DEFAULT 'skip' 
        CHECK (backfill_policy IN ('skip', 'generate_overdue', 'auto_close')),
    
    -- Assignment
    assignment_strategy VARCHAR(20) NOT NULL DEFAULT 'static'
        CHECK (assignment_strategy IN ('static', 'round_robin', 'role_based')),
    static_assignee_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Approval
    approver_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    
    -- Reminders
    reminder_offsets JSONB DEFAULT '[]',
    
    -- Audit
    version INTEGER NOT NULL DEFAULT 1,
    created_by INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    
    -- Safety
    CONSTRAINT valid_date_range CHECK (end_date IS NULL OR end_date >= start_date)
);

-- ============================================
-- 2. ALTER EXISTING TASKS TABLE
-- ============================================
ALTER TABLE tasks 
ADD COLUMN IF NOT EXISTS series_id INTEGER REFERENCES recurring_series(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_exception BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS generated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC';

-- Update status constraint for recurring tasks
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_status_check;
ALTER TABLE tasks ADD CONSTRAINT tasks_status_check 
    CHECK (status IN ('Open', 'Pending Approval', 'Closed', 'Rejected', 
                      'In Progress', 'Completed', 'Blocked', 'auto_closed'));

-- ============================================
-- 3. RECURRENCE EXCEPTIONS
-- ============================================
CREATE TABLE recurrence_exceptions (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES recurring_series(id) ON DELETE CASCADE,
    
    original_date DATE NOT NULL,
    new_date DATE,
    
    exception_type VARCHAR(10) NOT NULL CHECK (exception_type IN ('skip', 'move')),
    reason TEXT,
    
    created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(series_id, original_date)
);

-- ============================================
-- 4. ASSIGNMENT ROTATION
-- ============================================
CREATE TABLE assignment_rotation (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES recurring_series(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    order_index INTEGER NOT NULL,
    last_assigned_at TIMESTAMPTZ,
    
    UNIQUE (series_id, user_id),
    UNIQUE (series_id, order_index)
);

-- ============================================
-- 5. TASK REMINDERS
-- ============================================
CREATE TABLE task_reminders (
    id SERIAL PRIMARY KEY,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    
    remind_at TIMESTAMPTZ NOT NULL,
    sent_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================
-- 6. GENERATION LOG (FOR IDEMPOTENCY)
-- ============================================
CREATE TABLE generation_log (
    id SERIAL PRIMARY KEY,
    series_id INTEGER NOT NULL REFERENCES recurring_series(id) ON DELETE CASCADE,
    generated_date DATE NOT NULL,
    task_id INTEGER REFERENCES tasks(id) ON DELETE SET NULL,
    
    status VARCHAR(20) NOT NULL CHECK (status IN ('created', 'skipped', 'moved', 'failed')),
    error_message TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(series_id, generated_date)
);

-- ============================================
-- 7. INDEXES
-- ============================================
CREATE INDEX idx_series_workspace ON recurring_series(workspace_id);
CREATE INDEX idx_series_project ON recurring_series(project_id);
CREATE INDEX idx_series_paused ON recurring_series(paused_at) WHERE paused_at IS NOT NULL;
CREATE INDEX idx_series_active ON recurring_series(deleted_at) WHERE deleted_at IS NULL;

CREATE INDEX idx_tasks_series ON tasks(series_id) WHERE series_id IS NOT NULL;
CREATE INDEX idx_tasks_due_date ON tasks(due_date);

CREATE INDEX idx_exceptions_series_date ON recurrence_exceptions(series_id, original_date);

CREATE INDEX idx_reminders_pending ON task_reminders(remind_at) WHERE sent_at IS NULL AND cancelled_at IS NULL;
CREATE INDEX idx_reminders_task ON task_reminders(task_id);

CREATE INDEX idx_generation_log_series ON generation_log(series_id, generated_date);
```

---

## 📦 DEPENDENCIES TO ADD

```json
{
  "dependencies": {
    "ajv": "^8.12.0",           // JSON Schema validation
    "ajv-formats": "^2.1.1",    // Date format support
    "luxon": "^3.4.0",          // Timezone-aware date handling
    "node-cron": "^3.0.3",      // Background job scheduling
    "rrule": "^2.7.2"           // RFC-5545 recurrence rule parsing (optional)
  }
}
```

---

## ⚠️ CRITICAL EDGE CASES TO HANDLE

### 1. Timezone DST Transitions
```javascript
// WRONG: Naive approach
const nextDate = addDays(lastDate, 7);

// CORRECT: Timezone-aware
const nextDate = DateTime.fromISO(lastDate, { zone: series.timezone })
    .plus({ weeks: 1 })
    .toUTC();
```

### 2. Month Boundary (31st → Feb)
```javascript
// Rule: "Monthly on 31st"
// January 31 → February 28/29 → March 31
// Use 'bymonthday: -1' for "last day" instead
```

### 3. Series Split Transaction
```javascript
// MUST be atomic
await client.query('BEGIN');
try {
    // 1. Update old series end_date
    // 2. Create new series starting from edit date
    // 3. Delete future instances of old series
    // 4. Generate instances for new series
    await client.query('COMMIT');
} catch (e) {
    await client.query('ROLLBACK');
}
```

### 4. Concurrent Generation Guard
```javascript
// Use advisory locks
const lockAcquired = await client.query(
    'SELECT pg_try_advisory_lock($1)',
    [seriesId]
);
if (!lockAcquired.rows[0].pg_try_advisory_lock) {
    return; // Another worker is processing
}
```

---

## 🧪 TESTING CHECKLIST

### Unit Tests
- [ ] Recurrence rule validation (all patterns)
- [ ] Next occurrence computation
- [ ] Exception handling (skip/move)
- [ ] Round-robin assignment
- [ ] Timezone edge cases

### Integration Tests
- [ ] Series CRUD operations
- [ ] Instance generation flow
- [ ] Edit scope (this/future/all)
- [ ] Pause/resume behavior
- [ ] Reminder creation

### Edge Case Tests
- [ ] DST transition dates
- [ ] Leap year (Feb 29)
- [ ] Month-end boundaries
- [ ] Series with 1000+ instances
- [ ] Concurrent generation

---

## 🚀 RECOMMENDED IMPLEMENTATION ORDER

1. **Migration first** → Get schema in place
2. **Validation layer** → Ensure data integrity from day 1
3. **Core engine** → Date computation logic
4. **Basic CRUD** → Series create/read
5. **Generation** → Instance creation
6. **Background jobs** → Automate generation
7. **Edit flow** → This/future/all logic
8. **Frontend** → Rule builder UI
9. **Reminders** → Notification scheduling
10. **Reporting** → Analytics queries

---

## 📋 NEXT STEPS

Would you like me to:
1. **Create the migration file** (008_recurring_module.sql)?
2. **Build the recurrence engine** (recurrenceEngine.js)?
3. **Create the JSON schema validator**?
4. **Build the backend routes** (recurring.js)?
5. **Create the frontend rule builder**?

Let me know which component to build first!
