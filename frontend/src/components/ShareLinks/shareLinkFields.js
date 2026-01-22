export const SHAREABLE_FIELDS = [
  { key: 'name', label: 'Task name', default: true },
  { key: 'project_name', label: 'Project', default: true },
  { key: 'status', label: 'Status', default: true },
  { key: 'priority', label: 'Priority', default: true },
  { key: 'assignee_name', label: 'Assignee', default: true },
  { key: 'due_date', label: 'Due date', default: true },
  { key: 'target_date', label: 'Target date', default: false },
  { key: 'stage', label: 'Stage', default: false },
  { key: 'description', label: 'Description', default: false, adminOnly: true },
  { key: 'notes', label: 'Notes', default: false, adminOnly: true },
  { key: 'category', label: 'Category', default: false },
  { key: 'section', label: 'Section', default: false },
  { key: 'estimated_hours', label: 'Est. hours', default: false, adminOnly: true },
  { key: 'actual_hours', label: 'Actual hours', default: false, adminOnly: true },
  { key: 'completion_percentage', label: 'Completion %', default: false },
  { key: 'tags', label: 'Tags', default: false },
  { key: 'external_id', label: 'External ID', default: false, adminOnly: true },
  { key: 'created_at', label: 'Created at', default: false },
  { key: 'updated_at', label: 'Updated at', default: false },
  { key: 'assignee_email', label: 'Assignee email', default: false, adminOnly: true },
  { key: 'client_name', label: 'Client', default: false },
  { key: 'client_legal_name', label: 'Client legal name', default: false, adminOnly: true },
  { key: 'client_series_no', label: 'Client series', default: false, adminOnly: true },
];

export const DEFAULT_SHARE_COLUMNS = SHAREABLE_FIELDS
  .filter((field) => field.default)
  .map((field) => field.key);

export const ADMIN_ONLY_FIELDS = SHAREABLE_FIELDS
  .filter((field) => field.adminOnly)
  .map((field) => field.key);

export const SHARE_FIELD_LABELS = SHAREABLE_FIELDS.reduce((acc, field) => {
  acc[field.key] = field.label;
  return acc;
}, {});
