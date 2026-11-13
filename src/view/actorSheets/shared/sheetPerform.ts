import { SYSTEM_ID } from '#system';
import type { SaveKeyType } from '#types/saveKey.js';
import { adjustPool } from '#utils/chargePool/chargePoolRecover.js';
import { escapeEffect } from '#utils/lastsUntil/escapeEffect.js';
import updateDocumentImage from '#view/handlers/updateDocumentImage.js';
import { openEffect, removeEffect, setCondition } from './effectActions.ts';
import type { SheetIntent } from './sheetIntent.ts';

/** What the shared perform calls on the actor of either sheet. */
export interface SheetActor {
	setCurrentHP(value: number): Promise<unknown>;
	setTempHP(value: number): Promise<unknown>;
	update(data: Record<string, unknown>): Promise<unknown>;
	deleteItem(itemId: string): Promise<unknown>;
	rollSavingThrowToChat(save: SaveKeyType): Promise<unknown>;
	activateItem(itemId: string): Promise<unknown>;
	items: { get(id: string): { sheet?: { render(force: boolean): unknown } | null } | undefined };
	setFlag(scope: never, key: never, value: never): Promise<unknown>;
}

/** The one place where both actor sheets act on an intent they share. */
export async function performSheetIntent(actor: SheetActor, intent: SheetIntent): Promise<void> {
	const document = actor as unknown as Actor.Implementation;
	switch (intent.kind) {
		case 'setHp':
			await actor.setCurrentHP(intent.value);
			return;
		case 'setTempHp':
			await actor.setTempHP(intent.value);
			return;
		case 'rename':
			await actor.update({ name: intent.name });
			return;
		case 'changePortrait':
			await updateDocumentImage(document, { shiftKey: intent.skipTokenizer });
			return;
		case 'deleteItem':
			await actor.deleteItem(intent.itemId);
			return;
		case 'setPoolCharges':
			await adjustPool(document, intent.poolId, 'set', intent.value);
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
		case 'openEffect':
			await openEffect(document, intent.effectId, intent.itemId);
			return;
		case 'removeEffect':
			await removeEffect(document, intent.effectId, intent.itemId);
			return;
		case 'escape':
			await escapeEffect(document as never, intent.effectId);
			return;
		case 'setCondition':
			await setCondition(document, intent.conditionId, intent.active);
			return;
		case 'setFlag':
			await actor.setFlag(SYSTEM_ID as never, intent.flag as never, intent.value as never);
			return;
		case 'setCurrency':
			await actor.update({ [`system.currency.${intent.coin}`]: intent.value });
			return;
		default: {
			const unknown: never = intent;
			throw new Error(`No shared perform for ${JSON.stringify(unknown)}`);
		}
	}
}
