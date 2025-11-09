export enum ExecutionMode {

  AUTONOMOUS = "autonomous",     // Auto-execute (HCS logs, queries)

  RETURN_BYTE = "return_byte",   // Require approval (value transfers)

}



export interface AgentResult<T = any> {

  success: boolean;

  data?: T;

  txId?: string;

  hcsSequence?: number;

  error?: string;

  metadata?: Record<string, any>;

}



export interface AgentContext {

  msisdn: string;

  ref?: string;

  timestamp: number;

}
