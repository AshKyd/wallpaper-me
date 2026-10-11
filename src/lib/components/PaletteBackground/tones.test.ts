import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { PALETTE_VARIANTS, generatePaletteArt } from './generators.js';
import { hexToOklch, oklchToHex } from './oklch.js';
import { normalisePalette, type Palette } from './paletteUtils.js';
import { TONE_SETTINGS, applyTone, buildToneMap, saturationOf, type PaletteTone } from './tones.js';

const palettes = paletteData as Palette[];
const shiftedTones = Object.keys(TONE_SETTINGS) as Exclude<PaletteTone, 'original'>[];

/** Smallest angle between two hues, in degrees. */
const hueDifference = (first: number, second: number) => Math.abs(((first - second + 540) % 360) - 180);
const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
const hexesOf = (palette: Palette) => normalisePalette(palette).map(({ hex }) => hex);

/** The palette's colours before and after a tone, in OKLCH. */
function beforeAndAfter(palette: Palette, tone: PaletteTone) {
	const map = buildToneMap(palette, tone);
	const hexes = hexesOf(palette);
	return { map, hexes, before: hexes.map(hexToOklch), after: hexes.map((hex) => hexToOklch(map(hex))) };
}

describe('oklch', () => {
	it('round-trips a hex', () => {
		['#69d2e7', '#fa6900', '#542437', '#ffffff', '#000000'].forEach((hex) => {
			expect(oklchToHex(hexToOklch(hex))).toBe(hex);
		});
	});

	it('lowers chroma, not hue, for colours outside sRGB', () => {
		const { hue } = hexToOklch('#ff0000');
		const clamped = hexToOklch(oklchToHex({ lightness: 0.9, chroma: 0.35, hue }));
		expect(hueDifference(clamped.hue, hue)).toBeLessThan(5);
		expect(clamped.chroma).toBeLessThan(0.35);
	});
});

describe('buildToneMap', () => {
	it('leaves the original tone untouched', () => {
		const map = buildToneMap(palettes[0]!, 'original');
		hexesOf(palettes[0]!).forEach((hex) => expect(map(hex)).toBe(hex));
	});

	describe.each(shiftedTones)('%s', (tone) => {
		const { band } = TONE_SETTINGS[tone];

		it('keeps hue, tells every colour apart and keeps clearly lighter colours lighter', () => {
			palettes.forEach((palette) => {
				const { map, hexes, before, after } = beforeAndAfter(palette, tone);

				// Hue holds wherever there is enough chroma for it to mean something (8-bit rounding blurs it at low chroma).
				after.forEach((colour, index) => {
					if (colour.chroma > 0.05) expect(hueDifference(colour.hue, before[index]!.hue), palette.title).toBeLessThan(6);
				});

				expect(new Set(hexes.map(map)).size, palette.title).toBe(hexes.length);

				// Pairs close in lightness may swap (saturation lowers apparent lightness), clear gaps must not.
				before.forEach((first, firstIndex) =>
					before.forEach((second, secondIndex) => {
						if (first.lightness - second.lightness > 0.08) {
							expect(after[firstIndex]!.lightness, `${palette.title} ${firstIndex}/${secondIndex}`).toBeGreaterThan(after[secondIndex]!.lightness);
						}
					})
				);
			});
		});

		it('lands every palette colour near the tone band', () => {
			const [low, high] = band;
			palettes.forEach((palette) => {
				// Not exact: colours are kept apart (minimum step) and saturated ones are lowered a little.
				beforeAndAfter(palette, tone).after.forEach(({ lightness }) => {
					expect(lightness, palette.title).toBeGreaterThan(low - 0.1);
					expect(lightness, palette.title).toBeLessThan(high + 0.1);
				});
			});
		});

		it('keeps black at or below the palette and white at or above it', () => {
			palettes.forEach((palette) => {
				const { map, after } = beforeAndAfter(palette, tone);
				const black = hexToOklch(map('#000000')).lightness;
				const white = hexToOklch(map('#ffffff')).lightness;
				expect(black, palette.title).toBeLessThanOrEqual(Math.min(...after.map(({ lightness }) => lightness)));
				expect(white, palette.title).toBeGreaterThanOrEqual(Math.max(...after.map(({ lightness }) => lightness)));
			});
		});

		it('gives the same result whatever the hex case', () => {
			const map = buildToneMap(palettes[1]!, tone);
			expect(map('#C8C8A9')).toBe(map('#c8c8a9'));
		});
	});

	it('makes pastel no darker than the original and still clearly coloured, not washed out', () => {
		palettes.forEach((palette) => {
			const { before, after } = beforeAndAfter(palette, 'pastel');
			expect(average(after.map(({ lightness }) => lightness)), palette.title).toBeGreaterThan(average(before.map(({ lightness }) => lightness)) - 0.01);
			// Chromatic colours keep a real share of the gamut available at their new lightness.
			after.forEach((colour, index) => {
				if (before[index]!.chroma > 0.05) expect(saturationOf(colour), `${palette.title} ${index}`).toBeGreaterThan(0.3);
			});
		});
	});

	it('makes dark tones no lighter than the original, never lifting a dark palette much', () => {
		palettes.forEach((palette) => {
			(['dark', 'subtleDark'] as const).forEach((tone) => {
				const { before, after } = beforeAndAfter(palette, tone);
				expect(Math.max(...after.map(({ lightness }) => lightness)), `${palette.title} ${tone}`).toBeLessThan(Math.max(...before.map(({ lightness }) => lightness)) + 0.1);
				expect(average(after.map(({ lightness }) => lightness)), `${palette.title} ${tone}`).toBeLessThan(average(before.map(({ lightness }) => lightness)) + 0.05);
			});
		});
	});

	it('compresses contrast in pastel and subtleDark, relative to dark', () => {
		const spread = (tone: PaletteTone, palette: Palette) => {
			const { after } = beforeAndAfter(palette, tone);
			return Math.max(...after.map(({ lightness }) => lightness)) - Math.min(...after.map(({ lightness }) => lightness));
		};
		palettes.forEach((palette) => {
			expect(spread('subtleDark', palette), palette.title).toBeLessThan(spread('dark', palette) + 0.03);
			expect(spread('pastel', palette), palette.title).toBeLessThan(spread('dark', palette) + 0.03);
		});
	});

	it('copes with one-colour and empty palettes', () => {
		const single: Palette = { title: 'one', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		const empty: Palette = { title: 'none', url: null, creator: null, colors: [] };
		shiftedTones.forEach((tone) => {
			expect(buildToneMap(single, tone)('#336699')).toMatch(/^#[0-9a-f]{6}$/);
			expect(buildToneMap(empty, tone)('#336699')).toBe('#336699');
		});
	});
});

describe('applyTone', () => {
	it('recolours hex values only, leaving ids and layout alone', () => {
		const markup = '<g fill="#69d2e7" clip-path="url(#pb-abc-clip)"><!--layer:0.5--></g>';
		const toned = applyTone(markup, palettes[0]!, 'dark');
		expect(toned).toContain('url(#pb-abc-clip)');
		expect(toned).toContain('<!--layer:0.5-->');
		expect(toned).not.toContain('#69d2e7');
	});

	it('gives the same layout in every tone for the same seed', () => {
		const layoutOf = (art: string) => art.replace(/#[0-9a-f]{6}\b/gi, '#');
		PALETTE_VARIANTS.forEach((variant) => {
			const original = generatePaletteArt({ palette: palettes[2]!, variant, seed: 5 });
			shiftedTones.forEach((tone) => {
				const toned = generatePaletteArt({ palette: palettes[2]!, variant, seed: 5, tone });
				expect(layoutOf(toned), `${variant} ${tone}`).toBe(layoutOf(original));
				expect(toned, `${variant} ${tone}`).not.toBe(original);
			});
		});
	});
});
