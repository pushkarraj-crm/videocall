import type { Call } from '@prisma/client';

export function serializeCall(call: Call) {
  return {
    ...call,
    coinsChargedUnits: call.coinsChargedUnits.toString(),
  };
}