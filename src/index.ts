// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

// src/index.ts
import "dotenv/config";
import app from "./api/server.js";
import { initTopic } from "./hedera/hcs.js";

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  try {
    // Initialize HCS topic
    await initTopic();
    
    // Start server
    app.listen(PORT, () => {
      console.log("\n🚀 AgroTrack-Lite v2.0");
      console.log(`   Server: http://localhost:${PORT}`);
      console.log(`   Webhook: http://localhost:${PORT}/webhook/sms`);
      console.log(`   Health: http://localhost:${PORT}/health`);
      console.log("\n✅ Ready for SMS messages\n");
    });
  } catch (error: any) {
    console.error("❌ Startup failed:", error.message);
    console.error("   Check your .env file configuration");
    process.exit(1);
  }
}

start();
