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

/** Different noise seeds, so neighbouring flowers don't wobble identically. */
const WOBBLE_VARIANTS = 4;
/** How far edges drift, as a share of the flower's radius. Applied in flower units, so it scales with size. */
const WOBBLE_STRENGTH = 0.07;
/** Flowers smaller than this stay crisp. */
const MIN_WOBBLE_RADIUS = 60;
/** Noise frequency in flower units: about two or three wobbles across a flower, at any size. */
const WOBBLE_FREQUENCY = 2.4;

/**
 * Turbulence displacement filters that make flat edges slightly hand-drawn. They run in the
 * flower's own units (the filter sits on the group scaled by the radius), so big flowers get big,
 * slow wobbles and small ones get fine ones, with the same look.
 */
const wobbleFilters = (idPrefix: string) => {
	const idFor = (variant: number) => `${idPrefix}-flower-wobble-${variant}`;
	const defs = Array.from(
		{ length: WOBBLE_VARIANTS },
		(_, variant) =>
			`<filter id="${idFor(variant)}" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="${WOBBLE_FREQUENCY}" numOctaves="1" seed="${variant + 1}" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${WOBBLE_STRENGTH}" xChannelSelector="R" yChannelSelector="G"/></filter>`
	).join('');
	return { idFor, defs };
};

/** The tint circles' edges drift far more than the flowers', so they read as soft organic blobs. In canvas units. */
const BACKGROUND_WOBBLE = { strength: 70, frequency: 0.004 };

/** One filter for the whole group of tint circles, with a margin so displaced edges aren't clipped. */
const backgroundWobbleFilter = ({ id, width, height }: { id: string; width: number; height: number }) =>
	`<filter id="${id}" filterUnits="userSpaceOnUse" x="-200" y="-200" width="${width + 400}" height="${height + 400}"><feTurbulence type="fractalNoise" baseFrequency="${BACKGROUND_WOBBLE.frequency}" numOctaves="2" seed="9" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="${BACKGROUND_WOBBLE.strength}" xChannelSelector="R" yChannelSelector="G"/></filter>`;

/**
 * Flower-power wall: a couple of big flowers, then progressively smaller ones (see
 * `layoutFlowers`), with dots in what is left, over large tonal circles of background colour.
 */
export function flowersArt({ colours, random, idPrefix, width, height, depth }: GeneratorInput): string {
	const roles: ColourRoles = assignColourRoles(colours, random);
	const wobble = wobbleFilters(idPrefix);
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
			groundFill: roles.ground,
			// Small flowers wobble too little to see, and every filtered element costs a re-render under the glass panel.
			filterId: radius >= MIN_WOBBLE_RADIUS ? wobble.idFor(index % WOBBLE_VARIANTS) : undefined
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

	const backgroundFilterId = `${idPrefix}-flower-background-wobble`;
	return [
		`<defs>${wobble.defs}${backgroundWobbleFilter({ id: backgroundFilterId, width, height })}</defs>`,
		`<rect width="${width}" height="${height}" fill="${roles.ground}"/>`,
		`<g filter="url(#${backgroundFilterId})">${backgroundCircles({ roles, random, width, height })}</g>`,
		layers
	].join('');
}
