import { db } from "../db";
import { 
  shifts, 
  shiftRecords, 
  shiftPayments, 
  shiftCollaborators,
  corrections,
  cashAdjustments,
  products,
  users,
  type Shift,
  type ShiftRecord,
  type ShiftPayment,
  type Correction
} from "@shared/schema";
import { eq, and, isNull, desc } from "drizzle-orm";

/**
 * Função central e robusta para buscar e processar um turno com todas as correções aplicadas.
 * Esta função é "à prova de balas" - nunca deve quebrar, independentemente do estado dos dados.
 * 
 * @param shiftId - ID do turno a ser processado
 * @returns Turno processado com correções aplicadas ou null se não encontrado
 */
export async function getProcessedShiftById(shiftId: number) {
  try {
    // 1. Buscar o turno usando select simples (sem relações por enquanto)
    const shiftResults = await db
      .select()
      .from(shifts)
      .where(eq(shifts.id, shiftId))
      .limit(1);
    
    if (shiftResults.length === 0) {
      return null;
    }
    
    const shift = shiftResults[0];
    
    // Buscar relações manualmente para evitar problema do Drizzle
    const [user, records, payments, collaborators] = await Promise.all([
      // Buscar usuário
      db.select().from(users).where(eq(users.id, shift.userId)).limit(1),
      // Buscar registros de produtos
      db.select({
        id: shiftRecords.id,
        shiftId: shiftRecords.shiftId,
        productId: shiftRecords.productId,
        entryQty: shiftRecords.entryQty,
        arrivalQty: shiftRecords.arrivalQty,
        leftoverQty: shiftRecords.leftoverQty,
        discardQty: shiftRecords.discardQty,
        consumedQty: shiftRecords.consumedQty,
        soldQty: shiftRecords.soldQty,
        productName: products.name,
        productPrice: products.price,
        productCategory: products.category
      })
      .from(shiftRecords)
      .leftJoin(products, eq(shiftRecords.productId, products.id))
      .where(eq(shiftRecords.shiftId, shiftId)),
      // Buscar pagamentos
      db.select().from(shiftPayments).where(eq(shiftPayments.shiftId, shiftId)).limit(1),
      // Buscar colaboradores
      db.select()
        .from(shiftCollaborators)
        .leftJoin(users, eq(shiftCollaborators.userId, users.id))
        .where(eq(shiftCollaborators.shiftId, shiftId))
    ]);
    
    // Reconstruir objeto shift com relações
    const shiftWithRelations = {
      ...shift,
      user: user[0] || null,
      records: records.map(r => ({
        id: r.id,
        shiftId: r.shiftId,
        productId: r.productId,
        entryQty: r.entryQty,
        arrivalQty: r.arrivalQty,
        leftoverQty: r.leftoverQty,
        discardQty: r.discardQty,
        consumedQty: r.consumedQty,
        soldQty: r.soldQty,
        product: {
          name: r.productName,
          price: r.productPrice,
          category: r.productCategory
        }
      })),
      payments: payments[0] || null,
      collaborators: collaborators.map(c => ({
        id: c.shift_collaborators.id,
        user: c.users
      }))
    };

    // 3. Criar uma cópia profunda do turno para evitar mutações
    const processedShift = JSON.parse(JSON.stringify(shiftWithRelations));

    // 4. Garantir que arrays e objetos críticos existam
    if (!processedShift.records) {
      processedShift.records = [];
    }
    if (!processedShift.payments) {
      processedShift.payments = {
        cash: "0.00",
        pix: "0.00",
        stoneCard: "0.00",
        stoneVoucher: "0.00",
        pagBankCard: "0.00"
      };
    }
    if (!processedShift.collaborators) {
      processedShift.collaborators = [];
    }

    // 5. Buscar todas as correções ativas para este turno (usando select simples)
    const activeCorrections = await db
      .select()
      .from(corrections)
      .where(and(
        eq(corrections.shiftId, shiftId),
        isNull(corrections.revokedAt)
      ));

    // 6. Aplicar correções de forma defensiva
    for (const correction of activeCorrections) {
      try {
        switch (correction.correctionType) {
          case 'product_qty':
            // Correção de quantidade de produto
            if (correction.shiftRecordId && processedShift.records && correction.fieldName) {
              const recordIndex = processedShift.records.findIndex(
                (r: any) => r.id === correction.shiftRecordId
              );
              if (recordIndex !== -1) {
                const record = processedShift.records[recordIndex];
                // Aplicar correção ao campo especificado (entryQty, leftoverQty, etc.)
                record[correction.fieldName] = parseInt(correction.correctedValue) || 0;
              }
            }
            break;

          case 'product_price':
            // Correção de preço de produto
            if (correction.productId && processedShift.records) {
              for (const record of processedShift.records) {
                if (record.productId === correction.productId && record.product) {
                  record.product.price = correction.correctedValue || record.product.price;
                }
              }
            }
            break;

          case 'payment':
            // Correção de pagamento usando paymentMethod
            if (correction.paymentMethod && processedShift.payments) {
              processedShift.payments[correction.paymentMethod] = correction.correctedValue || "0.00";
            }
            break;

          case 'cash_count':
            // Correção de contagem de caixa usando cashType
            if (correction.cashType === 'countedFinalCash') {
              processedShift.countedFinalCash = correction.correctedValue;
              processedShift.finalCash = correction.correctedValue;
            } else if (correction.cashType === 'countedFinalCoins') {
              processedShift.countedFinalCoins = correction.correctedValue;
              processedShift.finalCoins = correction.correctedValue;
            } else if (correction.cashType === 'finalCash') {
              processedShift.finalCash = correction.correctedValue;
            } else if (correction.cashType === 'finalCoins') {
              processedShift.finalCoins = correction.correctedValue;
            }
            break;
        }
      } catch (correctionError) {
        // Se uma correção individual falhar, continuar com as outras
        console.error(`Erro ao aplicar correção ${correction.id}:`, correctionError);
      }
    }

    // 7. Buscar ajustes de caixa (sangrias) para este turno (usando select simples)
    const shiftAdjustments = await db
      .select()
      .from(cashAdjustments)
      .where(eq(cashAdjustments.shiftId, shiftId));

    // Adicionar ajustes ao turno processado
    processedShift.cashAdjustments = shiftAdjustments || [];

    // 8. Recalcular valores derivados
    processedShift.totalCorrections = activeCorrections.length;

    // Calcular total de vendas em dinheiro
    let cashSales = 0;
    if (processedShift.payments && processedShift.payments.cash) {
      cashSales = parseFloat(processedShift.payments.cash) || 0;
    }

    // Calcular divergência de caixa
    const initialCash = parseFloat(processedShift.initialCash) || 0;
    const finalCash = parseFloat(processedShift.finalCash) || 0;
    processedShift.cashDivergence = (finalCash - (initialCash + cashSales)).toFixed(2);

    // Calcular total de ajustes de caixa (sangrias)
    let totalWithdrawals = 0;
    if (shiftAdjustments && Array.isArray(shiftAdjustments)) {
      totalWithdrawals = shiftAdjustments
        .filter((adj: any) => adj.type === 'withdraw' || adj.type === 'sangria')
        .reduce((sum: number, adj: any) => {
          return sum + (parseFloat(adj.amount) || 0);
        }, 0);
    }
    processedShift.totalWithdrawals = totalWithdrawals.toFixed(2);

    // Usar os campos corretos do schema para caixa do próximo turno
    if (processedShift.cashForNextShift) {
      // Se já existe no banco, usar o valor
      processedShift.cashForNextShift = processedShift.cashForNextShift;
    } else {
      // Caso contrário, calcular: caixa final - sangrias
      const cashForNext = finalCash - totalWithdrawals;
      processedShift.cashForNextShift = cashForNext.toFixed(2);
    }

    // Usar o campo correto para moedas do próximo turno
    if (processedShift.coinsForNextShift) {
      processedShift.coinsForNextShift = processedShift.coinsForNextShift;
    } else {
      processedShift.coinsForNextShift = processedShift.finalCoins || "0.00";
    }

    // Calcular total de vendas
    let totalSales = 0;
    if (processedShift.payments) {
      totalSales = Object.values(processedShift.payments).reduce((sum: number, value: any) => {
        return sum + (parseFloat(value) || 0);
      }, 0);
    }
    processedShift.totalSales = totalSales.toFixed(2);

    // Calcular total de sobras
    let totalLeftovers = 0;
    if (processedShift.records && Array.isArray(processedShift.records)) {
      totalLeftovers = processedShift.records.reduce((sum: number, record: any) => {
        return sum + (parseInt(record.leftoverQty) || 0);
      }, 0);
    }
    processedShift.totalLeftovers = totalLeftovers;

    // 9. Retornar o turno processado
    return processedShift;

  } catch (error) {
    // Em caso de erro crítico, logar e retornar null
    console.error('Erro ao processar turno:', error);
    return null;
  }
}

/**
 * Função auxiliar para buscar o último turno fechado processado
 * @returns Último turno fechado processado ou null
 */
export async function getLastClosedShift() {
  try {
    console.log('DEBUG: Buscando último turno fechado...');
    
    // Buscar apenas o ID do último turno fechado usando select simples
    const lastShiftResults = await db
      .select({ id: shifts.id })
      .from(shifts)
      .where(eq(shifts.status, 'closed'))
      .orderBy(desc(shifts.endTime))
      .limit(1);

    console.log('DEBUG: Resultado da busca:', lastShiftResults);

    if (lastShiftResults.length === 0) {
      console.log('DEBUG: Nenhum turno fechado encontrado');
      return null;
    }

    console.log('DEBUG: Processando turno ID:', lastShiftResults[0].id);
    
    // Usar a função robusta para processar o turno
    return await getProcessedShiftById(lastShiftResults[0].id);

  } catch (error) {
    console.error('Erro ao buscar último turno fechado:', error);
    return null;
  }
}