/**
 * The Doubao Real-time Voice card: its endpoint, model, voice, and the key —
 * which is written through the credentials domain, never into the settings
 * section, so the literal never rides a response.
 */

import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PluginCard } from '@deepseek-ai/dsh-client-ui-settings-plugins/src/client/PluginCard.js'
import { SecretField, ValueField } from '@deepseek-ai/dsh-client-ui-settings-plugins/src/client/fields.js'
import type { DoubaoRealtimeVoiceCardFace } from './doubao-realtime-voice-card-controller.js'
import type {} from '@deepseek-ai/dsh-client-ui-settings-plugins/src/client/slot-contract.js'
import { useId } from 'react'

/** Props the renderer binds for the Doubao Real-time Voice card. */
export type DoubaoRealtimeVoiceCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'doubao-realtime-voice'>
  & InjectFace<DoubaoRealtimeVoiceCardFace>

/**
 * Render the Doubao Real-time Voice card.
 * @param props - locale copy, the card snapshot, and its form actions.
 * @returns the card.
 */
export function DoubaoRealtimeVoiceCard(props: DoubaoRealtimeVoiceCardProps) {
  const t = props.t as unknown as (key: string) => string
  const state = props.useDoubaoRealtimeVoiceCard(snapshot => snapshot)
  const disabled = !state.writable

  // Generate unique IDs for form fields
  const apiKeyId = useId()
  const baseURLId = useId()
  const modelId = useId()
  const instructionsId = useId()
  const voiceId = useId()
  const speedId = useId()
  const loudnessId = useId()
  const enableVolcWebsearchId = useId()
  const volcWebsearchTypeId = useId()
  const volcWebsearchApiKeyId = useId()
  const enableAsrTwopassId = useId()
  const boostingTableIdId = useId()
  const boostingTableNameId = useId()

  return (
    <PluginCard
      t={t}
      titleKey="title"
      descriptionKey="description"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      <SecretField
        id={apiKeyId}
        label={t('apiKey')}
        hint={t('apiKeyHint')}
        disabled={!state.apiKeyWritable}
        text={state.apiKey.text}
        configured={state.apiKeyConfigured}
        stateLabel={state.apiKeyConfigured ? t('apiKeySet') : t('apiKeyUnset')}
        onEdit={(text: string) => { props.edit('apiKey', text) }}
      />
      <ValueField
        id={baseURLId}
        label={t('baseURL')}
        hint={t('baseURLHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.baseURL}
        onEdit={(text: string) => { props.edit('baseURL', text) }}
        onReset={() => { props.resetField('baseURL') }}
      />
      <ValueField
        id={modelId}
        label={t('model')}
        hint={t('modelHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.model}
        onEdit={(text: string) => { props.edit('model', text) }}
        onReset={() => { props.resetField('model') }}
      />
      <ValueField
        id={instructionsId}
        label={t('instructions')}
        hint={t('instructionsHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.instructions}
        onEdit={(text: string) => { props.edit('instructions', text) }}
        onReset={() => { props.resetField('instructions') }}
      />
      <ValueField
        id={voiceId}
        label={t('voice')}
        hint={t('voiceHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.voice}
        onEdit={(text: string) => { props.edit('voice', text) }}
        onReset={() => { props.resetField('voice') }}
      />
      <ValueField
        id={speedId}
        label={t('speed')}
        hint={t('speedHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        numeric
        disabled={disabled}
        {...state.speed}
        onEdit={(text: string) => { props.edit('speed', text) }}
        onReset={() => { props.resetField('speed') }}
      />
      <ValueField
        id={loudnessId}
        label={t('loudness')}
        hint={t('loudnessHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalidNumber')}
        numeric
        disabled={disabled}
        {...state.loudness}
        onEdit={(text: string) => { props.edit('loudness', text) }}
        onReset={() => { props.resetField('loudness') }}
      />
      <ValueField
        id={enableVolcWebsearchId}
        label={t('enableVolcWebsearch')}
        hint={t('enableVolcWebsearchHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.enableVolcWebsearch}
        onEdit={(text: string) => { props.edit('enableVolcWebsearch', text) }}
        onReset={() => { props.resetField('enableVolcWebsearch') }}
      />
      <ValueField
        id={volcWebsearchTypeId}
        label={t('volcWebsearchType')}
        hint={t('volcWebsearchTypeHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.volcWebsearchType}
        onEdit={(text: string) => { props.edit('volcWebsearchType', text) }}
        onReset={() => { props.resetField('volcWebsearchType') }}
      />
      <ValueField
        id={volcWebsearchApiKeyId}
        label={t('volcWebsearchApiKey')}
        hint={t('volcWebsearchApiKeyHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.volcWebsearchApiKey}
        onEdit={(text: string) => { props.edit('volcWebsearchApiKey', text) }}
        onReset={() => { props.resetField('volcWebsearchApiKey') }}
      />
      <ValueField
        id={enableAsrTwopassId}
        label={t('enableAsrTwopass')}
        hint={t('enableAsrTwopassHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.enableAsrTwopass}
        onEdit={(text: string) => { props.edit('enableAsrTwopass', text) }}
        onReset={() => { props.resetField('enableAsrTwopass') }}
      />
      <ValueField
        id={boostingTableIdId}
        label={t('boostingTableId')}
        hint={t('boostingTableIdHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.boostingTableId}
        onEdit={(text: string) => { props.edit('boostingTableId', text) }}
        onReset={() => { props.resetField('boostingTableId') }}
      />
      <ValueField
        id={boostingTableNameId}
        label={t('boostingTableName')}
        hint={t('boostingTableNameHint')}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={t('invalid')}
        disabled={disabled}
        {...state.boostingTableName}
        onEdit={(text: string) => { props.edit('boostingTableName', text) }}
        onReset={() => { props.resetField('boostingTableName') }}
      />
    </PluginCard>
  )
}