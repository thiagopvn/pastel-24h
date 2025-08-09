import Database from 'better-sqlite3';

// Get the raw SQLite instance for prepared statements
const dbPath = process.env.DATABASE_PATH || './data/local.db';
const sqlite = new Database(dbPath);

/**
 * Função robusta usando SQL bruto para contornar problemas do Drizzle ORM
 * Esta função busca e processa um turno com todas as correções aplicadas.
 * 
 * @param shiftId - ID do turno a ser processado
 * @returns Turno processado com correções aplicadas ou null se não encontrado
 */
export async function getProcessedShiftById(shiftId: number) {
  try {

    // 1. Buscar o turno com usuário usando SQL bruto
    const shiftQuery = sqlite.prepare(`
      SELECT 
        s.*,
        u.id as user_id_ref,
        u.name as user_name,
        u.email as user_email,
        u.role as user_role
      FROM shifts s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.id = ?
    `);
    
    const shift = shiftQuery.get(shiftId) as any;
    
    if (!shift) {
      return null;
    }

    // 2. Buscar registros de produtos
    const recordsQuery = sqlite.prepare(`
      SELECT 
        sr.*,
        p.name as product_name,
        p.price as product_price,
        p.category as product_category
      FROM shift_records sr
      LEFT JOIN products p ON sr.product_id = p.id
      WHERE sr.shift_id = ?
    `);
    
    const records = recordsQuery.all(shiftId) as any[];

    // 3. Buscar pagamentos
    const paymentsQuery = sqlite.prepare(`
      SELECT * FROM shift_payments WHERE shift_id = ?
    `);
    
    const payments = paymentsQuery.get(shiftId) as any;

    // 4. Buscar colaboradores
    const collaboratorsQuery = sqlite.prepare(`
      SELECT 
        sc.*,
        u.name as user_name,
        u.email as user_email
      FROM shift_collaborators sc
      LEFT JOIN users u ON sc.user_id = u.id
      WHERE sc.shift_id = ?
    `);
    
    const collaborators = collaboratorsQuery.all(shiftId) as any[];

    // 5. Buscar correções ativas
    const correctionsQuery = sqlite.prepare(`
      SELECT * FROM corrections 
      WHERE shift_id = ? AND revoked_at IS NULL
    `);
    
    const activeCorrections = correctionsQuery.all(shiftId) as any[];

    // 6. Buscar ajustes de caixa
    const adjustmentsQuery = sqlite.prepare(`
      SELECT * FROM cash_adjustments WHERE shift_id = ?
    `);
    
    const cashAdjustments = adjustmentsQuery.all(shiftId) as any[];

    // 7. Construir objeto do turno processado
    const processedShift = {
      // Campos do turno
      id: shift.id,
      userId: shift.user_id,
      startTime: shift.start_time,
      endTime: shift.end_time,
      openedAt: shift.start_time, // Adicionar alias openedAt para startTime
      closedAt: shift.end_time,   // Adicionar alias closedAt para endTime
      initialCash: shift.initial_cash,
      initialCoins: shift.initial_coins,
      finalCash: shift.final_cash,
      finalCoins: shift.final_coins,
      gasExchange: shift.gas_exchange,
      notes: shift.notes,
      cashDivergence: shift.cash_divergence,
      closedBy: shift.closed_by,
      totalSales: shift.total_sales,
      status: shift.status,
      countedFinalCash: shift.counted_final_cash,
      countedFinalCoins: shift.counted_final_coins,
      envelopeCash: shift.envelope_cash,
      envelopeCoins: shift.envelope_coins,
      cashForNextShift: shift.cash_for_next_shift,
      coinsForNextShift: shift.coins_for_next_shift,
      openingDiscrepancy: shift.opening_discrepancy,
      createdAt: shift.created_at,
      
      // Usuário
      user: shift.user_id_ref ? {
        id: shift.user_id_ref,
        name: shift.user_name,
        email: shift.user_email,
        role: shift.user_role
      } : null,
      
      // Registros de produtos
      records: records.map(r => ({
        id: r.id,
        shiftId: r.shift_id,
        productId: r.product_id,
        entryQty: r.entry_qty,
        arrivalQty: r.arrival_qty,
        leftoverQty: r.leftover_qty,
        discardQty: r.discard_qty,
        consumedQty: r.consumed_qty,
        soldQty: r.sold_qty,
        product: {
          name: r.product_name,
          price: r.product_price,
          category: r.product_category
        }
      })),
      
      // Pagamentos
      payments: payments ? {
        cash: payments.cash,
        pix: payments.pix,
        stoneCard: payments.stone_card,
        stoneVoucher: payments.stone_voucher,
        pagBankCard: payments.pagbank_card
      } : {
        cash: "0.00",
        pix: "0.00",
        stoneCard: "0.00",
        stoneVoucher: "0.00",
        pagBankCard: "0.00"
      },
      
      // Colaboradores
      collaborators: collaborators.map(c => ({
        id: c.id,
        user: {
          name: c.user_name,
          email: c.user_email
        }
      })),
      
      // Ajustes de caixa
      cashAdjustments: cashAdjustments || []
    };

    // 8. Aplicar correções
    for (const correction of activeCorrections) {
      try {
        switch (correction.correction_type) {
          case 'product_qty':
            if (correction.shift_record_id && correction.field_name) {
              const record = processedShift.records.find(r => r.id === correction.shift_record_id);
              if (record) {
                (record as any)[correction.field_name] = parseInt(correction.corrected_value) || 0;
              }
            }
            break;

          case 'product_price':
            if (correction.product_id) {
              for (const record of processedShift.records) {
                if (record.productId === correction.product_id && record.product) {
                  record.product.price = correction.corrected_value || record.product.price;
                }
              }
            }
            break;

          case 'payment':
            if (correction.payment_method) {
              (processedShift.payments as any)[correction.payment_method] = correction.corrected_value || "0.00";
            }
            break;

          case 'cash_count':
            if (correction.cash_type === 'countedFinalCash' || correction.cash_type === 'finalCash') {
              processedShift.finalCash = correction.corrected_value;
              processedShift.countedFinalCash = correction.corrected_value;
            } else if (correction.cash_type === 'countedFinalCoins' || correction.cash_type === 'finalCoins') {
              processedShift.finalCoins = correction.corrected_value;
              processedShift.countedFinalCoins = correction.corrected_value;
            }
            break;
        }
      } catch (correctionError) {
        console.error(`Erro ao aplicar correção ${correction.id}:`, correctionError);
      }
    }

    // 9. Recalcular valores derivados
    const totalCorrections = activeCorrections.length;
    
    // Calcular divergência de caixa
    const initialCash = parseFloat(processedShift.initialCash) || 0;
    const finalCash = parseFloat(processedShift.finalCash) || 0;
    const cashSales = parseFloat(processedShift.payments.cash) || 0;
    const recalculatedDivergence = (finalCash - (initialCash + cashSales)).toFixed(2);
    
    // Calcular total de sangrias
    const totalWithdrawals = cashAdjustments
      .filter(adj => adj.type === 'withdraw' || adj.type === 'sangria')
      .reduce((sum, adj) => sum + (parseFloat(adj.amount) || 0), 0);
    
    // Calcular total de vendas
    const totalSales = Object.values(processedShift.payments)
      .reduce((sum, value) => sum + (parseFloat(value as string) || 0), 0);
    
    // Calcular total de sobras
    const totalLeftovers = processedShift.records
      .reduce((sum, record) => sum + (parseInt(record.leftoverQty as any) || 0), 0);

    // 10. Adicionar campos calculados
    const finalProcessedShift = {
      ...processedShift,
      totalCorrections,
      cashDivergence: recalculatedDivergence,
      totalSales: totalSales.toFixed(2),
      totalLeftovers,
      totalWithdrawals: totalWithdrawals.toFixed(2)
    };

    return finalProcessedShift;

  } catch (error) {
    console.error('Erro ao processar turno:', error);
    return null;
  }
}

/**
 * Função para buscar o último turno fechado usando SQL bruto
 */
export async function getLastClosedShift() {
  try {
    
    const query = sqlite.prepare(`
      SELECT id FROM shifts 
      WHERE status = 'closed' 
      ORDER BY end_time DESC 
      LIMIT 1
    `);
    
    const lastShift = query.get() as { id: number } | undefined;
    
    if (!lastShift) {
      return null;
    }

    return await getProcessedShiftById(lastShift.id);

  } catch (error) {
    console.error('Erro ao buscar último turno fechado:', error);
    return null;
  }
}