import { z } from "zod";
import { eq, sql, and, desc } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { messageBatches, messageRecipients, blockedNumbers } from "@db/schema";

export const messagesRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const batches = await db.select().from(messageBatches).orderBy(desc(messageBatches.createdAt));
    return batches;
  }),

  getById: publicQuery.input(z.object({ id: z.number() })).query(async ({ input }) => {
    const db = getDb();
    const batch = await db.select().from(messageBatches).where(eq(messageBatches.id, input.id)).limit(1);
    if (batch.length === 0) return null;
    const recipients = await db.select().from(messageRecipients).where(eq(messageRecipients.batchId, input.id));
    return { ...batch[0], recipients };
  }),

  create: publicQuery
    .input(
      z.object({
        name: z.string().optional(),
        content: z.string().min(1),
        type: z.enum(["individual", "group", "contacts"]),
        scheduledAt: z.string().optional(),
        delayMs: z.number().min(500).max(60000).default(2000),
        mediaUrls: z.array(z.string()).optional(),
        recipients: z.array(
          z.object({
            phone: z.string().min(1),
            name: z.string().optional(),
            contactId: z.number().optional(),
          })
        ),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      
      // Check for blocked numbers
      const blocked = await db.select().from(blockedNumbers);
      const blockedPhones = new Set(blocked.map((b) => b.phone));
      
      const batchResult = await db.insert(messageBatches).values({
        name: input.name,
        content: input.content,
        type: input.type,
        scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
        delayMs: input.delayMs,
        mediaUrl: input.mediaUrls && input.mediaUrls.length > 0 ? JSON.stringify(input.mediaUrls) : undefined,
        status: input.scheduledAt ? "scheduled" : "pending",
      }).returning({ id: messageBatches.id });
      
      const batchId = batchResult[0].id;
      
      const recipientValues = input.recipients.map((r) => ({
        batchId,
        contactId: r.contactId,
        phone: r.phone,
        name: r.name,
        status: blockedPhones.has(r.phone) ? ("blocked" as const) : ("pending" as const),
      }));
      
      if (recipientValues.length > 0) {
        await db.insert(messageRecipients).values(recipientValues);
      }
      
      return { id: batchId, recipientCount: recipientValues.length };
    }),

  getPending: publicQuery.query(async () => {
    const db = getDb();
    const now = new Date();
    const batches = await db
      .select()
      .from(messageBatches)
      .where(
        and(
          eq(messageBatches.status, "pending"),
          sql`${messageBatches.scheduledAt} IS NULL OR ${messageBatches.scheduledAt} <= ${now}`
        )
      )
      .orderBy(desc(messageBatches.createdAt));
    
    const result = [];
    for (const batch of batches) {
      const recipients = await db
        .select()
        .from(messageRecipients)
        .where(
          and(
            eq(messageRecipients.batchId, batch.id),
            eq(messageRecipients.status, "pending")
          )
        );
      if (recipients.length > 0) {
        result.push({ ...batch, recipients });
      }
    }
    return result;
  }),

  getScheduled: publicQuery.query(async () => {
    const db = getDb();
    const batches = await db
      .select()
      .from(messageBatches)
      .where(eq(messageBatches.status, "scheduled"))
      .orderBy(desc(messageBatches.createdAt));
    return batches;
  }),

  updateStatus: publicQuery
    .input(
      z.object({
        batchId: z.number(),
        status: z.enum(["pending", "scheduled", "sending", "completed", "failed", "paused"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(messageBatches)
        .set({ status: input.status })
        .where(eq(messageBatches.id, input.batchId));
      return { success: true };
    }),

  updateRecipientStatus: publicQuery
    .input(
      z.object({
        recipientId: z.number(),
        status: z.enum(["pending", "queued", "sent", "failed", "blocked"]),
        error: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(messageRecipients)
        .set({
          status: input.status,
          error: input.error,
          sentAt: input.status === "sent" ? new Date() : undefined,
        })
        .where(eq(messageRecipients.id, input.recipientId));
      return { success: true };
    }),

  getHistory: publicQuery.query(async () => {
    const db = getDb();
    const batches = await db
      .select()
      .from(messageBatches)
      .where(sql`${messageBatches.status} IN ('completed', 'failed')`)
      .orderBy(desc(messageBatches.createdAt))
      .limit(50);
    return batches;
  }),

  delete: publicQuery.input(z.object({ id: z.number() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(messageRecipients).where(eq(messageRecipients.batchId, input.id));
    await db.delete(messageBatches).where(eq(messageBatches.id, input.id));
    return { success: true };
  }),

  clearHistory: publicQuery.mutation(async () => {
    const db = getDb();
    const batchesToDelete = await db
      .select({ id: messageBatches.id })
      .from(messageBatches)
      .where(sql`${messageBatches.status} IN ('completed', 'failed')`);
      
    if (batchesToDelete.length > 0) {
      for (const b of batchesToDelete) {
        await db.delete(messageRecipients).where(eq(messageRecipients.batchId, b.id));
        await db.delete(messageBatches).where(eq(messageBatches.id, b.id));
      }
    }
    return { success: true };
  }),
});
