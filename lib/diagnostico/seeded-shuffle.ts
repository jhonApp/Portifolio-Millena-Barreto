import { createHash } from "node:crypto";

// Deterministic shuffle: the same items and seed always give the same order.
// Used to show the alternatives of a question in a stable, per-attempt order.

function seedToUint32(seed: string): number {
  return createHash("sha256").update(seed).digest().readUInt32BE(0);
}

// mulberry32: small seeded PRNG.
function prng(initial: number): () => number {
  let state = initial >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(items: readonly T[], seed: string): T[] {
  const result = items.slice();
  const random = prng(seedToUint32(seed));
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
