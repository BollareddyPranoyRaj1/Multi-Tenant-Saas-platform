import { fail } from '../utils/response.js';

export function requireRole(roles) {
    const allowed = Array.isArray(roles) ? roles : [roles];
    return (req, res, next) => {
        const role = req.auth && req.auth.role;
        if (!role) return res.status(401).json(fail('Unauthorized'));
        if (!allowed.includes(role)) return res.status(403).json(fail('Forbidden'));
        next();
    };
}

export function belongsToTenantOrSuper(req, res, next) {
    const { role, tenantId } = req.auth || {};
    const paramTenantId = req.params.tenantId;
    if (role === 'super_admin') return next();
    if (!tenantId || !paramTenantId || tenantId !== paramTenantId) {
        return res.status(403).json(fail('Unauthorized access'));
    }
    next();
}