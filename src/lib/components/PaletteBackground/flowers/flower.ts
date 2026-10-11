import { fixed, petalPath, transformAttr, type Placement } from './geometry.js';

/** Radians between golden-angle steps; spaces seeds evenly like a sunflower head. */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

interface FlowerOptions extends Placement {
	petals: number;
	backFill: string;
	frontFill: string;
	centreFill: string;
	seedFill: string;
}

/**
 * Layered rosette, one unit in radius: a back ring of petals, a smaller front ring offset by
 * half a petal, then a centre disc with golden-angle seed dots.
 */
export function flowerMotif({ petals, backFill, frontFill, centreFill, seedFill, ...placement }: FlowerOptions): string {
	const step = 360 / petals;
	const ring = (length: number, width: number, offset: number, fill: string) =>
		Array.from(
			{ length: petals },
			(_, index) => `<path d="${petalPath(length, width)}" fill="${fill}" transform="rotate(${fixed(index * step + offset)})"/>`
		).join('');
	const seeds = Array.from({ length: 9 }, (_, index) => {
		const distance = 0.22 * Math.sqrt((index + 0.5) / 9);
		const angle = index * GOLDEN_ANGLE;
		return `<circle cx="${fixed(Math.cos(angle) * distance)}" cy="${fixed(Math.sin(angle) * distance)}" r="0.04" fill="${seedFill}"/>`;
	}).join('');
	return [
		`<g transform="${transformAttr(placement)}">`,
		ring(1, Math.min(0.62, 3.2 / petals), 0, backFill),
		ring(0.7, Math.min(0.5, 2.6 / petals), step / 2, frontFill),
		`<circle r="0.3" fill="${centreFill}"/>`,
		seeds,
		`</g>`
	].join('');
}
