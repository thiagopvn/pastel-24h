import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("employee"),
  transportType: text("transport_type"),
  transportModeId: integer("transport_mode_id").references(() => transportModes.id),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const transportModes = sqliteTable("transport_modes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull().unique(),
  roundTripPrice: text("round_trip_price").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const products = sqliteTable("products", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: text("price").notNull(),
  minStock: integer("min_stock").default(0),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const shifts = sqliteTable("shifts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id).notNull(),
  startTime: integer("start_time", { mode: "timestamp_ms" }).notNull(),
  endTime: integer("end_time", { mode: "timestamp_ms" }),
  initialCash: text("initial_cash").notNull(),
  initialCoins: text("initial_coins").default("0"),
  finalCash: text("final_cash"),
  finalCoins: text("final_coins"),
  gasExchange: integer("gas_exchange", { mode: "boolean" }).default(false),
  notes: text("notes"),
  cashDivergence: text("cash_divergence"),
  closedBy: integer("closed_by").references(() => users.id),
  totalSales: text("total_sales"),
  status: text("status").notNull().default("open"),
  expectedCash: text("expected_cash"),
  countedCash: text("counted_cash"),
  countedCoins: text("counted_coins"),
  inheritedFromShiftId: integer("inherited_from_shift_id"),
  tempFinalCash: text("temp_final_cash"),
  tempFinalCoins: text("temp_final_coins"),
  tempGasExchange: integer("temp_gas_exchange", { mode: "boolean" }).default(false),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const shiftCollaborators = sqliteTable("shift_collaborators", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  addedAt: integer("added_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const shiftRecords = sqliteTable("shift_records", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  entryQty: integer("entry_qty").default(0),
  arrivalQty: integer("arrival_qty").default(0),
  leftoverQty: integer("leftover_qty").default(0),
  discardQty: integer("discard_qty").default(0),
  consumedQty: integer("consumed_qty").default(0),
  soldQty: integer("sold_qty").default(0),
  priceSnapshot: text("price_snapshot").notNull(),
  itemTotal: text("item_total").notNull(),
});

export const shiftPayments = sqliteTable("shift_payments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  cash: text("cash").default("0"),
  pix: text("pix").default("0"),
  stoneCard: text("stone_card").default("0"),
  stoneVoucher: text("stone_voucher").default("0"),
  pagBankCard: text("pagbank_card").default("0"),
});

export const weeklyReports = sqliteTable("weekly_reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  weekStart: integer("week_start", { mode: "timestamp_ms" }).notNull(),
  weekEnd: integer("week_end", { mode: "timestamp_ms" }).notNull(),
  hourlyRate: text("hourly_rate").notNull(),
  foodBenefit: text("food_benefit").default("0"),
  consumptionDiscount: integer("consumption_discount").default(50),
  transportRates: text("transport_rates", { mode: "json" }).$type<{
    bus: number;
    van: number;
    app: number;
  }>(),
  employeeData: text("employee_data", { mode: "json" }).$type<
    Array<{
    userId: number;
    name: string;
    hours: number;
    transport: number;
    food: number;
    consumption: number;
    bonus: number;
    deduction: number;
    total: number;
    daysWorked: number;
    shiftsCount: number;
    transportType?: string;
  }>
>(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const config = sqliteTable("config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const paymentConfig = sqliteTable("payment_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  pixRate: text("pix_rate").notNull().default("0.00"),
  stoneCardRate: text("stone_card_rate").notNull().default("3.50"),
  stoneVoucherRate: text("stone_voucher_rate").notNull().default("2.50"),
  pagBankCardRate: text("pagbank_card_rate").notNull().default("3.20"),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const payrollConfig = sqliteTable("payroll_config", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  hourlyRate: text("hourly_rate").notNull().default("12.50"),
  foodBenefit: text("food_benefit").notNull().default("25.00"),
  consumptionDiscount: integer("consumption_discount").notNull().default(50),
  transportRates: text("transport_rates", { mode: "json" }).$type<{
    bus: number;
    van: number;
    app: number;
  }>().notNull().default({ bus: 8.80, van: 12.00, app: 15.00 }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const timeline = sqliteTable("timeline", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  description: text("description").notNull(),
  metadata: text("metadata", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const shiftSignatures = sqliteTable("shift_signatures", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  signedAt: integer("signed_at", { mode: "timestamp_ms" }).notNull(),
  ipAddress: text("ip_address"),
});

export const cashAdjustments = sqliteTable("cash_adjustments", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  amount: text("amount").notNull(),
  reason: text("reason").notNull(),
  beforeAmount: text("before_amount").notNull(),
  afterAmount: text("after_amount").notNull(),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const shiftSnapshots = sqliteTable("shift_snapshots", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  lastShiftId: integer("last_shift_id"),
  carryCash: text("carry_cash").notNull(),
  carryCoins: text("carry_coins").notNull(),
  carryProducts: text("carry_products", { mode: "json" }),
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  shifts: many(shifts),
  shiftCollaborations: many(shiftCollaborators),
  timelineEntries: many(timeline),
  transportMode: one(transportModes, { fields: [users.transportModeId], references: [transportModes.id] }),
}));

export const transportModesRelations = relations(transportModes, ({ many }) => ({
  users: many(users),
}));

export const shiftsRelations = relations(shifts, ({ one, many }) => ({
  user: one(users, { fields: [shifts.userId], references: [users.id] }),
  closedByUser: one(users, { fields: [shifts.closedBy], references: [users.id] }),
  collaborators: many(shiftCollaborators),
  records: many(shiftRecords),
  payments: one(shiftPayments),
}));

export const shiftCollaboratorsRelations = relations(shiftCollaborators, ({ one }) => ({
  shift: one(shifts, { fields: [shiftCollaborators.shiftId], references: [shifts.id] }),
  user: one(users, { fields: [shiftCollaborators.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  records: many(shiftRecords),
}));

export const shiftRecordsRelations = relations(shiftRecords, ({ one }) => ({
  shift: one(shifts, { fields: [shiftRecords.shiftId], references: [shifts.id] }),
  product: one(products, { fields: [shiftRecords.productId], references: [products.id] }),
}));

export const shiftPaymentsRelations = relations(shiftPayments, ({ one }) => ({
  shift: one(shifts, { fields: [shiftPayments.shiftId], references: [shifts.id] }),
}));

export const timelineRelations = relations(timeline, ({ one }) => ({
  user: one(users, { fields: [timeline.userId], references: [users.id] }),
}));

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
  transportType: true,
  transportModeId: true,
});

export const insertTransportModeSchema = createInsertSchema(transportModes).pick({
  name: true,
  roundTripPrice: true,
});

export const insertProductSchema = createInsertSchema(products).pick({
  name: true,
  category: true,
  price: true,
  minStock: true,
});

export const insertShiftSchema = createInsertSchema(shifts).pick({
  initialCash: true,
  initialCoins: true,
  gasExchange: true,
  notes: true,
});

export const insertShiftRecordSchema = createInsertSchema(shiftRecords).pick({
  productId: true,
  entryQty: true,
  arrivalQty: true,
  leftoverQty: true,
  discardQty: true,
  consumedQty: true,
});

export const insertShiftPaymentSchema = createInsertSchema(shiftPayments).pick({
  cash: true,
  pix: true,
  stoneCard: true,
  stoneVoucher: true,
  pagBankCard: true,
});

export const insertPaymentConfigSchema = createInsertSchema(paymentConfig).pick({
  pixRate: true,
  stoneCardRate: true,
  stoneVoucherRate: true,
  pagBankCardRate: true,
});

export const insertPayrollConfigSchema = createInsertSchema(payrollConfig).pick({
  hourlyRate: true,
  foodBenefit: true,
  consumptionDiscount: true,
  transportRates: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type TransportMode = typeof transportModes.$inferSelect;
export type InsertTransportMode = z.infer<typeof insertTransportModeSchema>;
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type Shift = typeof shifts.$inferSelect;
export type InsertShift = z.infer<typeof insertShiftSchema>;
export type ShiftRecord = typeof shiftRecords.$inferSelect;
export type InsertShiftRecord = z.infer<typeof insertShiftRecordSchema>;
export type ShiftPayment = typeof shiftPayments.$inferSelect;
export type InsertShiftPayment = z.infer<typeof insertShiftPaymentSchema>;
export type PaymentConfig = typeof paymentConfig.$inferSelect;
export type InsertPaymentConfig = z.infer<typeof insertPaymentConfigSchema>;
export type PayrollConfig = typeof payrollConfig.$inferSelect;
export type InsertPayrollConfig = z.infer<typeof insertPayrollConfigSchema>;
export type WeeklyReport = typeof weeklyReports.$inferSelect;
export type Timeline = typeof timeline.$inferSelect;
export type ShiftSignature = typeof shiftSignatures.$inferSelect;
export type CashAdjustment = typeof cashAdjustments.$inferSelect;
export type ShiftSnapshot = typeof shiftSnapshots.$inferSelect;