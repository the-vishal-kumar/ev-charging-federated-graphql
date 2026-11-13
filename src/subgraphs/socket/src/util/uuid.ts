const HEX32 = /^[0-9a-f]{32}$/;
const CANONICAL = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const format = (hex: string): string =>
  `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;

/**
 * Normalises a stored UUID (string, bson UUID or Binary subtype 4) to its
 * canonical lowercase 8-4-4-4-12 form. Returns null for anything else.
 */
export const uuidToString = (value: unknown): string | null => {
  if (typeof value === 'string') {
    const lower = value.toLowerCase();
    if (CANONICAL.test(lower)) return lower;
    return HEX32.test(lower) ? format(lower) : null;
  }
  if (value && typeof value === 'object') {
    const binary = value as { sub_type?: unknown; toString?: (encoding?: string) => string };
    if (binary.sub_type === 4 && typeof binary.toString === 'function') {
      const hex = binary.toString('hex').toLowerCase();
      return HEX32.test(hex) ? format(hex) : null;
    }
  }
  return null;
};
