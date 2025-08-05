# Data Contract and Type Handling Doctrine

---

## The MindfulCRM Data Doctrine

### 1. The Single Source of Truth: The Database Schema

#### The Database Schema Law

The file `shared/schema.ts` is the **single, absolute, and non-negotiable source of truth** for the shape of our data.

#### The Database Schema Rationale

The database is where data lives permanently. Our code is temporary and serves the data. Therefore, all types must derive from the database schema, not the other way around. We will never define a data shape in a frontend component or a service and then try to make the database match it.

#### The Database SchemaProcess

Any change to a data model (e.g., adding a `dueDate` to a `Task`) **must** begin with a change to `shared/schema.ts`

### 2. Our Bridge Between Worlds: Drizzle ORM

#### The Drizzle ORM Law

We will exclusively use Drizzle's type inference (`typeof tableName.$inferSelect`) to create our TypeScript types. We will **never** manually write a `type` or `interface` that mirrors a database table.

#### The Drizzle ORM Rationale

Manual types introduce the risk of "type drift," where the code's understanding of data becomes different from the database's reality. Drizzle's inference makes this impossible.

#### The Drizzle ORM Process

After any change to `shared/schema.ts`, the corresponding inferred types (`User`, `Contact`, etc.) will automatically update, and TypeScript will immediately tell us every single place in our codebase that needs to be updated to handle the new data shape. This is a feature, not a bug.

### 3. The Great `null` vs. `undefined` Debate: The Final Verdict

This is the source of the remaining errors. Here is the final, simple rule.

#### The `null` vs. `undefined` Law

The Backend (Server-Side) Lives with `null`: Our database uses `NULL` for optional fields. Therefore, our Drizzle-inferred types will correctly contain `| null`. All backend code (services, routes, etc.) **must** be written to handle `null` values.

The Frontend (Client-Side) Lives with `undefined`: React and modern JavaScript conventions strongly favor `undefined` for optional properties and state. It simplifies conditional rendering (`{contact.phone && <p>{contact.phone}</p>}`). Therefore, all React components and client-side logic should expect and use `| undefined`.

The API is the Border: The conversion from `null` (backend) to `undefined` (frontend) happens **ONCE**, at the API boundary, just before the data is sent to the client.

#### The `null` vs. `undefined` Rationale

This doctrine gives each environment the exact type it prefers, making the code in both places cleaner and more idiomatic. It establishes a single, clear point of conversion, preventing confusion and bugs.

#### The `null` vs. `undefined` Process

1. **In all `server/routes.ts` route handlers,** just before sending a JSON response, convert any `null` values in the data object to `undefined`. A simple helper function is perfect for this.

```typescript
// Create this helper function, maybe in `server/utils/api-helpers.ts`
function nullsToUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return undefined as any;
  }
  if (typeof obj !== 'object') {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(nullsToUndefined) as any;
  }
  const newObj = {} as T;
  for (const key in obj) {
    if (obj[key] === null) {
      newObj[key] = undefined;
    } else {
      newObj[key] = nullsToUndefined(obj[key]);
    }
  }
  return newObj;
}

// In a route handler in `routes.ts`:
app.get('/api/contacts/:id', requireAuth, async (req: Request, res: Response) => {
  // ... logic to get contact from storage (it will have `null`s)
  const contactFromDb = await storage.getContact(contactId);

  // Convert just before sending
  res.json(nullsToUndefined(contactFromDb));
});
```

You're right to ask for clarification on this. While warnings are less critical than errors, a clean codebase should have none. In a production readiness sprint, eliminating noise is key to focusing on what matters.

Here is the official **MindfulCRM Doctrine on Warnings**.

---

### 4. The Warning Cleanup Doctrine

#### `no-console` Warnings

- **The Law:** The `console.log()` function is **forbidden** in production application code (both client and server). It is a tool for temporary, local debugging only. All instances must be removed before a merge.
- **The Rationale:** Console logs expose internal application data and logic to the browser console, which is a potential information leak. They also create unnecessary noise in server logs, making it harder to find real errors.
- **The Fix:**
  - **For debugging information:** Delete the `console.log()` statement entirely once you are done with it.
  - **For actual errors:** Replace `console.log(error)` with our official `logError('Context of what failed', error)` utility from `server/utils/error-handling.ts`. This ensures errors are handled consistently.
  - **For analytics or user tracking (rare):** If you have a legitimate reason to log an event, use a dedicated analytics service, not `console.log`.

**Atomic Prompt to Fix:**
"Search the entire project for the ESLint rule `no-console`. For every warning found:

1. If the log is for debugging, delete the entire line.
2. If the log is capturing a legitimate error in a `catch` block, replace it with a call to our `logError` utility.
   Do not leave any `console.log`, `console.warn`, or `console.error` statements in the final code."

---

#### **2. `react-refresh/only-export-components` Warnings**

- **The Law:** A file containing a React component (using JSX) should **only** export React components. Any non-component exports (like constants, helper functions, or types) must be moved to their own separate files.
- **The Rationale:** This warning is from the "Fast Refresh" (Hot Reloading) library for React. For it to work reliably, it needs to know that a file contains _only_ components. When you export a mix of components and other values, it can get confused and cause the hot reload to fail or behave unpredictably. Following this rule improves the developer experience.
- **The Fix:**
  - Identify the file with the warning (e.g., `client/src/components/ui/button.tsx`).
  - Identify the non-component export (e.g., `export const buttonVariants = ...`).
  - Create a new file, often in a `lib/` or `utils/` subdirectory (e.g., `client/src/lib/variants.ts`).
  - Move the non-component export (`buttonVariants`) into this new file.
  - Update the original file and any other files that were using it to import from the new location.

**Atomic Prompt to Fix:**
"The file `client/src/components/ui/button.tsx` is throwing a `react-refresh/only-export-components` warning.

1. Create a new file at `client/src/lib/variants.ts`.
2. Find the `buttonVariants` constant in `button.tsx` and move the entire constant definition into `client/src/lib/variants.ts`.
3. In `button.tsx`, import `buttonVariants` from the new `lib/variants.ts` file.
4. Apply this same pattern to any other component file that has this warning."

---

Execute these two directives. They will eliminate the majority of the **35 warnings** and bring us even closer to a perfectly clean codebase.
