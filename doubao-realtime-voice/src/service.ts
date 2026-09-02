/**
 * Doubao Real-time Voice Service - WebSocket connection handler for VolcEngine Seeduplex API.
 * @module @lifecordis/doubao-realtime-voice/service
 */

import type { Context } from '@deepseek-ai/cordis';
import { WebSocket } from 'ws';
import {
  type DoubaoRealtimeVoiceService,
  type DoubaoRealtimeVoiceOptions,
  type DoubaoRealtimeVoiceConfig,
  type UpstreamEvent,
  type DownstreamEvent,
  type ConnectionState,
  type SessionConfig,
  type ConversationItem,
  type ConversationContent,
  DEFAULT_CONFIG,
} from './types.js';

const DEFAULT_BASE_URL = 'wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue';
const RECONNECT_BASE_DELAY = 1000;
const RECONNECT_MAX_DELAY = 30000;
const MAX_RECONNECT_ATTEMPTS = 5;

export class DoubaoRealtimeVoiceServiceImpl implements DoubaoRealtimeVoiceService {
  private ws: WebSocket | null = null;
  private state: ConnectionState = 'disconnected';
  private sessionId: string | undefined;
  private config: DoubaoRealtimeVoiceConfig;
  private apiKey: string;
  private baseURL: string;
  private eventHandlers: Map<string, Set<Function>> = new Map();
  private stateChangeHandlers: Set<(state: ConnectionState) => void> = new Set();
  private errorHandlers: Set<(error: Error) => void> = new Set();
  private reconnectAttempts = 0;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private shouldReconnect = false;
  private ctx: Context;

  // 连接与握手 Promise 控制
  private connectResolve: (() => void) | null = null;
  private connectReject: ((reason?: any) => void) | null = null;
  // 保活定时器（TCP 层 ping）
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  constructor(ctx: Context, options: DoubaoRealtimeVoiceOptions) {
    this.ctx = ctx;
    this.apiKey = options.apiKey;
    this.baseURL = options.baseURL || DEFAULT_BASE_URL;
    this.config = { ...DEFAULT_CONFIG, ...options.config };
    this.setState('disconnected');
  }

  get state(): ConnectionState {
    return this.state;
  }

  get sessionId(): string | undefined {
    return this.sessionId;
  }

  private setState(newState: ConnectionState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.notifyStateChange(newState);
    }
  }

  private notifyStateChange(state: ConnectionState): void {
    for (const handler of this.stateChangeHandlers) {
      try {
        handler(state);
      } catch (error) {
        this.ctx.logger.error('DoubaoRealtimeVoice: state change handler error', error);
      }
    }
  }

  private notifyError(error: Error): void {
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (e) {
        this.ctx.logger.error('DoubaoRealtimeVoice: error handler error', e);
      }
    }
  }

  private emitEvent(event: DownstreamEvent): void {
    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(event);
        } catch (error) {
          this.ctx.logger.error(`DoubaoRealtimeVoice: event handler error for ${event.type}`, error);
        }
      }
    }
    const wildcardHandlers = this.eventHandlers.get('*');
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          handler(event);
        } catch (error) {
          this.ctx.logger.error('DoubaoRealtimeVoice: wildcard event handler error', error);
        }
      }
    }
  }

  /**
   * 连接到火山引擎全双工语音服务
   */
  async connect(): Promise<void> {
    if (this.state === 'connecting' || this.state === 'connected') {
      return;
    }

    this.setState('connecting');
    this.shouldReconnect = true;
    this.reconnectAttempts = 0;

    return new Promise((resolve, reject) => {
      // 10秒建连与握手超时
      const timeout = setTimeout(() => {
        this.setState('disconnected');
        if (this.ws) {
          this.ws.close();
          this.ws = null;
        }
        reject(new Error('Connection timeout after 10s waiting for session.created'));
      }, 10000);

      try {
        // 1. 鉴权修复：通过 Headers 传递 X-Api-Key，不再使用 Query Params
        this.ws = new WebSocket(this.baseURL, {
          headers: {
            'X-Api-Key': this.apiKey,
          },
        });

        this.ws.onopen = () => {
          this.ctx.logger.info('DoubaoRealtimeVoice: WebSocket socket opened, initiating session.create');
          try {
            // 2. 握手修复：建连后先发送 session.create
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
            this.ctx.logger.error('DoubaoRealtimeVoice: failed to parse message', error);
          }
        };

        this.ws.onerror = (error) => {
          this.ctx.logger.error('DoubaoRealtimeVoice: WebSocket error', error);
          this.notifyError(new Error(`WebSocket error: ${error.message}`));
        };

        this.ws.onclose = (event) => {
          this.ctx.logger.info(`DoubaoRealtimeVoice: WebSocket closed (code: ${event.code}, reason: ${event.reason})`);
          this.setState('disconnected');
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
          this.setState('connected');
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
        this.setState('error');
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

    this.ctx.logger.info(`DoubaoRealtimeVoice: scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setState('connecting');
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch((error) => {
        this.ctx.logger.error('DoubaoRealtimeVoice: reconnect failed', error);
      });
    }, delay);
  }

  private handleDownstreamEvent(event: DownstreamEvent): void {
    this.ctx.logger.debug(`DoubaoRealtimeVoice: received event ${event.type}`);

    // 处理握手成功
    if (event.type === 'session.created') {
      this.sessionId = event.session.id;
      this.ctx.logger.info(`DoubaoRealtimeVoice: session created ${this.sessionId}`);
      if (this.connectResolve) {
        this.connectResolve();
      }
      this.startKeepAlive();
    }

    // 会话结束
    if (event.type === 'session.closed') {
      this.sessionId = undefined;
      this.stopKeepAlive();
    }

    // 4xx 错误（参数/鉴权问题）熔断重连
    if (event.type === 'error') {
      const code = Number(event.error?.status_code || event.error?.code);
      if (code >= 40000000 && code < 50000000) {
        this.shouldReconnect = false;
        this.ctx.logger.error(`DoubaoRealtimeVoice: client/auth error (${code}), aborting reconnection: ${event.error.message}`);
      }
    }

    this.emitEvent(event);
  }

  private startKeepAlive(): void {
    this.stopKeepAlive();
    this.keepAliveTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        this.ctx.logger.debug('DoubaoRealtimeVoice: keep-alive ping sent');
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
   * 发送上行事件
   */
  send(event: UpstreamEvent): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error(`Cannot send event: WebSocket is not open (state: ${this.state})`);
    }
    this.ws.send(JSON.stringify(event));
    this.ctx.logger.debug(`DoubaoRealtimeVoice: sent event ${event.type}`);
  }

  sendAudio(audioBase64: string): void {
    this.send({
      type: 'input_audio_buffer.append',
      audio: audioBase64,
    } as UpstreamEvent);
  }

  sendText(text: string): void {
    this.send({
      type: 'speech_text_buffer.commit',
      text,
    } as UpstreamEvent);
  }

  commitAudio(): void {
    this.send({ type: 'input_audio_buffer.commit' } as UpstreamEvent);
  }

  muteAudio(): void {
    this.send({ type: 'input_audio_mute.commit' } as UpstreamEvent);
  }

  unmuteAudio(): void {
    this.send({ type: 'input_audio_unmute.commit' } as UpstreamEvent);
  }

  updateSession(config: Partial<SessionConfig>): void {
    this.send({
      type: 'session.update',
      session: config,
    } as UpstreamEvent);
  }

  createConversationItem(items: ConversationItem[]): void {
    this.send({
      type: 'conversation.item.create',
      items,
    } as UpstreamEvent);
  }

  updateConversationItem(items: Array<{ id: string; content: ConversationContent[] }>): void {
    this.send({
      type: 'conversation.item.update',
      items,
    } as UpstreamEvent);
  }

  retrieveConversation(items?: Array<{ id: string }>): void {
    this.send({
      type: 'conversation.item.retrieve',
      items,
    } as UpstreamEvent);
  }

  deleteConversationItem(items: Array<{ id: string }>): void {
    this.send({
      type: 'conversation.item.delete',
      items,
    } as UpstreamEvent);
  }

  cancelResponse(): void {
    this.send({ type: 'response.cancel' } as UpstreamEvent);
  }

  on<T extends DownstreamEvent['type']>(
    type: T,
    handler: (event: Extract<DownstreamEvent, { type: T }>) => void
  ): () => void {
    if (!this.eventHandlers.has(type)) {
      this.eventHandlers.set(type, new Set());
    }
    this.eventHandlers.get(type)!.add(handler);

    return () => {
      this.eventHandlers.get(type)?.delete(handler);
    };
  }

  onStateChange(handler: (state: ConnectionState) => void): () => void {
    this.stateChangeHandlers.add(handler);
    return () => this.stateChangeHandlers.delete(handler);
  }

  onError(handler: (error: Error) => void): () => void {
    this.errorHandlers.add(handler);
    return () => this.errorHandlers.delete(handler);
  }

  /**
   * 优雅断开：向服务端发送 session.close 并等待 session.closed 返回，规避 55000001
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

    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.state === 'connected') {
      try {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(resolve, 2000); // 2秒兜底超时，防止服务端假死
          const cleanup = this.on('session.closed', () => {
            clearTimeout(timeout);
            cleanup();
            resolve();
          });
          this.send({ type: 'session.close' } as UpstreamEvent);
        });
      } catch (err) {
        this.ctx.logger.warn('DoubaoRealtimeVoice: error during graceful session.close', err);
      }
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('disconnected');
    this.sessionId = undefined;
    this.eventHandlers.clear();
    this.stateChangeHandlers.clear();
    this.errorHandlers.clear();
  }
}

/**
 * 构造全双工会话配置 Payload
 */
export function createSessionConfig(config: DoubaoRealtimeVoiceConfig): SessionConfig {
  return {
    model: config.model,
    instructions: config.instructions || '',
    audio: {
      input: {
        format: {
          type: config.inputAudioFormat.type,
          rate: config.inputAudioFormat.rate,
        },
      },
      output: {
        format: {
          type: config.outputAudioFormat.type,
          rate: config.outputAudioFormat.rate,
        },
        voice: config.voice,
        speed: config.speed,
        loudness: config.loudness,
      },
    },
    tools: config.tools,
    extension: {
      asr: {
        extra: {
          enable_asr_twopass: config.enableAsrTwopass,
          boosting_table_id: config.boostingTableId || undefined,
          boosting_table_name: config.boostingTableName || undefined,
          regex_correct_table_id: config.regexCorrectTableId || undefined,
          regex_correct_table_name: config.regexCorrectTableName || undefined,
          context: Object.keys(config.asrContext).length > 0 ? config.asrContext : undefined,
        },
      },
      dialog: {
        location: Object.keys(config.location).length > 0 ? config.location : undefined,
        extra: {
          strict_audit: config.dialogExtra?.strictAudit ?? true,
          audit_response: config.dialogExtra?.auditResponse || undefined,
          // ✅ Use top-level config fields (matching UI CardForm)
          enable_volc_websearch: config.enableVolcWebsearch,
          volc_websearch_type: config.volcWebsearchType,
          volc_websearch_api_key: config.volcWebsearchApiKey || undefined,
          enable_music: config.dialogExtra?.enableMusic ?? false,
          enable_loudness_norm: config.dialogExtra?.enableLoudnessNorm ?? false,
          enable_user_query_exit: config.dialogExtra?.enableUserQueryExit ?? false,
        },
      },
      tts: {
        audio_config: {
          type: config.outputAudioFormat.type,
          rate: 24000,
        },
        extra: {
          max_length_to_filter_parenthesis: config.ttsExtra.maxLengthToFilterParenthesis,
          explicit_dialect: config.ttsExtra.explicitDialect || undefined,
          aigc_metadata: config.ttsExtra.aigcMetadata?.enable ? {
            enable: config.ttsExtra.aigcMetadata.enable,
            content_producer: config.ttsExtra.aigcMetadata.contentProducer || undefined,
            produce_id: config.ttsExtra.aigcMetadata.produceId || undefined,
            content_propagator: config.ttsExtra.aigcMetadata.contentPropagator || undefined,
            propagate_id: config.ttsExtra.aigcMetadata.propagateId || undefined,
          } : undefined,
        },
      },
    },
  };
}