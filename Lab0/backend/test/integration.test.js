import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { createPool, initializeDatabase } from '../src/db.js';

if (!process.env.TEST_DATABASE_URL) throw new Error('Задайте TEST_DATABASE_URL: тесты требуют отдельную PostgreSQL БД (см. README)');
const pool = createPool(process.env.TEST_DATABASE_URL);
let server, base, user, otherUser, cookie, otherCookie, reviewId;
const email = `test-${randomUUID()}@example.test`;
const password = 'A-long-test-password-123';
async function start() {
  server = createApp(pool).listen(0, '127.0.0.1');
  await once(server, 'listening');
  base = `http://127.0.0.1:${server.address().port}`;
}
async function request(path, { method = 'GET', body, auth, headers = {} } = {}) {
  const response = await fetch(`${base}/api${path}`, { method, headers: { ...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }), ...(auth ? { Cookie: auth } : {}), ...headers }, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) });
  return { status: response.status, body: await response.json(), cookie: response.headers.get('set-cookie')?.split(';')[0] };
}
before(async () => { await initializeDatabase(pool); await start(); });
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  for (const id of [user?.id, otherUser?.id].filter(Boolean)) await pool.query('DELETE FROM users WHERE id=$1', [id]);
  await pool.end();
});
test('каталог, жанры, поиск, фильтры и случайная подборка', async () => {
  assert.equal((await request('/health')).status, 200);
  const movies = (await request('/movies')).body;
  assert.equal(movies.length, 12);
  assert.equal((await request('/genres')).body.length, 6);
  assert.equal((await request('/movies?search=Interstellar')).body[0].id, 1);
  const filtered = (await request('/movies?genre=1')).body;
  assert.ok(filtered.length > 0 && filtered.every(m => m.genres.includes('Фантастика')));
  const random = (await request('/movies?random=true')).body;
  assert.equal(random.length, 6); assert.equal(new Set(random.map(m => m.id)).size, 6);
  assert.equal((await request('/movies/99999')).status, 404);
  assert.equal((await request('/movies?genre=abc')).status, 400);
  assert.equal((await request('/movies?search=%27%3BDROP%20TABLE%20movies%3B--')).body.length, 0);
});
test('регистрация, cookie-сессия и запрет дубликата email', async () => {
  const result = await request('/auth/register', { method: 'POST', body: { name: 'Тестовый зритель', email, password } });
  assert.equal(result.status, 201); user = result.body.user; cookie = result.cookie;
  assert.equal((await request('/auth/me', { auth: cookie })).body.user.id, user.id);
  const stored = (await pool.query('SELECT password_hash FROM users WHERE id=$1', [user.id])).rows[0];
  assert.notEqual(stored.password_hash, password);
  assert.equal((await request('/auth/register', { method: 'POST', body: { name: 'Повтор', email, password } })).status, 409);
  assert.equal((await request('/auth/login', { method: 'POST', body: { email, password: 'wrong-password' } })).status, 401);
});
test('нельзя писать без входа, с чужой цитатой или неверной оценкой', async () => {
  const body = { movie_id: 1, text: 'Хороший фильм для тестового отзыва.', rating: 9, quote_id: 1 };
  assert.equal((await request('/reviews', { method: 'POST', body })).status, 401);
  assert.equal((await request('/reviews', { method: 'POST', auth: cookie, body: { ...body, rating: 11 } })).status, 400);
  assert.equal((await request('/reviews', { method: 'POST', auth: cookie, body: { ...body, quote_id: 2 } })).status, 400);
  assert.equal((await request('/reviews', { method: 'POST', auth: cookie, body: { ...body, text: 'Мало' } })).status, 400);
  assert.equal((await request('/reviews', { method: 'POST', auth: cookie, body, headers: { 'Sec-Fetch-Site': 'cross-site' } })).status, 403);
});
test('ревью сохраняется в PostgreSQL, повторная публикация запрещена', async () => {
  const body = { movie_id: 1, text: 'Очень личная история на фоне огромной вселенной.', rating: 9, quote_id: 1, spoiler: true };
  const result = await request('/reviews', { method: 'POST', auth: cookie, body });
  assert.equal(result.status, 201); reviewId = result.body.id;
  const stored = (await pool.query('SELECT * FROM reviews WHERE id=$1', [reviewId])).rows[0];
  assert.equal(stored.text, body.text); assert.equal(stored.spoiler, true);
  assert.equal((await request('/reviews', { method: 'POST', auth: cookie, body })).status, 409);
  assert.equal((await request(`/reviews?user=${user.id}`)).body.reviews[0].id, reviewId);
});
test('данные и сессия доступны после перезапуска HTTP-сервера', async () => {
  await new Promise(resolve => server.close(resolve));
  await initializeDatabase(pool); await start();
  assert.equal((await request(`/reviews?user=${user.id}`)).body.reviews[0].id, reviewId);
  assert.equal((await request('/auth/me', { auth: cookie })).body.user.id, user.id);
  assert.equal((await request('/movies')).body.length, 12);
});
test('другой пользователь не может изменить или удалить чужое ревью', async () => {
  const result = await request('/auth/register', { method: 'POST', body: { name: 'Другой зритель', email: `other-${email}`, password } });
  otherUser = result.body.user; otherCookie = result.cookie;
  assert.equal((await request(`/reviews/${reviewId}`, { method: 'PUT', auth: otherCookie, body: { text: 'Хочу заменить чужой отзыв.', rating: 1 } })).status, 404);
  assert.equal((await request(`/reviews/${reviewId}`, { method: 'DELETE', auth: otherCookie })).status, 404);
});
test('автор изменяет отзыв, публикация попадает в общую ленту', async () => {
  const body = { text: 'После повторного просмотра фильм понравился ещё больше.', rating: 10, quote_id: null, spoiler: false };
  const result = await request(`/reviews/${reviewId}`, { method: 'PUT', auth: cookie, body });
  assert.equal(result.status, 200); assert.equal(result.body.rating, 10); assert.equal(result.body.quote_id, null);
  const review = (await request('/reviews')).body.reviews.find(r => r.id === reviewId);
  assert.equal(review.text, body.text);
  const movie = (await request('/movies/1')).body;
  assert.ok(movie.reviews.some(r => r.id === reviewId));
  assert.ok(movie.rating >= 1 && movie.rating <= 10);
});
test('выход отзывает сессию; вход выдаёт новую; автор удаляет ревью', async () => {
  assert.equal((await request('/auth/logout', { method: 'POST', auth: cookie })).status, 200);
  assert.equal((await request('/auth/me', { auth: cookie })).body.user, null);
  const result = await request('/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(result.status, 200); cookie = result.cookie;
  assert.equal((await request(`/reviews/${reviewId}`, { method: 'DELETE', auth: cookie })).status, 200);
  assert.equal((await request(`/reviews?user=${user.id}`)).body.reviews.length, 0);
});
