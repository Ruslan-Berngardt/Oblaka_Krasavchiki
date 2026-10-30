#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="$CERT_DIR/cert.pem"
KEY_FILE="$CERT_DIR/key.pem"
HTPASSWD_FILE="/etc/nginx/.htpasswd"

if [ ! -f "$CERT_FILE" ]; then
  echo "Генерирация самоподписанный SSL-сертификат..."
  mkdir -p "$CERT_DIR"
  openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_FILE" \
    -out "$CERT_FILE" \
    -subj "/C=RU/ST=Moscow/L=Moscow/O=Kadr/CN=kadr.local" \
    2>/dev/null
  echo "Сертификат создан"
fi
if [ ! -f "$HTPASSWD_FILE" ]; then
  echo "Генерирация файла базовой авторизации (.htpasswd)..."
  if [ -z "$ADMIN_USER" ] || [ -z "$ADMIN_PASSWORD" ]; then
    echo "Ошибка: переменные ADMIN_USER и ADMIN_PASSWORD должны быть заданы"
    exit 1
  fi
  printf "%s:%s\n" "$ADMIN_USER" "$(openssl passwd -apr1 "$ADMIN_PASSWORD")" > "$HTPASSWD_FILE"
  echo "Файл авторизации создан для пользователя $ADMIN_USER"
fi

exec "$@"