// src/orchestrator/workflow.ts
import { IntentAgent } from "../agents/intent.js";
import { RiskAgent } from "../agents/risk.js";
import { MarketAgent } from "../agents/market.js";
import { EscrowAgent } from "../agents/escrow.js";
import { SettlementAgent } from "../agents/settlement.js";
import { Intent } from "../types/intents.js";
import { AgentContext } from "../types/agents.js";
import { sendSms } from "../sms/gateway.js";
import crypto from "crypto";

export class AgentOrchestrator {
  private intentAgent = new IntentAgent();
  private riskAgent = new RiskAgent();
  private marketAgent = new MarketAgent();
  private escrowAgent = new EscrowAgent();
  private settlementAgent = new SettlementAgent();

  async handleSms(msisdn: string, text: string): Promise<void> {
    // Generate ref FIRST, before any agents run
    const context: AgentContext = {
      msisdn,
      timestamp: Date.now(),
      ref: this.generateRef(),  // Generate ref immediately so all logs have it
    };

    // Step 1: Parse intent (now has ref in context from the start)
    const intentResult = await this.intentAgent.execute({ text }, context);

    if (!intentResult.success) {
      await sendSms(
        msisdn,
        "❌ Could not understand your message.\n\nExamples:\n• Maize 200kg Kisumu\n• YES 483920\n• Status TX123"
      );
      return;
    }

    const intent = intentResult.data!;

    // Step 2: Route to workflow
    try {
      switch (intent.intent) {
        case "OFFER_CREATE":
          await this.handleOfferCreate(intent, context);
          break;
        case "OFFER_ACCEPT":
          await this.handleOfferAccept(intent, context);
          break;
        case "DELIVERY_CONFIRM":
          await this.handleDeliveryConfirm(intent, context);
          break;
        case "PRICE_QUERY":
          await this.handlePriceQuery(intent, context);
          break;
        case "STATUS_CHECK":
          await this.handleStatusCheck(intent, context);
          break;
      }
    } catch (error: any) {
      console.error("Orchestration error:", error);
      await sendSms(msisdn, "❌ An error occurred. Please try again or contact support.");
    }
  }

  private async handleOfferCreate(
    intent: Intent & { intent: "OFFER_CREATE" },
    context: AgentContext
  ): Promise<void> {
    console.log(`\n🔄 [Orchestrator] Running parallel agents for OFFER_CREATE...`);
    console.log(`   Ref: ${context.ref}`);

    // Parallel execution (key differentiator!)
    const [riskResult, marketResult] = await Promise.all([
      this.riskAgent.execute(intent, context),
      this.marketAgent.execute(intent, context),
    ]);

    const risk = riskResult.data!;
    const market = marketResult.data!;

    console.log(`   Risk: ${risk.recommendation} (score: ${risk.score.toFixed(2)})`);
    console.log(`   Price: ${market.pricePerKg} KES/kg (${market.source})`);

    // Decision tree
    if (risk.recommendation === "reject") {
      await sendSms(
        intent.msisdn,
        `❌ Unable to process your offer at this time.\n\nReason: ${risk.factors[0]?.description || "High risk"}`
      );
      return;
    }

    // Calculate totals
    const totalAmount = market.pricePerKg * intent.quantityKg;
    const otp = EscrowAgent.generateOTP();

    // Store OTP for later acceptance
    this.escrowAgent.storeOTP(otp, context.ref!);

    // IMPORTANT: Log the OTP to console so you can see it!
    console.log(`\n🔑 OTP Generated: ${otp} for Ref: ${context.ref}\n`);

    // Send offer to farmer
    let message = `✅ Offer created!\n\n`;
    message += `${intent.crop.toUpperCase()}: ${intent.quantityKg}kg\n`;
    message += `Price: ${market.pricePerKg} KES/kg\n`;
    message += `Total: ${totalAmount} KES\n`;
    message += `Location: ${intent.location}\n\n`;

    if (risk.recommendation === "review") {
      message += `⚠️ Manual review required\n`;
    }

    message += `Reply: YES ${otp}\n`;
    message += `Ref: ${context.ref}`;

    await sendSms(intent.msisdn, message);
  }

  private async handleOfferAccept(
    intent: Intent & { intent: "OFFER_ACCEPT" },
    context: AgentContext
  ): Promise<void> {
    console.log(`\n🔐 [Orchestrator] Processing escrow...`);
    console.log(`   Ref from intent: ${intent.ref}`);
    console.log(`   OTP: ${intent.otp}`);
    console.log(`   Farmer: ${intent.msisdn}`);

    // If ref is "LATEST", find the most recent offer for this farmer
    if (intent.ref === "LATEST") {
      console.log(`   🔍 Resolving LATEST ref...`);
      
      // Add small delay to allow Mirror Node to index
      console.log(`   ⏳ Waiting 2 seconds for Mirror Node indexing...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { getTopicMessages } = await import("../hedera/mirror.js");
      const messages = await getTopicMessages(process.env.HCS_TOPIC_ID!, 100);
      
      console.log(`   📊 Total messages fetched: ${messages.length}`);
      
      // Debug: log all messages to see structure
      const parsedIntents = messages.filter(m => m.event === "parsed_intent");
      console.log(`   📋 Parsed intent messages: ${parsedIntents.length}`);
      
      // Find the most recent OFFER_CREATE for this farmer
      const farmerOffers = messages.filter(
        (m) => {
          const isIntent = m.event === "parsed_intent";
          const isOfferCreate = m.data?.parsed?.intent === "OFFER_CREATE";
          const matchesFarmer = m.data?.parsed?.msisdn === intent.msisdn;
          const hasRef = m.ref !== undefined && m.ref !== null;
          
          if (isIntent) {
            console.log(`   Checking message:`, {
              event: m.event,
              intent: m.data?.parsed?.intent,
              msisdn: m.data?.parsed?.msisdn,
              ref: m.ref,
              matches: isIntent && isOfferCreate && matchesFarmer && hasRef
            });
          }
          
          return isIntent && isOfferCreate && matchesFarmer && hasRef;
        }
      );

      console.log(`   🎯 Matching offers found: ${farmerOffers.length}`);

      if (farmerOffers.length > 0) {
        const latestOffer = farmerOffers[0];
        intent.ref = latestOffer.ref;
        console.log(`   ✅ Resolved LATEST to ref: ${intent.ref}`);
      } else {
        console.log(`   ❌ No recent offer found for farmer: ${intent.msisdn}`);
        await sendSms(intent.msisdn, "❌ No recent offer found. Please wait a few seconds and try again.");
        return;
      }
    }

    console.log(`   📝 Using ref: ${intent.ref}`);

    const escrowResult = await this.escrowAgent.execute(intent, context);

    if (!escrowResult.success) {
      console.error(`   ❌ Escrow failed: ${escrowResult.error}`);
      await sendSms(intent.msisdn, `❌ ${escrowResult.error}`);
      return;
    }

    const escrow = escrowResult.data!;

    let message = `✅ Escrow secured!\n\n`;
    message += `Amount: ${escrow.amount} tokens locked\n`;
    message += `Ref: ${escrow.ref}\n`;
    
    if (escrowResult.txId) {
      message += `TxID: ${escrowResult.txId.substring(0, 20)}...\n\n`;
    }
    
    message += `Deliver to hub to release payment.`;

    await sendSms(intent.msisdn, message);
    console.log(`   ✅ Escrow created successfully`);
  }

  private async handleDeliveryConfirm(
    intent: Intent & { intent: "DELIVERY_CONFIRM" },
    context: AgentContext
  ): Promise<void> {
    console.log(`\n💰 [Orchestrator] Processing settlement...`);
    console.log(`   Ref from intent: ${intent.ref}`);
    console.log(`   Weight: ${intent.weightKg}kg`);
    console.log(`   Grade: ${intent.grade || "N/A"}`);
    console.log(`   Farmer: ${intent.msisdn}`);

    // If ref is "LATEST", find the most recent escrow for this farmer
    if (intent.ref === "LATEST") {
      console.log(`   🔍 Resolving LATEST ref...`);
      
      // Add small delay to allow Mirror Node to index
      console.log(`   ⏳ Waiting 2 seconds for Mirror Node indexing...`);
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { getTopicMessages } = await import("../hedera/mirror.js");
      const messages = await getTopicMessages(process.env.HCS_TOPIC_ID!, 100);
      
      console.log(`   📊 Total messages fetched: ${messages.length}`);
      
      // Find the most recent escrow for this farmer
      const farmerEscrows = messages.filter(
        (m) => {
          const isEscrowCreated = m.event === "escrow_created";
          const matchesFarmer = m.msisdn === intent.msisdn;
          const hasRef = m.ref !== undefined && m.ref !== null;
          
          if (isEscrowCreated) {
            console.log(`   Checking escrow:`, {
              event: m.event,
              msisdn: m.msisdn,
              ref: m.ref,
              matches: isEscrowCreated && matchesFarmer && hasRef
            });
          }
          
          return isEscrowCreated && matchesFarmer && hasRef;
        }
      );

      console.log(`   🎯 Matching escrows found: ${farmerEscrows.length}`);

      if (farmerEscrows.length > 0) {
        const latestEscrow = farmerEscrows[0];
        intent.ref = latestEscrow.ref;
        console.log(`   ✅ Resolved LATEST to ref: ${intent.ref}`);
      } else {
        console.log(`   ❌ No recent escrow found for farmer: ${intent.msisdn}`);
        await sendSms(intent.msisdn, "❌ No recent escrow found. Please accept an offer first.");
        return;
      }
    }

    console.log(`   📝 Using ref: ${intent.ref}`);

    const settlementResult = await this.settlementAgent.execute(intent, context);

    if (!settlementResult.success) {
      console.error(`   ❌ Settlement failed: ${settlementResult.error}`);
      await sendSms(intent.msisdn, `❌ ${settlementResult.error}`);
      return;
    }

    const settlement = settlementResult.data!;

    let message = `✅ Payment released!\n\n`;
    message += `Amount: ${settlement.amount} tokens\n`;
    message += `Weight: ${intent.weightKg}kg\n`;
    message += `Grade: ${intent.grade || "N/A"}\n`;
    
    if (settlementResult.txId) {
      message += `TxID: ${settlementResult.txId.substring(0, 20)}...\n`;
    }
    
    message += `Receipt: ${settlement.receiptHash}`;

    await sendSms(intent.msisdn, message);
    console.log(`   ✅ Settlement completed successfully`);
  }

  private async handlePriceQuery(
    intent: Intent & { intent: "PRICE_QUERY" },
    context: AgentContext
  ): Promise<void> {
    console.log(`\n💰 [Orchestrator] Processing price query...`);

    const marketResult = await this.marketAgent.execute(intent, context);
    const market = marketResult.data!;

    let message = `💰 Price for ${intent.crop.toUpperCase()}\n\n`;
    message += `${market.pricePerKg} KES/kg\n`;
    message += `Range: ${market.priceRange.min}-${market.priceRange.max}\n`;
    message += `Source: ${market.source}\n`;
    
    if (market.sampleSize > 0) {
      message += `Based on ${market.sampleSize} recent trades`;
    }

    await sendSms(intent.msisdn, message);
  }

  private async handleStatusCheck(
    intent: Intent & { intent: "STATUS_CHECK" },
    context: AgentContext
  ): Promise<void> {
    console.log(`\n📊 [Orchestrator] Checking status for ${intent.ref}...`);

    // Query HCS for this ref
    const { getTopicMessages } = await import("../hedera/mirror.js");
    const messages = await getTopicMessages(process.env.HCS_TOPIC_ID!, 200);

    const refEvents = messages.filter(
      (m) => m.ref === intent.ref || m.data?.ref === intent.ref
    );

    if (refEvents.length === 0) {
      await sendSms(intent.msisdn, `❌ No transaction found for ${intent.ref}`);
      return;
    }

    // Build timeline
    const events = refEvents.map((e) => e.event || e.type).filter(Boolean);
    const status = events.includes("settlement_complete")
      ? "Completed ✅"
      : events.includes("escrow_created")
      ? "Escrow locked 🔐"
      : events.includes("parsed_intent")
      ? "Offer pending 📋"
      : "Unknown";

    let message = `📊 Status: ${intent.ref}\n\n`;
    message += `${status}\n`;
    message += `Events: ${events.length}\n`;
    message += `Latest: ${events[0] || "N/A"}`;

    await sendSms(intent.msisdn, message);
  }

  private generateRef(): string {
    return `TX${crypto.randomInt(100000, 999999)}`;
  }
}
