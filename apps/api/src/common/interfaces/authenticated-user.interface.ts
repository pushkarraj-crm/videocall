import { Role, UserStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  firebaseUid: string;
  displayName: string;
  status: UserStatus;
  roles: Role[];
}