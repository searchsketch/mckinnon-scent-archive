export const STORAGE_KEY = "mckinnon.memory-archive.v1";
export const SCHEMA_VERSION = 3;

export const FAVORITE_BOTTLE_STYLES = [
  "ivory-seal",
  "raven",
  "serpent",
  "stag",
  "moon",
  "white-mask",
] as const;

export type FavoriteBottleStyle = (typeof FAVORITE_BOTTLE_STYLES)[number];

export type PerformanceMemory = {
  id: string;
  date: string;
  moodColor: string;
  hadOneOnOne: boolean;
  oneOnOneWith: string[];
  mostMemorableCharacter: string;
  memoryText: string;
  isFavorite: boolean;
  favoriteBottleStyle: FavoriteBottleStyle | null;
  createdAt: string;
  updatedAt: string;
};

type StoredArchive = {
  schemaVersion: number;
  memories: PerformanceMemory[];
};

const isHex = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);

export function isPerformanceMemory(value: unknown): value is PerformanceMemory {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<PerformanceMemory>;
  return (
    typeof item.id === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(item.date ?? "") &&
    isHex(item.moodColor) &&
    typeof item.hadOneOnOne === "boolean" &&
    Array.isArray(item.oneOnOneWith) &&
    item.oneOnOneWith.every((name) => typeof name === "string" && name.trim().length > 0) &&
    typeof item.mostMemorableCharacter === "string" &&
    item.mostMemorableCharacter.trim().length > 0 &&
    typeof item.memoryText === "string" &&
    item.memoryText.trim().length > 0 &&
    typeof item.isFavorite === "boolean" &&
   (item.favoriteBottleStyle === null ||
     (typeof item.favoriteBottleStyle === "string" &&
       FAVORITE_BOTTLE_STYLES.includes(item.favoriteBottleStyle))) &&
    typeof item.createdAt === "string" &&
    typeof item.updatedAt === "string"
  );
}

function normalizeMemory(value: unknown): PerformanceMemory | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  const legacyNames =
    typeof item.oneOnOneWith === "string" && item.oneOnOneWith.trim()
      ? [item.oneOnOneWith.trim()]
      : [];
  const names = Array.isArray(item.oneOnOneWith)
    ? item.oneOnOneWith
        .filter((name): name is string => typeof name === "string")
        .map((name) => name.trim())
        .filter(Boolean)
    : legacyNames;
  const normalized = {
    ...item,
    oneOnOneWith: Array.from(new Set(names)),
    isFavorite: typeof item.isFavorite === "boolean" ? item.isFavorite : false,
    favoriteBottleStyle:
      typeof item.favoriteBottleStyle === "string" &&
      FAVORITE_BOTTLE_STYLES.includes(item.favoriteBottleStyle as FavoriteBottleStyle)
        ? item.favoriteBottleStyle
        : null,
  };
  return isPerformanceMemory(normalized) ? normalized : null;
}

function parseArchive(raw: string): StoredArchive {
  const parsed = JSON.parse(raw) as { schemaVersion?: number; memories?: unknown[] };
  if (![1, 2, SCHEMA_VERSION].includes(parsed.schemaVersion ?? -1) || !Array.isArray(parsed.memories)) {
    throw new Error("This archive uses an unsupported schema version.");
  }
  const memories = parsed.memories.map(normalizeMemory);
  if (memories.some((memory) => memory === null)) {
    throw new Error("The archive contains invalid memory records.");
  }
  return { schemaVersion: SCHEMA_VERSION, memories: memories as PerformanceMemory[] };
}

export const memoryStorage = {
  load(): PerformanceMemory[] {
    if (typeof window === "undefined") return [];
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return parseArchive(raw).memories;
  },

  save(memories: PerformanceMemory[]) {
    if (typeof window === "undefined") return;
    const archive: StoredArchive = { schemaVersion: SCHEMA_VERSION, memories };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(archive));
  },

  export(memories: PerformanceMemory[]) {
    return JSON.stringify({ schemaVersion: SCHEMA_VERSION, memories }, null, 2);
  },

  import(raw: string) {
    return parseArchive(raw).memories;
  },
};

export function createMemory(
  fields: Omit<PerformanceMemory, "id" | "createdAt" | "updatedAt">,
): PerformanceMemory {
  const now = new Date().toISOString();
  return {
    ...fields,
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
  };
}
