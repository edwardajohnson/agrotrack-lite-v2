import {
  Client,
  AccountId,
  PrivateKey,
} from "@hashgraph/sdk";
import "dotenv/config";

let clientInstance: Client | null = null;

export function getHederaClient(): Client {
  if (clientInstance) return clientInstance;

  const network = process.env.HEDERA_NETWORK || "testnet";
  const operatorId = AccountId.fromString(process.env.HEDERA_ACCOUNT_ID!);
  const operatorKey = PrivateKey.fromStringED25519(process.env.HEDERA_PRIVATE_KEY!);

  clientInstance = network === "mainnet" 
    ? Client.forMainnet()
    : Client.forTestnet();

  clientInstance.setOperator(operatorId, operatorKey);

  return clientInstance;
}

export function closeClient(): void {
  if (clientInstance) {
    clientInstance.close();
    clientInstance = null;
  }
}

// ============================================================================
// HCS (CONSENSUS SERVICE)
// ============================================================================
