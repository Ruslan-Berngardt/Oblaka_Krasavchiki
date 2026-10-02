import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { rateLimit } from 'express-rate-limit';
import { fileURLToPath } from 'node:url';
import { hashPassword, verifyPassword, tokenHash, startSession, cookieOptions } from './auth.js';

// app.js находится в backend/src: поднимаемся к корню репозитория.
const staticRoot = fileURLToPath(new URL('../../frontend', import.meta.url));
function fail(status, message) { return Object.assign(new Error(message), { status }); }
function id(value) {
  if (!/^\d+$/.test(String(value)) || +value < 1 || +value > 2147483647) throw fail(400, 'Некорректный идентификатор');
  return +value;
}
const publicUser = user => ({ id: user.id, name: user.name });
const movieSelect = `SELECT m.*, COALESCE((SELECT json_agg(g.name ORDER BY g.id)
  FROM movie_genres mg JOIN genres g ON g.id=mg.genre_id WHERE mg.movie_id=m.id), '[]') AS genres,
  (SELECT round(avg(r.rating),1)::float FROM reviews r WHERE r.movie_id=m.id) AS rating,
  (SELECT count(*)::int FROM reviews r WHERE r.movie_id=m.id) AS review_count FROM movies m`;
const reviewSelect = `SELECT r.*, u.name AS author, m.title AS movie_title, m.year AS movie_year,
  m.poster, m.accent, q.text AS quote FROM reviews r JOIN users u ON u.id=r.user_id
  JOIN movies m ON m.id=r.movie_id LEFT JOIN quotes q ON q.id=r.quote_id`;

export function createApp(pool) {
  const app = express();
  app.disable('x-powered-by');
  app.use(helmet({ contentSecurityPolicy: { directives: {
    defaultSrc: ["'self'"], scriptSrc: ["'self'"], styleSrc: ["'self'"],
    imgSrc: ["'self'", 'data:'], connectSrc: ["'self'"], upgradeInsecureRequests: null,
  } } }));
  app.use(express.json({ limit: '32kb' }));
  app.use(cookieParser());
  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['POST', 'PUT', 'DELETE'].includes(req.method)) {
      // JSON + запрет CORS исключают межсайтовую отправку форм и fetch с чужого origin.
      if (!req.is('application/json')) return next(fail(415, 'Ожидается application/json'));
      if (req.get('sec-fetch-site') === 'cross-site') return next(fail(403, 'Запрос с другого сайта запрещён'));
    }
    next();
  });
  app.use('/api/auth', rateLimit({ windowMs: 15 * 60000, limit: 40, skipSuccessfulRequests: true,
    message: { error: 'Слишком много попыток. Попробуйте через 15 минут.' } }));
  app.use('/api', async (req, res, next) => {
    const token = req.cookies.kadr_session;
    if (typeof token === 'string' && /^[a-f0-9]{64}$/.test(token)) {
      const { rows } = await pool.query(`SELECT u.id,u.name FROM sessions s JOIN users u ON u.id=s.user_id
        WHERE s.token_hash=$1 AND s.expires_at > now()`, [tokenHash(token)]);
      req.user = rows[0];
    }
    next();
  });
  const authenticated = (req, res, next) => req.user ? next() : next(fail(401, 'Войдите, чтобы опубликовать ревью'));

  app.get('/api/health', async (req, res) => {
    await pool.query('SELECT 1'); res.json({ status: 'ok', database: 'connected' });
  });
  app.get('/api/auth/me', (req, res) => res.json({ user: req.user || null }));
  app.post('/api/auth/register', async (req, res) => {
    const { name, email, password } = req.body || {};
    if (typeof name !== 'string' || name.trim().length < 2 || name.trim().length > 40) throw fail(400, 'Имя должно содержать от 2 до 40 символов');
    if (typeof email !== 'string' || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw fail(400, 'Введите корректный email');
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) throw fail(400, 'Пароль должен содержать от 8 до 128 символов');
    const hash = await hashPassword(password);
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const { rows } = await client.query('INSERT INTO users(name,email,password_hash) VALUES($1,$2,$3) RETURNING id,name', [name.trim(), email.toLowerCase().trim(), hash]);
      await startSession(client, res, rows[0].id);
      await client.query('COMMIT');
      res.status(201).json({ user: rows[0] });
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  });
  app.post('/api/auth/login', async (req, res) => {
    const { email, password } = req.body || {};
    if (typeof email !== 'string' || email.length > 254 || typeof password !== 'string' || password.length > 128) throw fail(400, 'Проверьте email и пароль');
    const { rows } = await pool.query('SELECT * FROM users WHERE email=$1', [email.trim().toLowerCase()]);
    if (!rows[0] || !await verifyPassword(password, rows[0].password_hash)) throw fail(401, 'Неверный email или пароль');
    if (req.cookies.kadr_session) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(req.cookies.kadr_session)]);
    await startSession(pool, res, rows[0].id);
    res.json({ user: publicUser(rows[0]) });
  });
  app.post('/api/auth/logout', async (req, res) => {
    if (req.cookies.kadr_session) await pool.query('DELETE FROM sessions WHERE token_hash=$1', [tokenHash(req.cookies.kadr_session)]);
    res.clearCookie('kadr_session', cookieOptions()); res.json({ ok: true });
  });
  app.get('/api/genres', async (req, res) => res.json((await pool.query('SELECT * FROM genres ORDER BY id')).rows));
  app.get('/api/movies', async (req, res) => {
    const search = typeof req.query.search === 'string' ? req.query.search.slice(0, 150) : '';
    const genre = req.query.genre ? id(req.query.genre) : null;
    const random = req.query.random === 'true';
    const { rows } = await pool.query(`${movieSelect} WHERE (m.title ILIKE $1 OR m.original_title ILIKE $1 OR m.director ILIKE $1)
      AND ($2::int IS NULL OR EXISTS(SELECT 1 FROM movie_genres mg WHERE mg.movie_id=m.id AND mg.genre_id=$2))
      ORDER BY ${random ? 'random()' : 'm.id'} LIMIT ${random ? 6 : 100}`, [`%${search}%`, genre]);
    res.json(rows);
  });
  app.get('/api/movies/:id', async (req, res) => {
    const movieId = id(req.params.id);
    const { rows } = await pool.query(`${movieSelect} WHERE m.id=$1`, [movieId]);
    if (!rows[0]) throw fail(404, 'Фильм не найден');
    const quotes = (await pool.query('SELECT id,text FROM quotes WHERE movie_id=$1 ORDER BY id', [movieId])).rows;
    const reviews = (await pool.query(`${reviewSelect} WHERE r.movie_id=$1 ORDER BY r.created_at DESC LIMIT 30`, [movieId])).rows;
    res.json({ ...rows[0], quotes, reviews });
  });
  app.get('/api/users/:id', async (req, res) => {
    const { rows } = await pool.query('SELECT id,name,created_at FROM users WHERE id=$1', [id(req.params.id)]);
    if (!rows[0]) throw fail(404, 'Пользователь не найден');
    res.json(rows[0]);
  });
  app.get('/api/reviews', async (req, res) => {
    const userId = req.query.user ? id(req.query.user) : null;
    const before = req.query.before ? id(req.query.before) : null;
    const { rows } = await pool.query(`${reviewSelect} WHERE ($1::int IS NULL OR r.user_id=$1)
      AND ($2::int IS NULL OR r.id < $2) ORDER BY r.id DESC LIMIT 20`, [userId, before]);
    res.json({ reviews: rows, next: rows.length === 20 ? rows.at(-1).id : null });
  });
  async function reviewValues(body) {
    const { text, rating, movie_id, quote_id, spoiler = false } = body || {};
    if (typeof text !== 'string' || text.trim().length < 10 || text.trim().length > 5000) throw fail(400, 'Ревью должно содержать от 10 до 5000 символов');
    if (!Number.isInteger(rating) || rating < 1 || rating > 10) throw fail(400, 'Оценка — целое число от 1 до 10');
    if (typeof spoiler !== 'boolean') throw fail(400, 'Некорректная отметка спойлера');
    const movieId = id(movie_id);
    if (!(await pool.query('SELECT id FROM movies WHERE id=$1', [movieId])).rowCount) throw fail(404, 'Фильм не найден');
    const quoteId = quote_id == null ? null : id(quote_id);
    if (quoteId && !(await pool.query('SELECT id FROM quotes WHERE id=$1 AND movie_id=$2', [quoteId, movieId])).rowCount) throw fail(400, 'Цитата не относится к выбранному фильму');
    return [movieId, text.trim(), rating, quoteId, spoiler];
  }
  app.post('/api/reviews', authenticated, async (req, res) => {
    const values = await reviewValues(req.body);
    const { rows } = await pool.query(`INSERT INTO reviews(movie_id,text,rating,quote_id,spoiler,user_id)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING *`, [...values, req.user.id]);
    res.status(201).json(rows[0]);
  });
  app.put('/api/reviews/:id', authenticated, async (req, res) => {
    const reviewId = id(req.params.id);
    const existing = (await pool.query('SELECT * FROM reviews WHERE id=$1 AND user_id=$2', [reviewId, req.user.id])).rows[0];
    if (!existing) throw fail(404, 'Ваше ревью не найдено');
    const values = await reviewValues({ ...req.body, movie_id: existing.movie_id });
    const { rows } = await pool.query(`UPDATE reviews SET movie_id=$1,text=$2,rating=$3,quote_id=$4,spoiler=$5,updated_at=now()
      WHERE id=$6 AND user_id=$7 RETURNING *`, [...values, reviewId, req.user.id]);
    if (!rows[0]) throw fail(404, 'Ваше ревью не найдено');
    res.json(rows[0]);
  });
  app.delete('/api/reviews/:id', authenticated, async (req, res) => {
    const result = await pool.query('DELETE FROM reviews WHERE id=$1 AND user_id=$2', [id(req.params.id), req.user.id]);
    if (!result.rowCount) throw fail(404, 'Ваше ревью не найдено');
    res.json({ ok: true });
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Эндпоинт не найден' }));
  app.use(express.static(staticRoot));
  app.use((err, req, res, next) => {
    let status = err.status || 500;
    let message = status < 500 ? err.message : 'Сервис временно недоступен. Попробуйте ещё раз.';
    if (err.code === '23505') { status = 409; message = err.constraint === 'users_email_key' ? 'Этот email уже зарегистрирован' : 'Вы уже написали ревью на этот фильм. Его можно изменить на своей стене.'; }
    if (err.type === 'entity.parse.failed') { status = 400; message = 'Некорректный JSON'; }
    if (status >= 500) console.error('Request failed:', err.code || err.name);
    res.status(status).json({ error: message });
  });
  return app;
}
