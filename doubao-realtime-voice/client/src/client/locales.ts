/**
 * Locale dictionary for the Doubao Real-time Voice plugin settings card.
 * @module @lifecordis/dsh-client-doubao-realtime-voice/locales
 */

export const en = {
  // Navigation & section
  nav: 'Plugins',
  configurableTab: 'Configurable',

  // Card
  title: 'Doubao Real-time Voice',
  description: 'Configure the VolcEngine Doubao Seeduplex full-duplex voice model',

  // Actions
  save: 'Save',
  saving: 'Saving...',
  discard: 'Discard',
  expand: 'Expand',
  collapse: 'Collapse',
  unsaved: 'Unsaved changes',
  readOnly: 'This section is read-only',
  saveFailed: 'Save failed — check the field values',

  // Common form labels
  overridden: 'Overridden',
  reset: 'Reset',
  invalid: 'Invalid value',
  invalidNumber: 'Invalid number',

  // Fields
  apiKey: 'API Key',
  apiKeyHint: 'Your VolcEngine API key (stored in credentials, never in settings)',
  apiKeySet: 'API key configured',
  apiKeyUnset: 'API key not configured',

  baseURL: 'Base URL',
  baseURLHint: 'WebSocket endpoint (blank for default VolcEngine endpoint)',

  model: 'Model',
  modelHint: 'Model identifier (fixed: 1.2.6.1 for Seeduplex)',

  voice: 'Voice',
  voiceHint: 'Default voice ID for TTS output',

  instructions: 'System Prompt',
  instructionsHint: 'System prompt to guide the model behavior',

  speed: 'Speech Speed',
  speedHint: 'Speech speed (-50 to 100, 0 = normal)',

  loudness: 'Volume',
  loudnessHint: 'Output volume (-50 to 100, 0 = normal)',

  enableVolcWebsearch: 'Enable Web Search',
  enableVolcWebsearchHint: 'Enable built-in web search capability (true / false)',

  volcWebsearchType: 'Search Type',
  volcWebsearchTypeHint: 'Web search service type (web_custom_api or web_global_api)',

  volcWebsearchApiKey: 'Web Search API Key',
  volcWebsearchApiKeyHint: 'API key for the web search service',

  enableAsrTwopass: 'ASR Two-Pass',
  enableAsrTwopassHint: 'Enable non-streaming ASR for better accuracy (true / false)',

  boostingTableId: 'Hotword Table ID',
  boostingTableIdHint: 'Hotword table ID from VolcEngine console',

  boostingTableName: 'Hotword Table Name',
  boostingTableNameHint: 'Hotword table name from VolcEngine console',
}

export const zh = {
  // Navigation & section
  nav: '插件',
  configurableTab: '可配置',

  // Card
  title: '豆包实时语音',
  description: '配置火山引擎豆包 Seeduplex 全双工语音模型',

  // Actions
  save: '保存',
  saving: '保存中...',
  discard: '放弃',
  expand: '展开',
  collapse: '折叠',
  unsaved: '有未保存的更改',
  readOnly: '此部分为只读',
  saveFailed: '保存失败 — 请检查字段值',

  // Common form labels
  overridden: '已覆盖默认值',
  reset: '重置',
  invalid: '无效的值',
  invalidNumber: '请输入有效数字',

  // Fields
  apiKey: 'API Key',
  apiKeyHint: '您的火山引擎 API 密钥（存储在凭证中，不写入设置）',
  apiKeySet: '已配置 API Key',
  apiKeyUnset: '未配置 API Key',

  baseURL: '基础 URL',
  baseURLHint: 'WebSocket 端点（留空使用默认火山引擎端点）',

  model: '模型',
  modelHint: '模型标识符（固定：1.2.6.1 为 Seeduplex）',

  voice: '音色',
  voiceHint: 'TTS 输出的默认音色 ID',

  instructions: '系统提示词',
  instructionsHint: '引导模型行为的系统提示词',

  speed: '语速',
  speedHint: '语速调整（-50 到 100，0 为正常）',

  loudness: '音量',
  loudnessHint: '输出音量（-50 到 100，0 为正常）',

  enableVolcWebsearch: '启用联网搜索',
  enableVolcWebsearchHint: '启用内置联网搜索功能 (true / false)',

  volcWebsearchType: '搜索类型',
  volcWebsearchTypeHint: '联网搜索服务类型（可选：web_custom_api 或 web_global_api）',

  volcWebsearchApiKey: '联网搜索 API Key',
  volcWebsearchApiKeyHint: '联网搜索服务的 API 密钥',

  enableAsrTwopass: 'ASR 双通道',
  enableAsrTwopassHint: '启用非流式 ASR 以提高识别准确率 (true / false)',

  boostingTableId: '热词表 ID',
  boostingTableIdHint: '火山引擎控制台中的热词表 ID',

  boostingTableName: '热词表名称',
  boostingTableNameHint: '火山引擎控制台中的热词表名称',
}