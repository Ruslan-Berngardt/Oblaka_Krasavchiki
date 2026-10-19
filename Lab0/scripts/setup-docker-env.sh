#!/bin/sh
# Run with: sh scripts/setup-docker-env.sh
set -eu
cd "$(dirname "$0")/.."
if [ -e .env.docker ]; then
    printf '%s\n' '.env.docker already exists; existing settings were preserved.'
    exit 0
fi
umask 077
password=$(od -An -N24 -tx1 /dev/urandom | tr -d ' \n')
if [ "${#password}" -ne 48 ]; then
    printf '%s\n' 'Could not generate a database password.' >&2
    exit 1
fi
# Noclobber prevents a second invocation from overwriting an existing secret.
set -C
cat > .env.docker <<ENV
# Local Docker configuration. Do not commit or share this file.
POSTGRES_USER=kadr
POSTGRES_DB=kadr
POSTGRES_PASSWORD=$password
HOST_PORT=8080
ENV
printf '%s\n' '.env.docker created. The database password is stored locally and was not printed.'
