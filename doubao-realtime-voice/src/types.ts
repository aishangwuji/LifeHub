/**
 * TypeScript types for Doubao (VolcEngine) Real-time Voice Model 3.0 (Seeduplex) protocol.
 * Based on the official API documentation for the full-duplex end-to-end speech model.
 * @module @lifecordis/doubao-realtime-voice/types
 */

// ============================================================================
// Base Types
// ============================================================================

/** Supported audio input formats. */
export type InputAudioFormatType = 'pcm' | 'speech_opus';

/** Supported audio output formats. */
export type OutputAudioFormatType = 'pcm' | 'ogg_opus';

/** Supported voice IDs (supports official voices and custom/cloned voices). */
export type VoiceId = string;

/** Dialog extra parameters (strictly snake_case per VolcEngine protocol). */
export interface DialogExtra {
  strict_audit?: boolean;
  audit_response?: string;
  enable_music?: boolean;
  enable_loudness_norm?: boolean;
  enable_user_query_exit?: boolean;
}

/** TTS extra parameters. */
export interface TtsExtra {
  max_length_to_filter_parenthesis?: number;
  explicit_dialect?: string;
  aigc_metadata?: {
    enable?: boolean;
    content_producer?: string;
    produce_id?: string;
    content_propagator?: string;
    propagate_id?: string;
  };
}

/** ASR context configuration. */
export interface AsrContext {
  hotwords?: Array<{ word: string }>;
  correct_words?: Record<string, string>;
}

/** Location information. */
export interface Location {
  longitude?: number;
  latitude?: number;
  city?: string;
  country?: string;
  province?: string;
  district?: string;
  town?: string;
  country_code?: string;
  address?: string;
}

/** Audio input configuration. */
export interface AudioInputConfig {
  format: {
    type: InputAudioFormatType;
    rate: number; // Must be 16000
  };
}

/** Audio output configuration. */
export interface AudioOutputConfig {
  format: {
    type: OutputAudioFormatType;
    rate: number; // Must be 24000
  };
  voice: VoiceId;
  speed?: number; // -50 to 100
  loudness?: number; // -50 to 100
}

/** Session configuration. */
export interface SessionConfig {
  id?: string; // For continuing a session
  model: string; // Fixed: '1.2.6.1'
  instructions?: string; // System prompt
  audio: {
    input: AudioInputConfig;
    output: AudioOutputConfig;
  };
  tools?: ToolDefinition[];
  extension?: {
    asr?: {
      extra?: {
        enable_asr_twopass?: boolean;
        boosting_table_id?: string;
        boosting_table_name?: string;
        regex_correct_table_id?: string;
        regex_correct_table_name?: string;
        context?: AsrContext;
      };
    };
    dialog?: {
      location?: Location;
      dialog_context?: Array<{ role: 'user' | 'assistant'; text: string; timestamp?: number }>;
      extra?: DialogExtra;
    };
    tts?: {
      audio_config?: {
        type: OutputAudioFormatType;
        rate: 24000;
      };
      extra?: TtsExtra;
    };
  };
}

// ============================================================================
// Tool Definition (Function Calling)
// ============================================================================

/** Standard Function Calling tool definition (flat JSON Schema structure). */
export interface ToolDefinition {
  type: 'function';
  name: string;
  description?: string;
  parameters: Record<string, unknown>; // JSON Schema
}

// ============================================================================
// Upstream Events (Client -> Server)
// ============================================================================

export interface BaseUpstreamEvent {
  type: string;
  event_id?: string;
}

export interface SessionCreateEvent extends BaseUpstreamEvent {
  type: 'session.create';
  session: SessionConfig;
}

export interface SessionUpdateEvent extends BaseUpstreamEvent {
  type: 'session.update';
  session: Partial<SessionConfig> & { id?: string };
}

export interface SessionCloseEvent extends BaseUpstreamEvent {
  type: 'session.close';
}

export interface InputAudioBufferAppendEvent extends BaseUpstreamEvent {
  type: 'input_audio_buffer.append';
  audio: string; // Base64 encoded audio data
}

export interface InputAudioBufferCommitEvent extends BaseUpstreamEvent {
  type: 'input_audio_buffer.commit';
}

export interface InputAudioMuteCommitEvent extends BaseUpstreamEvent {
  type: 'input_audio_mute.commit';
}

export interface InputAudioUnmuteCommitEvent extends BaseUpstreamEvent {
  type: 'input_audio_unmute.commit';
}

export interface SpeechTextBufferCommitEvent extends BaseUpstreamEvent {
  type: 'speech_text_buffer.commit';
  text: string;
}

export interface SpeechTextBufferReplacementAppendEvent extends BaseUpstreamEvent {
  type: 'speech_text_buffer.replacement.append';
  text: string;
}

export interface SpeechTextBufferReplacementCommitEvent extends BaseUpstreamEvent {
  type: 'speech_text_buffer.replacement.commit';
}

export interface ConversationItemCreateEvent extends BaseUpstreamEvent {
  type: 'conversation.item.create';
  items: ConversationItem[];
}

export interface ConversationItemUpdateEvent extends BaseUpstreamEvent {
  type: 'conversation.item.update';
  items: Array<{ id: string; content: ConversationContent[] }>;
}

export interface ConversationItemRetrieveEvent extends BaseUpstreamEvent {
  type: 'conversation.item.retrieve';
  items?: Array<{ id: string }>;
}

export interface ConversationItemDeleteEvent extends BaseUpstreamEvent {
  type: 'conversation.item.delete';
  items: Array<{ id: string }>;
}

export interface ResponseCancelEvent extends BaseUpstreamEvent {
  type: 'response.cancel';
}

/** Conversation item block. Supports user/assistant messages and tool call results. */
export type ConversationItem =
  | {
      id?: string;
      type: 'message';
      role: 'user' | 'assistant';
      content: ConversationContent[];
    }
  | {
      call_id: string;
      role: 'tool';
      content: Array<{
        type: 'input_text';
        text: string;
      }>;
    };

export interface ConversationContent {
  type: 'input_text' | 'input_audio' | 'output_text' | 'output_audio';
  text?: string;
  audio?: string;
}

export type UpstreamEvent =
  | SessionCreateEvent
  | SessionUpdateEvent
  | SessionCloseEvent
  | InputAudioBufferAppendEvent
  | InputAudioBufferCommitEvent
  | InputAudioMuteCommitEvent
  | InputAudioUnmuteCommitEvent
  | SpeechTextBufferCommitEvent
  | SpeechTextBufferReplacementAppendEvent
  | SpeechTextBufferReplacementCommitEvent
  | ConversationItemCreateEvent
  | ConversationItemUpdateEvent
  | ConversationItemRetrieveEvent
  | ConversationItemDeleteEvent
  | ResponseCancelEvent;

// ============================================================================
// Downstream Events (Server -> Client)
// ============================================================================

export interface BaseDownstreamEvent {
  type: string;
  event_id?: string;
  session_id?: string;
}

export interface SessionCreatedEvent extends BaseDownstreamEvent {
  type: 'session.created';
  session: {
    id: string;
    model: string;
  };
}

export interface SessionUpdatedEvent extends BaseDownstreamEvent {
  type: 'session.updated';
}

export interface SessionClosedEvent extends BaseDownstreamEvent {
  type: 'session.closed';
}

export interface InputAudioBufferCommittedEvent extends BaseDownstreamEvent {
  type: 'input_audio_buffer.committed';
}

export interface ConversationItemInputAudioTranscriptionStartedEvent extends BaseDownstreamEvent {
  type: 'conversation.item.input_audio_transcription.started';
  item_id: string;
}

export interface ConversationItemInputAudioTranscriptionDeltaEvent extends BaseDownstreamEvent {
  type: 'conversation.item.input_audio_transcription.delta';
  item_id: string;
  delta: string;
}

export interface ConversationItemInputAudioTranscriptionCompletedEvent extends BaseDownstreamEvent {
  type: 'conversation.item.input_audio_transcription.completed';
  item_id: string;
  text: string;
}

export interface ConversationItemInputAudioTranscriptionFailedEvent extends BaseDownstreamEvent {
  type: 'conversation.item.input_audio_transcription.failed';
  item_id: string;
  error: {
    code: string;
    message: string;
  };
}

export interface ResponseOutputTextDeltaEvent extends BaseDownstreamEvent {
  type: 'response.output_text.delta';
  item_id: string;
  delta: string;
}

export interface ResponseOutputTextDoneEvent extends BaseDownstreamEvent {
  type: 'response.output_text.done';
  item_id: string;
  text: string;
}

export interface ResponseOutputAudioStartedEvent extends BaseDownstreamEvent {
  type: 'response.output_audio.started';
  item_id: string;
  tts_type: 'audit_content_risky' | 'chat_tts_text' | 'network' | 'default';
}

export interface ResponseOutputAudioDeltaEvent extends BaseDownstreamEvent {
  type: 'response.output_audio.delta';
  item_id: string;
  delta: string;
}

export interface ResponseOutputAudioDoneEvent extends BaseDownstreamEvent {
  type: 'response.output_audio.done';
  item_id: string;
  status_code?: string;
}

export interface ConversationItemAddedEvent extends BaseDownstreamEvent {
  type: 'conversation.item.added';
  items: ConversationItem[];
}

export interface ConversationItemRetrievedEvent extends BaseDownstreamEvent {
  type: 'conversation.item.retrieved';
  items: ConversationItem[];
}

export interface ConversationItemDeletedEvent extends BaseDownstreamEvent {
  type: 'conversation.item.deleted';
  items: Array<{ id: string }>;
}

export interface ResponseFunctionCallArgumentsDoneEvent extends BaseDownstreamEvent {
  type: 'response.function_call_arguments.done';
  items: FunctionCallItem[];
}

export interface FunctionCallItem {
  call_id: string;
  name: string;
  arguments: string; // JSON string
}

export interface ResponseDoneEvent extends BaseDownstreamEvent {
  type: 'response.done';
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
    input_audio_tokens?: number;
    output_audio_tokens?: number;
  };
}

export interface ResponseCanceledEvent extends BaseDownstreamEvent {
  type: 'response.canceled';
}

export interface ErrorEvent extends BaseDownstreamEvent {
  type: 'error';
  error: {
    code: string | number;
    message: string;
    status_code?: number;
  };
}

export type DownstreamEvent =
  | SessionCreatedEvent
  | SessionUpdatedEvent
  | SessionClosedEvent
  | InputAudioBufferCommittedEvent
  | ConversationItemInputAudioTranscriptionStartedEvent
  | ConversationItemInputAudioTranscriptionDeltaEvent
  | ConversationItemInputAudioTranscriptionCompletedEvent
  | ConversationItemInputAudioTranscriptionFailedEvent
  | ResponseOutputTextDeltaEvent
  | ResponseOutputTextDoneEvent
  | ResponseOutputAudioStartedEvent
  | ResponseOutputAudioDeltaEvent
  | ResponseOutputAudioDoneEvent
  | ConversationItemAddedEvent
  | ConversationItemRetrievedEvent
  | ConversationItemDeletedEvent
  | ResponseFunctionCallArgumentsDoneEvent
  | ResponseDoneEvent
  | ResponseCanceledEvent
  | ErrorEvent;

// ============================================================================
// Service & Plugin Config
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'closing' | 'error';

export interface DoubaoRealtimeVoiceOptions {
  apiKey: string;
  baseURL?: string;
  config: SessionConfig;
  onEvent?: (event: DownstreamEvent) => void;
  onStateChange?: (state: ConnectionState) => void;
  onError?: (error: Error) => void;
}

export interface DoubaoRealtimeVoiceService {
  readonly state: ConnectionState;
  readonly sessionId: string | undefined;
  connect(): Promise<void>;
  send(event: UpstreamEvent): void;
  sendAudio(audioBase64: string): void;
  sendText(text: string): void;
  commitAudio(): void;
  muteAudio(): void;
  unmuteAudio(): void;
  updateSession(config: Partial<SessionConfig>): void;
  createConversationItem(items: ConversationItem[]): void;
  updateConversationItem(items: Array<{ id: string; content: ConversationContent[] }>): void;
  retrieveConversation(items?: Array<{ id: string }>): void;
  deleteConversationItem(items: Array<{ id: string }>): void;
  cancelResponse(): void;
  on<T extends DownstreamEvent['type']>(type: T, handler: (event: Extract<DownstreamEvent, { type: T }>) => void): () => void;
  disconnect(): Promise<void>;
}

export interface DoubaoRealtimeVoiceConfig {
  apiKeyEnv: string;
  baseURL: string;
  model: string;
  instructions: string;
  voice: VoiceId;
  inputAudioFormat: {
    type: InputAudioFormatType;
    rate: number;
  };
  outputAudioFormat: {
    type: OutputAudioFormatType;
    rate: number;
  };
  speed: number;
  loudness: number;
  enableAsrTwopass: boolean;
  boostingTableId: string;
  boostingTableName: string;
  regexCorrectTableId: string;
  regexCorrectTableName: string;
  asrContext: AsrContext;
  location: Location;
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
  tools: ToolDefinition[];
}

export const DEFAULT_CONFIG: DoubaoRealtimeVoiceConfig = {
  apiKeyEnv: 'DOUBAO_API_KEY',
  baseURL: '',
  model: '1.2.6.1',
  instructions: '',
  voice: 'zh_female_shengjie',
  inputAudioFormat: { type: 'pcm', rate: 16000 },
  outputAudioFormat: { type: 'ogg_opus', rate: 24000 },
  speed: 0,
  loudness: 0,
  enableAsrTwopass: false,
  boostingTableId: '',
  boostingTableName: '',
  regexCorrectTableId: '',
  regexCorrectTableName: '',
  asrContext: {},
  location: {},
  enableVolcWebsearch: false,
  volcWebsearchType: 'web_custom_api',
  volcWebsearchApiKey: '',
  dialogExtra: {
    strictAudit: true,
    auditResponse: '',
    enableMusic: false,
    enableLoudnessNorm: false,
    enableUserQueryExit: false,
  },
  ttsExtra: {
    maxLengthToFilterParenthesis: 0,
    explicitDialect: '',
    aigcMetadata: {
      enable: false,
      contentProducer: '',
      produceId: '',
      contentPropagator: '',
      propagateId: '',
    },
  },
  tools: [],
};