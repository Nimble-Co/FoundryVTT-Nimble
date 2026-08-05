export function createDocumentPickerState(
	getValue: () => string,
	getDocumentTypes: () => string[] | undefined,
	getOnChange: () => (next: string) => void,
	getDisabled: () => boolean,
) {
	let resolvedName = $state<string | null>(null);
	let resolveError = $state<string | null>(null);
	let dragOver = $state(false);

	function setupResolveEffect(): void {
		$effect(() => {
			const value = getValue();
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
	}

	function isAcceptable(payload: { uuid: string; type?: string }): boolean {
		const documentTypes = getDocumentTypes();
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
		if (getDisabled()) return;
		event.preventDefault();
		dragOver = true;
	}

	function handleDragLeave() {
		dragOver = false;
	}

	function handleDrop(event: DragEvent) {
		if (getDisabled()) return;
		event.preventDefault();
		dragOver = false;

		const payload = readDropPayload(event);
		if (!payload) {
			resolveError = 'Drop payload was not a valid document reference';
			return;
		}
		if (!isAcceptable(payload)) {
			resolveError = `Expected ${getDocumentTypes()?.join(' or ')}, got ${payload.type ?? '<unknown>'}`;
			return;
		}
		getOnChange()(payload.uuid);
	}

	function handleClear() {
		if (getDisabled()) return;
		getOnChange()('');
	}

	return {
		get resolvedName() {
			return resolvedName;
		},
		get resolveError() {
			return resolveError;
		},
		get dragOver() {
			return dragOver;
		},
		setupResolveEffect,
		handleDragOver,
		handleDragLeave,
		handleDrop,
		handleClear,
	};
}
