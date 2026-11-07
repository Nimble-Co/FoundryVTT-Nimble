<!--
@component
The content of a GenericDialog with the `nimble-window` frame: the head, then the dialog's own component.
The head takes the window title. "Berserker: Configure Mana" shows "Configure Mana" with "Berserker" under it.
-->
<script lang="ts">
	import type { Component } from 'svelte';
	import WindowHead from '#view/actorSheets/parts/WindowHead.svelte';

	interface ShellDialog {
		title: string;
		options: { window?: { icon?: string | false } };
		content: Component<Record<string, unknown>>;
	}

	let { dialog, ...rest }: { dialog: ShellDialog } & Record<string, unknown> = $props();

	const split = $derived(dialog.title.indexOf(': '));
	const title = $derived(split > 0 ? dialog.title.slice(split + 2) : dialog.title);
	const sub = $derived(split > 0 ? dialog.title.slice(0, split) : undefined);
	const icon = $derived(dialog.options.window?.icon || undefined);
	const Content = $derived(dialog.content);
</script>

<div class="nimble-window__head">
	<WindowHead {title} {sub} {icon} />
</div>
<div class="nimble-window__content">
	<Content {dialog} {...rest} />
</div>

<style>
	.nimble-window__content {
		display: flex;
		flex: 1;
		flex-direction: column;
		min-height: 0;
	}
</style>
