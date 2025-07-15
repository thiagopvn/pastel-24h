import { pgTable, text, serial, integer, boolean, timestamp, decimal, json } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role").notNull().default("employee"),
  transportType: text("transport_type"),
  transportModeId: integer("transport_mode_id").references(() => transportModes.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const transportModes = pgTable("transport_modes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  roundTripPrice: decimal("round_trip_price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  category: text("category").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  minStock: integer("min_stock").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shifts = pgTable("shifts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  initialCash: decimal("initial_cash", { precision: 10, scale: 2 }).notNull(),
  initialCoins: decimal("initial_coins", { precision: 10, scale: 2 }).default("0"),
  finalCash: decimal("final_cash", { precision: 10, scale: 2 }),
  finalCoins: decimal("final_coins", { precision: 10, scale: 2 }),
  gasExchange: boolean("gas_exchange").default(false),
  notes: text("notes"),
  cashDivergence: decimal("cash_divergence", { precision: 10, scale: 2 }),
  closedBy: integer("closed_by").references(() => users.id),
  totalSales: decimal("total_sales", { precision: 10, scale: 2 }),
  status: text("status").notNull().default("open"),
  expectedCash: decimal("expected_cash", { precision: 10, scale: 2 }),
  countedCash: decimal("counted_cash", { precision: 10, scale: 2 }),
  countedCoins: decimal("counted_coins", { precision: 10, scale: 2 }),
  inheritedFromShiftId: integer("inherited_from_shift_id"),
  tempFinalCash: decimal("temp_final_cash", { precision: 10, scale: 2 }),
  tempFinalCoins: decimal("temp_final_coins", { precision: 10, scale: 2 }),
  tempGasExchange: boolean("temp_gas_exchange").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shiftCollaborators = pgTable("shift_collaborators", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

export const shiftRecords = pgTable("shift_records", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  entryQty: integer("entry_qty").default(0),
  arrivalQty: integer("arrival_qty").default(0),
  leftoverQty: integer("leftover_qty").default(0),
  discardQty: integer("discard_qty").default(0),
  consumedQty: integer("consumed_qty").default(0),
  soldQty: integer("sold_qty").default(0),
  priceSnapshot: decimal("price_snapshot", { precision: 10, scale: 2 }).notNull(),
  itemTotal: decimal("item_total", { precision: 10, scale: 2 }).notNull(),
});

export const shiftPayments = pgTable("shift_payments", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  cash: decimal("cash", { precision: 10, scale: 2 }).default("0"),
  pix: decimal("pix", { precision: 10, scale: 2 }).default("0"),
  stoneCard: decimal("stone_card", { precision: 10, scale: 2 }).default("0"),
  stoneVoucher: decimal("stone_voucher", { precision: 10, scale: 2 }).default("0"),
  pagBankCard: decimal("pagbank_card", { precision: 10, scale: 2 }).default("0"),
});

export const weeklyReports = pgTable("weekly_reports", {
  id: serial("id").primaryKey(),
  weekStart: timestamp("week_start").notNull(),
  weekEnd: timestamp("week_end").notNull(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull(),
  foodBenefit: decimal("food_benefit", { precision: 10, scale: 2 }).default("0"),
  consumptionDiscount: integer("consumption_discount").default(50),
  transportRates: json("transport_rates").$type<{
    bus: number;
    van: number;
    app: number;
  }>(),
  employeeData: json("employee_data").$type<Array<{
    userId: number;
    hours: number;
    transport: number;
    food: number;
    consumption: number;
    bonus: number;
    deduction: number;
    total: number;
  }>>(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const config = pgTable("config", {
  id: serial("id").primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const paymentConfig = pgTable("payment_config", {
  id: serial("id").primaryKey(),
  pixRate: decimal("pix_rate", { precision: 5, scale: 2 }).notNull().default("0.00"),
  stoneCardRate: decimal("stone_card_rate", { precision: 5, scale: 2 }).notNull().default("3.50"),
  stoneVoucherRate: decimal("stone_voucher_rate", { precision: 5, scale: 2 }).notNull().default("2.50"),
  pagBankCardRate: decimal("pagbank_card_rate", { precision: 5, scale: 2 }).notNull().default("3.20"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const payrollConfig = pgTable("payroll_config", {
  id: serial("id").primaryKey(),
  hourlyRate: decimal("hourly_rate", { precision: 10, scale: 2 }).notNull().default("12.50"),
  foodBenefit: decimal("food_benefit", { precision: 10, scale: 2 }).notNull().default("25.00"),
  consumptionDiscount: integer("consumption_discount").notNull().default(50),
  transportRates: json("transport_rates").$type<{
    bus: number;
    van: number;
    app: number;
  }>().notNull().default({ bus: 8.80, van: 12.00, app: 15.00 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const timeline = pgTable("timeline", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  action: text("action").notNull(),
  description: text("description").notNull(),
  metadata: json("metadata"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shiftSignatures = pgTable("shift_signatures", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  signedAt: timestamp("signed_at").notNull(),
  ipAddress: text("ip_address"),
});

export const cashAdjustments = pgTable("cash_adjustments", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").references(() => shifts.id),
  userId: integer("user_id").references(() => users.id).notNull(),
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason").notNull(),
  beforeAmount: decimal("before_amount", { precision: 10, scale: 2 }).notNull(),
  afterAmount: decimal("after_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const shiftSnapshots = pgTable("shift_snapshots", {
  id: serial("id").primaryKey(),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  lastShiftId: integer("last_shift_id"),
  carryCash: decimal("carry_cash", { precision: 10, scale: 2 }).notNull(),
  carryCoins: decimal("carry_coins", { precision: 10, scale: 2 }).notNull(),
  carryProducts: json("carry_products"),
  createdAt: timestamp("created_at").defaultNow(),
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