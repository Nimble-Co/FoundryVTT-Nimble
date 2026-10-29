import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { getPrimaryDamageFormulaFromActivationEffects } from '../../../utils/activationEffects.js';
import { getUnarmedDamageFormula } from '../../../utils/damage/attackUtils.js';
import sortItems from '../../../utils/documents/sortItems.js';
import { rollUnarmedStrike } from '../../../utils/heroicActions/unarmedStrike.js';
import localize from '../../../utils/localize.js';
import { evaluateFormula as evalFormula } from '../../../utils/rolls/evaluateFormula.js';
import { stripHtml } from '../../../utils/stripHtml.js';

/** System data for weapon items */
interface WeaponSystemData {
	objectType: string;
	activation?: {
		effects?: unknown[];
		cost?: { type: string; quantity: number };
	};
	properties?: {
		selected?: string[];
		reach?: { max?: number };
		range?: { max?: number };
		thrownRange?: number;
	};
	description?:
		| {
				public?: string;
		  }
		| string;
}

export function createAttackPanelState(
	getActor: () => NimbleCharacter,
	getOnActivateItem: () => (cost: number) => Promise<void>,
) {
	const { weaponProperties } = CONFIG.NIMBLE;
	let searchTerm = $state('');
	let expandedDescriptions = $state(new Set<string>());

	// Re-render trigger for toggleEffect switches on attack-feature rows.
	// The .svelte file subscribes to AE hooks in $effect and bumps this
	// counter; buildToggleState reads it so the switch updates from both
	// the in-panel click and external sources (PASSIVE EFFECTS panel,
	// turnOff triggers, chat-card buttons).
	let effectVersion = $state(0);
	function bumpEffectVersion(): void {
		effectVersion += 1;
	}

	// ============================================================================
	// Formula Evaluation
	// ============================================================================

	function evaluateFormula(formula: string | undefined): string {
		return evalFormula(formula, getActor());
	}

	// ============================================================================
	// Weapon Data
	// ============================================================================

	/** Helper to cast item system data */
	function getSystemData(item: Item): WeaponSystemData {
		return item.system as unknown as WeaponSystemData;
	}

	const weapons = $derived.by(() => {
		const weaponItems = getActor().reactive.items.filter(
			(item) => item.type === 'object' && getSystemData(item).objectType === 'weapon',
		);

		if (!searchTerm) return weaponItems;

		const search = searchTerm.toLocaleLowerCase();
		return weaponItems.filter((item) => {
			if (item.name.toLocaleLowerCase().includes(search)) return true;
			const desc = getSystemData(item).description;
			const text = typeof desc === 'object' ? desc?.public : desc;
			return typeof text === 'string' && stripHtml(text).toLocaleLowerCase().includes(search);
		});
	});

	const showUnarmedStrike = $derived(
		!searchTerm || 'unarmed strike'.includes(searchTerm.toLocaleLowerCase()),
	);

	const attackFeatures = $derived.by(() => {
		const features = getActor().reactive.items.filter((item) => {
			if (item.type !== 'feature') return false;

			const system = getSystemData(item);
			const activation = system.activation;
			if (!activation) return false;

			return activation.cost?.type === 'action';
		});

		if (!searchTerm) return features;

		const search = searchTerm.toLocaleLowerCase();
		return features.filter((item) => {
			if (item.name.toLocaleLowerCase().includes(search)) return true;
			const desc = getSystemData(item).description;
			const text = typeof desc === 'object' ? desc?.public : desc;
			return typeof text === 'string' && stripHtml(text).toLocaleLowerCase().includes(search);
		});
	});

	function getWeaponDamage(item: Item): string {
		const system = getSystemData(item);
		const effects = system.activation?.effects;
		const formula = getPrimaryDamageFormulaFromActivationEffects(effects);
		return evaluateFormula(formula ?? undefined);
	}

	function getWeaponProperties(item: Item): string[] {
		const props = getSystemData(item).properties ?? {};
		const selected = props.selected ?? [];

		return selected
			.map((key: string) => {
				const localeKey = weaponProperties[key];
				const label = localeKey ? game.i18n.localize(localeKey) : key;

				if (key === 'thrown' && props.thrownRange) {
					return localize('NIMBLE.ui.heroicActions.thrown', {
						distance: String(props.thrownRange),
					});
				}
				if (key === 'range' && props.range?.max) {
					return localize('NIMBLE.npcSheet.range', { distance: String(props.range.max) });
				}
				if (key === 'reach' && props.reach?.max) {
					return localize('NIMBLE.npcSheet.reach', { distance: String(props.reach.max) });
				}

				return label;
			})
			.filter(Boolean);
	}

	function getItemDescription(item: Item): string {
		const descData = getSystemData(item).description;
		if (!descData) return '';

		const desc = typeof descData === 'object' ? descData.public : descData;

		if (!desc || typeof desc !== 'string') return '';

		const stripped = stripHtml(desc).trim();
		return stripped ? desc : '';
	}

	function toggleDescription(itemId: string, event: Event): void {
		event.stopPropagation();
		const newSet = new Set(expandedDescriptions);
		if (newSet.has(itemId)) {
			newSet.delete(itemId);
		} else {
			newSet.add(itemId);
		}
		expandedDescriptions = newSet;
	}

	function handleKeydown(event: KeyboardEvent, callback: () => void): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			callback();
		}
	}

	// ============================================================================
	// Unarmed Strike
	// ============================================================================

	function getUnarmedDamageDisplay(): string {
		return evaluateFormula(getUnarmedDamageFormula(getActor()));
	}

	async function handleUnarmedStrike(): Promise<void> {
		if (!(await rollUnarmedStrike(getActor()))) return;
		await getOnActivateItem()(1);
	}

	async function handleItemClick(itemId: string): Promise<unknown> {
		return getActor().activateItem(itemId);
	}

	return {
		get searchTerm() {
			return searchTerm;
		},
		set searchTerm(value: string) {
			searchTerm = value;
		},
		get expandedDescriptions() {
			return expandedDescriptions;
		},
		get effectVersion() {
			return effectVersion;
		},
		bumpEffectVersion,
		get weapons() {
			return weapons;
		},
		get showUnarmedStrike() {
			return showUnarmedStrike;
		},
		get attackFeatures() {
			return attackFeatures;
		},
		sortItems,
		getWeaponDamage,
		getWeaponProperties,
		getItemDescription,
		toggleDescription,
		handleKeydown,
		getUnarmedDamageDisplay,
		handleUnarmedStrike,
		handleItemClick,
	};
}
