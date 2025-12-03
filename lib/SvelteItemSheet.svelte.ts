import type { AnyObject, EmptyObject } from 'fvtt-types/utils';

import { SvelteDocumentSheet } from './SvelteDocumentSheet.svelte.js';

class SvelteItemSheet<
	D extends Item = Item,
	RenderContext extends AnyObject = EmptyObject,
	Configuration extends SvelteItemSheet.Configuration<D> = SvelteItemSheet.Configuration<D>,
	RenderOptions extends SvelteItemSheet.RenderOptions = SvelteItemSheet.RenderOptions,
> extends SvelteDocumentSheet<D, RenderContext, Configuration, RenderOptions> {
	static override DEFAULT_OPTIONS = {
		position: {
			width: 480,
		},
	};

	get item(): D {
		return this.document;
	}

	/**
	 * The Actor instance which owns this Item, if any.
	 */
	get actor(): Actor | null {
		return this.document.actor;
	}
}

declare namespace SvelteItemSheet {
	export interface Configuration<
		Document extends foundry.abstract.Document.Any = foundry.abstract.Document.Any,
	> extends foundry.applications.api.DocumentSheetV2.Configuration<Document> {}

	export interface RenderOptions extends foundry.applications.api.DocumentSheetV2.RenderOptions {}
}

export { SvelteItemSheet };
