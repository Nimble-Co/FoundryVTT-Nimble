<script lang="ts">
import { onMount } from 'svelte';

type EditorOptions = foundry.applications.elements.HTMLProseMirrorElement.ProseMirrorInputConfig;
type EnrichOptions = foundry.applications.ux.TextEditor.implementation.EnrichmentOptions;

interface Props {
	content: string;
	field: string;
	document: any;
	editorOptions?: EditorOptions;
	enrichOptions?: EnrichOptions;
}

let {
	content,
	field,
	document,
	editorOptions = {} as EditorOptions,
	enrichOptions = {} as EnrichOptions,
}: Props = $props();

// Build Options
editorOptions = foundry.utils.mergeObject(
	{
		name: field,
		collaborate: false,
		compact: false,
		documentUUID: document.uuid,
		editable: true,
		toggled: true,
		value: content,
	},
	editorOptions,
) as EditorOptions;

enrichOptions = foundry.utils.mergeObject(
	{
		secrets: document.isOwner || game.user?.isGM,
		rollData: document.isEmbedded ? document.actor.getRollData() : document.getRollData(),
		relativeTo: document,
	},
	enrichOptions,
) as EnrichOptions;

let proseMirrorElem: HTMLElement;

// Create Editor element and assign it
onMount(async () => {
	const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(content, enrichOptions);

	const element = foundry.applications.elements.HTMLProseMirrorElement.create(
		foundry.utils.mergeObject(editorOptions, { enriched }),
	);

	// Listen for save events from ProseMirror and update the document
	element.addEventListener('save', (event: Event) => {
		const target = event.target as any;
		if (target?._getValue) {
			const value = target._getValue();
			document.update({ [field]: value });
		}
	});

	// Properly insert the element to maintain event bubbling
	proseMirrorElem.replaceWith(element);
});
</script>

<div bind:this={proseMirrorElem} class="nimble-editor-wrapper"></div>

<style lang="scss">
.nimble-editor-wrapper {
	height: 100%;
	display: block;

	:global(prose-mirror) {
		height: 100%;
		display: block;
	}

	:global(.editor-container) {
		height: 100%;
		display: flex;
		flex-direction: column;
	}

	:global(.editor-content) {
		height: 100%;
		overflow-y: auto;
		flex: 1;
		padding-bottom: 1rem !important;
	}

	:global(.editor-menu) {
		flex-shrink: 0;
	}
}
</style>
