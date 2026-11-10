import localize from '#utils/localize.js';

interface PickerEntry {
	key: string;
	label: string;
	group: string;
	description: string;
	icon: string;
	hasDevWarning: boolean;
}

const GROUP_META: Record<string, { label: string; icon: string }> = {
	bonuses: { label: 'Bonuses', icon: 'fa-solid fa-plus' },
	triggers: { label: 'Triggers', icon: 'fa-solid fa-bolt' },
	grants: { label: 'Grants', icon: 'fa-solid fa-gift' },
	conditions: { label: 'Conditions', icon: 'fa-solid fa-circle-radiation' },
	resource: { label: 'Resources', icon: 'fa-solid fa-battery-half' },
	notes: { label: 'Notes', icon: 'fa-solid fa-note-sticky' },
	unsorted: { label: 'Other', icon: 'fa-solid fa-cube' },
};

export function createRuleTypePickerState(getForEffect: () => boolean = () => false) {
	const groupedEntries = $derived.by(() => {
		const { ruleDataModels, ruleTypes } = CONFIG.NIMBLE;
		const buckets = new Map<string, PickerEntry[]>();
		const forEffect = getForEffect();

		for (const [key, RuleClass] of Object.entries(ruleDataModels)) {
			const Cls = RuleClass as unknown as {
				group?: string;
				description?: string;
				icon?: string;
				worksOnEffects?: boolean;
			};
			if (forEffect && Cls.worksOnEffects === false) continue;
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
				icon: Cls.icon ?? 'fa-solid fa-cube',
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
