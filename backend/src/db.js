import pg from 'pg';
import { readFile } from 'node:fs/promises';

export function createPool(connectionString) {
  if (!connectionString) throw new Error('Задайте DATABASE_URL в .env (см. .env.example)');
  return new pg.Pool({ connectionString, max: 10, connectionTimeoutMillis: 5000 });
}

export async function initializeDatabase(pool) {
  const schema = await readFile(new URL('../../database/schema.sql', import.meta.url), 'utf8');
  const seed = await readFile(new URL('../../database/seed.sql', import.meta.url), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    // Не допускаем одновременную инициализацию несколькими экземплярами приложения.
    await client.query('SELECT pg_advisory_xact_lock(726041)');
    await client.query(schema);
    await client.query(seed);
    await client.query('DELETE FROM sessions WHERE expires_at <= now()');
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
