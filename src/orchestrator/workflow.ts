// src/orchestrator/workflow.ts
import { IntentAgent } from "../agents/intent.js";
import { RiskAgent } from "../agents/risk.js";
import { MarketAgent } from "../agents/market.js";
import { EscrowAgent } from "../agents/escrow.js";
import { SettlementAgent } from "../agents/settlement.js";
import { Intent } from "../types/intents.js";
import { AgentContext } from "../types/agents.js";
import { sendSms } from "../sms/gateway.js";
import { log } from "../utils/logger.js";
import crypto from "crypto";

export class AgentOrchestrator {
  private intentAgent = new IntentAgent();
  private riskAgent = new RiskAgent();
  private marketAgent = new MarketAgent();
  private escrowAgent = new EscrowAgent();
  private settlementAgent = new SettlementAgent();

  async handleSms(msisdn: string, text: string): Promise<void> {
    const context: AgentContext = {
      msisdn,
      timestamp: Date.now(),
      ref: this.generateRef(),
    };

    log(`Processing SMS from ${msisdn}`, "info", { ref: context.ref, text });

    // Step 1: Parse intent
    const intentResult = await this.intentAgent.execute({ text }, context);

    if (!intentResult.success) {
      log("Intent parsing failed", "error", { ref: context.ref, error: intentResult.error });
      await sendSms(
        msisdn,
        "❌ Could not understand your message.\n\nExamples:\n• Maize 200kg Kisumu\n• YES 483920\n• Status TX123"
      );
      return;
    }

    const intent = intentResult.data!;
    log(`Intent parsed: ${intent.intent}`, "success", { ref: context.ref, intent: intent.intent });

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
        case "FARMER_REGISTER":
          await this.handleFarmerRegister(intent, context);
          break;
      }
    } catch (error: any) {
      log("Orchestration error", "error", { ref: context.ref, error: error.message });
      await sendSms(msisdn, "❌ An error occurred. Please try again or contact support.");
    }
  }

  private async handleFarmerRegister(
    intent: Intent & { intent: "FARMER_REGISTER" },
    context: AgentContext
  ): Promise<void> {
    log(`Registering farmer: ${intent.farmerName}`, "info", { ref: context.ref, farmer: intent.farmerName });
    
    const message = `✅ Welcome ${intent.farmerName}!\n\nYou're registered with AgroTrack.\n\nSend your crop offers:\n• Maize 200kg Kisumu\n• Beans 150kg Eldoret\n\nRef: ${context.ref}`;
    
    await sendSms(intent.msisdn, message);
    log("Farmer registered successfully", "success", { ref: context.ref });
  }

  private async handleOfferCreate(
    intent: Intent & { intent: "OFFER_CREATE" },
    context: AgentContext
  ): Promise<void> {
    log("Running parallel agents for OFFER_CREATE", "info", { 
      ref: context.ref, 
      crop: intent.crop, 
      quantity: intent.quantityKg,
      location: intent.location 
    });

    // Parallel execution
    const [riskResult, marketResult] = await Promise.all([
      this.riskAgent.execute(intent, context),
      this.marketAgent.execute(intent, context),
    ]);

    const risk = riskResult.data!;
    const market = marketResult.data!;

    log("Agent analysis complete", "success", { 
      ref: context.ref,
      risk: risk.recommendation,
      riskScore: risk.score,
      price: market.pricePerKg,
      source: market.source 
    });

    // Decision tree
    if (risk.recommendation === "reject") {
      log("Offer rejected due to risk", "error", { ref: context.ref, reason: risk.factors[0]?.description });
      await sendSms(
        intent.msisdn,
        `❌ Unable to process your offer at this time.\n\nReason: ${risk.factors[0]?.description || "High risk"}`
      );
      return;
    }

    // Calculate totals
    const totalAmount = market.pricePerKg * intent.quantityKg;
    const otp = EscrowAgent.generateOTP();

    // Store OTP
    this.escrowAgent.storeOTP(otp, context.ref!);

    log("OTP generated for offer", "success", { ref: context.ref, otp, totalAmount });

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
    log("Processing escrow for offer acceptance", "info", { 
      ref: intent.ref, 
      otp: intent.otp 
    });

    // Resolve LATEST ref if needed
    if (intent.ref === "LATEST") {
      log("Resolving LATEST ref...", "debug", { ref: context.ref });
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { getTopicMessages } = await import("../hedera/mirror.js");
      const messages = await getTopicMessages(process.env.HCS_TOPIC_ID!, 100);
      
      const farmerOffers = messages.filter(
        (m) => m.event === "parsed_intent" && 
               m.data?.parsed?.intent === "OFFER_CREATE" && 
               m.data?.parsed?.msisdn === intent.msisdn && 
               m.ref
      );

      if (farmerOffers.length > 0) {
        intent.ref = farmerOffers[0].ref;
        log("Resolved LATEST ref", "success", { resolved: intent.ref });
      } else {
        log("No recent offer found", "error", { farmer: intent.msisdn });
        await sendSms(intent.msisdn, "❌ No recent offer found. Please create an offer first:\n\nExample: Maize 200kg Kisumu");
        return;
      }
    }

    const escrowResult = await this.escrowAgent.execute(intent, context);

    if (!escrowResult.success) {
      log("Escrow creation failed", "error", { ref: intent.ref, error: escrowResult.error });
      await sendSms(intent.msisdn, `❌ ${escrowResult.error}`);
      return;
    }

    const escrow = escrowResult.data!;
    log("Escrow created successfully", "success", { 
      ref: escrow.ref, 
      amount: escrow.amount,
      txId: escrowResult.txId 
    });

    let message = `✅ Escrow secured!\n\n`;
    message += `Amount: ${escrow.amount} tokens locked\n`;
    message += `Ref: ${escrow.ref}\n`;
    
    if (escrowResult.txId) {
      message += `TxID: ${escrowResult.txId.substring(0, 20)}...\n\n`;
    }
    
    message += `Deliver to hub to release payment.`;

    await sendSms(intent.msisdn, message);
  }

  private async handleDeliveryConfirm(
    intent: Intent & { intent: "DELIVERY_CONFIRM" },
    context: AgentContext
  ): Promise<void> {
    log("Processing settlement for delivery", "info", { 
      ref: intent.ref,
      weight: intent.weightKg,
      grade: intent.grade 
    });

    // Resolve LATEST ref if needed
    if (intent.ref === "LATEST") {
      log("Resolving LATEST escrow ref...", "debug");
      
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const { getTopicMessages } = await import("../hedera/mirror.js");
      const messages = await getTopicMessages(process.env.HCS_TOPIC_ID!, 100);
      
      const farmerEscrows = messages.filter(
        (m) => m.event === "escrow_created" && 
               m.msisdn === intent.msisdn && 
               m.ref
      );

      if (farmerEscrows.length > 0) {
        intent.ref = farmerEscrows[0].ref;
        log("Resolved LATEST escrow", "success", { resolved: intent.ref });
      } else {
        log("No recent escrow found", "error", { farmer: intent.msisdn });
        await sendSms(intent.msisdn, "❌ No recent escrow found. Please accept an offer first.");
        return;
      }
    }

    const settlementResult = await this.settlementAgent.execute(intent, context);

    if (!settlementResult.success) {
      log("Settlement failed", "error", { ref: intent.ref, error: settlementResult.error });
      await sendSms(intent.msisdn, `❌ ${settlementResult.error}`);
      return;
    }

    const settlement = settlementResult.data!;
    log("Settlement completed", "success", { 
      ref: settlement.ref,
      amount: settlement.amount,
      txId: settlementResult.txId 
    });

    let message = `✅ Payment released!\n\n`;
    message += `Amount: ${settlement.amount} tokens\n`;
    message += `Weight: ${intent.weightKg}kg\n`;
    message += `Grade: ${intent.grade || "N/A"}\n`;
    
    if (settlementResult.txId) {
      message += `TxID: ${settlementResult.txId.substring(0, 20)}...\n`;
    }
    
    message += `Receipt: ${settlement.receiptHash}`;

    await sendSms(intent.msisdn, message);
  }

  private async handlePriceQuery(
    intent: Intent & { intent: "PRICE_QUERY" },
    context: AgentContext
  ): Promise<void> {
    log("Processing price query", "info", { ref: context.ref, crop: intent.crop });

    const marketResult = await this.marketAgent.execute(intent, context);
    const market = marketResult.data!;

    log("Price discovered", "success", { 
      ref: context.ref,
      crop: intent.crop,
      price: market.pricePerKg,
      source: market.source 
    });

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
    log("Checking transaction status", "info", { ref: intent.ref });

    const { getTopicMessages } = await import("../hedera/mirror.js");
    const messages = await getTopicMessages(process.env.HCS_TOPIC_ID!, 200);

    const refEvents = messages.filter(
      (m) => m.ref === intent.ref || m.data?.ref === intent.ref
    );

    if (refEvents.length === 0) {
      log("No transaction found", "error", { ref: intent.ref });
      await sendSms(intent.msisdn, `❌ No transaction found for ${intent.ref}`);
      return;
    }

    const events = refEvents.map((e) => e.event || e.type).filter(Boolean);
    const status = events.includes("settlement_complete")
      ? "Completed ✅"
      : events.includes("escrow_created")
      ? "Escrow locked 🔒"
      : events.includes("parsed_intent")
      ? "Offer pending 📋"
      : "Unknown";

    log("Status retrieved", "success", { ref: intent.ref, status, eventCount: events.length });

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
