import { db } from "./db";
import { storage } from "./storage";
import { corrections, shifts, shiftRecords, shiftPayments } from "@shared/schema";
import { eq, and, isNull } from "drizzle-orm";

export interface ShiftWithCorrections {
  shift: any;
  user: any;
  records: any[];
  payments: any;
  correctedRecords?: { [key: string]: any };
  correctedPayments?: { [key: string]: any };
  correctedCashValues?: { [key: string]: any };
}

/**
 * Aplica as correções ativas a um turno e recalcula todos os valores derivados
 */
export async function applyCorrectionsToShiftData(shiftId: number): Promise<ShiftWithCorrections | null> {
  try {
    // 1. Buscar dados originais do turno com todas as relações
    const shiftDetails = await db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
      with: {
        user: true,
        records: {
          with: {
            product: true
          }
        },
        payments: true
      }
    });

    if (!shiftDetails) {
      return null;
    }

    // 2. Buscar todas as correções ativas para este turno
    const activeCorrections = await db.query.corrections.findMany({
      where: and(
        eq(corrections.shiftId, shiftId),
        isNull(corrections.revokedAt)
      ),
      with: {
        createdByUser: true
      }
    });

    // 3. Criar uma cópia profunda dos dados originais
    const correctedShift = JSON.parse(JSON.stringify(shiftDetails));
    const correctedRecords: { [key: string]: any } = {};
    const correctedPayments: { [key: string]: any } = {};
    const correctedCashValues: { [key: string]: any } = {};

    // 4. Aplicar cada correção
    for (const correction of activeCorrections) {
      const correctedValue = correction.correctedValue;
      
      switch (correction.correctionType) {
        case 'product_qty':
          if (correction.shiftRecordId && correction.fieldName) {
            // Encontrar o record correspondente
            const recordIndex = correctedShift.records.findIndex((r: any) => r.id === correction.shiftRecordId);
            if (recordIndex !== -1) {
              // Aplicar correção no record
              correctedShift.records[recordIndex][correction.fieldName] = parseInt(correctedValue);
              
              // Marcar para rastreamento
              if (!correctedRecords[correction.shiftRecordId]) {
                correctedRecords[correction.shiftRecordId] = {};
              }
              correctedRecords[correction.shiftRecordId][correction.fieldName] = correctedValue;

              // Recalcular valores derivados do produto
              const record = correctedShift.records[recordIndex];
              const entryQty = record.entryQty || 0;
              const soldQty = record.soldQty || 0;
              const consumedQty = record.consumedQty || 0;
              const discardQty = record.discardQty || 0;
              
              // Recalcular sobra automaticamente
              const leftoverQty = entryQty - soldQty - consumedQty - discardQty;
              record.leftoverQty = leftoverQty;
              
              // Recalcular total do item
              const price = parseFloat(record.priceSnapshot || "0");
              const itemTotal = soldQty * price;
              record.itemTotal = itemTotal.toFixed(2);

              // Marcar valores recalculados como corretos
              correctedRecords[correction.shiftRecordId].leftoverQty = leftoverQty.toString();
              correctedRecords[correction.shiftRecordId].itemTotal = itemTotal.toFixed(2);
            }
          }
          break;

        case 'payment':
          if (correction.paymentMethod) {
            // Aplicar correção no pagamento
            if (correctedShift.payments) {
              correctedShift.payments[correction.paymentMethod] = correctedValue;
              correctedPayments[correction.paymentMethod] = correctedValue;
            }
          }
          break;

        case 'cash_count':
          if (correction.cashType) {
            // Aplicar correção nos valores de caixa
            correctedShift.shift[correction.cashType] = correctedValue;
            correctedCashValues[correction.cashType] = correctedValue;
          }
          break;
      }
    }

    // 5. Recalcular valores derivados globais se houve mudanças de pagamento ou caixa
    if (Object.keys(correctedPayments).length > 0 || Object.keys(correctedCashValues).length > 0) {
      await recalculateShiftDerivedValues(correctedShift, correctedCashValues);
    }

    // 6. Retornar os dados com as correções aplicadas
    return {
      shift: correctedShift.shift,
      user: correctedShift.user,
      records: correctedShift.records,
      payments: correctedShift.payments,
      correctedRecords,
      correctedPayments,
      correctedCashValues
    };

  } catch (error) {
    console.error('Error applying corrections to shift data:', error);
    throw error;
  }
}

/**
 * Recalcula valores derivados do turno após correções de pagamento ou caixa
 */
async function recalculateShiftDerivedValues(correctedShift: any, correctedCashValues: { [key: string]: any }) {
  const shift = correctedShift.shift;
  const payments = correctedShift.payments;

  if (!payments) return;

  // Recalcular valores totais de vendas
  const totalSales = (parseFloat(payments.cash || "0") + 
                     parseFloat(payments.pix || "0") + 
                     parseFloat(payments.stoneCard || "0") + 
                     parseFloat(payments.stoneVoucher || "0") + 
                     parseFloat(payments.pagBankCard || "0"));

  shift.totalSales = totalSales.toFixed(2);

  // Se houver correções de caixa, recalcular divergência
  if (correctedCashValues.countedFinalCash || correctedCashValues.countedFinalCoins) {
    const initialCash = parseFloat(shift.initialCash || "0");
    const initialCoins = parseFloat(shift.initialCoins || "0");
    const cashSales = parseFloat(payments.cash || "0");
    
    // Buscar retiradas de caixa para este turno
    const cashAdjustments = await storage.getCashAdjustments(shift.id);
    const totalWithdrawals = cashAdjustments.reduce((sum, adjustment) => {
      if (adjustment.type === 'withdraw') {
        return sum + parseFloat(adjustment.amount);
      }
      return sum;
    }, 0);

    const expectedCash = initialCash + cashSales - totalWithdrawals;
    const expectedCoins = initialCoins;
    const actualCash = parseFloat(correctedCashValues.countedFinalCash || shift.countedFinalCash || "0");
    const actualCoins = parseFloat(correctedCashValues.countedFinalCoins || shift.countedFinalCoins || "0");

    const totalExpected = expectedCash + expectedCoins;
    const totalActual = actualCash + actualCoins;
    const cashDivergence = totalActual - totalExpected;

    // Atualizar valores recalculados
    shift.expectedCash = expectedCash.toFixed(2);
    shift.cashDivergence = cashDivergence.toFixed(2);

    // Recalcular troco para próximo turno se aplicável
    if (shift.envelopeCash !== null && shift.envelopeCoins !== null) {
      const envelopeCash = parseFloat(shift.envelopeCash || "0");
      const envelopeCoins = parseFloat(shift.envelopeCoins || "0");
      
      const cashForNext = actualCash - envelopeCash;
      const coinsForNext = actualCoins - envelopeCoins;
      
      shift.cashForNextShift = cashForNext.toFixed(2);
      shift.coinsForNextShift = coinsForNext.toFixed(2);
    }
  }
}

/**
 * Verifica se um turno tem correções aplicadas
 */
export async function shiftHasActiveCorrections(shiftId: number): Promise<boolean> {
  const activeCorrections = await db.query.corrections.findMany({
    where: and(
      eq(corrections.shiftId, shiftId),
      isNull(corrections.revokedAt)
    )
  });
  
  return activeCorrections.length > 0;
}