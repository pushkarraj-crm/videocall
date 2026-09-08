import {
  cameraFraming,
  defaultVideoAvatarConfig,
  defaultWardrobeConfig,
  phonemeFromEnergy,
  resolvePose,
  bodyLanguageForEmotion,
} from './video-avatar-engine';

describe('video-avatar-engine', () => {
  it('resolves pose from state', () => {
    expect(resolvePose(true, false, null, 'happy')).toBe('talking');
    expect(resolvePose(false, true, null, 'happy')).toBe('thinking');
    expect(resolvePose(false, false, 'celebrate_stand', 'happy')).toBe('celebrating');
  });

  it('maps phonemes from energy', () => {
    expect(phonemeFromEnergy(0, 0.1)).toBe('rest');
    expect(phonemeFromEnergy(3, 0.6, 'hello')).toBeTruthy();
  });

  it('computes camera framing with auto zoom', () => {
    const frame = cameraFraming('auto', { speaking: true, autoZoom: true });
    expect(frame.mode).toBe('medium');
    expect(frame.scale).toBeGreaterThan(0);
  });

  it('provides defaults', () => {
    expect(defaultVideoAvatarConfig().enabled).toBe(true);
    expect(defaultWardrobeConfig().outfits?.length).toBe(1);
  });

  it('maps body language', () => {
    expect(bodyLanguageForEmotion('excited').handMotion).toBe(true);
    expect(bodyLanguageForEmotion('thinking').headTilt).toBeLessThan(0);
  });
});