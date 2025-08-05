import type { User } from '../../shared/schema.js';

// Export User type as AuthenticatedUser for consistency
export type AuthenticatedUser = User;

// This function is a type guard. It not only checks if the user exists
// but also proves to TypeScript that if it returns true, the object IS a User.
export function isAuthenticatedUser(user: unknown): user is AuthenticatedUser {
  return (
    typeof user === 'object' &&
    user !== null &&
    'id' in user &&
    typeof (user as Record<string, unknown>).id === 'string'
  );
}
