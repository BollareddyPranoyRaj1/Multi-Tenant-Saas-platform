import pg from 'pg';

const { Pool } = pg;

const dbConfig = process.env.DATABASE_URL
  ? { connectionString: process.env.DATABASE_URL, ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false }
  : {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'saas_db',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
    };

const pool = new Pool(dbConfig);


export async function query(text, params) {
    return pool.query(text, params);
}

export async function getClient() {
    return pool.connect();
}

export async function healthCheck() {
    try {
        await pool.query('SELECT 1');
        return true;
    } catch (e) {
        return false;
    }
}

export default pool;
