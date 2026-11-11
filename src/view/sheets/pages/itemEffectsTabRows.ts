import localize from '#utils/localize.js';
import {
	type ItemEffectUser,
	itemEffectList,
	itemEffectUsers,
	type UserItem,
} from '#utils/treeManipulation/itemEffectUsers.js';
import { itemEffectLastsUntil } from '../../dataPreparationHelpers/itemEffectLastsUntil.js';

const WORDS = 'NIMBLE.itemEffectsTab';
const DEFAULT_IMG = 'icons/svg/aura.svg';

export interface TabEffect {
	id: string | null;
	name?: string | null;
	img?: string | null;
	transfer?: boolean;
	system?: unknown;
}

export interface ItemEffectRow {
	id: string;
	name: string;
	img: string;
	transfer: boolean;
	lasts: string;
	/** "On use: Apply Effect", "Rule: Mark Target", one entry per different user */
	users: string[];
	/** "Used by: ..." or "Nothing uses this effect." */
	usedByLine: string;
}

function userLabel(user: ItemEffectUser): string {
	if (user.kind === 'node') return localize(`${WORDS}.usedBy.onUse`);
	const ruleTypes = CONFIG.NIMBLE.ruleTypes as Record<string, string | undefined>;
	const type = user.rule.type ?? '';
	const name = user.rule.label || localize(ruleTypes[type] ?? type);
	return localize(`${WORDS}.usedBy.rule`, { name });
}

/** A card for "you" reads the Lasts Until for you; an effect for targets, for them. */
function readerOf(transfer: boolean, users: ItemEffectUser[]): 'self' | 'targets' {
	if (transfer) return 'self';
	const allSelf =
		users.length > 0 && users.every((user) => user.kind === 'node' && user.recipient === 'self');
	return allSelf ? 'self' : 'targets';
}

/** The rows of the item's Effects tab, by name: what each effect lasts until and what uses it. */
export function itemEffectsTabRows(item: UserItem): ItemEffectRow[] {
	return itemEffectList<TabEffect>(item)
		.filter((effect): effect is TabEffect & { id: string } => !!effect.id)
		.map((effect) => {
			const transfer = effect.transfer === true;
			const found = itemEffectUsers(item, effect.id);
			const users = [...new Set(found.map(userLabel))];
			return {
				id: effect.id,
				name: effect.name ?? '',
				img: effect.img || DEFAULT_IMG,
				transfer,
				lasts: itemEffectLastsUntil(effect, readerOf(transfer, found)),
				users,
				usedByLine: users.length
					? localize(`${WORDS}.usedBy.line`, { users: users.join(', ') })
					: localize(`${WORDS}.usedBy.nothing`),
			};
		})
		.sort((a, b) => a.name.localeCompare(b.name));
}
