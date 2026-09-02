# @lifecordis/doubao-realtime-voice

Doubao (VolcEngine) Real-time Voice Model 3.0 (Seeduplex) plugin for DeepSeek Harness.

This plugin provides a Host service for connecting to the VolcEngine Doubao Real-time Voice API via WebSocket, implementing the full-duplex Seeduplex protocol for low-latency, multimodal, speech-to-speech (S2S) real-time conversations.

## Features

- **Full-duplex real-time voice**: End-to-end speech model with low latency
- **WebSocket-based**: Pure JSON text frames over WebSocket
- **Standardized events**: Realtime event semantics with extension passthrough
- **Audio formats**: PCM/Opus input (16kHz), OGG-Opus/PCM output (24kHz)
- **Function Calling**: Tool declarations and callback handling
- **Context management**: Conversation history initialization and continuation
- **ASR/TTS extensions**: Hotwords, custom vocabulary, dialect support
- **Auto-reconnection**: Exponential backoff with configurable attempts

## Installation

```bash
# From the LifeCordisHub workspace root
dsh plugin --profile demo add ./Lifehub/doubao-realtime-voice
```

Or install as an npm package:

```bash
pnpm add @lifecordis/doubao-realtime-voice
```

## Configuration

The plugin can be configured via `cordis.yml` or through the web Settings page under the `doubao-realtime-voice` section.

### Required Configuration

| Field | Description | Default |
|-------|-------------|---------|
| `apiKeyEnv` | Environment variable name for API key | `DOUBAO_API_KEY` |

### Optional Configuration

| Field | Description | Default |
|-------|-------------|---------|
| `baseURL` | WebSocket endpoint (falls back to `$DOUBAO_BASE_URL`) | `wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue` |
| `model` | Model identifier (fixed for Seeduplex) | `1.2.6.1` |
| `voice` | Voice ID | `zh_female_shengjie` |
| `inputAudioFormat.type` | Input audio format | `pcm` |
| `inputAudioFormat.rate` | Input sample rate (Hz) | `16000` |
| `outputAudioFormat.type` | Output audio format | `ogg_opus` |
| `outputAudioFormat.rate` | Output sample rate (Hz) | `24000` |
| `speed` | Speech speed (-50 to 100) | `0` |
| `loudness` | Volume level (-50 to 100) | `0` |
| `enableAsrTwopass` | Enable two-pass ASR | `false` |
| `boostingTableId` | Hotword table ID | `''` |
| `dialogExtra.enableVolcWebsearch` | Enable web search | `false` |
| `dialogExtra.volcWebsearchApiKey` | Web search API key | `''` |

### Example `cordis.yml`

```yaml
plugins:
  - id: doubao-realtime-voice
    name: '@lifecordis/doubao-realtime-voice'
    config:
      apiKeyEnv: DOUBAO_API_KEY
      voice: zh_female_shengjie
      speed: 10
      dialogExtra:
        enableVolcWebsearch: true
        volcWebsearchType: web_custom_api
        volcWebsearchApiKey: ${VOLC_WEBSEARCH_API_KEY}
```

## Usage

### Accessing the Service

```typescript
import type { DoubaoRealtimeVoiceService } from '@lifecordis/doubao-realtime-voice';

// In your plugin or tool
const service = ctx.get('doubaoRealtimeVoice') as DoubaoRealtimeVoiceService | undefined;
if (!service) return;

// Listen for events
const unsubscribe = service.on('response.output_audio.delta', (event) => {
  // event.delta contains Base64 encoded audio chunk
  playAudio(event.delta);
});

// Connect
await service.connect();

// Send audio
service.sendAudio(base64AudioData);

// Send text for TTS
service.sendText('你好，我是豆包语音助手。');

// Disconnect when done
await service.disconnect();
unsubscribe();
```

### Event Types

#### Upstream (Client → Server)
- `session.create` - Create new session
- `session.update` - Update session config
- `session.close` - Close session
- `input_audio_buffer.append` - Send audio data
- `input_audio_buffer.commit` - Force stop audio input
- `input_audio_mute.commit` / `input_audio_unmute.commit` - Mute/unmute
- `speech_text_buffer.commit` - Send text for TTS
- `conversation.item.create` - Add conversation item (history, tool results)
- `response.cancel` - Cancel ongoing response

#### Downstream (Server → Client)
- `session.created` - Session created with `session.id`
- `session.updated` / `session.closed` - Session state changes
- `conversation.item.input_audio_transcription.*` - ASR events
- `response.output_text.delta` / `.done` - Text response streaming
- `response.output_audio.started` / `.delta` / `.done` - Audio response streaming
- `response.function_call_arguments.done` - Function call requests
- `response.done` - Usage statistics
- `error` - Error events

### Audio Format Requirements

**Input Audio:**
- Format: PCM or Opus (auto-converted to PCM)
- Channels: Mono
- Sample Rate: 16,000 Hz
- Encoding: 16-bit signed integer, little-endian
- Recommended chunk: 20ms (640 bytes for PCM)

**Output Audio:**
- Format: OGG-Opus (default) or PCM
- Sample Rate: 24,000 Hz (PCM) / Variable (Opus)
- Encoding: Base64 in JSON events

### Function Calling

```typescript
// Declare tools in session config
tools: [{
  type: 'function',
  function: {
    name: 'get_weather',
    description: 'Get current weather',
    parameters: {
      type: 'object',
      properties: {
        city: { type: 'string' }
      },
      required: ['city']
    }
  }
}]

// Handle function calls
service.on('response.function_call_arguments.done', async (event) => {
  for (const call of event.items) {
    const args = JSON.parse(call.arguments);
    let result: unknown;
    
    if (call.name === 'get_weather') {
      result = await getWeather(args.city);
    }
    
    // Return result
    service.createConversationItem([{
      type: 'message',
      role: 'tool',
      call_id: call.call_id,
      content: [{ type: 'input_text', text: JSON.stringify(result) }]
    }]);
  }
});
```

### Context Management

```typescript
// Initialize with history
service.createConversationItem([
  { role: 'user', content: [{ type: 'input_text', text: '之前的问题' }] },
  { role: 'assistant', content: [{ type: 'output_text', text: '之前的回答' }] }
]);

// Continue previous session
const sessionConfig = { id: previousSessionId, ... };
service.updateSession(sessionConfig);
```

## Credentials

The plugin resolves the API key through the credentials service (managed via the web Settings page) or from the environment variable specified by `apiKeyEnv` (default: `DOUBAO_API_KEY`).

Get your API key from the [VolcEngine Console](https://console.volcengine.com/speech/new/setting/apikeys).

## Protocol Reference

Based on the [VolcEngine Doubao Real-time Voice Model 3.0 (Seeduplex) API documentation](https://www.volcengine.com/docs/6561/2549732).

### Key Differences from Standard LLM

1. **WebSocket transport** instead of HTTP
2. **Event-based protocol** with standardized event names
3. **Audio streaming** via Base64 in JSON frames
4. **Extension passthrough** for proprietary features (ASR, TTS, Dialog)
5. **Session-oriented** with explicit create/update/close

## License

MIT