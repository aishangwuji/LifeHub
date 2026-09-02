/**
 * The Doubao Real-time Voice card's staged form over the `doubao-realtime-voice` settings namespace.
 *
 * The API key is the one control that does not live in the section: its literal
 * never rides a response, so the card learns only whether one is configured
 * and writes it through the credentials domain, addressed by the reference the
 * section names. It is still staged with the rest of the form, so one save
 * covers everything the card shows.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the ctx.remote merge into this program.
import type {} from '@deepseek-ai/dsh-api-remotes/client'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { SettingsScope, SettingsScopeSnapshot } from '@deepseek-ai/dsh-client-ui-settings/client'
import {
  CardForm, numberField, textField,
  type CardActions, type CardFieldSpec, type CardFieldState, type CardShell,
} from '@deepseek-ai/dsh-client-ui-settings-plugins/client'

/**
 * Namespace of the Doubao Real-time Voice plugin.
 * Must match the host plugin's settings section name.
 */
export const DOUBAO_REALTIME_VOICE_NS = 'doubao-realtime-voice'

/** Credential reference the provider resolves when the section names none. */
const DEFAULT_API_KEY_REF = 'DOUBAO_API_KEY'

/** Form field the credential control stages under. */
const API_KEY_FIELD = 'apiKey'

/** The Doubao Real-time Voice settings this card edits. */
export interface DoubaoRealtimeVoiceSettings {
  /** Credential reference naming the environment key. */
  apiKeyEnv?: string
  /** Provider endpoint; blank inherits the provider default. */
  baseURL?: string
  /** Model identifier (fixed: 1.2.6.1). */
  model?: string
  /** System prompt. */
  instructions?: string
  /** Default voice ID. */
  voice?: string
  /** Speech speed (-50 to 100). */
  speed?: number
  /** Output volume (-50 to 100). */
  loudness?: number
  /** Enable web search (from dialogExtra). */
  enableVolcWebsearch?: boolean
  /** Web search type (from dialogExtra). */
  volcWebsearchType?: 'web_custom_api' | 'web_global_api'
  /** Web search API key (from dialogExtra). */
  volcWebsearchApiKey?: string
  /** Enable ASR two-pass. */
  enableAsrTwopass?: boolean
  /** Hotword table ID. */
  boostingTableId?: string
  /** Hotword table name. */
  boostingTableName?: string
}

/** What the credentials domain last reported, and for which reference. */
interface CredentialState {
  /** Reference this answer describes; a stale response for another one is dropped. */
  ref: string
  /** Whether any layer supplies a value for it. */
  configured: boolean
  /** Whether `credentials/set` can affect it; false disables the control. */
  writable: boolean
}

/** What the Doubao Real-time Voice card renders. */
export interface DoubaoRealtimeVoiceCardState extends CardShell {
  /** Provider endpoint. */
  baseURL: CardFieldState
  /** Model identifier. */
  model: CardFieldState
  /** System prompt. */
  instructions: CardFieldState
  /** Default voice ID. */
  voice: CardFieldState
  /** Speech speed. */
  speed: CardFieldState
  /** Output volume. */
  loudness: CardFieldState
  /** Enable web search. */
  enableVolcWebsearch: CardFieldState
  /** Web search type. */
  volcWebsearchType: CardFieldState
  /** Web search API key. */
  volcWebsearchApiKey: CardFieldState
  /** Enable ASR two-pass. */
  enableAsrTwopass: CardFieldState
  /** Hotword table ID. */
  boostingTableId: CardFieldState
  /** Hotword table name. */
  boostingTableName: CardFieldState
  /** The staged credential, which starts blank on every load. */
  apiKey: CardFieldState
  /** Whether the Host reports a credential configured for the referenced key. */
  apiKeyConfigured: boolean
  /** Whether the credentials domain accepts a write for it; false disables the control. */
  apiKeyWritable: boolean
}

/** The registration-side face the Doubao Real-time Voice card's slot entry injects. */
export interface DoubaoRealtimeVoiceCardFace extends CardActions {
  hooks: {
    /** Card snapshot bound by the renderer as useDoubaoRealtimeVoiceCard. */
    doubaoRealtimeVoiceCard: SnapshotStore<DoubaoRealtimeVoiceCardState>
  }
}

/** Boolean field spec for CardForm: parses "true"/"false"/"1"/"0" strings to booleans. */
function booleanField(field: string): CardFieldSpec {
  return {
    field,
    format: value => typeof value === 'boolean' ? String(value) : '',
    parse: (text) => {
      const trimmed = text.trim().toLowerCase()
      if (trimmed === '') return { kind: 'clear' as const }
      if (trimmed === 'true' || trimmed === '1') return { kind: 'set' as const, value: true }
      if (trimmed === 'false' || trimmed === '0') return { kind: 'set' as const, value: false }
      return undefined
    },
  }
}

/** Bridges the `doubao-realtime-voice` scope and the credentials domain onto the card. */
export class DoubaoRealtimeVoiceCardController {
  private readonly form: CardForm<DoubaoRealtimeVoiceSettings>
  private readonly store: SnapshotStore<DoubaoRealtimeVoiceCardState>
  private credential: CredentialState = { ref: '', configured: false, writable: true }

  /**
   * @param scope - the bound settings scope for the `doubao-realtime-voice` namespace.
   * @param ctx - the card plugin's context, whose `remote.credentials` namespace
   * answers for the credential the section references.
   */
  constructor(
    private readonly scope: SettingsScope<DoubaoRealtimeVoiceSettings>,
    private readonly ctx: ClientContext,
  ) {
    this.form = new CardForm(
      scope,
      [
        textField('baseURL'),
        textField('model'),
        textField('instructions'),
        textField('voice'),
        numberField('speed'),
        numberField('loudness'),
        // Boolean fields with proper parse/format
        booleanField('enableVolcWebsearch'),
        textField('volcWebsearchType'),
        textField('volcWebsearchApiKey'),
        booleanField('enableAsrTwopass'),
        textField('boostingTableId'),
        textField('boostingTableName'),
      ],
      [{ field: API_KEY_FIELD, write: text => this.writeKey(text) }],
    )
    this.store = this.form.bind(() => this.projection())
    scope.subscribe(() => { void this.readCredential() })
    void this.readCredential()
  }

  private projection(): DoubaoRealtimeVoiceCardState {
    return {
      ...this.form.shell(),
      baseURL: this.form.field('baseURL'),
      model: this.form.field('model'),
      instructions: this.form.field('instructions'),
      voice: this.form.field('voice'),
      speed: this.form.field('speed'),
      loudness: this.form.field('loudness'),
      enableVolcWebsearch: this.form.field('enableVolcWebsearch'),
      volcWebsearchType: this.form.field('volcWebsearchType'),
      volcWebsearchApiKey: this.form.field('volcWebsearchApiKey'),
      enableAsrTwopass: this.form.field('enableAsrTwopass'),
      boostingTableId: this.form.field('boostingTableId'),
      boostingTableName: this.form.field('boostingTableName'),
      apiKey: this.form.field(API_KEY_FIELD),
      apiKeyConfigured: this.credential.configured,
      apiKeyWritable: this.credential.writable,
    }
  }

  /**
   * Ask the credentials domain about the reference the section currently names.
   *
   * The answer is stored with the reference it describes: `apiKeyEnv` can
   * change between the request and its response, and two reads can settle out
   * of order, so a response is published only while it still answers for the
   * reference in force.
   */
  private async readCredential(): Promise<void> {
    const ref = refOf(this.scope.getSnapshot())
    if (ref !== this.credential.ref) {
      // A new reference knows nothing yet; keeping the old answer would claim
      // the key is configured under a name nobody has checked.
      this.credential = { ref, configured: false, writable: true }
      this.store.set(this.projection())
    }
    const response = await this.ctx.remote.credentials.describe([ref])
    if (!response.ok || ref !== refOf(this.scope.getSnapshot())) return
    const view = response.value[ref]
    const next: CredentialState = {
      ref,
      configured: view?.configured ?? false,
      // An unknown reference is treated as writable: the control stays usable
      // and the Host is what refuses, rather than the card guessing a refusal.
      writable: view?.writable ?? true,
    }
    if (next.configured === this.credential.configured && next.writable === this.credential.writable) return
    this.credential = next
    this.store.set(this.projection())
  }

  /**
   * Re-read after the Host reports a change to the reference this card watches.
   *
   * A key can be written from somewhere else — the Models page addresses the
   * same reference — and the settings section does not change when it is, so
   * without this the badge keeps reporting a state the Host already replaced.
   * @param ref - the reference the Host reports as changed.
   */
  refreshCredential(ref: string): void {
    if (ref !== this.credential.ref) return
    void this.readCredential()
  }

  /**
   * Build the face the card's slot registration injects.
   * @returns the card's snapshot and its form actions.
   */
  inject(): DoubaoRealtimeVoiceCardFace {
    return { hooks: { doubaoRealtimeVoiceCard: this.store }, ...this.form.actions() }
  }

  /**
   * Write the staged key, then re-read whether the Host now holds one.
   * @param value - the staged credential literal.
   * @returns whether the Host reports a configured credential afterwards.
   */
  private async writeKey(value: string): Promise<boolean> {
    // Refusals surface through the re-read below: the Host is the only
    // authority on whether the key now exists.
    await this.ctx.remote.credentials.set(refOf(this.scope.getSnapshot()), value)
    await this.readCredential()
    return this.credential.configured
  }

  dispose(): void {
    // CardForm doesn't have a dispose method, but we keep this for symmetry
  }
}

/**
 * The credential reference the section names, or the provider's default.
 * @param snapshot - the current scope snapshot.
 * @returns the reference to address.
 */
function refOf(snapshot: SettingsScopeSnapshot<DoubaoRealtimeVoiceSettings>): string {
  const declared = snapshot.value?.apiKeyEnv
  return declared !== undefined && declared.length > 0 ? declared : DEFAULT_API_KEY_REF
}