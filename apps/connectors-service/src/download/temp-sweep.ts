import { promises as fs } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

// Best-effort one-shot cleanup of crawler temp dirs orphaned by a crash/restart
// (lyra-dl-* downloads, lyra-ck-* cookie files). The in-process TTL sweep only
// removes dirs it still tracks; a restart loses that tracking. Never throws.
export async function sweepOrphanTempDirs(opts: {
  dir?: string; prefixes?: string[]; maxAgeMs?: number; now?: number;
} = {}): Promise<void> {
  const dir = opts.dir ?? tmpdir();
  const prefixes = opts.prefixes ?? ['lyra-dl-', 'lyra-ck-'];
  const maxAgeMs = opts.maxAgeMs ?? 3_600_000; // 1h
  const now = opts.now ?? Date.now();
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return;
  }
  for (const name of entries) {
    if (!prefixes.some((p) => name.startsWith(p))) continue;
    const full = join(dir, name);
    try {
      const st = await fs.stat(full);
      if (!st.isDirectory() || now - st.mtimeMs < maxAgeMs) continue;
      await fs.rm(full, { recursive: true, force: true });
    } catch {
      // best-effort: a permission/busy error on one dir must not abort the sweep
    }
  }
}
