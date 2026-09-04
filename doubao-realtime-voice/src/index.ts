/**
 * @lifecordis/doubao-realtime-voice - Doubao (VolcEngine) Real-time Voice Model 3.0 (Seeduplex) plugin
 * for DeepSeek Harness.
 *
 * This plugin provides:
 * - A Host service for connecting to the VolcEngine Doubao Real-time Voice API via WebSocket
 * - A Driver implementation for the voice-core plugin's provider registry
 *
 * @module @lifecordis/doubao-realtime-voice
 */

import { Context } from '@deepseek-ai/cordis';
import { DoubaoDriver } from './DoubaoDriver.js';
import {
  type DoubaoRealtimeVoiceService,
  type DoubaoRealtimeVoiceConfig,
  type SessionConfig,
  DEFAULT_CONFIG,
} from './types.js';
import type { VoiceProviderConfig } from '@lifecordis/voice-core';

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
} from './types.js';
export {
  createSessionConfig,
} from './service.js';
export { DoubaoDriver } from './DoubaoDriver.js';

/** Stable Cordis plugin name. */
export const name = 'doubao-realtime-voice';

/** Services this plugin requires. */
export const inject = ['credentials', 'settings', 'launchEnvironment', 'voiceRegistry'] as const;

/** Plugin configuration schema (validated by schemastery). */
import z from '@deepseek-ai/schemastery';

export const Config: z<Config> = z.object({
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
    type: z.union([z.const('pcm'), z.const('speech_opus')]).default('pcm'),
    rate: z.number().default(16000),
  }).default({ type: 'pcm', rate: 16000 }),
  /** Default audio output format. */
  outputAudioFormat: z.object({
    type: z.union([z.const('pcm'), z.const('ogg_opus')]).default('ogg_opus'),
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
  asrContext: z.dict(z.any()).default({}),
  /** Dialog location info. */
  location: z.dict(z.any()).default({}),
  /** Enable built-in web search capability. */
  enableVolcWebsearch: z.boolean().default(false),
  /** Web search service type. */
  volcWebsearchType: z.union([z.const('web_custom_api'), z.const('web_global_api')]).default('web_custom_api'),
  /** Web search API key. */
  volcWebsearchApiKey: z.string().default(''),
  /** Dialog extra parameters. */
  dialogExtra: z.object({
    strictAudit: z.boolean().default(true),
    auditResponse: z.string().default(''),
    enableMusic: z.boolean().default(false),
    enableLoudnessNorm: z.boolean().default(false),
    enableUserQueryExit: z.boolean().default(false),
  }).default({ strictAudit: true, auditResponse: '', enableMusic: false, enableLoudnessNorm: false, enableUserQueryExit: false }),
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
    }).default({ enable: false, contentProducer: '', produceId: '', contentPropagator: '', propagateId: '' }),
  }).default({ maxLengthToFilterParenthesis: 0, explicitDialect: '', aigcMetadata: { enable: false, contentProducer: '', produceId: '', contentPropagator: '', propagateId: '' } }),
  /** Default tools for function calling (flat Function Calling format). */
  tools: z.array(z.object({
    type: z.const('function'),
    name: z.string(),
    description: z.string(),
    parameters: z.dict(z.any()),
  })).default([]),
});

/** Plugin config type (inferred from schema). */
export type Config = {
  apiKeyEnv: string;
  baseURL: string;
  model: string;
  instructions: string;
  voice: string;
  inputAudioFormat: { type: 'pcm' | 'speech_opus'; rate: number };
  outputAudioFormat: { type: 'pcm' | 'ogg_opus'; rate: number };
  speed: number;
  loudness: number;
  enableAsrTwopass: boolean;
  boostingTableId: string;
  boostingTableName: string;
  regexCorrectTableId: string;
  regexCorrectTableName: string;
  asrContext: Record<string, unknown>;
  location: Record<string, unknown>;
  enableVolcWebsearch: boolean;
  volcWebsearchType: 'web_custom_api' | 'web_global_api';
  volcWebsearchApiKey: string;
  dialogExtra: {
    strictAudit: boolean;
    auditResponse: string;
    enableMusic: boolean;
    enableLoudnessNorm: boolean;
    enableUserQueryExit: boolean;
  };
  ttsExtra: {
    maxLengthToFilterParenthesis: number;
    explicitDialect: string;
    aigcMetadata: {
      enable: boolean;
      contentProducer: string;
      produceId: string;
      contentPropagator: string;
      propagateId: string;
    };
  };
  tools: Array<{ type: 'function'; name: string; description?: string; parameters: Record<string, unknown> }>;
};

/** Service name for the Doubao real-time voice connection (legacy). */
export const DOUBAO_REALTIME_VOICE_SERVICE = 'doubaoRealtimeVoice';

const DRIVER_ID = 'doubao';

/**
 * Convert plugin config to VoiceProviderConfig for the driver.
 */
function toProviderConfig(config: Config): VoiceProviderConfig {
  return {
    apiKeyEnv: config.apiKeyEnv,
    baseURL: config.baseURL,
    model: config.model,
    instructions: config.instructions,
    voice: config.voice,
    inputAudioFormat: config.inputAudioFormat,
    outputAudioFormat: config.outputAudioFormat,
    speed: config.speed,
    loudness: config.loudness,
    enableAsrTwopass: config.enableAsrTwopass,
    boostingTableId: config.boostingTableId,
    boostingTableName: config.boostingTableName,
    regexCorrectTableId: config.regexCorrectTableId,
    regexCorrectTableName: config.regexCorrectTableName,
    asrContext: config.asrContext,
    location: config.location,
    enableVolcWebsearch: config.enableVolcWebsearch,
    volcWebsearchType: config.volcWebsearchType,
    volcWebsearchApiKey: config.volcWebsearchApiKey,
    dialogExtra: config.dialogExtra,
    ttsExtra: config.ttsExtra,
    tools: config.tools,
  };
}

/**
 * Plugin apply function.
 * Registers the DoubaoDriver with voice-core's VoiceRegistryService.
 * Hot-reloads on settings change.
 */
export function apply(ctx: Context, config: Config): void {
  let currentConfig: Config = config;

  // Register driver factory with voice-core registry
  const registerDriver = (): void => {
    ctx.voiceRegistry.register(DRIVER_ID, (providerConfig: VoiceProviderConfig) => {
      // Merge plugin config with provider config
      const mergedConfig = { ...toProviderConfig(currentConfig), ...providerConfig };
      return new DoubaoDriver(ctx, mergedConfig);
    }, {
      name: 'VolcEngine Doubao Seeduplex',
      description: 'Full-duplex end-to-end speech model from VolcEngine',
    });
    ctx.logger.info('doubao-realtime-voice: driver registered with voice-core');
  };

  // Unregister driver
  const unregisterDriver = (): void => {
    ctx.voiceRegistry.unregister(DRIVER_ID);
    ctx.logger.info('doubao-realtime-voice: driver unregistered from voice-core');
  };

  // Initial registration
  registerDriver();

  // Watch for config changes via settings
  // Use installSection to get SettingsScope with onChange
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.installSection(ctx, 'doubao-realtime-voice', Config, config, {
      setSource: (source) => {
        currentConfig = source();
      },
      onChange: async () => {
        ctx.logger.info('doubao-realtime-voice: config changed, re-registering driver');
        unregisterDriver();
        registerDriver();
      },
    });
  });

  // Cleanup on plugin stop
  ctx.on('dispose', () => {
    unregisterDriver();
  });
}