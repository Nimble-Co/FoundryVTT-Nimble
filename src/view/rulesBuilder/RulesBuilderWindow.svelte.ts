import { SvelteSet } from 'svelte/reactivity';

import type { NimbleBaseItem } from '#documents/item/base.svelte.js';
import type { RuleSource } from '#view/rulesBuilder/types.js';

export const COPY_TYPE = 'nimble.Rule';

export function createRulesBuilderWindowState(getItem: () => NimbleBaseItem) {
	const rawRules = $derived(
		(getItem().reactive.system as unknown as { rules: RuleSource[] }).rules,
	);

	// Sort by priority so display order matches the order Foundry actually
	// applies rules in (Actor.prepareRules uses the same stable sort).
	const rules = $derived(
		[...rawRules].sort((a, b) => ((a.priority as number) ?? 1) - ((b.priority as number) ?? 1)),
	);

	// Surface the parent actor's tag domain to predicate builders so the key
	// input can offer typeahead suggestions. Undefined when the item isn't
	// owned by an actor (e.g. compendium edit).
	const previewDomain = $derived(
		(getItem().actor as { getDomain?: () => Set<string> } | null)?.getDomain?.(),
	);
	const allDisabled = $derived(rules.length > 0 && rules.every((r) => r.disabled));

	let pickerOpen = $state(false);
	const collapsedIds = $state<Set<string>>(new SvelteSet());

	const allCollapsed = $derived(rules.length > 0 && rules.every((r) => collapsedIds.has(r.id)));

	function toggleCollapse(id: string) {
		if (collapsedIds.has(id)) collapsedIds.delete(id);
		else collapsedIds.add(id);
	}

	function toggleCollapseAll() {
		if (allCollapsed) collapsedIds.clear();
		else for (const r of rules) collapsedIds.add(r.id);
	}

	async function toggleAll() {
		if (allDisabled) await getItem().rules.enableAllRules();
		else await getItem().rules.disableAllRules();
	}

	async function pickRule(ruleKey: string) {
		await getItem().rules.addRule({ type: ruleKey });
		pickerOpen = false;
	}

	// Drop target only — cards in here aren't draggable so the inline editing
	// they're built for doesn't fight with drag gestures.
	async function copyRuleFromPayload(payload: Record<string, unknown>) {
		const item = getItem();
		if (payload.sourceItemUuid === item.uuid) return;
		const incoming = payload.rule as Record<string, unknown> | undefined;
		if (!incoming || typeof incoming !== 'object') return;
		const { id: _id, ...rest } = incoming;
		await item.rules.addRule(rest);
	}

	function setPickerOpen(next: boolean) {
		pickerOpen = next;
	}

	return {
		get rules() {
			return rules;
		},
		get previewDomain() {
			return previewDomain;
		},
		get allDisabled() {
			return allDisabled;
		},
		get allCollapsed() {
			return allCollapsed;
		},
		get pickerOpen() {
			return pickerOpen;
		},
		get collapsedIds() {
			return collapsedIds;
		},
		setPickerOpen,
		toggleCollapse,
		toggleCollapseAll,
		toggleAll,
		pickRule,
		copyRuleFromPayload,
	};
}
