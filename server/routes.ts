import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { notifyShiftClients } from "./ws";
import { db } from "./db";
import bcrypt from "bcrypt";
import { applyCorrectionsToShiftData } from "./corrections-utils";
import { 
  getProcessedShiftById, 
  getLastClosedShift
} from "./lib/shift-processor-sql";
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
  users,
  transportModes,
  products,
  collaboratorConsumptions,
  insertProductSchema, 
  insertShiftSchema, 
  insertShiftRecordSchema, 
  insertShiftPaymentSchema, 
  insertUserSchema,
  insertTransportModeSchema,
  insertCollaboratorConsumptionSchema
} from "@shared/schema";
import { z } from "zod";
import { eq, and, isNull, isNotNull, desc } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);
  
  // Debug middleware to log all requests
  app.use((req, res, next) => {
    if (req.path.includes('shift-records') && req.method === 'POST') {
      console.log(`=== SHIFT-RECORDS POST REQUEST ===`);
      console.log(`Method: ${req.method}`);
      console.log(`Path: ${req.path}`);
      console.log(`URL: ${req.url}`);
      console.log(`Authenticated:`, req.isAuthenticated ? req.isAuthenticated() : false);
      console.log(`User:`, req.user);
    }
    
    // Debug ALL PUT requests to see what's happening
    if (req.method === 'PUT') {
      console.log(`=== PUT REQUEST DEBUG ===`);
      console.log(`Method: ${req.method}`);
      console.log(`Path: ${req.path}`);
      console.log(`URL: ${req.url}`);
      console.log(`Body:`, req.body);
      console.log(`Content-Type:`, req.headers['content-type']);
      console.log(`Content-Length:`, req.headers['content-length']);
    }
    
    next();
  });


  const requireAuth = (req: any, res: any, next: any) => {
    console.log(`requireAuth - path: ${req.path}, isAuthenticated: ${req.isAuthenticated ? req.isAuthenticated() : false}, user: ${req.user ? req.user.role : 'none'}`);
    if (!req.isAuthenticated()) {
      console.log("requireAuth - returning 401: not authenticated");
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    console.log("requireAdmin - path:", req.path);
    console.log("requireAdmin - isAuthenticated:", req.isAuthenticated ? req.isAuthenticated() : false);
    console.log("requireAdmin - user:", req.user);
    
    if (!req.isAuthenticated()) {
      console.log("requireAdmin - returning 401: not authenticated");
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!req.user) {
      console.log("requireAdmin - returning 401: no user");
      return res.status(401).json({ message: "User not found in request" });
    }
    
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: "Admin access required" });
    }
    
    next();
  };

  app.get("/api/shifts/current", requireAuth, async (req, res) => {
    try {
      const shift = await storage.getCurrentShift(req.user!.id);
      res.json(shift);
    } catch (error) {
      res.status(500).json({ message: "Failed to get current shift" });
    }
  });

  app.get("/api/shifts/last-closed", requireAuth, async (req, res) => {
    try {
      // Usar a nova função robusta para buscar e processar o último turno
      const processedShift = await getLastClosedShift();
      
      if (!processedShift) {
        // Retornar resposta padrão quando não há turno fechado
        return res.json({
          shift: null,
          user: null,
          inheritedCash: "200.00",
          inheritedCoins: "50.00",
          cashForNextShift: "200.00",
          coinsForNextShift: "50.00",
          totalLeftovers: 0,
          products: [],
          pendingWithdrawals: "0.00",
          pendingWithdrawalsCount: 0,
          message: "Nenhum turno fechado encontrado."
        });
      }
      
      // Preparar produtos com sobras
      const productsWithLeftovers = processedShift.records
        ?.filter((r: any) => (parseInt(r.leftoverQty) || 0) > 0)
        ?.map((r: any) => ({
          name: r.product?.name || 'Produto Desconhecido',
          leftover: parseInt(r.leftoverQty) || 0
        })) || [];
      
      // Calcular sangrias pendentes
      const pendingWithdrawals = processedShift.cashAdjustments
        ?.filter((a: any) => (a.type === 'withdraw' || a.type === 'sangria'))
        ?.reduce((sum: number, a: any) => sum + (parseFloat(a.amount) || 0), 0) || 0;
      
      const pendingWithdrawalsCount = processedShift.cashAdjustments
        ?.filter((a: any) => (a.type === 'withdraw' || a.type === 'sangria'))?.length || 0;
      
      // Retornar resposta completa com turno processado
      return res.json({
        shift: processedShift,
        user: processedShift.user || null,
        inheritedCash: processedShift.cashForNextShift || processedShift.finalCash || "200.00",
        inheritedCoins: processedShift.coinsForNextShift || processedShift.finalCoins || "50.00",
        cashForNextShift: processedShift.cashForNextShift || processedShift.finalCash || "200.00",
        coinsForNextShift: processedShift.coinsForNextShift || processedShift.finalCoins || "50.00",
        totalLeftovers: processedShift.totalLeftovers || 0,
        products: productsWithLeftovers,
        pendingWithdrawals: pendingWithdrawals.toFixed(2),
        pendingWithdrawalsCount: pendingWithdrawalsCount
      });
      
    } catch (error) {
      console.error("Error getting last closed shift:", error);
      
      // Em caso de erro, retornar resposta vazia ao invés de erro 500
      return res.json({
        shift: null,
        user: null,
        inheritedCash: "200.00",
        inheritedCoins: "50.00",
        cashForNextShift: "200.00",
        coinsForNextShift: "50.00",
        totalLeftovers: 0,
        products: [],
        pendingWithdrawals: "0.00",
        pendingWithdrawalsCount: 0,
        message: "Erro ao processar turno fechado."
      });
    }
  });

  app.post("/api/shifts/open", requireAuth, async (req, res) => {
    try {
      const shiftData = insertShiftSchema.parse(req.body);

      const allShifts = await storage.getShiftsByDateRange(
        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        new Date()
      );
      const hasOpenShift = allShifts.some(s => s.endTime === null || s.status === 'open');

      if (hasOpenShift) {
        return res.status(400).json({ 
          message: "Não é possível abrir um novo turno. Existe um turno aberto que precisa ser fechado primeiro." 
        });
      }

      const lastClosedShift = allShifts
        .filter(s => s.endTime !== null && s.status === 'closed')
        .sort((a, b) => new Date(b.endTime!).getTime() - new Date(a.endTime!).getTime())[0];

      // Calcular valores esperados do último turno fechado
      let expectedCash = "200.00";
      let expectedCoins = "50.00";
      
      if (lastClosedShift) {
        expectedCash = lastClosedShift.cashForNextShift || lastClosedShift.finalCash || "200.00";
        expectedCoins = lastClosedShift.coinsForNextShift || lastClosedShift.finalCoins || "50.00";
      }

      // Calcular discrepância
      const informedTotal = parseFloat(shiftData.initialCash) + parseFloat(shiftData.initialCoins || "0");
      const expectedTotal = parseFloat(expectedCash) + parseFloat(expectedCoins);
      const openingDiscrepancy = informedTotal - expectedTotal;

      // Criar turno com valores informados pelo usuário
      const shift = await storage.createShift({
        ...shiftData,
        userId: req.user!.id,
        openingDiscrepancy: openingDiscrepancy !== 0 ? openingDiscrepancy.toFixed(2) : null,
      });

      // Se houver discrepância, criar evento na timeline
      if (openingDiscrepancy !== 0) {
        await storage.addTimelineEntry({
          userId: req.user!.id,
          action: "opening_discrepancy",
          description: `Discrepância na abertura do turno: ${openingDiscrepancy > 0 ? '+' : ''}R$ ${openingDiscrepancy.toFixed(2)}`,
          metadata: {
            shiftId: shift.id,
            expected: { cash: expectedCash, coins: expectedCoins, total: expectedTotal.toFixed(2) },
            informed: { cash: shiftData.initialCash, coins: shiftData.initialCoins || "0", total: informedTotal.toFixed(2) },
            discrepancy: openingDiscrepancy.toFixed(2)
          }
        });
      }

      const inheritanceInfo = {
        inheritedCash: shift.initialCash,
        inheritedCoins: shift.initialCoins,
        inheritedFromShiftId: shift.inheritedFromShiftId,
        hasInheritance: !!lastClosedShift,
        inheritanceSource: lastClosedShift ? {
          shiftId: lastClosedShift.id,
          closedAt: lastClosedShift.endTime,
          closedBy: lastClosedShift.closedBy
        } : null,
        expectedValues: {
          cash: expectedCash,
          coins: expectedCoins,
          total: expectedTotal.toFixed(2)
        }
      };

      res.status(201).json({
        ...shift,
        inheritance: inheritanceInfo
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to open shift", error: message });
    }
  });

  app.get("/api/cash-adjustments/:shiftId", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const adjustments = await storage.getCashAdjustments(parseInt(shiftId));
      res.json(adjustments);
    } catch (error) {
      res.status(500).json({ message: "Failed to get cash adjustments" });
    }
  });

  app.get("/api/users", requireAuth, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({ ...user, password: undefined })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.get("/api/admin/pending-withdrawals", requireAdmin, async (req, res) => {
    try {
      const pendingWithdrawals = await storage.getPendingWithdrawals();
      const totalAmount = pendingWithdrawals.reduce((sum, withdrawal) => 
        sum + parseFloat(withdrawal.amount), 0);

      res.json({
        withdrawals: pendingWithdrawals,
        totalAmount: totalAmount.toFixed(2),
        count: pendingWithdrawals.length
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get pending withdrawals" });
    }
  });

  app.get("/api/cash-adjustments", requireAdmin, async (req, res) => {
    try {
      const adjustments = await storage.getCashAdjustments();
      res.json(adjustments);
    } catch (error) {
      res.status(500).json({ message: "Failed to get cash adjustments" });
    }
  });

  app.get("/api/shifts/:shiftId/inherited-products", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const shift = await storage.getShift(parseInt(shiftId));

      if (!shift) {
        return res.status(404).json({ message: "Turno não encontrado" });
      }

      const inheritedProducts = [];

      if (shift.inheritedFromShiftId) {
        const snapshot = await storage.getShiftSnapshot(parseInt(shiftId));

        if (snapshot && snapshot.carryProducts) {
          const carryProducts = snapshot.carryProducts as any;

          const productsArray = Array.isArray(carryProducts) ? carryProducts : Object.values(carryProducts);

          for (const product of productsArray) {
            if (product && product.productId && product.qty > 0) {
              inheritedProducts.push({
                productId: product.productId,
                entryQty: product.qty,
                isInherited: true
              });
            }
          }
        }
      }

      console.log("Inherited products response:", { inheritedProducts });
      res.json({ inheritedProducts });
    } catch (error) {
      console.error("Error getting inherited products:", error);
      res.status(500).json({ message: "Failed to get inherited products" });
    }
  });

  app.get("/api/shifts/:shiftId/cash-expected", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const shift = await storage.getShift(parseInt(shiftId));

      if (!shift) {
        return res.status(404).json({ message: "Turno não encontrado" });
      }

      const payments = await storage.getShiftPayment(parseInt(shiftId));
      const cashSales = parseFloat(payments?.cash || "0");

      const initialCash = parseFloat(shift.initialCash || "200.00");
      const expectedCash = initialCash + cashSales;

      res.json({
        initialCash: initialCash.toFixed(2),
        cashSales: cashSales.toFixed(2),
        expectedCash: expectedCash.toFixed(2)
      });
    } catch (error) {
      console.error("Error calculating expected cash:", error);
      res.status(500).json({ message: "Failed to calculate expected cash" });
    }
  });

  app.post("/api/shifts/close", requireAuth, async (req, res) => {
    try {
      const { 
        shiftId, 
        records, 
        payments, 
        notes, 
        gasExchange, 
        countedFinalCash,
        countedFinalCoins,
        envelopeCash,
        envelopeCoins
      } = req.body;

      const shift = await storage.getShift(shiftId);
      if (!shift || shift.status !== 'open') {
        return res.status(400).json({ message: "Turno inválido ou já fechado" });
      }

      if (shift.userId !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ message: "Apenas o usuário que abriu o turno pode fechá-lo" });
      }

      const totalSales = (parseFloat(payments.cash) || 0) + 
                        (parseFloat(payments.pix) || 0) + 
                        (parseFloat(payments.stoneCard) || 0) + 
                        (parseFloat(payments.stoneVoucher) || 0) + 
                        (parseFloat(payments.pagBankCard) || 0);

      const totalRecordsValue = records.reduce((sum: number, record: any) => {
        return sum + parseFloat(record.itemTotal || "0");
      }, 0);

      if (Math.abs(totalSales - totalRecordsValue) > 0.01) {
        return res.status(422).json({ 
          message: "A soma dos pagamentos não corresponde ao total de vendas",
          expected: totalRecordsValue.toFixed(2),
          received: totalSales.toFixed(2)
        });
      }

      const totalCashSales = parseFloat(payments.cash) || 0;
      
      // Get cash adjustments (withdrawals) for this shift
      const cashAdjustments = await storage.getCashAdjustments(shiftId);
      const totalWithdrawals = cashAdjustments.reduce((sum, adjustment) => {
        if (adjustment.type === 'withdraw') {
          return sum + parseFloat(adjustment.amount);
        }
        return sum;
      }, 0);
      
      // Cálculos de divergência baseados nos novos campos
      const expectedCash = parseFloat(shift.initialCash) + totalCashSales - totalWithdrawals;
      const expectedCoins = parseFloat(shift.initialCoins || "0") || 0;
      const actualCash = parseFloat(countedFinalCash) || 0;
      const actualCoins = parseFloat(countedFinalCoins) || 0;

      const totalExpected = expectedCash + expectedCoins;
      const totalActual = actualCash + actualCoins;
      const cashDivergence = totalActual - totalExpected;

      // Cálculo do troco para o próximo turno
      const cashForNext = actualCash - (parseFloat(envelopeCash) || 0);
      const coinsForNext = actualCoins - (parseFloat(envelopeCoins) || 0);

      console.log(`Cash calculation: Initial=${shift.initialCash}, Sales=${totalCashSales}, Withdrawals=${totalWithdrawals}, Expected=${expectedCash}, Actual=${actualCash}, Divergence=${cashDivergence}`);

      if (Math.abs(cashDivergence) > 0.99 && (!notes || notes.trim() === "")) {
        const message = totalWithdrawals > 0 
          ? `Divergência de caixa detectada (após ${totalWithdrawals} em retiradas). Observação obrigatória.`
          : "Divergência de caixa detectada. Observação obrigatória.";
          
        return res.status(422).json({ 
          message,
          divergence: cashDivergence.toFixed(2),
          expected: expectedCash.toFixed(2),
          counted: actualCash.toFixed(2),
          withdrawals: totalWithdrawals.toFixed(2)
        });
      }

      const closedShift = await storage.closeShift(shiftId, req.user!.id, {
        finalCash: actualCash.toFixed(2),
        finalCoins: actualCoins.toFixed(2),
        countedCash: actualCash.toFixed(2),
        countedCoins: actualCoins.toFixed(2),
        countedFinalCash: actualCash.toFixed(2),
        countedFinalCoins: actualCoins.toFixed(2),
        envelopeCash: (parseFloat(envelopeCash) || 0).toFixed(2),
        envelopeCoins: (parseFloat(envelopeCoins) || 0).toFixed(2),
        cashForNextShift: cashForNext.toFixed(2),
        coinsForNextShift: coinsForNext.toFixed(2),
        gasExchange,
        notes,
        cashDivergence: cashDivergence.toString(),
        totalSales: totalSales.toFixed(2),
        status: "closed",
        expectedCash: expectedCash.toFixed(2),
      });

      if (records && Array.isArray(records)) {
        for (const record of records) {
          await storage.upsertShiftRecord({ ...record, shiftId });
        }
      }

      if (payments) {
        await storage.upsertShiftPayment({ ...payments, shiftId });
      }

      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "shift_closed",
        description: `Turno fechado - Total vendas: R$ ${totalSales.toFixed(2)} - Envelope: R$ ${((parseFloat(envelopeCash) || 0) + (parseFloat(envelopeCoins) || 0)).toFixed(2)}`,
        metadata: { 
          shiftId, 
          cashDivergence, 
          countedFinalCash: actualCash.toFixed(2),
          countedFinalCoins: actualCoins.toFixed(2),
          envelopeCash: (parseFloat(envelopeCash) || 0).toFixed(2),
          envelopeCoins: (parseFloat(envelopeCoins) || 0).toFixed(2),
          cashForNextShift: cashForNext.toFixed(2),
          coinsForNextShift: coinsForNext.toFixed(2),
          totalSales: totalSales.toFixed(2),
          cashSales: totalCashSales.toFixed(2)
        },
      });

      if (cashDivergence < 0) {
        await storage.addTimelineEntry({
          userId: req.user!.id,
          action: "cash_divergence",
          description: "Divergência de caixa detectada",
          metadata: { shiftId, divergence: cashDivergence },
        });
      }

      res.json(closedShift);
    } catch (error) {
      console.error("Erro ao fechar turno:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to close shift", error: message });
    }
  });

  app.post("/api/shifts/add-collaborator", requireAuth, async (req, res) => {
    try {
      const { shiftId, userId, hoursWorked } = req.body;

      const success = await storage.addShiftCollaborator(shiftId, userId, hoursWorked);
      if (success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ message: "Failed to add collaborator" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to add collaborator" });
    }
  });

  app.post("/api/shifts/temp-cash", requireAuth, async (req, res) => {
    try {
      const { shiftId, tempFinalCash, tempFinalCoins, gasExchange } = req.body;

      const updatedShift = await storage.updateShift(shiftId, {
        tempFinalCash,
        tempFinalCoins,
        tempGasExchange: gasExchange,
      });

      if (!updatedShift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json({ success: true, message: "Valores temporários salvos" });
    } catch (error) {
      console.error("Erro ao salvar valores temporários:", error);
      res.status(500).json({ message: "Failed to save temporary values" });
    }
  });

  app.get("/api/shift-collaborators", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.query;
      
      let targetShiftId: number;
      if (shiftId) {
        targetShiftId = parseInt(shiftId as string);
      } else {
        const currentShift = await storage.getCurrentShift(req.user!.id);
        if (!currentShift) {
          return res.json([]);
        }
        targetShiftId = currentShift.id;
      }

      const collaborators = await storage.getShiftCollaborators(targetShiftId);
      res.json(collaborators);
    } catch (error) {
      console.error("Error getting shift collaborators:", error);
      res.status(500).json({ message: "Failed to get shift collaborators" });
    }
  });

  // GET collaborators for a specific shift
  app.get("/api/shifts/:shiftId/collaborators", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const collaborators = await db.query.shiftCollaborators.findMany({
        where: eq(shiftCollaborators.shiftId, parseInt(shiftId)),
        with: {
          user: true
        }
      });
      res.json(collaborators);
    } catch (error) {
      console.error("Error getting shift collaborators:", error);
      res.status(500).json({ message: "Failed to get shift collaborators" });
    }
  });

  // POST - Add collaborator to shift
  app.post("/api/shifts/:shiftId/collaborators", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const { userId } = req.body;

      const [collaborator] = await db.insert(shiftCollaborators)
        .values({
          shiftId: parseInt(shiftId),
          userId: userId,
          hoursWorked: "0.00",
          addedAt: new Date()
        })
        .returning();

      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "collaborator_added",
        description: `Colaborador adicionado ao turno ${shiftId}`,
        metadata: null
      });

      res.json(collaborator);
    } catch (error) {
      console.error("Error adding collaborator:", error);
      res.status(500).json({ message: "Failed to add collaborator" });
    }
  });

  // DELETE - Remove collaborator from shift
  app.delete("/api/shifts/:shiftId/collaborators/:collaboratorId", requireAuth, async (req, res) => {
    try {
      const { shiftId, collaboratorId } = req.params;

      await db.delete(shiftCollaborators)
        .where(and(
          eq(shiftCollaborators.id, parseInt(collaboratorId)),
          eq(shiftCollaborators.shiftId, parseInt(shiftId))
        ));

      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "collaborator_removed",
        description: `Colaborador removido do turno ${shiftId}`,
        metadata: null
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing collaborator:", error);
      res.status(500).json({ message: "Failed to remove collaborator" });
    }
  });

  app.put("/api/shifts/:shiftId/collaborators/:collaboratorId", requireAuth, async (req, res) => {
    try {
      const { shiftId, collaboratorId } = req.params;
      const { hoursWorked } = req.body;

      await db.update(shiftCollaborators)
        .set({ 
          hoursWorked: hoursWorked || "0.00"
        })
        .where(and(
          eq(shiftCollaborators.id, parseInt(collaboratorId)),
          eq(shiftCollaborators.shiftId, parseInt(shiftId))
        ));

      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "collaborator_hours_updated",
        description: `Horas do colaborador atualizadas no turno ${shiftId}`,
        metadata: null
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating collaborator:", error);
      res.status(500).json({ message: "Failed to update collaborator" });
    }
  });


  // ROUTES FOR DETAILED COLLABORATOR CONSUMPTIONS
  
  // POST - Add a consumption item for a collaborator
  app.post("/api/shifts/:shiftId/collaborator-consumptions", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const { collaboratorUserId, productId, quantity } = req.body;

      // Import the new service
      const { collaboratorConsumptionsService } = await import("./collaborator-consumptions-service");

      const consumption = await collaboratorConsumptionsService.addConsumptionItem(
        parseInt(shiftId),
        collaboratorUserId,
        productId,
        quantity
      );

      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "collaborator_consumption_item_added",
        description: `Added consumption item for collaborator ${collaboratorUserId} in shift ${shiftId}`,
        metadata: null
      });

      res.json(consumption);
    } catch (error) {
      console.error("Error adding collaborator consumption item:", error);
      res.status(500).json({ message: "Failed to add consumption item" });
    }
  });

  // GET - Get all consumption items for a collaborator
  app.get("/api/shifts/:shiftId/collaborator-consumptions/:userId", requireAuth, async (req, res) => {
    try {
      const { shiftId, userId } = req.params;
      
      // Disable caching
      res.set({
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });

      const { collaboratorConsumptionsService } = await import("./collaborator-consumptions-service");

      const consumptions = await collaboratorConsumptionsService.getCollaboratorConsumptions(
        parseInt(shiftId),
        parseInt(userId)
      );

      res.json(consumptions);
    } catch (error) {
      console.error("Error getting collaborator consumptions:", error);
      res.status(500).json({ message: "Failed to get consumption items" });
    }
  });

  // DELETE - Remove a consumption item
  app.delete("/api/shifts/:shiftId/collaborator-consumptions/:consumptionId", requireAuth, async (req, res) => {
    try {
      const { shiftId, consumptionId } = req.params;

      const { collaboratorConsumptionsService } = await import("./collaborator-consumptions-service");

      await collaboratorConsumptionsService.removeConsumptionItem(
        parseInt(consumptionId),
        parseInt(shiftId)
      );

      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "collaborator_consumption_item_removed",
        description: `Removed consumption item ${consumptionId} from shift ${shiftId}`,
        metadata: null
      });

      res.json({ success: true });
    } catch (error) {
      console.error("Error removing collaborator consumption item:", error);
      res.status(500).json({ message: "Failed to remove consumption item" });
    }
  });

  app.get("/api/products", requireAuth, async (req, res) => {
    try {
      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      res.status(500).json({ message: "Failed to get products" });
    }
  });

  // Temporary diagnostic endpoint - REMOVE IN PRODUCTION
  app.get("/api/debug/check-users", async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const userInfo = allUsers.map(user => ({
        email: user.email,
        role: user.role,
        passwordFormat: {
          length: user.password.length,
          isBcrypt: user.password.startsWith('$2b$'),
          isScrypt: user.password.startsWith('$scrypt$'),
          first10: user.password.substring(0, 10),
          mightBePlainText: !user.password.startsWith('$') && user.password.length < 30
        }
      }));
      res.json({ users: userInfo, count: userInfo.length });
    } catch (error) {
      console.error('Error checking users:', error);
      res.status(500).json({ message: 'Failed to check users' });
    }
  });

  // Temporary session diagnostic endpoint - REMOVE IN PRODUCTION
  app.get("/api/debug/session", (req, res) => {
    res.json({
      isAuthenticated: req.isAuthenticated(),
      user: req.user ? {
        id: req.user.id,
        email: req.user.email,
        role: req.user.role
      } : null,
      sessionId: req.sessionID,
      session: req.session ? {
        cookie: req.session.cookie,
        passport: (req.session as any).passport
      } : null
    });
  });

  app.get("/api/shift-records", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.query;

      if (shiftId) {
        const records = await storage.getShiftRecords(parseInt(shiftId as string));
        res.json(records);
      } else {
        const currentShift = await storage.getCurrentShift(req.user!.id);
        if (currentShift) {
          const records = await storage.getShiftRecords(currentShift.id);
          res.json(records);
        } else {
          res.json([]);
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get shift records" });
    }
  });

  app.post("/api/shift-records", requireAuth, async (req, res) => {
    console.log("=== SHIFT RECORDS POST REQUEST ===");
    console.log("User:", req.user);
    console.log("Body:", req.body);
    try {
      const recordData = insertShiftRecordSchema.parse(req.body);
      const { shiftId } = req.body;

      // Only apply inheritance validation for non-admin users
      console.log(`Shift records edit attempt - User role: ${req.user!.role}, shiftId: ${shiftId}, entryQty: ${recordData.entryQty}, productId: ${recordData.productId}`);
      if (shiftId && recordData.entryQty !== undefined && req.user!.role !== 'admin') {
        const shift = await storage.getShift(shiftId);
        if (shift?.inheritedFromShiftId) {
          const snapshot = await storage.getShiftSnapshot(shiftId);
          const inheritedProducts = snapshot?.carryProducts;

          const isInherited = Array.isArray(inheritedProducts) && inheritedProducts.some((p: any) => 
            p.productId === recordData.productId && p.qty > 0
          );

          if (isInherited) {
            const existingRecord = await storage.getShiftRecords(shiftId);
            const existing = existingRecord.find(r => r.productId === recordData.productId);

            if (existing && existing.entryQty !== recordData.entryQty) {
              return res.status(403).json({ 
                message: "Valores herdados não podem ser alterados",
                field: "entryQty"
              });
            }
          }
        }
      }

      const record = await storage.upsertShiftRecord({ ...recordData, shiftId });
      
      // Notifica clientes WebSocket sobre a atualização
      notifyShiftClients(shiftId, { 
        type: 'RECORD_UPDATED',
        record 
      });
      
      res.json(record);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to save shift record" });
    }
  });

  app.get("/api/shift-payments", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.query;

      if (shiftId) {
        const payment = await storage.getShiftPayment(parseInt(shiftId as string));
        res.json(payment || { cash: 0, pix: 0, stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 });
      } else {
        const currentShift = await storage.getCurrentShift(req.user!.id);
        if (currentShift) {
          const payment = await storage.getShiftPayment(currentShift.id);
          res.json(payment || { cash: 0, pix: 0, stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 });
        } else {
          res.json({ cash: 0, pix: 0, stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 });
        }
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get shift payments" });
    }
  });

  app.post("/api/shift-payments", requireAuth, async (req, res) => {
    try {
      const { shiftId, ...paymentFields } = req.body;

      if (!shiftId) {
        return res.status(400).json({ message: "shiftId is required" });
      }

      const paymentData = insertShiftPaymentSchema.parse(paymentFields);
      const payment = await storage.upsertShiftPayment({ ...paymentData, shiftId });
      res.json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid data", 
          errors: error.errors
        });
      }
      res.status(500).json({ message: "Failed to save shift payment" });
    }
  });

  app.post("/api/shifts/:shiftId/sign", requireAuth, async (req, res) => {
    try {
      const { shiftId } = req.params;
      const { password } = req.body;

      const user = await storage.getUser(req.user!.id);
      if (!user) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      const collaborators = await storage.getShiftCollaborators(parseInt(shiftId));
      const isCollaborator = collaborators.some(c => c.id === req.user!.id);

      if (!isCollaborator && user.role !== 'admin') {
        return res.status(403).json({ message: "Você não é um colaborador deste turno" });
      }

      const signature = await storage.addShiftSignature(
        parseInt(shiftId), 
        req.user!.id,
        req.ip
      );

      res.json({ success: true, signature });
    } catch (error) {
      res.status(500).json({ message: "Failed to sign shift" });
    }
  });

  app.post("/api/admin/cash-withdraw", requireAdmin, async (req, res) => {
    try {
      const { amount, reason, type = "withdraw" } = req.body;

      if (!amount || !reason) {
        return res.status(400).json({ message: "Valor e motivo são obrigatórios" });
      }

      const currentShift = await storage.getCurrentShift();

      if (!currentShift) {
        return res.status(400).json({ message: "Nenhum turno ativo encontrado" });
      }

      const payments = await storage.getShiftPayment(currentShift.id);
      const cashSales = parseFloat(payments?.cash || "0");
      const beforeAmount = (parseFloat(currentShift.initialCash) + cashSales).toFixed(2);
      const afterAmount = (parseFloat(beforeAmount) - parseFloat(amount)).toFixed(2);

      const adjustment = await storage.createCashAdjustment({
        shiftId: currentShift.id,
        userId: req.user!.id,
        type,
        amount: amount.toString(),
        reason,
        beforeAmount,
        afterAmount,
      });

      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "cash_adjustment",
        description: `${type === 'withdraw' ? 'Retirada' : 'Ajuste'} de caixa: R$ ${amount} (Turno #${currentShift.id})`,
        metadata: { 
          adjustmentId: adjustment.id,
          shiftId: currentShift.id,
          amount,
          reason,
          beforeAmount,
          afterAmount
        },
      });

      res.json({ 
        success: true, 
        adjustment,
        message: `${type === 'withdraw' ? 'Retirada' : 'Ajuste'} registrada com sucesso. Valor será considerado no fechamento do turno.`
      });
    } catch (error) {
      console.error("Erro no ajuste de caixa:", error);
      res.status(500).json({ message: "Failed to process cash adjustment" });
    }
  });

  app.get("/api/admin/active-shifts", requireAdmin, async (req, res) => {
    console.log("Active shifts route called");
    try {
      const activeShifts = await db.query.shifts.findMany({
        where: isNull(shifts.endTime),
        with: {
          user: {
            columns: {
              id: true,
              name: true,
              email: true
            }
          }
        },
        orderBy: [desc(shifts.startTime)]
      });

      res.json(activeShifts);
    } catch (error) {
      console.error("Error fetching active shifts:", error);
      res.status(500).json({ message: "Failed to get active shifts" });
    }
  });

  app.get("/api/admin/summary", requireAdmin, async (req, res) => {
    try {
      const { period = 'today' } = req.query;

      let startDate: Date, endDate: Date;
      const now = new Date();

      switch (period) {
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date();
      }

      const stats = await storage.getSalesStats(startDate, endDate);
      res.json(stats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get summary" });
    }
  });

  app.get("/api/admin/top-products", requireAdmin, async (req, res) => {
    try {
      const { period = 'today' } = req.query;

      let startDate: Date, endDate: Date;
      const now = new Date();

      switch (period) {
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date();
      }

      const topProducts = await storage.getTopProducts(startDate, endDate);
      res.json(topProducts);
    } catch (error) {
      res.status(500).json({ message: "Failed to get top products" });
    }
  });

  app.get("/api/admin/sales-by-hour", requireAdmin, async (req, res) => {
    try {
      const { period = 'today' } = req.query;

      let startDate: Date, endDate: Date;
      const now = new Date();

      switch (period) {
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date();
      }

      const salesByHour = await storage.getSalesByHour(startDate, endDate);
      res.json(salesByHour);
    } catch (error) {
      res.status(500).json({ message: "Failed to get sales by hour" });
    }
  });

  app.get("/api/admin/payment-methods", requireAdmin, async (req, res) => {
    try {
      const { period = 'today' } = req.query;

      let startDate: Date, endDate: Date;
      const now = new Date();

      switch (period) {
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date();
      }

      const paymentStats = await storage.getPaymentMethodStats(startDate, endDate);
      res.json(paymentStats);
    } catch (error) {
      res.status(500).json({ message: "Failed to get payment method stats" });
    }
  });

  app.get("/api/admin/alerts", requireAdmin, async (req, res) => {
    try {
      const { period = 'today' } = req.query;

      let startDate: Date, endDate: Date;
      const now = new Date();

      switch (period) {
        case 'yesterday':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
          endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'week':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          endDate = new Date();
          break;
        case 'month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          endDate = new Date();
          break;
        default:
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          endDate = new Date();
      }

      const divergences = await storage.getCashDivergences(startDate, endDate);
      const openShifts = await storage.getAllOpenShifts();

      res.json({
        cashDivergences: divergences,
        openShifts,
      });
    } catch (error) {
      res.status(500).json({ message: "Failed to get alerts" });
    }
  });

  app.get("/api/admin/timeline", requireAdmin, async (req, res) => {
    try {
      const timeline = await storage.getTimeline();
      res.json(timeline);
    } catch (error) {
      res.status(500).json({ message: "Failed to get timeline" });
    }
  });

  app.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const productData = insertProductSchema.parse(req.body);
      const product = await storage.createProduct(productData);
      res.status(201).json(product);
    } catch (error) {
      console.error('[ERROR] Failed to create product:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      
      // Tratamento específico para erros de banco de dados
      if (error instanceof Error) {
        // Verificar se é erro de coluna faltante
        if (error.message.includes('no such column')) {
          console.error('[CRITICAL] Database schema mismatch - migrations may not have been run');
          return res.status(500).json({ 
            message: "Database schema error. Please ensure migrations have been run.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
        
        // Outros erros de banco de dados
        if (error.message.includes('SQLITE') || error.message.includes('database')) {
          return res.status(500).json({ 
            message: "Database operation failed. Please try again later.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
      
      res.status(500).json({ message: "Failed to create product due to a server error." });
    }
  });

  app.put("/api/admin/products/order", requireAdmin, async (req, res) => {
    try {
      const orderSchema = z.array(z.object({
        id: z.number(),
        sortOrder: z.number()
      }));
      
      const order = orderSchema.parse(req.body);
      const success = await storage.reorderProducts(order);

      if (!success) {
        return res.status(500).json({ message: "Failed to reorder products" });
      }

      const products = await storage.getAllProducts();
      res.json(products);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to reorder products" });
    }
  });

  app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, productData);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      console.error('[ERROR] Failed to update product:', error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      
      if (error instanceof Error) {
        if (error.message.includes('no such column')) {
          console.error('[CRITICAL] Database schema mismatch when updating product');
          return res.status(500).json({ 
            message: "Database schema error. Please ensure migrations have been run.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
        
        if (error.message.includes('SQLITE') || error.message.includes('database')) {
          return res.status(500).json({ 
            message: "Database operation failed.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
      
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid product ID" });
      }
      
      const success = await storage.deleteProduct(id);

      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error('[ERROR] Failed to delete product:', error);
      
      if (error instanceof Error) {
        if (error.message.includes('foreign key') || error.message.includes('FOREIGN KEY')) {
          return res.status(400).json({ 
            message: "Cannot delete product that is in use in shift records" 
          });
        }
        
        if (error.message.includes('no such column')) {
          console.error('[CRITICAL] Database schema mismatch when deleting product');
          return res.status(500).json({ 
            message: "Database schema error. Please ensure migrations have been run.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
        
        if (error.message.includes('SQLITE') || error.message.includes('database')) {
          return res.status(500).json({ 
            message: "Database operation failed.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
      
      res.status(500).json({ message: "Failed to delete product" });
    }
  });

  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(user => ({ ...user, password: undefined })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  app.post("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      // Validate and parse user data
      const userData = insertUserSchema.parse(req.body);
      
      // Additional backend validation
      if (!userData.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(userData.email)) {
        return res.status(400).json({ 
          message: "Email inválido", 
          errors: [{ path: ['email'], message: "Email deve ter um formato válido" }] 
        });
      }

      if (!userData.role || !['admin', 'employee'].includes(userData.role)) {
        return res.status(400).json({ 
          message: "Papel inválido", 
          errors: [{ path: ['role'], message: "Papel deve ser 'admin' ou 'employee'" }] 
        });
      }

      // Hash the password before creating the user
      const hashedPassword = await bcrypt.hash(userData.password, 12);
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword
      });
      res.status(201).json({ ...user, password: undefined });
    } catch (error) {
      console.error("[ERROR] Failed to create user:", error);
      if (error instanceof z.ZodError) {
        const firstError = error.errors[0];
        return res.status(400).json({ 
          message: firstError.message || "Dados inválidos", 
          errors: error.errors 
        });
      }
      
      // Handle duplicate email error
      if (error instanceof Error && error.message && error.message.includes('UNIQUE constraint failed: users.email')) {
        return res.status(400).json({ 
          message: "Email já está em uso", 
          errors: [{ path: ['email'], message: "Este email já está cadastrado no sistema" }] 
        });
      }
      
      // Tratamento para erros de banco de dados
      if (error instanceof Error) {
        if (error.message.includes('no such column')) {
          console.error('[CRITICAL] Database schema mismatch when creating user');
          return res.status(500).json({ 
            message: "Database schema error. Please ensure migrations have been run.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
        
        if (error.message.includes('SQLITE') || error.message.includes('database')) {
          return res.status(500).json({ 
            message: "Database operation failed.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
      
      res.status(500).json({ message: "Falha ao criar usuário" });
    }
  });

  app.put("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const userData = req.body;
      delete userData.password;

      const user = await storage.updateUser(id, userData);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ ...user, password: undefined });
    } catch (error) {
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "ID de usuário inválido" });
      }

      if (id === req.user?.id) {
        return res.status(400).json({ message: "Não é possível excluir sua própria conta" });
      }

      const success = await storage.deleteUser(id);

      if (!success) {
        return res.status(404).json({ message: "Usuário não encontrado" });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting user:", error);
      
      // Return specific error message if it's a constraint violation
      if (error instanceof Error && error.message && error.message.includes("Não é possível excluir")) {
        return res.status(400).json({ message: error.message });
      }
      
      res.status(500).json({ message: "Falha ao excluir usuário" });
    }
  });

  app.get("/api/admin/weekly-report", requireAdmin, async (req, res) => {
    try {
      const { weekStart } = req.query;

      if (weekStart) {
        const report = await storage.getWeeklyReport(new Date(weekStart as string));
        res.json(report);
      } else {
        const reports = await storage.getWeeklyReports();
        res.json(reports);
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to get weekly report" });
    }
  });

  // Função auxiliar para verificar se um produto é água (gratuito)
  const isWaterProduct = (productName: string | null | undefined): boolean => {
    if (!productName) return false;
    const lowerName = productName.toLowerCase();
    // Verificar variações de água com e sem acento
    return lowerName.includes('água') || lowerName.includes('agua') || lowerName === 'água' || lowerName === 'agua';
  };

  app.post("/api/admin/weekly-report/calculate", requireAdmin, async (req, res) => {
    try {
      console.log('[INFO] Starting weekly report calculation');
      const { weekStart, weekEnd, hourlyRate, foodBenefit, consumptionDiscount, transportRates } = req.body;

      const startDate = new Date(weekStart);
      const endDate = new Date(weekEnd);

      const allUsers = await db.select({
        user: users,
        transportMode: transportModes
      })
      .from(users)
      .leftJoin(transportModes, eq(users.transportModeId, transportModes.id))
      .where(eq(users.role, 'employee'));

      const employees = allUsers.map(({ user, transportMode }) => ({
        ...user,
        transportModeName: transportMode?.name || 'bus',
        transportModePrice: transportMode ? parseFloat(transportMode.roundTripPrice) : transportRates.bus
      }));

      const shifts = await storage.getShiftsByDateRange(startDate, endDate);

      const employeeData = [];

      for (const employee of employees) {
        // Turnos onde o funcionário foi o responsável principal
        const employeeShifts = shifts.filter(shift => 
          shift.userId === employee.id && shift.endTime
        );

        // Buscar também turnos onde o funcionário foi colaborador
        const collaboratorShifts = [];
        for (const shift of shifts) {
          if (shift.endTime) {
            const collaborators = await storage.getShiftCollaborators(shift.id);
            const isCollaborator = collaborators.find(c => c.id === employee.id);
            if (isCollaborator) {
              collaboratorShifts.push({ shift, collaboratorData: isCollaborator });
            }
          }
        }

        let totalHours = 0;
        let totalConsumption = 0;
        const consumptionDetails = []; // Array para armazenar detalhes dos itens consumidos

        // Processar turnos onde foi funcionário principal
        for (const shift of employeeShifts) {
          if (shift.startTime && shift.endTime) {
            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            totalHours += duration;
          }

          // NOVA LÓGICA: Particionar o consumo corretamente
          // 1. Buscar o consumo TOTAL registrado no turno
          const correctedShiftData = await applyCorrectionsToShiftData(shift.id);
          const records = correctedShiftData ? correctedShiftData.records : await storage.getShiftRecords(shift.id);
          
          let totalShiftConsumption = 0;
          const shiftConsumptionItems = []; // Para rastrear itens deste turno
          for (const record of records) {
            const consumedQty = record.consumedQty || 0;
            const price = parseFloat(record.priceSnapshot || '0');
            const productName = record.product?.name || 'Produto desconhecido';
            
            if (consumedQty > 0) {
              // Adicionar ao array de detalhes (incluindo água para exibição)
              shiftConsumptionItems.push({
                name: productName,
                quantity: consumedQty,
                unitPrice: price,
                totalPrice: consumedQty * price,
                isWater: isWaterProduct(productName)
              });
              
              // Ignorar produtos de água no cálculo do valor do consumo
              if (!isWaterProduct(productName)) {
                totalShiftConsumption += consumedQty * price;
              }
            }
          }

          // 2. Buscar o consumo TOTAL atribuído a TODOS OS COLABORADORES neste turno
          const { collaboratorConsumptionsService } = await import("./collaborator-consumptions-service");
          const shiftCollaboratorConsumptions = await db.query.collaboratorConsumptions.findMany({
            where: eq(collaboratorConsumptions.shiftId, shift.id),
            with: { product: true }
          });

          let totalCollaboratorsConsumption = 0;
          const collaboratorConsumptionItems = [];
          for (const consumption of shiftCollaboratorConsumptions) {
            const productName = consumption.product?.name || 'Produto desconhecido';
            const price = parseFloat(consumption.priceSnapshot);
            
            collaboratorConsumptionItems.push({
              name: productName,
              quantity: consumption.quantity,
              unitPrice: price,
              totalPrice: consumption.quantity * price,
              isWater: isWaterProduct(productName)
            });
            
            // Ignorar produtos de água no cálculo do valor do consumo
            if (!isWaterProduct(productName)) {
              totalCollaboratorsConsumption += consumption.quantity * price;
            }
          }

          // 3. Calcular o consumo do FUNCIONÁRIO PRINCIPAL (proporcionalmente)
          // Distribuir os itens entre funcionário principal e colaboradores
          for (const item of shiftConsumptionItems) {
            // Verificar quanto deste item foi consumido por colaboradores
            const collaboratorItem = collaboratorConsumptionItems.find(c => c.name === item.name);
            const collaboratorQty = collaboratorItem ? collaboratorItem.quantity : 0;
            
            // Quantidade restante é do funcionário principal
            const mainEmployeeQty = Math.max(0, item.quantity - collaboratorQty);
            
            if (mainEmployeeQty > 0) {
              const mainEmployeeItemTotal = mainEmployeeQty * item.unitPrice;
              consumptionDetails.push({
                name: item.name,
                quantity: mainEmployeeQty,
                unitPrice: item.unitPrice,
                totalPrice: mainEmployeeItemTotal,
                isWater: item.isWater
              });
              
              // Somar ao total apenas se não for água
              if (!item.isWater) {
                totalConsumption += mainEmployeeItemTotal;
              }
            }
          }
        }

        // Processar consumo quando foi colaborador
        const { collaboratorConsumptionsService } = await import("./collaborator-consumptions-service");
        const allCollaboratorConsumptions = await collaboratorConsumptionsService.getConsumptionsForWeeklyReport(startDate, endDate);
        const employeeCollaboratorConsumptions = allCollaboratorConsumptions.filter(
          (c: any) => c.collaboratorUserId === employee.id
        );

        // Adicionar horas trabalhadas como colaborador
        for (const collaboratorShift of collaboratorShifts) {
          const hoursWorked = parseFloat(collaboratorShift.collaboratorData.hoursWorked || "0");
          totalHours += hoursWorked;
        }

        // Calcular consumo quando foi colaborador (valor integral, sem desconto ainda)
        let collaboratorConsumptionValue = 0;
        for (const consumption of employeeCollaboratorConsumptions) {
          const productName = consumption.product?.name || 'Produto desconhecido';
          const price = parseFloat(consumption.priceSnapshot);
          const totalPrice = consumption.quantity * price;
          
          // Adicionar aos detalhes do consumo
          consumptionDetails.push({
            name: productName,
            quantity: consumption.quantity,
            unitPrice: price,
            totalPrice: totalPrice,
            isWater: isWaterProduct(productName)
          });
          
          // Ignorar produtos de água no cálculo do valor do consumo
          if (!isWaterProduct(productName)) {
            collaboratorConsumptionValue += totalPrice;
          }
        }
        
        // Adicionar o consumo do colaborador ao total (ainda sem desconto)
        totalConsumption += collaboratorConsumptionValue;

        // Total de dias trabalhados (como funcionário principal ou colaborador)
        const uniqueDays = new Set();
        
        // Adicionar dias dos turnos como funcionário principal
        for (const shift of employeeShifts) {
          if (shift.startTime) {
            const date = new Date(shift.startTime).toDateString();
            uniqueDays.add(date);
          }
        }
        
        // Adicionar dias dos turnos como colaborador
        for (const consumption of employeeCollaboratorConsumptions) {
          if (consumption.shift?.startTime) {
            const date = new Date(consumption.shift.startTime).toDateString();
            uniqueDays.add(date);
          }
        }
        
        const daysWorked = uniqueDays.size;
        const transportCost = daysWorked * employee.transportModePrice;

        const foodCost = daysWorked * foodBenefit;

        // Correct consumption discount calculation: discount % of consumption FROM consumption
        const consumptionDiscountAmount = totalConsumption * (consumptionDiscount / 100);
        const finalConsumption = totalConsumption - consumptionDiscountAmount;

        const hoursPay = totalHours * hourlyRate;
        const total = hoursPay + transportCost + foodCost - finalConsumption;

        // Consolidar itens iguais nos detalhes do consumo
        const consolidatedDetails: string[] = [];
        const itemMap = new Map<string, any>();
        
        for (const item of consumptionDetails) {
          const key = item.name;
          if (itemMap.has(key)) {
            const existing = itemMap.get(key);
            existing.quantity += item.quantity;
            existing.totalPrice += item.totalPrice;
          } else {
            itemMap.set(key, { ...item });
          }
        }
        
        // Converter para array formatado
        itemMap.forEach((item, name) => {
          const formattedPrice = item.totalPrice.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
          });
          consolidatedDetails.push(`${item.quantity}x ${name} - ${formattedPrice}${item.isWater ? ' (não descontado)' : ''}`);
        });

        employeeData.push({
          userId: employee.id,
          name: employee.name || employee.email,
          hours: Math.round(totalHours * 100) / 100,
          transport: Math.round(transportCost * 100) / 100,
          food: Math.round(foodCost * 100) / 100,
          consumption: Math.round(finalConsumption * 100) / 100, // Show consumption AFTER discount
          consumptionDetails: consolidatedDetails, // Novo campo com detalhes
          bonus: 0,
          deduction: 0,
          total: Math.round(total * 100) / 100,
          daysWorked,
          shiftsCount: employeeShifts.length,
          transportType: employee.transportModeName
        });
      }

      res.json({ employeeData });
    } catch (error) {
      console.error("[ERROR] Failed to calculate weekly data:", error);
      
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Invalid data provided", 
          errors: error.errors 
        });
      }
      
      if (error instanceof Error) {
        // Verificar erros de banco de dados
        if (error.message.includes('no such column')) {
          console.error('[CRITICAL] Database schema mismatch in weekly report calculation');
          return res.status(500).json({ 
            message: "Database schema error. Please ensure migrations have been run.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
        
        if (error.message.includes('SQLITE') || error.message.includes('database')) {
          return res.status(500).json({ 
            message: "Database operation failed during calculation.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
      
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ 
        message: "Failed to calculate weekly data", 
        error: process.env.NODE_ENV === 'development' ? message : undefined 
      });
    }
  });

  app.post("/api/admin/weekly-report", requireAdmin, async (req, res) => {
    try {
      console.log("Dados para criar relatório semanal:", req.body);
      const { weekStart, weekEnd, hourlyRate, foodBenefit, ...rest } = req.body;

      const reportData = {
        weekStart: new Date(weekStart),
        weekEnd: new Date(weekEnd),
        hourlyRate: hourlyRate.toString(),
        foodBenefit: foodBenefit.toString(),
        ...rest,
      };

      const report = await storage.createWeeklyReport(reportData);
      console.log("Relatório criado com sucesso:", report);
      res.status(201).json(report);
    } catch (error) {
      console.error("Erro ao criar relatório semanal:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to create weekly report", error: message });
    }
  });

  app.get("/api/admin/payment-config", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getPaymentConfig();

      if (!config) {
        res.json({
          pixRate: "0.00",
          stoneCardRate: "3.50",
          stoneVoucherRate: "2.50",
          pagBankCardRate: "3.20",
        });
      } else {
        res.json(config);
      }
    } catch (error) {
      console.error("Erro ao buscar configuração de pagamento:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to get payment configuration", error: message });
    }
  });

  app.post("/api/admin/payment-config", requireAdmin, async (req, res) => {
    try {
      const { pix, stoneCard, stoneVoucher, pagBankCard } = req.body;

      console.log("Dados recebidos:", req.body);

      const configData = {
        pixRate: (pix || 0).toString(),
        stoneCardRate: (stoneCard || 0).toString(),
        stoneVoucherRate: (stoneVoucher || 0).toString(),
        pagBankCardRate: (pagBankCard || 0).toString(),
      };

      console.log("Dados para salvar:", configData);

      const config = await storage.savePaymentConfig(configData);
      res.json(config);
    } catch (error) {
      console.error("Erro ao salvar configuração de pagamento:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to save payment configuration", error: message });
    }
  });

  // Get payroll configuration
  app.get("/api/admin/payroll-config", requireAdmin, async (req, res) => {
    try {
      const config = await storage.getPayrollConfig();

      if (!config) {
        res.json({
          hourlyRate: "12.50",
          foodBenefit: "25.00",
          consumptionDiscount: 50,
          transportRates: { bus: 8.80, van: 12.00, app: 15.00 },
        });
      } else {
        res.json(config);
      }
    } catch (error) {
      console.error("Erro ao buscar configuração de folha de pagamento:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to get payroll configuration", error: message });
    }
  });

  // Save payroll configuration
  app.post("/api/admin/payroll-config", requireAdmin, async (req, res) => {
    try {
      const { hourlyRate, foodBenefit, consumptionDiscount, transportRates } = req.body;

      console.log("Dados de configuração de folha recebidos:", req.body);

      const configData = {
        hourlyRate: hourlyRate.toString(),
        foodBenefit: foodBenefit.toString(),
        consumptionDiscount: parseInt(consumptionDiscount) || 50,
        transportRates: transportRates || { bus: 8.80, van: 12.00, app: 15.00 },
      };

      console.log("Dados para salvar:", configData);

      const config = await storage.savePayrollConfig(configData);
      res.json(config);
    } catch (error) {
      console.error("Erro ao salvar configuração de folha de pagamento:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to save payroll configuration", error: message });
    }
  });

  app.get("/api/admin/shift-details/:shiftId", requireAdmin, async (req, res) => {
    try {
      const shiftId = parseInt(req.params.shiftId);
      if (isNaN(shiftId)) {
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      // Usar a função robusta para buscar e processar o turno
      const processedShift = await getProcessedShiftById(shiftId);

      if (!processedShift) {
        return res.status(404).json({ message: "Shift not found" });
      }

      // Retornar o turno processado completo
      res.json({
        shift: processedShift,
        user: processedShift.user,
        records: processedShift.records || [],
        payments: processedShift.payments || {},
        collaborators: processedShift.collaborators || [],
        totalCorrections: processedShift.totalCorrections || 0
      });
    } catch (error) {
      console.error("Erro ao buscar detalhes do turno:", error);
      
      // Retornar erro mais amigável
      res.status(500).json({ 
        message: "Failed to get shift details",
        error: "Internal server error processing shift data"
      });
    }
  });

  // Rotas para correções administrativas
  app.get("/api/admin/shifts/:shiftId/corrections", requireAdmin, async (req, res) => {
    try {
      const shiftId = parseInt(req.params.shiftId);
      if (isNaN(shiftId)) {
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      const corrections = await storage.getShiftCorrections(shiftId);
      res.json(corrections);
    } catch (error) {
      console.error("Erro ao buscar correções:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to get corrections", error: message });
    }
  });

  app.post("/api/admin/shifts/:shiftId/corrections", requireAdmin, async (req, res) => {
    try {
      const shiftId = parseInt(req.params.shiftId);
      if (isNaN(shiftId)) {
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      // Validar que o turno está fechado
      const shift = await storage.getShift(shiftId);
      if (!shift || shift.status !== 'closed') {
        return res.status(400).json({ message: "Correções só podem ser aplicadas em turnos fechados" });
      }

      const correctionData = {
        ...req.body,
        shiftId,
        createdByUserId: req.user!.id
      };

      const correction = await storage.createCorrection(correctionData);
      
      // Adicionar ao Timeline
      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "correction_applied",
        description: `Correção aplicada no turno #${shiftId}: ${correctionData.correctionType}`,
        metadata: { correctionId: correction.id, ...correctionData }
      });
      
      res.json(correction);
    } catch (error) {
      console.error("Erro ao criar correção:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to create correction", error: message });
    }
  });

  app.put("/api/admin/corrections/:correctionId/revoke", requireAdmin, async (req, res) => {
    try {
      const correctionId = parseInt(req.params.correctionId);
      if (isNaN(correctionId)) {
        return res.status(400).json({ message: "Invalid correction ID" });
      }

      const { reason } = req.body;
      if (!reason) {
        return res.status(400).json({ message: "Reason is required" });
      }

      const correction = await storage.revokeCorrection(
        correctionId,
        req.user!.id,
        reason
      );

      if (!correction) {
        return res.status(404).json({ message: "Correction not found" });
      }
      
      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "correction_revoked",
        description: `Correção #${correctionId} revogada`,
        metadata: { correctionId, reason }
      });
      
      res.json(correction);
    } catch (error) {
      console.error("Erro ao revogar correção:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to revoke correction", error: message });
    }
  });


  // Rota para atualizar caixa inicial de um turno ativo
  app.put("/api/admin/shifts/:shiftId/initial-cash", requireAdmin, async (req, res) => {
    try {
      console.log("=== DEBUG INITIAL CASH UPDATE ===");
      console.log("ShiftId:", req.params.shiftId);
      console.log("Request body:", JSON.stringify(req.body, null, 2));
      
      const shiftId = parseInt(req.params.shiftId);
      if (isNaN(shiftId)) {
        console.log("Invalid shiftId:", req.params.shiftId);
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      const { initialCash, initialCoins } = req.body;
      const updates: { initialCash?: string; initialCoins?: string } = {};

      console.log("Initial cash:", initialCash, typeof initialCash);
      console.log("Initial coins:", initialCoins, typeof initialCoins);

      // Valida e adiciona ao objeto de atualização apenas os campos que foram enviados
      if (initialCash !== undefined) {
        const cashValue = parseFloat(String(initialCash).replace(',', '.'));
        console.log("Parsed cash value:", cashValue);
        if (isNaN(cashValue) || cashValue < 0) {
          console.log("Invalid cash value");
          return res.status(400).json({ message: "Valor inválido para Dinheiro Inicial" });
        }
        updates.initialCash = String(cashValue);
      }

      if (initialCoins !== undefined) {
        const coinsValue = parseFloat(String(initialCoins).replace(',', '.'));
        console.log("Parsed coins value:", coinsValue);
        if (isNaN(coinsValue) || coinsValue < 0) {
          console.log("Invalid coins value");
          return res.status(400).json({ message: "Valor inválido para Moedas Iniciais" });
        }
        updates.initialCoins = String(coinsValue);
      }

      console.log("Updates object:", updates);

      if (Object.keys(updates).length === 0) {
        console.log("No updates to apply");
        return res.status(400).json({ message: "Nenhum valor para atualizar foi fornecido." });
      }

      // Buscar o turno atual para verificar se está aberto
      const shift = await storage.getShift(shiftId);
      if (!shift) {
        return res.status(404).json({ message: "Turno não encontrado" });
      }
      
      if (shift.status !== 'open') {
        return res.status(400).json({ message: "Só é possível atualizar o caixa inicial de turnos abertos" });
      }

      // Atualizar o banco de dados com o objeto 'updates'
      await db.update(shifts).set(updates).where(eq(shifts.id, shiftId));

      // Buscar o turno atualizado para notificar
      const updatedShift = await storage.getShift(shiftId);
      
      // Notificar via WebSocket
      notifyShiftClients(shiftId, {
        type: 'SHIFT_DATA_UPDATED',
        payload: {
          type: 'INITIAL_CASH_UPDATED',
          shiftId: shiftId,
          initialCash: updatedShift?.initialCash,
          initialCoins: updatedShift?.initialCoins
        }
      });

      // Adicionar ao Timeline
      const description = [];
      if (updates.initialCash !== undefined) {
        description.push(`Notas: R$ ${parseFloat(updates.initialCash).toFixed(2)}`);
      }
      if (updates.initialCoins !== undefined) {
        description.push(`Moedas: R$ ${parseFloat(updates.initialCoins).toFixed(2)}`);
      }
      
      await storage.addTimelineEntry({
        userId: req.user!.id,
        action: "initial_cash_updated",
        description: `Caixa inicial atualizado no turno #${shiftId}: ${description.join(', ')}`,
        metadata: { shiftId, ...updates }
      });
      
      res.json({ message: "Caixa inicial atualizado com sucesso", ...updates });
    } catch (error) {
      console.error("Erro ao atualizar caixa inicial:", error);
      const message = error instanceof Error ? error.message : "An unknown error occurred";
      res.status(500).json({ message: "Failed to update initial cash", error: message });
    }
  });

  app.get("/api/admin/transport", requireAdmin, async (req, res) => {
    try {
      const modes = await storage.getAllTransportModes();
      res.json(modes);
    } catch (error) {
      res.status(500).json({ message: "Failed to get transport modes" });
    }
  });

  app.post("/api/admin/transport", requireAdmin, async (req, res) => {
    try {
      const { name, roundTripPrice } = req.body;

      if (!name || parseFloat(roundTripPrice) <= 0) {
        return res.status(400).json({ message: "Nome e preço válido são obrigatórios" });
      }

      const mode = await storage.createTransportMode({ name, roundTripPrice });
      res.status(201).json(mode);
    } catch (error: any) {
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: "Nome já existe" });
      }
      res.status(500).json({ message: "Failed to create transport mode" });
    }
  });

  app.put("/api/admin/transport/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { name, roundTripPrice } = req.body;

      const mode = await storage.updateTransportMode(id, { name, roundTripPrice });

      if (!mode) {
        return res.status(404).json({ message: "Transport mode not found" });
      }

      res.json(mode);
    } catch (error) {
      res.status(500).json({ message: "Failed to update transport mode" });
    }
  });

  app.delete("/api/admin/transport/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid transport ID" });
      }
      
      const success = await storage.deleteTransportMode(id);

      if (!success) {
        return res.status(404).json({ message: "Transport mode not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('[ERROR] Failed to delete transport mode:', error);
      
      // Tratamento específico para erro de chave estrangeira
      if (error.message?.includes('foreign key') || error.message?.includes('FOREIGN KEY')) {
        return res.status(400).json({ message: "Transporte em uso por funcionários" });
      }
      
      // Tratamento para erros de banco de dados
      if (error instanceof Error) {
        if (error.message.includes('no such column')) {
          console.error('[CRITICAL] Database schema mismatch when deleting transport');
          return res.status(500).json({ 
            message: "Database schema error. Please ensure migrations have been run.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
        
        if (error.message.includes('SQLITE') || error.message.includes('database')) {
          return res.status(500).json({ 
            message: "Database operation failed.",
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
          });
        }
      }
      
      res.status(500).json({ message: "Failed to delete transport mode" });
    }
  });

  app.get("/api/admin/reset-database", requireAdmin, async (req, res) => {
    try {
      await db.delete(shiftSignatures);
      await db.delete(shiftPayments);
      await db.delete(shiftRecords);
      await db.delete(shiftCollaborators);
      await db.delete(cashAdjustments);
      await db.delete(shiftSnapshots);
      await db.delete(timeline);
      await db.delete(weeklyReports);
      await db.delete(shifts);

      res.json({ 
        message: "Banco de dados limpo. Todos os dados de turnos foram removidos.",
        cleared: ["shifts", "shift_records", "shift_payments", "shift_collaborators", 
                 "shift_signatures", "cash_adjustments", "shift_snapshots", 
                 "timeline", "weekly_reports"]
      });
    } catch (error) {
      console.error("Database reset error:", error);
      res.status(500).json({ message: "Falha ao limpar banco de dados" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}