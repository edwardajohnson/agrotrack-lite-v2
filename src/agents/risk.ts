import { BaseAgent } from "./base";

import { ExecutionMode, AgentResult, AgentContext } from "../types/agents";

import { Intent } from "../types/intents";

import { queryMirrorNode } from "../hedera/mirror";



export interface RiskScore {

  score: number; // 0-1 (higher = riskier)

  factors: Array<{ factor: string; impact: number; description: string }>;

  recommendation: "approve" | "review" | "reject";

  confidence: number;

}



export class RiskAgent extends BaseAgent<Intent, RiskScore> {

  readonly name = "RiskAgent";

  readonly mode = ExecutionMode.AUTONOMOUS;

  readonly description = "Assesses transaction risk using historical data";



  async execute(input: Intent, context: AgentContext): Promise<AgentResult<RiskScore>> {

    if (input.intent !== "OFFER_CREATE") {

      return {

        success: true,

        data: {

          score: 0,

          factors: [],

          recommendation: "approve",

          confidence: 1.0,

        },

      };

    }



    const factors: RiskScore["factors"] = [];

    let totalScore = 0;



    // Fetch farmer's history

    const history = await queryMirrorNode(

      `topics/${process.env.HCS_TOPIC_ID}/messages`,

      { farmer: input.msisdn, limit: 100 }

    );



    // Factor 1: Delivery success rate

    const deliveries = history.messages.filter((m: any) => 

      m.event === "delivery_confirmed" && m.data?.msisdn === input.msisdn

    );

    const successful = deliveries.filter((d: any) => 

      d.data?.status === "completed"

    );



    if (deliveries.length > 0) {

      const successRate = successful.length / deliveries.length;

      if (successRate < 0.7) {

        const impact = 0.3;

        totalScore += impact;

        factors.push({

          factor: "low_delivery_rate",

          impact,

          description: `Only ${(successRate * 100).toFixed(0)}% delivery success`,

        });

      }

    } else if (deliveries.length === 0) {

      // New farmer - slight caution

      const impact = 0.1;

      totalScore += impact;

      factors.push({

        factor: "new_farmer",

        impact,

        description: "No delivery history found",

      });

    }



    // Factor 2: Seasonal fit

    const month = new Date().getMonth();

    const cropSeasons: Record<string, number[]> = {

      maize: [3, 4, 5, 9, 10, 11], // Apr-Jun, Oct-Dec

      beans: [2, 3, 8, 9],

      coffee: [10, 11, 0, 1, 2],

    };



    const validMonths = cropSeasons[input.crop] || [];

    if (validMonths.length > 0 && !validMonths.includes(month)) {

      const impact = 0.2;

      totalScore += impact;

      factors.push({

        factor: "off_season",

        impact,

        description: `${input.crop} typically not harvested in ${new Date().toLocaleString("en", { month: "long" })}`,

      });

    }



    // Factor 3: Quantity anomaly

    const recentOffers = history.messages

      .filter((m: any) => 

        m.event === "parsed_intent" &&

        m.data?.parsed?.crop === input.crop &&

        m.data?.parsed?.msisdn === input.msisdn

      )

      .slice(0, 10);



    if (recentOffers.length >= 3) {

      const quantities = recentOffers.map((o: any) => o.data?.parsed?.quantityKg || 0);

      const avgQty = quantities.reduce((sum: number, q: number) => sum + q, 0) / quantities.length;

      const deviation = Math.abs(input.quantityKg - avgQty) / avgQty;



      if (deviation > 0.5) {

        const impact = 0.2;

        totalScore += impact;

        factors.push({

          factor: "quantity_anomaly",

          impact,

          description: `Quantity ${input.quantityKg}kg is ${(deviation * 100).toFixed(0)}% different from usual ${avgQty.toFixed(0)}kg`,

        });

      }

    }



    const recommendation: RiskScore["recommendation"] =

      totalScore > 0.7 ? "reject" :

      totalScore > 0.4 ? "review" : "approve";



    const result: RiskScore = {

      score: totalScore,

      factors,

      recommendation,

      confidence: deliveries.length >= 3 ? 0.9 : 0.6,

    };



    await this.recordDecision(

      recommendation,

      factors.map((f) => `${f.factor}: ${f.description}`),

      context

    );



    return { success: true, data: result };

  }

}
