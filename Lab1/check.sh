#!/bin/bash

C="curl -sk"

echo "HTTP -> HTTPS редирект (301)"
$C -I http://127.0.0.1 2>&1 | grep -iE "HTTP|location" || echo "  [!] Не удалось получить редирект"
echo ""

echo "Балансировка между двумя бэкендами (3 запроса)"
for i in 1 2 3; do
  echo -n "  Запрос $i: "
  $C -I -H "Host: kadr.local" https://127.0.0.1/api/health 2>&1 | grep -i "x-backend-instance" || echo "  [!] Нет заголовка"
done
echo ""

echo "Отказоустойчивость: останавливаем backend-1"
docker compose stop backend-1
sleep 2
echo "  Проверяем /api/health (должен ответить backend-2):"
$C -I -H "Host: kadr.local" https://127.0.0.1/api/health 2>&1 | grep -iE "HTTP|x-backend" || echo "  [!] Ошибка"
echo ""

echo "Запускаем backend-1 обратно"
docker compose start backend-1
sleep 3
echo ""

echo "/admin без пароля -> 401"
$C -I -H "Host: kadr.local" https://127.0.0.1/admin 2>&1 | grep -i "HTTP" || echo "  [!] Ошибка"
echo ""

echo "/admin с паролем -> 200"
$C -I -u admin:admin123 -H "Host: kadr.local" https://127.0.0.1/admin 2>&1 | grep -i "HTTP" || echo "  [!] Ошибка"
echo ""

echo "Лимит запросов (флуд -> 429)"
for i in {1..10}; do
  $C -o /dev/null -s -w "%{http_code} " -H "Host: kadr.local" https://127.0.0.1/api/health
done
echo " (должно появиться несколько 429)"
echo ""

echo "Виртуальный хост second.local"
$C -H "Host: second.local" https://127.0.0.1/ | head -3 || echo "  [!] Ошибка"
echo ""

echo "Чужой Host для API -> 404"
$C -I -H "Host: second.local" https://127.0.0.1/api/health 2>&1 | grep -i "HTTP" || echo "  [!] Ошибка"
echo ""

echo "Кастомная 404"
$C -H "Host: kadr.local" https://127.0.0.1/etoy-stranicy-net | grep -i "404" | head -1 || echo "  [!] Ошибка"
echo ""

echo "Все проверки завершены!"