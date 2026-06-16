import type { UserRef } from '@lyra/shared';

// Resolve a stored user id to a populated {id, name}, with a safe fallback.
export function userRef(
  id: string | undefined,
  map: Map<string, UserRef>,
): UserRef {
  if (!id) return { id: '', name: 'Unknown' };
  return map.get(id) ?? { id, name: 'Unknown' };
}

export function userRefs(
  ids: string[],
  map: Map<string, UserRef>,
): UserRef[] {
  return ids.map((id) => userRef(id, map));
}
