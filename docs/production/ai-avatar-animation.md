# AI Avatar Animation Engine

Real-time CSS avatar animations for Virtual Host calls. Extends Conversation + Voice systems without modifying wallet, gifts, calls, or ZEGO.

## Architecture

```
Conversation emotion + Voice speaking state + Call events + Gifts
                    ↓
         useVirtualHostAvatar (scheduler + emotion engine)
                    ↓
         AvatarAnimatedPortrait (CSS transform layers)
                    ↓
    GPU-accelerated 60fps — no canvas, no WebGL
```

## Animation Layers

| State | Behavior |
|-------|----------|
| Idle | Weighted-random micro-animations: blink, breathe, head tilt, look L/R, smile shift, shoulder, hair sway |
| Speaking | Lip/jaw pulse synced to speech energy, brow movement, head bob |
| Emotion | Expression from conversation engine: happy, excited, flirty, thinking, surprised, sad |
| Gift | basic→smile, premium→wave, luxury→heart, vip→stand+celebrate+zoom |
| Events | greeting→smile, silence→look around, typing→attention, call end→wave |

## Config (virtual_host_avatar JSON)

- `defaultIdleAnimation`, `expressionIntensity`, `blinkFrequency`
- `headMovement`, `reactionsEnabled`, `lipSyncIntensity`
- `idleSchedulerEnabled`, `minAnimationCooldownMs`

## API Endpoints

- `GET /virtual-hosts/avatar/catalog` — emotions, idle anims, gift/call reactions
- `PATCH /admin/virtual-hosts/:hostId/avatar` — animation settings
- `POST /admin/virtual-hosts/avatar/preview` — preview config + performance spec

## Performance

- CSS `transform: translate3d()` + `will-change: transform`
- `contain: layout style paint` on avatar stage
- Lazy-loaded profile images
- Idle scheduler: &lt;0.1ms per pick (verified)
- Target: 60 FPS via requestAnimationFrame for speaking motion

## Verification

```bash
cd apps/api && npx tsx scripts/verify-avatar-animation.ts
cd apps/api && npx tsx scripts/verify-ai-voice.ts
cd apps/api && npx tsx scripts/verify-ai-conversation.ts
cd apps/api && npx tsx scripts/verify-virtual-hosts.ts
```