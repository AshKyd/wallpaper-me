import { PALETTE_VARIANTS, type PaletteVariant } from '#lib/components/PaletteBackground/generators.js';
import { PALETTE_TONES, type PaletteTone } from '#lib/components/PaletteBackground/tones.js';

/** Everything that defines a wallpaper. All of it round-trips through the URL, so a link recreates the wallpaper exactly. */
export interface WallpaperSettings {
	variant: PaletteVariant;
	/** Position in `palettes.json`. */
	paletteIndex: number;
	seed: number;
	tone: PaletteTone;
	/** Border between shapes, 0 to 0.4. Only `hexagons` uses it. */
	gap: number;
}

export const SEED_MAX = 999_999;

/** Values equal to these are left out of the URL, which keeps links short. */
export const DEFAULT_SETTINGS: Omit<WallpaperSettings, 'variant'> = {
	paletteIndex: 0,
	seed: 1,
	tone: 'original',
	gap: 0
};

/** Short query keys, to keep the hash readable and compact. */
const KEYS = {
	paletteIndex: 'p',
	seed: 's',
	tone: 't',
	gap: 'g'
} as const;

export function isVariant(value: string): value is PaletteVariant {
	return (PALETTE_VARIANTS as readonly string[]).includes(value);
}

function isTone(value: string): value is PaletteTone {
	return (PALETTE_TONES as readonly string[]).includes(value);
}

/** Read-only view of the query, which is what `page.url.searchParams` gives. */
type QueryParams = Pick<URLSearchParams, 'get'>;

/** Reads a number from the URL, clamped to the range. Missing or malformed values fall back to the default, so a hand-edited link never breaks the page. */
function numberParam({ params, key, fallback, min, max, whole = false }: {
	params: QueryParams;
	key: string;
	fallback: number;
	min: number;
	max: number;
	whole?: boolean;
}): number {
	const raw = params.get(key);
	const parsed = raw === null || raw.trim() === '' ? Number.NaN : Number(raw);
	if (!Number.isFinite(parsed)) return fallback;
	const clamped = Math.min(max, Math.max(min, parsed));
	return whole ? Math.round(clamped) : clamped;
}

export function readSettings({ variant, params, paletteCount }: {
	variant: PaletteVariant;
	params: QueryParams;
	paletteCount: number;
}): WallpaperSettings {
	const tone = params.get(KEYS.tone) ?? '';
	return {
		variant,
		paletteIndex: numberParam({ params, key: KEYS.paletteIndex, fallback: DEFAULT_SETTINGS.paletteIndex, min: 0, max: Math.max(0, paletteCount - 1), whole: true }),
		seed: numberParam({ params, key: KEYS.seed, fallback: DEFAULT_SETTINGS.seed, min: 1, max: SEED_MAX, whole: true }),
		tone: isTone(tone) ? tone : DEFAULT_SETTINGS.tone,
		gap: numberParam({ params, key: KEYS.gap, fallback: DEFAULT_SETTINGS.gap, min: 0, max: 0.4 })
	};
}

/** The query string for a wallpaper (with its leading `?`), or an empty string when everything is default. The variant lives in the path, not here. */
export function toQueryString(settings: WallpaperSettings): string {
	const params = new URLSearchParams();
	(Object.keys(KEYS) as (keyof typeof KEYS)[]).forEach((name) => {
		const value = settings[name];
		if (value === DEFAULT_SETTINGS[name]) return;
		params.set(KEYS[name], String(value));
	});
	const query = params.toString();
	return query ? `?${query}` : '';
}
