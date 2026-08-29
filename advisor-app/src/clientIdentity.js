export function initials(email) {
  return (email || '?').trim()[0]?.toUpperCase() || '?';
}
