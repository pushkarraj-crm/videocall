import type { VirtualHostVoiceConfig, VoiceProviderName } from '../../../common/utils/virtual-host';

export type VoiceSynthesisResult = {
  audio: Buffer;
  mimeType: string;
};

export interface VoiceProvider {
  readonly name: VoiceProviderName;
  synthesize(
    text: string,
    config: VirtualHostVoiceConfig,
    signal?: AbortSignal,
  ): Promise<VoiceSynthesisResult>;
}