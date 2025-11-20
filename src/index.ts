// src/index.ts
import "dotenv/config";
import app from "./api/server.js";
import { initTopic } from "./hedera/hcs.js";
import { log } from "./utils/logger.js";

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    log("Starting AgroTrack-Lite v2.0...", "info");
    
    // Initialize HCS topic
    await initTopic();
    log("HCS topic initialized", "success");
    
    // Start server
    app.listen(PORT, () => {
      log(`Server started on port ${PORT}`, "success");
      console.log("\n🚀 AgroTrack-Lite v2.0");
      console.log(`   Server: http://localhost:${PORT}`);
      console.log(`   Logs: http://localhost:${PORT}/logs`);
      console.log(`   Webhook: http://localhost:${PORT}/webhook/sms`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log("\n✅ Ready for SMS messages\n");
    });
  } catch (error: any) {
    log("Startup failed", "error", { error: error.message });
    console.error("❌ Startup failed:", error.message);
    console.error("   Check your .env file configuration");
    process.exit(1);
  }
}

start();
