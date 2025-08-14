#!/bin/bash

echo "🔧 Corrigindo deployment do Docker no VPS"
echo "=========================================="

# Copiar o Dockerfile corrigido para o diretório do projeto
echo "📝 Copiando Dockerfile corrigido..."
cp /root/projetos/pastel24h/Dockerfile-fixed /home/projetos/pastel-24h/Dockerfile

# Navegar para o diretório do projeto
cd /home/projetos/pastel-24h

# Parar e remover containers existentes
echo "🛑 Parando containers existentes..."
docker compose down
docker rm -f pastel24h_app 2>/dev/null || true

# Remover imagem antiga para forçar rebuild
echo "🗑️ Removendo imagem antiga..."
docker rmi pastel-24h-app 2>/dev/null || true

# Rebuild com o Dockerfile corrigido
echo "🔨 Reconstruindo imagem Docker com correções..."
docker compose build --no-cache

# Iniciar os containers
echo "🚀 Iniciando containers..."
docker compose up -d

# Aguardar inicialização
echo "⏳ Aguardando inicialização (20 segundos)..."
sleep 20

# Verificar logs
echo "📋 Verificando logs..."
docker compose logs --tail=30 app

# Verificar saúde da aplicação
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

# Verificar tabela collaborator_consumption
echo ""
echo "🔍 Verificando tabela collaborator_consumption..."
sqlite3 /home/projetos/pastel-24h/data/local.db ".tables" | grep -q collaborator_consumption && \
    echo "✅ Tabela collaborator_consumption encontrada!" || \
    echo "❌ Tabela collaborator_consumption NÃO encontrada!"

echo ""
echo "📊 Todas as tabelas no banco:"
sqlite3 /home/projetos/pastel-24h/data/local.db ".tables"

echo ""
echo "🎯 Script concluído!"
echo "Use 'docker compose logs -f app' para acompanhar os logs em tempo real"