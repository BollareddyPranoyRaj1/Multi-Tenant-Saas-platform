import { fail } from '../utils/response.js';

export function errorHandler(err, req, res, next) {
    console.error(err);
    if (res.headersSent) return next(err);
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    res.status(status).json(fail(message));
}