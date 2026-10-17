// Sign-in options that need keys from outside. Each one only appears when its keys are set.
export const googleConfigured = () => Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
