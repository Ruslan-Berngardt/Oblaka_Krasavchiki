// Browser-independent acceptance check; run against a disposable CI database.
import assert from 'node:assert/strict';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
const [mode, stateFile] = process.argv.slice(2);
if (!['create', 'verify'].includes(mode) || !stateFile) throw new Error('Usage: node scripts/smoke.mjs create|verify STATE_FILE');
const base = process.env.SMOKE_URL || 'http://127.0.0.1:8080';
async function api(path, method='GET', body, cookie) {
  const r = await fetch(base+'/api'+path, { method, headers: { ...(method==='GET'?{}:{'Content-Type':'application/json'}), ...(cookie?{Cookie:cookie}:{}) }, ...(method==='GET'?{}:{body:JSON.stringify(body||{})}) });
  const data = await r.json();
  assert.ok(r.ok, `${method} ${path}: ${r.status}`);
  return {data,cookie:r.headers.get('set-cookie')?.split(';')[0]};
}
assert.equal((await fetch(base)).status,200);
assert.equal((await api('/health')).data.database,'connected');
if(mode==='create') {
  const email=`ci-${randomUUID()}@example.test`;
  const password=randomUUID();
  const {data:{user},cookie}=await api('/auth/register','POST',{name:'Проверка Docker',email,password});
  const movie=(await api('/movies/1')).data;
  const {data:review}=await api('/reviews','POST',{movie_id:movie.id,rating:9,text:'Проверяем сохранение отзыва после пересоздания контейнеров.',quote_id:movie.quotes[0].id},cookie);
  await writeFile(stateFile,JSON.stringify({user,cookie,review,email,password}),{mode:0o600});
  console.log('Frontend, database, registration and review creation: OK');
} else {
  const s=JSON.parse(await readFile(stateFile,'utf8'));
  assert.equal((await api('/auth/me','GET',undefined,s.cookie)).data.user.id,s.user.id);
  const reviews=(await api('/reviews?user='+s.user.id)).data.reviews;
  assert.ok(reviews.some(r=>r.id===s.review.id&&r.text===s.review.text));
  await api('/reviews/'+s.review.id,'PUT',{text:'Обновлённый отзыв после проверки постоянного тома.',rating:10,spoiler:false},s.cookie);
  await api('/reviews/'+s.review.id,'DELETE',{},s.cookie);
  await api('/auth/logout','POST',{},s.cookie);
  assert.equal((await api('/auth/me','GET',undefined,s.cookie)).data.user,null);
  await api('/auth/login','POST',{email:s.email,password:s.password});
  await unlink(stateFile);
  console.log('Persistent volume and session, review edit/delete, logout/login: OK');
}
