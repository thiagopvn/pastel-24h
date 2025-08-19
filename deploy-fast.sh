#!/bin/bash
set -e

echo "🚀 Deploy rápido iniciando..."

# 1. Pull do código
cd /home/projetos/pastel-24h
git pull origin main

# 2. Build sem --no-cache (usa cache do Docker, MUITO mais rápido)
docker compose build app

# 3. Restart rápido sem down/up completo
docker compose restart app

# 4. Verificar logs
sleep 5
docker compose logs app --tail=5

echo "✅ Deploy concluído!"
curl -I http://localhost:5000/