import { sql } from "drizzle-orm";
import { createRouter, publicQuery } from "../middleware";
import { getDb } from "../queries/connection";
import { messageBatches, messageRecipients, contacts, blockedNumbers } from "@db/schema";

export const statsRouter = createRouter({
  getDashboard: publicQuery.query(async () => {
    const db = getDb();
    
    const blockedCount = await db.select({ count: sql<number>`count(*)` }).from(blockedNumbers);
    const scheduledCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(messageBatches)
      .where(sql`${messageBatches.status} = 'scheduled'`);
    const sentCount = await db
      .select({ count: sql<number>`count(*)` })
      .from(messageRecipients)
      .where(sql`${messageRecipients.status} = 'sent'`);
    const contactsCount = await db.select({ count: sql<number>`count(*)` }).from(contacts);
    
    return {
      blocked: blockedCount[0]?.count ?? 0,
      scheduled: scheduledCount[0]?.count ?? 0,
      sent: sentCount[0]?.count ?? 0,
      contacts: contactsCount[0]?.count ?? 0,
    };
  }),

  getAnalytics: publicQuery.query(async () => {
    const db = getDb();

    // Daily message counts for the last 14 days
    const dailyRaw = await db.all(sql`
      SELECT 
        date(sent_at, 'unixepoch') as day,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
      FROM message_recipients
      WHERE sent_at IS NOT NULL
        AND sent_at >= unixepoch('now', '-14 days')
      GROUP BY day
      ORDER BY day ASC
    `);

    // Overall status breakdown
    const statusRaw = await db.all(sql`
      SELECT status, COUNT(*) as count
      FROM message_recipients
      GROUP BY status
    `);

    // Hourly distribution (all time)
    const hourlyRaw = await db.all(sql`
      SELECT 
        CAST(strftime('%H', sent_at, 'unixepoch') AS INTEGER) as hour,
        COUNT(*) as count
      FROM message_recipients
      WHERE sent_at IS NOT NULL AND status = 'sent'
      GROUP BY hour
      ORDER BY hour ASC
    `);

    // Monthly contacts growth (last 6 months)
    const contactGrowthRaw = await db.all(sql`
      SELECT 
        strftime('%Y-%m', created_at, 'unixepoch') as month,
        COUNT(*) as count
      FROM contacts
      GROUP BY month
      ORDER BY month ASC
      LIMIT 6
    `);

    // Total stats
    const totalSent = await db.get(sql`SELECT COUNT(*) as c FROM message_recipients WHERE status = 'sent'`) as any;
    const totalFailed = await db.get(sql`SELECT COUNT(*) as c FROM message_recipients WHERE status = 'failed'`) as any;
    const totalBatches = await db.get(sql`SELECT COUNT(*) as c FROM message_batches`) as any;
    const autoResponderCount = await db.get(sql`SELECT COUNT(*) as c FROM auto_responders WHERE is_active = 1`) as any;

    return {
      daily: dailyRaw as { day: string; total: number; sent: number; failed: number }[],
      statusBreakdown: statusRaw as { status: string; count: number }[],
      hourly: hourlyRaw as { hour: number; count: number }[],
      contactGrowth: contactGrowthRaw as { month: string; count: number }[],
      totals: {
        sent: totalSent?.c ?? 0,
        failed: totalFailed?.c ?? 0,
        batches: totalBatches?.c ?? 0,
        activeAutoResponders: autoResponderCount?.c ?? 0,
        successRate: totalSent?.c > 0 
          ? Math.round((totalSent.c / (totalSent.c + (totalFailed?.c ?? 0))) * 100) 
          : 0,
      },
    };
  }),
});
