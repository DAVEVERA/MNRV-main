import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

// Keep the workspace key server-side. The SDK reads ELEVENLABS_API_KEY from
// the environment; callers receive only the short-lived WebRTC token.
export async function mintConversationToken(agentId, fetchImpl = globalThis.fetch) {
  if (!process.env.ELEVENLABS_API_KEY || !agentId) return null;

  try {
    const client = new ElevenLabsClient({ fetch: fetchImpl, maxRetries: 0 });
    const session = await client.conversationalAi.conversations.getWebrtcToken({ agentId });
    return typeof session?.token === 'string' && session.token !== '' ? session.token : null;
  } catch {
    return null;
  }
}
