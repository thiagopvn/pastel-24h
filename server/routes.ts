import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
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
  users,
  transportModes,
  insertProductSchema, 
  insertShiftSchema, 
  insertShiftRecordSchema, 
  insertShiftPaymentSchema, 
  insertUserSchema,
  insertTransportModeSchema
} from "@shared/schema";
import { z } from "zod";
import { eq, and, isNull, isNotNull } from "drizzle-orm";

export function registerRoutes(app: Express): Server {
  setupAuth(app);

  const requireAuth = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  const requireAdmin = (req: any, res: any, next: any) => {
    if (!req.isAuthenticated() || req.user.role !== 'admin') {
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
      const lastShifts = await storage.getShiftsByDateRange(
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        new Date()
      );
      const lastClosedShift = lastShifts.find(s => s.endTime !== null);

      if (lastClosedShift) {
        const records = await storage.getShiftRecords(lastClosedShift.id);
        const totalLeftovers = records.reduce((sum, record) => sum + record.leftoverQty, 0);

        const adjustedCashInfo = await storage.getAdjustedInheritedCash(lastClosedShift);

        res.json({
          shift: lastClosedShift,
          inheritedCash: adjustedCashInfo.inheritedCash,
          inheritedCoins: lastClosedShift.finalCoins || "0",
          totalLeftovers,
          products: records.filter(r => r.leftoverQty > 0),
          pendingWithdrawals: adjustedCashInfo.totalWithdrawals.toFixed(2),
          pendingWithdrawalsCount: adjustedCashInfo.totalWithdrawals > 0 ? 1 : 0
        });
      } else {
        res.json(null);
      }
    } catch (error) {
      console.error("Error getting last closed shift:", error);
      res.status(500).json({ message: "Failed to get last closed shift" });
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

      const { initialCash, initialCoins, ...cleanShiftData } = shiftData;

      const shift = await storage.createShift({
        ...cleanShiftData,
        userId: req.user!.id,
        status: "open",
      });

      const inheritanceInfo = {
        inheritedCash: shift.initialCash,
        inheritedCoins: shift.initialCoins,
        inheritedFromShiftId: shift.inheritedFromShiftId,
        hasInheritance: !!lastClosedShift,
        inheritanceSource: lastClosedShift ? {
          shiftId: lastClosedShift.id,
          closedAt: lastClosedShift.endTime,
          closedBy: lastClosedShift.closedBy
        } : null
      };

      res.status(201).json({
        ...shift,
        inheritance: inheritanceInfo
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to open shift" });
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
      const { shiftId, records, payments, notes, finalCash, finalCoins, gasExchange, countedCash, countedCoins } = req.body;

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
      
      const expectedCash = parseFloat(shift.initialCash) + totalCashSales - totalWithdrawals;
      const expectedCoins = parseFloat(shift.initialCoins) || 0;
      const actualCash = parseFloat(countedCash || finalCash) || 0;
      const actualCoins = parseFloat(countedCoins || finalCoins) || 0;

      const totalExpected = expectedCash + expectedCoins;
      const totalActual = actualCash + actualCoins;
      const cashDivergence = totalActual - totalExpected;

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
        finalCash: countedCash || finalCash,
        finalCoins: countedCoins || finalCoins,
        countedCash: countedCash || finalCash,
        countedCoins: countedCoins || finalCoins,
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
        description: `Turno fechado - Total vendas: R$ ${totalSales.toFixed(2)}`,
        metadata: { 
          shiftId, 
          cashDivergence, 
          finalCash,
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
      res.status(500).json({ message: "Failed to close shift", error: error.message });
    }
  });

  app.post("/api/shifts/add-collaborator", requireAuth, async (req, res) => {
    try {
      const { shiftId, userId } = req.body;

      const success = await storage.addShiftCollaborator(shiftId, userId);
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

  app.delete("/api/shifts/:shiftId/collaborators/:userId", requireAuth, async (req, res) => {
    try {
      const { shiftId, userId } = req.params;

      const success = await storage.removeShiftCollaborator(parseInt(shiftId), parseInt(userId));
      if (success) {
        res.json({ success: true });
      } else {
        res.status(400).json({ message: "Failed to remove collaborator" });
      }
    } catch (error) {
      res.status(500).json({ message: "Failed to remove collaborator" });
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
    try {
      const recordData = insertShiftRecordSchema.parse(req.body);
      const { shiftId } = req.body;

      if (shiftId && recordData.entryQty !== undefined) {
        const shift = await storage.getShift(shiftId);
        if (shift?.inheritedFromShiftId) {
          const snapshot = await storage.getShiftSnapshot(shiftId);
          const inheritedProducts = snapshot?.carryProducts || [];

          const isInherited = inheritedProducts.some((p: any) => 
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
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create product" });
    }
  });

  app.put("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const productData = insertProductSchema.partial().parse(req.body);
      const product = await storage.updateProduct(id, productData);

      if (!product) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json(product);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to update product" });
    }
  });

  app.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const success = await storage.deleteProduct(id);

      if (!success) {
        return res.status(404).json({ message: "Product not found" });
      }

      res.json({ success: true });
    } catch (error) {
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
      const userData = insertUserSchema.parse(req.body);
      const user = await storage.createUser(userData);
      res.status(201).json({ ...user, password: undefined });
    } catch (error) {
      console.error("Error creating user:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to create user" });
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

      if (id === req.user?.id) {
        return res.status(400).json({ message: "Cannot delete your own account" });
      }

      const success = await storage.deleteUser(id);

      if (!success) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete user" });
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

  app.post("/api/admin/weekly-report/calculate", requireAdmin, async (req, res) => {
    try {
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
        const employeeShifts = shifts.filter(shift => 
          shift.userId === employee.id && shift.endTime
        );

        let totalHours = 0;
        let totalConsumption = 0;

        for (const shift of employeeShifts) {
          if (shift.startTime && shift.endTime) {
            const duration = (new Date(shift.endTime).getTime() - new Date(shift.startTime).getTime()) / (1000 * 60 * 60);
            totalHours += duration;
          }

          const records = await storage.getShiftRecords(shift.id);
          for (const record of records) {
            totalConsumption += (record.consumedQty || 0) * parseFloat(record.priceSnapshot || '0');
          }
        }

        const daysWorked = employeeShifts.length;
        const transportCost = daysWorked * employee.transportModePrice;

        const foodCost = daysWorked * foodBenefit;

        // Correct consumption discount calculation: discount % of consumption FROM consumption
        const consumptionDiscountAmount = totalConsumption * (consumptionDiscount / 100);
        const finalConsumption = totalConsumption - consumptionDiscountAmount;

        const hoursPay = totalHours * hourlyRate;
        const total = hoursPay + transportCost + foodCost - finalConsumption;

        employeeData.push({
          userId: employee.id,
          name: employee.name || employee.email,
          hours: Math.round(totalHours * 100) / 100,
          transport: Math.round(transportCost * 100) / 100,
          food: Math.round(foodCost * 100) / 100,
          consumption: Math.round(finalConsumption * 100) / 100, // Show consumption AFTER discount
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
      console.error("Erro ao calcular dados semanais:", error);
      res.status(500).json({ message: "Failed to calculate weekly data", error: error.message });
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
      res.status(500).json({ message: "Failed to create weekly report", error: error.message });
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
      res.status(500).json({ message: "Failed to get payment configuration" });
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
      res.status(500).json({ message: "Failed to save payment configuration", error: error.message });
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
      res.status(500).json({ message: "Failed to get payroll configuration", error: error.message });
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
      res.status(500).json({ message: "Failed to save payroll configuration", error: error.message });
    }
  });

  app.get("/api/admin/shift-details/:shiftId", requireAdmin, async (req, res) => {
    try {
      const shiftId = parseInt(req.params.shiftId);
      if (isNaN(shiftId)) {
        return res.status(400).json({ message: "Invalid shift ID" });
      }

      console.log("Buscando detalhes do turno:", shiftId);
      const shiftDetails = await storage.getShiftDetails(shiftId);
      console.log("Detalhes encontrados:", shiftDetails ? "sim" : "não");

      if (!shiftDetails) {
        return res.status(404).json({ message: "Shift not found" });
      }

      res.json(shiftDetails);
    } catch (error) {
      console.error("Erro ao buscar detalhes do turno:", error);
      res.status(500).json({ message: "Failed to get shift details", error: error.message });
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
      const success = await storage.deleteTransportMode(id);

      if (!success) {
        return res.status(404).json({ message: "Transport mode not found" });
      }

      res.json({ success: true });
    } catch (error: any) {
      if (error.message?.includes('foreign key')) {
        return res.status(400).json({ message: "Transporte em uso por funcionários" });
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