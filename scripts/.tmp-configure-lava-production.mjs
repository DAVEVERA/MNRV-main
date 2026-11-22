import { randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';

import {
  ElevenLabsClient,
  Header,
  Schema,
  Tool,
} from '@elevenlabs/elevenlabs-js';

delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;

const AGENT_ID = 'agent_9101m803w6qzevrtqm1cs9a0ahg5';
const SUPABASE_URL = 'https://tulvzbzjbwxtjnaengwa.supabase.co';
const TOOL_SECRET_NAME = 'MNRV_LAVA_TOOL_SECRET';
const WEBHOOK_NAME = 'MNRV-LAVA-post-call';
const WEBHOOK_URL = 'https://mnrv.nl/api/lava/post-call';
const TOOL_NAMES = ['lava_get_availability', 'lava_book_appointment', 'lava_send_report'];

if (!process.env.ELEVENLABS_API_KEY) {
  throw new Error('ELEVENLABS_API_KEY ontbreekt in de lokale omgeving.');
}

function addVercelSecret(name, value) {
  const body = JSON.stringify({
    key: name,
    value,
    type: 'sensitive',
    target: ['production', 'preview'],
  });
  const result = spawnSync(
    'npx.cmd',
    [
      'vercel',
      'api',
      '/v10/projects/prj_uytMvnEzUJeXOCbKuA95hoLALcR0/env?upsert=true',
      '--input',
      '-',
      '--silent',
      '--non-interactive',
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      input: body,
      env: { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '' },
      shell: true,
      windowsHide: true,
    },
  );
  if (result.status !== 0) {
    throw new Error(`Vercel kon ${name} niet veilig opslaan.`);
  }
  console.log(`Vercel: ${name} ingesteld voor production en preview.`);
}

function optionalText(description) {
  return Schema.string().describe(description).optional();
}

function reportSchema() {
  return Schema.object()
    .property('naam', Schema.string().describe('Volledige naam van de bezoeker.'))
    .property('email', Schema.string().describe('Geverifieerd e-mailadres van de bezoeker.'))
    .property('telefoon', optionalText('Telefoonnummer, indien genoemd.'))
    .property(
      'label',
      Schema.string()
        .describe('Type aanvraag volgens de LAVA-classificatie.')
        .choices(['binnen_de_lijnen', 'buiten_de_lijnen', 'student', 'recruiter', 'bestaande_klant']),
    )
    .property('uitdaging', Schema.string().describe('De concrete uitdaging van de bezoeker.'))
    .property('beoogde_oplossing', optionalText('De besproken of gewenste oplossing.'))
    .property('verwachting', optionalText('Wat de bezoeker van MNRV verwacht.'))
    .property('gespreksdoel', optionalText('Het doel van het gesprek.'))
    .property('uitkomst', optionalText('De uitkomst van het gesprek.'))
    .property('follow_up', optionalText('Afgesproken follow-up.'))
    .property(
      'vervolgactie',
      Schema.object()
        .describe('Concrete vervolgactie en eigenaar.')
        .property('wat', optionalText('Wat er moet gebeuren.'))
        .property('door', optionalText('Wie de actie uitvoert.'))
        .optional(),
    )
    .property('transcript', optionalText('Letterlijke transcriptie als die beschikbaar is.'))
    .property(
      'ending',
      Schema.string()
        .describe('Hoe het gesprek is afgerond.')
        .choices(['appointment', 'follow_up_request', 'callback_request', 'no_opportunity']),
    );
}

function appointmentSchema() {
  return Schema.object()
    .describe('Alleen meesturen wanneer er daadwerkelijk een afspraak is geboekt.')
    .property('startIso', Schema.string().describe('Starttijd uit de geslaagde boekingsresponse.'))
    .property('endIso', Schema.string().describe('Eindtijd uit de geslaagde boekingsresponse.'))
    .property('summary', Schema.string().describe('Samenvatting uit de geslaagde boekingsresponse.'))
    .property('description', Schema.string().describe('Beschrijving uit de geslaagde boekingsresponse.'))
    .property('meetUrl', optionalText('Google Meet-link uit de geslaagde boekingsresponse.'))
    .optional();
}

function buildTools(secretId) {
  const secure = (tool) => tool.header('x-lava-tool-secret', Header.secret(secretId));
  return [
    secure(
      Tool.webhook(
        TOOL_NAMES[0],
        'Haal maximaal drie beschikbare MNRV-afspraaktijden op. Gebruik dit pas nadat de bezoeker om een afspraak of terugbelmoment vraagt.',
      )
        .post('https://mnrv.nl/api/lava/availability')
        .body(Schema.object())
        .options({ responseTimeoutSecs: 20 }),
    ),
    secure(
      Tool.webhook(
        TOOL_NAMES[1],
        'Boek uitsluitend een tijdstip dat lava_get_availability zojuist heeft aangeboden en nadat naam, e-mail, uitdaging en afspraaktype bevestigd zijn.',
      )
        .post('https://mnrv.nl/api/lava/book')
        .body(
          Schema.object()
            .property('kind', Schema.string().describe('Afspraaktype.').choices(['intake', 'callback']))
            .property('naam', Schema.string().describe('Volledige naam van de bezoeker.'))
            .property('email', Schema.string().describe('Bevestigd e-mailadres.'))
            .property('telefoon', optionalText('Verplicht bij callback, anders optioneel.'))
            .property('uitdaging', Schema.string().describe('Korte concrete omschrijving van de uitdaging.'))
            .property('startIso', Schema.string().describe('Exact startIso uit de gekozen beschikbaarheidsoptie.'))
            .property('conversationId', Schema.string().fromVariable('system__conversation_id')),
        )
        .options({ responseTimeoutSecs: 30 }),
    ),
    secure(
      Tool.webhook(
        TOOL_NAMES[2],
        'Lever eenmaal aan het einde van het gesprek het gestructureerde MNRV-intakerapport af. Gebruik feiten uit het gesprek en verzin niets.',
      )
        .post('https://mnrv.nl/api/lava/report')
        .body(
          Schema.object()
            .property('conversationId', Schema.string().fromVariable('system__conversation_id'))
            .property('report', reportSchema())
            .property('appointment', appointmentSchema()),
        )
        .options({ responseTimeoutSecs: 30 }),
    ),
  ];
}

const client = new ElevenLabsClient({ apiKey: process.env.ELEVENLABS_API_KEY });
const toolSecret = randomBytes(32).toString('base64url');

addVercelSecret('ELEVENLABS_API_KEY', process.env.ELEVENLABS_API_KEY);
addVercelSecret('LAVA_AGENT_ID', AGENT_ID);
addVercelSecret('LAVA_DAILY_LIMIT', '20');
addVercelSecret('SUPABASE_URL', SUPABASE_URL);
addVercelSecret('LAVA_TOOL_SECRET', toolSecret);

const secretList = await client.conversationalAi.secrets.list({ pageSize: 100 });
let storedSecret = secretList.secrets.find((item) => item.name === TOOL_SECRET_NAME);
if (storedSecret) {
  await client.conversationalAi.secrets.update(storedSecret.secretId, {
    name: TOOL_SECRET_NAME,
    value: toolSecret,
  });
  console.log(`ElevenLabs: workspace-secret ${TOOL_SECRET_NAME} geroteerd.`);
} else {
  storedSecret = await client.conversationalAi.secrets.create({
    name: TOOL_SECRET_NAME,
    value: toolSecret,
  });
  console.log(`ElevenLabs: workspace-secret ${TOOL_SECRET_NAME} aangemaakt.`);
}

const currentTools = await client.conversationalAi.tools.list({ pageSize: 100 });
const serverToolIds = [];
for (const tool of buildTools(storedSecret.secretId)) {
  const existing = currentTools.tools.find((item) => item.toolConfig?.name === tool.name);
  const saved = existing
    ? await client.conversationalAi.tools.update(existing.id, tool.build())
    : await client.conversationalAi.tools.create(tool.build());
  serverToolIds.push(saved.id);
  console.log(`ElevenLabs: tool ${tool.name} ${existing ? 'bijgewerkt' : 'aangemaakt'}.`);
}

const currentWebhooks = await client.webhooks.list();
const conflictingWebhook = currentWebhooks.webhooks.find((item) => item.name === WEBHOOK_NAME);
if (conflictingWebhook) {
  throw new Error(`Webhook ${WEBHOOK_NAME} bestaat al; geheime sleutel wordt niet blind geroteerd.`);
}
const oauthEnv = { ...process.env, NODE_TLS_REJECT_UNAUTHORIZED: '' };
delete oauthEnv.ELEVENLABS_API_KEY;
const webhookResult = spawnSync(
  'npx.cmd',
  [
    '-y',
    '@elevenlabs/cli@latest',
    'webhooks',
    'create',
    '--settings.name',
    WEBHOOK_NAME,
    '--settings.webhook-url',
    WEBHOOK_URL,
    '--settings.auth-type',
    'hmac',
    '--format',
    'json',
  ],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: oauthEnv,
    shell: true,
    windowsHide: true,
  },
);
if (webhookResult.status !== 0) {
  throw new Error('ElevenLabs OAuth kon de HMAC-webhook niet aanmaken.');
}
const webhook = JSON.parse(webhookResult.stdout);
const webhookId = webhook.webhookId ?? webhook.webhook_id;
const webhookSecret = webhook.webhookSecret ?? webhook.webhook_secret;
if (!webhookId || !webhookSecret) throw new Error('ElevenLabs gaf geen complete HMAC-webhookgegevens terug.');
addVercelSecret('ELEVENLABS_WEBHOOK_SECRET', webhookSecret);
console.log(`ElevenLabs: HMAC-webhook ${webhookId} aangemaakt.`);

const agent = await client.conversationalAi.agents.get(AGENT_ID);
const existingToolIds = agent.conversationConfig?.agent?.prompt?.toolIds ?? [];
const toolIds = [...new Set([...existingToolIds, ...serverToolIds])];
await client.conversationalAi.agents.update(AGENT_ID, {
  conversationConfig: {
    agent: {
      prompt: { toolIds },
    },
  },
  platformSettings: {
    workspaceOverrides: {
      webhooks: {
        postCallWebhookId: webhookId,
        events: ['transcript'],
        transcriptFormat: 'json',
        excludeTranscript: false,
      },
    },
    callLimits: {
      agentConcurrencyLimit: 3,
      dailyLimit: 20,
      burstingEnabled: false,
    },
    privacy: {
      recordVoice: true,
      retentionDays: 90,
      deleteTranscriptAndPii: false,
      deleteAudio: false,
      zeroRetentionMode: false,
    },
  },
  versionDescription: 'Beveiligde MNRV LAVA servertools en post-call webhook',
});
console.log(`ElevenLabs: agent ${AGENT_ID} gekoppeld aan ${serverToolIds.length} servertools en de post-call webhook.`);

