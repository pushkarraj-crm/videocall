import { Role } from '@prisma/client';

export const ADMIN_ROLES: Role[] = [
  Role.admin,
  Role.super_admin,
  Role.moderator,
  Role.grievance_officer,
  Role.support,
];

export const STAFF_ROLES: Role[] = [
  Role.moderator,
  Role.admin,
  Role.super_admin,
  Role.grievance_officer,
  Role.support,
];

export const ROLE_HIERARCHY: Record<Role, number> = {
  [Role.user]: 0,
  [Role.host]: 1,
  [Role.support]: 2,
  [Role.moderator]: 3,
  [Role.grievance_officer]: 4,
  [Role.admin]: 5,
  [Role.super_admin]: 6,
};