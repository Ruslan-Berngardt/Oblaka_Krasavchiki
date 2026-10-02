import { createPool, initializeDatabase } from './db.js';
import { createApp } from './app.js';

const pool = createPool(process.env.DATABASE_URL);
pool.on('error', error => console.error('Database connection error:', error.code));
try {
  await initializeDatabase(pool);
  const port = Number(process.env.PORT || 3000);
  const server = createApp(pool).listen(port, '0.0.0.0', () => console.log(`Кадр: http://localhost:${port}`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
    server.close(async () => { await pool.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  });
} catch (error) {
  console.error('Не удалось запустить приложение:', error.message);
  await pool.end(); process.exitCode = 1;
}
