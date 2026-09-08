# AI Conversation Engine

Production extension for Virtual Host calls. Does not modify wallet, ZEGO, gifts, or other core modules.

## Architecture

```
Caller (web) → POST /virtual-hosts/conversation/:callId/message
            → GET  /virtual-hosts/conversation/:callId/stream (SSE)
            → POST /virtual-hosts/conversation/:callId/event
                    ↓
            AiConversationService
                    ↓
         LocalAiProvider (default) | OpenAiProvider (optional)
                    ↓
         virtual_host_conversation_turns (audit)
         virtual_host_memory (persistent memory)
```

## Providers

| Env | Description |
|-----|-------------|
| `AI_CONVERSATION_PROVIDER=local` | Template + personality brain (default, no API key) |
| `AI_CONVERSATION_PROVIDER=openai` | OpenAI chat completions with local fallback |
| `OPENAI_API_KEY` | Required for OpenAI provider |
| `OPENAI_MODEL` | Default `gpt-4o-mini` |

## API Endpoints

### Caller (JWT)

- `GET /virtual-hosts/conversation/:callId/context` — preload memory + cached system prompt
- `POST /virtual-hosts/conversation/:callId/message` — send message, get reply (&lt;2s target)
- `GET /virtual-hosts/conversation/:callId/stream?message=` — SSE progressive chunks
- `POST /virtual-hosts/conversation/:callId/event` — greeting, gift_received, long_silence, call_ending, low_balance
- `POST /virtual-hosts/conversation/:callId/interrupt` — stop current stream
- `GET /virtual-hosts/conversation/:callId/history` — audited turns

### Admin

- `PATCH /admin/virtual-hosts/:hostId/conversation` — prompts, temperature, safety, emotions
- `POST /admin/virtual-hosts/:hostId/memory/reset` — reset user memory `{ userId }`
- `GET /admin/virtual-hosts/conversation/analytics?hostId=` — response time, topics, retention

## Database

Migration `0027_ai_conversation`:

- `host_profiles.virtual_host_conversation` (JSON config)
- `virtual_host_memory.conversation_history`, `last_call_summary`
- `virtual_host_sessions.turn_count`, `avg_response_ms`
- `virtual_host_conversation_turns` (full audit trail)

## Personalities & Languages

Configured via `virtualHostPersonality` and `virtualHostConversation` on each host.

Supported languages: `en`, `hi`, `hinglish`, `es`, `ar`, `fr`.

Emotions: happy, excited, shy, romantic, laughing, thinking, surprised, sleepy.

## Verification

```bash
cd apps/api && npx tsx scripts/verify-ai-conversation.ts
cd apps/api && npx tsx scripts/verify-virtual-hosts.ts  # regression
```

## Performance

- In-memory prompt cache (15 min TTL) + optional Redis
- Context preload on call connect
- Streaming chunks (~35ms) for progressive UI
- Local provider targets sub-100ms generation