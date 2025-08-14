# Estágio 2: Build da aplicação
FROM node:20-slim AS builder
WORKDIR /app

# Copia todo o código-fonte e os arquivos de pacotes
COPY . .
# Instala TODAS as dependências (incluindo as de desenvolvimento) para os scripts de build e migração
RUN npm ci
# Aumenta o limite de memória do Node.js para 4GB durante o build e roda o script
RUN NODE_OPTIONS=--max-old-space-size=4096 npm run build
# RODA A MIGRAÇÃO AQUI para criar o banco de dados dentro do próprio build
RUN npm run db:migrate
# Remove as dependências de desenvolvimento para a próxima etapa
RUN npm prune --omit=dev

# Estágio 3: Imagem final de produção
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

# Copia as dependências de produção já filtradas do estágio 'builder'
COPY --from=builder /app/node_modules ./node_modules
# Copia a aplicação buildada do estágio 'builder'
COPY --from=builder /app/dist ./dist
# Copia o diretório 'data' com o banco de dados SQLite já migrado do estágio de build
COPY --from=builder /app/data ./data
# Copia o package.json para que o script 'npm run start' funcione
COPY package.json .
# Copia as migrações para poder executá-las no runtime se necessário
COPY migrations ./migrations
# Copia o arquivo de configuração do drizzle
COPY drizzle.config.ts .
# Copia o entrypoint script
COPY docker-entrypoint.sh .

# Expõe a porta em que a aplicação roda
EXPOSE 5000

# Define o entrypoint
ENTRYPOINT ["./docker-entrypoint.sh"]