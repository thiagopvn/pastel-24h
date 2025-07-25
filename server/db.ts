import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import * as schema from "@shared/schema";

// Define o caminho do banco de dados. Usa a variável de ambiente se estiver disponível (no Docker),
// ou um caminho local padrão para desenvolvimento.
const dbPath = process.env.DATABASE_PATH || './data/local.db';

const sqlite = new Database(dbPath, {
  // verbose: console.log // Descomente para debug
});

export const db = drizzle(sqlite, { schema });