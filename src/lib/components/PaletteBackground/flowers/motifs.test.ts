import { describe, expect, it } from 'vitest';
import { createRandom } from '../paletteUtils.js';
import { BIG_RADIUS, FIRST_FOLLOWER_RADIUS, layoutFlowers } from './flowersArt.js';
import { assignColourRoles, fillAt } from './colourRoles.js';
import { FLOWER_STYLES, flowerPowerMotif } from './daisy.js';
import { sampleCubicPath, type CubicSegment } from './geometry.js';

const roles = assignColourRoles(
	[
		{ hex: '#ecd078', prominence: 20 },
		{ hex: '#d95b43', prominence: 20 },
		{ hex: '#542437', prominence: 20 }
	],
	createRandom(1)
);

describe('flowerPowerMotif', () => {
	it.each(FLOWER_STYLES)('%s renders clean markup for any petal count', (style) => {
		[5, 8, 12].forEach((petals) => {
			const markup = flowerPowerMotif({
				x: 10,
				y: 10,
				scale: 50,
				style,
				petals,
				outerFill: '#111111',
				innerFill: '#222222',
				centreFill: '#333333',
				groundFill: '#444444'
			});
			expect(markup).not.toMatch(/NaN|undefined|Infinity/);
		});
	});
});

describe('layoutFlowers', () => {
	const layoutFor = (seed: number, width = 1200, height = 800) => layoutFlowers({ width, height, random: createRandom(seed) });
	const seeds = [1, 2, 3, 4, 5, 6];

	it('never lets two flowers touch', () => {
		seeds.forEach((seed) => {
			const flowers = layoutFor(seed);
			flowers.forEach((flower, index) =>
				flowers
					.slice(index + 1)
					.forEach((other) => expect(Math.hypot(flower.x - other.x, flower.y - other.y)).toBeGreaterThan(flower.radius + other.radius))
			);
		});
	});

	it('starts with a couple of big flowers', () => {
		seeds.forEach((seed) => {
			const [first, second, third] = layoutFor(seed);
			expect(first!.radius).toBeGreaterThanOrEqual(BIG_RADIUS[0]);
			expect(second!.radius).toBeGreaterThanOrEqual(BIG_RADIUS[0]);
			// A third big flower is allowed, but every flower after the big ones is clearly smaller.
			const followers = layoutFor(seed).filter(({ radius }) => radius < BIG_RADIUS[0]);
			expect(Math.max(...followers.map(({ radius }) => radius))).toBeLessThanOrEqual(FIRST_FOLLOWER_RADIUS);
			expect(third).toBeDefined();
		});
	});

	it('then places progressively smaller flowers', () => {
		const radii = layoutFor(1)
			.map(({ radius }) => radius)
			.filter((radius) => radius < BIG_RADIUS[0]);
		const firstHalf = radii.slice(0, Math.floor(radii.length / 2));
		const secondHalf = radii.slice(Math.floor(radii.length / 2));
		const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
		expect(average(firstHalf)).toBeGreaterThan(average(secondHalf));
	});

	it('fills the canvas: many flowers, spread across both halves', () => {
		const visible = layoutFor(1).filter(({ x, y }) => x >= 0 && x <= 1200 && y >= 0 && y <= 800);
		expect(visible.length).toBeGreaterThan(20);
		expect(visible.some(({ x }) => x < 400)).toBe(true);
		expect(visible.some(({ x }) => x > 800)).toBe(true);
		expect(visible.some(({ y }) => y < 270)).toBe(true);
		expect(visible.some(({ y }) => y > 530)).toBe(true);
	});

	it('keeps density the same on a larger canvas', () => {
		const small = layoutFor(1, 1200, 800).length;
		const large = layoutFor(1, 2400, 1600).length;
		expect(large).toBeGreaterThan(small * 2);
	});
});

describe('assignColourRoles', () => {
	it('uses the most prominent colour as ground and the highest-contrast colour as outline', () => {
		expect(roles.ground).toBe('#ecd078');
		expect(roles.outline).toBe('#542437');
		expect(roles.fills).not.toContain('#542437');
	});

	it('pads a one-colour palette so every role has a colour', () => {
		const mono = assignColourRoles([{ hex: '#336699', prominence: 1 }], createRandom(1));
		expect(mono.fills.length).toBeGreaterThan(0);
		expect(fillAt(mono, -1)).toMatch(/^#[0-9a-f]{6}$/);
	});
});

describe('sampleCubicPath', () => {
	it('spaces points evenly along a straight line', () => {
		const line: CubicSegment = [
			{ x: 0, y: 0 },
			{ x: 0, y: 0 },
			{ x: 100, y: 0 },
			{ x: 100, y: 0 }
		];
		const samples = sampleCubicPath([line], 4);
		samples.forEach(({ x }, index) => expect(x).toBeCloseTo(index * 25, 0));
		expect(samples[1]!.angle).toBeCloseTo(0);
	});
});
