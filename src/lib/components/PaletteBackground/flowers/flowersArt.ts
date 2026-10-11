import { CANVAS_HEIGHT, CANVAS_WIDTH, round, type GeneratorInput } from '../canvas.js';
import { depthLayers } from '../depthLayers.js';
import type { DepthItem } from '../depth.js';
import { packCircles, type PlacedCircle } from '../packing.js';
import { mixHex, randomBetween } from '../paletteUtils.js';
import { assignColourRoles, fillAt, type ColourRoles } from './colourRoles.js';
import { FLOWER_STYLES, flowerPowerMotif } from './daisy.js';

/** Clear space kept between any two flowers, in canvas units. */
const GAP = 14;
export const BIG_RADIUS = [240, 310] as const;
/** The progressive flowers start well below the big ones, so the big ones read as a deliberate few. */
export const FIRST_FOLLOWER_RADIUS = 180;
const SMALLEST_RADIUS = 34;
/** Radii the dots and flowers can have, used to place them in depth (dots are 3 to 12; followers shrink to at least 0.85 of the smallest). */
const FLOWER_SIZE_RANGE = { smallest: 3, largest: BIG_RADIUS[1] };
/** Random spots tried per flower; the roomiest one wins, which spreads flowers out evenly. */
const CANDIDATES = 12;

/** Room left around a circle of `radius` at (x, y); negative means it overlaps something. */
const clearanceAt = (placed: PlacedCircle[], x: number, y: number, radius: number) =>
	Math.min(Infinity, ...placed.map((other) => Math.hypot(other.x - x, other.y - y) - other.radius - radius));

/**
 * Flowers that never touch: a couple of big ones first, then progressively smaller ones fill the
 * space between them.
 *
 * - The big flowers set the composition, which gives the layout its feel of randomness.
 * - Each following flower is a little smaller than the last. Size comes from the attempt number,
 *   not from what fits, so sizes fall smoothly from big to small.
 * - For each flower, `CANDIDATES` random spots are tried and the one with the most clearance is
 *   used. That keeps the spread even (a plain random spot clumps). A flower is skipped if even the
 *   best spot leaves less than `GAP`, so nothing touches.
 *
 * Flowers may spill past the edges, so the pattern looks cropped rather than framed. Attempts
 * scale with area, so density is the same at every canvas size.
 */
export function layoutFlowers({ width, height, random }: { width: number; height: number; random: () => number }): PlacedCircle[] {
	const tryPlace = (placed: PlacedCircle[], radius: number): PlacedCircle[] => {
		const best = Array.from({ length: CANDIDATES }, () => ({
			x: randomBetween(random, 0, width),
			y: randomBetween(random, 0, height)
		}))
			.map((spot) => ({ ...spot, clearance: clearanceAt(placed, spot.x, spot.y, radius) }))
			.reduce((winner, spot) => (spot.clearance > winner.clearance ? spot : winner));
		return best.clearance >= GAP ? [...placed, { x: best.x, y: best.y, radius }] : placed;
	};

	const bigCount = 2 + Math.floor(random() * 2);
	const bigFlowers = Array.from({ length: bigCount }).reduce<PlacedCircle[]>(
		(placed) => tryPlace(placed, randomBetween(random, ...BIG_RADIUS)),
		[]
	);

	const attempts = Math.round((1800 * width * height) / (CANVAS_WIDTH * CANVAS_HEIGHT));
	return Array.from({ length: attempts }).reduce<PlacedCircle[]>((placed, _, attempt) => {
		const progress = attempt / attempts;
		// Eases down quickly at first, then lingers on small sizes where there are many gaps to fill.
		const radius = (SMALLEST_RADIUS + (FIRST_FOLLOWER_RADIUS - SMALLEST_RADIUS) * (1 - progress) ** 2.4) * randomBetween(random, 0.85, 1);
		return tryPlace(placed, radius);
	}, bigFlowers);
}

/**
 * Big flat circles of tint behind the flowers, so the background isn't one solid colour. Each is
 * the ground colour pulled part way towards another palette colour, so they stay calm.
 */
function backgroundCircles({ roles, random, width, height }: { roles: ColourRoles; random: () => number; width: number; height: number }): string {
	const count = Math.max(4, Math.round((width * height) / 90_000));
	const tints = [roles.echo, roles.outline, ...roles.fills];
	return Array.from({ length: count }, (_, index) => {
		const tint = mixHex(roles.ground, tints[index % tints.length]!, randomBetween(random, 0.14, 0.32));
		const x = randomBetween(random, 0, width);
		const y = randomBetween(random, 0, height);
		return `<circle cx="${round(x)}" cy="${round(y)}" r="${round(randomBetween(random, 170, 380))}" fill="${tint}"/>`;
	}).join('');
}

/**
 * Flower-power wall: a couple of big flowers, then progressively smaller ones (see
 * `layoutFlowers`), with dots in what is left, over large tonal circles of background colour.
 */
export function flowersArt({ colours, random, width, height, depth }: GeneratorInput): string {
	const roles: ColourRoles = assignColourRoles(colours, random);
	const flowers = layoutFlowers({ width, height, random });

	const flowerItems = flowers.map(({ x, y, radius }, index): DepthItem => ({
		size: radius,
		markup: flowerPowerMotif({
			x,
			y,
			scale: radius,
			rotation: random() * 360,
			style: FLOWER_STYLES[Math.floor(random() * FLOWER_STYLES.length)]!,
			petals: 6 + Math.floor(random() * 5),
			outerFill: fillAt(roles, index),
			innerFill: index % 3 === 0 ? roles.outline : fillAt(roles, index + 1),
			centreFill: index % 2 ? roles.outline : roles.echo,
			groundFill: roles.ground
		})
	}));

	// Dots only go where no flower is, with a margin so they never touch one either.
	const dotItems = packCircles({ random, width, height, attempts: 700, gap: GAP / 2, minRadius: 3, maxRadius: 9, obstacles: flowers }).map(
		({ x, y, radius }, index): DepthItem => ({
			size: radius,
			markup: `<circle cx="${round(x)}" cy="${round(y)}" r="${round(radius)}" fill="${index % 2 ? roles.outline : fillAt(roles, index)}"/>`
		})
	);

	// Dots are smaller than any flower, so with depth they sit furthest back.
	const layers = depthLayers({ items: [...dotItems, ...flowerItems], range: FLOWER_SIZE_RANGE, settings: depth });

	return [`<rect width="${width}" height="${height}" fill="${roles.ground}"/>`, backgroundCircles({ roles, random, width, height }), layers].join('');
}
