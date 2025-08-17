import { db } from "./db";
import { 
  collaboratorConsumptions, 
  products, 
  shiftRecords,
  type CollaboratorConsumption
} from "@shared/schema";
import { eq, and } from "drizzle-orm";

export class CollaboratorConsumptionsService {
  // POST - Adicionar um item ao consumo
  async addConsumptionItem(
    shiftId: number,
    collaboratorUserId: number,
    productId: number,
    quantity: number
  ) {
    console.log("[CollaboratorConsumptions] Adding consumption item:", {
      shiftId,
      collaboratorUserId,
      productId,
      quantity
    });

    return db.transaction((tx) => {
      // Buscar o preço atual do produto (síncono)
      const product = tx.select()
        .from(products)
        .where(eq(products.id, productId))
        .get();

      if (!product) {
        throw new Error("Product not found");
      }

      // Criar registro de consumo
      const consumption = tx.insert(collaboratorConsumptions)
        .values({
          shiftId,
          collaboratorUserId,
          productId,
          quantity,
          priceSnapshot: product.price,
          createdAt: new Date()
        })
        .returning()
        .get();

      console.log("[CollaboratorConsumptions] Created consumption record:", consumption.id);

      // NOTA: Não atualizamos mais shift_records aqui para evitar dupla contagem
      // O consumo do colaborador é registrado separadamente na tabela collaborator_consumptions
      // e será considerado no cálculo do relatório semanal

      console.log("[CollaboratorConsumptions] Transaction completed successfully");
      return consumption;
    });
  }

  // GET - Buscar todos os itens consumidos por um colaborador
  async getCollaboratorConsumptions(shiftId: number, userId: number) {
    console.log("[CollaboratorConsumptions] Getting consumptions for:", {
      shiftId,
      userId
    });

    const consumptions = await db.query.collaboratorConsumptions.findMany({
      where: and(
        eq(collaboratorConsumptions.shiftId, shiftId),
        eq(collaboratorConsumptions.collaboratorUserId, userId)
      ),
      with: {
        product: true
      }
    });

    return consumptions;
  }

  // DELETE - Remover um item de consumo
  async removeConsumptionItem(consumptionId: number, shiftId: number) {
    console.log("[CollaboratorConsumptions] Removing consumption item:", {
      consumptionId,
      shiftId
    });

    return db.transaction((tx) => {
      // Buscar o registro de consumo
      const consumption = tx.select()
        .from(collaboratorConsumptions)
        .where(and(
          eq(collaboratorConsumptions.id, consumptionId),
          eq(collaboratorConsumptions.shiftId, shiftId)
        ))
        .get();

      if (!consumption) {
        throw new Error("Consumption record not found");
      }

      // NOTA: Não revertemos mais o consumedQty no shift_records
      // pois não estamos mais incrementando quando adicionamos

      // Deletar o registro de consumo
      tx.delete(collaboratorConsumptions)
        .where(eq(collaboratorConsumptions.id, consumptionId))
        .run();

      console.log("[CollaboratorConsumptions] Successfully removed consumption item");
      return { success: true };
    });
  }

  // Calcular totais para relatório semanal
  async getConsumptionTotalsForCollaborator(
    shiftId: number,
    userId: number
  ): Promise<{ beveragesTotal: number; pastriesTotal: number; waterQuantity: number }> {
    const consumptions = await this.getCollaboratorConsumptions(shiftId, userId);
    
    let beveragesTotal = 0;
    let pastriesTotal = 0;
    let waterQuantity = 0;

    for (const consumption of consumptions) {
      const price = parseFloat(consumption.priceSnapshot);
      const qty = consumption.quantity;
      const total = price * qty;

      if (consumption.product) {
        const productName = consumption.product.name.toLowerCase();
        
        if (productName.includes('água')) {
          waterQuantity += qty;
        } else if (consumption.product.category === 'Bebidas') {
          beveragesTotal += total;
        } else if (consumption.product.category === 'Pastéis') {
          pastriesTotal += total;
        }
      }
    }

    return { beveragesTotal, pastriesTotal, waterQuantity };
  }

  // Buscar consumo total para relatório semanal
  async getConsumptionsForWeeklyReport(startDate: Date, endDate: Date) {
    const consumptions = await db.query.collaboratorConsumptions.findMany({
      with: {
        shift: true,
        collaborator: true,
        product: true
      }
    });

    // Filtrar por período
    return consumptions.filter((c) => {
      if (!c.shift || !c.shift.startTime) return false;
      const shiftDate = new Date(c.shift.startTime);
      return shiftDate >= startDate && shiftDate <= endDate;
    });
  }

  // Calcular custo semanal do colaborador
  calculateCollaboratorWeeklyCost(
    consumptions: any[],
    discountPercentage: number = 50
  ): number {
    let total = 0;

    for (const consumption of consumptions) {
      if (consumption.product) {
        const productName = consumption.product.name.toLowerCase();
        
        // Excluir água do cálculo de desconto
        if (!productName.includes('água')) {
          const price = parseFloat(consumption.priceSnapshot);
          total += price * consumption.quantity;
        }
      }
    }

    // Aplicar desconto (desconto do valor total, não valor a pagar)
    const discountAmount = total * (discountPercentage / 100);
    return total - discountAmount;
  }
}

export const collaboratorConsumptionsService = new CollaboratorConsumptionsService();