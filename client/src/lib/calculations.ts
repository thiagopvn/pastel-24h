/**
 * Calculate sold quantity based on inventory formula:
 * Sold = Entry + Arrival - Leftover - Discard - Internal Consumption
 */
export function calculateSold(
  entry: number,
  arrival: number, 
  leftover: number,
  discard: number,
  consumed: number
): number {
  return Math.max(0, entry + arrival - leftover - discard - consumed);
}

/**
 * Calculate total sales value
 */
export function calculateTotal(soldQty: number, price: number): number {
  return soldQty * price;
}

/**
 * Calculate cash divergence
 */
export function calculateCashDivergence(
  finalCash: number,
  initialCash: number,
  cashSales: number
): number {
  const expectedCash = initialCash + cashSales;
  return finalCash - expectedCash;
}

/**
 * Calculate payroll for weekly report
 */
export function calculatePayroll(
  hours: number,
  hourlyRate: number,
  transport: number,
  food: number,
  consumption: number,
  consumptionDiscount: number,
  bonus: number,
  deduction: number
): number {
  const hoursPay = hours * hourlyRate;
  // Correct consumption discount: consumptionDiscount% of consumption is discounted FROM the consumption
  const consumptionDiscountAmount = consumption * (consumptionDiscount / 100);
  const finalConsumption = consumption - consumptionDiscountAmount;
  
  return hoursPay + transport + food + bonus - finalConsumption - deduction;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
}

/**
 * Calculate transport cost based on days worked and transport type
 */
export function calculateTransportCost(
  daysWorked: number,
  transportType: string,
  rates: { bus: number; van: number; app: number }
): number {
  const rateKey = transportType as keyof typeof rates;
  const dailyRate = rates[rateKey] || 0;
  return daysWorked * dailyRate;
}

/**
 * Check if stock is low
 */
export function isStockLow(currentStock: number, minStock: number): boolean {
  return currentStock < minStock;
}

/**
 * Calculate estimated profit based on margin
 */
export function calculateEstimatedProfit(totalSales: number, margin: number = 0.5): number {
  return totalSales * margin;
}
