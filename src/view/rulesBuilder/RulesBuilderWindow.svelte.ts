import { SvelteSet } from 'svelte/reactivity';

import type { RuleHolder, RuleSource } from '#view/rulesBuilder/types.js';

// Internal clipboard drag-drop type, set and matched by the same code; never
// crosses the Foundry system-id boundary, so the literal is intentional.
export const COPY_TYPE = 'nimble.Rule'; // allow-hardcoded-system-id

export function createRulesBuilderWindowState(getRuleParent: () => RuleHolder) {
	const rawRules = $derived(
		(getRuleParent().reactive.system as unknown as { rules: RuleSource[] }).rules,
	);

	// Sort by priority so display order matches the order Foundry actually
	// applies rules in (Actor.prepareRules uses the same stable sort).
	const rules = $derived(
		[...rawRules].sort((a, b) => ((a.priority as number) ?? 1) - ((b.priority as number) ?? 1)),
	);

	// Surface the actor's tag domain to predicate builders so the key input can
	// offer typeahead suggestions. Undefined when no actor holds the document
	// (e.g. compendium edit).
	const previewDomain = $derived(
		(getRuleParent().actor as { getDomain?: () => Set<string> } | null)?.getDomain?.(),
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
		if (allDisabled) await getRuleParent().rules.enableAllRules();
		else await getRuleParent().rules.disableAllRules();
	}

	async function pickRule(ruleKey: string) {
		await getRuleParent().rules.addRule({ type: ruleKey });
		pickerOpen = false;
	}

	// Drop target only — cards in here aren't draggable so the inline editing
	// they're built for doesn't fight with drag gestures.
	async function copyRuleFromPayload(payload: Record<string, unknown>) {
		const ruleParent = getRuleParent();
		if (payload.sourceItemUuid === ruleParent.uuid) return;
		const incoming = payload.rule as Record<string, unknown> | undefined;
		if (!incoming || typeof incoming !== 'object') return;
		const { id: _id, ...rest } = incoming;
		await ruleParent.rules.addRule(rest);
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
