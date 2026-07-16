import type { Request } from 'express';

export type AuthenticatedUser = {
  id: string;
  authSubject: string;
  roles: string[];
};

export type AuthenticatedRequest = Request & {
  requestId: string;
  user: AuthenticatedUser;
};
