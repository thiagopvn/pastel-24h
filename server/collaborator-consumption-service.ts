import { db } from "./db";
import { 
  collaboratorConsumption, 
  products, 
  shiftRecords,
  type InsertCollaboratorConsumption 
} from "@shared/schema";
import { eq, and, ilike } from "drizzle-orm";

interface ConsumedProduct {
  productId: number;
  name: string;
  quantity: number;
  price: string;
}

export class CollaboratorConsumptionService {
  async createConsumption(data: InsertCollaboratorConsumption) {
    console.log("[CollaboratorConsumption] Creating consumption:", {
      collaboratorId: data.collaboratorId,
      waterQuantity: data.waterQuantity,
      consumedProducts: data.consumedProducts
    });

    return db.transaction((tx: any) => {
      // Create the consumption record
      const consumption = tx.insert(collaboratorConsumption)
        .values(data)
        .returning()
        .get();

      console.log("[CollaboratorConsumption] Created consumption record:", consumption.id);

      // Update product stock for water
      if (data.waterQuantity > 0) {
        console.log("[CollaboratorConsumption] Updating water stock by:", data.waterQuantity);
        this.updateWaterStockSync(tx, data.waterQuantity);
      }

      // Update product stock for consumed products
      if (data.consumedProducts && Array.isArray(data.consumedProducts)) {
        console.log("[CollaboratorConsumption] Updating product stock for:", data.consumedProducts);
        this.updateProductStockSync(tx, data.consumedProducts as unknown as ConsumedProduct[]);
      }

      console.log("[CollaboratorConsumption] Transaction completed successfully");
      return consumption;
    });
  }

  async updateConsumption(
    consumptionId: number, 
    shiftId: number, 
    updates: Partial<InsertCollaboratorConsumption>
  ) {
    console.log("[CollaboratorConsumption] Updating consumption:", {
      consumptionId,
      shiftId,
      updates
    });

    // 1. READ OUTSIDE TRANSACTION
    const existing = await db.query.collaboratorConsumption.findFirst({
      where: and(
        eq(collaboratorConsumption.id, consumptionId),
        eq(collaboratorConsumption.shiftId, shiftId)
      )
    });

    if (!existing) {
      throw new Error("Collaborator consumption not found");
    }

    // 2. CALCULATE CHANGES
    let waterDiff = 0;
    if (updates.waterQuantity !== undefined && updates.waterQuantity !== existing.waterQuantity) {
      waterDiff = updates.waterQuantity - existing.waterQuantity;
    }

    let productDiffs = new Map<string, number>();
    if (updates.consumedProducts !== undefined) {
      // Parse existing products from JSON string
      let oldProducts: ConsumedProduct[] = [];
      try {
        if (typeof existing.consumedProducts === 'string') {
          oldProducts = JSON.parse(existing.consumedProducts);
        } else if (Array.isArray(existing.consumedProducts)) {
          oldProducts = existing.consumedProducts;
        }
      } catch (error) {
        console.warn("[CollaboratorConsumption] Error parsing existing products:", error);
        oldProducts = [];
      }
      
      const newProducts = (updates.consumedProducts as unknown as ConsumedProduct[]) || [];
      productDiffs = this.calculateProductDifferences(oldProducts, newProducts);
    }

    // 3. EXECUTE WRITE IN TRANSACTION
    return db.transaction((tx: any) => {
      // Update water stock
      if (waterDiff !== 0) {
        this.updateWaterStockSync(tx, waterDiff);
      }

      // Update product stock
      for (const [productId, diff] of Array.from(productDiffs)) {
        if (diff !== 0) {
          this.updateSingleProductStockSync(tx, parseInt(productId), diff);
        }
      }

      // Update the consumption record
      const updateData: any = {
        updatedAt: new Date()
      };

      if (updates.hoursWorked !== undefined) updateData.hoursWorked = updates.hoursWorked;
      if (updates.beveragesValue !== undefined) updateData.beveragesValue = updates.beveragesValue;
      if (updates.pastriesValue !== undefined) updateData.pastriesValue = updates.pastriesValue;
      if (updates.waterQuantity !== undefined) updateData.waterQuantity = updates.waterQuantity;
      if (updates.consumedProducts !== undefined) {
        updateData.consumedProducts = JSON.stringify(updates.consumedProducts);
      }

      const result = tx.update(collaboratorConsumption)
        .set(updateData)
        .where(eq(collaboratorConsumption.id, consumptionId))
        .returning()
        .get();

      return result;
    });
  }

  async deleteConsumption(consumptionId: number, shiftId: number) {
    console.log("[CollaboratorConsumption] Deleting consumption:", {
      consumptionId,
      shiftId
    });

    // FASE 1: LEITURA FORA DA TRANSAÇÃO
    const existingConsumption = await db.query.collaboratorConsumption.findFirst({
      where: and(
        eq(collaboratorConsumption.id, consumptionId),
        eq(collaboratorConsumption.shiftId, shiftId)
      )
    });

    if (!existingConsumption) {
      throw new Error("Collaborator consumption not found");
    }

    // Parse consumed products for reversion
    let consumedProducts: ConsumedProduct[] = [];
    try {
      if (typeof existingConsumption.consumedProducts === 'string') {
        consumedProducts = JSON.parse(existingConsumption.consumedProducts);
      } else if (Array.isArray(existingConsumption.consumedProducts)) {
        consumedProducts = existingConsumption.consumedProducts;
      }
    } catch (error) {
      console.warn("[CollaboratorConsumption] Error parsing products for deletion:", error);
      consumedProducts = [];
    }

    // FASE 2: ESCRITA DENTRO DE TRANSAÇÃO SÍNCRONA
    return db.transaction((tx: any) => {
      // 1. Reverter o estoque de água
      if (existingConsumption.waterQuantity > 0) {
        const waterProduct = tx.select()
          .from(products)
          .where(ilike(products.name, '%água%'))
          .get();
          
        if (waterProduct) {
          const newStock = (waterProduct.stock || 0) + existingConsumption.waterQuantity;
          tx.update(products)
            .set({ stock: newStock })
            .where(eq(products.id, waterProduct.id))
            .run();
          console.log(`[CollaboratorConsumption] Reverted water stock: +${existingConsumption.waterQuantity}`);
        }
      }

      // 2. Reverter o estoque dos produtos detalhados
      for (const productInfo of consumedProducts) {
        const productToUpdate = tx.select()
          .from(products)
          .where(eq(products.id, productInfo.productId))
          .get();
          
        if (productToUpdate) {
          const newStock = (productToUpdate.stock || 0) + productInfo.quantity;
          tx.update(products)
            .set({ stock: newStock })
            .where(eq(products.id, productInfo.productId))
            .run();
          console.log(`[CollaboratorConsumption] Reverted product ${productInfo.productId} stock: +${productInfo.quantity}`);
        }
      }

      // 3. Deletar o registro de consumo
      console.log("[CollaboratorConsumption] About to delete record with ID:", consumptionId);
      const deleteResult = tx.delete(collaboratorConsumption)
        .where(eq(collaboratorConsumption.id, consumptionId))
        .run();
        
      console.log("[CollaboratorConsumption] Delete result:", deleteResult);
      
      if (deleteResult.changes === 0) {
        throw new Error("Failed to delete consumption record inside transaction");
      }

      console.log("[CollaboratorConsumption] Successfully deleted consumption and reverted stock");
      return { success: true };
    });
  }

  private updateWaterStockSync(tx: any, quantity: number) {
    // Find water product
    const waterProduct = tx.select()
      .from(products)
      .where(ilike(products.name, '%água%'))
      .get();

    if (waterProduct) {
      this.updateSingleProductStockSync(tx, waterProduct.id, quantity);
    }
  }

  private updateProductStockSync(tx: any, consumedProducts: ConsumedProduct[]) {
    for (const product of consumedProducts) {
      if (product.quantity > 0) {
        this.updateSingleProductStockSync(tx, product.productId, product.quantity);
      }
    }
  }

  private updateSingleProductStockSync(tx: any, productId: number, quantity: number) {
    console.log(`[CollaboratorConsumption] Updating stock for product ${productId} by ${quantity}`);
    
    // Update product stock directly (not through shift_records)
    const product = tx.select()
      .from(products)
      .where(eq(products.id, productId))
      .get();

    if (product) {
      const newStock = Math.max(0, product.stock - quantity);
      console.log(`[CollaboratorConsumption] Product ${productId}: ${product.stock} -> ${newStock}`);
      
      tx.update(products)
        .set({ stock: newStock })
        .where(eq(products.id, productId))
        .run();
    } else {
      console.warn(`[CollaboratorConsumption] Product ${productId} not found`);
    }
  }

  // Keep async versions for non-transactional use
  private async updateWaterStock(tx: any, quantity: number) {
    // Find water product
    const waterProduct = await tx.query.products.findFirst({
      where: (products: any, { ilike }: any) => ilike(products.name, '%água%')
    });

    if (waterProduct) {
      await this.updateSingleProductStock(tx, waterProduct.id, quantity);
    }
  }

  private async updateProductStock(tx: any, consumedProducts: ConsumedProduct[]) {
    for (const product of consumedProducts) {
      if (product.quantity > 0) {
        await this.updateSingleProductStock(tx, product.productId, product.quantity);
      }
    }
  }

  private async updateSingleProductStock(tx: any, productId: number, quantity: number) {
    // Update product stock directly (not through shift_records)
    const [product] = await tx.select()
      .from(products)
      .where(eq(products.id, productId));

    if (product) {
      const newStock = Math.max(0, product.stock - quantity);
      await tx.update(products)
        .set({ stock: newStock })
        .where(eq(products.id, productId));
    }
  }

  private calculateProductDifferences(
    oldProducts: ConsumedProduct[], 
    newProducts: ConsumedProduct[]
  ): Map<string, number> {
    const productMap = new Map<string, number>();

    // Subtract old quantities (reverse previous consumption)
    for (const product of oldProducts) {
      const key = product.productId.toString();
      productMap.set(key, (productMap.get(key) || 0) - product.quantity);
    }

    // Add new quantities
    for (const product of newProducts) {
      const key = product.productId.toString();
      productMap.set(key, (productMap.get(key) || 0) + product.quantity);
    }

    return productMap;
  }

  async getConsumptionsForWeeklyReport(startDate: Date, endDate: Date) {
    // Get all collaborator consumptions within the date range
    const consumptions = await db.query.collaboratorConsumption.findMany({
      with: {
        shift: true,
        collaborator: true
      }
    });

    // Filter by date range
    return consumptions.filter((c: any) => {
      // Add null check for shift before accessing startTime
      if (!c.shift || !c.shift.startTime) return false;
      const shiftDate = new Date(c.shift.startTime);
      return shiftDate >= startDate && shiftDate <= endDate;
    });
  }

  calculateCollaboratorWeeklyCost(consumptions: any[]): number {
    let totalBeverages = 0;
    let totalPastries = 0;

    for (const consumption of consumptions) {
      totalBeverages += parseFloat(consumption.beveragesValue || "0");
      totalPastries += parseFloat(consumption.pastriesValue || "0");
    }

    // Apply 50% discount for collaborators
    const totalConsumptionValue = totalBeverages + totalPastries;
    return totalConsumptionValue * 0.5;
  }
}

export const collaboratorConsumptionService = new CollaboratorConsumptionService();