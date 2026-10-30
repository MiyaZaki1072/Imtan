import { createHash } from 'node:crypto';

// Fixed namespace for อิ่มทัน seed ids. Same YAML path → same UUID on every seed run,
// so re-seeding (and "Reset demo") updates rows in place instead of duplicating them.
const NAMESPACE = 'b7a4f0e2-5d1c-4c8e-9a3f-2e6d8c1b4a70';

/** RFC 4122 version 5 (SHA-1, name-based) UUID. */
export function uuidV5(name: string, namespace = NAMESPACE): string {
  const ns = Buffer.from(namespace.replace(/-/g, ''), 'hex');
  const hash = createHash('sha1').update(ns).update(name, 'utf8').digest();
  hash[6] = (hash[6] & 0x0f) | 0x50;
  hash[8] = (hash[8] & 0x3f) | 0x80;
  const hex = hash.subarray(0, 16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
