import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import { registerRoutes } from "./routes";
import { log } from "./utils";
import { db } from "./db";
import { users } from "@shared/schema";
 
async function main() {
  const app = express();
  const server = http.createServer(app);
 
  // Middlewares básicos
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
 
  // Middleware de log customizado
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const duration = Date.now() - start;
      if (req.path.startsWith("/api")) {
        log(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
      }
    });
    next();
  });
 
  // Verifica a conexão com o banco de dados
  try {
    // Check if migrations have been run by trying to query the users table.
    await db.select({ id: users.id }).from(users).limit(1);
  } catch (e: any) {
    if (e.code === 'SQLITE_ERROR' && e.message.includes('no such table')) {
      log("ERROR: Database tables not found. The 'users' table is missing.");
      log("It seems the database migrations have not been run.");
      log("Please run the following command to set up the database:");
      // Using ANSI escape codes for color to make the command stand out.
      log("\x1b[36mnpm run db:migrate\x1b[0m");
      process.exit(1);
    }
    throw e;
  }

  // Registra todas as rotas da API
  await registerRoutes(app);

  // Em produção, serve os arquivos estáticos do React que foram buildados
  if (process.env.NODE_ENV === "production") {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    // Caminho correto para a pasta 'public' dentro de 'dist'
    const publicPath = path.resolve(__dirname, "public");

    app.use(express.static(publicPath));

    // Fallback para SPA: qualquer rota não capturada pela API ou por um arquivo estático,
    // serve o index.html do React para que o roteamento do lado do cliente funcione.
    app.get("*", (req, res) => {
      res.sendFile(path.resolve(publicPath, "index.html"));
    });
  }

  // Em desenvolvimento, usa o Vite como middleware para servir o frontend com hot-reload
  if (process.env.NODE_ENV === "development") {
    const { setupVite } = await import("./vite.js");
    await setupVite(app, server);
  }

  // Middleware de tratamento de erros (deve ser o último)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    log(`ERROR: ${status} - ${message}`);
    res.status(status).json({ message });
  });

  // Usa a porta do ambiente ou 5000 como padrão
  const port = process.env.PORT || 5000;
  server.listen(port, () => {
    log(`Servidor rodando na porta ${port}`);
  });
}

main().catch((err) => {
  log(`ERRO FATAL AO INICIAR: ${err.message}`);
  process.exit(1);
});
