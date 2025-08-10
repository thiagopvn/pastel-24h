import { db } from "../server/db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";

async function createAdmin() {
  try {
    // Hash da senha
    const hashedPassword = await bcrypt.hash("admin123", 12);
    
    // Criar usuário admin
    const result = await db.insert(users).values({
      name: "Admin Teste",
      email: "admin@teste.com",
      password: hashedPassword,
      role: "admin",
      transportMode: "none",
      transportValue: 0,
      isActive: true,
    }).returning();
    
    console.log("✅ Admin criado com sucesso!");
    console.log("📧 Email: admin@teste.com");
    console.log("🔑 Senha: admin123");
    console.log("👤 Nome:", result[0].name);
    
    process.exit(0);
  } catch (error: any) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      console.log("⚠️ Usuário admin@teste.com já existe!");
      
      // Buscar o usuário existente
      const existingUser = await db.select().from(users).where(eq(users.email, "admin@teste.com"));
      if (existingUser.length > 0) {
        console.log("📧 Email: admin@teste.com");
        console.log("🔑 Senha: admin123 (se não foi alterada)");
        console.log("👤 Nome:", existingUser[0].name);
      }
    } else {
      console.error("❌ Erro ao criar admin:", error);
    }
    process.exit(1);
  }
}

// Importar eq após as outras importações
import { eq } from "drizzle-orm";

createAdmin();