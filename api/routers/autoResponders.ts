import { z } from "zod";
import { createRouter, publicQuery } from "../middleware";
import { autoResponders } from "@db/schema";
import { getDb } from "../queries/connection";
import { eq, sql } from "drizzle-orm";

export const autoRespondersRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(autoResponders).orderBy(sql`created_at desc`);
    return all.map(r => ({
      ...r,
      mediaUrls: r.mediaUrls ? JSON.parse(r.mediaUrls) : []
    }));
  }),

  create: publicQuery
    .input(
      z.object({
        keyword: z.string().min(1),
        matchType: z.enum(["exact", "contains"]),
        response: z.string().min(1),
        mediaUrls: z.array(z.string()).optional(),
        isActive: z.boolean().default(true),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.insert(autoResponders).values({
        keyword: input.keyword,
        matchType: input.matchType,
        response: input.response,
        mediaUrls: input.mediaUrls && input.mediaUrls.length > 0 ? JSON.stringify(input.mediaUrls) : null,
        isActive: input.isActive,
      });
      return { success: true };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        keyword: z.string().min(1),
        matchType: z.enum(["exact", "contains"]),
        response: z.string().min(1),
        mediaUrls: z.array(z.string()).optional(),
        isActive: z.boolean(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(autoResponders)
        .set({
          keyword: input.keyword,
          matchType: input.matchType,
          response: input.response,
          mediaUrls: input.mediaUrls && input.mediaUrls.length > 0 ? JSON.stringify(input.mediaUrls) : null,
          isActive: input.isActive,
        })
        .where(eq(autoResponders.id, input.id));
      return { success: true };
    }),

  toggle: publicQuery
    .input(z.object({ id: z.number(), isActive: z.boolean() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(autoResponders).set({ isActive: input.isActive }).where(eq(autoResponders.id, input.id));
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(autoResponders).where(eq(autoResponders.id, input.id));
      return { success: true };
    }),
});
