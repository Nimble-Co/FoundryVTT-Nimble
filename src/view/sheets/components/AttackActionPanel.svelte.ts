import { DamageRoll } from '../../../dice/DamageRoll.js';
import type { NimbleCharacter } from '../../../documents/actor/character.js';
import ItemActivationConfigDialog from '../../../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { getPrimaryDamageFormulaFromActivationEffects } from '../../../utils/activationEffects.js';
import { evaluateFormula as evalFormula } from '../../../utils/evaluateFormula.js';
import localize from '../../../utils/localize.js';
import sortItems from '../../../utils/sortItems.js';

// Default unarmed: roll 1d4 for hit determination, damage is 1 + STR
// The 1d4 is excluded from damage total when primaryDieAsDamage is false
const DEFAULT_UNARMED_DAMAGE = '1d4 + 1 + @abilities.strength.mod';

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
	actionType?: string;
}

/** Extended character system data with optional unarmed damage */
interface CharacterSystemExtension {
	unarmedDamage?: string;
}

export function createAttackPanelState(
	getActor: () => NimbleCharacter,
	getOnActivateItem: () => (cost: number) => Promise<void>,
) {
	const { weaponProperties } = CONFIG.NIMBLE;
	let searchTerm = $state('');
	let expandedDescriptions = $state(new Set<string>());

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
		return weaponItems.filter((item) => item.name.toLocaleLowerCase().includes(search));
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

			return activation.cost?.type === 'action' && Boolean(system.actionType?.includes('attack'));
		});

		if (!searchTerm) return features;

		const search = searchTerm.toLocaleLowerCase();
		return features.filter((item) => item.name.toLocaleLowerCase().includes(search));
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

		const stripped = desc.replace(/<[^>]*>/g, '').trim();
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

	/** Get character system with unarmed damage extension */
	function getCharacterSystem(): CharacterSystemExtension {
		return getActor().system as CharacterSystemExtension;
	}

	function getUnarmedDamageFormula(): string {
		return getCharacterSystem().unarmedDamage ?? DEFAULT_UNARMED_DAMAGE;
	}

	function hasCustomUnarmedDamage(): boolean {
		return getCharacterSystem().unarmedDamage !== undefined;
	}

	function getUnarmedDamageDisplay(): string {
		if (hasCustomUnarmedDamage()) {
			return evaluateFormula(getCharacterSystem().unarmedDamage);
		}
		return evaluateFormula('1 + @abilities.strength.mod');
	}

	async function handleUnarmedStrike(): Promise<void> {
		const rollFormula = getUnarmedDamageFormula();
		const primaryDieAsDamage = hasCustomUnarmedDamage();

		const unarmedItem = {
			name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
			img: 'icons/skills/melee/unarmed-punch-fist.webp',
			system: {
				activation: {
					effects: [
						{
							type: 'damage',
							formula: rollFormula,
							damageType: 'bludgeoning',
							canCrit: true,
							canMiss: true,
						},
					],
				},
			},
		};

		const dialog = new ItemActivationConfigDialog(
			getActor(),
			unarmedItem,
			localize('NIMBLE.ui.heroicActions.unarmedStrike'),
			{ rollMode: 0 },
		);
		await dialog.render(true);
		const result = await dialog.promise;

		if (!result) return;

		const roll = new DamageRoll(rollFormula, getActor().getRollData(), {
			canCrit: true,
			canMiss: true,
			rollMode: result.rollMode ?? 0,
			primaryDieValue: result.primaryDieValue ?? 0,
			primaryDieModifier: Number(result.primaryDieModifier) || 0,
			damageType: 'bludgeoning',
			primaryDieAsDamage,
		});

		await roll.evaluate();

		const rollData = roll.toJSON();

		const evaluatedEffects = [
			{
				id: 'unarmed-damage',
				type: 'damage',
				formula: rollFormula,
				damageType: 'bludgeoning',
				canCrit: true,
				canMiss: true,
				roll: rollData,
				parentNode: null,
				parentContext: null,
				on: {
					hit: [
						{
							id: 'unarmed-damage-hit',
							type: 'damageOutcome',
							parentNode: 'unarmed-damage',
							parentContext: 'hit',
						},
					],
					criticalHit: [
						{
							id: 'unarmed-damage-crit',
							type: 'damageOutcome',
							parentNode: 'unarmed-damage',
							parentContext: 'criticalHit',
						},
					],
				},
			},
		];

		const chatData = {
			author: game.user?.id,
			flavor: `${getActor().name}: ${localize('NIMBLE.ui.heroicActions.unarmedStrike')}`,
			speaker: ChatMessage.getSpeaker({ actor: getActor() }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			system: {
				actorName: getActor().name,
				actorType: getActor().type,
				image: unarmedItem.img,
				permissions: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
				rollMode: result.rollMode ?? 0,
				name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
				description: '',
				featureType: 'feature',
				class: '',
				attackType: 'reach',
				attackDistance: 1,
				isCritical: roll.isCritical,
				isMiss: roll.isMiss,
				activation: {
					effects: evaluatedEffects,
					cost: { type: 'action', quantity: 1 },
					duration: { type: 'none', quantity: 1 },
					targets: { count: 1 },
				},
				targets: Array.from(game.user?.targets?.map((token) => token.document.uuid) ?? []),
			},
			type: 'feature',
		};

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		await ChatMessage.create(chatData as any);
		await getOnActivateItem()(1);
	}

	async function handleItemClick(itemId: string): Promise<unknown> {
		const item = getActor().items.get(itemId);
		const result = await getActor().activateItem(itemId);

		if (result && item) {
			const activationCost = getSystemData(item).activation?.cost;
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
