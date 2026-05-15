import { tick } from 'svelte';

import type { NimbleBaseItem } from '#documents/item/base.svelte.js';

type EditorOptions = foundry.applications.elements.HTMLProseMirrorElement.ProseMirrorInputConfig;
type EnrichOptions = Parameters<
	typeof foundry.applications.ux.TextEditor.implementation.enrichHTML
>[1];

interface ProseMirrorElement extends HTMLElement {
	_getValue?(): string;
	_refresh?(): void;
}

export function createRichTextEditorState(
	getValue: () => string,
	getOnChange: () => (next: string) => void,
	getDisabled: () => boolean,
	getDocument: () => NimbleBaseItem | undefined,
	getContainer: () => HTMLElement | undefined,
	getMountPoint: () => HTMLElement | undefined,
) {
	let isEditorActive = $state(false);
	let snapshotOnOpen = $state<string | null>(null);
	let currentEditorContent = $state<string>('');

	const isSaveDisabled = $derived(
		snapshotOnOpen === null || currentEditorContent === snapshotOnOpen,
	);

	function findProseMirror(): ProseMirrorElement | null {
		return (getContainer()?.querySelector('prose-mirror') as unknown as ProseMirrorElement) ?? null;
	}

	function saveEditor() {
		const proseMirror = findProseMirror();
		if (!proseMirror?._getValue) return;
		const next = proseMirror._getValue();
		getOnChange()(next);
		proseMirror.dispatchEvent(new Event('save', { bubbles: true }));
		proseMirror.classList.remove('active');
		proseMirror._refresh?.();
	}

	function setupSnapshotEffect(): void {
		$effect(() => {
			if (isEditorActive && snapshotOnOpen === null) {
				void tick().then(() => {
					const proseMirror = findProseMirror();
					if (proseMirror?._getValue) {
						const v = proseMirror._getValue();
						snapshotOnOpen = v;
						currentEditorContent = v;
					}
					const root = proseMirror?.shadowRoot ?? proseMirror;
					const editable =
						root?.querySelector<HTMLElement>('[contenteditable="true"]') ??
						root?.querySelector<HTMLElement>('.editor-content');
					editable?.focus();
				});
			} else if (!isEditorActive) {
				snapshotOnOpen = null;
			}
		});
	}

	async function mount(): Promise<() => void> {
		const document = getDocument();
		const enrichOptions: EnrichOptions = {
			secrets: Boolean(document?.isOwner || game.user?.isGM),
			rollData: document
				? document.isEmbedded && document.actor
					? document.actor.getRollData()
					: document.getRollData()
				: {},
			relativeTo: document,
		} as EnrichOptions;

		const enriched = await foundry.applications.ux.TextEditor.implementation.enrichHTML(
			getValue() ?? '',
			enrichOptions,
		);

		const options = {
			name: 'rule-rich-text',
			value: getValue() ?? '',
			collaborate: false,
			compact: true,
			documentUUID: document?.uuid,
			editable: !getDisabled(),
			toggled: true,
			enriched,
		} as unknown as EditorOptions;

		const element = foundry.applications.elements.HTMLProseMirrorElement.create(
			options,
		) as unknown as ProseMirrorElement;

		element.addEventListener('save', () => {
			if (element._getValue) getOnChange()(element._getValue());
		});

		element.addEventListener('input', () => {
			if (element._getValue) currentEditorContent = element._getValue();
		});

		const mountPoint = getMountPoint();
		mountPoint?.replaceWith(element);

		const observer = new MutationObserver(() => {
			isEditorActive = element.classList.contains('active');
		});
		observer.observe(element, { attributes: true, attributeFilter: ['class'] });
		return () => observer.disconnect();
	}

	return {
		get isEditorActive() {
			return isEditorActive;
		},
		get isSaveDisabled() {
			return isSaveDisabled;
		},
		setupSnapshotEffect,
		mount,
		saveEditor,
	};
}
