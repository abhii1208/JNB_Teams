export const CUSTOM_FIELD_TYPES = [
  { value: 'text', label: 'Text' },
  { value: 'number', label: 'Number' },
  { value: 'date', label: 'Date' },
  { value: 'date_range', label: 'Date Range' },
  { value: 'boolean', label: 'Yes / No' },
  { value: 'dropdown', label: 'Dropdown' },
];

export function getCustomFieldStoredValue(field) {
  if (!field) return null;

  switch (field.field_type) {
    case 'text':
    case 'dropdown':
      return field.value_text ?? null;
    case 'number':
      return field.value_number !== undefined && field.value_number !== null
        ? Number(field.value_number)
        : null;
    case 'date':
      return field.value_date ? String(field.value_date).slice(0, 10) : null;
    case 'boolean':
      return typeof field.value_boolean === 'boolean' ? field.value_boolean : null;
    case 'date_range':
      if (field.value_json && typeof field.value_json === 'object') {
        const startDate = String(field.value_json.startDate || field.value_json.start || '').slice(0, 10);
        const endDate = String(field.value_json.endDate || field.value_json.end || '').slice(0, 10);
        if (startDate && endDate) {
          return { startDate, endDate };
        }
      }
      return null;
    default:
      return null;
  }
}

export function getCustomFieldResolvedValue(field, draftValues = {}) {
  if (!field) return null;
  const fieldId = String(field.id);
  if (Object.prototype.hasOwnProperty.call(draftValues || {}, fieldId)) {
    return draftValues[fieldId];
  }
  return getCustomFieldStoredValue(field);
}

export function isCustomFieldValueEmpty(value, fieldType) {
  if (value === null || value === undefined) {
    return true;
  }
  if (fieldType === 'text' || fieldType === 'dropdown') {
    return String(value).trim() === '';
  }
  if (fieldType === 'date_range') {
    return !value.startDate || !value.endDate;
  }
  return false;
}

export function buildInitialCustomFieldDraft(fields = []) {
  const draft = {};
  (Array.isArray(fields) ? fields : []).forEach((field) => {
    const value = getCustomFieldStoredValue(field);
    if (value !== undefined) {
      draft[String(field.id)] = value;
    }
  });
  return draft;
}

export function formatCustomFieldValue(value, fieldType) {
  if (isCustomFieldValueEmpty(value, fieldType)) {
    return '-';
  }

  if (fieldType === 'boolean') {
    return value ? 'Yes' : 'No';
  }
  if (fieldType === 'date_range') {
    return `${value.startDate} to ${value.endDate}`;
  }
  return String(value);
}

