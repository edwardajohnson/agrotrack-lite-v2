import { BaseAgent } from "./base";
import { ExecutionMode, AgentResult, AgentContext } from "../types/agents";
import { Intent } from "../types/intents";
import { releaseEscrow } from "../hedera/hts";
import crypto from "crypto";

export interface SettlementResult {
  ref: string;
  amount: number;
  receiptHash: string;
  paidOut: boolean;
}

export class SettlementAgent extends BaseAgent<Intent, SettlementResult> {
  readonly name = "SettlementAgent";
  readonly mode = ExecutionMode.RETURN_BYTE;
  readonly description = "Releases escrow and generates payment receipts";

  async execute(
    input: Intent,
    context: AgentContext
  ): Promise<AgentResult<SettlementResult>> {
    if (input.intent !== "DELIVERY_CONFIRM") {
      return {
        success: false,
        error: "Invalid intent for settlement",
      };
    }

    try {
      // Log delivery first
      await this.log("delivery_received", {
        ref: input.ref,
        weightKg: input.weightKg,
        grade: input.grade,
        otp: input.otp,
      }, context);

      // Validate delivery (production: check weight variance, quality, etc.)
      const validation = this.validateDelivery(input);
      if (!validation.valid) {
        await this.log("settlement_rejected", {
          ref: input.ref,
          reason: validation.reason,
        }, context);

        return {
          success: false,
          error: validation.reason,
        };
      }

      // Calculate payout (production: fetch original offer amount)
      const amount = 10000;

      await this.log("settlement_preparing", {
        ref: input.ref,
        amount,
        mode: this.mode,
      }, context);

      console.log(`⏳ [${this.name}] Awaiting approval for payout...`);
      await this.simulateApproval(2000);

      // Release escrow
      const result = await releaseEscrow(amount);

      // Generate receipt
      const receipt = this.generateReceipt(input, result.txId, amount);
      const receiptHash = this.hashReceipt(receipt);

      await this.log("settlement_complete", {
        ref: input.ref,
        amount,
        txId: result.txId,
        receiptHash,
        receipt,
      }, context);

      return {
        success: true,
        data: {
          ref: input.ref,
          amount,
          receiptHash,
          paidOut: true,
        },
        txId: result.txId,
      };
    } catch (error: any) {
      await this.log("settlement_error", {
        ref: input.ref,
        error: error.message,
      }, context);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  private validateDelivery(input: Intent & { intent: "DELIVERY_CONFIRM" }): {
    valid: boolean;
    reason?: string;
  } {
    // Production: compare against original offer
    if (input.weightKg < 50) {
      return { valid: false, reason: "Weight too low for payout" };
    }
    return { valid: true };
  }

  private generateReceipt(
    delivery: Intent & { intent: "DELIVERY_CONFIRM" },
    txId: string,
    amount: number
  ): object {
    return {
      ref: delivery.ref,
      farmer: delivery.msisdn,
      deliveredWeight: delivery.weightKg,
      grade: delivery.grade,
      amount,
      txId,
      timestamp: new Date().toISOString(),
      signature: "DEMO_SIG",
    };
  }

  private hashReceipt(receipt: object): string {
    return crypto
      .createHash("sha256")
      .update(JSON.stringify(receipt))
      .digest("hex")
      .substring(0, 16);
  }

  private async simulateApproval(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}
