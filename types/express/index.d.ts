// types/express/index.d.ts
import type { AppUser } from '@shared/schema';

declare global {
  namespace Express {
    interface Request {
      user?: AppUser;
    }
  }
}
