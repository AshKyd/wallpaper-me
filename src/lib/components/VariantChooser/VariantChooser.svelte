<script lang="ts">
	import { Glow } from 'svelte-akui';
	import { resolve } from '$app/paths';
	import PaletteBackground from '#lib/components/PaletteBackground/PaletteBackground.svelte';
	import { PALETTE_VARIANTS } from '#lib/components/PaletteBackground/generators.js';
	import type { Palette } from '#lib/components/PaletteBackground/paletteUtils.js';

	interface Props {
		/** Palette used for the previews. */
		palette: Palette;
	}

	let { palette }: Props = $props();
</script>

<ul class="variant-chooser">
	{#each PALETTE_VARIANTS as variant (variant)}
		<li>
			<a class="variant-card" href={resolve('/[variant=variant]', { variant })}>
				<div class="preview"><PaletteBackground {palette} {variant} seed={1} /></div>
				<span class="name">{variant}</span>
				<Glow />
			</a>
		</li>
	{/each}
</ul>

<style>
	.variant-chooser {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
		gap: 1rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/* Same feedback as akui's `SelectableItem`: hover tint, pressed look and a focus ring, over a raised glow. */
	.variant-card {
		position: relative; /* Anchors the hover tint and the Glow. */
		display: block;
		overflow: hidden;
		border-radius: var(--akui-radius-m);
		/* Stands out from the panel behind: the secondary surface with a hint of the accent colour. */
		background: color-mix(in srgb, var(--akui-bg-accent) 16%, var(--akui-bg-secondary));
		text-decoration: none;
		-webkit-tap-highlight-color: transparent;
		/* Pressed state moves via `top`, not `transform`: a transform puts the card on its own layer
		   and makes rounded, clipped edges render with visible aliasing. */
		top: 0;
		transition: top 0.1s ease;
	}

	.variant-card::after {
		content: '';
		position: absolute;
		inset: 0;
		z-index: 9;
		background: var(--akui-bg-hover);
		opacity: 0;
		pointer-events: none;
		transition: opacity 0.2s ease;
	}

	.variant-card:hover::after {
		opacity: 1;
	}

	.variant-card:active {
		top: 1px;
	}

	.variant-card :global(.akui-glow) {
		transition: box-shadow 0.2s ease;
	}

	.variant-card:focus-visible {
		outline: 2px solid var(--akui-bg-accent-focus);
		outline-offset: 2px;
	}

	.preview {
		height: 120px;
	}

	/* The hover tint overlay sits above the card's contents, so it was tinting the text. Lifting the name above it
	   (and fixing the link colour in every state) keeps the text colour constant. */
	.variant-card,
	.variant-card:hover,
	.variant-card:focus,
	.variant-card:visited {
		color: inherit;
	}

	.name {
		position: relative;
		z-index: 10;
		color: inherit;
		display: block;
		padding: 0.5rem 0.75rem;
		text-transform: capitalize;
		font-weight: 600;
	}
</style>
