// Serialize a date to ISO, tolerant of legacy documents that predate a field
// (e.g. updatedAt added later). Callers pass a fallback for the missing case.
export function iso(d?: Date | string | null): string {
  if (!d) return new Date(0).toISOString();
  return typeof d === 'string' ? d : d.toISOString();
}
