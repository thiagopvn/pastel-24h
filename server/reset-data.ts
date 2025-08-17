import { db } from "./db";
import { 
  shifts, 
  shiftRecords, 
  shiftPayments, 
  shiftCollaborators,
  shiftSignatures,
  cashAdjustments,
  shiftSnapshots,
  timeline,
  weeklyReports,
  collaboratorConsumptions,
  products
} from "@shared/schema";

async function resetData() {
  console.log("🧹 Iniciando limpeza de dados...");
  
  try {
    // Limpar tabelas relacionadas a turnos
    console.log("Limpando dados de turnos...");
    await db.delete(shiftRecords).run();
    await db.delete(shiftPayments).run();
    await db.delete(shiftCollaborators).run();
    await db.delete(shiftSignatures).run();
    await db.delete(cashAdjustments).run();
    await db.delete(shiftSnapshots).run();
    await db.delete(collaboratorConsumptions).run();
    await db.delete(shifts).run();
    
    // Limpar timeline
    console.log("Limpando timeline...");
    await db.delete(timeline).run();
    
    // Limpar relatórios semanais
    console.log("Limpando relatórios semanais...");
    await db.delete(weeklyReports).run();
    
    // Limpar produtos (opcional - descomente se quiser limpar produtos também)
    console.log("Limpando produtos...");
    await db.delete(products).run();
    
    console.log("✅ Limpeza concluída com sucesso!");
    console.log("📌 Usuários foram mantidos no sistema.");
    console.log("📌 Você pode adicionar novos produtos e começar do zero.");
    
    process.exit(0);
  } catch (error) {
    console.error("❌ Erro ao limpar dados:", error);
    process.exit(1);
  }
}

// Executar reset
resetData();