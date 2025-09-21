export type RangeKey = '24h' | '7d' | '30d' | 'custom';

export type ResolvedRange = {
  start: string | null;
  end: string | null;
  key: RangeKey;
};

export const DEFAULT_RANGE: RangeKey = '7d';

function toIso(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  return date.toISOString();
}

export function resolveRange(range: RangeKey | undefined, start?: string | null, end?: string | null): ResolvedRange {
  const now = new Date();
  const key = range ?? DEFAULT_RANGE;

  if (key === 'custom') {
    return { key, start: toIso(start), end: toIso(end) };
  }

  const base = new Date(now);
  switch (key) {
    case '24h': {
      const from = new Date(base.getTime() - 24 * 60 * 60 * 1000);
      return { key, start: from.toISOString(), end: base.toISOString() };
    }
    case '7d': {
      const from = new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { key, start: from.toISOString(), end: base.toISOString() };
    }
    case '30d': {
      const from = new Date(base.getTime() - 30 * 24 * 60 * 60 * 1000);
      return { key, start: from.toISOString(), end: base.toISOString() };
    }
    default: {
      const from = new Date(base.getTime() - 7 * 24 * 60 * 60 * 1000);
      return { key: '7d', start: from.toISOString(), end: base.toISOString() };
    }
  }
}
