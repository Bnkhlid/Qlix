import pkg from "whatsapp-web.js";
const { Client, LocalAuth, MessageMedia } = pkg;
import qrcode from "qrcode";
import { getDb } from "../queries/connection";
import { whatsappSessions, messageBatches, messageRecipients, autoResponders } from "@db/schema";
import { eq, and, or, isNull, lte } from "drizzle-orm";
import fs from "fs";

class WhatsAppService {
  client!: InstanceType<typeof Client>;
  qrUrl: string | null = null;
  status: "disconnected" | "connecting" | "connected" = "disconnected";
  isResetting = false;

  constructor() {
    this.initializeClient();
  }

  initializeClient() {
    this.client = new Client({
      authStrategy: new LocalAuth({ dataPath: "./.wwebjs_auth" }),
      puppeteer: {
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      },
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
    });

    this.setupListeners();
    this.client.initialize().catch(async (err: any) => {
      console.error("Failed to initialize WhatsApp client:", err.message);
      this.status = "disconnected";
      try {
        await this.client.destroy();
      } catch (e) {}
    });
    this.status = "connecting";
  }

  setupListeners() {
    this.client.on("qr", async (qr: string) => {
      this.status = "connecting";
      try {
        this.qrUrl = await qrcode.toDataURL(qr);
      } catch (e) {
        console.error("Failed to generate QR code", e);
      }
    });

    this.client.on("ready", async () => {
      this.status = "connected";
      this.qrUrl = null;
      console.log("WhatsApp Client is ready!");
      await this.updateDbStatus("connected");
    });

    this.client.on("authenticated", () => {
      this.status = "connecting";
    });

    this.client.on("auth_failure", async (msg) => {
      console.error("Auth failure:", msg);
      this.status = "disconnected";
      await this.updateDbStatus("disconnected");
      this.resetClient(true);
    });

    this.client.on("disconnected", async (reason) => {
      console.log("Client disconnected:", reason);
      this.status = "disconnected";
      this.qrUrl = null;
      await this.updateDbStatus("disconnected");
      
      // Only clear auth if the user explicitly unlinked their device
      const shouldClearAuth = ["NAVIGATION", "LOGOUT", "UNPAIRED"].includes(String(reason));
      
      setTimeout(() => {
        this.resetClient(shouldClearAuth);
      }, 5000);
    });

    this.client.on("message", async (msg: any) => {
      if (this.status !== "connected") return;
      if (typeof msg.body !== "string") return;
      try {
        const db = getDb();
        const activeResponders = await db.select().from(autoResponders).where(eq(autoResponders.isActive, true));
        
        for (const responder of activeResponders) {
          const body = msg.body.toLowerCase();
          const keyword = responder.keyword.toLowerCase();
          
          let isMatch = false;
          if (responder.matchType === "exact" && body === keyword) {
            isMatch = true;
          } else if (responder.matchType === "contains" && body.includes(keyword)) {
            isMatch = true;
          }

          if (isMatch) {
            let mediaArray: string[] = [];
            if (responder.mediaUrls) {
              try { mediaArray = JSON.parse(responder.mediaUrls); } catch(e) {}
            }
            
            // Send directly using msg.reply to ensure accurate routing
            if (mediaArray && mediaArray.length > 0) {
              for (let i = 0; i < mediaArray.length; i++) {
                const mediaData = mediaArray[i];
                try {
                  const mimeType = mediaData.split(";")[0].split(":")[1];
                  const base64Data = mediaData.split(",")[1];
                  if (!mimeType || !base64Data) continue;
                  
                  const media = new MessageMedia(mimeType, base64Data, `media-${i}`);
                  if (i === 0 && responder.response.trim()) {
                    await msg.reply(media, undefined, { caption: responder.response });
                  } else {
                    await msg.reply(media);
                  }
                } catch(e) {
                  console.error("Auto-responder media error", e);
                  if (i === 0) await msg.reply(responder.response);
                }
              }
            } else {
               await msg.reply(responder.response);
            }
            break;
          }
        }
      } catch (e) {
        console.error("Error in auto-responder", e);
      }
    });

    // Start background polling for pending messages
    setInterval(() => this.pollPendingMessages(), 10000);
  }

  async pollPendingMessages() {
    if (this.status !== "connected") return;
    
    try {
      const db = getDb();
      const now = new Date();
      
      const batches = await db
        .select()
        .from(messageBatches)
        .where(
          and(
            eq(messageBatches.status, "pending"),
            or(isNull(messageBatches.scheduledAt), lte(messageBatches.scheduledAt, now))
          )
        );

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

        if (recipients.length === 0) {
           await db.update(messageBatches).set({ status: "completed" }).where(eq(messageBatches.id, batch.id));
           continue;
        }

        await db.update(messageBatches).set({ status: "sending" }).where(eq(messageBatches.id, batch.id));

        let mediaArray: string[] = [];
        if (batch.mediaUrl) {
          try {
            mediaArray = JSON.parse(batch.mediaUrl);
          } catch(e) {}
        }

        let failed = 0;
        for (const recipient of recipients) {
          try {
            const personalizedMessage = batch.content
              .replace(/{name}/g, recipient.name || "")
              .replace(/{phone}/g, recipient.phone || "");

            await this.sendDirectMessage(recipient.phone, personalizedMessage, mediaArray);
            await db.update(messageRecipients).set({ status: "sent", sentAt: new Date() }).where(eq(messageRecipients.id, recipient.id));
          } catch (e: any) {
            await db.update(messageRecipients).set({ status: "failed", error: e.message }).where(eq(messageRecipients.id, recipient.id));
            failed++;
          }
          
          if (batch.delayMs > 0) {
            await new Promise((r) => setTimeout(r, batch.delayMs));
          }
        }
        
        const finalStatus = failed === recipients.length ? "failed" : "completed";
        await db.update(messageBatches).set({ status: finalStatus }).where(eq(messageBatches.id, batch.id));
      }
    } catch(e) {
      console.error("Polling error", e);
    }
  }

  async updateDbStatus(newStatus: "connected" | "disconnected" | "connecting") {
    try {
      const db = getDb();
      const existing = await db.select().from(whatsappSessions).limit(1);
      
      const phoneStr = this.client.info?.wid?.user || null;

      if (existing.length === 0) {
        await db.insert(whatsappSessions).values({ 
          status: newStatus,
          phone: phoneStr
        });
      } else {
        await db.update(whatsappSessions)
          .set({ 
            status: newStatus, 
            lastActive: new Date(),
            phone: phoneStr || existing[0].phone
          })
          .where(eq(whatsappSessions.id, existing[0].id));
      }
    } catch (e) {
      console.error("Failed to update session in DB", e);
    }
  }

  async sendDirectMessage(phone: string, message: string, mediaArray: string[] = []) {
    if (this.status !== "connected") {
      throw new Error("WhatsApp is not connected");
    }
    
    let formatted = phone;
    if (!formatted.includes("@")) {
      formatted = formatted.replace(/\D/g, "");
      if (formatted.startsWith("0") && formatted.length === 11) {
        formatted = "2" + formatted; // Egypt format
      }
      formatted = formatted + "@c.us";
    }

    if (mediaArray && mediaArray.length > 0) {
      for (let i = 0; i < mediaArray.length; i++) {
        const mediaData = mediaArray[i];
        try {
          const mimeType = mediaData.split(";")[0].split(":")[1];
          const base64Data = mediaData.split(",")[1];
          
          if (!mimeType || !base64Data) continue;

          const media = new MessageMedia(mimeType, base64Data, `media-${i}`);
          
          if (i === 0 && message.trim()) {
            await this.client.sendMessage(formatted, media, { caption: message });
          } else {
            await this.client.sendMessage(formatted, media);
          }
        } catch (e) {
          console.error("Failed to send media", e);
          if (i === 0) {
            await this.client.sendMessage(formatted, message);
          }
        }
      }
    } else {
      await this.client.sendMessage(formatted, message);
    }
  }

  async resetClient(clearAuth: boolean = false) {
    if (this.isResetting) return;
    this.isResetting = true;

    this.status = "disconnected";
    this.qrUrl = null;
    await this.updateDbStatus("disconnected");
    
    try {
      await this.client.destroy();
    } catch(e) {}
    
    // Wait for file locks to be released
    await new Promise((resolve) => setTimeout(resolve, 3000));
    
    if (clearAuth) {
      try {
        fs.rmSync("./.wwebjs_auth", { recursive: true, force: true });
        fs.rmSync("./.wwebjs_cache", { recursive: true, force: true });
      } catch (e: any) {
        console.error("Failed to delete auth directory:", e.message);
      }
    }

    this.initializeClient();

    setTimeout(() => {
      this.isResetting = false;
    }, 5000);
  }

  async logout() {
    try {
      if (this.status === "connected") {
        await this.client.logout();
      }
    } catch (e) {
      console.error("Logout error", e);
    }
    await this.resetClient(true);
  }
}

const globalForWhatsApp = globalThis as unknown as {
  whatsappService: WhatsAppService | undefined;
};

export const whatsappService = globalForWhatsApp.whatsappService ?? new WhatsAppService();

if (process.env.NODE_ENV !== "production") {
  globalForWhatsApp.whatsappService = whatsappService;
}
