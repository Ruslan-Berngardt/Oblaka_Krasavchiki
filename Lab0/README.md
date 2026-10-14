# Кадр / личная история кино

Лабораторная работа 0 — свой сервис. Команда **Oblaka_Krasavchiki**.

Каталог помогает выбрать фильм, а личная стена позволяет сохранить впечатления, оценку и цитату после просмотра. Сервис будет использоваться в лабораторных 1–3.

![Работающее приложение](docs/screenshot.png)

## Возможности

- 12 фильмов, поиск по названию и режиссёру, фильтры по жанрам.
- Регистрация, вход и выход.
- Создание, редактирование и удаление своего ревью: текст, оценка 1–10, цитата, отметка спойлеров.
- Личные стены пользователей и общая лента отзывов.

## Архитектура

| Часть | Технология | Что делает |
|---|---|---|
| Фронтенд | HTML, CSS, JavaScript (`frontend/`) | Каталог, формы, запросы к бэкенду по `/api` |
| Бэкенд | Node.js, Express 5, pg (`backend/`) | Авторизация, валидация, запись в БД и чтение из неё |
| База данных | PostgreSQL | Отдельный сетевой сервис: пользователи, сессии, фильмы, отзывы |

Браузер обращается к бэкенду, бэкенд выполняет SQL-запросы к PostgreSQL. Фронтенд к БД напрямую не подключается. В этой лабораторной статику фронтенда отдаёт сам Express.

Таблицы: `users`, `sessions`, `movies`, `genres`, `movie_genres`, `quotes`, `reviews`. При первом запуске бэкенд сам создаёт их по `database/schema.sql` и наполняет каталог из `database/seed.sql`.

## Требования

- Git
- Node.js 22.9 или новее
- PostgreSQL 17

## Запуск

### 1. Клонировать репозиторий

```bash
git clone https://github.com/Ruslan-Berngardt/Oblaka_Krasavchiki.git
cd Oblaka_Krasavchiki/Lab0
```

### 2. Установить и запустить PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@17
brew services start postgresql@17
echo 'export PATH="/opt/homebrew/opt/postgresql@17/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
pg_isready
```
Последняя команда должна вернуть `accepting connections`.

**Linux / Windows:** установите PostgreSQL 17 с https://www.postgresql.org/download/ и запустите службу.

### 3. Создать пользователя и базу данных

```bash
psql postgres -c "CREATE USER kadr WITH PASSWORD 'kadr_local_password';"
psql postgres -c "CREATE DATABASE kadr OWNER kadr;"
```

В Linux может понадобиться `sudo -u postgres psql`, в Windows — SQL Shell (psql) или pgAdmin.

### 4. Настроить подключение

```bash
cp .env.example .env
```

По умолчанию в `.env` указано:
```
DATABASE_URL=postgresql://kadr:kadr_local_password@localhost:5432/kadr
```
Если вы использовали другие имя, пароль или порт, измените `DATABASE_URL`. В PowerShell вместо `cp` используйте `Copy-Item .env.example .env`.

### 5. Установить зависимости и запустить

```bash
npm ci
npm start
```

### 6. Открыть приложение

**http://localhost:3000**

Не открывайте HTML двойным щелчком: интерфейсу нужен работающий бэкенд.

## Настройки

| Переменная | Описание |
|---|---|
| `DATABASE_URL` | Строка подключения к PostgreSQL |
| `PORT` | Порт бэкенда (по умолчанию 3000) |

## Проверка работоспособности

1. Открыть http://localhost:3000.
2. Нажать «Войти» → «Регистрация» и создать аккаунт.
3. Выбрать фильм, поставить оценку, написать отзыв, нажать «Опубликовать ревью».
4. Отзыв появится на стене пользователя.
5. Перезагрузить страницу. Отзыв на месте, значит он сохранён в PostgreSQL.
6. При желании посмотреть запись прямо в базе:
   ```bash
   psql -U kadr -d kadr -h localhost -c "SELECT id, user_id, movie_id, rating, text FROM reviews;"
   ```

## Если что-то не работает

| Симптом | Что делать |
|---|---|
| `npm: command not found` | Установить Node.js: `brew install node` |
| Приложение падает при старте | Проверить, что PostgreSQL запущен: `pg_isready` |
| Ошибка авторизации в БД | Проверить, что логин, пароль и имя базы в `DATABASE_URL` совпадают с созданными в шаге 3 |
| Порт 3000 занят | Указать другой `PORT` в `.env` |

## Структура

```
Lab0/
├── backend/src/   # app.js (API), auth.js, db.js, server.js
├── frontend/      # страница, скрипты, стили, обложки
├── database/      # schema.sql, seed.sql
├── docs/          # скриншот
├── package.json
└── .env.example
```
