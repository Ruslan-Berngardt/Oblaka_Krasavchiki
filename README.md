# Облака — лабораторные работы (DevOps, 2 курс)

Репозиторий команды Oblaka_Krasavchiki.

| Работа | Описание | Инструкция |
|---|---|---|
| [Lab0](Lab0/) | Свой сервис «Кадр»: каталог фильмов, личные стены, бэкенд и PostgreSQL | [README](Lab0/README.md) |

## Быстрый запуск Лабы 0

Нужны Node.js 22.9+ и запущенный PostgreSQL 17 с пользователем и базой `kadr`. Подробности в [Lab0/README.md](Lab0/README.md).

```bash
git clone https://github.com/Ruslan-Berngardt/Oblaka_Krasavchiki.git
cd Oblaka_Krasavchiki/Lab0
cp .env.example .env
npm ci
npm start
```

Приложение откроется на http://localhost:3000.
