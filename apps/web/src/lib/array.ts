/** Toggle a value in a list (remove if present, append if absent). Used by the
 *  multi-select filter menus. */
export function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((x) => x !== value) : [...list, value];
}
