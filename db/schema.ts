import { sqliteTable, integer, text } from "drizzle-orm/sqlite-core";

export const contacts = sqliteTable("contacts", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  phone: text("phone").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const messageBatches = sqliteTable("message_batches", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name"),
  content: text("content").notNull(),
  type: text("type", { enum: ["individual", "group", "contacts"] }).notNull().default("individual"),
  status: text("status", { enum: ["pending", "scheduled", "sending", "completed", "failed", "paused"] }).notNull().default("pending"),
  scheduledAt: integer("scheduled_at", { mode: "timestamp" }),
  delayMs: integer("delay_ms").notNull().default(2000),
  mediaUrl: text("media_url"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const messageRecipients = sqliteTable("message_recipients", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull(),
  contactId: integer("contact_id"),
  phone: text("phone").notNull(),
  name: text("name"),
  status: text("status", { enum: ["pending", "queued", "sent", "failed", "blocked"] }).notNull().default("pending"),
  error: text("error"),
  sentAt: integer("sent_at", { mode: "timestamp" }),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const blockedNumbers = sqliteTable("blocked_numbers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone").notNull(),
  reason: text("reason"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const messageLogs = sqliteTable("message_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  batchId: integer("batch_id").notNull(),
  recipientId: integer("recipient_id"),
  action: text("action").notNull(),
  details: text("details"),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const whatsappSessions = sqliteTable("whatsapp_sessions", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phone: text("phone"),
  status: text("status", { enum: ["connected", "disconnected", "connecting"] }).notNull().default("disconnected"),
  lastActive: integer("last_active", { mode: "timestamp" }).$defaultFn(() => new Date()),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});

export const autoResponders = sqliteTable("auto_responders", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  keyword: text("keyword").notNull(),
  matchType: text("match_type", { enum: ["exact", "contains"] }).notNull().default("exact"),
  response: text("response").notNull(),
  mediaUrls: text("media_urls"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: integer("created_at", { mode: "timestamp" }).$defaultFn(() => new Date()).notNull(),
});
