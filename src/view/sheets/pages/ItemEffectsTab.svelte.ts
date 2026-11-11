import localize from '#utils/localize.js';
import { deleteItemEffect } from '#utils/treeManipulation/deleteItemEffect.js';
import { itemEffectList } from '#utils/treeManipulation/itemEffectUsers.js';
import { NIMBLE_EFFECT_TYPE } from '../../../models/activeEffect/nimbleEffectChoices.js';
import { watchItemEffects } from '../../dataPreparationHelpers/watchItemEffects.js';
import { itemEffectsTabRows } from './itemEffectsTabRows.js';

const WORDS = 'NIMBLE.itemEffectsTab';

interface SheetEffect {
	id: string | null;
	sheet?: { render(force: boolean): unknown } | null;
}

export interface ItemEffectsTabItem {
	uuid?: string | null;
	name?: string | null;
	img?: string | null;
	system?: unknown;
	effects?: unknown;
	/** reading it makes the read redraw on an update of the item */
	readonly reactive: ItemEffectsTabItem;
	update(data: Record<string, unknown>): Promise<unknown>;
	createEmbeddedDocuments(type: 'ActiveEffect', data: object[]): Promise<unknown>;
	deleteEmbeddedDocuments(type: 'ActiveEffect', ids: string[]): Promise<unknown>;
}

function confirmContent(name: string, users: string[]): string {
	const escapeHtml = foundry.utils.escapeHTML;
	const lines = [localize(`${WORDS}.confirm.message`, { name: escapeHtml(name) })];
	if (users.length) {
		lines.push(localize(`${WORDS}.confirm.users`, { users: escapeHtml(users.join(', ')) }));
	}
	return lines.map((line) => `<p>${line}</p>`).join('');
}

export function createItemEffectsTabState(getItem: () => ItemEffectsTabItem) {
	const subscribe = watchItemEffects(getItem);

	const rows = $derived.by(() => {
		subscribe();
		return itemEffectsTabRows(getItem().reactive);
	});
	const given = $derived(rows.filter((row) => !row.transfer));
	const alwaysOn = $derived(rows.filter((row) => row.transfer));

	function effectOf(id: string): SheetEffect | undefined {
		return itemEffectList<SheetEffect>(getItem()).find((effect) => effect.id === id);
	}

	async function create(transfer: boolean) {
		const item = getItem();
		const [created] =
			((await item.createEmbeddedDocuments('ActiveEffect', [
				{ name: item.name, img: item.img, type: NIMBLE_EFFECT_TYPE, transfer },
			])) as SheetEffect[] | undefined) ?? [];
		created?.sheet?.render(true);
	}

	function edit(id: string) {
		effectOf(id)?.sheet?.render(true);
	}

	async function remove(id: string) {
		const row = rows.find((entry) => entry.id === id);
		if (!row) return;
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: localize(`${WORDS}.confirm.title`, { name: row.name }) },
			content: confirmContent(row.name, row.users),
			rejectClose: false,
		});
		if (confirmed !== true) return;
		await deleteItemEffect(getItem(), id);
	}

	return {
		get given() {
			return given;
		},
		get alwaysOn() {
			return alwaysOn;
		},
		create,
		edit,
		remove,
	};
}
