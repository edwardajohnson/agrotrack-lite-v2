import {
  TopicId,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
} from "@hashgraph/sdk";
import { getHederaClient } from "./client";

let topicId: string | null = null;

export async function initTopic(): Promise<string> {
  if (topicId) return topicId;

  // Use existing topic or create new one
  if (process.env.HCS_TOPIC_ID) {
    topicId = process.env.HCS_TOPIC_ID;
    console.log(`📋 Using existing HCS topic: ${topicId}`);
    return topicId;
  }

  // Create new topic
  const client = getHederaClient();
  const transaction = new TopicCreateTransaction()
    .setSubmitKey(client.operatorPublicKey!)
    .setAdminKey(client.operatorPublicKey!)
    .setTopicMemo("AgroTrack-Lite v2.0 - SMS Marketplace");

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);

  topicId = receipt.topicId!.toString();
  console.log(`✅ Created new HCS topic: ${topicId}`);
  console.log(`   Add to .env: HCS_TOPIC_ID=${topicId}`);

  return topicId;
}

export function getCurrentTopicId(): string | null {
  return topicId;
}

export async function hcsLog(payload: object): Promise<{
  txId: string;
  sequenceNumber: number;
}> {
  const client = getHederaClient();
  const topic = topicId || (await initTopic());

  const transaction = new TopicMessageSubmitTransaction()
    .setTopicId(TopicId.fromString(topic))
    .setMessage(JSON.stringify(payload));

  const txResponse = await transaction.execute(client);
  const receipt = await txResponse.getReceipt(client);

  return {
    txId: txResponse.transactionId.toString(),
    sequenceNumber: Number(receipt.topicSequenceNumber),
  };
}

// ============================================================================
// HTS (TOKEN SERVICE)
// ============================================================================
