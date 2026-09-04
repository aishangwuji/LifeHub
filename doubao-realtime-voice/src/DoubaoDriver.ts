/**
 * Doubao Driver - Implements IRealtimeVoiceProvider for VolcEngine Doubao.
 * Handles WebSocket communication with the Doubao Seeduplex API.
 *
 * @module @lifecordis/doubao-realtime-voice/DoubaoDriver
 */

import type { Context } from '@deepseek-ai/cordis';
import { WebSocket } from 'ws';
import type {
  IRealtimeVoiceProvider,
  VoiceEventCallbacks,
  VoiceAudioDelta,
  VoiceConnectionStatus,
  VoiceProviderConfig,
} from '@lifecordis/voice-core';
import {
  type DoubaoRealtimeVoiceConfig,
  type UpstreamEvent,
  type DownstreamEvent,
  type SessionConfig,
  DEFAULT_CONFIG,
} from './types.js';
import { createSessionConfig } from './service.js';

const DEFAULT_BASE_URL = 'wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue';
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;

/**
 * Doubao Driver implementation.
 * Adapts the existing DoubaoRealtimeVoiceService to the IRealtimeVoiceProvider interface.
 */
export class DoubaoDriver implements IRealtimeVoiceProvider {
  readonly id = 'doubao';
  readonly name = 'VolcEngine Doubao Seeduplex';

  private ws: WebSocket | null = null;
  private _status: VoiceConnectionStatus = 'closed';
  private config: DoubaoRealtimeVoiceConfig;
  private apiKey: string;
  private baseURL: string;
  private callbacks: VoiceEventCallbacks = {};
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private ctx: Context;
  private sessionId: string | undefined;

  // Connection promise control
  private connectResolve: (() => void) | null = null;
  private connectReject: ((reason?: any) => void) | null = null;
  // Keep-alive
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: Context, config: VoiceProviderConfig) {
    this.ctx = ctx;
    this.config = { ...DEFAULT_CONFIG, ...config } as DoubaoRealtimeVoiceConfig;
    this.apiKey = '';
    this.baseURL = this.config.baseURL || DEFAULT_BASE_URL;
  }

  get status(): VoiceConnectionStatus {
    return this._status;
  }

  private setStatus(newStatus: VoiceConnectionStatus): void {
    if (this._status !== newStatus) {
      this._status = newStatus;
      this.callbacks.onStatusChange?.(newStatus);
    }
  }

  private notifyError(error: Error): void {
    this.callbacks.onError?.(error);
  }

  private emitAudioDelta(pcmBase64: string): void {
    this.callbacks.onAudioDelta?.({ pcmBase64 });
  }

  private emitTranscript(text: string, isFinal: boolean): void {
    this.callbacks.onTranscriptDelta?.(text, isFinal);
  }

  private emitInterruption(): void {
    this.callbacks.onUserInterrupted?.();
  }

  /**
   * Resolve API key from credentials service.
   */
  private async resolveApiKey(): Promise<string> {
    // The host plugin provides credentials service
    const credentials = this.ctx.get('credentials');
    const ref = this.config.apiKeyEnv || 'DOUBAO_API_KEY';

    if (credentials) {
      const hit = await credentials.resolve({ name: ref, type: 'env' });
      if (hit?.value?.length) {
        return hit.value;
      }
    }

    // Fallback to environment
    const launchEnv = this.ctx.get('launchEnvironment');
    if (launchEnv) {
      const ambient = launchEnv.get(ref);
      if (ambient?.value?.length) {
        return ambient.value;
      }
    }

    throw new Error(
      `doubao-realtime-voice: no API key for provider; store ${ref} through the credentials service` +
      ` or export ${ref} in the launching environment`
    );
  }

  /**
   * Connect to Doubao Realtime Voice API.
   */
  async connect(callbacks: VoiceEventCallbacks): Promise<void> {
    if (this._status === 'connecting' || this._status === 'connected') {
      return;
    }

    this.callbacks = callbacks;
    this.setStatus('connecting');
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        this.setStatus('closed');
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        reject(new Error('Connection timeout after 10s waiting for session.created'));
      }, 10000);

      try {
        this.apiKey = await this.resolveApiKey();

        this.ws = new WebSocket(this.baseURL, {
          headers: {
            'X-Api-Key': this.apiKey,
          },
        });

        this.ws.onopen = () => {
          this.ctx.logger.info('DoubaoDriver: WebSocket opened, sending session.create');
          try {
            const sessionConfig = createSessionConfig(this.config);
            const createEvent: UpstreamEvent = {
              type: 'session.create',
              session: sessionConfig,
            };
            this.ws?.send(JSON.stringify(createEvent));
          } catch (err) {
            clearTimeout(timeout);
            this.ws?.close();
            reject(err);
          }
        };

        this.ws.onmessage = (event) => {
          try {
            const data = typeof event.data === 'string' ? event.data : event.data.toString();
            const parsed = JSON.parse(data) as DownstreamEvent;
            this.handleDownstreamEvent(parsed);
          } catch (error) {
            this.ctx.logger.error('DoubaoDriver: failed to parse message', error);
          }
        };

        this.ws.onerror = (error) => {
          this.ctx.logger.error('DoubaoDriver: WebSocket error', error);
          this.notifyError(new Error(`WebSocket error: ${error.message}`));
        };

        this.ws.onclose = (event) => {
          this.ctx.logger.info(`DoubaoDriver: WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
          this.setStatus('closed');
          this.ws = null;
          this.sessionId = undefined;
          this.stopKeepAlive();

          if (this.connectReject) {
            clearTimeout(timeout);
            this.connectReject(new Error(`WebSocket closed before session.created: code=${event.code}, reason=${event.reason || 'none'}`));
            this.connectResolve = null;
            this.connectReject = null;
          }

          if (this.shouldReconnect && this.reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
            this.notifyError(new Error('Max reconnection attempts reached'));
          }
        };

        this.connectResolve = () => {
          clearTimeout(timeout);
          this.setStatus('connected');
          this.reconnectAttempts = 0;
          this.connectResolve = null;
          this.connectReject = null;
          resolve();
        };

        this.connectReject = (err) => {
          clearTimeout(timeout);
          this.connectResolve = null;
          this.connectReject = null;
          reject(err);
        };
      } catch (error) {
        clearTimeout(timeout);
        this.setStatus('error');
        reject(error);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    const delay = Math.min(
      RECONNECT_BASE_DELAY * Math.pow(2, this.reconnectAttempts),
      RECONNECT_MAX_DELAY
    );

    this.ctx.logger.info(`DoubaoDriver: scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setStatus('connecting');
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect(this.callbacks).catch((error) => {
        this.ctx.logger.error('DoubaoDriver: reconnect failed', error);
      });
    }, delay);
  }

  private handleDownstreamEvent(event: DownstreamEvent): void {
    this.ctx.logger.debug(`DoubaoDriver: received event ${event.type}`);

    // Handle session created
    if (event.type === 'session.created') {
      this.sessionId = event.session.id;
      this.ctx.logger.info(`DoubaoDriver: session created ${this.sessionId}`);
      if (this.connectResolve) {
        this.connectResolve();
      }
      this.startKeepAlive();
      return;
    }

    // Handle session closed
    if (event.type === 'session.closed') {
      this.sessionId = undefined;
      this.stopKeepAlive();
      return;
    }

    // Handle audio output (TTS)
    if (event.type === 'response.output_audio.delta') {
      // Doubao returns base64-encoded audio (ogg_opus or pcm)
      // The VoiceCore client expects 16kHz PCM, but we forward as-is
      // The client's PCMQueuePlayer will handle resampling if needed
      this.emitAudioDelta(event.delta);
      return;
    }

    // Handle audio started (model speaking)
    if (event.type === 'response.output_audio.started') {
      this.setStatus('speaking');
      return;
    }

    // Handle audio done
    if (event.type === 'response.output_audio.done') {
      this.setStatus('listening');
      return;
    }

    // Handle user speech detected (barge-in)
    if (event.type === 'input_audio_buffer.speech_started' ||
        event.type === 'conversation.item.input_audio_transcription.started') {
      this.emitInterruption();
      this.setStatus('listening');
      return;
    }

    // Handle transcript delta (ASR)
    if (event.type === 'conversation.item.input_audio_transcription.delta') {
      this.emitTranscript(event.delta, false);
      return;
    }

    // Handle transcript completed
    if (event.type === 'conversation.item.input_audio_transcription.completed') {
      this.emitTranscript(event.text, true);
      return;
    }

    // Handle errors
    if (event.type === 'error') {
      const code = Number(event.error?.status_code || event.error?.code);
      if (code >= 40000000 && code < 50000000) {
        this.shouldReconnect = false;
        this.ctx.logger.error(`DoubaoDriver: client/auth error (${code}), aborting reconnection: ${event.error.message}`);
      }
      this.notifyError(new Error(`${event.error?.code}: ${event.error?.message}`));
      this.setStatus('error');
      return;
    }

    // Handle response text delta (for display)
    if (event.type === 'response.output_text.delta') {
      // Could emit as transcript if needed
      return;
    }
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.ctx.logger.debug('DoubaoDriver: keep-alive ping sent');
      }
    }, 15000);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  /**
   * Send audio chunk to Doubao.
   * @param pcmBase64 - Base64-encoded 16kHz PCM audio.
   */
  sendAudio(pcmBase64: string): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
        type: 'input_audio_buffer.append',
        audio: pcmBase64,
      }));
    }
  }

  /**
   * Interrupt current model response (barge-in).
   */
  interrupt(): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type: 'response.cancel' }));
      this.setStatus('listening');
    }
  }

  /**
   * Disconnect from Doubao.
   */
  async disconnect(): Promise<void> {
    this.shouldReconnect = false;

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopKeepAlive();

    if (this.connectReject) {
      this.connectReject(new Error('Disconnected by user'));
      this.connectResolve = null;
      this.connectReject = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this._status === 'connected') {
      try {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2000);
          const cleanup = this.on('session.closed', () => {
            clearTimeout(timeout);
            cleanup();
            resolve();
          });
          this.ws?.send(JSON.stringify({ type: 'session.close' }));
        });
      } catch (err) {
        this.ctx.logger.warn('DoubaoDriver: error during graceful session.close', err);
      }
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus('closed');
    this.sessionId = undefined;
  }

  /**
   * Event listener for downstream events.
   */
  on<T extends DownstreamEvent['type']>(
    type: T,
    handler: (event: Extract<DownstreamEvent, { type: T }>) => void
  ): () => void {
    // Simple event emitter pattern - not fully implemented for driver
    // The driver uses callbacks instead
    return () => {};
  }
}