/**
 * @lifecordis/voice-core - Voice Interaction Core Plugin for DeepSeek Harness.
 *
 * Provides the foundational infrastructure for real-time voice interaction:
 * - Voice provider registry for multi-provider support
 * - AudioWorklet-based 16kHz PCM recording (client-side)
 * - Streaming PCM playback with millisecond-level barge-in (client-side)
 * - DSH Slot components for UI integration
 *
 * @module @lifecordis/voice-core
 */

import { Context } from '@deepseek-ai/cordis';
import { VoiceRegistryService } from './VoiceRegistryService.js';
import './invariant.js';

// Re-export all types and utilities for provider drivers
export type {
  IRealtimeVoiceProvider,
  VoiceProviderEntry,
  VoiceProviderConfig,
  VoiceProviderFactory,
  VoiceConnectionStatus,
  VoiceSessionState,
  VoiceAudioDelta,
  VoiceEventCallbacks,
  AudioRecordingConfig,
  AudioPlaybackConfig,
} from './types.js';

export { VoiceRegistryService } from './VoiceRegistryService.js';
export { RealtimeAudioRecorder } from './RealtimeAudioRecorder.js';
export { PCMQueuePlayer } from './PCMQueuePlayer.js';

/** Stable Cordis plugin name. */
export const name = 'voice-core';

/** Services this plugin requires. */
export const inject = [] as const;

/**
 * Plugin apply function.
 * Host side: registers VoiceRegistryService.
 * Client side: no-op (client entry uses ./client export with defineClientPlugin).
 * 
 * Detect host vs client context: host has 'credentials' service, client does not.
 */
export function apply(ctx: Context): void {
  // Detect if running in client context (no credentials service)
  // Client entries should not register host services
  if (!('credentials' in ctx)) {
    return; // Client context - skip host service registration
  }

  // Host context: register VoiceRegistryService (idempotent)
  // Use 'in' operator - safe for Proxy, doesn't trigger "without inject"
  if ('voiceRegistry' in ctx) {
    return; // Already registered
  }
  
  new VoiceRegistryService(ctx);

  // Cleanup on plugin dispose
  ctx.on('dispose', () => {
    ctx.voiceRegistry?.clear();
  });
}