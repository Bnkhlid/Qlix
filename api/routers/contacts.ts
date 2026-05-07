import { z } from "zod";
import { eq, like, or, sql } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { contacts } from "@db/schema";

export const contactsRouter = createRouter({
  list: publicQuery.query(async () => {
    const db = getDb();
    const all = await db.select().from(contacts).orderBy(sql`created_at desc`);
    return all;
  }),

  search: publicQuery.input(z.object({ query: z.string() })).query(async ({ input }) => {
    const db = getDb();
    const results = await db
      .select()
      .from(contacts)
      .where(
        or(
          like(contacts.name, `%${input.query}%`),
          like(contacts.phone, `%${input.query}%`)
        )
      )
      .orderBy(sql`created_at desc`);
    return results;
  }),

  create: publicQuery
    .input(
      z.object({
        name: z.string().optional(),
        phone: z.string().min(1),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const result = await db.insert(contacts).values({
        name: input.name,
        phone: input.phone,
      }).returning({ id: contacts.id });
      return { id: result[0].id };
    }),

  update: publicQuery
    .input(
      z.object({
        id: z.number(),
        name: z.string().optional(),
        phone: z.string().optional(),
      })
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      await db
        .update(contacts)
        .set({ name: input.name, phone: input.phone })
        .where(eq(contacts.id, input.id));
      return { success: true };
    }),

  delete: publicQuery
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.delete(contacts).where(eq(contacts.id, input.id));
      return { success: true };
    }),

  import: publicQuery
    .input(
      z.array(
        z.object({
          name: z.string().optional(),
          phone: z.string().min(1),
        })
      )
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.length === 0) return { count: 0 };
      await db.insert(contacts).values(input);
      return { count: input.length };
    }),
});
