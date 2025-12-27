import { TRole, TStatus } from './user.interface';

export const USER_ROLE = {
  customer: 'customer',
  owner: 'owner',
  freelancer: 'freelancer',
  admin: 'admin',
  'sub-admin': 'sub-admin',
} as const;

export const UserRole: TRole[] = [
  'customer',
  'owner',
  'freelancer',
  'admin',
  'sub-admin',
];

export enum Login_With {
  google = 'google',
  apple = 'apple',
  credentials = 'credentials',
}

export const UserStatus: TStatus[] = ['ongoing', 'confirmed', 'blocked'];

export const userSearchableFields = [
  'fullName',
  'email',
  'phone',
  'streetAddress',
  'city',
  'state',
];
