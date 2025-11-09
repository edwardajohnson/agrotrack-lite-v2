import "dotenv/config";
import axios from "axios";

const API_URL = process.env.API_URL || "http://localhost:3000";
const FARMER_PHONE = "+254700000001";

async function sendSMS(text: string) {
  console.log(`\n📱 Farmer sends: "${text}"`);
  const response = await axios.post(`${API_URL}/webhook/sms`, {
    from: FARMER_PHONE,
    text,
  });
  console.log(`   Response: ${response.data.status}`);
  await sleep(3000);
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runDemo() {
  console.log("🌾 AgroTrack-Lite Demo Journey\n");
  console.log("=" .repeat(50));

  // Wait for server
  console.log("Waiting for server to be ready...");
  await sleep(2000);

  // Step 1: Create offer
  console.log("\n📝 STEP 1: Farmer creates offer");
  console.log("-".repeat(50));
  await sendSMS("Maize 200kg Kisumu");
  await sleep(5000);

  // Step 2: Accept offer (need to extract OTP from logs in real demo)
  console.log("\n✅ STEP 2: Farmer accepts offer");
  console.log("-".repeat(50));
  console.log("(In real demo, farmer receives OTP and replies with it)");
  // await sendSMS("YES 483920");
  // await sleep(5000);

  // Step 3: Confirm delivery
  console.log("\n🚚 STEP 3: Farmer confirms delivery");
  console.log("-".repeat(50));
  console.log("(Farmer delivers to hub and confirms)");
  // await sendSMS("Delivered 198kg Grade B OTP 553904");
  // await sleep(5000);

  // Step 4: Check status
  console.log("\n📊 STEP 4: Check transaction status");
  console.log("-".repeat(50));
  // await sendSMS("Status TX123456");

  console.log("\n✅ Demo journey complete!");
  console.log("\nView full logs in console and HCS explorer:");
  console.log(`https://hashscan.io/testnet/topic/${process.env.HCS_TOPIC_ID}`);
}

runDemo().catch(console.error);

// ============================================================================
// DOCKERFILE
// ============================================================================

/*
// Dockerfile
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
*/

/*
// docker-compose.yml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "3000:3000"
    env_file:
      - .env
    restart: unless-stopped

  dashboard:
    build: ./dashboard
    ports:
      - "5173:5173"
    environment:
      - VITE_API_URL=http://localhost:3000
    depends_on:
      - api
*/
