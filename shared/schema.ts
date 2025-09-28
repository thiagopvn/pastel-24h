import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";
import { relations, sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "employee"] }).notNull().default("employee"),
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
  stock: integer("stock").notNull().default(0),
  sortOrder: integer("sort_order").notNull().default(0),
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
  
  // Novos campos para lógica de caixa independente
  countedFinalCash: text("counted_final_cash"), // Valor total em notas contado no fechamento
  countedFinalCoins: text("counted_final_coins"), // Valor total em moedas contado no fechamento
  envelopeCash: text("envelope_cash"), // Valor em notas retirado para o envelope
  envelopeCoins: text("envelope_coins"), // Valor em moedas retirado para o envelope
  cashForNextShift: text("cash_for_next_shift"), // Valor em notas que fica para próximo turno
  coinsForNextShift: text("coins_for_next_shift"), // Valor em moedas que fica para próximo turno
  openingDiscrepancy: text("opening_discrepancy"), // Diferença entre esperado e informado na abertura
  
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const shiftCollaborators = sqliteTable("shift_collaborators", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  userId: integer("user_id").references(() => users.id).notNull(),
  hoursWorked: text("hours_worked").default("0.00"),
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

  // Valores reais (usados nos cálculos) - cash e pix já corretos
  cash: text("cash").default("0"),
  pix: text("pix").default("0"),
  stoneCard: text("stone_card").default("0"),
  stoneVoucher: text("stone_voucher").default("0"),
  pagBankCard: text("pagbank_card").default("0"),

  // Valores cumulativos das maquininhas (total mostrado na maquininha)
  stoneCardCumulative: text("stone_card_cumulative").default("0"),
  stoneVoucherCumulative: text("stone_voucher_cumulative").default("0"),
  pagBankCardCumulative: text("pagbank_card_cumulative").default("0"),

  // Flag para indicar cálculo automático
  calculatedFromCumulative: integer("calculated_from_cumulative", { mode: "boolean" }).default(false),
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

export const collaboratorConsumptions = sqliteTable("collaborator_consumptions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").references(() => shifts.id).notNull(),
  collaboratorUserId: integer("collaborator_user_id").references(() => users.id).notNull(),
  productId: integer("product_id").references(() => products.id).notNull(),
  quantity: integer("quantity").notNull().default(1),
  priceSnapshot: text("price_snapshot").notNull(), // Preço no momento do consumo
  createdAt: integer("created_at", { mode: "timestamp_ms" }).default(new Date()),
});

export const corrections = sqliteTable("corrections", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  shiftId: integer("shift_id").notNull().references(() => shifts.id),
  createdByUserId: integer("created_by_user_id").notNull().references(() => users.id),
  correctionType: text("correction_type", { enum: ["product_qty", "product_price", "payment", "cash_count"] }).notNull(),
  
  // Para correções de produtos
  shiftRecordId: integer("shift_record_id").references(() => shiftRecords.id),
  productId: integer("product_id").references(() => products.id),
  fieldName: text("field_name"), // "entryQty", "soldQty", "leftoverQty", etc.
  
  // Para correções de pagamentos
  paymentMethod: text("payment_method"), // "cash", "pix", "stoneCard", etc.
  
  // Para correções de contagem de caixa
  cashType: text("cash_type"), // "countedFinalCash", "countedFinalCoins", "envelopeCash", etc.
  
  // Valores da correção
  originalValue: text("original_value").notNull(),
  correctedValue: text("corrected_value").notNull(),
  
  // Metadados
  reason: text("reason").notNull(),
  evidenceUrl: text("evidence_url"),
  appliedAt: integer("applied_at", { mode: "timestamp_ms" }).default(new Date()),
  
  // Para soft delete/revogação
  revokedAt: integer("revoked_at", { mode: "timestamp_ms" }),
  revokedByUserId: integer("revoked_by_user_id").references(() => users.id),
  revokeReason: text("revoke_reason"),
});

export const usersRelations = relations(users, ({ many, one }) => ({
  shifts: many(shifts),
  shiftCollaborations: many(shiftCollaborators),
  collaboratorConsumptions: many(collaboratorConsumptions),
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
  collaboratorConsumptions: many(collaboratorConsumptions),
  records: many(shiftRecords),
  payments: one(shiftPayments),
}));

export const shiftCollaboratorsRelations = relations(shiftCollaborators, ({ one }) => ({
  shift: one(shifts, { fields: [shiftCollaborators.shiftId], references: [shifts.id] }),
  user: one(users, { fields: [shiftCollaborators.userId], references: [users.id] }),
}));

export const productsRelations = relations(products, ({ many }) => ({
  records: many(shiftRecords),
  collaboratorConsumptions: many(collaboratorConsumptions),
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

export const collaboratorConsumptionsRelations = relations(collaboratorConsumptions, ({ one }) => ({
  shift: one(shifts, { fields: [collaboratorConsumptions.shiftId], references: [shifts.id] }),
  collaborator: one(users, { fields: [collaboratorConsumptions.collaboratorUserId], references: [users.id] }),
  product: one(products, { fields: [collaboratorConsumptions.productId], references: [products.id] }),
}));

export const correctionsRelations = relations(corrections, ({ one }) => ({
  shift: one(shifts, { fields: [corrections.shiftId], references: [shifts.id] }),
  createdByUser: one(users, { fields: [corrections.createdByUserId], references: [users.id] }),
  revokedByUser: one(users, { fields: [corrections.revokedByUserId], references: [users.id] }),
  shiftRecord: one(shiftRecords, { fields: [corrections.shiftRecordId], references: [shiftRecords.id] }),
  product: one(products, { fields: [corrections.productId], references: [products.id] }),
}));

export const cashAdjustmentsRelations = relations(cashAdjustments, ({ one }) => ({
  user: one(users, { fields: [cashAdjustments.userId], references: [users.id] }),
  shift: one(shifts, { fields: [cashAdjustments.shiftId], references: [shifts.id] }),
}));

export const insertCorrectionSchema = createInsertSchema(corrections).pick({
  shiftId: true,
  correctionType: true,
  shiftRecordId: true,
  productId: true,
  fieldName: true,
  paymentMethod: true,
  cashType: true,
  originalValue: true,
  correctedValue: true,
  reason: true,
  evidenceUrl: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  email: true,
  password: true,
  name: true,
  role: true,
  transportType: true,
  transportModeId: true,
}).extend({
  email: z.string().email("Email deve ter um formato válido"),
  password: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  role: z.enum(["admin", "employee"], { errorMap: () => ({ message: "Papel deve ser 'admin' ou 'employee'" }) }),
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
  sortOrder: true,
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

export const insertCollaboratorConsumptionSchema = createInsertSchema(collaboratorConsumptions).pick({
  shiftId: true,
  collaboratorUserId: true,
  productId: true,
  quantity: true,
  priceSnapshot: true,
}).extend({
  shiftId: z.number().int().positive("ID do turno deve ser um número inteiro positivo"),
  collaboratorUserId: z.number().int().positive("ID do colaborador deve ser um número inteiro positivo"),
  productId: z.number().int().positive("ID do produto deve ser um número inteiro positivo"),
  quantity: z.number().int().positive("Quantidade deve ser um número inteiro positivo"),
  priceSnapshot: z.string().min(1, "Preço é obrigatório"),
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
export type Correction = typeof corrections.$inferSelect;
export type InsertCorrection = z.infer<typeof insertCorrectionSchema>;
export type CollaboratorConsumption = typeof collaboratorConsumptions.$inferSelect;

// Tabela para ajustes de consumo no relatório semanal
export const weeklyReportConsumptionAdjustments = sqliteTable('weekly_report_consumption_adjustments', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  reportId: integer('report_id').notNull().references(() => weeklyReports.id),
  userId: integer('user_id').notNull().references(() => users.id),
  productId: integer('product_id').notNull().references(() => products.id),
  adjustmentType: text('adjustment_type', { enum: ['include', 'exclude'] }).notNull(),
  reason: text('reason'),
  adjustedByUserId: integer('adjusted_by_user_id').notNull().references(() => users.id),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull().default(sql`CURRENT_TIMESTAMP`),
});

export const insertWeeklyReportConsumptionAdjustmentSchema = createInsertSchema(weeklyReportConsumptionAdjustments);
export type WeeklyReportConsumptionAdjustment = typeof weeklyReportConsumptionAdjustments.$inferSelect;
export type InsertWeeklyReportConsumptionAdjustment = z.infer<typeof insertWeeklyReportConsumptionAdjustmentSchema>;
export type InsertCollaboratorConsumption = z.infer<typeof insertCollaboratorConsumptionSchema>;