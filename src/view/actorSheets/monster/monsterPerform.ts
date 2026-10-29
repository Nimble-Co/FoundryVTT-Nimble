import { SYSTEM_ID } from '#system';
import { endEffect, removeEffect, setCondition } from '../shared/effectActions.ts';
import type { MonsterDocument } from './monsterAdapter.ts';
import type { MonsterIntent, MonsterPerform, MonsterSortUpdate } from './monsterIntent.ts';

/** What `perform` needs from the Application. */
export interface MonsterPerformSheet {
	dropItem(data: Record<string, unknown>): Promise<void>;
}

function sortUpdate(update: MonsterSortUpdate): Record<string, unknown> {
	const data: Record<string, unknown> = { _id: update.itemId, sort: update.sort };
	if (update.parentItemId !== undefined) data['system.parentItemId'] = update.parentItemId;
	return data;
}

/** The Foundry dispatcher of the NPC sheet: the only place where its intents act. */
export function createMonsterPerform(
	actor: MonsterDocument,
	sheet: MonsterPerformSheet,
): MonsterPerform {
	const document = actor as unknown as Actor.Implementation;
	return async (intent: MonsterIntent): Promise<void> => {
		switch (intent.kind) {
			case 'setHp':
				await actor.setCurrentHP(intent.value);
				return;
			case 'setTempHp':
				await actor.setTempHP(intent.value);
				return;
			case 'rollSave':
				await actor.rollSavingThrowToChat(intent.save);
				return;
			case 'activate':
				await actor.activateItem(intent.itemId);
				return;
			case 'openItem':
				await actor.items.get(intent.itemId)?.sheet?.render(true);
				return;
			case 'reorder':
				await actor.updateEmbeddedDocuments('Item', intent.updates.map(sortUpdate) as never);
				return;
			case 'dropItem':
				await sheet.dropItem(intent.data);
				return;
			case 'endEffect':
				await endEffect(document, intent.effectId);
				return;
			case 'removeEffect':
				await removeEffect(document, intent.effectId, intent.itemId);
				return;
			case 'setCondition':
				await setCondition(document, intent.conditionId, intent.active);
				return;
			case 'setFlag':
				await actor.setFlag(SYSTEM_ID as 'core', intent.flag as never, intent.value as never);
				return;
			case 'setCurrency':
				await actor.update({ [`system.currency.${intent.coin}`]: intent.value } as Record<
					string,
					unknown
				>);
				return;
			default: {
				const unknown: never = intent;
				throw new Error(`No perform for ${JSON.stringify(unknown)}`);
			}
		}
	};
}
