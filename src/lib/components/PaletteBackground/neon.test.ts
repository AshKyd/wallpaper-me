import { describe, expect, it } from 'vitest';
import paletteData from '../../../../palettes.json';
import { splitBokehColours } from './bokeh.js';
import { CANVAS_HEIGHT, CANVAS_WIDTH, canvasSizeFor } from './canvas.js';
import { generatePaletteArt } from './generators.js';
import { hexToOklch } from './oklch.js';
import {
	BAND_GAP,
	BAND_PATTERNS,
	BAND_TWIST,
	INNER_RADIUS_SHARE,
	LAYERS,
	MAIN_WIDTH,
	MAX_HUE_SHIFT,
	RINGS_PER_BAND,
	RING_SPACING,
	RING_TWIST,
	ROTATION_MODES,
	THICKNESS_MODES,
	THICKNESS_RANGE,
	dashesFor,
	glowColour,
	layoutNeon,
	ringPath,
	ringPoints,
	type Point
} from './neon.js';
import { createRandom, normalisePalette, type Palette } from './paletteUtils.js';

/** The groups of rings in neon art, bottom first: the filter each has (if any), and the stroke widths and colours of its rings. */
const neonArtLayers = (art: string) =>
	[...art.matchAll(/<g([^>]*)>(.*?)<\/g>/gs)].map(([, attributes, rings]) => ({
		filter: attributes!.match(/filter="([^"]+)"/)?.[1],
		strokeWidths: [...rings!.matchAll(/stroke-width="([\d.]+)"/g)].map(([, value]) => Number(value)),
		colours: [...rings!.matchAll(/stroke="(#[0-9a-fA-F]{6})"/g)].map(([, value]) => value!)
	}));

const palettes = paletteData as Palette[];
const { width, height } = canvasSizeFor(1600, 900);
const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
const neonFor = (seed: number, size = { width, height }) => layoutNeon({ random: createRandom(seed), ...size });
const sizes = [{ width, height }, { width: 800, height: 800 }, { width: 2400, height: 800 }, { width: 400, height: 800 }];

describe('ringPoints and ringPath', () => {
	const centre: Point = [100, 100];

	it('puts a circle every point the same distance from the middle', () => {
		ringPoints({ style: 'curve', centre, radius: 50, sides: 4, turn: 0.3 }).forEach(([x, y]) => expect(Math.hypot(x - 100, y - 100)).toBeCloseTo(50, 6));
	});

	it('puts a polygon\'s sides, not its corners, `radius` from the middle', () => {
		[3, 4, 5, 6].forEach((sides) => {
			const points = ringPoints({ style: 'sharp', centre, radius: 50, sides, turn: 0.4 });
			expect(points).toHaveLength(sides);
			// The side between two neighbouring corners is 50 from the middle: the distance from the middle to that side's own midpoint.
			const [a, b] = [points[0]!, points[1]!];
			expect(Math.hypot((a[0] + b[0]) / 2 - 100, (a[1] + b[1]) / 2 - 100)).toBeCloseTo(50, 6);
		});
	});

	it('draws sharp rings with straight lines and curved ones with quadratic curves, both closed', () => {
		const points: Point[] = [[0, 0], [10, 0], [10, 10]];
		expect(ringPath(points, 'sharp')).toBe('M 0 0 L 10 0 L 10 10 Z');
		const curved = ringPath(points, 'curve');
		expect(curved.match(/Q /g)).toHaveLength(points.length);
		expect(curved.endsWith(' Z')).toBe(true);
	});
});

describe('dashesFor', () => {
	it('leaves a solid band unbroken, and breaks the others into a dash and a gap', () => {
		expect(dashesFor('solid', createRandom(1))).toBeUndefined();
		(['dashed', 'dotted', 'arcs'] as const).forEach((pattern) => {
			const [dash, gap] = dashesFor(pattern, createRandom(1))!;
			expect(dash).toBeGreaterThan(0);
			expect(gap).toBeGreaterThan(0);
		});
	});

	it('makes dots from a dash of nearly nothing, and arcs much longer than their gaps', () => {
		expect(dashesFor('dotted', createRandom(1))![0]).toBeLessThan(1);
		seeds.forEach((seed) => {
			const [dash, gap] = dashesFor('arcs', createRandom(seed))!;
			expect(dash).toBeGreaterThan(gap);
		});
	});
});

describe('neon rings', () => {
	it('keeps the rings round the middle of the canvas, whatever its size', () => {
		sizes.forEach((size) =>
			seeds.forEach((seed) => {
				const { centre } = neonFor(seed, size);
				expect(centre).toEqual([size.width / 2, size.height / 2]);
			})
		);
	});

	it('starts at a small ring and reaches out past the corners, with nothing leaving the rings', () => {
		sizes.forEach((size) =>
			seeds.forEach((seed) => {
				const { rings } = neonFor(seed, size);
				expect(rings[0]!.radius).toBeCloseTo(Math.min(size.width, size.height) * INNER_RADIUS_SHARE, 6);
				expect(rings.at(-1)!.radius).toBeGreaterThan(Math.hypot(size.width, size.height) / 2);
				// Every ring is closed: there are no lines coming out.
				rings.forEach(({ d }) => expect(d.endsWith('Z')).toBe(true));
			})
		);
	});

	it('works outwards in bands: close, even spacing within a band, a gap between bands', () => {
		seeds.forEach((seed) => {
			const { rings } = neonFor(seed);
			const bands = Object.values(Object.groupBy(rings, ({ band }) => band)) as (typeof rings)[];
			bands.forEach((band) => {
				expect(band.length).toBeGreaterThanOrEqual(RINGS_PER_BAND[0]);
				expect(band.length).toBeLessThanOrEqual(RINGS_PER_BAND[1]);
				const gaps = band.slice(1).map(({ radius }, index) => radius - band[index]!.radius);
				gaps.forEach((gap) => {
					expect(gap).toBeGreaterThanOrEqual(RING_SPACING[0] - 0.001);
					expect(gap).toBeLessThanOrEqual(RING_SPACING[1] + 0.001);
					expect(gap).toBeCloseTo(gaps[0]!, 6);
				});
			});
			bands.slice(1).forEach((band, index) => {
				const between = band[0]!.radius - bands[index]!.at(-1)!.radius;
				expect(between).toBeGreaterThanOrEqual(BAND_GAP[0] - 0.001);
				expect(between).toBeLessThanOrEqual(BAND_GAP[1] + 0.001);
			});
		});
	});

	it('breaks bands up in different ways, with one pattern for a whole band', () => {
		const rings = seeds.flatMap((seed) => neonFor(seed).rings);
		BAND_PATTERNS.forEach((pattern) => expect(rings.some((ring) => ring.pattern === pattern)).toBe(true));
		rings.filter(({ pattern }) => pattern === 'solid').forEach(({ dashes }) => expect(dashes).toBeUndefined());
		rings.filter(({ pattern }) => pattern !== 'solid').forEach(({ dashes }) => expect(dashes).toMatch(/^[\d.]+ [\d.]+$/));
		seeds.forEach((seed) => {
			const { rings: own } = neonFor(seed);
			const bands = Object.values(Object.groupBy(own, ({ band }) => band)) as (typeof own)[];
			bands.forEach((band) => band.forEach(({ pattern, dashes }) => expect([pattern, dashes]).toEqual([band[0]!.pattern, band[0]!.dashes])));
		});
	});

	it('shifts the pattern along from each ring to the next, so gaps do not line up', () => {
		const patterned = seeds.flatMap((seed) => {
			const { rings } = neonFor(seed);
			const bands = Object.values(Object.groupBy(rings, ({ band }) => band)) as (typeof rings)[];
			return bands.filter((band) => band[0]!.dashes && band.length > 1);
		});
		expect(patterned.length).toBeGreaterThan(0);
		patterned.forEach((band) => {
			expect(band[0]!.dashOffset).toBe(0);
			band.slice(1).forEach(({ dashOffset }, index) => expect(dashOffset).not.toBe(band[index]!.dashOffset));
		});
	});

	describe('staggered rotation', () => {
		const manySeeds = Array.from({ length: 40 }, (_, index) => index + 1);
		const degrees = (radians: number) => (radians * 180) / Math.PI;
		const bandsOf = (seed: number) => {
			const neon = neonFor(seed);
			return { neon, bands: Object.values(Object.groupBy(neon.rings, ({ band }) => band)) as (typeof neon.rings)[] };
		};

		it('uses every way of turning the rings', () => {
			expect(new Set(manySeeds.map((seed) => neonFor(seed).rotation))).toEqual(new Set(ROTATION_MODES));
		});

		it('aligned: every ring faces the same way', () => {
			manySeeds.map(bandsOf).filter(({ neon }) => neon.rotation === 'aligned').forEach(({ neon }) => neon.rings.forEach(({ turn }) => expect(turn).toBeCloseTo(neon.rings[0]!.turn, 9)));
		});

		it('alternate: every other band is turned half a side', () => {
			const picked = manySeeds.map(bandsOf).filter(({ neon }) => neon.rotation === 'alternate');
			expect(picked.length).toBeGreaterThan(0);
			picked.forEach(({ neon, bands }) => {
				const first = bands[0]![0]!.turn;
				bands.forEach((band, index) => expect(band[0]!.turn - first).toBeCloseTo((index % 2) * (Math.PI / neon.sides), 9));
			});
		});

		it('progressive: each band is turned the same amount more than the last, within range', () => {
			const picked = manySeeds.map(bandsOf).filter(({ neon }) => neon.rotation === 'progressive');
			expect(picked.length).toBeGreaterThan(0);
			picked.forEach(({ bands }) => {
				const steps = bands.slice(1).map((band, index) => band[0]!.turn - bands[index]![0]!.turn);
				steps.forEach((step) => {
					expect(step).toBeCloseTo(steps[0]!, 9);
					expect(Math.abs(degrees(step))).toBeGreaterThanOrEqual(BAND_TWIST[0] - 0.001);
					expect(Math.abs(degrees(step))).toBeLessThanOrEqual(BAND_TWIST[1] + 0.001);
				});
			});
		});

		it('twists the rings within a band a little, the same amount each, when not aligned', () => {
			manySeeds.map(bandsOf).forEach(({ neon, bands }) =>
				bands.filter((band) => band.length > 1).forEach((band) => {
					const steps = band.slice(1).map((ring, index) => ring.turn - band[index]!.turn);
					steps.forEach((step) => {
						expect(step).toBeCloseTo(steps[0]!, 9);
						if (neon.rotation === 'aligned') return expect(step).toBeCloseTo(0, 9);
						expect(Math.abs(degrees(step))).toBeGreaterThanOrEqual(RING_TWIST[0] - 0.001);
						expect(Math.abs(degrees(step))).toBeLessThanOrEqual(RING_TWIST[1] + 0.001);
					});
				})
			);
		});
	});

	describe('line thickness', () => {
		const manySeeds = Array.from({ length: 40 }, (_, index) => index + 1);
		const bandsOf = (seed: number) => {
			const neon = neonFor(seed);
			return { neon, bands: Object.values(Object.groupBy(neon.rings, ({ band }) => band)) as (typeof neon.rings)[] };
		};
		const picked = (mode: string) => manySeeds.map(bandsOf).filter(({ neon }) => neon.thicknessMode === mode);

		it('uses every way of varying thickness, always within range', () => {
			expect(new Set(manySeeds.map((seed) => neonFor(seed).thicknessMode))).toEqual(new Set(THICKNESS_MODES));
			manySeeds.flatMap((seed) => neonFor(seed).rings).forEach(({ thickness }) => {
				expect(thickness).toBeGreaterThanOrEqual(THICKNESS_RANGE[0] - 0.05);
				expect(thickness).toBeLessThanOrEqual(THICKNESS_RANGE[1] + 0.05);
			});
		});

		it('even: every ring is the same thickness, 1', () => {
			picked('even').forEach(({ neon }) => neon.rings.forEach(({ thickness }) => expect(thickness).toBe(1)));
		});

		it('banded: one thickness per band, different between bands', () => {
			picked('banded').forEach(({ bands }) => bands.forEach((band) => band.forEach(({ thickness }) => expect(thickness).toBe(band[0]!.thickness))));
			const distinct = picked('banded').map(({ bands }) => new Set(bands.map((band) => band[0]!.thickness)).size);
			expect(Math.max(...distinct)).toBeGreaterThan(2);
		});

		it('tapered: rings in a band go steadily thinner or thicker', () => {
			picked('tapered').forEach(({ bands }) =>
				bands.filter((band) => band.length > 2).forEach((band) => {
					const steps = band.slice(1).map(({ thickness }, index) => thickness - band[index]!.thickness);
					const sign = Math.sign(steps[0]!);
					steps.forEach((step) => expect(Math.sign(step)).toBe(sign));
				})
			);
		});

		it('swelling: thickness runs one way with distance from the middle', () => {
			picked('swelling').forEach(({ neon }) => {
				const thicknesses = neon.rings.map(({ thickness }) => thickness);
				const sign = Math.sign(thicknesses.at(-1)! - thicknesses[0]!);
				expect(sign).not.toBe(0);
				// Allow a tiny dip from rounding; the run as a whole never turns back.
				thicknesses.slice(1).forEach((thickness, index) => expect((thickness - thicknesses[index]!) * sign).toBeGreaterThanOrEqual(-0.011));
			});
		});
	});

	it('has both sharp and curved rings', () => {
		const styles = new Set(seeds.map((seed) => neonFor(seed).style));
		expect(styles).toEqual(new Set(['sharp', 'curve']));
		seeds.map((seed) => neonFor(seed)).filter(({ style }) => style === 'sharp').forEach(({ rings }) => rings.forEach(({ d }) => expect(d).not.toContain('Q')));
	});

	it('keeps the glows turned only a little', () => {
		seeds.forEach((seed) => expect(Math.abs(neonFor(seed).hueShift)).toBeLessThanOrEqual(MAX_HUE_SHIFT));
		expect(MAIN_WIDTH).toBeLessThan(LAYERS[1].width);
	});

	it('repeats for a seed and differs between seeds', () => {
		expect(neonFor(1)).toEqual(neonFor(1));
		expect(neonFor(1)).not.toEqual(neonFor(2));
	});
});

describe('glowColour', () => {
	it('adds chroma and turns the hue a little', () => {
		const original = hexToOklch('#4f7fd6');
		const glow = hexToOklch(glowColour('#4f7fd6', { chromaBoost: 1.5, hueTurn: 10 }));
		expect(glow.chroma).toBeGreaterThan(original.chroma);
		expect(Math.abs(glow.hue - original.hue)).toBeGreaterThan(3);
		expect(Math.abs(glow.hue - original.hue)).toBeLessThan(20);
	});

	it('leaves a grey grey', () => {
		expect(glowColour('#808080', { chromaBoost: 2, hueTurn: 30 })).toBe('#808080');
	});
});

describe('neon art', () => {
	const artFor = (palette: Palette, seed = 3) => generatePaletteArt({ palette, variant: 'neon', seed });

	it('has two blurred glow layers under one sharp main layer', () => {
		const layers = neonArtLayers(artFor(palettes[0]!));
		expect(layers).toHaveLength(LAYERS.length + 1);
		layers.slice(0, -1).forEach((layer, index) => expect(layer.filter).toBe(`url(#palette-neon-${LAYERS[index]!.name})`));
		expect(layers.at(-1)!.filter).toBeUndefined();
		// Each layer draws every ring, at its layer's width times the ring's thickness. The glows are wider than the main line.
		const { rings } = layoutNeon({ random: createRandom(3), width: CANVAS_WIDTH, height: CANVAS_HEIGHT });
		const baseWidths = [...LAYERS.map(({ width: layerWidth }) => layerWidth), MAIN_WIDTH];
		layers.forEach((layer, layerIndex) => {
			expect(layer.strokeWidths).toHaveLength(rings.length);
			// Thickness is rounded to a tenth, so the widest layer can be out by 16 x 0.05.
			layer.strokeWidths.forEach((strokeWidth, index) => expect(Math.abs(strokeWidth - baseWidths[layerIndex]! * rings[index]!.thickness)).toBeLessThan(1));
		});
	});

	it('defines one blur filter per glow layer', () => {
		const art = artFor(palettes[0]!);
		LAYERS.forEach(({ name, blur }) => {
			expect(art).toContain(`<feGaussianBlur stdDeviation="${blur}"/>`);
			expect(art).toContain(`id="palette-neon-${name}"`);
		});
		expect((art.match(/<feGaussianBlur/g) ?? []).length).toBe(LAYERS.length);
	});

	it('draws the main rings in the palette colours, never the background ones, and unblurred', () => {
		palettes.forEach((palette) => {
			const { background, lights } = splitBokehColours(normalisePalette(palette).map(({ hex }) => hex));
			const main = neonArtLayers(artFor(palette)).at(-1)!;
			expect(main.colours.length).toBeGreaterThan(0);
			main.colours.forEach((colour) => {
				expect(lights.map((light) => light.toLowerCase())).toContain(colour.toLowerCase());
				if (palette.colors.length > 2) expect(background.map((dark) => dark.toLowerCase())).not.toContain(colour.toLowerCase());
			});
		});
	});

	it('makes the background from the darkest colours', () => {
		const art = artFor(palettes[0]!);
		const { background } = splitBokehColours(normalisePalette(palettes[0]!).map(({ hex }) => hex));
		expect(art).toContain(`stop-color="${background[0]}"`);
	});

	it('keeps every ring\'s pattern the same in the glows and the main layer, so they line up', () => {
		const art = artFor(palettes[0]!);
		const patterns = [...art.matchAll(/<g[^>]*>(.*?)<\/g>/gs)].map(([, rings]) => [...rings!.matchAll(/stroke-dasharray="([^"]+)" stroke-dashoffset="([^"]+)"/g)].map(([, array, offset]) => `${array}/${offset}`));
		patterns.slice(1).forEach((layer) => expect(layer).toEqual(patterns[0]));
	});

	it('has no NaN, and copes with a one-colour palette', () => {
		palettes.forEach((palette) => expect(artFor(palette)).not.toMatch(/NaN|undefined|Infinity/));
		const mono: Palette = { title: 'Mono', url: null, creator: null, colors: [{ hex: '#336699', prominence: 1 }] };
		expect(artFor(mono)).toContain('<path');
	});
});
