/**
 * Realtime Audio Recorder using AudioWorklet for 16kHz PCM capture.
 * Provides low-latency audio chunk delivery for real-time voice streaming.
 *
 * @module @lifecordis/voice-core/RealtimeAudioRecorder
 */

import type { AudioRecordingConfig } from './types.js';

/** Callback for receiving audio chunks. */
export type AudioChunkCallback = (chunkBase64: string) => void;

/** Recorder state. */
export type RecorderState = 'idle' | 'recording' | 'stopping';

/**
 * AudioWorklet-based recorder for 16kHz mono PCM.
 * Uses AudioWorkletProcessor for minimal latency and precise timing.
 */
export class RealtimeAudioRecorder {
  private audioContext: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private workletNode: AudioWorkletNode | null = null;
  private state: RecorderState = 'idle';
  private onChunkCallback: AudioChunkCallback | null = null;
  private config: Required<AudioRecordingConfig>;

  // AudioWorklet processor code (inline to avoid separate file)
  private static readonly PROCESSOR_CODE = `
    class PCMProcessor extends AudioWorkletProcessor {
      constructor(options) {
        super();
        this.chunkSize = options.processorOptions?.chunkSize ?? 640;
        this.buffer = new Float32Array(this.chunkSize);
        this.bufferIndex = 0;
      }

      process(inputs) {
        const input = inputs[0];
        if (input.length > 0) {
          const channel = input[0];
          for (let i = 0; i < channel.length; i++) {
            this.buffer[this.bufferIndex++] = channel[i];
            if (this.bufferIndex >= this.chunkSize) {
              // Convert Float32 [-1,1] to Int16
              const int16 = new Int16Array(this.chunkSize);
              for (let j = 0; j < this.chunkSize; j++) {
                const val = Math.max(-1, Math.min(1, this.buffer[j]));
                int16[j] = val < 0 ? val * 0x8000 : val * 0x7FFF;
              }
              // Convert to base64
              let binary = '';
              const bytes = new Uint8Array(int16.buffer);
              for (let j = 0; j < bytes.length; j++) {
                binary += String.fromCharCode(bytes[j]);
              }
              const base64 = btoa(binary);
              this.port.postMessage({ type: 'chunk', data: base64 });
              this.bufferIndex = 0;
            }
          }
        }
        return true;
      }
    }
    registerProcessor('pcm-processor', PCMProcessor);
  `;

  constructor(config: AudioRecordingConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 16000,
      chunkSize: config.chunkSize ?? 640, // 40ms at 16kHz
      channels: config.channels ?? 1,
    };
  }

  /**
   * Start recording audio.
   * @param onChunk - Callback for each audio chunk (base64 PCM).
   */
  async start(onChunk: AudioChunkCallback): Promise<void> {
    if (this.state !== 'idle') {
      throw new Error(`Recorder already ${this.state}`);
    }

    this.onChunkCallback = onChunk;
    this.state = 'recording';

    try {
      // Get user media
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: this.config.sampleRate,
          channelCount: this.config.channels,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // Create audio context
      this.audioContext = new AudioContext({
        sampleRate: this.config.sampleRate,
      });

      // Resume if suspended (browser autoplay policy)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume();
      }

      // Register AudioWorklet processor
      await this.audioContext.audioWorklet.addModule(
        URL.createObjectURL(new Blob([RealtimeAudioRecorder.PROCESSOR_CODE], { type: 'application/javascript' }))
      );

      // Create worklet node
      const source = this.audioContext.createMediaStreamSource(this.mediaStream);
      this.workletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor', {
        processorOptions: { chunkSize: this.config.chunkSize },
      });

      // Handle chunks from worklet
      this.workletNode.port.onmessage = (event) => {
        if (event.data.type === 'chunk' && this.onChunkCallback) {
          this.onChunkCallback(event.data.data);
        }
      };

      // Connect: source -> worklet -> destination (optional, for monitoring)
      source.connect(this.workletNode);
      this.workletNode.connect(this.audioContext.destination);

    } catch (error) {
      this.state = 'idle';
      await this.cleanup();
      throw error;
    }
  }

  /**
   * Stop recording.
   */
  async stop(): Promise<void> {
    if (this.state === 'idle') {
      return;
    }
    this.state = 'stopping';
    await this.cleanup();
    this.state = 'idle';
  }

  /** Get current recorder state. */
  getState(): RecorderState {
    return this.state;
  }

  /** Check if currently recording. */
  isRecording(): boolean {
    return this.state === 'recording';
  }

  private async cleanup(): Promise<void> {
    if (this.workletNode) {
      this.workletNode.disconnect();
      this.workletNode = null;
    }
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }
    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }
    this.onChunkCallback = null;
  }
}