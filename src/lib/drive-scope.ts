// Shared by the browser and the server. drive.file lets Memocraft see only the files and folders it creates.
export const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file";

type GoogleRequest = { scopes: string[]; additionalParams: Record<string, string> };

// Every sign-in asks for the Drive permission, so the backup can run for everyone. Offline access is what lets
// Memocraft keep copying after the person closes the tab. Google shows the permission on its own screen, and the
// sign-in page says it in words too. Returning people are not asked to consent again.
export const driveSignIn: GoogleRequest = {
  scopes: [DRIVE_SCOPE],
  additionalParams: { access_type: "offline" },
};

// Used from Settings when the permission or its refresh token is missing: the explicit consent screen is what makes
// Google hand over a new refresh token.
export const driveRequest: GoogleRequest = {
  scopes: [DRIVE_SCOPE],
  additionalParams: { access_type: "offline", prompt: "consent" },
};
