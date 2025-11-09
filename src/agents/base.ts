// src/agents/base.ts
import { hcsLog } from "../hedera/hcs.js";
import { ExecutionMode, AgentResult, AgentContext } from "../types/agents.js";

export abstract class BaseAgent<TInput = any, TOutput = any> {
  abstract readonly name: string;
  abstract readonly mode: ExecutionMode;
  abstract readonly description: string;

  abstract execute(input: TInput, context: AgentContext): Promise<AgentResult<TOutput>>;

  protected async log(event: string, data: any, context: AgentContext): Promise<void> {
    await hcsLog({
      agent: this.name,
      event,
      data,
      msisdn: context.msisdn,
      ref: context.ref,  // Include ref at top level so Mirror Node queries can find it
      timestamp: Date.now(),
    });
  }

  protected async recordDecision(
    decision: string,
    reasoning: string[],
    context: AgentContext
  ): Promise<void> {
    await this.log("decision", { decision, reasoning }, context);
  }
}
