<script>
	import { createSubscriber } from 'svelte/reactivity';
	import { getContext } from 'svelte';
	import filterItems from '../../dataPreparationHelpers/filterItems.js';
	import sortItems from '../../../utils/sortItems.js';
	import localize from '../../../utils/localize.js';
	import prepareSpellTooltip from '../../dataPreparationHelpers/documentTooltips/prepareSpellTooltip';
	import prepareObjectTooltip from '../../dataPreparationHelpers/documentTooltips/prepareObjectTooltip.js';
	import {
		getPrimaryDamageFormulaFromActivationEffects,
		flattenActivationEffects,
	} from '../../../utils/activationEffects.js';

	import ActionPipTracker from '../components/ActionPipTracker.svelte';
	import SearchBar from '../components/SearchBar.svelte';

	// ============================================================================
	// Context & Configuration
	// ============================================================================

	const { activationCostTypes, activationCostTypesPlural, weaponProperties } = CONFIG.NIMBLE;

	let actor = getContext('actor');
	let sheet = getContext('application');

	// ============================================================================
	// Action Definitions (Single source of truth for all heroic actions)
	// ============================================================================

	const HEROIC_ACTIONS = [
		{
			id: 'attack',
			icon: 'fa-solid fa-sword',
			labelKey: 'NIMBLE.ui.heroicActions.actions.attack.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.attack.description',
			type: 'panel', // Opens a panel
		},
		{
			id: 'spell',
			icon: 'fa-solid fa-wand-sparkles',
			labelKey: 'NIMBLE.ui.heroicActions.actions.spell.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.spell.description',
			type: 'panel',
		},
		{
			id: 'move',
			icon: 'fa-solid fa-person-running',
			labelKey: 'NIMBLE.ui.heroicActions.actions.move.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.move.description',
			type: 'immediate', // Executes immediately
			requiresCombat: true,
		},
		{
			id: 'assess',
			icon: 'fa-solid fa-eye',
			labelKey: 'NIMBLE.ui.heroicActions.actions.assess.label',
			descriptionKey: 'NIMBLE.ui.heroicActions.actions.assess.description',
			type: 'dialog', // Opens a dialog
		},
	];

	// ============================================================================
	// Combat State Management
	// ============================================================================

	const subscribeCombatState = createSubscriber((update) => {
		const hookNames = [
			'combatStart',
			'createCombat',
			'updateCombat',
			'deleteCombat',
			'createCombatant',
			'updateCombatant',
			'deleteCombatant',
			'canvasInit',
			'canvasReady',
		];

		const hookIds = hookNames.map((hookName) => ({
			hookId: Hooks.on(hookName, () => update()),
			hookName,
		}));

		return () => hookIds.forEach(({ hookName, hookId }) => Hooks.off(hookName, hookId));
	});

	function getActiveCombatForCurrentScene() {
		const sceneId = canvas?.scene?.id;
		if (!sceneId) return null;

		const activeCombat = game.combat;
		if (activeCombat?.active && activeCombat.scene?.id === sceneId) {
			return activeCombat;
		}

		const activeByScene = game.combats?.contents?.find(
			(combat) => combat?.active && combat.scene?.id === sceneId,
		);
		if (activeByScene) return activeByScene;

		const viewedCombat = game.combats?.viewed ?? null;
		if (viewedCombat?.active && viewedCombat.scene?.id === sceneId) {
			return viewedCombat;
		}

		return null;
	}

	function getCombatant() {
		const combat = getActiveCombatForCurrentScene();
		if (!combat?.started) return null;
		return combat.combatants.find((entry) => entry.actorId === actor.id) ?? null;
	}

	function isInActiveCombat() {
		const combatant = getCombatant();
		if (!combatant) return false;
		return combatant.initiative !== null;
	}

	function needsToRollInitiative() {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return false;
		const combatant = combat.combatants.find((entry) => entry.actorId === actor.id);
		if (!combatant) return false;
		return combatant.initiative === null;
	}

	async function rollInitiative() {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return;
		const combatant = combat.combatants.find((entry) => entry.actorId === actor.id);
		if (!combatant) return;

		try {
			await combat.rollInitiative([combatant.id]);
		} catch (_error) {
			ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionRollInitiative'));
		}
	}

	function getActionsData() {
		const combatant = getCombatant();
		if (!combatant) return { current: 0, max: 3 };

		const actions = combatant.system?.actions?.base;
		return {
			current: actions?.current ?? 0,
			max: actions?.max ?? 3,
		};
	}

	async function updateActionPips(newValue) {
		const combatant = getCombatant();
		if (!combatant) return;
		await combatant.update({ 'system.actions.base.current': newValue });
	}

	async function deductActionPips(count = 1) {
		const { current } = getActionsData();
		if (current > 0) {
			const newValue = Math.max(0, current - count);
			await updateActionPips(newValue);
		}
	}

	function isCharactersTurn() {
		const combat = getActiveCombatForCurrentScene();
		if (!combat?.started) return false;

		const currentCombatant = combat.combatant;
		if (!currentCombatant) return false;

		return currentCombatant.actorId === actor.id;
	}

	async function endTurn() {
		const combat = getActiveCombatForCurrentScene();
		if (!combat) return;

		try {
			await combat.nextTurn();
		} catch (_error) {
			ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionEndTurn'));
		}
	}

	// Reactive combat state
	let inCombat = $derived.by(() => {
		subscribeCombatState();
		return isInActiveCombat();
	});

	let needsInitiative = $derived.by(() => {
		subscribeCombatState();
		return needsToRollInitiative();
	});

	let actionsData = $derived.by(() => {
		subscribeCombatState();
		return getActionsData();
	});

	let isMyTurn = $derived.by(() => {
		subscribeCombatState();
		return isCharactersTurn();
	});

	// ============================================================================
	// Panel State & Action Handlers
	// ============================================================================

	let expandedPanel = $state('attack');

	function togglePanel(panelName) {
		// Attack and Spell act like tabs - clicking the selected one does nothing
		// You can only switch between them
		if (expandedPanel === panelName) {
			return;
		}
		expandedPanel = panelName;
	}

	function handleActionClick(action) {
		switch (action.type) {
			case 'panel':
				togglePanel(action.id);
				break;
			case 'immediate':
				handleMoveAction();
				break;
			case 'dialog':
				handleAssessAction();
				break;
		}
	}

	async function handleMoveAction() {
		if (!inCombat || actionsData.current <= 0) return;

		const { default: GenericDialog } = await import(
			'../../../documents/dialogs/GenericDialog.svelte.js'
		);
		const { default: MoveActionDialog } = await import('../../dialogs/MoveActionDialog.svelte');

		const dialogId = `move-action-${actor.id}`;

		// Wrapper to maintain MoveActionDialog's expected interface
		const deductActionPip = () => deductActionPips(1);

		GenericDialog.getOrCreate(
			localize('NIMBLE.ui.heroicActions.move.dialogTitle'),
			MoveActionDialog,
			{ document: actor, deductActionPip, inCombat },
			{ width: 340, uniqueId: dialogId },
		).render(true);
	}

	async function handleAssessAction() {
		const { default: GenericDialog } = await import(
			'../../../documents/dialogs/GenericDialog.svelte.js'
		);
		const { default: AssessActionDialog } = await import('../../dialogs/AssessActionDialog.svelte');

		const dialogId = `assess-action-${actor.id}`;

		// Wrapper to maintain AssessActionDialog's expected interface
		const deductActionPip = () => deductActionPips(1);

		GenericDialog.getOrCreate(
			'Assess Action',
			AssessActionDialog,
			{ document: actor, deductActionPip, inCombat },
			{ width: 420, uniqueId: dialogId },
		).render(true);
	}

	async function handleHelpDialog() {
		const { default: GenericDialog } = await import(
			'../../../documents/dialogs/GenericDialog.svelte.js'
		);
		const { default: HeroicActionsHelpDialog } = await import(
			'../../dialogs/HeroicActionsHelpDialog.svelte'
		);

		GenericDialog.getOrCreate(
			localize('NIMBLE.ui.heroicActions.help.dialogTitle'),
			HeroicActionsHelpDialog,
			{},
			{ width: 480, uniqueId: 'heroic-actions-help' },
		).render(true);
	}

	function isActionDisabled(action) {
		if (action.requiresCombat) {
			return !inCombat || actionsData.current <= 0;
		}
		if (action.id === 'spell') {
			return !hasSpells;
		}
		return false;
	}

	function getActionTooltip(action) {
		const label = localize(action.labelKey);

		if (action.requiresCombat) {
			if (!inCombat) {
				return `${label} (${localize('NIMBLE.ui.heroicActions.outsideCombat')})`;
			}
			if (actionsData.current <= 0) {
				return `${label} (${localize('NIMBLE.ui.heroicActions.noActions')})`;
			}
		}
		if (action.id === 'spell' && !hasSpells) {
			return `${label} (${localize('NIMBLE.ui.heroicActions.noSpells')})`;
		}
		return label;
	}

	// ============================================================================
	// Formula Evaluation (for damage display)
	// ============================================================================

	function evaluateFormula(formula) {
		if (!formula) return '';

		try {
			const rollData = actor.getRollData();
			const substituted = Roll.replaceFormulaData(formula, rollData, { missing: '0' });

			// Parse and simplify each term
			const parts = substituted.split(/([+-])/);
			const simplified = [];

			for (const part of parts) {
				const trimmed = part.trim();
				if (!trimmed) continue;

				if (trimmed === '+' || trimmed === '-') {
					simplified.push(trimmed);
				} else if (/^\d*d\d+/i.test(trimmed)) {
					// Keep dice terms as-is
					simplified.push(trimmed);
				} else {
					// Evaluate mathematical expressions
					try {
						const evaluated = Roll.safeEval(trimmed);
						if (typeof evaluated === 'number' && !isNaN(evaluated)) {
							simplified.push(String(Math.floor(evaluated)));
						} else {
							simplified.push(trimmed);
						}
					} catch {
						simplified.push(trimmed);
					}
				}
			}

			let result = simplified.join(' ').replace(/\s+/g, ' ').trim();
			result = result.replace(/[+-]\s*0(?!\d)/g, '').trim();
			result = result
				.replace(/^\s*[+-]\s*/, '')
				.replace(/[+-]\s*[+-]/g, '+')
				.trim();

			return result || formula;
		} catch {
			return formula;
		}
	}

	// ============================================================================
	// Attack Panel Data
	// ============================================================================

	let attackSearchTerm = $state('');

	let weapons = $derived.by(() => {
		const weaponItems = actor.reactive.items.filter(
			(item) => item.type === 'object' && item.system.objectType === 'weapon',
		);

		if (!attackSearchTerm) return weaponItems;

		const search = attackSearchTerm.toLocaleLowerCase();
		return weaponItems.filter((item) => item.name.toLocaleLowerCase().includes(search));
	});

	let showUnarmedStrike = $derived(
		!attackSearchTerm || 'unarmed strike'.includes(attackSearchTerm.toLocaleLowerCase()),
	);

	let attackFeatures = $derived.by(() => {
		const features = actor.reactive.items.filter((item) => {
			if (item.type !== 'feature') return false;

			const activation = item.system?.activation;
			if (!activation) return false;

			return activation.cost?.type === 'action' && item.system?.actionType?.includes('attack');
		});

		if (!attackSearchTerm) return features;

		const search = attackSearchTerm.toLocaleLowerCase();
		return features.filter((item) => item.name.toLocaleLowerCase().includes(search));
	});

	function getWeaponDamage(item) {
		const effects = item.reactive?.system?.activation?.effects ?? item.system?.activation?.effects;
		const formula = getPrimaryDamageFormulaFromActivationEffects(effects);
		return evaluateFormula(formula);
	}

	function getWeaponProperties(item) {
		const props = item.reactive?.system?.properties ?? item.system?.properties ?? {};
		const selected = props.selected ?? [];

		return selected
			.map((key) => {
				const localeKey = weaponProperties[key];
				const label = localeKey ? game.i18n.localize(localeKey) : key;

				// Add range values for specific properties (show max only)
				if (key === 'thrown' && props.thrownRange) {
					return localize('NIMBLE.ui.heroicActions.thrown', { distance: props.thrownRange });
				}
				if (key === 'range' && props.range?.max) {
					return localize('NIMBLE.npcSheet.range', { distance: props.range.max });
				}
				if (key === 'reach' && props.reach?.max) {
					return localize('NIMBLE.npcSheet.reach', { distance: props.reach.max });
				}

				return label;
			})
			.filter(Boolean);
	}

	// Unarmed strike rules:
	// - Core rules: "roll 1d4; on hit: deal 1 + STR damage"
	//   The d4 determines hit/miss only, damage is flat 1+STR
	//   If d4 rolls max (4), it explodes and explosion values add to damage
	// - Swift Fists (Zephyr): "damage is 1d4+STR"
	//   The d4 serves as both attack and damage die
	//
	// Implementation: We use primaryDieAsDamage option on DamageRoll to control
	// whether the primary die's base value contributes to damage.
	const DEFAULT_UNARMED_DAMAGE = '1d4 + 1 + @abilities.strength.mod';

	function getUnarmedDamageFormula() {
		// Check if actor has a modified unarmed damage formula (e.g., from Swift Fists)
		// This is set by the unarmedDamage rule during data preparation
		return actor.system?.unarmedDamage ?? DEFAULT_UNARMED_DAMAGE;
	}

	function hasCustomUnarmedDamage() {
		// Returns true if the actor has a feature modifying unarmed damage (e.g., Swift Fists)
		return actor.system?.unarmedDamage !== undefined;
	}

	function getUnarmedDamageDisplay() {
		// For display purposes, show what the actual damage will be
		// Core rules: show flat damage (1 + STR)
		// Swift Fists: show full formula (1d4 + STR)
		if (hasCustomUnarmedDamage()) {
			// Has a custom formula like Swift Fists - show evaluated formula
			return evaluateFormula(actor.system.unarmedDamage);
		}
		// Core rules - show just the flat damage portion (1 + STR)
		return evaluateFormula('1 + @abilities.strength.mod');
	}

	async function handleUnarmedStrike() {
		const { default: ItemActivationConfigDialog } = await import(
			'../../../documents/dialogs/ItemActivationConfigDialog.svelte.js'
		);
		const { DamageRoll } = await import('../../../dice/DamageRoll.js');

		// Get the unarmed damage formula and whether the primary die contributes to damage
		const rollFormula = getUnarmedDamageFormula();
		// For core rules, the d4 is only for hit/miss, not damage
		// For features like Swift Fists, the d4 IS part of the damage
		const primaryDieAsDamage = hasCustomUnarmedDamage();

		// Create a fake item structure for unarmed strike
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
			actor,
			unarmedItem,
			localize('NIMBLE.ui.heroicActions.unarmedStrike'),
			{ rollMode: 0 },
		);
		await dialog.render(true);
		const result = await dialog.promise;

		if (!result) return; // Dialog was cancelled

		// Create the damage roll
		const roll = new DamageRoll(rollFormula, actor.getRollData(), {
			canCrit: true,
			canMiss: true,
			rollMode: result.rollMode ?? 0,
			primaryDieValue: result.primaryDieValue ?? 0,
			primaryDieModifier: Number(result.primaryDieModifier) || 0,
			damageType: 'bludgeoning',
			primaryDieAsDamage,
		});

		await roll.evaluate();

		// Build the roll data for chat card rendering
		const rollData = roll.toJSON();

		// Build the activation effects with proper tree structure
		// The damage node must have damageOutcome children in the 'on' property
		// for the chat card to render the damage correctly
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

		// Create chat message using the feature card format
		const chatData = {
			author: game.user?.id,
			flavor: `${actor.name}: ${localize('NIMBLE.ui.heroicActions.unarmedStrike')}`,
			speaker: ChatMessage.getSpeaker({ actor }),
			style: CONST.CHAT_MESSAGE_STYLES.OTHER,
			sound: CONFIG.sounds.dice,
			rolls: [roll],
			system: {
				// Metadata fields
				actorName: actor.name,
				actorType: actor.type,
				image: unarmedItem.img,
				permissions: 3, // OWNER permission
				rollMode: result.rollMode ?? 0,
				// Feature card specific fields
				name: localize('NIMBLE.ui.heroicActions.unarmedStrike'),
				description: '',
				featureType: 'feature',
				class: '',
				attackType: 'reach',
				attackDistance: 1,
				// Roll state
				isCritical: roll.isCritical,
				isMiss: roll.isMiss,
				// Activation data with evaluated effects
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

		await ChatMessage.create(chatData);

		// Deduct action pip if in combat
		if (inCombat && actionsData.current > 0) {
			await deductActionPips(1);
		}
	}

	async function activateItemWithActionDeduction(itemId) {
		const item = actor.items.get(itemId);
		const result = await actor.activateItem(itemId);

		// If activation succeeded and we're in combat, deduct action pips
		if (result && inCombat && actionsData.current > 0) {
			// Get the action cost from the item's activation data
			const activationCost = item?.system?.activation?.cost;
			const costType = activationCost?.type;
			const costQuantity = activationCost?.quantity ?? 1;

			// Only deduct for action-type costs
			if (costType === 'action') {
				await deductActionPips(costQuantity);
			}
		}

		return result;
	}

	// ============================================================================
	// Spell Panel Data
	// ============================================================================

	let spellSearchTerm = $state('');
	let allSpells = $derived(filterItems(actor.reactive, ['spell'], ''));
	let hasSpells = $derived(allSpells.length > 0);
	let spells = $derived(filterItems(actor.reactive, ['spell'], spellSearchTerm));

	function getSpellEffect(spell) {
		const effects =
			spell.reactive?.system?.activation?.effects ?? spell.system?.activation?.effects;
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

	function getSpellManaCost(spell) {
		return spell.reactive.system.manaCost ?? 0;
	}

	function getSpellMetadata(spell) {
		const { type: activationType, quantity: activationCost } =
			spell.reactive.system.activation.cost;

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

	function getSpellRange(spell) {
		const props = spell.reactive?.system?.properties ?? spell.system?.properties ?? {};
		const selected = props.selected ?? [];

		if (selected.includes('range') && props.range?.max) {
			return localize('NIMBLE.npcSheet.range', { distance: props.range.max });
		}
		if (selected.includes('reach') && props.reach?.max) {
			return localize('NIMBLE.npcSheet.reach', { distance: props.reach.max });
		}
		return null;
	}

	// ============================================================================
	// Tooltip Caching
	// ============================================================================

	const weaponTooltipCache = new Map();
	const spellTooltipCache = new Map();

	function handleTooltipMouseEnter(event, item, cache, prepareTooltip) {
		const element = event.currentTarget;
		const cacheKey = item.reactive._id;

		if (!cache.has(cacheKey)) {
			prepareTooltip(item.reactive).then((tooltip) => {
				if (tooltip) {
					cache.set(cacheKey, tooltip);
					element.setAttribute('data-tooltip', tooltip);
				}
			});
		}
	}

	// ============================================================================
	// Derived State
	// ============================================================================

	let flags = $derived(actor.reactive.flags.nimble);
	let showEmbeddedDocumentImages = $derived(flags?.showEmbeddedDocumentImages ?? true);
</script>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	<div class="heroic-actions__combat-header">
		<ActionPipTracker
			current={actionsData.current}
			max={actionsData.max}
			disabled={!inCombat}
			onUpdate={updateActionPips}
		/>

		{#if needsInitiative}
			<button
				class="heroic-actions__roll-initiative-button"
				type="button"
				aria-label={localize('NIMBLE.ui.heroicActions.rollInitiative')}
				data-tooltip={localize('NIMBLE.ui.heroicActions.rollInitiative')}
				onclick={rollInitiative}
			>
				<i class="fa-solid fa-dice-d20"></i>
				{localize('NIMBLE.ui.heroicActions.rollInitiative')}
			</button>
		{:else if isMyTurn}
			{@const canEndTurn = actionsData.current === 0}
			<button
				class="heroic-actions__end-turn-button"
				class:heroic-actions__end-turn-button--ready={canEndTurn}
				type="button"
				disabled={!canEndTurn}
				aria-label={localize('NIMBLE.ui.heroicActions.endTurn')}
				data-tooltip={canEndTurn
					? localize('NIMBLE.ui.heroicActions.endTurn')
					: localize('NIMBLE.ui.heroicActions.useActionsFirst')}
				onclick={endTurn}
			>
				{localize('NIMBLE.ui.heroicActions.endTurn')}
			</button>
		{/if}
	</div>

	<section>
		<header class="nimble-section-header">
			<h3 class="nimble-heading" data-heading-variant="section">
				{localize('NIMBLE.ui.heroicActions.title')}
			</h3>

			<button
				class="nimble-button heroic-actions__help-button"
				data-button-variant="icon"
				type="button"
				aria-label={localize('NIMBLE.ui.heroicActions.help.tooltip')}
				data-tooltip={localize('NIMBLE.ui.heroicActions.help.tooltip')}
				onclick={handleHelpDialog}
			>
				<i class="fa-solid fa-circle-question"></i>
			</button>
		</header>

		<div class="heroic-actions-tabs">
			{#each HEROIC_ACTIONS as action (action.id)}
				<button
					class="heroic-action-tab"
					class:heroic-action-tab--active={expandedPanel === action.id}
					class:heroic-action-tab--disabled={isActionDisabled(action)}
					type="button"
					aria-label={localize(action.labelKey)}
					data-tooltip={getActionTooltip(action)}
					disabled={isActionDisabled(action)}
					onclick={() => handleActionClick(action)}
				>
					<i class={action.icon}></i>
					<span class="heroic-action-tab__indicator"></span>
				</button>
			{/each}
		</div>
	</section>

	{#if expandedPanel === 'attack'}
		<section class="heroic-actions-panel">
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ui.heroicActions.selectAttack')}
				</h3>
			</header>

			<div class="heroic-actions-panel__search">
				<SearchBar bind:searchTerm={attackSearchTerm} />
			</div>

			<div class="heroic-actions-panel__content">
				<ul class="nimble-item-list">
					{#if showUnarmedStrike}
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<li class="weapon-card" role="button" onclick={handleUnarmedStrike}>
							<div class="weapon-card__icon">
								<i class="fa-solid fa-hand-fist"></i>
							</div>

							<div class="weapon-card__content">
								<span class="weapon-card__name"
									>{localize('NIMBLE.ui.heroicActions.unarmedStrike')}</span
								>
								<div class="weapon-card__meta">
									<span class="weapon-card__tag">{localize('NIMBLE.npcSheet.melee')}</span>
								</div>
							</div>

							<span class="weapon-card__damage">
								<i class="fa-solid fa-burst"></i>
								{getUnarmedDamageDisplay()}
							</span>
						</li>
					{/if}

					{#each sortItems(weapons) as item (item._id)}
						{@const damage = getWeaponDamage(item)}
						{@const properties = getWeaponProperties(item)}
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<li
							class="weapon-card"
							data-item-id={item._id}
							data-tooltip={weaponTooltipCache.get(item.reactive._id) || ''}
							data-tooltip-class="nimble-tooltip nimble-tooltip--item"
							data-tooltip-direction="LEFT"
							onmouseenter={(event) =>
								handleTooltipMouseEnter(event, item, weaponTooltipCache, prepareObjectTooltip)}
							draggable="true"
							role="button"
							ondragstart={(event) => sheet._onDragStart(event)}
							onclick={() => activateItemWithActionDeduction(item._id)}
						>
							{#if showEmbeddedDocumentImages}
								<img class="weapon-card__img" src={item.reactive.img} alt={item.reactive.name} />
							{/if}

							<div class="weapon-card__content">
								<span class="weapon-card__name">{item.reactive.name}</span>
								{#if properties.length > 0}
									<div class="weapon-card__meta">
										{#each properties as prop}
											<span class="weapon-card__tag">{prop}</span>
										{/each}
									</div>
								{/if}
							</div>

							{#if damage}
								<span class="weapon-card__damage">
									<i class="fa-solid fa-burst"></i>
									{damage}
								</span>
							{/if}
						</li>
					{/each}

					{#each sortItems(attackFeatures) as item (item._id)}
						{@const damage = getWeaponDamage(item)}
						<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<li
							class="weapon-card"
							data-item-id={item._id}
							draggable="true"
							role="button"
							ondragstart={(event) => sheet._onDragStart(event)}
							onclick={() => activateItemWithActionDeduction(item._id)}
						>
							{#if showEmbeddedDocumentImages}
								<img class="weapon-card__img" src={item.reactive.img} alt={item.reactive.name} />
							{/if}

							<div class="weapon-card__content">
								<span class="weapon-card__name">{item.reactive.name}</span>
								<div class="weapon-card__meta">
									<span class="weapon-card__tag">{localize('NIMBLE.ui.heroicActions.feature')}</span
									>
								</div>
							</div>

							{#if damage}
								<span class="weapon-card__damage">
									<i class="fa-solid fa-burst"></i>
									{damage}
								</span>
							{/if}
						</li>
					{/each}
				</ul>

				{#if !showUnarmedStrike && weapons.length === 0 && attackFeatures.length === 0}
					<p class="heroic-actions-panel__empty">{localize('NIMBLE.ui.heroicActions.noWeapons')}</p>
				{/if}
			</div>
		</section>
	{/if}

	{#if expandedPanel === 'spell'}
		<section class="heroic-actions-panel">
			<header class="nimble-section-header">
				<h3 class="nimble-heading" data-heading-variant="section">
					{localize('NIMBLE.ui.heroicActions.selectSpell')}
				</h3>
			</header>

			<div class="heroic-actions-panel__search">
				<SearchBar bind:searchTerm={spellSearchTerm} />
			</div>

			<div class="heroic-actions-panel__content">
				{#if spells.length > 0}
					<ul class="nimble-item-list">
						{#each sortItems(spells) as spell (spell._id)}
							{@const meta = getSpellMetadata(spell)}
							{@const manaCost = getSpellManaCost(spell)}
							{@const effect = getSpellEffect(spell)}
							{@const spellRange = getSpellRange(spell)}
							{@const requiresConcentration =
								spell.reactive.system.properties.selected.includes('concentration')}

							<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
							<!-- svelte-ignore a11y_click_events_have_key_events -->
							<li
								class="spell-card"
								data-item-id={spell._id}
								data-tooltip={spellTooltipCache.get(spell.reactive._id) || ''}
								data-tooltip-class="nimble-tooltip nimble-tooltip--item"
								data-tooltip-direction="LEFT"
								onmouseenter={(event) =>
									handleTooltipMouseEnter(event, spell, spellTooltipCache, prepareSpellTooltip)}
								draggable="true"
								role="button"
								ondragstart={(event) => sheet._onDragStart(event)}
								onclick={() => activateItemWithActionDeduction(spell._id)}
							>
								{#if showEmbeddedDocumentImages}
									<img class="spell-card__img" src={spell.reactive.img} alt={spell.reactive.name} />
								{/if}

								<div class="spell-card__content">
									<span class="spell-card__name">
										{spell.reactive.name}
										{#if requiresConcentration}
											<span class="spell-card__tag">C</span>
										{/if}
									</span>

									<div class="spell-card__meta">
										{#if meta}
											<span class="spell-card__action-cost">{@html meta}</span>
										{/if}
										{#if spellRange}
											<span class="spell-card__range">{spellRange}</span>
										{/if}
										{#if manaCost > 0}
											<span class="spell-card__mana">
												<i class="fa-solid fa-sparkles"></i>
												{localize('NIMBLE.ui.heroicActions.mana', { cost: manaCost })}
											</span>
										{/if}
									</div>
								</div>

								{#if effect}
									<span
										class="spell-card__effect"
										class:spell-card__effect--healing={effect.isHealing}
									>
										<i class="fa-solid {effect.isHealing ? 'fa-heart' : 'fa-burst'}"></i>
										{effect.formula}
									</span>
								{/if}
							</li>
						{/each}
					</ul>
				{:else}
					<p class="heroic-actions-panel__empty">
						{localize('NIMBLE.ui.heroicActions.noSpellsFound')}
					</p>
				{/if}
			</div>
		</section>
	{/if}
</section>

<style lang="scss">
	.heroic-actions__combat-header {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	.heroic-actions__end-turn-button {
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 0.375rem 1rem;
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		color: var(--nimble-medium-text-color);
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: not-allowed;
		opacity: 0.5;
		transition: all 0.2s ease;

		&--ready {
			opacity: 1;
			cursor: pointer;
			color: var(--nimble-light-text-color);
			background: hsl(139, 47%, 44%);
			border-color: hsl(139, 47%, 38%);

			&:hover {
				background: hsl(139, 47%, 38%);
				border-color: hsl(139, 47%, 32%);
			}

			&:active {
				background: hsl(139, 47%, 32%);
			}
		}
	}

	.heroic-actions__roll-initiative-button {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.375rem 1rem;
		font-size: var(--nimble-sm-text);
		font-weight: 600;
		color: var(--nimble-light-text-color);
		background: hsl(210, 60%, 50%);
		border: 1px solid hsl(210, 60%, 44%);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;

		i {
			font-size: 0.875rem;
		}

		&:hover {
			background: hsl(210, 60%, 44%);
			border-color: hsl(210, 60%, 38%);
		}

		&:active {
			background: hsl(210, 60%, 38%);
		}
	}

	.heroic-actions__help-button {
		margin-left: auto;

		i {
			font-size: 0.875rem;
			color: var(--nimble-medium-text-color);
		}

		&:hover i {
			color: var(--nimble-dark-text-color);
		}
	}

	// Action tabs (horizontal row)
	.heroic-actions-tabs {
		display: flex;
		gap: 0.25rem;
	}

	.heroic-action-tab {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		flex: 1;
		height: 2.25rem;
		padding: 0;
		background: var(--nimble-box-background-color);
		border: 2px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: all 0.2s ease;

		i {
			font-size: 1rem;
			color: var(--nimble-medium-text-color);
			transition: color 0.2s ease;
		}

		&__indicator {
			position: absolute;
			top: 0.25rem;
			right: 0.25rem;
			width: 0.5rem;
			height: 0.5rem;
			border-radius: 50%;
			background: transparent;
			border: 2px solid transparent;
			transition: all 0.2s ease;
		}

		&:hover:not(:disabled):not(.heroic-action-tab--active) {
			border-color: var(--nimble-accent-color);

			i {
				color: var(--nimble-dark-text-color);
			}
		}

		&--active {
			border-color: hsl(45, 60%, 45%);
			background: hsla(45, 60%, 50%, 0.12);
			box-shadow: inset 0 0 0 1px hsla(45, 60%, 50%, 0.2);

			i {
				color: hsl(45, 60%, 40%);
			}

			.heroic-action-tab__indicator {
				background: hsl(45, 70%, 50%);
				border-color: hsl(45, 70%, 40%);
				box-shadow: 0 0 8px hsla(45, 70%, 50%, 0.6);
			}
		}

		&--disabled {
			opacity: 0.5;
			cursor: not-allowed;
		}
	}

	:global(.theme-dark) .heroic-action-tab {
		background: hsl(220, 15%, 18%);
		border-color: hsl(220, 10%, 30%);

		&:hover:not(:disabled):not(.heroic-action-tab--active) {
			border-color: hsl(220, 15%, 45%);
			background: hsl(220, 15%, 22%);
		}
	}

	:global(.theme-dark) .heroic-action-tab--active {
		border-color: hsl(45, 70%, 55%);
		background: linear-gradient(135deg, hsla(45, 60%, 50%, 0.2) 0%, hsla(45, 60%, 40%, 0.1) 100%);
		box-shadow:
			inset 0 0 0 1px hsla(45, 60%, 60%, 0.3),
			0 0 12px hsla(45, 60%, 50%, 0.15);
	}

	:global(.theme-dark) .heroic-action-tab--active i {
		color: hsl(45, 70%, 65%);
	}

	:global(.theme-dark) .heroic-action-tab--active .heroic-action-tab__indicator {
		background: hsl(45, 70%, 55%);
		border-color: hsl(45, 70%, 65%);
		box-shadow: 0 0 10px hsla(45, 70%, 55%, 0.7);
	}

	.heroic-actions-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;

		&__search {
			display: flex;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			max-height: 300px;
			overflow-y: auto;
		}

		&__empty {
			margin: 0;
			padding: 0.75rem;
			font-size: var(--nimble-sm-text);
			font-weight: 500;
			text-align: center;
			color: var(--nimble-medium-text-color);
		}
	}

	.nimble-item-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.weapon-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
		}

		&__icon {
			display: flex;
			align-items: center;
			justify-content: center;
			width: 2rem;
			height: 2rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 3px;
			flex-shrink: 0;

			i {
				font-size: 1rem;
				color: var(--nimble-medium-text-color);
			}
		}

		&__img {
			width: 2rem;
			height: 2rem;
			object-fit: cover;
			border-radius: 3px;
			flex-shrink: 0;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__name {
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__meta {
			display: flex;
			flex-wrap: wrap;
			align-items: center;
			gap: 0.25rem;
		}

		&__tag {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			padding: 0 0.25rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 2px;
		}

		&__damage {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.25rem 0.625rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-basic-button-background-color);
			border-radius: 3px;
			flex-shrink: 0;

			i {
				font-size: 0.875rem;
				color: hsl(0, 60%, 50%);
			}
		}
	}

	.spell-card {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem;
		background: var(--nimble-box-background-color);
		border: 1px solid var(--nimble-card-border-color);
		border-radius: 4px;
		cursor: pointer;
		transition: var(--nimble-standard-transition);

		&:hover {
			border-color: var(--nimble-box-color);
			box-shadow: var(--nimble-box-shadow);
		}

		&__img {
			width: 2rem;
			height: 2rem;
			object-fit: cover;
			border-radius: 3px;
			flex-shrink: 0;
		}

		&__content {
			display: flex;
			flex-direction: column;
			gap: 0.125rem;
			flex: 1;
			min-width: 0;
		}

		&__name {
			display: flex;
			align-items: center;
			gap: 0.375rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			line-height: 1.2;
		}

		&__tag {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
			padding: 0 0.25rem;
			background: var(--nimble-basic-button-background-color);
			border-radius: 2px;
		}

		&__meta {
			display: flex;
			align-items: center;
			gap: 0.75rem;
		}

		&__effect {
			display: inline-flex;
			align-items: center;
			gap: 0.375rem;
			padding: 0.25rem 0.625rem;
			font-size: var(--nimble-sm-text);
			font-weight: 600;
			color: var(--nimble-dark-text-color);
			background: var(--nimble-basic-button-background-color);
			border-radius: 3px;
			flex-shrink: 0;

			i {
				font-size: 0.875rem;
				color: hsl(0, 60%, 50%);
			}

			&--healing i {
				color: hsl(139, 50%, 40%);
			}
		}

		&__action-cost {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__range {
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: var(--nimble-medium-text-color);
		}

		&__mana {
			display: inline-flex;
			align-items: center;
			gap: 0.25rem;
			font-size: var(--nimble-xs-text);
			font-weight: 500;
			color: hsl(270, 50%, 45%);

			i {
				font-size: 0.625rem;
			}
		}
	}
</style>
