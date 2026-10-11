<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Panel } from 'svelte-akui';

	interface Props {
		children: Snippet;
		class?: string;
	}

	let { children, class: className = '' }: Props = $props();
</script>

<!-- Translucent and blurred, so the wallpaper shows through the interface but text stays readable. The fallback keeps it translucent if a theme lacks the alpha token. -->
<Panel
	class={className}
	surface={{
		background: 'var(--akui-bg-alpha, color-mix(in srgb, var(--akui-bg) 70%, transparent))',
		backdropFilter: 'blur(18px) saturate(1.4)'
	}}
	{children}
/>
