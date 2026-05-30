export function isAdminEmail(email: string | undefined | null): boolean {
  if (!email) return false
  const admins = (process.env.NEXT_PUBLIC_ADMIN_EMAILS ?? '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
  return admins.includes(email.toLowerCase())
}
