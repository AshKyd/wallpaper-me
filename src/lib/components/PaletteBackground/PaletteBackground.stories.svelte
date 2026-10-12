<script module lang="ts">
	import { defineMeta } from '@storybook/addon-svelte-csf';
	import PaletteBackground from './PaletteBackground.svelte';
	import { PALETTE_VARIANTS } from './generators.js';
	import { PALETTE_TONES } from './tones.js';
	import { createRandom, hashSeed, normalisePalette, type Palette } from './paletteUtils.js';
	import paletteData from '../../../../palettes.json';
	import { assignColourRoles, fillAt } from './flowers/colourRoles.js';
	import { FLOWER_STYLES, flowerPowerMotif } from './flowers/daisy.js';
	import { renderCheckerGrid } from './checkerboard.js';
	import { buildColourPairs } from './checkerboard/layers.js';
	import { MOTIFS, MOTIF_NAMES } from './checkerboard/motifs.js';

	const palettes = paletteData as Palette[];

	/** Each flower style on its own, for tuning proportions. */
	const motifRoles = assignColourRoles(normalisePalette(palettes[2]!), createRandom(1));
	const flowerMotifs = FLOWER_STYLES.map((style) => ({
		name: style,
		markup: flowerPowerMotif({
			x: 100,
			y: 100,
			scale: 80,
			style,
			petals: 8,
			outerFill: fillAt(motifRoles, 0),
			innerFill: fillAt(motifRoles, 1),
			centreFill: motifRoles.outline,
			groundFill: motifRoles.ground
		})
	}));

	/** Each checkerboard motif alone on a 15x15 board, for tuning. */
	const checkerPairs = buildColourPairs(normalisePalette(palettes[2]!), createRandom(1));
	const checkerMotifs = MOTIF_NAMES.map((name) => {
		const size = 15;
		const radius = 6;
		const cell = 14;
		const layers = Array.from({ length: size }, (_, row) =>
			Array.from({ length: size }, (_, column) => {
				const tone = MOTIFS[name](column - 7, row - 7, radius);
				return tone === undefined ? 0 : 1 + (tone % (checkerPairs.length - 1));
			})
		);
		return {
			name,
			markup: renderCheckerGrid({ cell, columns: size, rows: size, originX: 0, originY: 0, pairs: checkerPairs, layers })
		};
	});

	const { Story } = defineMeta({
		title: 'Backgrounds/PaletteBackground',
		component: PaletteBackground,
		tags: ['autodocs'],
		parameters: { layout: 'padded' },
		argTypes: {
			variant: { control: 'select', options: [...PALETTE_VARIANTS] },
			tone: { control: 'select', options: [...PALETTE_TONES] },
			seed: { control: { type: 'number', min: 1, step: 1 } },
			gap: { control: { type: 'range', min: 0, max: 0.4, step: 0.02 } },
			parallax: { control: 'boolean', description: 'circles and flowers: layers slide with the cursor' },
			parallaxPoint: { control: { type: 'range', min: 0, max: 1, step: 0.01 } },
			parallaxDistance: { control: { type: 'range', min: 0, max: 80, step: 1 } }
		}
	});
</script>

<!-- One variant, every palette. -->
{#snippet gallery(variant: (typeof PALETTE_VARIANTS)[number], gap = 0)}
	<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem;">
		{#each palettes as palette (palette.title)}
			<figure style="margin: 0;">
				<div style="height: 170px; border-radius: 12px; overflow: hidden;">
					<PaletteBackground {palette} {variant} {gap} seed={hashSeed(palette.title)} />
				</div>
				<figcaption style="font-size: 0.8rem; padding-top: 0.35rem;">{palette.title}</figcaption>
			</figure>
		{/each}
	</div>
{/snippet}

<!-- Use circles or flowers, then tick parallax and move the cursor (parallaxPoint, parallaxDistance). -->
<Story
	name="Playground"
	args={{ palette: palettes[0], variant: 'circles', tone: 'original', seed: 1, parallax: false, parallaxPoint: 0.5, parallaxDistance: 30 }}
>
	{#snippet template(args)}
		<div style="height: 70vh; border-radius: 16px; overflow: hidden;">
			<PaletteBackground {...args} />
		</div>
	{/snippet}
</Story>

<!-- Drag the bottom-right corner: the artwork redraws for the new shape when the ratio crosses a 0.25 step. -->
<Story name="Resizable" args={{ palette: palettes[3], variant: 'bands', seed: 1 }}>
	{#snippet template(args)}
		<div style="width: 600px; height: 400px; min-width: 120px; min-height: 120px; resize: both; overflow: hidden; border-radius: 16px;">
			<PaletteBackground {...args} />
		</div>
	{/snippet}
</Story>

<Story name="Circles" asChild>{@render gallery('circles')}</Story>
<Story name="Triangles" asChild>{@render gallery('triangles')}</Story>
<Story name="Diamonds" asChild>{@render gallery('diamonds')}</Story>
<Story name="Bands" asChild>{@render gallery('bands')}</Story>
<Story name="Flowers" asChild>{@render gallery('flowers')}</Story>
<Story name="Checkerboard" asChild>{@render gallery('checkerboard')}</Story>

<Story name="Hexagons" asChild>{@render gallery('hexagons')}</Story>
<Story name="Hexagons with borders" asChild>{@render gallery('hexagons', 0.12)}</Story>
<Story name="Bokeh" asChild>{@render gallery('bokeh')}</Story>
<Story name="Mondrian" asChild>{@render gallery('mondrian')}</Story>
<Story name="Stripes" asChild>{@render gallery('stripes')}</Story>
<Story name="Mid-century" asChild>{@render gallery('midcentury')}</Story>
<Story name="Art deco" asChild>{@render gallery('artdeco')}</Story>
<Story name="80s" asChild>{@render gallery('80s')}</Story>
<Story name="Emoji Storm" asChild>{@render gallery('emoji-storm')}</Story>
<Story name="Neon" asChild>{@render gallery('neon')}</Story><Story name="Checkerboard motifs" asChild>
	<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)); gap: 1rem;">
		{#each checkerMotifs as { name, markup } (name)}
			<figure style="margin: 0;">
				<svg viewBox="0 0 210 210" style="width: 100%; border-radius: 8px;">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- markup comes only from our generators -->
					{@html markup}
				</svg>
				<figcaption style="font-size: 0.8rem; padding-top: 0.35rem;">{name}</figcaption>
			</figure>
		{/each}
	</div>
</Story>

<Story name="Flower motifs" asChild>
	<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 1rem;">
		{#each flowerMotifs as { name, markup } (name)}
			<figure style="margin: 0;">
				<svg viewBox="0 0 200 200" style="width: 100%; border-radius: 12px; background: {motifRoles.ground};">
					<!-- eslint-disable-next-line svelte/no-at-html-tags -- markup comes only from our generators -->
					{@html markup}
				</svg>
				<figcaption style="font-size: 0.8rem; padding-top: 0.35rem;">{name}</figcaption>
			</figure>
		{/each}
	</div>
</Story>

<!-- Every palette in every tone, for one variant: one row per palette. Use these to tune TONE_SETTINGS in tones.ts. -->
{#snippet toneRows(variant: (typeof PALETTE_VARIANTS)[number])}
	<div style="display: flex; flex-direction: column; gap: 1.5rem;">
		{#each palettes as palette (palette.title)}
			<section>
				<h3 style="margin: 0 0 0.5rem; font-size: 0.95rem;">{palette.title}</h3>
				<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
					{#each PALETTE_TONES as tone (tone)}
						<div style="height: 150px; border-radius: 12px; overflow: hidden;">
							<PaletteBackground {palette} {variant} {tone} seed={hashSeed(palette.title)}>
								<p style="margin: 0; padding: 0.6rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: white; text-shadow: 0 1px 4px #0008;">
									{tone}
								</p>
							</PaletteBackground>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
{/snippet}

<Story name="Tones: circles" asChild>{@render toneRows('circles')}</Story>
<Story name="Tones: flowers" asChild>{@render toneRows('flowers')}</Story>
<Story name="Tones: checkerboard" asChild>{@render toneRows('checkerboard')}</Story>
<Story name="Tones: hexagons" asChild>{@render toneRows('hexagons')}</Story>
<Story name="Tones: bands" asChild>{@render toneRows('bands')}</Story>
<Story name="Tones: bokeh" asChild>{@render toneRows('bokeh')}</Story>
<Story name="Tones: mondrian" asChild>{@render toneRows('mondrian')}</Story>
<Story name="Tones: stripes" asChild>{@render toneRows('stripes')}</Story>
<Story name="Tones: mid-century" asChild>{@render toneRows('midcentury')}</Story>
<Story name="Tones: art deco" asChild>{@render toneRows('artdeco')}</Story>
<Story name="Tones: 80s" asChild>{@render toneRows('80s')}</Story>
<Story name="Tones: Emoji Storm" asChild>{@render toneRows('emoji-storm')}</Story>
<Story name="Tones: neon" asChild>{@render toneRows('neon')}</Story><!-- Every variant for every colour scheme: one row per palette. -->
<Story name="All variants" asChild>
	<div style="display: flex; flex-direction: column; gap: 2rem;">
		{#each palettes as palette (palette.title)}
			<section>
				<h3 style="margin: 0 0 0.5rem; font-size: 0.95rem;">{palette.title}</h3>
				<div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem;">
					{#each PALETTE_VARIANTS as variant (variant)}
						<div style="height: 150px; border-radius: 12px; overflow: hidden;">
							<PaletteBackground {palette} {variant} seed={hashSeed(palette.title)}>
								<p style="margin: 0; padding: 0.6rem 0.75rem; font-size: 0.8rem; font-weight: 600; color: white; text-shadow: 0 1px 4px #0008;">
									{variant}
								</p>
							</PaletteBackground>
						</div>
					{/each}
				</div>
			</section>
		{/each}
	</div>
</Story>
