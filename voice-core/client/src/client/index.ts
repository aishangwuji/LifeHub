/**
 * @lifecordis/dsh-client-voice-core — node half (empty).
 * The browser half owns the UI slots via exports["./client"].
 * This empty apply exists so the plugin appears in the host Loader.
 */

import type { Context } from '@deepseek-ai/cordis'

/** Host plugin body — no host-side behavior for this surface plugin. */
export function apply(ctx: Context): void {
  // No host-side behavior needed
}