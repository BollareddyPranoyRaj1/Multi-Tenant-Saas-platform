import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { initDatabase } from './scripts/init.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ok } from './utils/response.js';
import healthRouter, { setInitialized } from './routes/health.js';
import authRouter from './routes/auth.js';
import tenantsRouter from './routes/tenants.js';
import usersRouter from './routes/users.js';
import projectsRouter from './routes/projects.js';
import tasksRouter from './routes/tasks.js';

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:3000', credentials: true }));

app.use('/api', healthRouter);

(async() => {
    try {
        await initDatabase();
        setInitialized(true);

        app.get('/api', (req, res) => res.json(ok({ version: '1.0.0' })));
        app.use('/api/auth', authRouter);
        app.use('/api/tenants', tenantsRouter);
        app.use('/api/users', usersRouter);
        app.use('/api/projects', projectsRouter);
        app.use('/api/tasks', tasksRouter);

        app.use(errorHandler);

        const port = parseInt(process.env.PORT || '5000', 10);
        app.listen(port, () => console.log(`Backend listening on port ${port}`));
    } catch (e) {
        console.error('Failed to initialize database:', e);
        process.exit(1);
    }
})();