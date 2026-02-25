/**
 * Register a compendium entry context menu option to convert 5e actors to Nimble.
 * GM-only.
 */

import Dnd5eImportDialog from '../import/dnd5e/Dnd5eImportDialog.svelte.js';
import type { Dnd5eActorJson } from '../import/dnd5e/types.js';

type ContextMenuHookFn = (_html: unknown, entries: ContextMenu.Entry<JQuery>[]) => void;

export function registerDnd5eContextMenu(): void {
	(Hooks.on as (event: string, fn: ContextMenuHookFn) => number)(
		'getCompendiumEntryContext',
		(_html, entries) => {
			entries.push({
				name: 'NIMBLE.dnd5eImport.convertToNimble',
				icon: '<i class="fa-solid fa-dragon"></i>',
				condition: () => game.user?.isGM ?? false,
				callback: async (li: JQuery) => {
					const entryId = li.data('entryId') ?? li.data('documentId') ?? li.attr('data-entry-id');
					const packId = li.closest('[data-pack]')?.data('pack');
					if (!packId || !entryId) return;

					const pack = game.packs?.get(packId);
					if (!pack) return;

					const doc = await pack.getDocument(entryId);
					if (!doc) return;

					const preloadData = (doc as { toObject(): Dnd5eActorJson }).toObject();
					const dialog = new Dnd5eImportDialog({ preloadData });
					dialog.render(true);
				},
			});
		},
	);
}
