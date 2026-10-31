# Лаба 1 — nginx

## 1. Цель работы
Получить работающий результат: Nginx в качестве точки входа и балансировщика перед сервисом, обеспечивающий отказоустойчивость (работоспособность при падении одного из бэкендов), HTTPS, разделение статики и API, виртуальные хосты, ограничение частоты запросов и базовую авторизацию. А ТАКЖЕ немного помучаться

## 2. Структура проекта
Было много моментов, когда проверки не проходили и приходилось действовать разными способами (никогда не думал, что буду добиваться того, чтобы сервис был не 200). Итоговая структура директории `Lab1`:

```text
.
├── README.md
├── check.sh
├── docker-compose.yml
├── docs
│   ├── catalog-desktop.png
│   ├── dog.jpg
│   ├── max.jpeg
│   ├── rabbit.jpg
│   ├── rus.jpeg
│   ├── wall-desktop.png
│   ├── yku.jpeg
│   └── ysa.JPG
├── error-pages
│   ├── 404.html
│   └── 50x.html
├── frontend
│   ├── app.js
│   ├── favicon.svg
│   ├── index.html
│   ├── posters
│   │   ├── 1.svg
│   │   ├── 10.svg
│   │   ├── 11.svg
│   │   ├── 12.svg
│   │   ├── 2.svg
│   │   ├── 3.svg
│   │   ├── 4.svg
│   │   ├── 5.svg
│   │   ├── 6.svg
│   │   ├── 7.svg
│   │   ├── 8.svg
│   │   └── 9.svg
│   └── styles.css
├── nginx
│   ├── Dockerfile
│   ├── admin.html
│   └── nginx.conf
└── second-site
    └── index.html
```
Я понимаю, что может выглядеть, как ужас ужасный, По крайней мере, все есть и все работает (напдеюсь, что до сих пор работает)

## 3. nginx.conf

Я хочу разобрать, какие блоки кода отвечают за определенную часть задания. А вот целый nginx.conf можно посмотреть [по ссылке](nginx/nginx.conf)

* Сервис работает по HTTPS, а HTTP (порт 80) принудительно перенаправляется на HTTPS (443)
```text
    server {
        listen 80;
        server_name kadr.local second.local;
        return 301 https://$host$request_uri;
    }

    server {
        listen 443 ssl;
        server_name kadr.local;
# И далее остальной конфигурации (ты обязательно напишешь отчет и тд.)
```
Первый блок `server` слушает 80-й порт и мгновенно отдаёт код `301 Moved Permanently`, заставляя браузер перейти на `https://`. Второй блок слушает 443-й порт и использует директивы `ssl_certificate` для шифрования.

* Фронт и бэк разведены на одном хосте: статику фронтенда nginx отдаёт сам, запросы на `/api` проксирует на бэкенд. 
```text
    server {
        # ...
        root /var/www/frontend;
        index index.html;

        location / {
            try_files $uri $uri/ /index.html;
        }

        location /api/ {
            proxy_pass http://backend_pool;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
        }
```
`root /var/www/frontend;` - базовая папка для статистики, `try_files $uri $uri/ /index.html;` - если файл не надйен, отдаём аккуратненький index.html, `proxy_pass http://backend_pool;` - перенаправляем на upstream группу. ТО ЕСТЬ мы обслуживаем файлы из папки для обычных запросов, а если url начинается с `\api`, сработает `proxy_pass` и запрос уходит в Docker-сеть к контейнерам бека.

* Балансировка (upstream)
```text
    upstream backend_pool {
        server backend-1:3000 max_fails=2 fail_timeout=5s;
        server backend-2:3000 max_fails=2 fail_timeout=5s;
    }
```
Тут мы объявили о сервисах балансировки.
```text
        location /api/ {
            # ...
            proxy_next_upstream error timeout invalid_header http_500 http_502 http_503;
        }
```
Тут как раз-таки сам механизм отказоустояйичвости. если один упал, то работает другой (хелпуют друг друга как могут). Директива `upstream` создает пул из двух контейнеров. nginx распределяет запросы между ними (nginx тут просто босс). 

* Использовать alias для псевдонима пути к каталогу
```text
        location /docs {
            alias /var/www/docs;
            autoindex on;
        }
```
Тут я немного хихикнул, так как с alias мы немного знакомились на введении в linux (я увидел еще одно новое знакомое слово). Тут мы меняли путь `/docs` на реальную папку в контейнере, а потом разрешили росмотр списка файла.

* Настроить виртуальные хосты
```text
    server {
        listen 443 ssl;
        server_name second.local;
        ssl_certificate /etc/nginx/certs/cert.pem;
        ssl_certificate_key /etc/nginx/certs/key.pem;
        root /var/www/second-site;
        index index.html;
        location / {
            try_files $uri $uri/ =404;
        }
    }
```
Благодаря директиве `server_name`, Nginx понимает, какой домен запросил клиент. Если запросить `https://second.local/api/health`, Nginx выдаст `404 Not Found`, потому что в этом блоке `server` нет `location /api/`. Это доказывает изоляцию доменов.

* Ограничение частоты запросов (`limit_req`) на `/api`
Блок внутри `http`:
```text
    limit_req_zone $binary_remote_addr zone=api_limit:10m rate=1r/s;
```
Блок внутри `location /api/`:
```text
        location /api/ {
            limit_req zone=api_limit burst=5 nodelay;
            limit_req_status 429;
            # ...
```
Наш уже легендарный nginx считает запросы с одного IP. Если их больше 1 в секунду (с учётом буфера `burst=5`), он начинает отдавать HTTP-код 429.

* Своя страница 404 (и 50x)
```text
        location = /404.html { 
            root /var/www/error-pages; 
            internal;
        }
        location = /50x.html { 
            root /var/www/error-pages; 
            internal; 
        }
```
тут просто просиходит редирект на метоположение тех самых страниц ошибок в `error-pages`. Ниже покажу, как они выглядят:
404:

50x:

* Путь `/admin` закрыт базовой авторизацией (`auth_basic` + `htpasswd`)
```text
        location = /admin {
            auth_basic "Admin Area";
            auth_basic_user_file /etc/nginx/.htpasswd;
            alias /etc/nginx/admin.html;
            default_type text/html;
        }
```
Я ТОТАЛЬНО НЕ ПОНИМАЛ, ЧТО ДЕЛАТЬ. ну просто у меня проходил запрос \admin без пароля, а проверка слипалась, а оказалась, я просто очень отвратно написал этот блок кода в `nginx.conf`. Вот как работает блок моего заработанного птср: при запросе `/admin` nginx останавливает обработку и требует заголовок `Authorization`. Он сверяет введённые данные с файлом `.htpasswd` (который мы сгенерировали в Dockerfile). Если пароль верный, отдаётся файл `admin.html`.

## 4. check.sh и вывод
Ниже я представлю свой шедевр набор базовых проверок. полностью с кодом можно познакомится [по ссылке](check.sh)
* Балансировка между двумя бэкендами (3 запроса)
```text
for i in 1 2 3; do
  echo -n "  Запрос $i: "
  $C -I -H "Host: kadr.local" https://127.0.0.1/api/health 2>&1 | grep -i "x-backend-instance" || echo "  [!] Нет заголовка"
done
```
Аккуратненькое смотрим, что у нас выводит по трем запросам

* Отказоустойчивость: останавливаем backend-1
```text
docker compose stop backend-1
sleep 2
echo "  Проверяем /api/health (должен ответить backend-2):"
$C -I -H "Host: kadr.local" https://127.0.0.1/api/health 2>&1 | grep -iE "HTTP|x-backend" || echo "  [!] Ошибка"
```
`sleep` нужен, чтобы бек успел выключиться, проверяем отвечает ли второй бек. Сервер 200

* /admin без пароля -> 401
`$C -I -H "Host: kadr.local" https://127.0.0.1/admin 2>&1 | grep -i "HTTP" || echo "  [!] Ошибка"`
Один из проблемных моментов как раз. Но с командой все оке было. Смотрели проходит ли пользователь как админ, если нет у него пароля. Вот такие пироги

* /admin с паролем -> 200
`$C -I -u admin:admin123 -H "Host: kadr.local" https://127.0.0.1/admin 2>&1 | grep -i "HTTP" || echo "  [!] Ошибка"`
Аналогично, но в обратную сторону, когда есть пароль

* Лимит запросов (флуд -> 429)
```text
for i in {1..10}; do
  $C -o /dev/null -s -w "%{http_code} " -H "Host: kadr.local" https://127.0.0.1/api/health
done
```
Тут мы проверяли терпила ли у нас сервис или нет. Нащ сервис доказал, что нет и вывел 429. Ниже будет скриншот с выводом

* Чужой Host для API -> 404
`$C -I -H "Host: second.local" https://127.0.0.1/api/health 2>&1 | grep -i "HTTP" || echo "  [!] Ошибка"`
Тут мы проверяли, что будет если будет другой хост для Api. Мне выводило ошибку 404

* Запрос страницы 404
`$C -H "Host: kadr.local" https://127.0.0.1/etoy-stranicy-net | grep -i "404" | head -1 || echo "  [!] Ошибка"`
Делали аккуратненький запрос страницы 404, которую мы сделали

* Вывод по всем запросам с командой запуска мегафайла


## Описание ключевых файлов проекта

| Файл / Папка | Назначение |
|---|---|
| `docker-compose.yml` | Обеспечивает ФУЛЛОВО работу всех сервисов|
| `nginx/nginx.conf` | Основной конфигурационный файл Nginx |
| `nginx/Dockerfile` | Сборка кастомного образа nginx |
| `nginx/admin.html` | Статическая страница, отдаваемая после успешной авторизации на `/admin` |
| `frontend/` | файлы для фронта|
| `docs/` | Изображения |
| `second-site/` | Простая статическая страница для второго виртуального хоста (`second.local`) |
| `error-pages/` | Кастомные HTML-страницы для ошибок 404 и 50x |
| `check.sh` | проверки через `curl` |
| `Lab0/backend/src/app.js` | Исходный код бэкенда. В него добавлен middleware, отдающий заголовок `X-Backend-Instance` для доказательства балансировки. |

Я не заливал на гитхаб папки и фалйлы, которые генерятся специально для каждого пользователя, и которые как-то могут пробить безопасность тем, что будет утерян пароль для админа. Единственный такой косяк, что в `Dockerfile` У нас есть по умолчанию пароль, но чет я так долго на этом шаге сидел, что совсем опечалился и решил оставить, как есть

Сам проект запускал по адресу `https://127.0.0.1` или `https://kadr.local`

Вот такие дела. КАДР развивается. Всем спасибо за прочтение!
