// Only Novee employees can sign in.
export const ALLOWED_EMAIL_DOMAIN = "novee.security";

export function isAllowedEmail(email: string): boolean {
  const trimmed = email.trim().toLowerCase();
  return trimmed.endsWith(`@${ALLOWED_EMAIL_DOMAIN}`);
}

export const ALLOWED_EMAIL_MESSAGE = `Sign-in is restricted to @${ALLOWED_EMAIL_DOMAIN} email addresses.`;
