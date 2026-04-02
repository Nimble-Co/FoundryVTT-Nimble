import { DamageRoll } from '../../../dice/DamageRoll.js';
import type { NimbleCharacter } from '../../../documents/actor/character.js';
import ItemActivationConfigDialog from '../../../documents/dialogs/ItemActivationConfigDialog.svelte.js';
import { getPrimaryDamageFormulaFromActivationEffects } from '../../../utils/activationEffects.js';
import { evaluateFormula as evalFormula } from '../../../utils/evaluateFormula.js';
import localize from '../../../utils/localize.js';
import showReactionConfirmation from '../../../utils/showReactionConfirmation.js';
import sortItems from '../../../utils/sortItems.js';
import { getTargetedTokens, getTargetName } from '../../../utils/targeting.js';
import { getUnarmedDamageFormula, hasUnarmedProficiency } from './attackUtils.js';

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
}

export function createOpportunityAttackPanelState(
	getActor: () => NimbleCharacter,
	getReactionDisabled: () => boolean,
	getOpportunitySpent: () => boolean,
	getNoActions: () => boolean,
	getOnUseReaction: () => (options?: { force?: boolean }) => Promise<boolean>,
) {
	const { weaponProperties } = CONFIG.NIMBLE;

	// Targeting state
	let targetingVersion = $state(0);

	const availableTargets = $derived.by(() => {
		void targetingVersion;
		return getTargetedTokens(getActor().id ?? '');
	});

	const selectedTarget = $derived(availableTargets.length === 1 ? availableTargets[0] : null);

	// Set up hook listener for target changes
	$effect(() => {
		const hookId = Hooks.on('targetToken', () => {
			targetingVersion++;
		});
		return () => Hooks.off('targetToken', hookId);
	});

	function evaluateFormula(formula: string | undefined): string {
		return evalFormula(formula, getActor());
	}

	function getSystemData(item: Item): WeaponSystemData {
		return item.system as unknown as WeaponSystemData;
	}

	// Filter for melee weapons only (not ranged)
	const meleeWeapons = $derived.by(() => {
		const weaponItems = getActor().reactive.items.filter((item) => {
			if (item.type !== 'object') return false;
			const system = getSystemData(item);
			if (system.objectType !== 'weapon') return false;

			// Check if it's a melee weapon (has reach property or no range property)
			const props = system.properties?.selected ?? [];
			const isRangedOnly =
				props.includes('range') && !props.includes('reach') && !props.includes('thrown');

			return !isRangedOnly;
		});

		return weaponItems;
	});

	const showUnarmedStrike = $derived(true);

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

				if (key === 'reach' && props.reach?.max) {
					return localize('NIMBLE.npcSheet.reach', { distance: String(props.reach.max) });
				}

				// Filter out range-related properties for opportunity attacks
				if (key === 'range' || key === 'thrown') {
					return null;
				}

				return label;
			})
			.filter(Boolean) as string[];
	}

	function handleKeydown(event: KeyboardEvent, callback: () => void): void {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			callback();
		}
	}

	async function checkAndConfirmReaction(): Promise<{ confirmed: boolean; force: boolean }> {
		const isDisabled = getReactionDisabled();

		if (isDisabled) {
			const opportunitySpent = getOpportunitySpent();
			const noActions = getNoActions();
			const reactionName = localize('NIMBLE.ui.heroicActions.reactions.opportunity.label');

			const confirmed = await showReactionConfirmation({
				reactionName,
				spentReactionNames: reactionName,
				noActions,
				hasSpentReactions: opportunitySpent,
			});
			return { confirmed, force: true };
		}

		return { confirmed: true, force: false };
	}

	// ============================================================================
	// Unarmed Strike
	// ============================================================================

	function getUnarmedDamageDisplay(): string {
		return evaluateFormula(getUnarmedDamageFormula(getActor()));
	}

	async function handleUnarmedStrike(): Promise<void> {
		// Check if we need confirmation before proceeding
		const { confirmed, force } = await checkAndConfirmReaction();
		if (!confirmed) return;

		const rollFormula = getUnarmedDamageFormula(getActor());
		const canCrit = hasUnarmedProficiency(getActor()); // Only characters proficient with unarmed (e.g., Zephyr with Swift Fists) can crit

		const unarmedItem = {
			name: localize('NIMBLE.ui.heroicActions.reactions.opportunity.unarmedOpportunity'),
			img: 'icons/skills/melee/unarmed-punch-fist.webp',
			system: {
				activation: {
					effects: [
						{
							type: 'damage',
							formula: rollFormula,
							damageType: 'bludgeoning',
							canCrit,
							canMiss: true,
						},
					],
				},
			},
		};

		const dialog = new ItemActivationConfigDialog(
			getActor(),
			unarmedItem,
			localize('NIMBLE.ui.heroicActions.reactions.opportunity.unarmedOpportunity'),
			{ rollMode: -1 }, // Default to disadvantage
		);
		await dialog.render(true);
		const result = await dialog.promise;

		if (!result) return;

		const reactionUsed = await getOnUseReaction()(force ? { force: true } : undefined);
		if (!reactionUsed) return;

		const roll = new DamageRoll(rollFormula, getActor().getRollData(), {
			canCrit,
			canMiss: true,
			rollMode: result.rollMode ?? -1, // Disadvantage by default
			primaryDieValue: result.primaryDieValue ?? 0,
			primaryDieModifier: Number(result.primaryDieModifier) || 0,
			damageType: 'bludgeoning',
			primaryDieAsDamage: true,
		});

		await roll.evaluate();

		const rollData = roll.toJSON();

		const evaluatedEffects = [
			{
				id: 'unarmed-damage',
				type: 'damage',
				formula: rollFormula,
				damageType: 'bludgeoning',
				canCrit,
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
			flavor: `${getActor().name}: ${localize('NIMBLE.ui.heroicActions.reactions.opportunity.unarmedOpportunity')}`,
			speaker: ChatMessage.getSpeaker({ actor: getActor() }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			system: {
				actorName: getActor().name,
				actorType: getActor().type,
				image: unarmedItem.img,
				permissions: CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER,
				rollMode: result.rollMode ?? -1,
				name: localize('NIMBLE.ui.heroicActions.reactions.opportunity.unarmedOpportunity'),
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

		await ChatMessage.create(chatData as unknown as ChatMessage.CreateData);
	}

	async function handleItemClick(itemId: string): Promise<unknown> {
		// Check if we need confirmation before proceeding
		const { confirmed, force } = await checkAndConfirmReaction();
		if (!confirmed) return null;

		const item = getActor().items.get(itemId);
		const result = await getActor().activateItem(itemId, { rollMode: -1 }); // Disadvantage

		if (result && item) {
			// Item activation owns its own dialog flow, so consume the reaction only after success.
			const reactionUsed = await getOnUseReaction()(force ? { force: true } : undefined);
			if (!reactionUsed) return null;
		}

		return result;
	}

	return {
		get meleeWeapons() {
			return meleeWeapons;
		},
		get showUnarmedStrike() {
			return showUnarmedStrike;
		},
		get availableTargets() {
			return availableTargets;
		},
		get selectedTarget() {
			return selectedTarget;
		},
		sortItems,
		getWeaponDamage,
		getWeaponProperties,
		getTargetName,
		handleKeydown,
		getUnarmedDamageDisplay,
		handleUnarmedStrike,
		handleItemClick,
	};
}
