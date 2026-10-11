import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, SEED_MAX, isVariant, readSettings, toQueryString, type WallpaperSettings } from './wallpaperSettings.js';

const read = (query: string, paletteCount = 10) =>
	readSettings({ variant: 'circles', params: new URLSearchParams(query), paletteCount });

describe('wallpaperSettings', () => {
	it('uses defaults for an empty query', () => {
		expect(read('')).toEqual({ variant: 'circles', ...DEFAULT_SETTINGS });
	});

	it('round-trips every property through the query string', () => {
		const settings: WallpaperSettings = {
			variant: 'hexagons',
			paletteIndex: 4,
			seed: 1234,
			tone: 'pastel',
			gap: 0.12
		};
		const query = toQueryString(settings);
		expect(readSettings({ variant: 'hexagons', params: new URLSearchParams(query), paletteCount: 10 })).toEqual(settings);
	});

	it('leaves default values out of the URL', () => {
		expect(toQueryString({ variant: 'bands', ...DEFAULT_SETTINGS })).toBe('');
		expect(toQueryString({ variant: 'bands', ...DEFAULT_SETTINGS, seed: 7 })).toBe('?s=7');
	});

	it('clamps out-of-range numbers and ignores malformed ones', () => {
		expect(read('p=99', 10).paletteIndex).toBe(9);
		expect(read('s=0').seed).toBe(1);
		expect(read('s=99999999').seed).toBe(SEED_MAX);
		expect(read('g=abc').gap).toBe(DEFAULT_SETTINGS.gap);
		expect(read('g=').gap).toBe(DEFAULT_SETTINGS.gap);
		expect(read('g=5').gap).toBe(0.4);
	});

	it('ignores unknown tones', () => {
		expect(read('t=neon').tone).toBe('original');
	});

	it('recognises only real variants', () => {
		expect(isVariant('bokeh')).toBe(true);
		expect(isVariant('nope')).toBe(false);
	});
});
