#!/bin/bash

echo "🔧 Criando tabela collaborator_consumption"
echo "=========================================="

# Definir o caminho do banco de dados
DB_PATH="/home/projetos/pastel-24h/data/local.db"

# Verificar se o banco existe
if [ ! -f "$DB_PATH" ]; then
    echo "❌ Banco de dados não encontrado em: $DB_PATH"
    exit 1
fi

echo "📂 Banco de dados encontrado: $DB_PATH"

# Verificar se a tabela já existe
echo "🔍 Verificando se a tabela já existe..."
TABLE_EXISTS=$(sqlite3 "$DB_PATH" "SELECT name FROM sqlite_master WHERE type='table' AND name='collaborator_consumption';" 2>/dev/null)

if [ -n "$TABLE_EXISTS" ]; then
    echo "⚠️  Tabela collaborator_consumption já existe!"
    echo "📊 Estrutura atual:"
    sqlite3 "$DB_PATH" ".schema collaborator_consumption"
else
    echo "📝 Criando tabela collaborator_consumption..."
    
    # Criar a tabela
    sqlite3 "$DB_PATH" <<'EOF'
CREATE TABLE `collaborator_consumption` (
    `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
    `shift_id` integer NOT NULL,
    `collaborator_id` integer NOT NULL,
    `hours_worked` real DEFAULT 0 NOT NULL,
    `beverages_value` real DEFAULT 0 NOT NULL,
    `pastries_value` real DEFAULT 0 NOT NULL,
    `water_quantity` integer DEFAULT 0 NOT NULL,
    `consumed_products` text DEFAULT '[]',
    `created_at` integer,
    `updated_at` integer,
    FOREIGN KEY (`shift_id`) REFERENCES `shifts`(`id`) ON UPDATE no action ON DELETE no action,
    FOREIGN KEY (`collaborator_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
EOF

    if [ $? -eq 0 ]; then
        echo "✅ Tabela collaborator_consumption criada com sucesso!"
    else
        echo "❌ Erro ao criar tabela"
        exit 1
    fi
fi

# Verificar se a migração foi registrada
echo ""
echo "🔍 Verificando registro de migração..."
MIGRATION_EXISTS=$(sqlite3 "$DB_PATH" "SELECT hash FROM __drizzle_migrations WHERE hash='dcd16e2d8fb68b1e1df3bd1dd1e1c7b5fa3ce15c2b6c0bb60cd56e7f1a3f8a8f';" 2>/dev/null)

if [ -z "$MIGRATION_EXISTS" ]; then
    echo "📝 Registrando migração no histórico..."
    sqlite3 "$DB_PATH" <<EOF
INSERT INTO __drizzle_migrations (hash, created_at) 
VALUES ('dcd16e2d8fb68b1e1df3bd1dd1e1c7b5fa3ce15c2b6c0bb60cd56e7f1a3f8a8f', $(date +%s)000);
EOF
    echo "✅ Migração registrada"
else
    echo "✅ Migração já estava registrada"
fi

# Verificar resultado final
echo ""
echo "📊 Verificação final - Todas as tabelas:"
sqlite3 "$DB_PATH" ".tables"

echo ""
echo "🔍 Verificando se collaborator_consumption está na lista:"
sqlite3 "$DB_PATH" ".tables" | grep -q collaborator_consumption && \
    echo "✅ Tabela collaborator_consumption confirmada!" || \
    echo "❌ Tabela collaborator_consumption NÃO encontrada!"

echo ""
echo "📋 Estrutura da tabela collaborator_consumption:"
sqlite3 "$DB_PATH" ".schema collaborator_consumption"

echo ""
echo "🎯 Script concluído!"