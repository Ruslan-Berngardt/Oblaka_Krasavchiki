const $ = selector => document.querySelector(selector);
const main = $('#main');
const modal = $('#modal');
const state = { user: null, genres: [], genre: '', search: '', random: false, reviews: new Map(), next: null, routeVersion: 0, catalogVersion: 0 };
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const date = value => new Date(value).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`/api${path}`, { method, credentials: 'same-origin', headers: method === 'GET' ? {} : { 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body || {}) }) });
  let data;
  try { data = await response.json(); } catch { throw new Error('Не удалось получить ответ сервера'); }
  if (!response.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
  return data;
}
let toastTimer;
function toast(message) { $('#toast').textContent = message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4000); }
function openModal(html) { $('#modal-content').innerHTML = html; if (!modal.open) modal.showModal(); modal.scrollTop = 0; }
$('.close-dialog').addEventListener('click', () => modal.close());
modal.addEventListener('click', event => { if (event.target === modal) { const rect = modal.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) modal.close(); } });
function account() {
  $('#account').innerHTML = state.user ? `<div class="account-row"><a href="#wall" class="avatar" aria-label="Моя стена">${esc(state.user.name[0].toUpperCase())}</a><a href="#wall" class="account-name">${esc(state.user.name)}</a><button class="text-btn" data-action="logout">Выйти</button></div>` : '<button class="btn" data-action="auth">Войти <span aria-hidden="true">↗</span></button>';
}
function empty(title, text, button = '') { return `<div class="empty"><h3>${esc(title)}</h3><p>${esc(text)}</p>${button}</div>`; }
function movieCard(movie) {
  return `<article class="movie-card"><button class="poster-button" data-movie="${movie.id}" aria-label="Открыть фильм ${esc(movie.title)}"><img class="poster" src="${esc(movie.poster)}" alt="Авторская графическая обложка: ${esc(movie.title)}" loading="lazy" width="400" height="600">${movie.review_count ? `<span class="poster-tag">★ ${movie.rating} / 10</span>` : ''}</button><button class="movie-title" data-movie="${movie.id}">${esc(movie.title)}</button><div class="movie-meta">${movie.year} <span aria-hidden="true">·</span> ${esc(movie.genres[0])}</div></article>`;
}
async function home(version) {
  main.innerHTML = `<section class="hero"><div class="hero-copy"><div class="eyebrow">Личный дневник большого кино</div><h1>Кино заканчивается.<br>Впечатления <em>остаются.</em></h1><p>Находи фильмы, сохраняй любимые цитаты<br>и рассказывай, что осталось после титров.</p><div class="hero-actions"><button class="btn btn-primary" data-action="explore">Найти свой фильм <span aria-hidden="true">↗</span></button><span class="hero-note">Каждому фильму — своё мнение.</span></div></div><aside class="feature"><div class="feature-top"><span>В фокусе / 01</span><span>Классика вне времени</span></div><div class="feature-art" aria-hidden="true"></div><div class="feature-copy"><div class="eyebrow">Общество мёртвых поэтов</div><p class="feature-quote">«Лови момент».</p><div class="feature-bottom"><span>1989 · Питер Уир · Драма</span><button class="round-arrow" data-movie="6" aria-label="Открыть Общество мёртвых поэтов">↗</button></div></div></aside></section><section class="catalog" id="catalog"><div class="section-heading"><div><h2>Что посмотрим?</h2><div class="section-sub">Истории, к которым хочется возвращаться</div></div><label class="search"><span class="search-icon" aria-hidden="true">⌕</span><input id="search" type="search" maxlength="150" placeholder="Фильм или режиссёр" aria-label="Поиск фильма или режиссёра" value="${esc(state.search)}"></label></div><div class="filter-row"><div class="genres" aria-label="Фильтры по жанру"><button class="chip ${!state.genre ? 'selected' : ''}" data-genre="" aria-pressed="${!state.genre}">Все фильмы</button>${state.genres.map(g => `<button class="chip ${String(g.id) === state.genre ? 'selected' : ''}" data-genre="${g.id}" aria-pressed="${String(g.id) === state.genre}">${esc(g.name)}</button>`).join('')}</div><button class="btn random-button" data-action="random"><span class="random-icon" aria-hidden="true">⤨</span> Рандомайз</button></div><div class="results-info" id="results-info" role="status"></div><div class="movie-grid" id="movies"><div class="loading">Загружаем фильмы…</div></div><div class="catalog-bottom"><span>Выбирай сердцем. Делись впечатлениями.</span><span>Твоя следующая история — здесь ↗</span></div></section><section class="callout"><span class="callout-mark" aria-hidden="true">“</span><div class="callout-copy"><h3>У каждого фильма есть послевкусие.</h3><p>Дай ему слова. Первое ревью — начало твоей истории кино.</p></div><button class="btn btn-dark" data-action="start">${state.user ? 'На мою стену' : 'Создать свою стену'} <span aria-hidden="true">↗</span></button></section>`;
  let searchTimer;
  $('#search').addEventListener('input', event => { state.search = event.target.value; state.random = false; clearTimeout(searchTimer); searchTimer = setTimeout(() => { if (state.routeVersion === version) loadMovies(); }, 250); });
  await loadMovies();
}
async function loadMovies() {
  const version = ++state.catalogVersion;
  const routeVersion = state.routeVersion;
  const target = $('#movies');
  if (!target) return;
  target.setAttribute('aria-busy', 'true');
  try {
    const params = new URLSearchParams({ search: state.search, genre: state.genre, random: String(state.random) });
    const movies = await api(`/movies?${params}`);
    if (version !== state.catalogVersion || routeVersion !== state.routeVersion) return;
    target.innerHTML = movies.length ? movies.map(movieCard).join('') : empty('Ничего не нашлось', 'Попробуй другой жанр или измени поисковый запрос.', '<button class="btn" data-action="reset">Сбросить фильтры</button>');
    $('#results-info').textContent = `${state.random ? 'Случайная подборка' : 'В каталоге'} / ${movies.length} фильмов`;
  } catch (error) { if (version === state.catalogVersion && routeVersion === state.routeVersion) target.innerHTML = empty('Не удалось загрузить каталог', error.message, '<button class="btn" data-action="retry-catalog">Попробовать снова</button>'); }
  finally { target.removeAttribute('aria-busy'); }
}
function reviewCard(review) {
  state.reviews.set(review.id, review);
  const own = state.user?.id === review.user_id;
  const content = `${review.quote ? `<blockquote class="review-quote">«${esc(review.quote)}»</blockquote>` : ''}<p class="review-text">${esc(review.text)}</p>`;
  return `<article class="review"><div class="review-head"><a class="avatar" href="#user/${review.user_id}" aria-label="Стена ${esc(review.author)}">${esc(review.author[0].toUpperCase())}</a><div class="author-info"><a href="#user/${review.user_id}">${esc(review.author)}</a><time datetime="${esc(review.created_at)}">${date(review.created_at)}</time></div><span class="review-rating">${review.rating}<small> / 10</small></span></div><div class="review-body"><button class="poster-button" data-movie="${review.movie_id}" aria-label="Открыть ${esc(review.movie_title)}"><img src="${esc(review.poster)}" alt="" loading="lazy"></button><div><h3><a href="#movie/${review.movie_id}">${esc(review.movie_title)}</a> <span class="muted">(${review.movie_year})</span></h3>${review.spoiler ? `<details class="spoiler"><summary>Осторожно, спойлеры — раскрыть ревью</summary>${content}</details>` : content}${own ? `<div class="review-actions"><button class="text-btn" data-edit="${review.id}">Редактировать</button><button class="text-btn danger" data-delete="${review.id}">Удалить</button></div>` : ''}</div></div></article>`;
}
async function feed(userId, version) {
  const user = userId ? await api(`/users/${userId}`) : null;
  if (version !== state.routeVersion) return;
  main.innerHTML = `<section class="page-heading ${user ? 'profile-heading' : ''}">${user ? `<span class="avatar">${esc(user.name[0].toUpperCase())}</span>` : ''}<div><div class="eyebrow">${user ? 'Личная история кино' : 'После финальных титров'}</div><h1>${user ? esc(user.name) : 'Кино. Люди. Мнения.'}</h1><p>${user ? 'Фильмы, которые остались со мной.' : 'Читай впечатления других и находи новые поводы посмотреть кино.'}</p></div></section><section class="feed"><div id="review-list"><div class="loading">Загружаем ревью…</div></div><button id="load-more" class="btn load-more" hidden>Показать ещё</button></section>`;
  const load = async (append = false) => {
    const button = $('#load-more');
    button.disabled = true;
    try {
      const params = new URLSearchParams();
      if (userId) params.set('user', userId);
      if (append && state.next) params.set('before', state.next);
      const result = await api(`/reviews?${params}`);
      if (version !== state.routeVersion) return;
      state.next = result.next;
      const html = result.reviews.map(reviewCard).join('');
      if (append) $('#review-list').insertAdjacentHTML('beforeend', html);
      else $('#review-list').innerHTML = html || empty('Здесь начинается история', user ? 'На этой стене пока нет ревью. Выбери фильм и поделись впечатлением.' : 'Пока никто не поделился впечатлениями. Твоё ревью может стать первым.', '<a class="btn btn-primary" href="#home">Выбрать фильм ↗</a>');
      button.hidden = !result.next;
    } catch (error) { if (version === state.routeVersion) { if (append) toast(error.message); else $('#review-list').innerHTML = empty('Не удалось загрузить ревью', error.message, '<button class="btn" data-action="retry-page">Повторить</button>'); } }
    finally { button.disabled = false; }
  };
  $('#load-more').addEventListener('click', () => load(true));
  await load();
}
async function route() {
  const version = ++state.routeVersion;
  const hash = location.hash.slice(1) || 'home';
  const nav = hash === 'wall' || hash.startsWith('user/') ? 'wall' : hash === 'feed' ? 'feed' : 'home';
  document.querySelectorAll('[data-nav]').forEach(link => { link.classList.toggle('active', link.dataset.nav === nav); if (link.dataset.nav === nav) link.setAttribute('aria-current', 'page'); else link.removeAttribute('aria-current'); });
  main.innerHTML = '<div class="loading">Один момент…</div>';
  state.reviews.clear();
  try {
    if (hash === 'home') await home(version);
    else if (hash === 'feed') await feed(null, version);
    else if (hash === 'wall') {
      if (state.user) await feed(state.user.id, version);
      else main.innerHTML = `<section class="page-heading"><div class="eyebrow">Твоё место в мире кино</div><h1>У хорошего кино<br>есть <em>твоя история.</em></h1></section>${empty('Собери свою стену', 'Войди или создай аккаунт, чтобы сохранять отзывы, оценки и любимые цитаты.', '<button class="btn btn-primary" data-action="register">Создать аккаунт ↗</button> <button class="btn" data-action="auth">Войти</button>')}`;
    } else if (/^user\/\d+$/.test(hash)) await feed(hash.split('/')[1], version);
    else if (/^movie\/\d+$/.test(hash)) { await home(version); if (version === state.routeVersion) await showMovie(+hash.split('/')[1]); }
    else main.innerHTML = empty('Страница не найдена', 'Вернись в каталог — там много хорошего кино.', '<a class="btn" href="#home">В каталог</a>');
  } catch (error) { if (version === state.routeVersion) main.innerHTML = empty('Не удалось открыть страницу', error.message, '<button class="btn" data-action="retry-page">Повторить</button>'); }
}
function showAuth(mode = 'login', after = null) {
  const register = mode === 'register';
  openModal(`<div class="auth-form"><div class="eyebrow">Кино объединяет</div><h2 id="modal-title" class="modal-heading">${register ? 'Твоя история начинается.' : 'С возвращением.'}</h2><p class="modal-subtitle">${register ? 'Создай аккаунт и сохрани своё первое впечатление.' : 'Твоя стена и любимые фильмы уже ждут.'}</p><div class="auth-tabs"><button class="${!register ? 'selected' : ''}" id="tab-login">Войти</button><button class="${register ? 'selected' : ''}" id="tab-register">Регистрация</button></div><form id="auth-form">${register ? '<label class="field">Как тебя зовут<input name="name" autocomplete="nickname" minlength="2" maxlength="40" required placeholder="Имя на твоей стене"></label>' : ''}<label class="field">Email<input name="email" type="email" autocomplete="email" maxlength="254" required placeholder="you@example.com"></label><label class="field">Пароль<input name="password" type="password" autocomplete="${register ? 'new-password' : 'current-password'}" minlength="8" maxlength="128" required placeholder="Не менее 8 символов"></label><p class="error" id="auth-error" role="alert"></p><button class="btn btn-primary" type="submit">${register ? 'Создать аккаунт' : 'Войти'} ↗</button></form></div>`);
  $('#tab-login').onclick = () => showAuth('login', after);
  $('#tab-register').onclick = () => showAuth('register', after);
  $('#auth-form').onsubmit = async event => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('[type=submit]'); button.disabled = true;
    try {
      const result = await api(`/auth/${register ? 'register' : 'login'}`, { method: 'POST', body: Object.fromEntries(new FormData(form)) });
      state.user = result.user; account(); modal.close(); toast(register ? 'Добро пожаловать в Кадр!' : 'Ты снова в Кадре');
      await route(); if (after) await after();
    } catch (error) { $('#auth-error').textContent = error.message; }
    finally { button.disabled = false; }
  };
}
async function showMovie(movieId) {
  const movie = await api(`/movies/${movieId}`);
  openModal(`<div class="movie-detail"><img src="${esc(movie.poster)}" alt="Обложка ${esc(movie.title)}"><div><div class="eyebrow">${esc(movie.genres.join(' / '))}</div><h2 id="modal-title">${esc(movie.title)}</h2><div class="detail-meta">${esc(movie.original_title)}<br>${movie.year} · ${movie.duration} мин · ${esc(movie.director)}</div><p class="movie-description">${esc(movie.description)}</p><p class="detail-meta">${movie.review_count ? `★ ${movie.rating} / 10 · Отзывов: ${movie.review_count}` : 'Пока без оценок — стань первым'}</p><button class="btn btn-primary" id="write-review">Написать ревью ↗</button></div></div><section class="quote-section"><h3>Слова, которые остаются</h3><p class="detail-meta">Выбери цитату, чтобы добавить её к своему ревью.</p>${movie.quotes.map(q => `<div class="quote-choice"><p>«${esc(q.text)}»</p><button class="btn btn-small" data-quote="${q.id}">Взять цитату ↗</button></div>`).join('')}</section><section class="movie-reviews"><h3>После просмотра</h3>${movie.reviews.length ? movie.reviews.map(reviewCard).join('') : '<p class="detail-meta">Здесь пока тихо. Поделись первым впечатлением.</p>'}</section>`);
  $('#write-review').onclick = () => showReview(movie);
  document.querySelectorAll('[data-quote]').forEach(button => button.onclick = () => showReview(movie, +button.dataset.quote));
}
function showReview(movie, quoteId = null, existing = null) {
  if (!state.user) return showAuth('login', () => showReview(movie, quoteId, existing));
  const selected = existing?.quote_id ?? quoteId;
  openModal(`<div class="eyebrow">${existing ? 'Новый взгляд на знакомое' : 'Твоё мнение имеет значение'}</div><h2 id="modal-title" class="modal-heading">${existing ? 'Изменить ревью' : 'После титров'}</h2><p class="modal-subtitle">${esc(movie.title)} · ${movie.year}</p><form id="review-form"><label class="field">Твоя оценка<select name="rating">${Array.from({ length: 10 }, (_, i) => i + 1).map(n => `<option value="${n}" ${n === (existing?.rating || 8) ? 'selected' : ''}>${n} / 10</option>`).join('')}</select></label><label class="field">Цитата из фильма<select name="quote_id"><option value="">Без цитаты</option>${movie.quotes.map(q => `<option value="${q.id}" ${q.id === selected ? 'selected' : ''}>${esc(q.text)}</option>`).join('')}</select></label><label class="field">Что осталось после просмотра?<textarea name="text" minlength="10" maxlength="5000" required placeholder="Расскажи, что зацепило. Здесь не нужно быть кинокритиком.">${esc(existing?.text || '')}</textarea><small>От 10 до 5000 символов. Один фильм — одно твоё ревью.</small></label><p class="error" id="review-error" role="alert"></p><div class="form-footer"><label><input type="checkbox" name="spoiler" ${existing?.spoiler ? 'checked' : ''}> В тексте есть спойлеры</label><button class="btn btn-primary" type="submit">${existing ? 'Сохранить изменения' : 'Опубликовать ревью'} ↗</button></div></form>`);
  $('#review-form').onsubmit = async event => {
    event.preventDefault();
    const button = event.currentTarget.querySelector('[type=submit]'); button.disabled = true;
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api(existing ? `/reviews/${existing.id}` : '/reviews', { method: existing ? 'PUT' : 'POST', body: { movie_id: movie.id, rating: +values.rating, text: values.text, quote_id: values.quote_id ? +values.quote_id : null, spoiler: values.spoiler === 'on' } });
      modal.close(); toast(existing ? 'Ревью обновлено' : 'Ревью опубликовано на твоей стене');
      if (location.hash === '#wall') await route(); else location.hash = 'wall';
    } catch (error) { $('#review-error').textContent = error.message; }
    finally { button.disabled = false; }
  };
}
document.addEventListener('click', async event => {
  const button = event.target.closest('button');
  if (!button) return;
  try {
    if (button.dataset.movie) { await showMovie(+button.dataset.movie); return; }
    if (button.hasAttribute('data-genre')) {
      state.genre = button.dataset.genre; state.random = false;
      document.querySelectorAll('[data-genre]').forEach(chip => { const selected = chip.dataset.genre === state.genre; chip.classList.toggle('selected', selected); chip.setAttribute('aria-pressed', selected); });
      await loadMovies(); return;
    }
    if (button.dataset.edit) {
      const review = state.reviews.get(+button.dataset.edit);
      showReview(await api(`/movies/${review.movie_id}`), null, review); return;
    }
    if (button.dataset.delete) {
      const reviewId = +button.dataset.delete;
      openModal('<h2 id="modal-title" class="modal-heading">Удалить ревью?</h2><p class="modal-subtitle">Отзыв исчезнет со стены. Это действие нельзя отменить.</p><div class="form-footer"><button class="btn" id="cancel-delete">Оставить</button><button class="btn btn-primary" id="confirm-delete">Удалить</button></div><p class="error" id="delete-error" role="alert"></p>');
      $('#cancel-delete').onclick = () => modal.close();
      $('#confirm-delete').onclick = async event => { event.target.disabled = true; try { await api(`/reviews/${reviewId}`, { method: 'DELETE' }); modal.close(); toast('Ревью удалено'); await route(); } catch (error) { $('#delete-error').textContent = error.message; event.target.disabled = false; } };
      return;
    }
    switch (button.dataset.action) {
      case 'auth': showAuth(); break;
      case 'register': showAuth('register'); break;
      case 'start': if (state.user) location.hash = 'wall'; else showAuth('register'); break;
      case 'logout': await api('/auth/logout', { method: 'POST' }); state.user = null; account(); await route(); toast('Ты вышел из аккаунта'); break;
      case 'explore': $('#catalog').scrollIntoView({ behavior: 'smooth' }); $('#search').focus({ preventScroll: true }); break;
      case 'random': state.random = true; await loadMovies(); toast('Новая подборка готова'); break;
      case 'reset': state.genre = ''; state.search = ''; state.random = false; await route(); break;
      case 'retry-catalog': await loadMovies(); break;
      case 'retry-page': await route(); break;
    }
  } catch (error) { toast(error.message); }
});
window.addEventListener('hashchange', () => { modal.close(); route(); });
async function boot() {
  try {
    const [auth, genres] = await Promise.all([api('/auth/me'), api('/genres')]);
    state.user = auth.user; state.genres = genres; account(); await route();
  } catch (error) {
    main.innerHTML = empty('Не удалось подключиться', `${error.message}. Проверь, что сервер и база данных запущены.`, '<button class="btn" id="retry-boot">Повторить</button>');
    $('#retry-boot').onclick = boot;
  }
}
boot();
