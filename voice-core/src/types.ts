/**
 * Shared types for the Voice Core plugin.
 * Defines the common interface for real-time voice providers (drivers).
 *
 * @module @lifecordis/voice-core/types
 */

/** Audio delta from provider (base64-encoded 16kHz 16-bit mono PCM). */
export interface VoiceAudioDelta {
  pcmBase64: string;
}

/** Callbacks for voice provider events. */
export interface VoiceEventCallbacks {
  /** Called when provider outputs audio to play. */
  onAudioDelta?: (delta: VoiceAudioDelta) => void;
  /** Called when transcript is received (streaming). */
  onTranscriptDelta?: (text: string, isFinal: boolean) => void;
  /** Called when server-side VAD detects user speech (barge-in). */
  onUserInterrupted?: () => void;
  /** Called on connection error. */
  onError?: (err: Error) => void;
  /** Called when connection status changes. */
  onStatusChange?: (status: VoiceConnectionStatus) => void;
}

/** Connection status states. */
export type VoiceConnectionStatus =
  | 'connecting'
  | 'connected'
  | 'listening'
  | 'speaking'
  | 'closed'
  | 'error';

/** Configuration for a voice provider. */
export interface VoiceProviderConfig {
  /** Provider-specific configuration (API keys, endpoints, etc.). */
  [key: string]: unknown;
}

/**
 * Interface that all real-time voice providers (drivers) must implement.
 * Providers handle WebSocket communication with their respective services.
 */
export interface IRealtimeVoiceProvider {
  /** Unique provider identifier (e.g., 'doubao', 'openai', 'minimax'). */
  readonly id: string;

  /** Human-readable provider name (e.g., 'VolcEngine Doubao', 'OpenAI Realtime'). */
  readonly name: string;

  /**
   * Connect to the provider and initialize the session.
   * @param callbacks - Event callbacks for audio, transcripts, interruptions, etc.
   */
  connect(callbacks: VoiceEventCallbacks): Promise<void>;

  /**
   * Send an audio chunk to the provider.
   * @param pcmBase64 - Base64-encoded 16kHz 16-bit mono PCM audio (typically 40ms chunks).
   */
  sendAudio(pcmBase64: string): void;

  /**
   * Interrupt current output (barge-in).
   * Called when user starts speaking while model is responding.
   */
  interrupt(): void;

  /**
   * Disconnect from the provider.
   */
  disconnect(): Promise<void>;

  /** Current connection status. */
  readonly status: VoiceConnectionStatus;
}

/** Factory function for creating provider instances. */
export type VoiceProviderFactory = (config: VoiceProviderConfig) => IRealtimeVoiceProvider;

/** Registry entry for a voice provider. */
export interface VoiceProviderEntry {
  /** Provider factory function. */
  factory: VoiceProviderFactory;
  /** Provider metadata. */
  meta: {
    id: string;
    name: string;
    description?: string;
  };
}

/** Audio recording configuration. */
export interface AudioRecordingConfig {
  /** Sample rate in Hz (default: 16000). */
  sampleRate?: number;
  /** Chunk size in samples (default: 640 = 40ms at 16kHz). */
  chunkSize?: number;
  /** Number of channels (default: 1). */
  channels?: number;
}

/** Audio playback configuration. */
export interface AudioPlaybackConfig {
  /** Sample rate in Hz (default: 24000 for Doubao output). */
  sampleRate?: number;
}

/** Voice session state. */
export interface VoiceSessionState {
  /** Whether a voice session is active. */
  active: boolean;
  /** Currently selected provider ID. */
  providerId: string | null;
  /** Current connection status. */
  status: VoiceConnectionStatus;
  /** Error message if any. */
  error: string | null;
}