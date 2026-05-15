<script lang="ts">
	import { onMount } from 'svelte';

	import localize from '#utils/localize.js';
	import { createRichTextEditorState } from '#view/rulesBuilder/components/RichTextEditorState.svelte.js';
	import type { RichTextEditorProps } from '#view/rulesBuilder/types.js';

	let { value, onChange, disabled = false, document }: RichTextEditorProps = $props();

	let containerElem: HTMLElement | undefined = $state();
	let mountPoint: HTMLElement | undefined = $state();

	const editor = createRichTextEditorState(
		() => value,
		() => onChange,
		() => disabled,
		() => document,
		() => containerElem,
		() => mountPoint,
	);

	editor.setupSnapshotEffect();

	onMount(() => {
		let dispose: (() => void) | undefined;
		void editor.mount().then((d) => (dispose = d));
		return () => dispose?.();
	});
</script>

<div
	bind:this={containerElem}
	class="nimble-rich-text-editor"
	class:nimble-rich-text-editor--disabled={disabled}
>
	<div bind:this={mountPoint} class="nimble-rich-text-editor__mount"></div>

	{#if editor.isEditorActive}
		<div class="nimble-rich-text-editor__save-bar">
			<button
				type="button"
				class="nimble-button"
				data-button-variant="basic"
				onclick={editor.saveEditor}
				disabled={editor.isSaveDisabled}
			>
				<i class="fa-solid fa-save"></i>
				{localize('NIMBLE.rulesBuilder.save')}
			</button>
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-rich-text-editor {
		position: relative;
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

		:global(prose-mirror) {
			display: block;
			min-height: 5.5rem;
		}

		:global(prose-mirror .editor-container) {
			display: flex;
			flex-direction: column;
			min-height: 5.5rem;
		}

		// Closed/preview state: prose-mirror renders the enriched HTML directly
		// as a child of <prose-mirror> when not in edit mode. Make sure it shows.
		:global(prose-mirror:not(.active)) {
			padding: 0.25rem 0.375rem;
			color: inherit;
			cursor: text;
		}

		:global(.editor-content) {
			flex: 1;
			min-height: 4rem;
			padding: 0.25rem 0.375rem;
			overflow-y: auto;
			color: inherit;
			cursor: text;
		}

		:global(.editor-menu) {
			flex-shrink: 0;
		}

		&__save-bar {
			display: flex;
			justify-content: flex-end;
			padding-top: 0.25rem;
		}
	}
</style>
