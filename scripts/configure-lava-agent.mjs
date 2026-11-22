import { readFile } from 'node:fs/promises';

import { ElevenLabsClient, SystemTool } from '@elevenlabs/elevenlabs-js';

const LAVA_VOICE_ID = 'XO2g9B43jNBCNx5vBRiZ';
const LAVA_LLM = 'claude-sonnet-4-6';

function fencedSection(source, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = source.match(new RegExp(`${escaped}[\\s\\S]*?\`\`\`\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\``));
  if (!match?.[1]) throw new Error(`Missing fenced content below ${heading}`);
  return match[1].trim();
}

function clientTools() {
  return [
    {
      type: 'client',
      name: 'update_notes',
      description: 'Herschrijf tijdens het gesprek wat LAVA begrijpt en welke vragen nog openstaan.',
      expectsResponse: true,
      parameters: {
        type: 'object',
        properties: {
          understood: { type: 'string', description: 'Korte actuele samenvatting van wat duidelijk is.' },
          open: { type: 'string', description: 'Korte actuele lijst met vragen die nog openstaan.' },
        },
      },
    },
    {
      type: 'client',
      name: 'show_appointment',
      description: 'Toon de bevestigde afspraak en bied de agenda-uitnodiging als download aan.',
      expectsResponse: true,
      parameters: {
        type: 'object',
        properties: {
          label: { type: 'string', description: 'De spreekbare datum en tijd uit book_appointment.' },
          icsText: { type: 'string', description: 'De volledige ICS-tekst uit book_appointment.' },
        },
        required: ['label', 'icsText'],
      },
    },
  ];
}

async function main() {
  const source = await readFile(new URL('../docs/lava-agent-config.md', import.meta.url), 'utf8');
  const firstMessage = fencedSection(source, '## 2. Openingszin');
  const prompt = fencedSection(source, '## 3. Systeemprompt');
  const client = new ElevenLabsClient();
  const page = await client.conversationalAi.agents.list({ pageSize: 100 });
  const existing = page.agents.find((agent) => agent.name === 'LAVA' && !agent.archived);

  const config = {
    name: 'LAVA',
    conversationConfig: {
      agent: {
        firstMessage,
        language: 'nl',
        prompt: {
          prompt,
          llm: LAVA_LLM,
          temperature: 0.4,
          timezone: 'Europe/Amsterdam',
          tools: clientTools(),
          builtInTools: {
            endCall: SystemTool.endCall().buildConfig(),
            languageDetection: SystemTool.languageDetection().buildConfig(),
          },
        },
      },
      tts: {
        voiceId: LAVA_VOICE_ID,
        modelId: 'eleven_v3_conversational',
        stability: 0.5,
        similarityBoost: 0.85,
        speed: 1,
      },
      conversation: {
        maxDurationSeconds: 600,
      },
      turn: {
        turnEagerness: 'patient',
      },
    },
    tags: ['mnrv', 'lava'],
  };

  const result = existing
    ? await client.conversationalAi.agents.update(existing.agentId, config)
    : await client.conversationalAi.agents.create(config);

  console.log(JSON.stringify({
    action: existing ? 'updated' : 'created',
    agentId: existing?.agentId ?? result.agentId,
    name: 'LAVA',
    voiceId: LAVA_VOICE_ID,
  }));
}

await main();
