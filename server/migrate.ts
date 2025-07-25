import "dotenv/config";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { drizzle } from "drizzle-orm/better-sqlite3";
import Database from "better-sqlite3";

const dbPath = process.env.DATABASE_PATH || './data/local.db';
const sqlite = new Database(dbPath);
const db = drizzle(sqlite);

console.log("Running migrations...");

migrate(db, { migrationsFolder: "./migrations" });

console.log("Migrations applied successfully!");

sqlite.close();
process.exit(0);