import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { whatsappSessions, blockedNumbers } from "@db/schema";
import { whatsappService } from "../lib/whatsappClient";

export const whatsappRouter = createRouter({
  getSession: publicQuery.query(async () => {
    return {
      status: whatsappService.status,
      phone: whatsappService.client?.info?.wid?.user,
    };
  }),

  getQrCode: publicQuery.query(async () => {
    return { qrUrl: whatsappService.qrUrl };
  }),

  updateSession: publicQuery
    .input(
      z.object({
        phone: z.string().optional(),
        status: z.enum(["connected", "disconnected", "connecting"]),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const sessions = await db.select().from(whatsappSessions).orderBy(desc(whatsappSessions.createdAt)).limit(1);
      if (sessions.length > 0) {
        await db
          .update(whatsappSessions)
          .set({
            phone: input.phone ?? sessions[0].phone,
            status: input.status,
            lastActive: new Date(),
          })
          .where(eq(whatsappSessions.id, sessions[0].id));
        return { success: true };
      } else {
        await db.insert(whatsappSessions).values({
          phone: input.phone,
          status: input.status,
          lastActive: new Date(),
        });
        return { success: true };
      }
    }),

  blockNumber: publicQuery
    .input(z.object({ phone: z.string().min(1), reason: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(blockedNumbers).values({ phone: input.phone, reason: input.reason });
      return { success: true };
    }),

  unblockNumber: publicQuery.input(z.object({ phone: z.string().min(1) })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(blockedNumbers).where(eq(blockedNumbers.phone, input.phone));
    return { success: true };
  }),

  getBlockedNumbers: publicQuery.query(async () => {
    const db = getDb();
    const blocked = await db.select().from(blockedNumbers).orderBy(desc(blockedNumbers.createdAt));
    return blocked;
  }),

  logout: publicQuery.mutation(async () => {
    await whatsappService.logout();
    return { success: true };
  }),
});
