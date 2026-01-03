import jwt from 'jsonwebtoken';
import { fail } from '../utils/response.js';

export function authRequired(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token) return res.status(401).json(fail('Token missing'));
    try {
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        req.auth = { userId: payload.userId, tenantId: payload.tenantId, role: payload.role };
        next();
    } catch (e) {
        return res.status(401).json(fail('Token invalid or expired'));
    }
}

export function optionalAuth(req, res, next) {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (token) {
        try {
            const payload = jwt.verify(token, process.env.JWT_SECRET);
            req.auth = { userId: payload.userId, tenantId: payload.tenantId, role: payload.role };
        } catch { /* ignore */ }
    }
    next();
}