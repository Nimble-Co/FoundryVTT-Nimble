<script lang="ts">
	import type { DocumentPickerProps } from '#view/rulesBuilder/types.js';

	let {
		value,
		onChange,
		disabled = false,
		documentTypes,
		placeholder = 'Drag a document here',
	}: DocumentPickerProps = $props();

	let resolvedName = $state<string | null>(null);
	let resolveError = $state<string | null>(null);
	let dragOver = $state(false);

	$effect(() => {
		if (!value) {
			resolvedName = null;
			resolveError = null;
			return;
		}
		try {
			// Cast: fromUuidSync's typed signature requires a literal `Doc.${string}`,
			// but we accept any UUID at runtime — Foundry does the document-type
			// dispatch internally and returns null for unknown types.
			const doc = fromUuidSync(value as Parameters<typeof fromUuidSync>[0]) as {
				name?: string;
				documentName?: string;
			} | null;
			if (doc) {
				resolvedName = doc.name ?? doc.documentName ?? value;
				resolveError = null;
			} else {
				resolvedName = null;
				resolveError = 'Unresolvable UUID';
			}
		} catch (err) {
			resolvedName = null;
			resolveError = err instanceof Error ? err.message : 'Unresolvable UUID';
		}
	});

	function isAcceptable(payload: { uuid: string; type?: string }): boolean {
		if (!documentTypes || documentTypes.length === 0) return true;
		const droppedType = payload.type;
		if (!droppedType) return false;

		// Foundry's drag payload only carries the top-level Document type
		// (e.g. `"Item"`), never the system subtype. For constraints like
		// `"Item.spell"` we have to resolve the document to inspect its
		// subtype field.
		let resolvedSubtype: string | null | undefined;
		const getSubtype = () => {
			if (resolvedSubtype !== undefined) return resolvedSubtype;
			try {
				const doc = fromUuidSync(payload.uuid as Parameters<typeof fromUuidSync>[0]) as {
					type?: string;
				} | null;
				resolvedSubtype = doc?.type ?? null;
			} catch {
				resolvedSubtype = null;
			}
			return resolvedSubtype;
		};

		return documentTypes.some((t) => {
			const dot = t.indexOf('.');
			if (dot === -1) return droppedType === t;
			const top = t.slice(0, dot);
			const sub = t.slice(dot + 1);
			if (droppedType !== top) return false;
			return getSubtype() === sub;
		});
	}

	function readDropPayload(event: DragEvent): { uuid: string; type?: string } | null {
		try {
			const raw = event.dataTransfer?.getData('text/plain');
			if (!raw) return null;
			const parsed = JSON.parse(raw) as { uuid?: string; type?: string };
			if (typeof parsed.uuid === 'string') return { uuid: parsed.uuid, type: parsed.type };
			return null;
		} catch {
			return null;
		}
	}

	function handleDragOver(event: DragEvent) {
		if (disabled) return;
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleDrop(event: DragEvent) {
		if (disabled) return;
		event.preventDefault();
		dragOver = false;

		const payload = readDropPayload(event);
		if (!payload) {
			resolveError = 'Drop payload was not a valid document reference';
			return;
		}
		if (!isAcceptable(payload)) {
			resolveError = `Expected ${documentTypes?.join(' or ')}, got ${payload.type ?? '<unknown>'}`;
			return;
		}
		onChange(payload.uuid);
	}

	function handleClear() {
		if (disabled) return;
		onChange('');
	}
</script>

<div
	class="nimble-document-picker"
	class:nimble-document-picker--drag-over={dragOver}
	class:nimble-document-picker--filled={Boolean(value)}
	class:nimble-document-picker--error={Boolean(resolveError)}
	class:nimble-document-picker--disabled={disabled}
	role="region"
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
	ondrop={handleDrop}
>
	{#if value}
		<div class="nimble-document-picker__filled">
			<i class="nimble-document-picker__icon fa-solid fa-file-lines"></i>

			<div class="nimble-document-picker__label">
				{#if resolveError}
					<span class="nimble-document-picker__error">{resolveError}</span>
					<small class="nimble-document-picker__uuid">{value}</small>
				{:else}
					<span class="nimble-document-picker__name">{resolvedName ?? value}</span>
					<small class="nimble-document-picker__uuid">{value}</small>
				{/if}
			</div>

			<button
				class="nimble-button"
				type="button"
				data-button-variant="icon"
				aria-label="Clear document"
				data-tooltip="Clear"
				{disabled}
				onclick={handleClear}
			>
				<i class="fa-solid fa-xmark"></i>
			</button>
		</div>
	{:else}
		<div class="nimble-document-picker__empty">
			<i class="nimble-document-picker__icon fa-solid fa-arrow-down-to-bracket"></i>
			<span>{placeholder}</span>
		</div>
	{/if}
</div>

<style lang="scss">
	.nimble-document-picker {
		display: flex;
		min-height: 2.25rem;
		padding: 0.375rem 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px dashed var(--nimble-accent-color);
		border-radius: 4px;
		transition: var(--nimble-standard-transition);

		&--drag-over {
			border-style: solid;
			background: var(--nimble-selected-tag-background-color);
		}

		&--filled {
			border-style: solid;
		}

		&--error {
			border-color: var(--color-level-error, crimson);
		}

		&--disabled {
			opacity: 0.6;
			pointer-events: none;
		}

		&__filled {
			display: flex;
			gap: 0.5rem;
			align-items: center;
			width: 100%;
		}

		&__empty {
			display: flex;
			gap: 0.5rem;
			justify-content: center;
			align-items: center;
			width: 100%;
			color: var(--color-text-dark-secondary, inherit);
			font-size: var(--nimble-sm-text);
		}

		&__label {
			display: flex;
			flex-direction: column;
			flex-grow: 1;
			min-width: 0;
		}

		&__name {
			font-weight: 600;
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&__uuid {
			font-family: var(--nimble-font-monospace, monospace);
			font-size: var(--nimble-xs-text);
			color: var(--color-text-dark-secondary);
			overflow: hidden;
			text-overflow: ellipsis;
			white-space: nowrap;
		}

		&__error {
			color: var(--color-level-error, crimson);
			font-weight: 600;
		}

		&__icon {
			color: var(--nimble-accent-color);
		}
	}
</style>
