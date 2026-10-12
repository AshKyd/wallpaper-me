import { describe, expect, it } from 'vitest';
import { PALETTE_VARIANTS } from '#lib/components/PaletteBackground/generators.js';
import { VARIANT_NAMES } from '../../params/index.js';
import { optionsFor } from '#lib/components/PaletteBackground/variantOptions.js';
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
			gap: 0.12,
			grain: true,
			aberration: true,
			options: {}
		};
		const query = toQueryString(settings);
		expect(readSettings({ variant: 'hexagons', params: new URLSearchParams(query), paletteCount: 10 })).toEqual(settings);
	});

	describe('sub-type options', () => {
		it('round-trips a variant\'s options through the query string, under their own names', () => {
			const settings: WallpaperSettings = { variant: 'midcentury', ...DEFAULT_SETTINGS, options: { shape: 'triangle', facing: 'left' } };
			const query = toQueryString(settings);
			expect(query).toBe('?shape=triangle&facing=left');
			expect(readSettings({ variant: 'midcentury', params: new URLSearchParams(query), paletteCount: 10 })).toEqual(settings);
		});

		it('has options for art deco, mid-century and neon', () => {
			expect(optionsFor('artdeco').map(({ key }) => key)).toEqual(['style']);
			expect(optionsFor('midcentury').map(({ key }) => key)).toEqual(['shape', 'facing']);
			expect(optionsFor('neon').map(({ key }) => key)).toEqual(['shape']);
			expect(optionsFor('neon')[0]!.values).toEqual(['circle', 'triangle', 'square', 'pentagon', 'hexagon']);
			expect(optionsFor('circles')).toEqual([]);
		});

		it('ignores unknown values, and options that belong to another variant', () => {
			expect(read('style=nope').options).toEqual({});
			// `style` is art deco's; a circles page has no such option.
			expect(read('style=sunburst').options).toEqual({});
			const artDeco = readSettings({ variant: 'artdeco', params: new URLSearchParams('style=sunburst&shape=arc'), paletteCount: 10 });
			expect(artDeco.options).toEqual({ style: 'sunburst' });
		});

		it('drops the options of the variant you left when writing the query', () => {
			const query = toQueryString({ variant: 'artdeco', ...DEFAULT_SETTINGS, options: { style: 'peacock', shape: 'arc' } });
			expect(query).toBe('?style=peacock');
		});
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

	it('keeps the route matcher in step with the real variants', () => {
		expect(VARIANT_NAMES).toEqual([...PALETTE_VARIANTS]);
	});

	it('recognises only real variants', () => {
		expect(isVariant('bokeh')).toBe(true);
		expect(isVariant('nope')).toBe(false);
	});
});
