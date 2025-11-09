import "dotenv/config";
import { getHederaClient } from "../src/hedera/client";
import { initTopic } from "../src/hedera/hcs";
import { createEscrowToken, associateToken } from "../src/hedera/hts";

async function setup() {
  console.log("🔧 AgroTrack-Lite v2.0 Setup\n");

  try {
    const client = getHederaClient();
    console.log(`✅ Connected to ${process.env.HEDERA_NETWORK}`);
    console.log(`   Operator: ${process.env.HEDERA_ACCOUNT_ID}\n`);

    // Step 1: Create or verify HCS topic
    console.log("📋 Setting up HCS topic...");
    const topicId = await initTopic();
    console.log(`✅ Topic ready: ${topicId}\n`);

    // Step 2: Create escrow token if needed
    if (!process.env.ESCROW_TOKEN_ID) {
      console.log("🪙 Creating escrow token...");
      const tokenId = await createEscrowToken();
      console.log(`✅ Token created: ${tokenId}\n`);

      // Step 3: Associate token with accounts
      console.log("🔗 Associating token with accounts...");
      
      const accounts = [
        process.env.ESCROW_ACCOUNT_ID,
        process.env.BUYER_ACCOUNT_ID,
        process.env.FARMER_ACCOUNT_ID,
      ].filter(Boolean);

      for (const accountId of accounts) {
        try {
          await associateToken(accountId!, tokenId);
          console.log(`   ✅ Associated with ${accountId}`);
        } catch (err: any) {
          console.log(`   ⚠️  ${accountId}: ${err.message}`);
        }
      }
    } else {
      console.log(`✅ Using existing token: ${process.env.ESCROW_TOKEN_ID}\n`);
    }

    console.log("\n✅ Setup complete!");
    console.log("\nUpdate your .env with:");
    console.log(`HCS_TOPIC_ID=${topicId}`);
    if (!process.env.ESCROW_TOKEN_ID) {
      console.log(`ESCROW_TOKEN_ID=${tokenId}`);
    }
    
    process.exit(0);
  } catch (error: any) {
    console.error("\n❌ Setup failed:", error.message);
    process.exit(1);
  }
}

setup();

// ============================================================================
// DEMO JOURNEY SCRIPT
// ============================================================================
