import twemoji from '@twemoji/api';
import paperCore from 'paper/dist/paper-core.js';

/** Twemoji artwork is drawn in a 36 by 36 box. */
export const OUTLINE_BOX = 36;

const ZERO_WIDTH_JOINER = '‍';
const VARIATION_SELECTOR = '️';

/**
 * Every Twemoji SVG, loaded one at a time on demand (a file each, not all 3,700 in the bundle). They ship in
 * `@twemoji/svg`, named by lowercase code points joined with `-`, so nothing is fetched over the network.
 */
const FILES = import.meta.glob<string>('/node_modules/@twemoji/svg/*.svg', { query: '?raw', import: 'default' });

/**
 * The file name (without `.svg`) of an emoji: its code points in lowercase hex, joined with `-`. As Twemoji does,
 * the variation selector is dropped, except in a joined sequence (a family, a profession), where it stays.
 */
export function fileNameOf(emoji: string): string {
	const glyph = emoji.includes(ZERO_WIDTH_JOINER) ? emoji : emoji.replaceAll(VARIATION_SELECTOR, '');
	return twemoji.convert.toCodePoint(glyph);
}

/**
 * The drawing of a Twemoji SVG: its inner markup, with its fills (the shapes are all `path`, `circle` and
 * `ellipse`). Clip paths are dropped, as they only trim a few files' edges. A file that is not an SVG gives nothing.
 */
export function artworkOf(svg: string): string | undefined {
	const [, inner] = svg.match(/<svg[^>]*>(.*)<\/svg>/s) ?? [];
	if (!inner) return undefined;
	return inner
		.replaceAll(/<defs>.*?<\/defs>/gs, '')
		.replaceAll(/\sclip-path="[^"]*"/g, '')
		.trim();
}

/** Paper.js is only used for its geometry, so it needs a scope but never a canvas. Two decimals is plenty at 36 units. */
// The package types its API as a global `paper` namespace, not as the module's exports, hence the cast.
const scope = new (paperCore as unknown as typeof paper).PaperScope();
scope.setup(new scope.Size(OUTLINE_BOX, OUTLINE_BOX));
scope.settings.precision = 2;

const attributeOf = (tag: string, name: string) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];

/** Applies an SVG `transform` (Twemoji only uses `rotate()` and `matrix()`) to a shape. */
function transformShape(shape: paper.PathItem, transform: string | undefined) {
	const [, kind, values] = transform?.match(/(rotate|matrix)\(([^)]*)\)/) ?? [];
	const numbers = (values ?? '').split(/[\s,]+/).filter(Boolean).map(Number);
	if (kind === 'rotate') shape.rotate(numbers[0]!, new scope.Point(numbers[1] ?? 0, numbers[2] ?? 0));
	if (kind === 'matrix' && numbers.length === 6) shape.transform(new scope.Matrix(...(numbers as [number, number, number, number, number, number])));
}

/** The `path`, `circle` and `ellipse` elements of some artwork as Paper.js shapes, bottom to top. */
function shapesOf(artwork: string): paper.PathItem[] {
	return [...artwork.matchAll(/<(path|circle|ellipse)\b([^>]*?)\/?>/g)].flatMap(([, kind, tag = '']) => {
		const number = (name: string) => Number(attributeOf(tag, name) ?? 0);
		const shape =
			kind === 'path'
				? new scope.CompoundPath({ pathData: attributeOf(tag, 'd') ?? '', insert: false })
				: new scope.Path.Ellipse({ center: [number('cx'), number('cy')], radius: kind === 'circle' ? [number('r'), number('r')] : [number('rx'), number('ry')], insert: false });
		// A fill closes an open path, so booleans must see it closed too.
		(shape instanceof scope.CompoundPath ? shape.children : [shape]).forEach((child) => ((child as paper.Path).closed = true));
		transformShape(shape, attributeOf(tag, 'transform'));
		return shape.isEmpty() ? [] : [shape];
	});
}

/**
 * An emoji's drawing as an outline of what can be seen. Twemoji paints shapes over one another, so stroking
 * them all draws the edges of everything underneath too. Each shape has the shapes painted above it cut
 * out (working from the top, keeping the union of everything above), and only what is left is stroked. Fills
 * are dropped so whoever draws it decides the stroke and the fill. Artwork with no shapes keeps its markup.
 */
export function outlineOf(svg: string): string | undefined {
	const artwork = artworkOf(svg);
	if (artwork === undefined) return undefined;
	const shapes = shapesOf(artwork);
	if (!shapes.length) return artwork.replaceAll(/\sfill="[^"]*"/g, '');

	const { visible } = shapes.reduceRight(
		(state, shape) => {
			// A boolean can fail on near-tangent edges; the shape is then kept whole rather than lost.
			const remaining = state.covered ? (tryBoolean(() => shape.subtract(state.covered!, { insert: false })) ?? shape) : shape;
			const covered = state.covered ? (tryBoolean(() => state.covered!.unite(shape, { insert: false })) ?? state.covered) : shape;
			return { covered, visible: [remaining, ...state.visible] };
		},
		{ covered: undefined as paper.PathItem | undefined, visible: [] as paper.PathItem[] }
	);
	const pathData = visible.map((shape) => shape.pathData).filter(Boolean).join('');
	return pathData ? `<path d="${pathData}"/>` : undefined;
}

const tryBoolean = <T>(operation: () => T): T | undefined => {
	try {
		return operation();
	} catch {
		return undefined;
	}
};

/** Artwork already loaded, by file name. A missing emoji is stored as `null`, so it is not asked for again. */
const loaded = new Map<string, string | null>();

/** Outlines already worked out, by artwork. Cutting shapes out of one another is costly, and drawing asks for the outline often. */
const outlines = new Map<string, string | undefined>();

/** The artwork of an emoji, if `loadEmojiOutline()` has finished for it. Nothing for an emoji Twemoji does not have. */
export const cachedArtwork = (emoji: string): string | undefined => loaded.get(fileNameOf(emoji)) ?? undefined;

/** An emoji's Twemoji drawing as an image `src` (a data URI, so nothing is fetched), if loaded. For showing Twemoji where text would use the system's emoji font. */
export const emojiImageSrc = (emoji: string): string | undefined => {
	const artwork = cachedArtwork(emoji);
	return artwork === undefined ? undefined : `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${OUTLINE_BOX} ${OUTLINE_BOX}">${artwork}</svg>`)}`;
};

/** The outline of an emoji (the visible edges of its artwork, no fills), if loaded. */
export const cachedOutline = (emoji: string): string | undefined => {
	const artwork = cachedArtwork(emoji);
	if (artwork === undefined) return undefined;
	if (!outlines.has(artwork)) outlines.set(artwork, outlineOf(`<svg>${artwork}</svg>`));
	return outlines.get(artwork);
};

/** Loads an emoji's drawing into the cache, resolving to whether there is one. Call before drawing `emoji-storm` or `emoji-neon`. */
export async function loadEmojiOutline(emoji: string): Promise<boolean> {
	const name = fileNameOf(emoji);
	if (loaded.has(name)) return loaded.get(name) !== null;
	const load = FILES[`/node_modules/@twemoji/svg/${name}.svg`];
	const artwork = load ? await load().then(artworkOf).catch(() => undefined) : undefined;
	loaded.set(name, artwork ?? null);
	return artwork !== undefined;
}
