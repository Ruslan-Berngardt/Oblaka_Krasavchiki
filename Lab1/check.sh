#!/bin/bash
set -e

C="curl -sk"
$C -I http://kadr.local 2>&1 | grep -E "HTTP|location"
$C https://kadr.local/ | head -3
for i in 1 2 3; do
  echo -n "  Запрос $i: "
  $C -I https://kadr.local/api/health 2>&1 | grep -i "x-backend-instance"
done
docker stop kadr-lab1-backend-1-1 2>/dev/null || docker compose -f docker-compose.yml stop backend-1
sleep 2
$C -I https://kadr.local/api/health 2>&1 | grep -E "HTTP|x-backend"
docker start kadr-lab1-backend-1-1 2>/dev/null || docker compose -f docker-compose.yml start backend-1
sleep 2
$C -I https://kadr.local/admin 2>&1 | grep -E "HTTP"
$C -I -u admin:admin123 https://kadr.local/admin 2>&1 | grep -E "HTTP"
for i in {1..10}; do
  $C -o /dev/null -s -w "%{http_code} " https://kadr.local/api/health
done
$C https://second.local/ | head -3
$C -I https://second.local/api/health 2>&1 | grep -E "HTTP"
$C https://kadr.local/etoy-stranicy-net | head -5
$C https://kadr.local/docs/ | grep -E "\.jpg|\.png" | head -3

echo "Все проверки завершены!"