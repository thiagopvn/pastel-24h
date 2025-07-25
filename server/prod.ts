import type { Express } from "express";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function serveStatic(app: Express) {
  const publicPath = path.resolve(__dirname, "..", "public");
  app.use(express.static(publicPath));

  // Para qualquer outra rota, sirva o index.html (SPA behavior)
  app.get("*", (req, res) => {
    res.sendFile(path.resolve(publicPath, "index.html"));
  });
}