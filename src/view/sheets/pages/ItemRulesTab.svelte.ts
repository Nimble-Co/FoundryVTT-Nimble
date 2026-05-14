import { SvelteSet } from 'svelte/reactivity';

import GenericDialog from '#documents/dialogs/GenericDialog.svelte.js';
import type { NimbleBaseItem } from '#documents/item/base.svelte.js';
import type { RuleSource } from '#view/rulesBuilder/types.js';

export const COPY_TYPE = 'nimble.Rule';

type DialogComponent = Parameters<typeof GenericDialog.getOrCreate>[1];

export function createItemRulesTabState(
	getItem: () => NimbleBaseItem,
	getRulesBuilderComponent: () => DialogComponent,
) {
	const rawRules = $derived(
		(getItem().reactive.system as unknown as { rules: RuleSource[] }).rules,
	);

	// Display order = application order (sort by ascending priority, stable).
	const rules = $derived(
		[...rawRules].sort((a, b) => ((a.priority as number) ?? 1) - ((b.priority as number) ?? 1)),
	);

	// Per-row JSON-editor state. Lets a user repair a rule whose schema the
	// builder can't render — e.g. a corrupt source from an older version.
	const jsonOpenIds = $state<Set<string>>(new SvelteSet());
	const jsonDrafts = $state<Record<string, string>>({});
	const jsonErrors = $state<Record<string, string | null>>({});

	function toggleJson(rule: RuleSource) {
		if (jsonOpenIds.has(rule.id)) {
			jsonOpenIds.delete(rule.id);
			return;
		}
		jsonDrafts[rule.id] = JSON.stringify(rule, null, 2);
		jsonErrors[rule.id] = null;
		jsonOpenIds.add(rule.id);
	}

	async function commitJson(ruleId: string) {
		try {
			const parsed = JSON.parse(jsonDrafts[ruleId] ?? '');
			await getItem().rules.updateRule(ruleId, parsed);
			jsonErrors[ruleId] = null;
			jsonOpenIds.delete(ruleId);
		} catch (err) {
			jsonErrors[ruleId] = err instanceof Error ? err.message : 'Invalid JSON';
		}
	}

	function getDragPayload(id: string): Record<string, unknown> | null {
		const source = rules.find((r) => r.id === id);
		if (!source) return null;
		const cloned = foundry.utils.deepClone(source) as Record<string, unknown>;
		return {
			rule: cloned,
			sourceItemUuid: getItem().uuid,
		};
	}

	async function copyRuleFromPayload(payload: Record<string, unknown>) {
		const item = getItem();
		if (payload.sourceItemUuid === item.uuid) return;
		const incoming = payload.rule as Record<string, unknown> | undefined;
		if (!incoming || typeof incoming !== 'object') return;
		const { id: _id, ...rest } = incoming;
		await item.rules.addRule(rest);
	}

	function openBuilder() {
		const item = getItem();
		const dialog = GenericDialog.getOrCreate(
			`${item.name}: Rules Builder`,
			getRulesBuilderComponent(),
			{ document: item },
			{
				uniqueId: `rules-builder-${item.uuid}`,
				icon: 'fa-solid fa-sliders',
				width: 720,
				resizable: true,
			},
		);
		dialog.render(true);
	}

	return {
		get rules() {
			return rules;
		},
		get jsonOpenIds() {
			return jsonOpenIds;
		},
		get jsonDrafts() {
			return jsonDrafts;
		},
		get jsonErrors() {
			return jsonErrors;
		},
		toggleJson,
		commitJson,
		openBuilder,
		getDragPayload,
		copyRuleFromPayload,
	};
}
