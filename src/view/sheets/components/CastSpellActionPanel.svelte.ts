import type { NimbleCharacter } from '../../../documents/actor/character.js';
import { flattenActivationEffects } from '../../../utils/activationEffects.js';
import { evaluateFormula as evalFormula } from '../../../utils/evaluateFormula.js';
import localize from '../../../utils/localize.js';
import sortItems from '../../../utils/sortItems.js';
import filterItems from '../../dataPreparationHelpers/filterItems.js';

interface SpellEffect {
	formula: string;
	isHealing: boolean;
}

interface SpellEffects {
	baseEffect: string | null;
	higherLevelEffect: string | null;
}

/** System data for spell items */
interface SpellSystemData {
	manaCost?: number;
	activation?: {
		effects?: unknown[];
		cost?: { type: string; quantity: number };
		acquireTargetsFromTemplate?: boolean;
		targets?: { count: number };
	};
	properties?: {
		selected?: string[];
		reach?: { max?: number };
		range?: { max?: number };
	};
	description?: {
		baseEffect?: string;
		higherLevelEffect?: string;
	};
}

export function createSpellPanelState(
	getActor: () => NimbleCharacter,
	getOnActivateItem: () => (cost: number) => Promise<void>,
) {
	const { activationCostTypes, activationCostTypesPlural } = CONFIG.NIMBLE;
	let searchTerm = $state('');
	let expandedDescriptions = $state(new Set<string>());

	// ============================================================================
	// Formula Evaluation
	// ============================================================================

	function evaluateFormula(formula: string | undefined): string {
		return evalFormula(formula, getActor());
	}

	/** Helper to cast item system data */
	function getSystemData(item: Item): SpellSystemData {
		return item.system as unknown as SpellSystemData;
	}

	// ============================================================================
	// Spell Data
	// ============================================================================

	const spells = $derived(filterItems(getActor().reactive, ['spell'], searchTerm));

	function getSpellEffect(spell: Item): SpellEffect | null {
		const effects = getSystemData(spell).activation?.effects;
		const flattened = flattenActivationEffects(effects);

		for (const node of flattened) {
			const effectType = node.type;
			if (effectType !== 'damage' && effectType !== 'healing') continue;

			const formula = node.formula || node.roll;
			if (typeof formula === 'string' && formula.trim().length > 0) {
				return {
					formula: evaluateFormula(formula.trim()),
					isHealing: effectType === 'healing' || node.damageType === 'healing',
				};
			}
		}

		return null;
	}

	function getSpellManaCost(spell: Item): number {
		return getSystemData(spell).manaCost ?? 0;
	}

	function getSpellMetadata(spell: Item): string | null {
		const activation = getSystemData(spell).activation;
		if (!activation?.cost) return null;

		const { type: activationType, quantity: activationCost } = activation.cost;

		if (!activationType || activationType === 'none') return null;

		if (['action', 'minute', 'hour'].includes(activationType)) {
			const label =
				activationCost > 1
					? activationCostTypesPlural[activationType]
					: activationCostTypes[activationType];
			return `${activationCost || 1} ${label}`;
		}

		if (activationType === 'reaction' || activationType === 'special') {
			return activationCostTypes[activationType];
		}

		return null;
	}

	function getSpellRange(spell: Item): string | null {
		const props = getSystemData(spell).properties ?? {};
		const selected = props.selected ?? [];

		if (selected.includes('range') && props.range?.max) {
			return localize('NIMBLE.ui.heroicActions.rangeDistance', {
				distance: String(props.range.max),
			});
		}
		if (selected.includes('reach') && props.reach?.max) {
			return localize('NIMBLE.ui.heroicActions.reachDistance', {
				distance: String(props.reach.max),
			});
		}
		return null;
	}

	function getSpellTargetType(spell: Item): string | null {
		const activation = getSystemData(spell).activation;
		if (!activation) return null;

		if (activation.acquireTargetsFromTemplate) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.aoe');
		}

		const targetCount = activation.targets?.count ?? 1;

		if (targetCount === 0) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.self');
		}
		if (targetCount === 1) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.singleTarget');
		}
		if (targetCount === 2) {
			return localize('NIMBLE.ui.heroicActions.targetTypes.twoTargets');
		}
		return localize('NIMBLE.ui.heroicActions.targetTypes.multiTarget', {
			count: String(targetCount),
		});
	}

	function hasContent(text: unknown): text is string {
		if (!text || typeof text !== 'string') return false;
		const stripped = text.replace(/<[^>]*>/g, '').trim();
		return stripped.length > 0;
	}

	function getSpellEffects(spell: Item): SpellEffects | null {
		const desc = getSystemData(spell).description;
		if (!desc) return null;

		const baseEffect = desc.baseEffect;
		const higherLevelEffect = desc.higherLevelEffect;

		const hasBase = hasContent(baseEffect);
		const hasHigher = hasContent(higherLevelEffect);

		if (!hasBase && !hasHigher) return null;

		return {
			baseEffect: hasBase ? baseEffect : null,
			higherLevelEffect: hasHigher ? higherLevelEffect : null,
		};
	}

	function toggleDescription(spellId: string, event: Event): void {
		event.stopPropagation();
		const newSet = new Set(expandedDescriptions);
		if (newSet.has(spellId)) {
			newSet.delete(spellId);
		} else {
			newSet.add(spellId);
		}
		expandedDescriptions = newSet;
	}

	function handleKeydown(event: KeyboardEvent, callback: () => void): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			callback();
		}
	}

	async function handleSpellClick(spellId: string): Promise<unknown> {
		const spell = getActor().items.get(spellId);
		const result = await getActor().activateItem(spellId);

		if (result && spell) {
			const activationCost = getSystemData(spell).activation?.cost;
			const costType = activationCost?.type;
			const costQuantity = activationCost?.quantity ?? 1;

			if (costType === 'action') {
				await getOnActivateItem()(costQuantity);
			}
		}

		return result;
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
		get spells() {
			return spells;
		},
		sortItems,
		getSpellEffect,
		getSpellManaCost,
		getSpellMetadata,
		getSpellRange,
		getSpellTargetType,
		getSpellEffects,
		toggleDescription,
		handleKeydown,
		handleSpellClick,
	};
}
