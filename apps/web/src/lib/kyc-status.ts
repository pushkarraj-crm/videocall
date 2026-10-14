export type KycDisplayStatus = 'NOT_SUBMITTED' | 'PENDING' | 'VERIFIED' | 'REJECTED';

export const KYC_STATUS_STYLES: Record<KycDisplayStatus, string> = {
  NOT_SUBMITTED: 'bg-white/10 text-[#A7A7B3]',
  PENDING: 'bg-amber-500/15 text-amber-400',
  VERIFIED: 'bg-emerald-500/15 text-emerald-400',
  REJECTED: 'bg-red-500/15 text-red-400',
};

export const KYC_STATUS_LABELS: Record<KycDisplayStatus, string> = {
  NOT_SUBMITTED: 'Not Submitted',
  PENDING: 'KYC Pending',
  VERIFIED: 'KYC Verified',
  REJECTED: 'KYC Rejected',
};

export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}