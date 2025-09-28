import { eq, and, gte, lt, asc } from "drizzle-orm";
import { shifts, shiftPayments } from "@shared/schema";

export class CardPaymentCalculator {
  private db: any;

  constructor(db: any) {
    this.db = db;
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
        previousAccumulated: { stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 }
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
      previousAccumulated
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