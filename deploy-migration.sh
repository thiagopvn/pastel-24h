#!/bin/bash
set -e

echo "🔄 Iniciando processo de migração do banco de dados..."

# Passo 1: Backup
echo "📦 Criando backup do banco de dados..."
if [ -f data/local.db ]; then
    BACKUP_FILE="data/local.db.backup.$(date +%Y%m%d_%H%M%S)"
    cp data/local.db "$BACKUP_FILE"
    echo "✅ Backup criado: $BACKUP_FILE"
    ls -lah data/local.db*
else
    echo "⚠️  Banco de dados não encontrado, continuando sem backup..."
fi

# Passo 2: Parar e remover containers
echo "🛑 Parando containers..."
docker compose down -v --remove-orphans || docker compose down --volumes --remove-orphans --timeout 30

# Verificar se ainda há containers órfãos
if [ "$(docker ps -aq)" ]; then
    echo "🧹 Limpando containers órfãos..."
    docker stop $(docker ps -aq) 2>/dev/null || true
    docker rm $(docker ps -aq) 2>/dev/null || true
fi

# Passo 3: Rebuild
echo "🔨 Reconstruindo imagens Docker..."
docker compose build --no-cache

# Passo 4: Iniciar containers
echo "🚀 Iniciando containers..."
docker compose up -d

# Passo 5: Aguardar e verificar logs
echo "⏳ Aguardando inicialização (10 segundos)..."
sleep 10

echo "📋 Verificando logs..."
docker compose logs --tail=50 app

# Passo 6: Verificar tabela
echo "🔍 Verificando criação da tabela collaborator_consumption..."
if command -v sqlite3 &> /dev/null; then
    sqlite3 data/local.db ".tables" | grep -q collaborator_consumption && \
        echo "✅ Tabela collaborator_consumption criada com sucesso!" || \
        echo "❌ Tabela collaborator_consumption NÃO encontrada!"
    
    echo "📊 Todas as tabelas no banco:"
    sqlite3 data/local.db ".tables"
else
    echo "⚠️  sqlite3 não instalado, pulando verificação de tabelas"
fi

# Verificação final
echo "🏥 Verificando saúde da aplicação..."
sleep 5
curl -f http://localhost:5000/api/health && echo -e "\n✅ Aplicação respondendo!" || echo -e "\n❌ Aplicação não está respondendo"

echo "✨ Processo concluído! Use 'docker compose logs -f app' para acompanhar os logs."