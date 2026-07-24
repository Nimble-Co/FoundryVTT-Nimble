import localize from '#utils/localize.js';

interface PickerEntry {
	key: string;
	label: string;
	group: string;
	description: string;
	icon: string;
	hasDevWarning: boolean;
}

const RULE_ICONS: Record<string, string> = {
	abilityBonus: 'fa-solid fa-dumbbell',
	applyCondition: 'fa-solid fa-bolt-lightning',
	armorClass: 'fa-solid fa-shield-halved',
	chargeConsumer: 'fa-solid fa-arrow-down-from-line',
	chargePool: 'fa-solid fa-battery-three-quarters',
	combatMana: 'fa-solid fa-droplet',
	conditionImmunity: 'fa-solid fa-shield-virus',
	damageBonus: 'fa-solid fa-explosion',
	dyingActionLimit: 'fa-solid fa-skull',
	grantItem: 'fa-solid fa-gift',
	grantProficiency: 'fa-solid fa-graduation-cap',
	grantSpells: 'fa-solid fa-wand-magic-sparkles',
	healingPotionBonus: 'fa-solid fa-flask-round-potion',
	hitDiceAdvantage: 'fa-solid fa-dice-d20',
	incrementHitDice: 'fa-solid fa-up-long',
	initiativeBonus: 'fa-solid fa-bolt',
	initiativeMessage: 'fa-solid fa-message',
	initiativeRollMode: 'fa-solid fa-dice',
	maxHitDice: 'fa-solid fa-dice-d20',
	maxHpBonus: 'fa-solid fa-heart',
	maximizeHitDice: 'fa-solid fa-arrow-up-from-bracket',
	maxWounds: 'fa-solid fa-droplet-slash',
	note: 'fa-solid fa-note-sticky',
	savingThrowBonus: 'fa-solid fa-shield',
	savingThrowRollMode: 'fa-solid fa-dice-five',
	skillBonus: 'fa-solid fa-screwdriver-wrench',
	skillRollMode: 'fa-solid fa-dice-d20',
	speedBonus: 'fa-solid fa-person-running',
	unarmedDamage: 'fa-solid fa-hand-fist',
};

const GROUP_META: Record<string, { label: string; icon: string }> = {
	bonuses: { label: 'Bonuses', icon: 'fa-solid fa-plus' },
	triggers: { label: 'Triggers', icon: 'fa-solid fa-bolt' },
	grants: { label: 'Grants', icon: 'fa-solid fa-gift' },
	conditions: { label: 'Conditions', icon: 'fa-solid fa-circle-radiation' },
	resource: { label: 'Resources', icon: 'fa-solid fa-battery-half' },
	notes: { label: 'Notes', icon: 'fa-solid fa-note-sticky' },
	unsorted: { label: 'Other', icon: 'fa-solid fa-cube' },
};

export function createRuleTypePickerState() {
	const groupedEntries = $derived.by(() => {
		const { ruleDataModels, ruleTypes } = CONFIG.NIMBLE;
		const buckets = new Map<string, PickerEntry[]>();

		for (const [key, RuleClass] of Object.entries(ruleDataModels)) {
			const Cls = RuleClass as unknown as { group?: string; description?: string };
			const group = Cls.group ?? 'unsorted';
			const descriptionKey = Cls.description ?? '';
			const localizedDescription = descriptionKey ? localize(descriptionKey) : '';
			const hasDevWarning =
				group === 'unsorted' ||
				descriptionKey === '' ||
				descriptionKey.toUpperCase().includes('TODO') ||
				localizedDescription === descriptionKey;

			const entry: PickerEntry = {
				key,
				label: localize(ruleTypes[key] ?? key),
				group,
				description: localizedDescription || descriptionKey,
				icon: RULE_ICONS[key] ?? 'fa-solid fa-cube',
				hasDevWarning,
			};

			const list = buckets.get(group) ?? [];
			list.push(entry);
			buckets.set(group, list);
		}

		const groupOrder = [
			'bonuses',
			'triggers',
			'grants',
			'conditions',
			'resource',
			'notes',
			'unsorted',
		];

		return groupOrder
			.filter((g) => buckets.has(g))
			.map((g) => ({
				group: g,
				meta: GROUP_META[g] ?? { label: g, icon: 'fa-solid fa-cube' },
				entries: (buckets.get(g) ?? []).sort((a, b) => a.label.localeCompare(b.label)),
			}));
	});

	function setupDevWarningsEffect(): void {
		$effect(() => {
			for (const { entries } of groupedEntries) {
				for (const entry of entries) {
					if (!entry.hasDevWarning) continue;

					console.warn(
						`Nimble | Rule "${entry.key}" is missing presentation metadata (group=${entry.group}, description=${entry.description}). Picker will show a placeholder.`,
					);
				}
			}
		});
	}

	return {
		get groupedEntries() {
			return groupedEntries;
		},
		setupDevWarningsEffect,
	};
}
