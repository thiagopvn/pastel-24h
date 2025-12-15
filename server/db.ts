import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";
import path from 'path';
import fs from 'fs';

// Define o caminho do banco de dados.
// Prioridade: DB_PATH > DATABASE_PATH > caminho padrão
// Isso permite flexibilidade para diferentes ambientes de deploy
const defaultDbPath = path.join(process.cwd(), 'data', 'local.db');
const dbPath = process.env.DB_PATH || process.env.DATABASE_PATH || defaultDbPath;

// Garante que a pasta do banco de dados existe
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
  console.log(`[db] Pasta do banco de dados criada: ${dbDir}`);
}

console.log(`[db] Usando banco de dados: ${dbPath}`);

const sqlite = new Database(dbPath, {
  // verbose: console.log // Descomente para debug
});

export const db = drizzle(sqlite, { schema });