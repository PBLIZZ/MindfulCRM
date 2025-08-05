# Data Contract and Type Handling Doctrine

---

## The MindfulCRM Data Doctrine

### 1. The Single Source of Truth: The Database Schema

#### The Database Schema Law

The file `shared/schema.ts` is the **single, absolute, and non-negotiable source of truth** for the shape of our data AT REST.

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

### 4. The `any` vs. `unknown` Mandate: Safety First

#### The `any` vs. `unknown` Law

The type `any` is forbidden in our codebase. It is an escape hatch from the type system, and we will not use it. Any existing `any` types are considered technical debt and must be removed.

The type `unknown` is our required tool for handling data whose type is not known at compile time. This applies specifically to data coming from external sources: API request bodies `req.body`, network responses `fetch`, and catch block error objects `error`.

If you know the shape of the data, you must use a specific type or a Zod schema to parse and validate it.

Do not be lazy. If you receive a User from an API, create a User type and validate the response against it.

#### The `any` vs. `unknown` Rationale

`any` allows you to do anything, which leads to runtime errors and negates the benefits of TypeScript. `unknown` forces you to do something — a type check or a type assertion—before you can use the variable. It forces safe coding practices. Speed over accuracy in typing is a false economy that costs us more time in debugging. We will be accurate from the start.

#### The `any` vs. `unknown` Process

When you receive data from an external source, its type is unknown. Use a type guard or a Zod schema to validate that the unknown data matches the shape you expect. Only after this validation can you assign it to a specific, known type and use it in your application.

```typescript
// FORBIDDEN PATTERN
app.post('/api/users', (req: Request, res: Response) => {
  const userData: any = req.body; // Unsafe, FORBIDDEN
  console.log(userData.profile.name); // This could crash at runtime
});

// REQUIRED PATTERN
import { userSchema } from '../schemas/user.schema.js';

app.post('/api/users', (req: Request, res: Response) => {
  try {
    // req.body is treated as `unknown` and validated by Zod
    const validatedUserData = userSchema.parse(req.body);
    // `validatedUserData` is now a fully typed and safe object
    console.log(validatedUserData.profile.name);
  } catch (error) {
    // ... error handling
  }
});
```

### 5. The `Error Handling` Doctrine: Fail Predictably

#### The Error Handling Law

All errors must be handled predictably. This means that all errors must be caught and handled in a way that is consistent with the rest of the application. We will never let an error propagate up the call stack without being handled.
