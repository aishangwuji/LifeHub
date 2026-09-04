/**
 * Voice Core plugin UI — browser half.
 *
 * Registers:
 * - Voice button in chat input bar (conversation.input.right)
 * - Waveform overlay during voice sessions (shell.overlay)
 *
 * @module @lifecordis/voice-core/client
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { VoiceButtonSlot } from './VoiceButtonSlot.js';
import { WaveformOverlaySlot } from './WaveformOverlaySlot.js';
import { en, zh } from './locales.js';

/** Dictionary namespace owned by this plugin. */
const NS = 'voice-core';

/** Client plugin apply function. */
export function apply(ctx: ClientContext): void {
  // Register locale dictionaries
  ctx.locale.register(NS, {
    zh: zh as Record<string, string>,
    en: en as Record<string, string>,
  });

  // Register voice button in chat input bar (right side) - use inject to wait for parent
  ctx.slots.inject('conversation.input.right', () =>
    ctx.slots.register({
      name: 'conversation.input.right',
      id: 'voice-core-mic-button',
      order: 100,
      locale: NS,
    }, VoiceButtonSlot)
  );

  // Register waveform overlay - use inject to wait for parent
  ctx.slots.inject('shell.overlay', () =>
    ctx.slots.register({
      name: 'shell.overlay',
      id: 'voice-core-waveform',
      order: 50,
      locale: NS,
    }, WaveformOverlaySlot)
  );
}

export const name = 'dsh-client-voice-core';
export const inject = ['slots', 'locale'] as const;