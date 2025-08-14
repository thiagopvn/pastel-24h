#!/bin/bash

echo "🔧 Redeployment do Pastel24h com correções"
echo "==========================================="

# Navegar para o diretório correto
cd /home/projetos/pastel-24h

# Passo 1: Parar e remover containers existentes
echo "🛑 Parando containers existentes..."
docker compose down
docker rm -f pastel24h_app 2>/dev/null || true

# Passo 2: Remover imagem antiga
echo "🗑️ Removendo imagem antiga..."
docker rmi pastel-24h-app 2>/dev/null || true

# Passo 3: Rebuild com cache limpo
echo "🔨 Reconstruindo imagem Docker..."
docker compose build --no-cache

# Passo 4: Iniciar containers
echo "🚀 Iniciando containers..."
docker compose up -d

# Passo 5: Aguardar inicialização
echo "⏳ Aguardando inicialização (20 segundos)..."
sleep 20

# Passo 6: Verificar logs
echo "📋 Verificando logs recentes..."
docker compose logs --tail=30 app

# Passo 7: Verificar status do container
echo "📦 Status do container:"
docker ps -a | grep pastel24h

# Passo 8: Verificar saúde
echo "🏥 Verificando saúde da aplicação..."
for i in {1..5}; do
    if curl -f http://localhost:5000/api/health 2>/dev/null; then
        echo -e "\n✅ Aplicação respondendo!"
        break
    else
        echo "⏳ Tentativa $i/5 - Aguardando mais 5 segundos..."
        sleep 5
    fi
done

# Passo 9: Verificar tabela collaborator_consumption
echo ""
echo "🔍 Verificando tabela collaborator_consumption..."
docker exec pastel24h_app sh -c "ls -la /app/data/local.db" 2>/dev/null && echo "✅ Banco de dados encontrado"

# Tentar acessar o banco dentro do container
docker exec pastel24h_app sh -c "echo '.tables' | sqlite3 /app/data/local.db 2>/dev/null" | grep -q collaborator_consumption && \
    echo "✅ Tabela collaborator_consumption encontrada!" || \
    echo "❌ Tabela collaborator_consumption NÃO encontrada!"

echo ""
echo "📊 Todas as tabelas no banco (dentro do container):"
docker exec pastel24h_app sh -c "echo '.tables' | sqlite3 /app/data/local.db 2>/dev/null" || echo "⚠️ Não foi possível listar tabelas"

echo ""
echo "📊 Todas as tabelas no banco (local):"
sqlite3 data/local.db ".tables" 2>/dev/null || echo "⚠️ SQLite3 não disponível localmente"

echo ""
echo "🔍 Debug - Verificando arquivos no container:"
docker exec pastel24h_app ls -la /app/ 2>/dev/null || echo "⚠️ Não foi possível listar arquivos"

echo ""
echo "🎯 Script concluído!"
echo "Use 'docker compose logs -f app' para acompanhar os logs em tempo real"