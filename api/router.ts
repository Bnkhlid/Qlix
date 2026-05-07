import { createRouter, publicQuery } from "./middleware";
import { contactsRouter } from "./routers/contacts";
import { messagesRouter } from "./routers/messages";
import { statsRouter } from "./routers/stats";
import { whatsappRouter } from "./routers/whatsapp";
import { autoRespondersRouter } from "./routers/autoResponders";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  contacts: contactsRouter,
  messages: messagesRouter,
  stats: statsRouter,
  whatsapp: whatsappRouter,
  autoResponders: autoRespondersRouter,
});

export type AppRouter = typeof appRouter;
