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
