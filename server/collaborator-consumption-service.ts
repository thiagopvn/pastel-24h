import { db } from "./db";
import { 
  products, 
  shiftRecords
} from "@shared/schema";
import { eq, and, ilike } from "drizzle-orm";

// Temporary interface for legacy service compatibility
interface InsertCollaboratorConsumption {
  shiftId: number;
  collaboratorId: number;
  hoursWorked: number;
  beveragesValue: number;
  pastriesValue: number;
  waterQuantity: number;
  consumedProducts: any[];
}

interface CollaboratorConsumption {
  id: number;
  shiftId: number;
  collaboratorId: number;
  hoursWorked: number;
  beveragesValue: number;
  pastriesValue: number;
  waterQuantity: number;
  consumedProducts: any;
}

interface ConsumedProduct {
  productId: number;
  name: string;
  quantity: number;
  price: string;
}

export class CollaboratorConsumptionService {
  async createConsumption(data: InsertCollaboratorConsumption) {
    console.log("[CollaboratorConsumption] Legacy service - createConsumption called but disabled");
    // Legacy method - return mock data for compatibility
    return {
      id: Date.now(),
      ...data,
      createdAt: new Date(),
      updatedAt: new Date()
    };
  }

  async updateConsumption(
    consumptionId: number, 
    shiftId: number, 
    updates: Partial<InsertCollaboratorConsumption>
  ) {
    console.log("[CollaboratorConsumption] Legacy service - updateConsumption called but disabled");
    return {
      id: consumptionId,
      shiftId,
      ...updates,
      updatedAt: new Date()
    };
  }

  async deleteConsumption(consumptionId: number, shiftId: number) {
    console.log("[CollaboratorConsumption] Legacy service - deleteConsumption called but disabled");
    return { success: true };
  }

  async getConsumptionsForWeeklyReport(startDate: Date, endDate: Date) {
    console.log("[CollaboratorConsumption] Legacy service - getConsumptionsForWeeklyReport called but disabled");
    // Return empty array for legacy compatibility
    return [];
  }

  calculateCollaboratorWeeklyCost(consumptions: any[]): number {
    console.log("[CollaboratorConsumption] Legacy service - calculateCollaboratorWeeklyCost called but disabled");
    // Return 0 for legacy compatibility
    return 0;
  }
}

export const collaboratorConsumptionService = new CollaboratorConsumptionService();