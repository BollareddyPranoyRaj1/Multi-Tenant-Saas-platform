import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { query } from '../config/db.js';
import { seedDatabase } from './seed.js';

dotenv.config();
const __filename = fileURLToPath(
    import.meta.url);
const __dirname = path.dirname(__filename);

async function ensureExtensions() {
    // For gen_random_uuid()
    await query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
}

async function ensureMigrationsTable() {
    await query(`CREATE TABLE IF NOT EXISTS migrations (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) UNIQUE NOT NULL,
    applied_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`);
}

async function runMigrations() {
    const migrationsDir = path.resolve(__dirname, '../../migrations');
    const files = fs.readdirSync(migrationsDir)
        .filter(f => f.endsWith('.sql'))
        .sort();
    for (const file of files) {
        const exists = await query('SELECT 1 FROM migrations WHERE name=$1', [file]);
        if (exists.rowCount) continue;
        const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
        console.log('Applying migration', file);
        await query(sql);
        await query('INSERT INTO migrations(name) VALUES($1)', [file]);
    }
}

async function runSeeds() {
    const flag = await query("SELECT 1 FROM audit_logs WHERE action='SEED_COMPLETED' LIMIT 1");
    if (flag.rowCount) return;
    console.log('Running seed data (idempotent JS seeds)');
    await seedDatabase();
}

export async function initDatabase() {
    await ensureExtensions();
    await ensureMigrationsTable();
    await runMigrations();
    await runSeeds();
    // mark seed complete
    await query(`INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, ip_address, created_at)
                             SELECT gen_random_uuid(), NULL, NULL, 'SEED_COMPLETED', 'system', 'seed', NULL, NOW()
                             WHERE NOT EXISTS (SELECT 1 FROM audit_logs WHERE action='SEED_COMPLETED')`);
}

if (process.argv[1] === fileURLToPath(
        import.meta.url)) {
    initDatabase().then(() => {
        console.log('Database initialized');
        process.exit(0);
    }).catch(err => {
        console.error('Initialization failed', err);
        process.exit(1);
    });
}