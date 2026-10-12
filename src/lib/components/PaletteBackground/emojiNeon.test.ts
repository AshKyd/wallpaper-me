import { beforeAll, describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { emojiChoice } from './emojiStorm.js';
import { splitLayers } from './depthLayers.js';
import { OUTLINE_BOX, cachedOutline, fileNameOf, loadEmojiOutline, outlineOf } from './emojiOutline.js';
import { generatePaletteArt } from './generators.js';
import { LAYERS } from './neon.js';
import { luminance, type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const art = (options?: Record<string, string>, seed = 3) => generatePaletteArt({ palette: palettes[0]!, variant: 'emoji-neon', seed, options });

describe('emoji outlines', () => {
	it('names files by lowercase code points, dropping the variation selector except in joined sequences', () => {
		expect(fileNameOf('🌵')).toBe('1f335');
		expect(fileNameOf('☎️')).toBe('260e');
		expect(fileNameOf('⭐')).toBe('2b50');
		expect(fileNameOf('🇦🇺')).toBe('1f1e6-1f1fa');
		expect(fileNameOf('👩🏽‍🚀')).toBe('1f469-1f3fd-200d-1f680');
		expect(fileNameOf('❤️‍🔥')).toBe('2764-fe0f-200d-1f525');
	});

	it('drops fills and clipping, and cuts shapes out of the ones painted under them', () => {
		const square = '<path fill="#fff" d="M0 0h10v10H0z" clip-path="url(#a)"/>';
		const hidden = '<circle cx="2" cy="2" r="1"/>';
		const shown = '<circle cx="20" cy="20" r="1"/>';
		const svg = (...shapes: string[]) => `<svg viewBox="0 0 36 36"><defs><clipPath id="a"><path d="M0 0"/></clipPath></defs><g fill="#000">${shapes.join('')}</g></svg>`;
		const subpaths = (outline?: string) => outline?.match(/M/g)?.length;
		// A shape fully under another leaves no edges of its own.
		expect(subpaths(outlineOf(svg(hidden, square)))).toBe(1);
		// On top, it keeps them, and leaves a hole in the square (the hole's edge and the circle's own).
		expect(subpaths(outlineOf(svg(square, hidden)))).toBe(3);
		// Apart from the square, it keeps them.
		expect(subpaths(outlineOf(svg(hidden, shown, square)))).toBe(2);
		expect(outlineOf(svg(square, hidden))).toMatch(/^<path d="[^"]+"\/>$/);
		expect(outlineOf('not an svg')).toBeUndefined();
	});

	it('loads an emoji from the installed Twemoji files, and says so when there is none', async () => {
		expect(await loadEmojiOutline('🌵')).toBe(true);
		expect(cachedOutline('🌵')).toMatch(/<path d="/);
		expect(cachedOutline('🌵')).not.toMatch(/fill=/);
		expect(await loadEmojiOutline('👾')).toBe(true);
		expect(await loadEmojiOutline('x')).toBe(false);
		expect(cachedOutline('x')).toBeUndefined();
	});
});

describe('Emoji Neon art', () => {
	beforeAll(async () => {
		await Promise.all(['🌵', '🦖', '⭐'].map(loadEmojiOutline));
	});

	it('picks the asked-for emoji, or the seed’s, and ignores anything else', () => {
		expect(emojiChoice({ seed: 3, options: { emoji: '🦖' } })).toBe('🦖');
		expect(emojiChoice({ seed: 3, options: { emoji: '<b>' } })).toBe(emojiChoice({ seed: 3 }));
		expect(new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => emojiChoice({ seed }))).size).toBeGreaterThan(1);
	});

	it('strokes the outline with no fill, drawn in neon’s layers: a glow for each, then the sharp line', () => {
		const markup = art({ emoji: '🌵' });
		const groups = [...markup.matchAll(/<g([^>]*)>(.*?)<\/g>/gs)].filter(([, , inner]) => inner!.includes('<use'));
		// The coloured glows, a tight one in the palette's lightest colour, then the sharp line.
		expect(groups).toHaveLength(LAYERS.length + 2);
		const lightest = palettes[0]!.colors.map(({ hex }) => hex).reduce((a, b) => (luminance(b) > luminance(a) ? b : a));
		expect(groups.at(-2)![2].toLowerCase()).toContain(`stroke="${lightest.toLowerCase()}"`);
		expect(groups.slice(0, -1).every(([, attributes]) => /filter="url\(#/.test(attributes!))).toBe(true);
		expect(groups.at(-1)![1]).not.toMatch(/filter/);
		expect(markup).toMatch(/<use [^>]*fill="none" stroke="#[0-9a-f]{6}"/);
		expect(groups.at(-1)![2]).toContain('stroke="#ffffff"');
		// The glows are one colour from the palette, the same whatever the seed.
		expect(art({ emoji: '🌵' }, 4).match(/stroke="#(?!ffffff)[0-9a-f]{6}"/g)).toEqual(art({ emoji: '🌵' }, 3).match(/stroke="#(?!ffffff)[0-9a-f]{6}"/g));
		expect(markup.match(/<use /g)).toHaveLength(LAYERS.length + 2);
	});

	it('centres one emoji at 50% of the shorter side', () => {
		const markup = generatePaletteArt({ palette: palettes[0]!, variant: 'emoji-neon', seed: 3, width: 1200, height: 800, options: { emoji: '🌵' } });
		const [, x, y, scale] = markup.match(/<use [^>]*transform="translate\(([\d.]+) ([\d.]+)\) scale\(([\d.]+)\)/)!.map(Number);
		expect([x, y]).toEqual([600, 400]);
		expect(scale! * OUTLINE_BOX).toBeCloseTo(400, 0);
	});

	it('draws bokeh lights behind the emoji', () => {
		const markup = art({ emoji: '🌵' });
		expect(markup).toMatch(/-bokeh-fill-0/);
		expect(markup.indexOf('<circle')).toBeLessThan(markup.indexOf('<use '));
	});

	it('puts the emoji in the nearest parallax layer', () => {
		const markup = generatePaletteArt({ palette: palettes[0]!, variant: 'emoji-neon', seed: 3, options: { emoji: '🌵' }, depth: { parallaxPoint: 0.5 } });
		const { layers } = splitLayers(markup);
		expect(layers.length).toBeGreaterThan(1);
		expect(layers.at(-1)!.markup).toContain('<use ');
		expect(layers.slice(0, -1).some(({ markup: layer }) => layer.includes('<use '))).toBe(false);
	});

	it('defines the outline once, whatever the number of emoji', () => {
		const markup = art({ emoji: '🌵' });
		expect(markup.match(/id="[^"]*-emoji-neon-outline"/g)).toHaveLength(1);
		expect(markup).toContain(cachedOutline('🌵')!);
	});

	it('is the same picture for the same seed, and changes with the emoji', () => {
		expect(art({ emoji: '🦖' })).toBe(art({ emoji: '🦖' }));
		expect(art({ emoji: '🦖' })).not.toBe(art({ emoji: '⭐' }));
	});

	it('draws placeholder rings for an emoji that is not loaded', () => {
		expect(art({ emoji: '🥲' })).toMatch(/<g id="[^"]*-emoji-neon-outline"><circle /);
	});
});
