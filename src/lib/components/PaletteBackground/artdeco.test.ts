import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { generatePaletteArt } from './generators.js';
import { FAN_RADII, FAN_STYLES, fanColours } from './artdeco.js';
import { luminance, normalisePalette, type Palette } from './paletteUtils.js';

const palettes = paletteData as Palette[];
const seeds = Array.from({ length: 24 }, (_, index) => index + 1);
const coloursOf = (hexes: string[]) => hexes.map((hex) => ({ hex, prominence: 1 }));

describe('fanColours', () => {
	it('uses the two darkest colours for the background and the third darkest for the ink', () => {
		const { groundTop, groundBottom, ink } = fanColours(coloursOf(['#e0e0e0', '#101010', '#808080', '#303030']));
		expect([groundTop, groundBottom, ink]).toEqual(['#101010', '#303030', '#808080']);
	});

	it('keeps the ink lighter than the background for every palette', () => {
		palettes.forEach((palette) => {
			const { groundTop, groundBottom, ink } = fanColours(normalisePalette(palette));
			expect(luminance(ink)).toBeGreaterThanOrEqual(Math.max(luminance(groundTop), luminance(groundBottom)));
		});
	});

	it('darkens a one or two colour palette to make a gradient, and keeps the lightest as the ink', () => {
		const one = fanColours(coloursOf(['#336699']));
		expect(one.ink).toBe('#336699');
		expect(one.groundTop).not.toBe(one.groundBottom);
		const two = fanColours(coloursOf(['#336699', '#ddeeff']));
		expect(two.ink).toBe('#ddeeff');
		expect(luminance(two.groundTop)).toBeLessThan(luminance(two.groundBottom));
	});
});

describe('fans art', () => {
	const artFor = (seed: number) => generatePaletteArt({ palette: palettes[0]!, variant: 'artdeco', seed });

	/** Only the clamshell is made of circles; the arches are paths. */
	const styleOf = (art: string) => (art.includes('<circle') ? 'clamshell' : art.includes('stroke-linecap') ? 'sunburst' : 'peacock');
	/** The fan's radius: a clamshell's first circle, or an arch's first arc (its top). */
	const radiusOf = (art: string) => Number(art.match(/<circle [^>]*r="([\d.]+)"/)?.[1] ?? art.match(/A([\d.]+) /)![1]);

	it('uses every style and size, depending on the seed', () => {
		expect(new Set(seeds.map((seed) => styleOf(artFor(seed))))).toEqual(new Set(FAN_STYLES));
		expect(new Set(seeds.map((seed) => radiusOf(artFor(seed))))).toEqual(new Set(FAN_RADII));
	});

	it('draws the peacock 1 wide to 1.5 high (a half circle on a square) and the sunburst 1 to 1', () => {
		(['peacock', 'sunburst'] as const).forEach((style) => {
			const art = seeds.map(artFor).find((candidate) => styleOf(candidate) === style)!;
			// The outer arch is `M left,bottom L left,top-of-wall A r r 0 0 1 right,top-of-wall L right,bottom Z`.
			const [leftX, bottomY, , wallTopY, radius, , , , , rightX] = art.match(/<path d="(M[^"]+Z)"/)![1]!.match(/-?[\d.]+/g)!.map(Number) as number[];
			const width = rightX! - leftX!;
			const height = bottomY! - wallTopY! + radius!;
			expect(width).toBeCloseTo(radius! * 2, 0);
			expect(height / width).toBeCloseTo(style === 'peacock' ? 1.5 : 1, 1);
		});
	});

	it('keeps every sunburst ray inside its arch, on both sides', () => {
		const sunburst = seeds.map(artFor).find((candidate) => styleOf(candidate) === 'sunburst')!;
		// The first arch drawn: `M left,bottom L left,wallTop A r r 0 0 1 right,wallTop L right,bottom Z`, then its rays.
		const [leftX, bottomY, , , radius, , , , , rightX] = sunburst.match(/<path d="(M[^"]+Z)"/)![1]!.match(/-?[\d.]+/g)!.map(Number) as number[];
		// The sunburst is 1 : 1, so its top is two radii above the bottom.
		const topY = bottomY! - radius! * 2;
		const rays = sunburst.match(/<path d="([^"]+)"[^>]*stroke-linecap="round"/)![1]!;
		// Where each ray starts and ends (the control points are in between, so inside the arch too).
		const firstArch = rays.split('M').slice(1, 40);
		firstArch.forEach((ray) => {
			const numbers = ray.match(/-?[\d.]+/g)!.map(Number);
			for (let index = 0; index < numbers.length; index += 2) {
				expect(numbers[index]!).toBeGreaterThanOrEqual(leftX! - 0.5);
				expect(numbers[index]!).toBeLessThanOrEqual(rightX! + 0.5);
				expect(numbers[index + 1]!).toBeGreaterThanOrEqual(topY - 0.5);
				expect(numbers[index + 1]!).toBeLessThanOrEqual(bottomY! + 0.5);
			}
		});
	});

	it('draws the sunburst as 39 bezier curves from one point, the bottom centre, and nothing else inside the arch', () => {
		const sunburst = seeds.map(artFor).find((candidate) => styleOf(candidate) === 'sunburst')!;
		const rays = sunburst.match(/<path d="([^"]+)"[^>]*stroke-linecap="round"/)![1]!;
		const starts = [...rays.matchAll(/M(-?[\d.]+ -?[\d.]+)C/g)].map(([, start]) => start);
		expect(starts).toHaveLength(39);
		expect(new Set(starts).size).toBe(1);
		// No straight lines or arcs among the rays.
		expect(rays).not.toMatch(/[LA]/);
		// Per fan: the outer arch, then the rays.
		expect(sunburst.match(/<path /g)!.length % 2).toBe(0);
		expect(sunburst).not.toMatch(/<path d="M[^"]+Z" fill="none"/);
	});

	it('makes every peacock band the same width all the way round', () => {
		const art = seeds.map(artFor).find((candidate) => styleOf(candidate) === 'peacock')!;
		// Each arch is `M left,bottom L left,wallTop A r r 0 0 1 right,wallTop L right,bottom Z`: the same wall top for all of them.
		const arches = [...art.matchAll(/<path d="(M[^"]+Z)"/g)].slice(0, 5).map(([, d]) => d!.match(/-?[\d.]+/g)!.map(Number));
		const [outer, ...inner] = arches as number[][];
		inner.forEach((arch) => {
			expect(arch[3]).toBeCloseTo(outer![3]!, 1);
			// The half circle shrinks by the same amount as the wall moves in, so the gap is even.
			const sideGap = arch[0]! - outer![0]!;
			const topGap = outer![4]! - arch[4]!;
			expect(topGap).toBeCloseTo(sideGap, 0);
		});
	});

	it('colours the clamshell feathers in a gradient from left to right', () => {
		const { groundTop, groundBottom } = fanColours(normalisePalette(palettes[0]!));
		const art = seeds.map(artFor).find((candidate) => styleOf(candidate) === 'clamshell')!;
		// Per fan: the backing circle, then 8 feathers, each a closed path.
		const feathers = [...art.matchAll(/<path d="M[^"]+Z" fill="(#[0-9a-f]{6})"/g)].map(([, hex]) => luminance(hex!));
		const towardsBottom = Math.sign(luminance(groundBottom) - luminance(groundTop));
		// Pick a fan in the middle of the canvas, where the clamping at the ends of the gradient doesn't flatten it.
		const fan = feathers.slice(8 * 20, 8 * 21).map((value) => value * towardsBottom);
		expect(fan[7]!).toBeGreaterThan(fan[0]!);
		fan.slice(1).forEach((value, index) => expect(value).toBeGreaterThanOrEqual(fan[index]! - 1e-9));
	});

	it('builds the clamshell from feathers only: closed shapes with a rounded tip, and no other lines', () => {
		const art = seeds.map(artFor).find((candidate) => styleOf(candidate) === 'clamshell')!;
		const paths = [...art.matchAll(/<path d="([^"]+)"/g)].map(([, d]) => d!);
		const feathers = paths.filter((d) => d.endsWith('Z') && d.includes('A'));
		expect(feathers.length).toBeGreaterThan(0);
		// Every path is a feather: no arcs across them.
		expect(feathers).toHaveLength(paths.length);
		expect(art).not.toContain('clip');
		// Narrow at the base, wider at the tip. A feather is `M base L tip A r r 0 0 1 nextTip L nextBase Z`.
		feathers.forEach((d) => {
			const [baseX, baseY, tipX, tipY, , , , , , nextTipX, nextTipY, nextBaseX, nextBaseY] = d.match(/-?[\d.]+/g)!.map(Number) as number[];
			const baseWidth = Math.hypot(baseX! - nextBaseX!, baseY! - nextBaseY!);
			const tipWidth = Math.hypot(tipX! - nextTipX!, tipY! - nextTipY!);
			expect(tipWidth).toBeGreaterThan(baseWidth * 2);
		});
	});

	it('draws only the ink colour as lines', () => {
		const { ink } = fanColours(normalisePalette(palettes[0]!));
		const strokes = [...artFor(1).matchAll(/stroke="(#[0-9a-f]{6})"/g)].map(([, hex]) => hex);
		expect(new Set(strokes)).toEqual(new Set([ink]));
	});

	it('fills each fan with a solid colour between the darkest at the top and the second darkest at the bottom, over a gradient of the same', () => {
		const { groundTop, groundBottom, ink } = fanColours(normalisePalette(palettes[0]!));
		const low = Math.min(luminance(groundTop), luminance(groundBottom));
		const high = Math.max(luminance(groundTop), luminance(groundBottom));
		seeds.slice(0, 6).forEach((seed) => {
			const art = artFor(seed);
			expect(art).toContain(`stop-color="${groundTop}"`);
			expect(art).toContain(`stop-color="${groundBottom}"`);
			// The fans' own fills are plain colours; only the backdrop uses the gradient.
			expect(art.match(/fill="url\(/g)).toHaveLength(1);
			const fills = [...art.matchAll(/fill="(#[0-9a-f]{6})"/g)].map(([, hex]) => hex!).filter((hex) => hex !== ink);
			// The lowest fans reach the bottom colour.
			expect(fills).toContain(groundBottom);
			fills.forEach((hex) => {
				expect(luminance(hex)).toBeGreaterThanOrEqual(low - 0.002);
				expect(luminance(hex)).toBeLessThanOrEqual(high + 0.002);
			});
		});
	});

	it('draws the style an option fixes, whatever the seed, and keeps the layout otherwise', () => {
		const withStyle = (seed: number, style?: string) => generatePaletteArt({ palette: palettes[0]!, variant: 'artdeco', seed, options: style ? { style } : undefined });
		FAN_STYLES.forEach((style) => {
			seeds.forEach((seed) => expect(styleOf(withStyle(seed, style))).toBe(style));
		});
		// An unknown value leaves it to the seed.
		expect(withStyle(3, 'nope')).toBe(withStyle(3));
		// Fixing the style keeps the size the seed picked.
		seeds.forEach((seed) => expect(radiusOf(withStyle(seed, 'clamshell'))).toBe(radiusOf(withStyle(seed))));
	});

	it('is the same for the same seed', () => {
		expect(artFor(5)).toBe(artFor(5));
	});
});
