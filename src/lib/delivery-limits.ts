// Field limits live apart from the database code so client components can read them too.
// The editor, the server actions and the database agree on these numbers.
export const limits = { title: 120, clientName: 120, message: 2000, note: 500, fileName: 200, update: 300, request: 500, comment: 600, email: 254 } as const;

// A link password is something a creative tells a client, so it is short enough to type on a phone.
export const passwordRules = { min: 6, max: 100 } as const;

// Wrong guesses in a row before a protected link stops accepting guesses, and for how long.
export const guessLimit = { attempts: 8, lockMinutes: 15 } as const;
