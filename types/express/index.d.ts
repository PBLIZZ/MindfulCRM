// Import our Drizzle-inferred database User type and rename it for clarity.
import type { User as DatabaseUser } from '../../shared/schema.js';

// This declares that we are augmenting a global module.
declare global {
  // This targets the Express namespace.
  namespace Express {
    // This is the key to declaration merging. We are telling TypeScript that
    // the built-in `User` interface in Express should be extended to include
    // all the properties from our `DatabaseUser` type.
    interface User extends DatabaseUser {
      // You could add additional session-specific properties here if needed,
      // but extending is usually all that's required.
    }

    // Now, we augment the Request interface to use our newly enhanced User type.
    interface Request {
      user?: User;
    }
  }
}

// This line is crucial. It tells TypeScript to treat this file as a module,
// which is necessary for the `import` at the top to work correctly with `declare global`.
export {};
