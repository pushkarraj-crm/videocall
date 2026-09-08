import {
  isRealHostAvailable,
  pickAiHost,
  pickBestRealHost,
  resolveAssetSlug,
  scoreRealHost,
} from './call-routing-engine';

describe('call-routing-engine', () => {
  it('detects available real host', () => {
    expect(
      isRealHostAvailable({
        profileType: 'REAL_HOST',
        isOnline: true,
        isBusy: false,
        adminCallsDisabled: false,
        virtualHostEnabled: false,
      }),
    ).toBe(true);
  });

  it('scores language match higher', () => {
    const hi = scoreRealHost(
      { virtualHostRegion: 'IN', user: { primaryLanguage: 'hi' } },
      { callerLanguage: 'hi' },
    );
    const en = scoreRealHost(
      { virtualHostRegion: 'IN', user: { primaryLanguage: 'en' } },
      { callerLanguage: 'hi' },
    );
    expect(hi).toBeGreaterThan(en);
  });

  it('picks best real host', () => {
    const pick = pickBestRealHost([
      { userId: 'a', displayName: 'A', primaryLanguage: 'en', virtualHostRegion: null, lastSeenAt: null, score: 10 },
      { userId: 'b', displayName: 'B', primaryLanguage: 'hi', virtualHostRegion: null, lastSeenAt: null, score: 40 },
    ]);
    expect(pick?.userId).toBe('b');
  });

  it('resolves asset slug', () => {
    expect(resolveAssetSlug('Sophia', { assetSlug: 'sophia' })).toBe('sophia');
    expect(resolveAssetSlug('Aanya Sharma', null)).toBe('aanyasharma');
  });

  it('picks AI host uniformly at random among all candidates', () => {
    const candidates = [
      { userId: 'low', displayName: 'Low', assetSlug: 'low', sceneSlug: 'bedroom', outfitSlug: 'casual', score: 10 },
      { userId: 'high', displayName: 'High', assetSlug: 'high', sceneSlug: 'bedroom', outfitSlug: 'casual', score: 100 },
    ];
    const counts = { low: 0, high: 0 };
    for (let i = 0; i < 200; i++) {
      const pick = pickAiHost(candidates, true);
      if (pick?.userId === 'low') counts.low++;
      if (pick?.userId === 'high') counts.high++;
    }
    expect(counts.low).toBeGreaterThan(20);
    expect(counts.high).toBeGreaterThan(20);
  });
});