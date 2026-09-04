/**
 * PCM Queue Player for streaming audio playback with millisecond-level barge-in.
 * Manages a time-ordered queue of audio buffers for seamless, interruptible playback.
 *
 * @module @lifecordis/voice-core/PCMQueuePlayer
 */

import type { AudioPlaybackConfig } from './types.js';

/** Internal buffer entry. */
interface BufferEntry {
  buffer: AudioBuffer;
  startTime: number;
  source: AudioBufferSourceNode | null;
}

/**
 * Queue-based audio player for streaming PCM.
 * Supports seamless concatenation and instant interruption (barge-in).
 */
export class PCMQueuePlayer {
  private audioContext: AudioContext | null = null;
  private queue: BufferEntry[] = [];
  private nextPlayTime: number = 0;
  private isPlaying: boolean = false;
  private config: Required<AudioPlaybackConfig>;
  private gainNode: GainNode | null = null;

  constructor(config: AudioPlaybackConfig = {}) {
    this.config = {
      sampleRate: config.sampleRate ?? 24000,
    };
  }

  /**
   * Get or create the audio context.
   */
  private getContext(): AudioContext {
    if (!this.audioContext || this.audioContext.state === 'closed') {
      this.audioContext = new AudioContext({ sampleRate: this.config.sampleRate });
      this.gainNode = this.audioContext.createGain();
      this.gainNode.connect(this.audioContext.destination);
    }
    if (this.audioContext.state === 'suspended') {
      this.audioContext.resume();
    }
    return this.audioContext;
  }

  /**
   * Feed PCM audio data to the playback queue.
   * @param base64Pcm - Base64-encoded PCM audio (16-bit, mono, at configured sample rate).
   * @param sampleRate - Sample rate of the incoming audio (default: config sampleRate).
   */
  feed(base64Pcm: string, sampleRate?: number): void {
    const ctx = this.getContext();
    const effectiveSampleRate = sampleRate ?? this.config.sampleRate;

    // Decode base64 to binary
    const binary = atob(base64Pcm);
    const len = binary.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    // Convert Int16 to Float32 [-1, 1]
    const int16 = new Int16Array(bytes.buffer);
    const float32 = new Float32Array(int16.length);
    for (let i = 0; i < int16.length; i++) {
      const val = int16[i];
      float32[i] = val < 0 ? val / 0x8000 : val / 0x7FFF;
    }

    // Create audio buffer
    const buffer = ctx.createBuffer(1, float32.length, effectiveSampleRate);
    buffer.copyToChannel(float32, 0);

    // Resample if needed (simple linear interpolation for now)
    let finalBuffer = buffer;
    if (effectiveSampleRate !== ctx.sampleRate) {
      finalBuffer = this.resampleBuffer(buffer, effectiveSampleRate, ctx.sampleRate);
    }

    // Schedule playback
    const now = ctx.currentTime;
    this.nextPlayTime = Math.max(now, this.nextPlayTime);

    const entry: BufferEntry = {
      buffer: finalBuffer,
      startTime: this.nextPlayTime,
      source: null,
    };

    this.queue.push(entry);
    this.nextPlayTime += finalBuffer.duration;

    // Start playing if not already
    if (!this.isPlaying) {
      this.processQueue();
    }
  }

  /**
   * Process the playback queue.
   */
  private processQueue(): void {
    const ctx = this.getContext();
    const now = ctx.currentTime;

    // Find next buffer to play
    const entry = this.queue.find((e) => e.startTime >= now && !e.source);
    if (!entry) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;

    // Create source node
    const source = ctx.createBufferSource();
    source.buffer = entry.buffer;
    source.connect(this.gainNode!);

    // Schedule start
    const delay = Math.max(0, entry.startTime - now);
    source.start(ctx.currentTime + delay);
    entry.source = source;

    // Clean up when done
    source.onended = () => {
      entry.source = null;
      // Remove played buffers from front of queue
      while (this.queue.length > 0 && this.queue[0].source === null) {
        this.queue.shift();
      }
      this.processQueue();
    };
  }

  /**
   * Simple linear interpolation resampling.
   */
  private resampleBuffer(buffer: AudioBuffer, fromRate: number, toRate: number): AudioBuffer {
    if (fromRate === toRate) return buffer;

    const ratio = toRate / fromRate;
    const newLength = Math.round(buffer.length * ratio);
    const ctx = this.getContext();
    const newBuffer = ctx.createBuffer(1, newLength, toRate);
    const input = buffer.getChannelData(0);
    const output = newBuffer.getChannelData(0);

    for (let i = 0; i < newLength; i++) {
      const srcIndex = i / ratio;
      const idx = Math.floor(srcIndex);
      const frac = srcIndex - idx;
      if (idx + 1 < input.length) {
        output[i] = input[idx] * (1 - frac) + input[idx + 1] * frac;
      } else if (idx < input.length) {
        output[i] = input[idx];
      }
    }

    return newBuffer;
  }

  /**
   * Interrupt playback immediately (barge-in).
   * Stops all scheduled audio and clears the queue.
   */
  interrupt(): void {
    if (this.audioContext) {
      // Stop all sources
      for (const entry of this.queue) {
        if (entry.source) {
          try {
            entry.source.stop();
            entry.source.disconnect();
          } catch {
            // Ignore errors on already-stopped sources
          }
          entry.source = null;
        }
      }
      this.queue = [];
      this.nextPlayTime = 0;
      this.isPlaying = false;

      // Close and recreate context for clean state
      this.audioContext.close();
      this.audioContext = null;
      this.gainNode = null;
    }
  }

  /**
   * Pause playback (keeps queue).
   */
  pause(): void {
    if (this.audioContext && this.audioContext.state === 'running') {
      this.audioContext.suspend();
    }
  }

  /**
   * Resume playback.
   */
  async resume(): Promise<void> {
    const ctx = this.getContext();
    if (ctx.state === 'suspended') {
      await ctx.resume();
    }
    if (this.queue.length > 0 && !this.isPlaying) {
      this.processQueue();
    }
  }

  /**
   * Set playback volume (0.0 to 1.0).
   */
  setVolume(volume: number): void {
    if (this.gainNode) {
      this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  /**
   * Get current queue duration (seconds).
   */
  getQueueDuration(): number {
    return this.queue.reduce((sum, entry) => sum + entry.buffer.duration, 0);
  }

  /**
   * Clear queue without interrupting current playback.
   */
  clearQueue(): void {
    // Only clear unplayed entries
    const now = this.audioContext?.currentTime ?? 0;
    this.queue = this.queue.filter((entry) => {
      if (entry.startTime + entry.buffer.duration > now) {
        return true;
      }
      return false;
    });
  }

  /**
   * Check if player has pending audio.
   */
  hasPendingAudio(): boolean {
    return this.queue.length > 0;
  }

  /**
   * Dispose the player completely.
   */
  dispose(): void {
    this.interrupt();
  }
}