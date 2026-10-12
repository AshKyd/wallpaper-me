import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { DEPTH_LAYERS, splitLayers } from './depthLayers.js';
import { blendModeFor, STORM_EMOJI, MAX_BLUR, RANDOM_EMOJI, blurForLayer, isEmoji, tintFilter } from './emojiStorm.js';
import { generatePaletteArt } from './generators.js';
import type { Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const art = (options?: Record<string, string>, seed = 3) => generatePaletteArt({ palette: palettes[0]!, variant: 'emoji-storm', seed, options });
const emojiIn = (markup: string) => [...markup.matchAll(/<text [^>]*>([^<]+)<\/text>/g)].map(([, glyph]) => glyph);
const sizeOf = (text: string) => Number(text.match(/font-size="([\d.]+)"/)![1]);

describe('Emoji Storm art', () => {
	it('is all emoji: no polygons, paths or other shapes', () => {
		const markup = art();
		expect(emojiIn(markup).length).toBeGreaterThan(300);
		expect(markup).not.toMatch(/<(polygon|path|circle) /);
	});

	it('uses one emoji for the whole picture: the one asked for, or the seed’s pick', () => {
		STORM_EMOJI.forEach((emoji) => expect(new Set(emojiIn(art({ emoji })))).toEqual(new Set([emoji])));
		expect(new Set(emojiIn(art())).size).toBe(1);
		expect(new Set(emojiIn(art({ emoji: 'not an emoji' })))).toEqual(new Set(emojiIn(art())));
		expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].flatMap((seed) => emojiIn(art(undefined, seed)))).size).toBeGreaterThan(1);
	});

	it('accepts any single emoji through the API, and ignores anything else', () => {
		['🦖', '🇦🇺', '👩🏽‍🚀', '1️⃣', '😀'].forEach((emoji) => expect(new Set(emojiIn(art({ emoji })))).toEqual(new Set([emoji])));
		// Text-default emoji get the emoji selector so they draw in colour.
		expect(new Set(emojiIn(art({ emoji: '☎' })))).toEqual(new Set(['☎️']));
		['', 'a', '🦖🦖', '<b>', '🦖<'].forEach((emoji) => expect(isEmoji(emoji)).toBe(false));
		expect(emojiIn(art({ emoji: '🦖<' }))).toEqual(emojiIn(art()));
	});

	it('keeps the rest of the picture when an emoji is asked for', () => {
		expect(art({ emoji: '🦖' }).replaceAll('🦖', '').replaceAll(/>[^<]*<\/text>/g, '></text>')).toBe(art().replaceAll(/>[^<]*<\/text>/g, '></text>'));
	});

	it('picks at random from smileys, food and drink, animals and nature, and objects, each as one emoji', () => {
		RANDOM_EMOJI.forEach((emoji) => expect(isEmoji(emoji)).toBe(true));
		['😀', '🍕', '🐙', '💾', '☎️', '❤️'].forEach((emoji) => expect(RANDOM_EMOJI).toContain(emoji));
		expect(RANDOM_EMOJI.length).toBeGreaterThan(600);
		expect(new Set(RANDOM_EMOJI).size).toBe(RANDOM_EMOJI.length);
	});

	it('has a gradient background', () => {
		const markup = art();
		const [, id] = markup.match(/<linearGradient id="([^"]+)"/)!;
		expect(markup).toContain(`<rect width="1200" height="800" fill="url(#${id})"/>`);
		const [top, bottom] = [...markup.matchAll(/<stop offset="[01]" stop-color="([^"]+)"/g)].map(([, colour]) => colour);
		expect(top).not.toBe(bottom);
	});

	it('blurs less the nearer the layer, and not at all for the nearest', () => {
		expect(blurForLayer(0)).toBe(MAX_BLUR);
		expect(blurForLayer(DEPTH_LAYERS - 1)).toBe(0);
		const blurs = Array.from({ length: DEPTH_LAYERS }, (_, layer) => blurForLayer(layer));
		blurs.slice(1).forEach((blur, index) => expect(blur).toBeLessThan(blurs[index]!));
		expect(tintFilter({ id: 'a', colour: '#336699', blur: 2 })).toContain('<feGaussianBlur in="masked" stdDeviation="2"/>');
		expect(tintFilter({ id: 'a', colour: '#336699' })).not.toContain('feGaussianBlur');
	});

	it('blurs the small, far emoji more than the big, near ones', () => {
		const markup = art();
		const blurOf = new Map([...markup.matchAll(/<filter id="([^"]+)"[^>]*>.*?<\/filter>/g)].map(([filter, id]) => [id!, Number(filter.match(/stdDeviation="([\d.]+)"/)?.[1] ?? 0)]));
		const emoji = [...markup.matchAll(/<text [^>]*filter="url\(#([^)]+)\)"[^>]*>/g)].map(([text, id]) => ({ size: sizeOf(text), blur: blurOf.get(id!)! }));
		const average = (items: typeof emoji, key: 'size' | 'blur') => items.reduce((sum, item) => sum + item[key], 0) / items.length;
		const middle = [...emoji].sort((a, b) => a.size - b.size)[Math.floor(emoji.length / 2)]!.size;
		const [small, big] = [emoji.filter(({ size }) => size <= middle), emoji.filter(({ size }) => size > middle)];
		expect(average(small, 'blur')).toBeGreaterThan(average(big, 'blur'));
		expect(Math.min(...emoji.map(({ blur }) => blur))).toBe(0);
	});

	it('blends light colours by multiplying and darker ones by soft light', () => {
		['#ffffff', '#f0c040', '#80c0ff'].forEach((colour) => expect(blendModeFor(colour)).toBe('multiply'));
		['#000000', '#336699', '#5a2d0c'].forEach((colour) => expect(blendModeFor(colour)).toBe('soft-light'));
		expect(tintFilter({ id: 'x', colour: '#f0c040' })).toContain('mode="multiply"');
		expect(tintFilter({ id: 'x', colour: '#336699' })).toContain('mode="soft-light"');
	});

	it('greys, blends and masks each emoji through a filter that exists', () => {
		const markup = art();
		const filterIds = [...markup.matchAll(/<filter id="([^"]+)"/g)].map(([, id]) => id!);
		expect(filterIds.length).toBeGreaterThan(0);
		[...markup.matchAll(/filter="url\(#([^)]+)\)"/g)].forEach(([, id]) => expect(filterIds).toContain(id));
		const filter = tintFilter({ id: 'x', colour: '#336699' });
		expect(filter).toContain('type="saturate" values="0"');
		expect(filter).toContain('flood-color="#336699"');
		expect(filter).toContain('<feBlend in="grey" in2="tint"');
		// Nothing else adjusts the blend before the mask.
		expect(filter).not.toContain('feComponentTransfer');
		expect(filter.match(/type="saturate"/g)).toHaveLength(1);
		expect(filter).toContain('operator="in"');
	});

	it('tints with palette colours only, and draws without NaN', () => {
		palettes.forEach((palette) => {
			const allowed = new Set([...palette.colors.map(({ hex }) => hex.toLowerCase()), '#ffffff']);
			const markup = generatePaletteArt({ palette, variant: 'emoji-storm', seed: 3 });
			[...markup.matchAll(/flood-color="([^"]+)"/g)].forEach(([, colour]) => expect(allowed.has(colour!.toLowerCase())).toBe(true));
			expect(markup).not.toMatch(/NaN|undefined|Infinity/);
		});
	});

	it('keeps the filters and gradient in the part that stays put with parallax, and splits the emoji into layers', () => {
		const { base, layers } = splitLayers(generatePaletteArt({ palette: palettes[0]!, variant: 'emoji-storm', seed: 3, depth: { parallaxPoint: 0.5 } }));
		expect(base).toContain('<filter');
		expect(base).toContain('<linearGradient');
		expect(layers.length).toBeGreaterThan(1);
		layers.forEach(({ markup }) => expect(markup).not.toContain('<filter'));
	});
});
