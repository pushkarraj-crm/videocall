import {
  canVirtualHostReceiveCall,
  isVirtualHostDiscoverable,
  isVirtualHostProfile,
  syncVirtualHostAvailability,
  virtualStatusToAvailability,
} from './virtual-host';

describe('virtual-host utils', () => {
  const baseVirtual = {
    profileType: 'AI_HOST' as const,
    virtualHostEnabled: true,
    virtualHostStatus: 'ONLINE' as const,
    adminCallsDisabled: false,
    isOnline: true,
    isBusy: false,
  };

  it('detects virtual host profiles', () => {
    expect(isVirtualHostProfile({ profileType: 'AI_HOST', virtualHostEnabled: true })).toBe(true);
    expect(isVirtualHostProfile({ profileType: 'REAL_HOST', virtualHostEnabled: true })).toBe(
      false,
    );
  });

  it('maps virtual status to availability', () => {
    expect(virtualStatusToAvailability('ONLINE')).toEqual({
      isOnline: true,
      isBusy: false,
      isAvailable: true,
    });
    expect(virtualStatusToAvailability('BUSY')).toEqual({
      isOnline: true,
      isBusy: true,
      isAvailable: false,
    });
    expect(syncVirtualHostAvailability('OFFLINE').isOnline).toBe(false);
  });

  it('checks discoverability and call eligibility', () => {
    expect(isVirtualHostDiscoverable(baseVirtual)).toBe(true);
    expect(canVirtualHostReceiveCall(baseVirtual)).toBe(true);
    expect(
      canVirtualHostReceiveCall({ ...baseVirtual, virtualHostStatus: 'BUSY', isBusy: true }),
    ).toBe(false);
  });
});