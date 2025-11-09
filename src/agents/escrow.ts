import { BaseAgent } from "./base";
import { ExecutionMode, AgentResult, AgentContext } from "../types/agents";
import { Intent } from "../types/intents";
import { lockEscrow } from "../hedera/hts";
import crypto from "crypto";

export interface EscrowResult {
  ref: string;
  amount: number;
  tokenId: string;
  locked: boolean;
}

export class EscrowAgent extends BaseAgent<Intent, EscrowResult> {
  readonly name = "EscrowAgent";
  readonly mode = ExecutionMode.RETURN_BYTE;
  readonly description = "Creates token-based escrow for accepted offers";

  // In-memory OTP store (production: use Redis)
  private otpStore = new Map<string, { ref: string; expires: number }>();

  async execute(
    input: Intent,
    context: AgentContext
  ): Promise<AgentResult<EscrowResult>> {
    if (input.intent !== "OFFER_ACCEPT") {
      return {
        success: false,
        error: "Invalid intent for escrow",
      };
    }

    try {
      // Verify OTP
      const storedOTP = this.otpStore.get(input.otp);
      if (!storedOTP || storedOTP.ref !== input.ref || Date.now() > storedOTP.expires) {
        await this.log("escrow_failed", {
          ref: input.ref,
          reason: "invalid_or_expired_otp",
        }, context);

        return {
          success: false,
          error: "Invalid or expired OTP",
        };
      }

      // Remove used OTP
      this.otpStore.delete(input.otp);

      // Calculate escrow amount (production: fetch from offer)
      const amount = 10000; // Demo: 10,000 token units

      await this.log("escrow_preparing", {
        ref: input.ref,
        amount,
        mode: this.mode,
      }, context);

      // RETURN_BYTE pattern: simulate approval delay
      console.log(`⏳ [${this.name}] Awaiting approval for ${amount} units...`);
      await this.simulateApproval(2000);

      // Execute lock
      const result = await lockEscrow(amount);

      await this.log("escrow_created", {
        ref: input.ref,
        amount,
        txId: result.txId,
        tokenId: process.env.ESCROW_TOKEN_ID,
      }, context);

      return {
        success: true,
        data: {
          ref: input.ref,
          amount,
          tokenId: process.env.ESCROW_TOKEN_ID!,
          locked: true,
        },
        txId: result.txId,
      };
    } catch (error: any) {
      await this.log("escrow_error", {
        ref: input.ref,
        error: error.message,
      }, context);

      return {
        success: false,
        error: error.message,
      };
    }
  }

  // Store OTP for verification (called by orchestrator)
  storeOTP(otp: string, ref: string, ttlMs: number = 300000): void {
    this.otpStore.set(otp, {
      ref,
      expires: Date.now() + ttlMs,
    });
  }

  // Generate OTP
  static generateOTP(): string {
    return crypto.randomInt(100000, 999999).toString();
  }

  private async simulateApproval(delayMs: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, delayMs));
  }
}

// ============================================================================
// SETTLEMENT AGENT
// ============================================================================
