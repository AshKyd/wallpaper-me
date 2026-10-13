import { beforeAll, describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { DEPTH_LAYERS, splitLayers } from './depthLayers.js';
import { colouriseArtwork, fullHex } from './emojiColour.js';
import { cachedArtwork, loadEmojiOutline } from './emojiOutline.js';
import { MAX_BLUR, RANDOM_EMOJI, STORM_EMOJI, blurForLayer, emojiChoice, isEmoji, usesEmojiArtwork } from './emojiStorm.js';
import { generatePaletteArt } from './generators.js';
import { type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const art = (options?: Record<string, string>, seed = 3) => generatePaletteArt({ palette: palettes[0]!, variant: 'emoji-storm', seed, options });
const uses = (markup: string) => [...markup.matchAll(/<use [^>]*>/g)].map(([use]) => use);
const scaleOf = (use: string) => Number(use.match(/scale\(([\d.]+)\)/)![1]);

describe('Emoji Storm art', () => {
	beforeAll(async () => {
		await Promise.all(['🌵', '🦖', '⭐', ...STORM_EMOJI].map(loadEmojiOutline));
	});

	it('is all emoji: a use of the drawing for each circle, with no text, polygons or loose shapes', () => {
		const markup = art({ emoji: '🌵' });
		expect(uses(markup).length).toBeGreaterThan(200);
		expect(markup).not.toMatch(/<(text|polygon) /);
		// Shapes are only inside the drawings in `<defs>`.
		expect(markup.replace(/<defs>.*<\/defs>/s, '')).not.toMatch(/<(path|circle|ellipse) /);
	});

	it('draws each emoji as a use of a colourised drawing that exists', () => {
		const markup = art({ emoji: '🌵' });
		const ids = [...markup.matchAll(/<g id="([^"]+)">/g)].map(([, id]) => id!);
		expect(ids.length).toBeGreaterThan(0);
		uses(markup).forEach((use) => expect(ids).toContain(use.match(/href="#([^"]+)"/)![1]));
	});

	it('uses one emoji for the whole picture: the one asked for, or the seed’s pick', () => {
		STORM_EMOJI.forEach((emoji) => {
			const markup = art({ emoji });
			const withoutFills = (svg: string) => svg.replaceAll(/\sfill="[^"]*"/g, '');
			// Whatever the colour, a drawing is the emoji's own shapes: without their fills, they are Twemoji's artwork.
			const drawings = [...markup.matchAll(/<g id="[^"]+-emoji-\d+">(.*?)<\/g><(?:g id|\/defs)/gs)].map(([, drawing]) => withoutFills(drawing!));
			expect(drawings.length).toBeGreaterThan(0);
			drawings.forEach((drawing) => expect(drawing).toBe(withoutFills(cachedArtwork(emoji)!)));
		});
		expect(art({ emoji: '🌵' })).not.toBe(art({ emoji: '🦖' }));
		expect(art({ emoji: 'not an emoji' })).toBe(art());
		expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => emojiChoice({ seed }))).size).toBeGreaterThan(1);
	});

	it('accepts any single emoji through the API, and ignores anything else', () => {
		['🦖', '🇦🇺', '👩🏽‍🚀', '1️⃣', '😀'].forEach((emoji) => expect(emojiChoice({ options: { emoji } })).toBe(emoji));
		// Text-default emoji get the emoji selector, as Twemoji does not care and it keeps them equal to the picture form.
		expect(emojiChoice({ options: { emoji: '☎' } })).toBe('☎️');
		['', 'a', '🦖🦖', '<b>', '🦖<'].forEach((emoji) => expect(isEmoji(emoji)).toBe(false));
		expect(emojiChoice({ seed: 3, options: { emoji: '🦖<' } })).toBe(emojiChoice({ seed: 3 }));
	});

	it('keeps the rest of the picture when an emoji is asked for', () => {
		const layout = (markup: string) => uses(markup).join('');
		expect(layout(art({ emoji: '🦖' }))).toBe(layout(art({ emoji: '⭐' })));
		expect(layout(art({ emoji: '🦖' }))).toBe(layout(art()));
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
	});

	it('blurs the small, far emoji more than the big, near ones, through filters that exist', () => {
		const markup = art({ emoji: '🌵' });
		const blurOf = new Map([...markup.matchAll(/<filter id="([^"]+)"[^>]*>.*?<\/filter>/g)].map(([filter, id]) => [id!, Number(filter.match(/stdDeviation="([\d.]+)"/)?.[1] ?? 0)]));
		expect(blurOf.size).toBe(DEPTH_LAYERS - 1);
		const emoji = uses(markup).map((use) => ({ size: scaleOf(use), blur: blurOf.get(use.match(/filter="url\(#([^)]+)\)"/)?.[1] ?? '') ?? 0 }));
		const average = (items: typeof emoji, key: 'size' | 'blur') => items.reduce((sum, item) => sum + item[key], 0) / items.length;
		const middle = [...emoji].sort((a, b) => a.size - b.size)[Math.floor(emoji.length / 2)]!.size;
		const [small, big] = [emoji.filter(({ size }) => size <= middle), emoji.filter(({ size }) => size > middle)];
		expect(average(small, 'blur')).toBeGreaterThan(average(big, 'blur'));
		expect(Math.min(...emoji.map(({ blur }) => blur))).toBe(0);
	});

	it('draws every palette with plain hex fills (the gradient aside) and without NaN', () => {
		palettes.forEach((palette) => {
			const markup = generatePaletteArt({ palette, variant: 'emoji-storm', seed: 3, options: { emoji: '🌵' } });
			expect(markup).not.toMatch(/NaN|undefined|Infinity/);
			const fills = [...markup.matchAll(/ fill="([^"]+)"/g)].map(([, fill]) => fill!).filter((fill) => !fill.startsWith('url('));
			expect(fills.length).toBeGreaterThan(0);
			fills.forEach((fill) => expect(fill).toMatch(/^#[0-9a-f]{6}$/));
		});
	});

	it('keeps the filters, gradient and drawings in the part that stays put with parallax, and splits the emoji into layers', () => {
		const { base, layers } = splitLayers(generatePaletteArt({ palette: palettes[0]!, variant: 'emoji-storm', seed: 3, depth: { parallaxPoint: 0.5 }, options: { emoji: '🌵' } }));
		expect(base).toContain('<filter');
		expect(base).toContain('<linearGradient');
		expect(base).toMatch(/<g id="[^"]+-emoji-0">/);
		expect(layers.length).toBeGreaterThan(1);
		layers.forEach(({ markup }) => expect(markup).not.toMatch(/<(filter|g id)/));
	});

	it('draws grey placeholders for an emoji that is not loaded', () => {
		expect(art({ emoji: '🥲' })).toMatch(/<g id="[^"]+-emoji-0"><circle [^>]*fill="#[0-9a-f]{6}"/);
	});
});

describe('Emoji colour', () => {
	it('reads three-digit hexes and the colour names Twemoji uses, and leaves anything else', () => {
		expect(fullHex('#269')).toBe('#226699');
		expect(fullHex('#FFF')).toBe('#ffffff');
		expect(fullHex('#AbCdEf')).toBe('#abcdef');
		expect(fullHex('red')).toBe('#ff0000');
		expect(fullHex('none')).toBeUndefined();
		expect(fullHex('url(#a)')).toBeUndefined();
	});

	it('keeps white and black, and swaps every other fill for a palette colour', () => {
		const svg = '<path fill="#FFF" d="M1 1"/><path fill="#000" d="M2 2"/><g fill="red" opacity=".5"><circle fill="none" r="1"/></g>';
		expect(colouriseArtwork({ artwork: svg, palette: ['#f0c040'] })).toBe(
			'<path fill="#FFF" d="M1 1"/><path fill="#000" d="M2 2"/><g fill="#f0c040" opacity=".5"><circle fill="none" r="1"/></g>'
		);
	});

	it('also keeps near-white and near-black greys, as in the poop emoji\'s eyes, but not mid greys or colours', () => {
		const svg = '<path fill="#F5F8FA"/><path fill="#292F33"/><path fill="#99AAB5"/><path fill="#F2ABBA"/>';
		expect(colouriseArtwork({ artwork: svg, palette: ['#336699'] })).toBe('<path fill="#F5F8FA"/><path fill="#292F33"/><path fill="#336699"/><path fill="#336699"/>');
	});

	it('gives each distinct fill its own colour (darkest fill gets the darkest colour), and shifts the deal along the palette', () => {
		// Mid-lightness, strongly coloured fills, so none counts as white or black.
		const svg = '<path fill="#802020"/><path fill="#e0a0a0"/><path fill="#802020"/>';
		const palette = ['#eeeeee', '#111111'];
		expect(colouriseArtwork({ artwork: svg, palette })).toBe('<path fill="#111111"/><path fill="#eeeeee"/><path fill="#111111"/>');
		expect(colouriseArtwork({ artwork: svg, palette, shift: 1 })).toBe('<path fill="#eeeeee"/><path fill="#111111"/><path fill="#eeeeee"/>');
	});

	it('leaves the artwork alone for an empty palette', () => {
		expect(colouriseArtwork({ artwork: '<path fill="red"/>', palette: [] })).toBe('<path fill="red"/>');
	});
});

describe('usesEmojiArtwork', () => {
	it('is for the two emoji variants only', () => {
		expect(['emoji-storm', 'emoji-neon'].every(usesEmojiArtwork)).toBe(true);
		expect(['neon', 'circles', ''].some(usesEmojiArtwork)).toBe(false);
	});
});
