import { isVariant } from '#lib/wallpaper/wallpaperSettings.js';

/** SvelteKit 3 matchers are Standard Schemas, keyed by the name used in the route (`[variant=variant]`). */
const variant = {
	'~standard': {
		version: 1 as const,
		vendor: 'wallpaper-me',
		// Only real `PaletteVariant` names match, so a mistyped hash falls through to the not-found page.
		validate: (value: unknown) =>
			typeof value === 'string' && isVariant(value) ? { value } : { issues: [{ message: 'Unknown variant' }] }
	}
};

export const params = { variant };
