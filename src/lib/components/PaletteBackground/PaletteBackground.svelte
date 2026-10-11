<script module lang="ts">
	/**
	 * Last pointer position seen by any background. A new background (e.g. after a keyed swap) starts
	 * from this instead of the centre, so its layers don't slide across from the middle.
	 */
	let lastPointer: { clientX: number; clientY: number } | undefined;
</script>

<script lang="ts">
	import type { Snippet } from 'svelte';
	import { canvasSizeFor, generatePaletteArt, type DepthSettings, type PaletteVariant } from './generators.js';
	import { splitLayers } from './depthLayers.js';
	import { PARALLAX_BLEED, parallaxOffset, pointerPosition } from './parallax.js';
	import type { Palette } from './paletteUtils.js';
	import type { PaletteTone } from './tones.js';

	interface Props {
		/** Palette whose colours the artwork uses. */
		palette: Palette;
		/** Which generative style to draw. */
		variant?: PaletteVariant;
		/** Same seed gives the same artwork; change it for a new arrangement. */
		seed?: number;
		/** Borders between shapes, as a share of shape size (0 to 0.4). Only `hexagons` uses it. */
		gap?: number;
		/** Slides each depth layer as the cursor moves, so near and far shapes shift apart; larger shapes are nearer. Only `circles`, `flowers` and `bokeh` have layers; other variants slide as one piece. */
		parallax?: boolean;
		/** Depth that stays still, 0 (smallest, furthest) to 1 (largest, nearest). Nearer shapes slide one way, further ones the other. */
		parallaxPoint?: number;
		/** Furthest a layer slides, in canvas units (0 to 80). */
		parallaxDistance?: number;
		/** Recolours the artwork: `pastel` (soft), `dark`, or `subtleDark` (soft and dark). The layout is the same in every tone. */
		tone?: PaletteTone;
		/** Content layered above the artwork. */
		children?: Snippet;
		/** Optional additional CSS class names. */
		class?: string;
	}

	let {
		palette,
		variant = 'circles',
		seed = 1,
		gap = 0,
		parallax = false,
		parallaxPoint = 0.5,
		parallaxDistance = 30,
		tone = 'original',
		children,
		class: className = ''
	}: Props = $props();

	const uniqueId = $props.id();

	/** Container size, bound below. Zero until measured, which gives the default 3:2 canvas. */
	let containerWidth = $state(0);
	let containerHeight = $state(0);
	let container: HTMLDivElement | undefined = $state();

	// Draw for the container's shape so no band or motif is cropped away. The ratio is bucketed,
	// so this only re-runs when the shape changes noticeably, not on every pixel of a resize.
	const { width, height } = $derived(canvasSizeFor(containerWidth, containerHeight));

	// Parallax slides layers, so the art is drawn this much larger on every side to keep the edges covered.
	const bleed = $derived(parallax ? PARALLAX_BLEED : 0);
	const paddedWidth = $derived(width + bleed * 2);
	const paddedHeight = $derived(height + bleed * 2);

	const depth = $derived<DepthSettings | undefined>(parallax ? { parallaxPoint } : undefined);

	// Output is built only from our own generators and validated palette hexes, so {@html} is safe.
	const artwork = $derived(
		generatePaletteArt({ palette, variant, seed, idPrefix: `pb-${uniqueId}`, width: paddedWidth, height: paddedHeight, gap, depth, tone })
	);

	// With parallax, what stays put (`base`) and each depth layer are drawn as separate <svg>s. The
	// browser slides a whole element on the GPU, which is smooth; moving shapes inside one SVG
	// repaints the entire artwork on every cursor move.
	const parts = $derived(parallax ? splitLayers(artwork) : undefined);

	/** Canvas units to screen pixels: the art is scaled to cover the container. */
	const pixelsPerUnit = $derived(containerWidth && containerHeight ? Math.max(containerWidth / width, containerHeight / height) : 1);

	// Layer boxes sit on whole screen pixels: Firefox snaps an SVG's box to a pixel but not its content,
	// so a fractional box leaves shape edges between pixels and shows seams.
	const layerWidth = $derived(Math.round(paddedWidth * pixelsPerUnit));
	const layerHeight = $derived(Math.round(paddedHeight * pixelsPerUnit));

	/** Where the cursor is over the background, -1 to 1 per axis from its centre. The cursor may be anywhere on the page. */
	let cursor = $state({ x: 0, y: 0 });
	const slide = $derived(parallaxOffset(cursor, parallaxDistance));

	/**
	 * Layers only ease towards the cursor once it has been placed. The first placement is instant:
	 * otherwise the layers would slide there from the centre when the page loads or the art is swapped.
	 */
	let following = $state(false);

	function placeCursor({ clientX, clientY }: { clientX: number; clientY: number }) {
		if (container) cursor = pointerPosition(clientX, clientY, container.getBoundingClientRect());
	}

	/** Waits two frames, so the instant placement is painted before the easing is switched on. */
	function startEasing() {
		requestAnimationFrame(() => requestAnimationFrame(() => (following = true)));
	}

	// At most one update per frame, however fast the pointer reports.
	let frame = 0;
	function followCursor({ clientX, clientY }: PointerEvent) {
		lastPointer = { clientX, clientY };
		cancelAnimationFrame(frame);
		frame = requestAnimationFrame(() => {
			placeCursor({ clientX, clientY });
			if (!following) startEasing();
		});
	}

	// A background created after the pointer has already moved starts in the right place.
	$effect(() => {
		if (!parallax || !container || !lastPointer || following) return;
		placeCursor(lastPointer);
		startEasing();
	});
</script>

<svelte:window onpointermove={parallax ? followCursor : undefined} />

<!-- The artwork covers the container, centred, and runs past it by the bleed. -->
{#snippet layerSvg(markup: string, shift: number)}
	<svg
		class="palette-background-layer"
		viewBox="0 0 {paddedWidth} {paddedHeight}"
		preserveAspectRatio="xMidYMid slice"
		aria-hidden="true"
		xmlns="http://www.w3.org/2000/svg"
		style:width="{layerWidth}px"
		style:height="{layerHeight}px"
		style:left="{Math.round((containerWidth - layerWidth) / 2)}px"
		style:top="{Math.round((containerHeight - layerHeight) / 2)}px"
		style:--shift={shift}
	>
		<!-- eslint-disable-next-line svelte/no-at-html-tags -- markup comes only from our generators -->
		{@html markup}
	</svg>
{/snippet}

<div class="palette-background {className}" bind:this={container} bind:clientWidth={containerWidth} bind:clientHeight={containerHeight}>
	{#if parts}
		<div class="palette-background-stack" class:following style:--parallax-x="{slide.x * pixelsPerUnit}px" style:--parallax-y="{slide.y * pixelsPerUnit}px">
			{#if parts.base.trim()}
				{@render layerSvg(parts.base, 0)}
			{/if}
			{#each parts.layers as { shift, markup }, index (index)}
				{@render layerSvg(markup, shift)}
			{/each}
		</div>
	{:else}
		<svg
			class="palette-background-art"
			viewBox="0 0 {width} {height}"
			preserveAspectRatio="xMidYMid slice"
			aria-hidden="true"
			xmlns="http://www.w3.org/2000/svg"
		>
			<!-- eslint-disable-next-line svelte/no-at-html-tags -- markup comes only from our generators -->
			{@html artwork}
		</svg>
	{/if}
	{#if children}
		<div class="palette-background-content">{@render children()}</div>
	{/if}
</div>

<style>
	.palette-background {
		position: relative;
		width: 100%;
		height: 100%;
		overflow: hidden;
	}

	.palette-background-art,
	.palette-background-stack {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		display: block;
	}

	/* Puts the art on its own compositing layer, which Firefox draws on whole pixels. */
	.palette-background-art {
		transform: translate(0, 0);
	}

	/* A layer slides by the cursor offset (screen pixels) times its own --shift. will-change keeps it on its own GPU layer. */
	.palette-background-layer {
		position: absolute;
		display: block;
		/* Each layer is deliberately wider than the container (it carries the parallax bleed). A host page's
		   `svg { max-width: 100% }` reset would cut it back to the container's width, but it is still
		   offset left by half the bleed, which leaves bare background on the right. */
		max-width: none;
		max-height: none;
		/* Rounded to a whole screen pixel: a fractional slide blurs the layer's edges and shows seams between shapes. */
		transform: translate3d(round(calc(var(--parallax-x, 0px) * var(--shift, 0)), 1px), round(calc(var(--parallax-y, 0px) * var(--shift, 0)), 1px), 0);
		will-change: transform;
	}

	.following .palette-background-layer {
		transition: transform 180ms ease-out;
	}

	:global(html[data-reduced-motion='true']) .palette-background-layer {
		transform: none;
	}

	.palette-background-content {
		position: relative;
	}
</style>
