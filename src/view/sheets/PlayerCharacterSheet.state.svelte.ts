import { setContext, untrack } from 'svelte';
import { createSubscriber } from 'svelte/reactivity';
import { readable } from 'svelte/store';
import { incrementDieSize } from '#managers/HitDiceManager.js';
import {
	getInitiativeCombatManaRules,
	primeActorCombatManaSourceRules,
} from '#utils/combatManaRules.js';
import { getActiveCombatForCurrentScene, registerCombatStateHooks } from '#utils/combatState.js';

type NavigationComponents = {
	core: unknown;
	actions: unknown;
	conditions: unknown;
	inventory: unknown;
	features: unknown;
	spells: unknown;
	bio: unknown;
	settings: unknown;
};

function getHitPointPercentage(currentHP: number, maxHP: number): number {
	return Math.clamp(0, Math.round((currentHP / maxHP) * 100), 100);
}

function hasInitiativeCombatManaRule(character: any, _primeVersion = 0): boolean {
	const rules = getInitiativeCombatManaRules(character);
	return rules.length > 0;
}

function hasRolledInitiativeInActiveCombat(character: any): boolean {
	const combat = getActiveCombatForCurrentScene();
	if (!combat?.started) return false;

	const sceneId = canvas?.scene?.id;
	if (sceneId && combat.scene?.id !== sceneId) return false;

	const combatant = combat.combatants.find((entry) => entry.actorId === character.id);
	if (!combatant) return false;

	return combatant.initiative !== null;
}

export function createPlayerCharacterSheetState(params: {
	actor: () => any;
	sheet: () => any;
	navigationComponents: NavigationComponents;
}) {
	const actor = $derived(params.actor());
	const sheet = $derived(params.sheet());
	const { sizeCategories } = CONFIG.NIMBLE;
	const subscribeCombatState = createSubscriber(registerCombatStateHooks);

	function prepareCharacterMetadata(
		characterClass: any,
		subclass: any,
		ancestry: any,
		sizeCategory: string,
	): string {
		const origins: string[] = [];

		if (ancestry) {
			origins.push(`${ancestry.name} (${sizeCategories[sizeCategory] ?? sizeCategory})`);
		}

		if (characterClass) {
			if (subclass) {
				origins.push(
					`${characterClass.name} (${subclass.name}, ${characterClass.system.classLevel})`,
				);
			} else {
				origins.push(`${characterClass.name} (${characterClass.system.classLevel})`);
			}
		}

		return origins.filter(Boolean).join(' | ');
	}

	let combatManaRulesPrimeVersion = $state(0);
	let lastCombatManaPrimeActorId = $state<string | null>(null);

	$effect(() => {
		const actorId = actor?.id ?? null;
		if (!actorId) return;
		if (lastCombatManaPrimeActorId === actorId) return;

		lastCombatManaPrimeActorId = actorId;
		void primeActorCombatManaSourceRules(actor).then(() => {
			combatManaRulesPrimeVersion += 1;
		});
	});

	const navigation = [
		{
			component: params.navigationComponents.core,
			icon: 'fa-solid fa-home',
			tooltip: 'Core',
			name: 'core',
		},
		{
			component: params.navigationComponents.actions,
			icon: 'fa-solid fa-bolt',
			tooltip: 'Actions',
			name: 'actions',
		},
		{
			component: params.navigationComponents.conditions,
			icon: 'fa-solid fa-heart-pulse',
			tooltip: 'NIMBLE.ui.conditions',
			name: 'conditions',
		},
		{
			component: params.navigationComponents.inventory,
			icon: 'fa-solid fa-box-open',
			tooltip: 'Inventory',
			name: 'inventory',
		},
		{
			component: params.navigationComponents.features,
			icon: 'fa-solid fa-table-list',
			tooltip: 'Features',
			name: 'features',
		},
		{
			component: params.navigationComponents.spells,
			icon: 'fa-solid fa-wand-sparkles',
			tooltip: 'Spells',
			name: 'spells',
		},
		{
			component: params.navigationComponents.bio,
			icon: 'fa-solid fa-file-lines',
			tooltip: 'Bio',
			name: 'bio',
		},
		{
			component: params.navigationComponents.settings,
			icon: 'fa-solid fa-cog',
			tooltip: 'Settings',
			name: 'settings',
		},
	] as const;

	let currentTab = $state<(typeof navigation)[number]>(navigation[0]);

	const isBloodied = $derived.by(
		() =>
			getHitPointPercentage(
				actor.reactive.system.attributes.hp.value,
				actor.reactive.system.attributes.hp.max,
			) <= 50,
	);

	const classItem = $derived(
		actor.reactive.items.find((item: any) => item.type === 'class') ?? null,
	);
	const wounds = $derived(actor.reactive.system.attributes.wounds);
	const mana = $derived(actor.reactive.system.resources.mana);
	const hasInitiativeCombatMana = $derived.by(() =>
		hasInitiativeCombatManaRule(actor, combatManaRulesPrimeVersion),
	);
	const combatManaVisible = $derived.by(() => {
		subscribeCombatState();
		return hasInitiativeCombatMana && hasRolledInitiativeInActiveCombat(actor);
	});
	const hasMana = $derived.by(() => {
		subscribeCombatState();

		const classHasManaFormula = actor.reactive.items.some(
			(item: any) => item.type === 'class' && item.system?.mana?.formula?.length,
		);

		if (hasInitiativeCombatMana) {
			return combatManaVisible;
		}

		if ((mana.max ?? 0) > 0 || (mana.baseMax ?? 0) > 0) return true;
		return classHasManaFormula;
	});

	const flags = $derived(actor.reactive.flags.nimble);
	const actorImageXOffset = $derived(flags?.actorImageXOffset ?? 0);
	const actorImageYOffset = $derived(flags?.actorImageYOffset ?? 0);
	const actorImageScale = $derived(flags?.actorImageScale ?? 100);
	const editingEnabled = $derived(flags?.editingEnabled ?? false);

	const editingEnabledStore = readable(false, (set) => {
		$effect(() => set(editingEnabled));
		return () => {};
	});

	const metaData = $derived.by(() => {
		const characterClass = actor.reactive.items.find((item: any) => item.type === 'class') ?? null;
		const subclass = actor.reactive.items.find((item: any) => item.type === 'subclass') ?? null;
		const ancestry = actor.reactive.items.find((item: any) => item.type === 'ancestry') ?? null;
		const sizeCategory = actor.reactive.system.attributes.sizeCategory;
		return prepareCharacterMetadata(characterClass, subclass, ancestry, sizeCategory);
	});

	const hitDiceData = $derived.by(() => {
		const hitDiceAttr = actor.reactive.system.attributes.hitDice;
		const bonusHitDice = actor.reactive.system.attributes.bonusHitDice ?? [];
		const classes = actor.reactive.items.filter((item: any) => item.type === 'class');
		const hitDiceSizeBonus = actor.reactive.system.attributes.hitDiceSizeBonus ?? 0;
		const bySize: Record<number, { current: number; total: number }> = {};

		for (const cls of classes) {
			const baseSize = cls.system.hitDieSize;
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const classLevel = cls.system.classLevel;
			bySize[size] ??= { current: 0, total: 0 };
			bySize[size].total += classLevel;
			bySize[size].current = hitDiceAttr[size]?.current ?? 0;
		}

		const effectiveClassSizes = classes.map((cls: any) =>
			incrementDieSize(cls.system.hitDieSize, hitDiceSizeBonus),
		);

		for (const entry of bonusHitDice) {
			const size = incrementDieSize(entry.size, hitDiceSizeBonus);
			bySize[size] ??= { current: hitDiceAttr[size]?.current ?? 0, total: 0 };
			bySize[size].total += entry.value;
			if (!effectiveClassSizes.includes(size)) {
				bySize[size].current = hitDiceAttr[size]?.current ?? 0;
			}
		}

		const effectiveBonusArraySizes = bonusHitDice.map((entry: any) =>
			incrementDieSize(entry.size, hitDiceSizeBonus),
		);

		for (const [sizeStr, hitDieData] of Object.entries(hitDiceAttr ?? {})) {
			const baseSize = Number(sizeStr);
			const size = incrementDieSize(baseSize, hitDiceSizeBonus);
			const bonus = (hitDieData as { bonus?: number })?.bonus ?? 0;
			if (bonus > 0) {
				bySize[size] ??= { current: 0, total: 0 };
				bySize[size].total += bonus;

				const fromClass = effectiveClassSizes.includes(size);
				const fromBonusArray = effectiveBonusArraySizes.includes(size);
				if (!fromClass && !fromBonusArray) {
					bySize[size].current = hitDiceAttr[size]?.current ?? 0;
				}
			}
		}

		let value = 0;
		let max = 0;
		for (const data of Object.values(bySize)) {
			value += data.current;
			max += data.total;
		}

		return { bySize, value, max };
	});

	{
		const actorRef = untrack(() => actor);
		const sheetRef = untrack(() => sheet);
		setContext('actor', actorRef);
		setContext('document', actorRef);
		setContext('application', sheetRef);
		setContext('editingEnabled', editingEnabledStore);
	}

	function toggleWounds(woundLevel: number): void {
		let newWoundsValue = woundLevel;
		if (woundLevel <= wounds.value) newWoundsValue = woundLevel - 1;

		void actor.update({
			'system.attributes.wounds.value': newWoundsValue,
		});
	}

	function updateCurrentHP(newValue: number): void {
		void actor.update({
			'system.attributes.hp.value': newValue,
		});
	}

	function updateMaxHP(newValue: number): void {
		void actor.update({
			'system.attributes.hp.max': newValue,
		});
	}

	function updateTempHP(newValue: number): void {
		void actor.update({
			'system.attributes.hp.temp': newValue,
		});
	}

	function updateCurrentMana(newValue: number): void {
		void actor.update({
			'system.resources.mana.current': newValue,
		});
	}

	function updateMaxMana(newValue: number): void {
		const manaData = actor.reactive.system.resources.mana;
		const baseMax = manaData.baseMax ?? 0;
		const max = manaData.max || baseMax;
		const formulaBonus = max - baseMax;
		const adjustedBaseMax = Math.max(0, newValue - formulaBonus);

		void actor.update({
			'system.resources.mana.baseMax': adjustedBaseMax,
		});
	}

	async function updateCurrentHitDice(newValue: number): Promise<void> {
		await actor.updateCurrentHitDice(newValue);
	}

	async function rollHitDice(): Promise<void> {
		await actor.rollHitDice();
	}

	async function editCurrentHitDice(): Promise<void> {
		await actor.editCurrentHitDice();
	}

	async function toggleEditingEnabled(): Promise<void> {
		await actor.setFlag('nimble', 'editingEnabled', !editingEnabled);
	}

	return {
		get navigation() {
			return navigation;
		},
		get currentTab() {
			return currentTab;
		},
		set currentTab(value) {
			currentTab = value;
		},
		get isBloodied() {
			return isBloodied;
		},
		get classItem() {
			return classItem;
		},
		get wounds() {
			return wounds;
		},
		get mana() {
			return mana;
		},
		get hasMana() {
			return hasMana;
		},
		get actorImageXOffset() {
			return actorImageXOffset;
		},
		get actorImageYOffset() {
			return actorImageYOffset;
		},
		get actorImageScale() {
			return actorImageScale;
		},
		get editingEnabled() {
			return editingEnabled;
		},
		get metaData() {
			return metaData;
		},
		get hitDiceData() {
			return hitDiceData;
		},
		toggleWounds,
		updateCurrentHP,
		updateMaxHP,
		updateTempHP,
		updateCurrentMana,
		updateMaxMana,
		updateCurrentHitDice,
		rollHitDice,
		editCurrentHitDice,
		toggleEditingEnabled,
	};
}
