import axios from "axios";

const MIRROR_NODE_URL =
  process.env.MIRROR_NODE_URL || "https://testnet.mirrornode.hedera.com/api/v1";

interface MirrorMessage {
  consensus_timestamp: string;
  message: string;
  sequence_number: number;
  payer_account_id: string;
}

interface QueryFilters {
  farmer?: string;
  type?: string;
  event?: string;
  crop?: string;
  location?: string;
  limit?: number;
}

export async function queryMirrorNode(
  path: string,
  filters?: QueryFilters
): Promise<{ messages: any[] }> {
  try {
    const url = `${MIRROR_NODE_URL}/${path}`;
    const response = await axios.get(url, {
      params: {
        limit: filters?.limit || 100,
        order: "desc",
      },
      timeout: 10000,
    });

    // Parse and decode messages
    let messages = (response.data.messages || [])
      .map((msg: MirrorMessage) => {
        try {
          const decoded = Buffer.from(msg.message, "base64").toString("utf8");
          const parsed = JSON.parse(decoded);
          return {
            ...parsed,
            consensus_timestamp: msg.consensus_timestamp,
            sequence_number: msg.sequence_number,
            payer: msg.payer_account_id,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    // Apply client-side filters
    if (filters?.farmer) {
      messages = messages.filter(
        (m: any) => m.msisdn === filters.farmer || m.data?.msisdn === filters.farmer
      );
    }

    if (filters?.type) {
      messages = messages.filter((m: any) => m.type === filters.type);
    }

    if (filters?.event) {
      messages = messages.filter((m: any) => m.event === filters.event);
    }

    if (filters?.crop) {
      messages = messages.filter(
        (m: any) => m.crop === filters.crop || m.data?.crop === filters.crop
      );
    }

    if (filters?.location) {
      const loc = filters.location.toLowerCase();
      messages = messages.filter((m: any) =>
        (m.location?.toLowerCase() || "").includes(loc) ||
        (m.data?.location?.toLowerCase() || "").includes(loc)
      );
    }

    return { messages };
  } catch (error: any) {
    console.error("Mirror Node query error:", error.message);
    return { messages: [] };
  }
}

export async function getTopicMessages(
  topicId: string,
  limit: number = 100
): Promise<any[]> {
  const result = await queryMirrorNode(`topics/${topicId}/messages`, { limit });
  return result.messages;
}
