// Field limits live apart from the database code so client components can read them too.
// The editor, the server actions and the database agree on these numbers.
export const limits = { title: 120, clientName: 120, message: 2000, note: 500, fileName: 200 } as const;
