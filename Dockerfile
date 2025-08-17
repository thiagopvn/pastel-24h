# Multi-stage build otimizado
FROM node:20-slim AS builder

# Instalar dependências mínimas para build
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar apenas arquivos de configuração primeiro
COPY package*.json ./
COPY tsconfig.json ./
COPY vite.config.ts ./
COPY drizzle.config.ts ./

# Instalar dependências
RUN npm install

# Copiar resto do código
COPY . .

# Build
RUN NODE_OPTIONS=--max-old-space-size=2048 npm run build

# Executar migrações
RUN mkdir -p data && npm run db:migrate

# Limpar dev dependencies
RUN npm prune --omit=dev

# Stage de produção
FROM node:20-slim AS production

# Instalar apenas o necessário
RUN apt-get update && apt-get install -y \
    sqlite3 \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar arquivos do builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/data ./data
COPY --from=builder /app/package.json ./

# Criar entrypoint simples
RUN echo '#!/bin/sh\nset -e\necho "🚀 Iniciando aplicação..."\nif [ ! -f /app/data/local.db ]; then\n  echo "📦 Criando banco..."\n  mkdir -p /app/data\nfi\necho "🎯 Iniciando servidor..."\nexec node dist/index.js' > /app/start.sh

RUN chmod +x /app/start.sh

ENV NODE_ENV=production
ENV PORT=5000

EXPOSE 5000

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:5000/api/health || exit 1

CMD ["/app/start.sh"]