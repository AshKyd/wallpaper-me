// SvelteKit loads this file straight in Node at build time, using native type stripping. Node can't resolve
// this project's `.js` imports to `.ts` files (or the `#lib` alias), so it must import nothing from the app.

/**
 * Must match `PALETTE_VARIANTS` in PaletteBackground/generators.ts; wallpaperSettings.test.ts checks that
 * they stay in step. Copied here because this file can't import it.
 */
export const VARIANT_NAMES = ['circles', 'triangles', 'diamonds', 'bands', 'flowers', 'checkerboard', 'hexagons', 'bokeh', 'mondrian', 'stripes', 'midcentury', '80s', 'neon'];

/** SvelteKit 3 matchers are Standard Schemas, keyed by the name used in the route (`[variant=variant]`). */
const variant = {
	'~standard': {
		version: 1 as const,
		vendor: 'wallpaper-me',
		// Only real variant names match, so a mistyped URL falls through to the not-found page.
		validate: (value: unknown) =>
			typeof value === 'string' && VARIANT_NAMES.includes(value) ? { value } : { issues: [{ message: 'Unknown variant' }] }
	}
};

export const params = { variant };
