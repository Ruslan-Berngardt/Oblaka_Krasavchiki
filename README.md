# Облака — лабораторные работы

Репозиторий команды **Oblaka_Krasavchiki**.

| Работа | Содержание | Инструкция |
|---|---|---|
| [Lab0](Lab0/) | «Кадр»: каталог фильмов, стены с ревью, бэкенд и PostgreSQL | [Полный запуск через Docker](Lab0/README.md) |
| [Lab1](Lab1/) | Материалы следующей лабораторной | [Lab1/README.md](Lab1/README.md) |

## Как открыть сервис

Основной способ — Docker Desktop. Отдельно устанавливать Node.js, npm и PostgreSQL, создавать роли в psql и редактировать DATABASE_URL не требуется.

1. Установите и запустите Docker Desktop. В терминале проверьте `docker version` (должны быть Client и Server) и `docker compose version`.
2. Скачайте **текущую main**: [ZIP](https://github.com/Ruslan-Berngardt/Oblaka_Krasavchiki/archive/refs/heads/main.zip), распакуйте и откройте терминал в `Lab0`. Либо используйте Git:

   ```bash
   git clone https://github.com/Ruslan-Berngardt/Oblaka_Krasavchiki.git
   cd Oblaka_Krasavchiki/Lab0
   ```

3. Создайте локальные Docker-настройки. **macOS/Linux:**

   ```bash
   sh scripts/setup-docker-env.sh
   ```

   **Windows PowerShell:**

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-docker-env.ps1
   ```

   Скрипт сам создаст случайный пароль БД в `.env.docker`. Готового общего пароля нет; существующий файл не перезаписывается.

4. В той же папке запустите:

   ```bash
   docker compose --env-file .env.docker up --build -d --wait
   docker compose --env-file .env.docker ps
   ```

5. Откройте **http://localhost:8080**, нажмите «Войти» → «Регистрация» и создайте аккаунт сайта.

Все подробности, включая переход со старого запуска, остановку, сохранение отзывов, смену порта и ошибки: **[Lab0/README.md](Lab0/README.md)**.

Лабораторная остаётся в `Lab0/`. Docker-упаковка добавлена для удобства запуска; полный набор экспериментов из лабораторных по nginx, Docker и CI/CD этим не заменяется.
