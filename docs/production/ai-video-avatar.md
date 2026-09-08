# AI Video Avatar Engine

Cinematic video-call style avatar rendering for Virtual Host calls. Extends Conversation, Voice, Emotion, and Gift systems without modifying core modules.

## Rendering Architecture

```
Conversation emotion ──┐
Voice speaking/jaw ──┼──► useVirtualHostAvatar + useVideoAvatar
Gift / call events ──┘           │
                                 ▼
                          VideoAvatar component
                    ┌────────────┴────────────┐
              cinematic mode            video clip mode
         (CSS layers + phonemes)      (HTML5 video loops)
                    └────────────┬────────────┘
                          GPU CSS transforms
                          60 FPS target
```

## Features

- **Idle**: camera drift, breathing, blink, eye tracking, shoulder sway
- **Speaking**: phoneme lip sync from voice energy + subtitle text
- **Emotions**: expression blending from conversation engine
- **Gifts**: smile / wave / heart / VIP celebrate + zoom
- **Camera**: close, medium, portrait, auto with dynamic framing
- **Poses**: idle, talking, listening, laughing, thinking, celebrating
- **Wardrobe**: admin-approved outfits per category

## Database

Migration `0029_video_avatar`:

- `host_profiles.virtual_host_video` JSONB
- `host_profiles.virtual_host_wardrobe` JSONB

## API

- `GET /virtual-hosts/video-avatar/catalog`
- `PATCH /admin/virtual-hosts/:hostId/video`
- `PATCH /admin/virtual-hosts/:hostId/wardrobe`
- `POST /admin/virtual-hosts/:hostId/wardrobe/:outfitId/activate`
- `POST /admin/virtual-hosts/video-avatar/preview`

## Verification

```bash
cd apps/api && npx tsx scripts/verify-video-avatar.ts
cd apps/api && npx tsx scripts/verify-avatar-animation.ts
cd apps/api && npx tsx scripts/verify-ai-voice.ts
cd apps/api && npx tsx scripts/verify-ai-conversation.ts
```