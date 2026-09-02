/**
 * @lifecordis/doubao-realtime-voice - Doubao (VolcEngine) Real-time Voice Model 3.0 (Seeduplex) plugin
 * for DeepSeek Harness.
 *
 * This plugin provides a Host service for connecting to the VolcEngine Doubao
 * Real-time Voice API via WebSocket, implementing the full-duplex Seeduplex protocol.
 *
 * @module @lifecordis/doubao-realtime-voice
 */

import type { Context } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import { credentialRef } from '@deepseek-ai/dsh-credentials';
import { launchEnvironmentOf } from '@deepseek-ai/dsh-launch-environment';
import type {} from '@deepseek-ai/dsh-settings';
import {
  DoubaoRealtimeVoiceServiceImpl,
  createSessionConfig,
  type DoubaoRealtimeVoiceService,
  type DoubaoRealtimeVoiceConfig,
  type SessionConfig,
  DEFAULT_CONFIG,
} from './types.js';
import type { DoubaoRealtimeVoiceConfig as ConfigType } from './types.js';

// Re-export types
export type {
  DoubaoRealtimeVoiceService,
  DoubaoRealtimeVoiceConfig,
  SessionConfig,
  DoubaoRealtimeVoiceOptions,
  ConnectionState,
  UpstreamEvent,
  DownstreamEvent,
  VoiceId,
  InputAudioFormatType,
  OutputAudioFormatType,
  ToolDefinition,
  ConversationItem,
  ConversationContent,
  DialogExtra,
  TtsExtra,
  AsrContext,
  Location,
} from './types.js';

export {
  DEFAULT_CONFIG,
  createSessionConfig,
} from './types.js';

/** Stable Cordis plugin name. */
export const name = 'doubao-realtime-voice';

/** Services this plugin requires. */
export const inject = ['credentials', 'settings', 'launchEnvironment'] as const;

/** Plugin configuration schema (validated by schemastery). */
export const Config = z.object({
  /** Credential reference (environment-variable name) resolved per request. */
  apiKeyEnv: z.string().role('credential-ref').default('DOUBAO_API_KEY'),
  /** Endpoint base URL; falls back to $DOUBAO_BASE_URL then public API. */
  baseURL: z.string().default(''),
  /** Model identifier (fixed to '1.2.6.1' for Seeduplex). */
  model: z.string().default('1.2.6.1'),
  /** System prompt (instructions for the model). */
  instructions: z.string().default(''),
  /** Default voice ID. */
  voice: z.string().default('zh_female_shengjie'),
  /** Default audio input format. */
  inputAudioFormat: z.object({
    type: z.enum(['pcm', 'speech_opus']).default('pcm'),
    rate: z.number().default(16000),
  }).default({ type: 'pcm', rate: 16000 }),
  /** Default audio output format. */
  outputAudioFormat: z.object({
    type: z.enum(['pcm', 'ogg_opus']).default('ogg_opus'),
    rate: z.number().default(24000),
  }).default({ type: 'ogg_opus', rate: 24000 }),
  /** Default language speed (-50 to 100). */
  speed: z.number().min(-50).max(100).default(0),
  /** Default volume level (-50 to 100). */
  loudness: z.number().min(-50).max(100).default(0),
  /** Enable ASR two-pass recognition. */
  enableAsrTwopass: z.boolean().default(false),
  /** Hotword table ID for ASR. */
  boostingTableId: z.string().default(''),
  /** Hotword table name for ASR. */
  boostingTableName: z.string().default(''),
  /** Regex correct table ID for ASR. */
  regexCorrectTableId: z.string().default(''),
  /** Regex correct table name for ASR. */
  regexCorrectTableName: z.string().default(''),
  /** ASR context with hotwords and correct words. */
  asrContext: z.record(z.unknown()).default({}),
  /** Dialog location info. */
  location: z.record(z.unknown()).default({}),
  /** Enable built-in web search capability. */
  enableVolcWebsearch: z.boolean().default(false),
  /** Web search service type. */
  volcWebsearchType: z.enum(['web_custom_api', 'web_global_api']).default('web_custom_api'),
  /** Web search API key. */
  volcWebsearchApiKey: z.string().default(''),
  /** Dialog extra parameters. */
  dialogExtra: z.object({
    strictAudit: z.boolean().default(true),
    auditResponse: z.string().default(''),
    enableMusic: z.boolean().default(false),
    enableLoudnessNorm: z.boolean().default(false),
    enableUserQueryExit: z.boolean().default(false),
  }).default({}),
  /** TTS extra parameters. */
  ttsExtra: z.object({
    maxLengthToFilterParenthesis: z.number().default(0),
    explicitDialect: z.string().default(''),
    aigcMetadata: z.object({
      enable: z.boolean().default(false),
      contentProducer: z.string().default(''),
      produceId: z.string().default(''),
      contentPropagator: z.string().default(''),
      propagateId: z.string().default(''),
    }).default({}),
  }).default({}),
  /** Default tools for function calling (flat Function Calling format). */
  tools: z.array(z.object({
    type: z.literal('function'),
    name: z.string(),
    description: z.string().optional(),
    parameters: z.record(z.unknown()),
  })).default([]),
});

/** Plugin config type (inferred from schema). */
export interface Config extends z.infer<typeof Config> {}

/** Service name for the Doubao real-time voice connection. */
export const DOUBAO_REALTIME_VOICE_SERVICE = 'doubaoRealtimeVoice';

/**
 * Resolve connection options from config and environment.
 */
function resolveConnectionOptions(config: Config): {
  apiKeyEnv: ReturnType<typeof credentialRef>;
  baseURL: string;
  sessionConfig: SessionConfig;
} {
  const baseURL = config.baseURL
    || launchEnvironmentOf({} as Context).get('DOUBAO_BASE_URL')?.value
    || 'wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue';

  return {
    apiKeyEnv: credentialRef(config.apiKeyEnv),
    baseURL,
    sessionConfig: createSessionConfig(config as DoubaoRealtimeVoiceConfig),
  };
}

/**
 * Plugin apply function.
 * Registers the Doubao Real-time Voice service on the context.
 */
export function apply(ctx: Context, config: Config): void {
  let currentConfig: Config = config;
  let serviceInstance: DoubaoRealtimeVoiceServiceImpl | null = null;

  // Function to resolve API key from credentials or environment
  const resolveApiKey = async (): Promise<string> => {
    const credentials = ctx.get('credentials');
    const ref = currentConfig.apiKeyEnv;

    if (credentials !== undefined) {
      const hit = await credentials.resolve(ref);
      if (hit !== undefined && hit.value.length > 0) {
        return hit.value;
      }
    }

    // Fallback to environment variable
    const env = launchEnvironmentOf(ctx);
    const ambient = env.get(ref);
    if (ambient !== undefined && ambient.value.length > 0) {
      return ambient.value;
    }

    throw new Error(
      `doubao-realtime-voice: no API key for provider; store ${ref} through the credentials service`
      + ` or export ${ref} in the launching environment`
    );
  };

  // Create or recreate the service instance
  const createService = async (): Promise<DoubaoRealtimeVoiceServiceImpl> => {
    const apiKey = await resolveApiKey();
    const { baseURL, sessionConfig } = resolveConnectionOptions(currentConfig);

    const service = new DoubaoRealtimeVoiceServiceImpl(ctx, {
      apiKey,
      baseURL,
      config: sessionConfig,
    });

    return service;
  };

  // Initialize service
  const initializeService = async (): Promise<void> => {
    try {
      serviceInstance = await createService();
      ctx.provide(DOUBAO_REALTIME_VOICE_SERVICE, serviceInstance);
      ctx.logger.info('doubao-realtime-voice: service registered');
    } catch (error) {
      ctx.logger.error('doubao-realtime-voice: failed to initialize service', error);
      // Still provide a placeholder that will error on use
      const placeholder = {
        state: 'error' as const,
        sessionId: undefined,
        connect: async () => { throw error; },
        send: () => { throw error; },
        sendAudio: () => { throw error; },
        sendText: () => { throw error; },
        commitAudio: () => { throw error; },
        muteAudio: () => { throw error; },
        unmuteAudio: () => { throw error; },
        updateSession: () => { throw error; },
        createConversationItem: () => { throw error; },
        updateConversationItem: () => { throw error; },
        retrieveConversation: () => { throw error; },
        deleteConversationItem: () => { throw error; },
        cancelResponse: () => { throw error; },
        on: () => () => {},
        onStateChange: () => () => {},
        onError: () => () => {},
        disconnect: async () => {},
      } as DoubaoRealtimeVoiceService;
      ctx.provide(DOUBAO_REALTIME_VOICE_SERVICE, placeholder);
    }
  };

  // Initial initialization
  void initializeService();

  // Watch for config changes via settings
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, 'doubao-realtime-voice', Config, config, {
      setSource: (source) => {
        currentConfig = source();
      },
      onChange: async () => {
        ctx.logger.info('doubao-realtime-voice: config changed, reinitializing service');
        if (serviceInstance) {
          await serviceInstance.disconnect();
        }
        await initializeService();
      },
    });
  });

  // Cleanup on plugin stop
  ctx.effect(() => {
    return () => {
      if (serviceInstance) {
        void serviceInstance.disconnect();
        serviceInstance = null;
      }
    };
  });
}