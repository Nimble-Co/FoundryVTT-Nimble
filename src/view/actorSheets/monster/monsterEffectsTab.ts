import { type EffectsTabView, effectsTab } from '../shared/effectsTab.ts';
import type { MonsterActorLike, MonsterSheetContext } from './monsterSource.ts';

/** Active effects, the conditions on the monster and the passive effects; under them, every condition. */
export function monsterEffectsTab(
	actor: MonsterActorLike,
	context: MonsterSheetContext,
): EffectsTabView {
	return effectsTab({
		effects: actor.effects,
		items: actor.items,
		conditions: context.conditions,
		conditionLabels: context.labels.conditions,
		localize: context.localize,
		format: context.format,
		conditionsOnLabel: context.localize('NIMBLE.actorSheet.monster.effects.conditionsOn'),
	});
}
