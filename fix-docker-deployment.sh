#!/bin/bash

echo "🔧 Script de correção do deployment Docker"
echo "=========================================="

# Navegar para o diretório correto
cd /home/projetos/pastel-24h

# Passo 1: Garantir permissões do entrypoint
echo "📝 Corrigindo permissões do docker-entrypoint.sh..."
chmod +x docker-entrypoint.sh
git add docker-entrypoint.sh
git commit -m "fix: make docker-entrypoint.sh executable" || true

# Passo 2: Parar containers existentes
echo "🛑 Parando containers existentes..."
docker compose down

# Passo 3: Rebuild com cache limpo
echo "🔨 Reconstruindo imagem Docker..."
docker compose build --no-cache

# Passo 4: Iniciar containers
echo "🚀 Iniciando containers..."
docker compose up -d

# Passo 5: Aguardar inicialização
echo "⏳ Aguardando inicialização (15 segundos)..."
sleep 15

# Passo 6: Verificar logs
echo "📋 Verificando logs..."
docker compose logs --tail=50 app

# Passo 7: Verificar saúde
echo "🏥 Verificando saúde da aplicação..."
curl -f http://localhost:5000/api/health && echo -e "\n✅ Aplicação respondendo!" || echo -e "\n❌ Aplicação não está respondendo"

# Passo 8: Verificar tabela collaborator_consumption
echo "🔍 Verificando tabela collaborator_consumption..."
docker exec pastel24h_app sqlite3 /app/data/local.db ".tables" | grep -q collaborator_consumption && \
    echo "✅ Tabela collaborator_consumption encontrada!" || \
    echo "❌ Tabela collaborator_consumption NÃO encontrada!"

echo ""
echo "📊 Todas as tabelas no banco:"
docker exec pastel24h_app sqlite3 /app/data/local.db ".tables"

echo ""
echo "🎯 Script concluído!"