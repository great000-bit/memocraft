// Shared by the browser and the server. drive.file lets Memocraft see only the files and folders it creates.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

// Extra parameters for the Google sign-in request. Offline access plus an explicit consent screen is what makes
// Google hand over a refresh token, which the backup needs to keep working after the person closes the tab.
export const driveRequest: { scopes: string[]; additionalParams: Record<string, string> } = {
  scopes: [DRIVE_SCOPE],
  additionalParams: { access_type: "offline", prompt: "consent" },
};
