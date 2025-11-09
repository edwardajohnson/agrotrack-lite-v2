import { BaseAgent } from "./base";
import { ExecutionMode, AgentResult, AgentContext } from "../types/agents";
import { Intent } from "../types/intents";
import { queryMirrorNode } from "../hedera/mirror";

export interface PriceRecommendation {
  pricePerKg: number;
  confidence: number;
  sampleSize: number;
  source: "historical" | "regional" | "default";
  priceRange: { min: number; max: number };
  reasoning: string[];
}

export class MarketAgent extends BaseAgent<Intent, PriceRecommendation> {
  readonly name = "MarketAgent";
  readonly mode = ExecutionMode.AUTONOMOUS;
  readonly description = "Provides price recommendations from market data";

  private defaultPrices: Record<string, number> = {
    maize: 35,
    beans: 50,
    coffee: 120,
    tea: 80,
    rice: 60,
  };

  async execute(
    input: Intent,
    context: AgentContext
  ): Promise<AgentResult<PriceRecommendation>> {
    if (input.intent !== "OFFER_CREATE" && input.intent !== "PRICE_QUERY") {
      return { success: true, data: null as any };
    }

    const crop = input.crop;
    const location = input.intent === "OFFER_CREATE" ? input.location : input.location;

    const reasoning: string[] = [];

    // Query recent trades from HCS
    const recentTrades = await queryMirrorNode(
      `topics/${process.env.HCS_TOPIC_ID}/messages`,
      {
        type: "market_analysis",
        crop,
        limit: 50,
      }
    );

    // Filter by location proximity (simplified - production would use geocoding)
    const locationTrades = location
      ? recentTrades.messages.filter((m: any) =>
          m.data?.location?.toLowerCase().includes(location.toLowerCase())
        )
      : [];

    let recommendation: PriceRecommendation;

    if (locationTrades.length >= 5) {
      // Enough local data
      const prices = locationTrades
        .map((m: any) => m.data?.pricePerKg)
        .filter(Boolean)
        .slice(0, 20);

      const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;
      const minPrice = Math.min(...prices);
      const maxPrice = Math.max(...prices);

      reasoning.push(`Found ${prices.length} recent trades in ${location}`);
      reasoning.push(`Price range: ${minPrice}-${maxPrice} KES/kg`);

      recommendation = {
        pricePerKg: Math.round(avgPrice),
        confidence: Math.min(prices.length / 10, 0.95),
        sampleSize: prices.length,
        source: "historical",
        priceRange: { min: minPrice, max: maxPrice },
        reasoning,
      };
    } else if (recentTrades.messages.length >= 3) {
      // Regional data available
      const prices = recentTrades.messages
        .map((m: any) => m.data?.pricePerKg)
        .filter(Boolean)
        .slice(0, 20);

      const avgPrice = prices.reduce((sum: number, p: number) => sum + p, 0) / prices.length;

      reasoning.push(`Found ${prices.length} regional trades`);
      reasoning.push(`Limited local data for ${location || "this area"}`);

      recommendation = {
        pricePerKg: Math.round(avgPrice),
        confidence: 0.6,
        sampleSize: prices.length,
        source: "regional",
        priceRange: {
          min: Math.round(avgPrice * 0.9),
          max: Math.round(avgPrice * 1.1),
        },
        reasoning,
      };
    } else {
      // Use defaults
      const defaultPrice = this.defaultPrices[crop] || 40;
      reasoning.push("Insufficient market data");
      reasoning.push(`Using default pricing for ${crop}`);

      recommendation = {
        pricePerKg: defaultPrice,
        confidence: 0.5,
        sampleSize: 0,
        source: "default",
        priceRange: {
          min: Math.round(defaultPrice * 0.85),
          max: Math.round(defaultPrice * 1.15),
        },
        reasoning,
      };
    }

    await this.log("price_analysis", recommendation, context);

    return { success: true, data: recommendation };
  }
}

// ============================================================================
// ESCROW AGENT
// ============================================================================
