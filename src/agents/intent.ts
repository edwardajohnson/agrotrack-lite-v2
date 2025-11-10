// src/agents/intent.ts
import { ChatOpenAI } from "@langchain/openai";
import { BaseAgent } from "./base.js";
import { ExecutionMode, AgentResult, AgentContext } from "../types/agents.js";
import { Intent, IntentSchema } from "../types/intents.js";

export class IntentAgent extends BaseAgent<{ text: string }, Intent> {
  readonly name = "IntentAgent";
  readonly mode = ExecutionMode.AUTONOMOUS;
  readonly description = "Parses SMS into structured intents using NLP";

  private llm = new ChatOpenAI({
    modelName: "gpt-4o-mini",
    temperature: 0,
    apiKey: process.env.OPENAI_API_KEY,
  });

  async execute(
    input: { text: string },
    context: AgentContext
  ): Promise<AgentResult<Intent>> {
    try {
      const prompt = this.buildPrompt(input.text, context.msisdn);
      const response = await this.llm.invoke(prompt);
      
      // Clean response - remove markdown code blocks and extra whitespace
      let content = (response.content as string).trim();
      
      // Remove markdown code block markers
      content = content.replace(/^```json\s*/gm, '');
      content = content.replace(/^```\s*/gm, '');
      content = content.replace(/```$/gm, '');
      content = content.trim();
      
      // Log the cleaned content for debugging
      console.log("📝 Cleaned LLM response:", content);
      
      // Parse JSON
      const parsed = JSON.parse(content);
      
      // Validate with Zod schema
      const validated = IntentSchema.parse({ ...parsed, msisdn: context.msisdn });

      // Log successful parse to HCS
      await this.log("parsed_intent", {
        raw: input.text,
        parsed: validated,
        confidence: 1.0,
      }, context);

      console.log("✅ Intent parsed:", validated.intent);

      return {
        success: true,
        data: validated,
      };
    } catch (error: any) {
      console.error("❌ Intent parsing error:", error.message);
      
      // Log error to HCS
      await this.log("parse_error", {
        raw: input.text,
        error: error.message,
      }, context);

      return {
        success: false,
        error: `Could not parse message: ${error.message}`,
      };
    }
  }

  private buildPrompt(text: string, msisdn: string): string {
    return `You are an SMS intent parser for an agricultural marketplace.

Your task: Parse the SMS into a JSON object. Return ONLY the raw JSON - no markdown, no code blocks, no explanations.

INTENT TYPES:

1. FARMER_REGISTER - Farmer registration
   Examples:
   - "REGISTER John Kamau"
   - "Register Mary Wanjiru"
   - "REGISTER Alice Mwangi"
   
   Response format:
   {"intent":"FARMER_REGISTER","farmerName":"John Kamau"}

2. OFFER_CREATE - Farmer wants to sell crops
   Examples: 
   - "Maize 200kg Kisumu"
   - "Mahindi 200kg Kisumu kesho"
   - "Beans 100kg Eldoret"
   
   Response format:
   {"intent":"OFFER_CREATE","crop":"maize","quantityKg":200,"location":"Kisumu"}

3. OFFER_ACCEPT - Farmer accepts an offer
   Examples:
   - "YES 483920"
   - "Accept 483920"
   - "Ndio 483920"
   - "YES 483920 TX816810" (with optional ref)
   
   Response format (IMPORTANT: Use "LATEST" as ref if no TX number is in the message):
   {"intent":"OFFER_ACCEPT","ref":"LATEST","otp":"483920"}
   
   If message contains TX followed by numbers, use that as ref:
   {"intent":"OFFER_ACCEPT","ref":"TX816810","otp":"483920"}

4. DELIVERY_CONFIRM - Farmer confirms delivery
   Examples:
   - "Delivered 198kg Grade B OTP 553904"
   - "Delivered 200kg OTP 123456"
   - "Delivered 198kg Grade B OTP 553904 TX816810" (with optional ref)
   
   Response format (IMPORTANT: Use "LATEST" as ref if no TX number is in the message):
   {"intent":"DELIVERY_CONFIRM","ref":"LATEST","weightKg":198,"grade":"B","otp":"553904"}
   
   If message contains TX followed by numbers, use that as ref:
   {"intent":"DELIVERY_CONFIRM","ref":"TX816810","weightKg":198,"grade":"B","otp":"553904"}

5. PRICE_QUERY - Farmer asks for market prices
   Examples:
   - "Price for beans Eldoret"
   - "Bei ya mahindi"
   - "How much is coffee"
   
   Response format:
   {"intent":"PRICE_QUERY","crop":"beans","location":"Eldoret"}
   
   Note: location is optional for price queries

6. STATUS_CHECK - Check transaction status
   Examples:
   - "Status TX123456"
   - "Hali TX816810"
   
   Response format:
   {"intent":"STATUS_CHECK","ref":"TX123456"}

IMPORTANT RULES:
- Valid crops: maize, beans, coffee, tea, rice
- Valid grades: A, B, C
- OTP is always 6 digits
- Ref format is TX followed by 6 digits
- For OFFER_ACCEPT: If SMS says "YES 123456" with NO TX number, set ref to "LATEST"
- For DELIVERY_CONFIRM: If no TX number in SMS, set ref to "LATEST"
- Only use actual TX numbers from the SMS text, never invent them
- Extract ref only if message contains "TX" followed by digits like "TX816810"

SMS TEXT: "${text}"

Return ONLY the JSON object. Do not wrap in markdown. Do not add any explanatory text.`;
  }
}
