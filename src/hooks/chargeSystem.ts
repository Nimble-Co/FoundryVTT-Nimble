import {
	consumeOnResolvedItemUse,
	validateItemChargeConsumption,
} from '#utils/chargePool/chargePoolConsume.js';
import { applyEncounterRecovery, applyRestRecovery } from '#utils/chargePool/chargePoolRecover.js';
import { isChargePoolFlagUpdate, syncActorPools } from '#utils/chargePool/chargePoolSync.js';
import { ChargePoolRuleConfig } from '#utils/chargePoolRuleConfig.js';
import localize from '#utils/localize.js';

type HookFn = (...args: unknown[]) => unknown;
type SupportedRestType = (typeof ChargePoolRuleConfig.restTypes)[number];

type ItemUseContext = {
	isMiss?: boolean;
	isCritical?: boolean;
};

type RestContext = {
	restType?: SupportedRestType;
};

type ChargeValidationFailure = NonNullable<
	ReturnType<typeof validateItemChargeConsumption>['failure']
>;

function toCharacterItem(item: unknown): Item.Implementation | null {
	if (!item || typeof item !== 'object') return null;
	const typedItem = item as Item.Implementation;
	if (!typedItem.actor || typedItem.actor.type !== 'character') return null;
	return typedItem;
}

function toCharacterActor(actor: unknown): Actor.Implementation | null {
	if (!actor || typeof actor !== 'object') return null;
	const typedActor = actor as Actor.Implementation;
	if (typedActor.type !== 'character') return null;
	return typedActor;
}

function isSupportedRestType(restType: unknown): restType is SupportedRestType {
	return restType === 'safe' || restType === 'field';
}

function toItemUseContext(context: unknown): ItemUseContext {
	if (!context || typeof context !== 'object') return {};
	const sourceContext = context as Record<string, unknown>;

	return {
		isMiss: sourceContext.isMiss === true,
		isCritical: sourceContext.isCritical === true,
	};
}

function toRestContext(context: unknown): RestContext {
	if (!context || typeof context !== 'object') return {};
	const sourceContext = context as Record<string, unknown>;
	if (!isSupportedRestType(sourceContext.restType)) return {};

	return {
		restType: sourceContext.restType,
	};
}

function registerCustomHook(eventName: string, fn: HookFn): void {
	(Hooks.on as (event: string, fn: HookFn) => number)(eventName, fn);
}

function notifyChargeFailure(itemName: string, failure: ChargeValidationFailure): void {
	if (failure.code === 'poolMissing') {
		ui.notifications?.error(
			localize('NIMBLE.charges.notifications.poolMissing', {
				item: itemName,
				pool: failure.poolLabel,
			}),
		);
		return;
	}

	ui.notifications?.error(
		localize('NIMBLE.charges.notifications.insufficient', {
			item: itemName,
			pool: failure.poolLabel,
			required: String(failure.required),
			available: String(failure.available),
		}),
	);
}

async function syncItemActorPools(item: Item.Implementation | null | undefined): Promise<void> {
	if (!item?.actor || item.actor.type !== 'character') return;
	await syncActorPools(item.actor);
}

function registerItemSyncHooks(): void {
	Hooks.on('createItem', (item: Item.Implementation) => {
		void syncItemActorPools(item);
	});

	Hooks.on('updateItem', (item: Item.Implementation, _changes, options) => {
		if (isChargePoolFlagUpdate(options)) return;
		void syncItemActorPools(item);
	});

	Hooks.on('deleteItem', (item: Item.Implementation) => {
		void syncItemActorPools(item);
	});
}

function registerActorSyncHooks(): void {
	Hooks.on('updateActor', (actor: Actor.Implementation, changes, options) => {
		if (isChargePoolFlagUpdate(options)) return;
		if (actor.type !== 'character') return;
		if (foundry.utils.hasProperty(changes, ChargePoolRuleConfig.flagPath)) return;

		void syncActorPools(actor);
	});
}

function registerItemUseHooks(): void {
	registerCustomHook('nimble.preUseItem', (item) => {
		const characterItem = toCharacterItem(item);
		if (!characterItem) return true;

		const validation = validateItemChargeConsumption(characterItem);
		if (validation.ok) return true;
		const failure = validation.failure;
		if (!failure) return false;

		notifyChargeFailure(characterItem.name, failure);
		return false;
	});

	registerCustomHook('nimble.useItem', (item, chatMessage, context) => {
		const characterItem = toCharacterItem(item);
		if (!characterItem) return;
		const itemUseContext = toItemUseContext(context);
		const typedChatMessage = chatMessage as {
			update?(data: Record<string, unknown>): Promise<unknown>;
		} | null;

		void consumeOnResolvedItemUse(characterItem, itemUseContext).then(async (validation) => {
			if (validation.consumption && validation.consumption.length > 0 && typedChatMessage?.update) {
				await typedChatMessage.update({
					'flags.nimble.chargeConsumption': validation.consumption,
				} as Record<string, unknown>);
			}

			if (validation.ok) return;
			const failure = validation.failure;
			if (!failure) return;
			notifyChargeFailure(characterItem.name, failure);
		});
	});
}

function registerRestHooks(): void {
	registerCustomHook('nimble.restCompleted', (actor, context) => {
		const characterActor = toCharacterActor(actor);
		if (!characterActor) return;
		const restContext = toRestContext(context);
		if (!restContext.restType) return;

		void applyRestRecovery(characterActor, restContext.restType);
	});
}

const encounterEndRecoveredCombatIds = new Set<string>();

function getCombatIdentifier(combat: Combat): string | null {
	if (!combat.id || typeof combat.id !== 'string') return null;
	const combatId = combat.id.trim();
	return combatId.length > 0 ? combatId : null;
}

function applyEncounterRecoveryToCombatants(
	combat: Combat,
	encounterTrigger: 'encounterStart' | 'encounterEnd',
): void {
	for (const combatant of combat.combatants.contents) {
		const actor = combatant.actor;
		if (!actor || actor.type !== 'character') continue;
		void applyEncounterRecovery(actor, encounterTrigger);
	}
}

function didEncounterEndTransition(changes: Record<string, unknown>): boolean {
	if (!foundry.utils.hasProperty(changes, 'started')) return false;
	return foundry.utils.getProperty(changes, 'started') === false;
}

function registerEncounterHooks(): void {
	Hooks.on('combatStart', () => {
		const combat = game.combat;
		if (!combat) return;
		const combatId = getCombatIdentifier(combat);
		if (combatId) encounterEndRecoveredCombatIds.delete(combatId);
		applyEncounterRecoveryToCombatants(combat, 'encounterStart');
	});

	Hooks.on('deleteCombat', (combat: Combat) => {
		const combatId = getCombatIdentifier(combat);
		const alreadyRecovered = combatId ? encounterEndRecoveredCombatIds.has(combatId) : false;
		if (!alreadyRecovered) {
			applyEncounterRecoveryToCombatants(combat, 'encounterEnd');
		}
		if (combatId) encounterEndRecoveredCombatIds.delete(combatId);
	});

	Hooks.on('updateCombat', (combat: Combat, changes: Record<string, unknown>) => {
		if (!didEncounterEndTransition(changes)) return;
		const isEnded = combat.started === false;
		if (!isEnded) return;
		if (combat.combatants.size === 0) return;
		const combatId = getCombatIdentifier(combat);
		if (combatId && encounterEndRecoveredCombatIds.has(combatId)) return;
		if (combatId) encounterEndRecoveredCombatIds.add(combatId);

		applyEncounterRecoveryToCombatants(combat, 'encounterEnd');
	});
}

export default function registerChargeSystemHooks(): void {
	registerItemSyncHooks();
	registerActorSyncHooks();
	registerItemUseHooks();
	registerRestHooks();
	registerEncounterHooks();
}
