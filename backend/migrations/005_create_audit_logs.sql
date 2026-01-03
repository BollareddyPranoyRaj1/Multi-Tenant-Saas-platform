CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY,
  tenant_id UUID NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id UUID NULL REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(255) NOT NULL,
  entity_type VARCHAR(255) NULL,
  entity_id VARCHAR(255) NULL,
  ip_address VARCHAR(255) NULL,
  created_at TIMESTAMP NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_tenant ON audit_logs(tenant_id);
