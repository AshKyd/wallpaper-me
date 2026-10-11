import { describe, expect, it } from 'vitest';
import type { Palette } from '#lib/components/PaletteBackground/paletteUtils.js';
import { PALETTE_TONES } from '#lib/components/PaletteBackground/tones.js';
import { midColour, toneLabel, toneSwatches } from './toneSwatches.js';

const palette: Palette = {
	title: 'Test',
	url: null,
	creator: null,
	colors: [
		{ hex: '#000000', prominence: 0.2 },
		{ hex: '#ff0000', prominence: 0.3 },
		{ hex: '#ffffff', prominence: 0.5 }
	]
};

describe('toneSwatches', () => {
	it('picks the median colour by lightness', () => {
		expect(midColour(palette)).toBe('#ff0000');
	});

	it('returns nothing for an empty palette', () => {
		expect(midColour({ ...palette, colors: [] })).toBeUndefined();
		expect(toneSwatches({ ...palette, colors: [] })).toEqual([]);
	});

	it('gives one swatch per tone, leaving original untouched', () => {
		const swatches = toneSwatches(palette);
		expect(swatches.map(({ tone }) => tone)).toEqual([...PALETTE_TONES]);
		expect(swatches[0]?.hex).toBe('#ff0000');
		expect(swatches[1]?.hex).not.toBe('#ff0000');
	});

	it('writes readable tone names', () => {
		expect(toneLabel('subtleDark')).toBe('Subtle dark');
		expect(toneLabel('pastel')).toBe('Pastel');
	});
});
