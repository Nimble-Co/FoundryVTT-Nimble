<script lang="ts">
	import { onMount } from 'svelte';
	import { tick } from 'svelte';

	type EditorOptions = foundry.applications.elements.HTMLProseMirrorElement.ProseMirrorInputConfig;
	type EnrichOptions = foundry.applications.ux.TextEditor.implementation.EnrichmentOptions;

	interface ProseMirrorElement extends HTMLElement {
		_getValue?(): string;
		open?(): void;
		isDirty?(): boolean;
	}

	interface Props {
		content: string;
		field: string;
		document: foundry.abstract.Document.Any;
		editable?: boolean;
		editorOptions?: EditorOptions;
		enrichOptions?: EnrichOptions;
	}

	let {
		content,
		field,
		document,
		editable = true,
		editorOptions = {} as EditorOptions,
		enrichOptions = {} as EnrichOptions,
	}: Props = $props();

	// Check if content is empty (no text or just whitespace/empty tags)
	function isContentEmpty(html: string): boolean {
		if (!html) return true;
		// Strip HTML tags and check if there's any actual text content
		const textContent = html.replace(/<[^>]*>/g, '').trim();
		return textContent.length === 0;
	}

	let isEmpty = $derived(isContentEmpty(content));

	// Build Options - using $derived to avoid state_referenced_locally warnings
	const mergedEditorOptions = $derived(
		foundry.utils.mergeObject(
			{
				name: field,
				collaborate: false,
				compact: false,
				documentUUID: document.uuid,
				editable,
				toggled: editable,
				value: content,
			},
			editorOptions,
		) as EditorOptions,
	);

	const mergedEnrichOptions = $derived(
		foundry.utils.mergeObject(
			{
				secrets: document.isOwner || game.user?.isGM,
				rollData: document.isEmbedded ? document.actor.getRollData() : document.getRollData(),
				relativeTo: document,
			},
			enrichOptions,
		) as EnrichOptions,
	);

	let containerElem: HTMLElement;
	let proseMirrorElem: HTMLElement;
	let isEditorActive = $state(false);
	let contentWhenEditClicked = $state<string | null>(null);
	let currentEditorContent = $state<string>('');

	// Capture editor content when edit is first opened; clear when closed. Also focus the editable area.
	$effect(() => {
		if (isEditorActive && contentWhenEditClicked === null) {
			tick().then(() => {
				const proseMirror = containerElem?.querySelector(
					'prose-mirror',
				) as ProseMirrorElement | null;
				if (proseMirror && typeof proseMirror._getValue === 'function') {
					const value = proseMirror._getValue();
					contentWhenEditClicked = value;
					currentEditorContent = value;
				}
				// Auto-focus the text field when editor opens
				const root = proseMirror?.shadowRoot ?? proseMirror;
				const editable =
					root?.querySelector<HTMLElement>('[contenteditable="true"]') ??
					root?.querySelector<HTMLElement>('.editor-content');
				editable?.focus();
			});
		} else if (!isEditorActive) {
			contentWhenEditClicked = null;
		}
	});

	const isSaveDisabled = $derived(
		contentWhenEditClicked === null || currentEditorContent === contentWhenEditClicked,
	);

	function activateEditor() {
		// Click the hidden toggle button in the top right (same one that works on hover)
		const toggleButton = containerElem?.querySelector(
			'prose-mirror button.toggle',
		) as HTMLButtonElement | null;
		if (toggleButton && !toggleButton.disabled) {
			toggleButton.click();
		}
	}

	function saveEditor() {
		console.log('saveEditor');
		const proseMirror = containerElem?.querySelector('prose-mirror') as ProseMirrorElement | null;
		if (!proseMirror) return;

		// Get the current value and save it to the document
		if (typeof proseMirror._getValue === 'function') {
			console.log('proseMirror._getValue', proseMirror._getValue);
			const value = proseMirror._getValue();
			console.log('value', value);
			document.update({ [field]: value });
		}

		// Dispatch a 'save' event on the proseMirror element to trigger save handlers
		proseMirror.dispatchEvent(new Event('save', { bubbles: true }));

		// Remove active class and refresh to close the editor
		proseMirror.classList.remove('active');

		// Force a re-render by calling _refresh if available
		if (typeof (proseMirror as any)._refresh === 'function') {
			console.log('proseMirror._refresh', (proseMirror as any)._refresh);
			(proseMirror as any)._refresh();
		}
	}

	function observeEditorState() {
		// Watch for the .active class on the prose-mirror element
		const proseMirror = containerElem?.querySelector('prose-mirror');
		if (!proseMirror) return;

		const observer = new MutationObserver(() => {
			isEditorActive = proseMirror.classList.contains('active');
		});

		observer.observe(proseMirror, { attributes: true, attributeFilter: ['class'] });

		return () => observer.disconnect();
	}

	// Create Editor element and assign it
	onMount(async () => {
		const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			content,
			mergedEnrichOptions,
		);

		const element = foundry.applications.elements.HTMLProseMirrorElement.create(
			foundry.utils.mergeObject(mergedEditorOptions, { enriched }),
		);

		// Listen for save events from ProseMirror and update the document
		element.addEventListener('save', (event: Event) => {
			console.log('save event', event);
			const target = event.target as ProseMirrorElement;
			if (target?._getValue) {
				const value = target._getValue();
				document.update({ [field]: value });
			}
		});

		// Track current content so we can disable Save when unchanged
		element.addEventListener('input', () => {
			if (typeof element._getValue === 'function') {
				currentEditorContent = element._getValue();
			}
		});

		// Properly insert the element to maintain event bubbling
		proseMirrorElem.replaceWith(element);

		// Start observing editor state for active class changes
		return observeEditorState();
	});
</script>

<div
	bind:this={containerElem}
	class="nimble-editor-container"
	class:nimble-editor-container--empty={isEmpty}
>
	<div bind:this={proseMirrorElem} class="nimble-editor-wrapper"></div>

	{#if isEmpty && editable && !isEditorActive}
		<div class="nimble-editor-empty-state">
			<span class="nimble-editor-empty-state__text">No description</span>
			<button
				type="button"
				class="nimble-editor-empty-state__edit-button"
				aria-label="Edit description"
				data-tooltip="Edit description"
				onclick={activateEditor}
			>
				<i class="fa-solid fa-edit"></i>
			</button>
		</div>
	{/if}

	{#if isEditorActive}
		<div class="nimble-editor-save-bar">
			<button
				type="button"
				class="nimble-button"
				data-button-variant="basic"
				data-tooltip={isSaveDisabled ? 'No changes to save' : undefined}
				onclick={saveEditor}
				disabled={isSaveDisabled}
			>
				<i class="nimble-button__icon fa-solid fa-save"></i>
				Save
			</button>
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-editor-container {
		position: relative;
		height: 100%;
		display: block;
	}

	.nimble-editor-wrapper {
		height: 100%;
		display: block;
	}

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

	.nimble-editor-empty-state {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		pointer-events: none;
		z-index: 1;

		&__text {
			color: var(--nimble-medium-text-color, #888);
			font-size: var(--nimble-sm-text, 0.875rem);
			font-style: italic;
			opacity: 0.7;
		}

		&__edit-button {
			pointer-events: auto;
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			border-radius: 50%;
			border: 1px solid var(--nimble-border-color, rgba(0, 0, 0, 0.2));
			background: var(--nimble-button-background, rgba(0, 0, 0, 0.05));
			color: var(--nimble-medium-text-color, #666);
			cursor: pointer;
			transition: all 0.15s ease;

			&:hover {
				background: var(--nimble-button-hover-background, rgba(0, 0, 0, 0.1));
				color: var(--nimble-dark-text-color, #333);
				border-color: var(--nimble-border-color-hover, rgba(0, 0, 0, 0.3));
			}

			i {
				font-size: 0.875rem;
			}
		}
	}

	.nimble-editor-save-bar {
		position: absolute;
		bottom: 0;
		left: 0;
		right: 0;
		display: flex;
		justify-content: flex-end;
		padding: 0.5rem;
		background: linear-gradient(to top, var(--nimble-sheet-background, #f0f0f0) 60%, transparent);
		z-index: 10;

		--nimble-button-height: 32px;
		--nimble-button-padding: 2px 8px;
		--nimble-button-font-size: var(--nimble-sm-text);

		.nimble-button {
			&:disabled {
				opacity: 0.6;
				cursor: not-allowed;
			}
		}
	}
</style>
