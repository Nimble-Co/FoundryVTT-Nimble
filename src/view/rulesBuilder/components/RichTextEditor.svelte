<script lang="ts">
	import { onMount } from 'svelte';

	import type { RichTextEditorProps } from '#view/rulesBuilder/types.js';

	let { value, onChange, disabled = false, placeholder = '' }: RichTextEditorProps = $props();

	interface ProseMirrorElement extends HTMLElement {
		_getValue?(): string;
	}

	let mountPoint: HTMLElement;

	onMount(() => {
		// `editable` isn't on `ProseMirrorInputConfig`. Editability is controlled
		// at the wrapper level — when `disabled` is true, we wrap the mounted
		// editor in a class that suppresses pointer events.
		const element = foundry.applications.elements.HTMLProseMirrorElement.create({
			name: 'rule-rich-text',
			value,
			collaborate: false,
			compact: true,
			toggled: !disabled,
		}) as ProseMirrorElement;

		element.addEventListener('save', () => {
			if (typeof element._getValue === 'function') {
				onChange(element._getValue());
			}
		});

		mountPoint.replaceWith(element);
	});
</script>

<div class="nimble-rich-text-editor" class:nimble-rich-text-editor--disabled={disabled}>
	<div
		bind:this={mountPoint}
		class="nimble-rich-text-editor__mount"
		data-placeholder={placeholder}
	></div>
</div>

<style lang="scss">
	.nimble-rich-text-editor {
		min-height: 6rem;
		padding: 0.25rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-accent-color);
		border-radius: 4px;

		&--disabled {
			opacity: 0.6;
			pointer-events: none;
		}

		&__mount {
			min-height: 5.5rem;
		}
	}
</style>
