import express from 'express';
import { ok } from '../utils/response.js';
import { healthCheck } from '../config/db.js';

let initialized = false;
export function setInitialized(val) { initialized = val; }

const router = express.Router();
router.get('/health', async(req, res) => {
    const db = await healthCheck();
    if (!db) return res.status(500).json({ status: 'error', database: 'disconnected' });
    if (!initialized) return res.status(503).json({ status: 'initializing', database: 'connected' });
    res.json({ status: 'ok', database: 'connected' });
});

export default router;