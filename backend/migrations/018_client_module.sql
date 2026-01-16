-- ====================================
-- Migration 018: Client Module Support
-- ====================================

-- Client code sequence
CREATE SEQUENCE IF NOT EXISTS client_code_seq START 1;

-- Clients master table
CREATE TABLE IF NOT EXISTS clients (
  id SERIAL PRIMARY KEY,
  workspace_id INTEGER NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_name VARCHAR(200) NOT NULL,
  client_code VARCHAR(20) NOT NULL DEFAULT ('CL-' || LPAD(nextval('client_code_seq')::text, 6, '0')),
  status VARCHAR(20) NOT NULL DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  owner_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  notes TEXT,
  legal_name VARCHAR(200),
  gstin VARCHAR(30),
  billing_address TEXT,
  default_payment_terms VARCHAR(20),
  tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_code_unique ON clients(client_code);
CREATE UNIQUE INDEX IF NOT EXISTS idx_clients_unique_name_gstin ON clients (workspace_id, LOWER(client_name), COALESCE(gstin, ''));
CREATE INDEX IF NOT EXISTS idx_clients_workspace ON clients(workspace_id);
CREATE INDEX IF NOT EXISTS idx_clients_owner ON clients(owner_user_id);

-- Project <-> Clients join table
CREATE TABLE IF NOT EXISTS project_clients (
  id SERIAL PRIMARY KEY,
  project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  role VARCHAR(20) NOT NULL DEFAULT 'Stakeholder' CHECK (role IN ('Primary', 'Billing', 'Stakeholder', 'Partner')),
  is_primary BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(project_id, client_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_clients_primary ON project_clients(project_id) WHERE is_primary;
CREATE INDEX IF NOT EXISTS idx_project_clients_client ON project_clients(client_id);
CREATE INDEX IF NOT EXISTS idx_project_clients_project ON project_clients(project_id);
