import { db } from "./server/db";
import { users } from "@shared/schema";
import bcrypt from "bcrypt";
import { eq } from "drizzle-orm";

async function resetAdmin() {
  try {
    // Hash da nova senha
    const hashedPassword = await bcrypt.hash("admin123", 12);
    
    // Verificar se o admin existe
    const existingAdmin = await db.select().from(users)
      .where(eq(users.email, "admin@teste.com"))
      .limit(1);
    
    if (existingAdmin.length > 0) {
      // Atualizar a senha do admin existente
      await db.update(users)
        .set({ 
          password: hashedPassword,
          role: "admin"  // Garantir que é admin
        })
        .where(eq(users.email, "admin@teste.com"));
      
      console.log("✅ Senha do admin resetada com sucesso!");
    } else {
      // Criar novo admin
      await db.insert(users).values({
        name: "Admin",
        email: "admin@teste.com",
        password: hashedPassword,
        role: "admin",
        transportMode: "none",
        transportValue: 0,
        isActive: true,
      });
      
      console.log("✅ Admin criado com sucesso!");
    }
    
    console.log("📧 Email: admin@teste.com");
    console.log("🔑 Senha: admin123");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro:", error);
    process.exit(1);
  }
}

resetAdmin();