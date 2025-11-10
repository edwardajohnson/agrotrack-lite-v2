import {
  TokenId,
  AccountId,
  TransferTransaction,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenType,
  TokenSupplyType,
  PrivateKey,
} from "@hashgraph/sdk";
import { getHederaClient } from "./client";

const ESCROW_TOKEN_ID = process.env.ESCROW_TOKEN_ID;
const ESCROW_ACCOUNT_ID = process.env.ESCROW_ACCOUNT_ID;
const BUYER_ACCOUNT_ID = process.env.BUYER_ACCOUNT_ID;
const FARMER_ACCOUNT_ID = process.env.FARMER_ACCOUNT_ID;

export async function createEscrowToken(): Promise<string> {
  const client = getHederaClient();

  const transaction = new TokenCreateTransaction()
    .setTokenName("AgroTrack Voucher")
    .setTokenSymbol("ATV")
    .setTokenType(TokenType.FungibleCommon)
    .setDecimals(0)
    .setInitialSupply(1_000_000)
    .setSupplyType(TokenSupplyType.Infinite)
    .setTreasuryAccountId(client.operatorAccountId!)
    .setAdminKey(client.operatorPublicKey!)
    .setSupplyKey(client.operatorPublicKey!);

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);

  const tokenId = receipt.tokenId!.toString();
  console.log(`✅ Created escrow token: ${tokenId}`);
  console.log(`   Add to .env: ESCROW_TOKEN_ID=${tokenId}`);

  return tokenId;
}

export async function associateToken(
  accountId: string,
  tokenId: string
): Promise<string> {
  const client = getHederaClient();

  const transaction = new TokenAssociateTransaction()
    .setAccountId(AccountId.fromString(accountId))
    .setTokenIds([TokenId.fromString(tokenId)])
    .freezeWith(client);

  const signedTx = await transaction.sign(
    PrivateKey.fromStringED25519(process.env.HEDERA_PRIVATE_KEY!)
  );

  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  return receipt.status.toString();
}

export async function lockEscrow(amount: number): Promise<{
  txId: string;
  status: string;
}> {
  const client = getHederaClient();
  
  // Get or create token ID
  let tokenId = ESCROW_TOKEN_ID;
  if (!tokenId) {
    console.log("⚠️  No ESCROW_TOKEN_ID found, creating new token...");
    tokenId = await createEscrowToken();
  }

  // Check if we have all required accounts for real transfers
  const hasRequiredAccounts = ESCROW_ACCOUNT_ID && BUYER_ACCOUNT_ID;
  
  if (!hasRequiredAccounts) {
    // Demo mode: simulate escrow without actual token transfers
    console.log(`🔒 [DEMO MODE] Simulating escrow lock of ${amount} units of token ${tokenId}`);
    console.log(`   Missing accounts: ${!ESCROW_ACCOUNT_ID ? 'ESCROW_ACCOUNT_ID ' : ''}${!BUYER_ACCOUNT_ID ? 'BUYER_ACCOUNT_ID' : ''}`);
    
    return {
      txId: `demo-lock-${Date.now()}`,
      status: "SUCCESS (simulated)",
    };
  }

  // Production: Execute actual token transfer
  console.log(`🔒 Locking ${amount} units of token ${tokenId} in escrow`);
  
  const transaction = new TransferTransaction()
    .addTokenTransfer(
      TokenId.fromString(tokenId),
      AccountId.fromString(BUYER_ACCOUNT_ID),
      -amount
    )
    .addTokenTransfer(
      TokenId.fromString(tokenId),
      AccountId.fromString(ESCROW_ACCOUNT_ID),
      amount
    )
    .freezeWith(client);

  const signedTx = await transaction.sign(
    PrivateKey.fromStringED25519(process.env.HEDERA_PRIVATE_KEY!)
  );

  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  return {
    txId: txResponse.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

export async function releaseEscrow(
  amount: number,
  farmerAccountId?: string
): Promise<{
  txId: string;
  status: string;
}> {
  const client = getHederaClient();
  
  // Get token ID
  const tokenId = ESCROW_TOKEN_ID;
  if (!tokenId) {
    throw new Error("No escrow token found. Create an offer first.");
  }
  
  const recipient = farmerAccountId || FARMER_ACCOUNT_ID;

  // Check if we have all required accounts
  const hasRequiredAccounts = ESCROW_ACCOUNT_ID && recipient;
  
  if (!hasRequiredAccounts) {
    // Demo mode: simulate release
    console.log(`💰 [DEMO MODE] Simulating escrow release of ${amount} units to farmer`);
    console.log(`   Missing accounts: ${!ESCROW_ACCOUNT_ID ? 'ESCROW_ACCOUNT_ID ' : ''}${!recipient ? 'FARMER_ACCOUNT_ID' : ''}`);
    
    return {
      txId: `demo-release-${Date.now()}`,
      status: "SUCCESS (simulated)",
    };
  }

  // Production: Execute actual token transfer
  console.log(`💰 Releasing ${amount} units from escrow to ${recipient}`);
  
  const transaction = new TransferTransaction()
    .addTokenTransfer(
      TokenId.fromString(tokenId),
      AccountId.fromString(ESCROW_ACCOUNT_ID),
      -amount
    )
    .addTokenTransfer(
      TokenId.fromString(tokenId),
      AccountId.fromString(recipient),
      amount
    )
    .freezeWith(client);

  const signedTx = await transaction.sign(
    PrivateKey.fromStringED25519(process.env.HEDERA_PRIVATE_KEY!)
  );

  const txResponse = await signedTx.execute(client);
  const receipt = await txResponse.getReceipt(client);

  return {
    txId: txResponse.transactionId.toString(),
    status: receipt.status.toString(),
  };
}

// ============================================================================
// MIRROR NODE
// ============================================================================
