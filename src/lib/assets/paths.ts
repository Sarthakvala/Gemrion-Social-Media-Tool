/** Mirrors the kind check on public.assets. */
export const ASSET_KINDS = ['image', 'slide', 'video', 'reel', 'logo', 'document', 'audio', 'other'] as const;
export type AssetKind = (typeof ASSET_KINDS)[number];

export const ASSET_BUCKET = 'assets';
/** Matches the bucket's file_size_limit (500 MB). */
export const MAX_ASSET_BYTES = 524_288_000;

const MIME_KIND: readonly [RegExp, AssetKind][] = [
  [/^image\//, 'image'],
  [/^video\//, 'video'],
  [/^audio\//, 'audio'],
  [/^(application\/pdf|text\/|application\/(msword|vnd\.openxmlformats))/, 'document'],
];

/** Best guess at an asset kind from its MIME type; staff can override it. */
export function kindFromMime(mime: string): AssetKind {
  return MIME_KIND.find(([re]) => re.test(mime))?.[1] ?? 'other';
}

export function isAssetKind(value: string): value is AssetKind {
  return (ASSET_KINDS as readonly string[]).includes(value);
}

/** Lowercase, ASCII, no path separators: safe as the last segment of a storage key. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? '';
  const dot = base.lastIndexOf('.');
  const stem = (dot > 0 ? base.slice(0, dot) : base)
    .normalize('NFKD')
    .replace(/[^\w-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80);
  const ext = dot > 0 ? base.slice(dot + 1).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10) : '';
  return `${stem || 'file'}${ext ? `.${ext}` : ''}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<client>/<yyyy-mm>/<unique>-<name>`: brand-scoped, sortable, never collides. */
export function buildStoragePath(clientId: string, fileName: string, unique: string, now: Date = new Date()): string {
  if (!UUID.test(clientId)) throw new Error('Invalid brand id.');
  const month = now.toISOString().slice(0, 7);
  return `${clientId}/${month}/${unique}-${safeFileName(fileName)}`;
}

/** A storage path is only trusted if it sits under the brand it is recorded against. */
export function pathBelongsTo(path: string, clientId: string): boolean {
  return path.startsWith(`${clientId}/`) && !path.includes('..');
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(value < 10 ? 1 : 0)} ${units[i]}`;
}
