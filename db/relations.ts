import { relations } from "drizzle-orm";
import { messageBatches, messageRecipients, contacts, messageLogs } from "./schema";

export const messageBatchesRelations = relations(messageBatches, ({ many }) => ({
  recipients: many(messageRecipients),
  logs: many(messageLogs),
}));

export const messageRecipientsRelations = relations(messageRecipients, ({ one }) => ({
  batch: one(messageBatches, {
    fields: [messageRecipients.batchId],
    references: [messageBatches.id],
  }),
}));

export const contactsRelations = relations(contacts, ({ many }) => ({
  recipients: many(messageRecipients),
}));

export const messageLogsRelations = relations(messageLogs, ({ one }) => ({
  batch: one(messageBatches, {
    fields: [messageLogs.batchId],
    references: [messageBatches.id],
  }),
}));
