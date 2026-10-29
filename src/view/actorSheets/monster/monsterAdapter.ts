import { createSubscriber } from 'svelte/reactivity';
import type { NimbleBaseActor } from '#documents/actor/base.svelte.js';
import { SYSTEM_ID, systemHookName } from '#system';
import { getPools, getPoolsForItem } from '#utils/chargePool/chargePoolSync.js';
import localize from '#utils/localize.js';
import prepareActorConditions from '#view/dataPreparationHelpers/prepareActorConditions.js';
import {
	buildCreditHtml,
	IMPORT_CREDIT_FLAG,
	type ImportCredit,
} from '../../../import/importCredit.js';
import {
	conditionLike,
	EFFECT_HOOKS,
	type EffectDocument,
	effectLike,
	itemLike,
	registerRedrawHooks,
} from '../shared/documentLikes.ts';
import { recoveryOf } from '../shared/poolRecovery.ts';
import type {
	MonsterActorLike,
	MonsterItemPool,
	MonsterSheetContext,
	MonsterSource,
	MonsterType,
} from './monsterSource.ts';

const REDRAW_HOOKS = [
	systemHookName('chargePool.changed'),
	systemHookName('chargePool.recovered'),
	...EFFECT_HOOKS,
];

type AnyRecord = Record<string, unknown>;

/** The NPC, solo monster or minion document that the sheet shows. */
export type MonsterDocument = NimbleBaseActor & { type: MonsterType };

function strings(values: unknown): string[] {
	return [...((values as Iterable<string> | undefined) ?? [])];
}

function actorLike(actor: MonsterDocument): MonsterActorLike {
	const source = actor.reactive;
	const system = source.system as unknown as AnyRecord & {
		savingThrows: Record<string, { mod?: number; defaultRollMode?: number }>;
		attributes: AnyRecord & { hp: MonsterActorLike['system']['attributes']['hp'] };
		details: AnyRecord;
	};
	const { attributes, details } = system;
	const flags = (source.flags as AnyRecord)[SYSTEM_ID] as AnyRecord | undefined;
	return {
		id: source.id ?? '',
		name: source.name ?? '',
		img: source.img ?? '',
		type: source.type as MonsterType,
		system: {
			savingThrows: Object.fromEntries(
				Object.entries(system.savingThrows ?? {}).map(([key, save]) => [
					key,
					{ mod: save?.mod ?? 0, defaultRollMode: save?.defaultRollMode ?? 0 },
				]),
			),
			attributes: {
				hp: { ...attributes.hp },
				armor: String(attributes.armor ?? 'none'),
				movement: { ...(attributes.movement as Record<string, number>) },
				sizeCategory: String(attributes.sizeCategory ?? 'medium'),
				damageResistances: strings(attributes.damageResistances),
				damageImmunities: strings(attributes.damageImmunities),
				damageVulnerabilities: strings(attributes.damageVulnerabilities),
			},
			conditionImmunities: strings(system.conditionImmunities),
			details: {
				level: String(details.level ?? '1'),
				creatureType: String(details.creatureType ?? ''),
				isFlunky: details.isFlunky === true,
			},
			description: String(system.description ?? ''),
			currency: { ...(system.currency as Record<string, number>) },
		},
		flags: {
			actorImageXOffset: Number(flags?.actorImageXOffset ?? 0),
			actorImageYOffset: Number(flags?.actorImageYOffset ?? 0),
			actorImageScale: Number(flags?.actorImageScale ?? 100),
			automaticallyExecuteAvailableMacros: flags?.automaticallyExecuteAvailableMacros !== false,
		},
		items: source.items.map((item) => ({
			...itemLike(item, actor as unknown as Parameters<typeof itemLike>[1]),
			sort: (item as unknown as { sort?: number }).sort ?? 0,
		})),
		// item effects live on their item, so `actor.effects` alone would leave them out
		effects: [...actor.allApplicableEffects()].map((effect) =>
			effectLike(effect as EffectDocument),
		),
	};
}

function itemPools(actor: MonsterDocument): Record<string, MonsterItemPool[]> {
	const document = actor as unknown as Actor.Implementation;
	const all = getPools(document);
	const byItem: Record<string, MonsterItemPool[]> = {};
	for (const item of actor.items) {
		const pools = getPoolsForItem(document, item.id ?? '', all).map((pool) => ({
			current: pool.current,
			max: pool.max,
			per: recoveryOf((pool.recoveries ?? []).map((entry) => entry.trigger)),
		}));
		if (pools.length) byItem[item.id ?? ''] = pools;
	}
	return byItem;
}

function localizeAll(keys: Record<string, string> | undefined): Record<string, string> {
	return Object.fromEntries(Object.entries(keys ?? {}).map(([key, name]) => [key, localize(name)]));
}

function isEditable(actor: MonsterDocument): boolean {
	if ((actor as unknown as { pack?: string | null }).pack) return false;
	return actor.canUserModify?.(game.user as User.Implementation, 'update') ?? true;
}

export interface MonsterSourceExtras {
	/** the notes, enriched by the Application (enrichment is async) */
	enrichedNotes: () => string;
	/** the descriptions of the items that show their text, enriched by the Application */
	enrichedDescriptions: () => Record<string, string>;
}

/** Builds the plain view-model input of the NPC sheet from `actor.reactive`. */
export function createMonsterSource(actor: MonsterDocument, extras: MonsterSourceExtras) {
	const subscribe = createSubscriber((update) => registerRedrawHooks(REDRAW_HOOKS, update));
	const config = CONFIG.NIMBLE as unknown as Record<string, Record<string, string>>;

	return (): MonsterSource => {
		subscribe();
		const monster = actorLike(actor);
		const flags = (actor.reactive.flags as AnyRecord)[SYSTEM_ID] as AnyRecord | undefined;
		const context: MonsterSheetContext = {
			localize: (key) => localize(key),
			format: (key, data) => localize(key, data),
			editable: isEditable(actor),
			labels: {
				conditions: localizeAll(config.conditions),
				damageTypes: localizeAll(config.damageTypes),
				sizes: localizeAll(config.sizeCategories),
			},
			conditions: prepareActorConditions(actor as unknown as Actor.Implementation, {
				includeInactive: true,
			}).map(conditionLike),
			itemPools: itemPools(actor),
			enrichedNotes: extras.enrichedNotes(),
			enrichedDescriptions: extras.enrichedDescriptions(),
			importCredit: buildCreditHtml(flags?.[IMPORT_CREDIT_FLAG] as ImportCredit | undefined),
		};
		return { actor: monster, context };
	};
}
