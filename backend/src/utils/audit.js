import { query } from '../config/db.js';

export async function logAudit({ tenantId, userId, action, entityType, entityId, ipAddress }) {
    try {
        await query(
            `INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address, created_at)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())`, [tenantId || null, userId || null, action, entityType || null, entityId || null, ipAddress || null]
        );
    } catch (e) {
        console.error('Audit log error:', e.message);
    }
}