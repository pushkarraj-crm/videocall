export interface CompleteOnboardingPayload {
  displayName: string;
  dateOfBirth: string;
  gender?: string;
  primaryLanguage?: string;
  bio?: string;
  acceptTerms: boolean;
  acceptPrivacy: boolean;
  acceptCommunityGuidelines: boolean;
  ageDeclaration: boolean;
  referralCode?: string;
  deviceFingerprint?: string;
}