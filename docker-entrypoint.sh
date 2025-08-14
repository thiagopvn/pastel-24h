#!/bin/sh
set -e

echo "[entrypoint] Iniciando aplicação..."

# Verificar se o banco de dados existe
if [ ! -f /app/data/local.db ]; then
    echo "[entrypoint] Banco de dados não encontrado. Executando migrações..."
    npm run db:migrate
    echo "[entrypoint] Migrações concluídas com sucesso"
else
    echo "[entrypoint] Banco de dados já existe. Verificando migrações pendentes..."
    npm run db:migrate || true
fi

echo "[entrypoint] Iniciando servidor..."
exec npm run start