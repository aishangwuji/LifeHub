import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { PluginCard } from '@deepseek-ai/dsh-client-ui-settings-plugins/src/client/PluginCard.js'
import { SecretField, ValueField } from '@deepseek-ai/dsh-client-ui-settings-plugins/src/client/fields.js'
import type { DoubaoRealtimeVoiceCardFace } from './doubao-realtime-voice-card-controller.js'
import { useId, type ReactNode } from 'react'

export type DoubaoRealtimeVoiceCardProps =
  PropsRuntime<'settings.plugin.item'>
  & PropsLocale<'doubao-realtime-voice'>
  & InjectFace<DoubaoRealtimeVoiceCardFace>

/** 分组容器：增加视觉层级与边界 */
function FormSection({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--dsh-border-subtle, #e5e7eb)' }}>
      <div>
        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--dsh-text-primary, #111827)' }}>{title}</div>
        {description && (
          <div style={{ fontSize: '12px', color: 'var(--dsh-text-muted, #6b7280)', marginTop: '2px' }}>{description}</div>
        )}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {children}
      </div>
    </div>
  )
}

export function DoubaoRealtimeVoiceCard(props: DoubaoRealtimeVoiceCardProps) {
  const t = props.t as unknown as (key: string) => string
  const state = props.useDoubaoRealtimeVoiceCard(snapshot => snapshot)
  const disabled = !state.writable

  // 基础标识 ID
  const apiKeyId = useId()
  const baseURLId = useId()
  const modelId = useId()
  const instructionsId = useId()
  const voiceId = useId()
  const speedId = useId()
  const loudnessId = useId()
  const enableWebsearchId = useId()
  const websearchTypeId = useId()
  const websearchApiKeyId = useId()
  const enableAsrTwopassId = useId()
  const boostingTableIdId = useId()
  const boostingTableNameId = useId()

  // 辅助渲染器：提取重复的 i18n 属性与 action handler
  const renderValueField = (
    fieldKey: keyof typeof state,
    id: string,
    options: { numeric?: boolean; isSecret?: boolean } = {}
  ) => {
    const fieldState = (state as any)[fieldKey]
    return (
      <ValueField
        id={id}
        label={t(fieldKey as string)}
        hint={t(`${fieldKey as string}Hint`)}
        overriddenLabel={t('overridden')}
        resetLabel={t('reset')}
        invalidLabel={options.numeric ? t('invalidNumber') : t('invalid')}
        disabled={disabled}
        numeric={options.numeric}
        {...fieldState}
        onEdit={(text: string) => { props.edit(fieldKey as any, text) }}
        onReset={() => { props.resetField(fieldKey as any) }}
      />
    )
  }

  const isWebsearchEnabled = Boolean(state.enableVolcWebsearch?.text && state.enableVolcWebsearch.text !== 'false')

  return (
    <PluginCard
      t={t}
      titleKey="title"
      descriptionKey="description"
      state={state}
      onSave={props.save}
      onDiscard={props.discard}
    >
      {/* 1. 服务与连接认证 */}
      <FormSection title={t('sectionAuth') || '服务与认证'}>
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
        {renderValueField('baseURL', baseURLId)}
        {renderValueField('model', modelId)}
      </FormSection>

      {/* 2. 角色设定与声音合成 */}
      <FormSection title={t('sectionVoice') || '声音与指令设定'}>
        {renderValueField('instructions', instructionsId)}
        {renderValueField('voice', voiceId)}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
          {renderValueField('speed', speedId, { numeric: true })}
          {renderValueField('loudness', loudnessId, { numeric: true })}
        </div>
      </FormSection>

      {/* 3. 联网增强功能 (渐进式展示) */}
      <FormSection
        title={t('sectionWebsearch') || '联网搜索增强'}
        description={t('sectionWebsearchHint') || '配置火山引擎联网检索能力'}
      >
        {renderValueField('enableVolcWebsearch', enableWebsearchId)}
        {isWebsearchEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '12px', borderLeft: '2px solid var(--dsh-border-subtle, #e5e7eb)' }}>
            {renderValueField('volcWebsearchType', websearchTypeId)}
            {/* 敏感密钥脱敏渲染 */}
            {renderValueField('volcWebsearchApiKey', websearchApiKeyId, { isSecret: true })}
          </div>
        )}
      </FormSection>

      {/* 4. ASR 语音识别与热词表 */}
      <FormSection
        title={t('sectionASR') || '语音识别与热词优化'}
        description={t('sectionASRHint') || '提升特定术语与短语的识别精度'}
      >
        {renderValueField('enableAsrTwopass', enableAsrTwopassId)}
        {renderValueField('boostingTableId', boostingTableIdId)}
        {renderValueField('boostingTableName', boostingTableNameId)}
      </FormSection>
    </PluginCard>
  )
}