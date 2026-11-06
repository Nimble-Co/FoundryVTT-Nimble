import localize from '#utils/localize.js';
import { isSheetIntent } from '../shared/sheetIntent.ts';
import { performSheetIntent } from '../shared/sheetPerform.ts';
import type { MonsterDocument } from './monsterAdapter.ts';
import type {
	MonsterConfigureTarget,
	MonsterIntent,
	MonsterPerform,
	MonsterSortUpdate,
} from './monsterIntent.ts';

function configure(actor: MonsterDocument, target: MonsterConfigureTarget): Promise<unknown> {
	switch (target) {
		case 'metadata':
			return actor.editMetadata();
		case 'saves':
			return actor.configureSavingThrows();
		case 'movement':
			return actor.configureMovement();
		default: {
			const unknown: never = target;
			throw new Error(`No configure window for ${String(unknown)}`);
		}
	}
}

function sortUpdate(update: MonsterSortUpdate): Record<string, unknown> {
	const data: Record<string, unknown> = { _id: update.itemId, sort: update.sort };
	if (update.parentItemId !== undefined) data['system.parentItemId'] = update.parentItemId;
	return data;
}

/** The Foundry dispatcher of the NPC sheet: the only place where its intents act. */
export function createMonsterPerform(actor: MonsterDocument): MonsterPerform {
	return async (intent: MonsterIntent): Promise<void> => {
		if (isSheetIntent(intent)) {
			await performSheetIntent(actor, intent);
			return;
		}
		switch (intent.kind) {
			case 'setMaxHp':
				await actor.setMaxHP(intent.value);
				return;
			case 'setArmor':
				await actor.update({ 'system.attributes.armor': intent.armor } as Record<string, unknown>);
				return;
			case 'configure':
				await configure(actor, intent.target);
				return;
			case 'createFeature':
				await actor.createItem({
					name: localize('NIMBLE.actorSheet.monster.abilities.newFeature'),
					type: 'monsterFeature',
				} as Item.CreateData);
				return;
			case 'reorder':
				await actor.updateEmbeddedDocuments('Item', intent.updates.map(sortUpdate) as never);
				return;
			default: {
				const unknown: never = intent;
				throw new Error(`No perform for ${JSON.stringify(unknown)}`);
			}
		}
	};
}
