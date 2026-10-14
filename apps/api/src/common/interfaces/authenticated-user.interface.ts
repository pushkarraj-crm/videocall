import { Role, UserStatus } from '@prisma/client';

export interface AuthenticatedUser {
  id: string;
  authIdentity: string;
  displayName: string;
  status: UserStatus;
  roles: Role[];
}