import {
  defaultAvatarAnimationConfig,
  mapCallEventToReaction,
  mapEmotionToExpression,
  mapGiftToReaction,
  pickIdleAnimation,
  randomBlinkDelay,
  speakingMotionFrame,
} from './avatar-engine';

describe('avatar-engine', () => {
  it('maps emotions to expressions', () => {
    const excited = mapEmotionToExpression('excited', 1);
    expect(excited.id).toBe('excited');
    expect(excited.eyeScale).toBeGreaterThan(1);
  });

  it('maps gift categories to reactions', () => {
    expect(mapGiftToReaction('vip').id).toBe('celebrate_stand');
    expect(mapGiftToReaction('basic').id).toBe('smile');
    expect(mapGiftToReaction('luxury', 'fullscreen').id).toBe('heart');
  });

  it('maps call events', () => {
    expect(mapCallEventToReaction('call_ending')?.id).toBe('wave_goodbye');
    expect(mapCallEventToReaction('long_silence')?.id).toBe('look_around');
  });

  it('picks idle animations with cooldown', () => {
    const config = defaultAvatarAnimationConfig();
    const now = Date.now();
    const pick = pickIdleAnimation(config, 'blink', { blink: now }, now);
    expect(pick.id).not.toBe('blink');
  });

  it('generates blink delays in range', () => {
    const delay = randomBlinkDelay('medium');
    expect(delay).toBeGreaterThanOrEqual(3200);
    expect(delay).toBeLessThanOrEqual(6000);
  });

  it('produces speaking motion frames', () => {
    const frame = speakingMotionFrame(0.8, 10, 0.75);
    expect(frame.jawOpen).toBeGreaterThan(0);
    expect(frame.headBob).toBeLessThan(0.2);
  });
});