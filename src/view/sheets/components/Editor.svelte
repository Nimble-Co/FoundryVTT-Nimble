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
		height: 200,
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

	proseMirrorElem.outerHTML = element.outerHTML;
});
</script>

<div bind:this={proseMirrorElem}></div>

<style lang="scss">
</style>
