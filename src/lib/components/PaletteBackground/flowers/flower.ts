import { fixed, petalPath, transformAttr, type Placement } from './geometry.js';

/** The centre's dots: one in the middle, and `SEED_RING_COUNT` evenly spaced round it, in flower units. */
export const SEED_RING_COUNT = 8;
export const SEED_RING_DISTANCE = 0.19;
export const SEED_RADIUS = 0.04;

interface FlowerOptions extends Placement {
	petals: number;
	backFill: string;
	frontFill: string;
	centreFill: string;
	seedFill: string;
}

/**
 * Layered rosette, one unit in radius: a back ring of petals, a smaller front ring offset by
 * half a petal, then a centre disc with a dot in the middle and a ring of evenly spaced dots round it.
 */
export function flowerMotif({ petals, backFill, frontFill, centreFill, seedFill, ...placement }: FlowerOptions): string {
	const step = 360 / petals;
	const ring = (length: number, width: number, offset: number, fill: string) =>
		Array.from(
			{ length: petals },
			(_, index) => `<path d="${petalPath(length, width)}" fill="${fill}" transform="rotate(${fixed(index * step + offset)})"/>`
		).join('');
	// A dot in the middle and a ring of evenly spaced dots round it: geometric, not scattered.
	const seeds = [
		`<circle r="${SEED_RADIUS}" fill="${seedFill}"/>`,
		...Array.from({ length: SEED_RING_COUNT }, (_, index) => {
			const angle = (index * 2 * Math.PI) / SEED_RING_COUNT;
			return `<circle cx="${fixed(Math.sin(angle) * SEED_RING_DISTANCE)}" cy="${fixed(-Math.cos(angle) * SEED_RING_DISTANCE)}" r="${SEED_RADIUS}" fill="${seedFill}"/>`;
		})
	].join('');
	return [
		`<g transform="${transformAttr(placement)}">`,
		ring(1, Math.min(0.62, 3.2 / petals), 0, backFill),
		ring(0.7, Math.min(0.5, 2.6 / petals), step / 2, frontFill),
		`<circle r="0.3" fill="${centreFill}"/>`,
		seeds,
		`</g>`
	].join('');
}
