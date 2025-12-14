import { eq, and, gte, lt, asc } from "drizzle-orm";
import { shifts, shiftPayments } from "@shared/schema";

// NOVO: Interface para os valores de meia-noite armazenados no turno
interface MidnightCardValues {
  stoneCardCumulative: string;
  stoneVoucherCumulative: string;
  pagBankCardCumulative: string;
  recordedAt?: string;
}

export class CardPaymentCalculator {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  // NOVO: Método auxiliar para verificar se o turno cruza a meia-noite
  private shiftCrossesMidnight(startTime: Date, endTime?: Date): boolean {
    if (!endTime) {
      // Turno ainda aberto - verificar se já passou da meia-noite
      const now = new Date();
      const startDate = new Date(startTime).setHours(0, 0, 0, 0);
      const nowDate = new Date(now).setHours(0, 0, 0, 0);
      return startDate !== nowDate;
    }

    const startDate = new Date(startTime).setHours(0, 0, 0, 0);
    const endDate = new Date(endTime).setHours(0, 0, 0, 0);
    return startDate !== endDate;
  }

  // NOVO: Método auxiliar para parsear midnight_card_values
  private parseMidnightValues(midnightCardValuesJson: string | null): MidnightCardValues | null {
    if (!midnightCardValuesJson) return null;

    try {
      const parsed = JSON.parse(midnightCardValuesJson);
      // Validar que tem pelo menos um valor
      if (parseFloat(parsed.stoneCardCumulative || '0') > 0 ||
          parseFloat(parsed.stoneVoucherCumulative || '0') > 0 ||
          parseFloat(parsed.pagBankCardCumulative || '0') > 0) {
        return parsed;
      }
      return null;
    } catch (e) {
      console.error("Erro ao parsear midnightCardValues:", e);
      return null;
    }
  }

  async calculateRealCardPayments(shiftId: number, cumulativeValues: {
    cash?: string;
    pix?: string;
    stoneCardCumulative?: string;
    stoneVoucherCumulative?: string;
    pagBankCardCumulative?: string;
  }) {
    const shift = await this.db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId),
      with: { user: true }
    });

    if (!shift) throw new Error('Turno não encontrado');

    // NOVO: Verificar se há valores de meia-noite registrados (turno cruzou a meia-noite)
    const midnightValues = this.parseMidnightValues(shift.midnightCardValues);

    // CORREÇÃO: Se o turno tem midnight values, usar lógica especial para turnos que cruzam meia-noite
    if (midnightValues) {
      console.log("=== TURNO CRUZOU MEIA-NOITE - Usando cálculo bifurcado ===");
      console.log("Valores registrados à meia-noite:", midnightValues);
      console.log("Valores finais informados:", cumulativeValues);

      return this.calculateForMidnightCrossingShift(
        shift,
        midnightValues,
        cumulativeValues
      );
    }

    // Lógica padrão para turnos normais (não cruzam meia-noite)
    const shiftDate = new Date(shift.startTime);
    const startOfDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());

    // Verificar se é o primeiro turno do dia (após meia-noite)
    const previousShiftsToday = await this.db.query.shifts.findMany({
      where: and(
        gte(shifts.startTime, new Date(startOfDay.getTime())),
        lt(shifts.startTime, new Date(shift.startTime)),
        eq(shifts.status, 'closed')
      ),
      with: { payments: true },
      orderBy: [asc(shifts.startTime)]
    });

    // Se é o primeiro turno do dia, valores cumulativos = valores reais
    if (previousShiftsToday.length === 0) {
      return {
        realValues: {
          // PIX e Cash permanecem inalterados
          cash: parseFloat(cumulativeValues.cash || '0'),
          pix: parseFloat(cumulativeValues.pix || '0'),
          // Para maquininhas, no primeiro turno: cumulativo = real
          stoneCard: parseFloat(cumulativeValues.stoneCardCumulative || '0'),
          stoneVoucher: parseFloat(cumulativeValues.stoneVoucherCumulative || '0'),
          pagBankCard: parseFloat(cumulativeValues.pagBankCardCumulative || '0')
        },
        cumulativeValues: {
          stoneCardCumulative: cumulativeValues.stoneCardCumulative || '0',
          stoneVoucherCumulative: cumulativeValues.stoneVoucherCumulative || '0',
          pagBankCardCumulative: cumulativeValues.pagBankCardCumulative || '0'
        },
        isFirstShiftOfDay: true,
        previousAccumulated: { stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 },
        crossedMidnight: false
      };
    }

    // Calcular valores acumulados dos turnos anteriores do mesmo dia
    const previousAccumulated = {
      stoneCard: 0,
      stoneVoucher: 0,
      pagBankCard: 0
    };

    for (const prevShift of previousShiftsToday) {
      if (prevShift.payments) {
        // Somar apenas os valores REAIS dos turnos anteriores
        previousAccumulated.stoneCard += parseFloat(prevShift.payments.stoneCard || '0');
        previousAccumulated.stoneVoucher += parseFloat(prevShift.payments.stoneVoucher || '0');
        previousAccumulated.pagBankCard += parseFloat(prevShift.payments.pagBankCard || '0');
      }
    }

    // Calcular valores reais para este turno (cumulativo - anterior)
    const realValues = {
      // PIX e Cash permanecem exatamente como informados
      cash: parseFloat(cumulativeValues.cash || '0'),
      pix: parseFloat(cumulativeValues.pix || '0'),
      // Maquininhas: valor real = cumulativo - acumulado anterior
      stoneCard: Math.max(0, parseFloat(cumulativeValues.stoneCardCumulative || '0') - previousAccumulated.stoneCard),
      stoneVoucher: Math.max(0, parseFloat(cumulativeValues.stoneVoucherCumulative || '0') - previousAccumulated.stoneVoucher),
      pagBankCard: Math.max(0, parseFloat(cumulativeValues.pagBankCardCumulative || '0') - previousAccumulated.pagBankCard)
    };

    return {
      realValues,
      cumulativeValues: {
        stoneCardCumulative: cumulativeValues.stoneCardCumulative || '0',
        stoneVoucherCumulative: cumulativeValues.stoneVoucherCumulative || '0',
        pagBankCardCumulative: cumulativeValues.pagBankCardCumulative || '0'
      },
      isFirstShiftOfDay: false,
      previousAccumulated,
      crossedMidnight: false
    };
  }

  // NOVO: Método para calcular vendas de turnos que cruzam a meia-noite
  private async calculateForMidnightCrossingShift(
    shift: any,
    midnightValues: MidnightCardValues,
    finalCumulativeValues: {
      stoneCardCumulative?: string;
      stoneVoucherCumulative?: string;
      pagBankCardCumulative?: string;
      cash?: string;
      pix?: string;
    }
  ) {
    // A lógica é bifurcada:
    // 1. Vendas antes da meia-noite (Dia 1): midnightValues - acumulado anterior
    // 2. Vendas depois da meia-noite (Dia 2): finalCumulativeValues (máquina zerou)
    // 3. Total: soma de 1 e 2

    const shiftDate = new Date(shift.startTime);
    const startOfDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());

    // Buscar turnos anteriores do DIA 1 (dia em que o turno começou)
    const previousShiftsDay1 = await this.db.query.shifts.findMany({
      where: and(
        gte(shifts.startTime, new Date(startOfDay.getTime())),
        lt(shifts.startTime, new Date(shift.startTime)),
        eq(shifts.status, 'closed')
      ),
      with: { payments: true },
      orderBy: [asc(shifts.startTime)]
    });

    // Calcular acumulado dos turnos anteriores do Dia 1
    const previousAccumulatedDay1 = {
      stoneCard: 0,
      stoneVoucher: 0,
      pagBankCard: 0
    };

    for (const prevShift of previousShiftsDay1) {
      if (prevShift.payments) {
        previousAccumulatedDay1.stoneCard += parseFloat(prevShift.payments.stoneCard || '0');
        previousAccumulatedDay1.stoneVoucher += parseFloat(prevShift.payments.stoneVoucher || '0');
        previousAccumulatedDay1.pagBankCard += parseFloat(prevShift.payments.pagBankCard || '0');
      }
    }

    // PARTE 1: Vendas antes da meia-noite (Dia 1)
    // = midnightValues - acumulado de turnos anteriores no Dia 1
    const salesBeforeMidnight = {
      stoneCard: Math.max(0, parseFloat(midnightValues.stoneCardCumulative || '0') - previousAccumulatedDay1.stoneCard),
      stoneVoucher: Math.max(0, parseFloat(midnightValues.stoneVoucherCumulative || '0') - previousAccumulatedDay1.stoneVoucher),
      pagBankCard: Math.max(0, parseFloat(midnightValues.pagBankCardCumulative || '0') - previousAccumulatedDay1.pagBankCard)
    };

    // PARTE 2: Vendas depois da meia-noite (Dia 2)
    // = finalCumulativeValues (a máquina zerou à meia-noite, então é o valor direto)
    // Nota: Não subtraímos nada porque a máquina zerou à meia-noite
    const salesAfterMidnight = {
      stoneCard: parseFloat(finalCumulativeValues.stoneCardCumulative || '0'),
      stoneVoucher: parseFloat(finalCumulativeValues.stoneVoucherCumulative || '0'),
      pagBankCard: parseFloat(finalCumulativeValues.pagBankCardCumulative || '0')
    };

    // TOTAL: Soma das duas partes
    const totalRealValues = {
      cash: parseFloat(finalCumulativeValues.cash || '0'),
      pix: parseFloat(finalCumulativeValues.pix || '0'),
      stoneCard: salesBeforeMidnight.stoneCard + salesAfterMidnight.stoneCard,
      stoneVoucher: salesBeforeMidnight.stoneVoucher + salesAfterMidnight.stoneVoucher,
      pagBankCard: salesBeforeMidnight.pagBankCard + salesAfterMidnight.pagBankCard
    };

    console.log("=== CÁLCULO BIFURCADO ===");
    console.log("Acumulado turnos anteriores Dia 1:", previousAccumulatedDay1);
    console.log("Vendas antes da meia-noite:", salesBeforeMidnight);
    console.log("Vendas depois da meia-noite:", salesAfterMidnight);
    console.log("Total real calculado:", totalRealValues);

    return {
      realValues: totalRealValues,
      cumulativeValues: {
        stoneCardCumulative: finalCumulativeValues.stoneCardCumulative || '0',
        stoneVoucherCumulative: finalCumulativeValues.stoneVoucherCumulative || '0',
        pagBankCardCumulative: finalCumulativeValues.pagBankCardCumulative || '0'
      },
      isFirstShiftOfDay: previousShiftsDay1.length === 0,
      previousAccumulated: previousAccumulatedDay1,
      // NOVO: Informações adicionais para debug/auditoria
      crossedMidnight: true,
      midnightSnapshot: midnightValues,
      salesBeforeMidnight,
      salesAfterMidnight
    };
  }

  // Método auxiliar para obter valores acumulados do dia atual
  async getCurrentDayAccumulated(shiftId: number): Promise<{
    stoneCard: number;
    stoneVoucher: number;
    pagBankCard: number;
  }> {
    const shift = await this.db.query.shifts.findFirst({
      where: eq(shifts.id, shiftId)
    });

    if (!shift) {
      return { stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 };
    }

    const shiftDate = new Date(shift.startTime);
    const startOfDay = new Date(shiftDate.getFullYear(), shiftDate.getMonth(), shiftDate.getDate());
    const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);

    const todayShifts = await this.db.query.shifts.findMany({
      where: and(
        gte(shifts.startTime, new Date(startOfDay.getTime())),
        lt(shifts.startTime, new Date(endOfDay.getTime())),
        eq(shifts.status, 'closed')
      ),
      with: { payments: true },
      orderBy: [asc(shifts.startTime)]
    });

    const accumulated = {
      stoneCard: 0,
      stoneVoucher: 0,
      pagBankCard: 0
    };

    for (const dayShift of todayShifts) {
      if (dayShift.payments) {
        accumulated.stoneCard += parseFloat(dayShift.payments.stoneCard || '0');
        accumulated.stoneVoucher += parseFloat(dayShift.payments.stoneVoucher || '0');
        accumulated.pagBankCard += parseFloat(dayShift.payments.pagBankCard || '0');
      }
    }

    return accumulated;
  }
}