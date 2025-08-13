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

    return db.transaction((tx: any) => {
      // Get existing consumption
      const existing = tx.select()
        .from(collaboratorConsumption)
        .where(and(
          eq(collaboratorConsumption.id, consumptionId),
          eq(collaboratorConsumption.shiftId, shiftId)
        ))
        .get();

      if (!existing) {
        throw new Error("Collaborator consumption not found");
      }

      // Handle water quantity update
      if (updates.waterQuantity !== undefined && updates.waterQuantity !== existing.waterQuantity) {
        const waterDiff = updates.waterQuantity - existing.waterQuantity;
        if (waterDiff !== 0) {
          this.updateWaterStockSync(tx, waterDiff);
        }
      }

      // Handle consumed products update
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
        
        // Calculate product differences
        const productDiffs = this.calculateProductDifferences(oldProducts, newProducts);
        
        // Update stock for each product difference
        for (const [productId, diff] of Array.from(productDiffs)) {
          if (diff !== 0) {
            this.updateSingleProductStockSync(tx, parseInt(productId), diff);
          }
        }
      }

      // Update the consumption record
      const updateData: any = {
        updatedAt: new Date().getTime()
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
    return db.transaction((tx: any) => {
      // Get existing consumption
      const existing = tx.select()
        .from(collaboratorConsumption)
        .where(and(
          eq(collaboratorConsumption.id, consumptionId),
          eq(collaboratorConsumption.shiftId, shiftId)
        ))
        .get();

      if (!existing) {
        throw new Error("Collaborator consumption not found");
      }

      // Revert water stock
      if (existing.waterQuantity > 0) {
        this.updateWaterStockSync(tx, -existing.waterQuantity);
      }

      // Revert consumed products stock
      let consumedProducts: ConsumedProduct[] = [];
      try {
        if (typeof existing.consumedProducts === 'string') {
          consumedProducts = JSON.parse(existing.consumedProducts);
        } else if (Array.isArray(existing.consumedProducts)) {
          consumedProducts = existing.consumedProducts;
        }
      } catch (error) {
        console.warn("[CollaboratorConsumption] Error parsing products for deletion:", error);
        consumedProducts = [];
      }
      
      if (consumedProducts.length > 0) {
        for (const product of consumedProducts) {
          this.updateSingleProductStockSync(tx, product.productId, -product.quantity);
        }
      }

      // Delete the consumption record
      tx.delete(collaboratorConsumption)
        .where(eq(collaboratorConsumption.id, consumptionId));

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
        .where(eq(products.id, productId));
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
      if (!c.shift.startTime) return false;
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