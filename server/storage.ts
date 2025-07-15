import { users, products, shifts, shiftCollaborators, shiftRecords, shiftPayments, weeklyReports, timeline, config, paymentConfig, payrollConfig, shiftSignatures, cashAdjustments, shiftSnapshots, transportModes, type User, type InsertUser, type Product, type InsertProduct, type Shift, type InsertShift, type ShiftRecord, type InsertShiftRecord, type ShiftPayment, type InsertShiftPayment, type PaymentConfig, type InsertPaymentConfig, type PayrollConfig, type InsertPayrollConfig, type WeeklyReport, type Timeline, type ShiftSignature, type CashAdjustment, type ShiftSnapshot, type TransportMode, type InsertTransportMode } from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, asc, gte, lte, isNull, isNotNull, gt, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  deleteUser(id: number): Promise<boolean>;

  getProduct(id: number): Promise<Product | undefined>;
  getAllProducts(): Promise<Product[]>;
  getProductsByCategory(category: string): Promise<Product[]>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined>;
  deleteProduct(id: number): Promise<boolean>;

  getCurrentShift(userId?: number): Promise<Shift | undefined>;
  getAllOpenShifts(): Promise<Shift[]>;
  getShift(shiftId: number): Promise<Shift | undefined>;
  createShift(shift: InsertShift & { userId: number }): Promise<Shift>;
  updateShift(shiftId: number, updates: Partial<Shift>): Promise<Shift | undefined>;
  closeShift(shiftId: number, closedBy: number, updates: Partial<Shift>): Promise<Shift | undefined>;
  getShiftsByDateRange(startDate: Date, endDate: Date): Promise<Shift[]>;
  getShiftDetails(shiftId: number): Promise<{
    shift: Shift & { user: User };
    records: (ShiftRecord & { product: Product })[];
    payments: ShiftPayment | null;
    collaborators: User[];
  } | undefined>;

  addShiftCollaborator(shiftId: number, userId: number): Promise<boolean>;
  removeShiftCollaborator(shiftId: number, userId: number): Promise<boolean>;
  getShiftCollaborators(shiftId: number): Promise<User[]>;

  upsertShiftRecord(record: InsertShiftRecord & { shiftId: number }): Promise<ShiftRecord>;
  getShiftRecords(shiftId: number): Promise<ShiftRecord[]>;
  updateShiftRecord(recordId: number, updates: Partial<ShiftRecord>): Promise<ShiftRecord | undefined>;

  upsertShiftPayment(payment: InsertShiftPayment & { shiftId: number }): Promise<ShiftPayment>;
  getShiftPayment(shiftId: number): Promise<ShiftPayment | undefined>;

  createWeeklyReport(report: Omit<WeeklyReport, 'id' | 'createdAt'>): Promise<WeeklyReport>;
  getWeeklyReport(weekStart: Date): Promise<WeeklyReport | undefined>;
  getWeeklyReports(): Promise<WeeklyReport[]>;

  addTimelineEntry(entry: Omit<Timeline, 'id' | 'createdAt'>): Promise<Timeline>;
  getTimeline(limit?: number): Promise<Timeline[]>;

  getConfig(key: string): Promise<string | undefined>;
  setConfig(key: string, value: string): Promise<void>;

  getPaymentConfig(): Promise<PaymentConfig | undefined>;
  savePaymentConfig(config: InsertPaymentConfig): Promise<PaymentConfig>;

  getPayrollConfig(): Promise<PayrollConfig | undefined>;
  savePayrollConfig(config: InsertPayrollConfig): Promise<PayrollConfig>;

  addShiftSignature(shiftId: number, userId: number, ipAddress?: string): Promise<ShiftSignature>;
  getShiftSignatures(shiftId: number): Promise<ShiftSignature[]>;

  createCashAdjustment(adjustment: {
    shiftId?: number;
    userId: number;
    type: string;
    amount: string;
    reason: string;
    beforeAmount: string;
    afterAmount: string;
  }): Promise<CashAdjustment>;
  getCashAdjustments(shiftId?: number): Promise<CashAdjustment[]>;

  createShiftSnapshot(snapshot: {
    shiftId: number;
    lastShiftId?: number;
    carryCash: string;
    carryCoins: string;
    carryProducts: any;
  }): Promise<ShiftSnapshot>;
  getShiftSnapshot(shiftId: number): Promise<ShiftSnapshot | undefined>;

  getAllTransportModes(): Promise<TransportMode[]>;
  createTransportMode(mode: InsertTransportMode): Promise<TransportMode>;
  updateTransportMode(id: number, updates: Partial<InsertTransportMode>): Promise<TransportMode | undefined>;
  deleteTransportMode(id: number): Promise<boolean>;

  getSalesStats(startDate: Date, endDate: Date): Promise<{
    totalSales: number;
    avgTicket: number;
    physicalCash: number;
    estimatedProfit: number;
  }>;
  getTopProducts(startDate: Date, endDate: Date, limit?: number): Promise<Array<{
    product: Product;
    soldQty: number;
    revenue: number;
  }>>;
  getSalesByHour(startDate: Date, endDate: Date): Promise<Array<{
    hour: number;
    sales: number;
  }>>;
  getPaymentMethodStats(startDate: Date, endDate: Date): Promise<{
    cash: number;
    pix: number;
    stoneCard: number;
    stoneVoucher: number;
    pagBankCard: number;
  }>;
  getCashDivergences(startDate: Date, endDate: Date): Promise<Array<{
    shift: Shift;
    user: User;
    divergence: number;
  }>>;

  getPendingWithdrawals(): Promise<CashAdjustment[]>;
  getAdjustedInheritedCash(lastClosedShift: any): Promise<{ inheritedCash: string; totalWithdrawals: number }>;

  sessionStore: session.Store;
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool, 
      createTableIfMissing: true 
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user || undefined;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(asc(users.name));
  }

  async deleteUser(id: number): Promise<boolean> {
    const result = await db.delete(users).where(eq(users.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getProduct(id: number): Promise<Product | undefined> {
    const [product] = await db.select().from(products).where(eq(products.id, id));
    return product || undefined;
  }

  async getAllProducts(): Promise<Product[]> {
    return await db.select().from(products).orderBy(asc(products.category), asc(products.name));
  }

  async getProductsByCategory(category: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.category, category)).orderBy(asc(products.name));
  }

  async createProduct(insertProduct: InsertProduct): Promise<Product> {
    const [product] = await db.insert(products).values(insertProduct).returning();
    return product;
  }

  async updateProduct(id: number, updates: Partial<InsertProduct>): Promise<Product | undefined> {
    const [product] = await db.update(products).set(updates).where(eq(products.id, id)).returning();
    return product || undefined;
  }

  async deleteProduct(id: number): Promise<boolean> {
    const result = await db.delete(products).where(eq(products.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getCurrentShift(userId?: number): Promise<Shift | undefined> {
    let query = db.select().from(shifts).where(isNull(shifts.endTime));
    if (userId) {
      query = db.select().from(shifts).where(and(isNull(shifts.endTime), eq(shifts.userId, userId)));
    }
    const [shift] = await query.orderBy(desc(shifts.startTime));
    return shift || undefined;
  }

  async getAllOpenShifts(): Promise<Shift[]> {
    return await db.select().from(shifts).where(isNull(shifts.endTime)).orderBy(desc(shifts.startTime));
  }

  async getShift(shiftId: number): Promise<Shift | undefined> {
    const [shift] = await db.select().from(shifts).where(eq(shifts.id, shiftId));
    return shift || undefined;
  }

  async createShift(shift: InsertShift & { userId: number }): Promise<Shift> {
    const [lastClosedShift] = await db.select().from(shifts)
      .where(isNotNull(shifts.endTime))
      .orderBy(desc(shifts.endTime))
      .limit(1);

    let inheritedCash = "200.00";
    let inheritedCoins = "50.00";
    let inheritedFromShiftId = null;

    if (lastClosedShift) {
      inheritedCash = lastClosedShift.finalCash || "200.00";
      inheritedCoins = lastClosedShift.finalCoins || "50.00";
      inheritedFromShiftId = lastClosedShift.id;

      const adjustedCashInfo = await this.getAdjustedInheritedCash(lastClosedShift);
      inheritedCash = adjustedCashInfo.inheritedCash;

      if (adjustedCashInfo.totalWithdrawals > 0) {
        console.log(`Cash inheritance adjusted: Final cash reduced by R$ ${adjustedCashInfo.totalWithdrawals} due to withdrawals`);
      }
    }

    const [newShift] = await db.insert(shifts).values({
      ...shift,
      initialCash: inheritedCash,
      initialCoins: inheritedCoins,
      inheritedFromShiftId,
      startTime: new Date(),
    }).returning();

    if (lastClosedShift) {
      const productsWithLeftover = await db.select().from(shiftRecords)
        .where(and(
          eq(shiftRecords.shiftId, lastClosedShift.id),
          gt(shiftRecords.leftoverQty, 0)
        ));

      const carryProducts: Array<{ productId: number; qty: number; name: string }> = [];

      for (const record of productsWithLeftover) {
        const product = await this.getProduct(record.productId);

        await db.insert(shiftRecords).values({
          shiftId: newShift.id,
          productId: record.productId,
          entryQty: record.leftoverQty,
          arrivalQty: 0,
          leftoverQty: 0,
          discardQty: 0,
          consumedQty: 0,
          soldQty: 0,
          priceSnapshot: record.priceSnapshot,
          itemTotal: "0",
        });

        carryProducts.push({
          productId: record.productId,
          qty: record.leftoverQty || 0,
          name: product?.name || `Produto ${record.productId}`
        });
      }

      await this.createShiftSnapshot({
        shiftId: newShift.id,
        lastShiftId: lastClosedShift.id,
        carryCash: inheritedCash,
        carryCoins: inheritedCoins,
        carryProducts,
      });

      const pendingWithdrawals = await this.getPendingWithdrawals();
      const totalWithdrawals = pendingWithdrawals.reduce((sum, withdrawal) => 
        sum + parseFloat(withdrawal.amount), 0);

      let description = `Turno aberto com herança automática: R$ ${inheritedCash} (caixa) + R$ ${inheritedCoins} (moedas) + ${carryProducts.length} tipos de produtos`;
      if (totalWithdrawals > 0) {
        description += ` - Retiradas pendentes descontadas: R$ ${totalWithdrawals.toFixed(2)}`;
      }

      await this.addTimelineEntry({
        userId: shift.userId,
        action: "shift_inheritance",
        description,
        metadata: {
          shiftId: newShift.id,
          inheritedFromShiftId: lastClosedShift.id,
          carryCash: inheritedCash,
          carryCoins: inheritedCoins,
          carryProductsCount: carryProducts.length,
          carryProducts,
          pendingWithdrawals: totalWithdrawals,
          pendingWithdrawalsCount: pendingWithdrawals.length,
        },
      });
    }

    return newShift;
  }

  async updateShift(shiftId: number, updates: Partial<Shift>): Promise<Shift | undefined> {
    const [shift] = await db.update(shifts).set(updates).where(eq(shifts.id, shiftId)).returning();
    return shift || undefined;
  }

  async closeShift(shiftId: number, closedBy: number, updates: Partial<Shift>): Promise<Shift | undefined> {
    console.log("Fechando turno no storage:", { shiftId, closedBy, updates });

    const cashAdjustments = await this.getCashAdjustments(shiftId);

    let totalAdjustments = 0;
    for (const adjustment of cashAdjustments) {
      if (adjustment.type === 'withdraw' || adjustment.type === 'adjustment') {
        totalAdjustments += parseFloat(adjustment.amount);
      }
    }

    if (updates.cashDivergence !== undefined && totalAdjustments > 0) {
      const currentDivergence = parseFloat(updates.cashDivergence as string) || 0;
      const adjustedDivergence = currentDivergence + totalAdjustments;
      updates.cashDivergence = adjustedDivergence.toFixed(2);

      console.log(`Divergência ajustada: ${currentDivergence} + ${totalAdjustments} = ${adjustedDivergence}`);
    }

    const [shift] = await db.update(shifts).set({
      ...updates,
      endTime: new Date(),
      closedBy,
    }).where(eq(shifts.id, shiftId)).returning();

    console.log("Turno fechado no storage:", shift);
    return shift || undefined;
  }

  async getShiftsByDateRange(startDate: Date, endDate: Date): Promise<Shift[]> {
    return await db.select().from(shifts)
      .where(and(
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate)
      ))
      .orderBy(desc(shifts.startTime));
  }

  async getShiftDetails(shiftId: number): Promise<{
    shift: Shift & { user: User };
    records: (ShiftRecord & { product: Product })[];
    payments: ShiftPayment | null;
    collaborators: User[];
  } | undefined> {
    const [shiftResult] = await db
      .select({
        shift: shifts,
        user: users
      })
      .from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .where(eq(shifts.id, shiftId))
      .limit(1);

    if (!shiftResult) return undefined;

    const recordsWithProducts = await db
      .select({
        record: shiftRecords,
        product: products
      })
      .from(shiftRecords)
      .innerJoin(products, eq(shiftRecords.productId, products.id))
      .where(eq(shiftRecords.shiftId, shiftId));

    const [payments] = await db.select().from(shiftPayments).where(eq(shiftPayments.shiftId, shiftId));
    const collaborators = await this.getShiftCollaborators(shiftId);

    return {
      shift: {
        ...shiftResult.shift,
        user: shiftResult.user
      },
      records: recordsWithProducts.map(item => ({
        ...item.record,
        product: item.product
      })),
      payments: payments || null,
      collaborators
    };
  }

  async addShiftCollaborator(shiftId: number, userId: number): Promise<boolean> {
    try {
      await db.insert(shiftCollaborators).values({ shiftId, userId });
      return true;
    } catch {
      return false;
    }
  }

  async removeShiftCollaborator(shiftId: number, userId: number): Promise<boolean> {
    const result = await db.delete(shiftCollaborators)
      .where(and(eq(shiftCollaborators.shiftId, shiftId), eq(shiftCollaborators.userId, userId)));
    return (result.rowCount ?? 0) > 0;
  }

  async getShiftCollaborators(shiftId: number): Promise<User[]> {
    const result = await db.select({ user: users })
      .from(shiftCollaborators)
      .innerJoin(users, eq(shiftCollaborators.userId, users.id))
      .where(eq(shiftCollaborators.shiftId, shiftId));
    return result.map(r => r.user);
  }

  async upsertShiftRecord(record: InsertShiftRecord & { shiftId: number }): Promise<ShiftRecord> {
    const product = await this.getProduct(record.productId);
    if (!product) throw new Error('Product not found');

    const calculatedSoldQty = (record.entryQty ?? 0) + (record.arrivalQty ?? 0) - (record.leftoverQty ?? 0) - (record.discardQty ?? 0) - (record.consumedQty ?? 0);

    const soldQty = Math.max(0, calculatedSoldQty);

    const itemTotal = soldQty * parseFloat(product.price);

    const existingRecord = await db.select().from(shiftRecords)
      .where(and(eq(shiftRecords.shiftId, record.shiftId), eq(shiftRecords.productId, record.productId)));

    if (existingRecord.length > 0) {
      const [updated] = await db.update(shiftRecords).set({
        ...record,
        soldQty,
        priceSnapshot: product.price,
        itemTotal: itemTotal.toString(),
      }).where(eq(shiftRecords.id, existingRecord[0].id)).returning();
      return updated;
    } else {
      const [created] = await db.insert(shiftRecords).values({
        ...record,
        soldQty,
        priceSnapshot: product.price,
        itemTotal: itemTotal.toString(),
      }).returning();
      return created;
    }
  }

  async getShiftRecords(shiftId: number): Promise<ShiftRecord[]> {
    return await db.select().from(shiftRecords).where(eq(shiftRecords.shiftId, shiftId));
  }

  async updateShiftRecord(recordId: number, updates: Partial<ShiftRecord>): Promise<ShiftRecord | undefined> {
    const [record] = await db.update(shiftRecords).set(updates).where(eq(shiftRecords.id, recordId)).returning();
    return record || undefined;
  }

  async upsertShiftPayment(payment: InsertShiftPayment & { shiftId: number }): Promise<ShiftPayment> {
    const existing = await db.select().from(shiftPayments).where(eq(shiftPayments.shiftId, payment.shiftId));

    if (existing.length > 0) {
      const [updated] = await db.update(shiftPayments).set(payment).where(eq(shiftPayments.shiftId, payment.shiftId)).returning();
      return updated;
    } else {
      const [created] = await db.insert(shiftPayments).values(payment).returning();
      return created;
    }
  }

  async getShiftPayment(shiftId: number): Promise<ShiftPayment | undefined> {
    const [payment] = await db.select().from(shiftPayments).where(eq(shiftPayments.shiftId, shiftId));
    return payment || undefined;
  }

  async createWeeklyReport(report: Omit<WeeklyReport, 'id' | 'createdAt'>): Promise<WeeklyReport> {
    const [created] = await db.insert(weeklyReports).values(report).returning();
    return created;
  }

  async getWeeklyReport(weekStart: Date): Promise<WeeklyReport | undefined> {
    const [report] = await db.select().from(weeklyReports).where(eq(weeklyReports.weekStart, weekStart));
    return report || undefined;
  }

  async getWeeklyReports(): Promise<WeeklyReport[]> {
    return await db.select().from(weeklyReports).orderBy(desc(weeklyReports.weekStart));
  }

  async addTimelineEntry(entry: Omit<Timeline, 'id' | 'createdAt'>): Promise<Timeline> {
    const [created] = await db.insert(timeline).values(entry).returning();
    return created;
  }

  async getTimeline(limit = 50): Promise<Timeline[]> {
    return await db.select().from(timeline).orderBy(desc(timeline.createdAt)).limit(limit);
  }

  async getConfig(key: string): Promise<string | undefined> {
    const [result] = await db.select().from(config).where(eq(config.key, key));
    return result?.value;
  }

  async setConfig(key: string, value: string): Promise<void> {
    await db.insert(config).values({ key, value })
      .onConflictDoUpdate({ target: config.key, set: { value, updatedAt: new Date() } });
  }

  async getSalesStats(startDate: Date, endDate: Date): Promise<{
    totalSales: number;
    avgTicket: number;
    physicalCash: number;
    estimatedProfit: number;
  }> {
    const salesResult = await db.select({
      totalSales: sql<number>`COALESCE(SUM(${shiftRecords.itemTotal}), 0)`,
      totalShifts: sql<number>`COUNT(DISTINCT ${shifts.id})`,
    }).from(shiftRecords)
      .innerJoin(shifts, eq(shiftRecords.shiftId, shifts.id))
      .where(and(
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate)
      ));

    const cashResult = await db.select({
      physicalCash: sql<number>`COALESCE(SUM(${shifts.finalCash}), 0)`,
    }).from(shifts)
      .where(and(
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate),
        isNull(shifts.endTime)
      ));

    const totalSales = salesResult[0]?.totalSales || 0;
    const totalShifts = salesResult[0]?.totalShifts || 0;
    const physicalCash = cashResult[0]?.physicalCash || 0;

    return {
      totalSales,
      avgTicket: totalShifts > 0 ? totalSales / totalShifts : 0,
      physicalCash,
      estimatedProfit: totalSales * 0.5,
    };
  }

  async getTopProducts(startDate: Date, endDate: Date, limit = 10): Promise<Array<{
    product: Product;
    soldQty: number;
    revenue: number;
  }>> {
    const result = await db.select({
      product: products,
      soldQty: sql<number>`SUM(${shiftRecords.soldQty})`,
      revenue: sql<number>`SUM(${shiftRecords.itemTotal})`,
    }).from(shiftRecords)
      .innerJoin(products, eq(shiftRecords.productId, products.id))
      .innerJoin(shifts, eq(shiftRecords.shiftId, shifts.id))
      .where(and(
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate)
      ))
      .groupBy(products.id)
      .orderBy(desc(sql`SUM(${shiftRecords.soldQty})`))
      .limit(limit);

    return result;
  }

  async getSalesByHour(startDate: Date, endDate: Date): Promise<Array<{
    hour: number;
    sales: number;
  }>> {
    const result = await db.select({
      hour: sql<number>`EXTRACT(HOUR FROM ${shifts.startTime})`,
      sales: sql<number>`SUM(${shiftRecords.itemTotal})`,
    }).from(shiftRecords)
      .innerJoin(shifts, eq(shiftRecords.shiftId, shifts.id))
      .where(and(
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate)
      ))
      .groupBy(sql`EXTRACT(HOUR FROM ${shifts.startTime})`)
      .orderBy(sql`EXTRACT(HOUR FROM ${shifts.startTime})`);

    return result;
  }

  async getPaymentMethodStats(startDate: Date, endDate: Date): Promise<{
    cash: number;
    pix: number;
    stoneCard: number;
    stoneVoucher: number;
    pagBankCard: number;
  }> {
    const result = await db.select({
      cash: sql<number>`COALESCE(SUM(${shiftPayments.cash}), 0)`,
      pix: sql<number>`COALESCE(SUM(${shiftPayments.pix}), 0)`,
      stoneCard: sql<number>`COALESCE(SUM(${shiftPayments.stoneCard}), 0)`,
      stoneVoucher: sql<number>`COALESCE(SUM(${shiftPayments.stoneVoucher}), 0)`,
      pagBankCard: sql<number>`COALESCE(SUM(${shiftPayments.pagBankCard}), 0)`,
    }).from(shiftPayments)
      .innerJoin(shifts, eq(shiftPayments.shiftId, shifts.id))
      .where(and(
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate)
      ));

    return result[0] || { cash: 0, pix: 0, stoneCard: 0, stoneVoucher: 0, pagBankCard: 0 };
  }

  async getCashDivergences(startDate: Date, endDate: Date): Promise<Array<{
    shift: Shift;
    user: User;
    divergence: number;
  }>> {
    const result = await db.select({
      shift: shifts,
      user: users,
      divergence: sql<string>`${shifts.cashDivergence}`,
    }).from(shifts)
      .innerJoin(users, eq(shifts.userId, users.id))
      .where(and(
        gte(shifts.startTime, startDate),
        lte(shifts.startTime, endDate),
        sql`ABS(CAST(${shifts.cashDivergence} AS NUMERIC)) > 0.99`,
        isNotNull(shifts.endTime) // Only closed shifts
      ))
      .orderBy(desc(shifts.startTime));

    return result.map(r => ({
      ...r,
      divergence: parseFloat(r.divergence) || 0
    }));
  }

  async getPaymentConfig(): Promise<PaymentConfig | undefined> {
    try {
      const [config] = await db.select().from(paymentConfig).limit(1);
      return config || undefined;
    } catch (error) {
      console.error("Erro ao buscar configuração de pagamento:", error);
      return undefined;
    }
  }

  async savePaymentConfig(configData: InsertPaymentConfig): Promise<PaymentConfig> {
    const existing = await this.getPaymentConfig();

    if (existing) {
      const [updated] = await db
        .update(paymentConfig)
        .set({
          ...configData,
          updatedAt: new Date(),
        })
        .where(eq(paymentConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(paymentConfig)
        .values(configData)
        .returning();
      return created;
    }
  }

  async getPayrollConfig(): Promise<PayrollConfig | undefined> {
    const [config] = await db.select().from(payrollConfig).limit(1);
    return config || undefined;
  }

  async savePayrollConfig(configData: InsertPayrollConfig): Promise<PayrollConfig> {
    const existing = await this.getPayrollConfig();

    if (existing) {
      const [updated] = await db
        .update(payrollConfig)
        .set({
          ...configData,
          updatedAt: new Date(),
        })
        .where(eq(payrollConfig.id, existing.id))
        .returning();
      return updated;
    } else {
      const [created] = await db
        .insert(payrollConfig)
        .values(configData)
        .returning();
      return created;
    }
  }

  async addShiftSignature(shiftId: number, userId: number, ipAddress?: string): Promise<ShiftSignature> {
    const [signature] = await db
      .insert(shiftSignatures)
      .values({
        shiftId,
        userId,
        signedAt: new Date(),
        ipAddress,
      })
      .returning();
    return signature;
  }

  async getShiftSignatures(shiftId: number): Promise<ShiftSignature[]> {
    return db.select().from(shiftSignatures).where(eq(shiftSignatures.shiftId, shiftId));
  }

  async createCashAdjustment(adjustment: {
    shiftId?: number;
    userId: number;
    type: string;
    amount: string;
    reason: string;
    beforeAmount: string;
    afterAmount: string;
  }): Promise<CashAdjustment> {
    const [created] = await db
      .insert(cashAdjustments)
      .values(adjustment)
      .returning();
    return created;
  }

  async getCashAdjustments(shiftId?: number): Promise<CashAdjustment[]> {
    if (shiftId) {
      return db.select().from(cashAdjustments).where(eq(cashAdjustments.shiftId, shiftId));
    }
    return db.select().from(cashAdjustments).orderBy(desc(cashAdjustments.createdAt));
  }

  async getPendingWithdrawals(): Promise<CashAdjustment[]> {
    try {
      const closedShifts = await db.select().from(shifts)
        .where(isNotNull(shifts.endTime))
        .orderBy(desc(shifts.endTime))
        .limit(1);

      if (closedShifts.length === 0) {
        const allWithdrawals = await db.select().from(cashAdjustments)
          .where(eq(cashAdjustments.type, 'withdraw'))
          .orderBy(desc(cashAdjustments.createdAt));
        return allWithdrawals;
      }

      const lastClosedShift = closedShifts[0];

      const withdrawalsFromLastShift = await db.select().from(cashAdjustments)
        .where(and(
          eq(cashAdjustments.type, 'withdraw'),
          eq(cashAdjustments.shiftId, lastClosedShift.id)
        ))
        .orderBy(desc(cashAdjustments.createdAt));

      return withdrawalsFromLastShift;
    } catch (error) {
      console.error("Error getting pending withdrawals:", error);
      return [];
    }
  }

  async getAdjustedInheritedCash(lastClosedShift: any): Promise<{ inheritedCash: string; totalWithdrawals: number }> {
    try {
      const baseCash = parseFloat(lastClosedShift.finalCash || "200.00");

      const withdrawals = await db.select().from(cashAdjustments)
        .where(and(
          eq(cashAdjustments.type, 'withdraw'),
          eq(cashAdjustments.shiftId, lastClosedShift.id)
        ));

      const totalWithdrawals = withdrawals.reduce((sum, withdrawal) => 
        sum + parseFloat(withdrawal.amount), 0);

      const adjustedCash = baseCash - totalWithdrawals;

      return {
        inheritedCash: adjustedCash.toFixed(2),
        totalWithdrawals
      };
    } catch (error) {
      console.error("Error calculating adjusted inherited cash:", error);
      return {
        inheritedCash: lastClosedShift.finalCash || "200.00",
        totalWithdrawals: 0
      };
    }
  }

  async createShiftSnapshot(snapshot: {
    shiftId: number;
    lastShiftId?: number;
    carryCash: string;
    carryCoins: string;
    carryProducts: any;
  }): Promise<ShiftSnapshot> {
    const [created] = await db
      .insert(shiftSnapshots)
      .values(snapshot)
      .returning();
    return created;
  }

  async getShiftSnapshot(shiftId: number): Promise<ShiftSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(shiftSnapshots)
      .where(eq(shiftSnapshots.shiftId, shiftId));
    return snapshot || undefined;
  }

  async getAllTransportModes(): Promise<TransportMode[]> {
    return await db.select().from(transportModes).orderBy(asc(transportModes.name));
  }

  async createTransportMode(mode: InsertTransportMode): Promise<TransportMode> {
    const [created] = await db.insert(transportModes).values(mode).returning();
    return created;
  }

  async updateTransportMode(id: number, updates: Partial<InsertTransportMode>): Promise<TransportMode | undefined> {
    const [updated] = await db.update(transportModes)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(transportModes.id, id))
      .returning();
    return updated || undefined;
  }

  async deleteTransportMode(id: number): Promise<boolean> {
    const result = await db.delete(transportModes).where(eq(transportModes.id, id));
    return (result.rowCount ?? 0) > 0;
  }
}

export const storage = new DatabaseStorage();