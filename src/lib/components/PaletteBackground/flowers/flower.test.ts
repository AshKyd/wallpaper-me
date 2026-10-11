import { describe, expect, it } from 'vitest';
import { SEED_RADIUS, SEED_RING_COUNT, SEED_RING_DISTANCE, flowerMotif } from './flower.js';

const markup = flowerMotif({ x: 0, y: 0, petals: 8, backFill: '#111111', frontFill: '#222222', centreFill: '#333333', seedFill: '#444444' });
const dots = [...markup.matchAll(/<circle (?:cx="([-\d.]+)" cy="([-\d.]+)" )?r="0\.04" fill="#444444"\/>/g)].map(([, x = '0', y = '0']) => [Number(x), Number(y)] as const);

describe('flower centre dots', () => {
	it('has one dot in the middle and a ring of evenly spaced dots round it', () => {
		expect(SEED_RADIUS).toBe(0.04);
		expect(dots).toHaveLength(SEED_RING_COUNT + 1);
		expect(dots[0]).toEqual([0, 0]);
		const ring = dots.slice(1);
		ring.forEach(([x, y]) => expect(Math.hypot(x, y)).toBeCloseTo(SEED_RING_DISTANCE, 1));
		// Evenly spaced: every neighbouring pair is the same distance apart.
		const gaps = ring.map(([x, y], index) => Math.hypot(x - ring[(index + 1) % ring.length]![0], y - ring[(index + 1) % ring.length]![1]));
		expect(Math.max(...gaps) - Math.min(...gaps)).toBeLessThan(0.01);
	});

	it('keeps the dots inside the centre disc', () => {
		dots.forEach(([x, y]) => expect(Math.hypot(x, y) + SEED_RADIUS).toBeLessThan(0.3));
	});
});
