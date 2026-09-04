/**
 * Doubao Real-time Voice plugin settings card — browser half.
 *
 * Registers a card into the `settings.plugin.item` slot under the
 * `doubao-realtime-voice` key. The card reads/writes the
 * `doubao-realtime-voice` settings namespace and the `DOUBAO_API_KEY`
 * credential reference.
 *
 * @module @lifecordis/dsh-client-doubao-realtime-voice
 */

// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the settings shell's SlotMap merge and the ctx.settingsScope Context merge.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: the ctx.remote Context merge.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import { DoubaoRealtimeVoiceCard } from './DoubaoRealtimeVoiceCard.js'
import type { DoubaoRealtimeVoiceCardFace } from './doubao-realtime-voice-card-controller.js'
import { DOUBAO_REALTIME_VOICE_NS, DoubaoRealtimeVoiceCardController } from './doubao-realtime-voice-card-controller.js'
import { en, zh } from './locales.js'

/** Dictionary namespace owned by this plugin. */
const NS = 'doubao-realtime-voice'

/** Required services (cordis fiber inject). */
export const inject = [
  'slots', 'locale', 'remote', 'settingsScope',
] as const

/**
 * Mount the Doubao Real-time Voice settings card.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh: zh as unknown as Record<string, string>, en: en as unknown as Record<string, string> } as never), 'dsh-client-doubao-realtime-voice: section dictionaries')

  const controller = new DoubaoRealtimeVoiceCardController(
    ctx.settingsScope.bind({ namespace: DOUBAO_REALTIME_VOICE_NS }),
    ctx,
  )

  ctx.effect(
    () => ctx.remote.$on('credentials/reference-updated', (ref) => { controller.refreshCredential(ref) }),
    'dsh-client-doubao-realtime-voice: credential invalidations',
  )

  ctx.effect(() => () => { controller.dispose() }, 'dsh-client-doubao-realtime-voice: card controller')

  // Register the card into the configurable plugins tab (inject waits for parent to declare settings.plugin.item)
  ctx.effect(
    () => ctx.slots.inject('settings.plugin.item', () =>
      ctx.slots.register({
        name: 'settings.plugin.item',
        key: DOUBAO_REALTIME_VOICE_NS,
        locale: NS,
        inject: () => controller.inject(),
      }, DoubaoRealtimeVoiceCard),
    ),
    'dsh-client-doubao-realtime-voice: settings card',
  )
}
