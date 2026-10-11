<script lang="ts">
	import { UIRoot } from 'svelte-akui';
	import { onNavigate } from '$app/navigation';
	import { onPageNavigate } from '#lib/transitions/viewTransition.js';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	onNavigate(onPageNavigate);
</script>

<svelte:head>
	<title>Wallpaper Me</title>
</svelte:head>

<UIRoot>
	{@render children()}
</UIRoot>

<style>
	:global(html),
	:global(body) {
		margin: 0;
		height: 100%;
		color-scheme: light dark;
	}

	/* Page crossfade: quicker than the wallpaper wipe (300ms against 800ms), so navigating stays snappy. The old and new
	   page pseudo-elements inherit this duration from the group. */
	:global(::view-transition-group(root)) {
		animation-duration: 300ms;
		animation-timing-function: ease-out;
	}
</style>
