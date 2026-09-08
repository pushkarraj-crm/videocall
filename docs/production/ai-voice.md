# AI Voice Streaming Engine

Production extension for Virtual Host calls. Streams TTS audio in real time after conversation text is generated. Does not modify wallet, ZEGO, gifts, or conversation core logic.

## Architecture

```
Caller (web) → POST /virtual-hosts/voice/start
            → GET  /virtual-hosts/voice/stream/:streamId (SSE)
            → POST /virtual-hosts/voice/interrupt
                    ↓
            AiVoiceService → chunk text → TTS provider → base64 audio chunks
                    ↓
         virtual_host_voice_sessions (audit + latency metrics)
```

## Providers

| Env | Description |
|-----|-------------|
| `AI_VOICE_PROVIDER=local` | Synthetic WAV tone (default, no API key) |
| `AI_VOICE_PROVIDER=openai` | OpenAI TTS (`tts-1`) |
| `AI_VOICE_PROVIDER=elevenlabs` | ElevenLabs multilingual |
| `AI_VOICE_PROVIDER=cartesia` | Cartesia Sonic |
| `OPENAI_API_KEY` | Used by OpenAI provider (also fallback) |
| `ELEVENLABS_API_KEY` | ElevenLabs provider |
| `CARTESIA_API_KEY` | Cartesia provider |

Per-host overrides via `host_profiles.virtual_host_voice` JSON.

## Voice Config Fields

`voiceProvider`, `voiceId`, `language`, `gender`, `emotion`, `speed`, `pitch`, `volume`, `stability`, `style`, `personality`, `streamingEnabled`

## API Endpoints

### Caller (JWT)

- `GET /virtual-hosts/voice/voices?provider=` — voice catalog
- `POST /virtual-hosts/voice/start` — `{ callId, text, eventType? }` → `{ streamId, mimeType }`
- `GET /virtual-hosts/voice/stream/:streamId` — SSE `{ type: chunk|done, audio, firstChunkMs }`
- `POST /virtual-hosts/voice/interrupt` — `{ callId?, streamId? }`

### Admin

- `PATCH /admin/virtual-hosts/:hostId/voice` — voice provider, speed, pitch, emotion, language
- `POST /admin/virtual-hosts/voice/test` — preview TTS `{ text, hostId?, voice? }`
- `GET /admin/virtual-hosts/voice/analytics?hostId=` — latency, interruptions, language/voice usage

## Database

Migration `0028_ai_voice`:

- `virtual_host_voice_sessions` — stream audit, first-chunk latency, interruptions

## Languages

`en`, `hi`, `hinglish`, `es`, `ar`, `fr`

## Call Events

`greeting`, `gift_received`, `recharge`, `call_ending`, `long_silence`, `message`

## Verification

```bash
cd apps/api && npx tsx scripts/verify-ai-voice.ts
cd apps/api && npx tsx scripts/verify-ai-conversation.ts  # regression
cd apps/api && npx tsx scripts/verify-virtual-hosts.ts    # regression
```

## Performance

- Text chunked (~120 chars) for progressive streaming
- In-memory voice cache (30 min) + optional Redis
- Target first audio chunk &lt;1000ms (local provider typically sub-50ms)
- Provider fallback chain: configured → local → OpenAI (if key set)