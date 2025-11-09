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
const ESCROW_ACCOUNT_ID = process.env.ESCROW_ACCOUNT_ID!;
const BUYER_ACCOUNT_ID = process.env.BUYER_ACCOUNT_ID!;
const FARMER_ACCOUNT_ID = process.env.FARMER_ACCOUNT_ID!;

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
  const tokenId = ESCROW_TOKEN_ID || (await createEscrowToken());

  // Transfer from buyer to escrow account
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
  const tokenId = ESCROW_TOKEN_ID!;
  const recipient = farmerAccountId || FARMER_ACCOUNT_ID;

  // Transfer from escrow to farmer
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
