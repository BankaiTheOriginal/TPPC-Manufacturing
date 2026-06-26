import { Prisma } from 'generated/prisma/client';

export const USER_PUBLIC_SELECT = {
  id: true,
  staffId: true,
  firstName: true,
  lastName: true,
  email: true,
  role: true,
  locationId: true,
  jobTitle: true,
  department: true,
  phoneNumber: true,
  reportingLine: true,
  addressLine1: true,
  addressLine2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isActive: true,
  lastLogin: true,
  createdAt: true,
  updatedAt: true,
  location: {
    select: {
      id: true,
      name: true,
      state: true,
      addressLine: true,
    },
  },
} satisfies Prisma.UserSelect;

export const USER_AUTH_SELECT = {
  ...USER_PUBLIC_SELECT,
  password: true,
  refreshToken: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof USER_PUBLIC_SELECT;
}>;