import type { User as DBUser } from '../shared/schema';

declare global {
  namespace Express {
    interface User extends DBUser {
      // User already has all fields from DB schema
    }

    interface Request {
      user?: User;
    }
  }
}

export {};
