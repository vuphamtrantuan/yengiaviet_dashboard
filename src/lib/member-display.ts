/** Prefer display name; fall back to email only when name is missing. */
export function memberDisplayName(member: {
  name: string | null | undefined;
  email: string;
}): string {
  const trimmed = member.name?.trim();
  return trimmed || member.email;
}

/** Label for a card assignee using name first, then email. */
export function assigneeDisplayName(
  name: string | null | undefined,
  email: string | null | undefined
): string {
  const trimmed = name?.trim();
  if (trimmed) {
    return trimmed;
  }
  if (email?.trim()) {
    return email.trim();
  }
  return "Chưa gán";
}
