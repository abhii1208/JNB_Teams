-- ====================================
-- Migration 055: Checklist Custom Fields
-- ====================================

CREATE TABLE IF NOT EXISTS checklist_item_custom_fields (
  id SERIAL PRIMARY KEY,
  checklist_item_id INTEGER NOT NULL REFERENCES checklist_items(id) ON DELETE CASCADE,
  label VARCHAR(200) NOT NULL,
  field_type VARCHAR(30) NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'date_range', 'boolean', 'dropdown')),
  required BOOLEAN NOT NULL DEFAULT FALSE,
  options JSONB DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  disabled_from DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_checklist_item_custom_fields_item
  ON checklist_item_custom_fields(checklist_item_id);

CREATE INDEX IF NOT EXISTS idx_checklist_item_custom_fields_item_order
  ON checklist_item_custom_fields(checklist_item_id, display_order, id);

CREATE INDEX IF NOT EXISTS idx_checklist_item_custom_fields_active
  ON checklist_item_custom_fields(is_active)
  WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS checklist_occurrence_custom_field_values (
  id SERIAL PRIMARY KEY,
  occurrence_id INTEGER NOT NULL REFERENCES checklist_occurrences(id) ON DELETE CASCADE,
  field_id INTEGER NOT NULL REFERENCES checklist_item_custom_fields(id) ON DELETE CASCADE,
  value_text TEXT,
  value_number NUMERIC(20, 4),
  value_date DATE,
  value_boolean BOOLEAN,
  value_json JSONB,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(occurrence_id, field_id)
);

CREATE INDEX IF NOT EXISTS idx_checklist_occ_custom_field_values_occurrence
  ON checklist_occurrence_custom_field_values(occurrence_id);

CREATE INDEX IF NOT EXISTS idx_checklist_occ_custom_field_values_field
  ON checklist_occurrence_custom_field_values(field_id);
