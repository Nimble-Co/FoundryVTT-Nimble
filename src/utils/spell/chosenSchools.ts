type RuleSource = {
	type?: unknown;
	id?: unknown;
	mode?: unknown;
	chosenSchools?: unknown;
	predicate?: unknown;
};

/** The id of each school choice rule, and the schools the player chose for it. */
export type SchoolChoices = ReadonlyMap<string, readonly string[]>;

interface ChoiceItem {
	system?: { rules?: unknown };
	update(data: Record<string, unknown>): Promise<unknown>;
}

function isSchoolChoice(rule: RuleSource): boolean {
	return rule?.type === 'grantSpells' && rule.mode === 'selectSchool';
}

function sameSchools(stored: unknown, chosen: readonly string[]): boolean {
	return (
		Array.isArray(stored) &&
		stored.length === chosen.length &&
		chosen.every((school) => stored.includes(school))
	);
}

/** The item's rules with each choice stored on its school choice rule, or null when no rule changes. */
function withChosenSchools(system: unknown, choices: SchoolChoices): RuleSource[] | null {
	const rules = (system as { rules?: unknown } | undefined)?.rules;
	if (choices.size === 0 || !Array.isArray(rules)) return null;
	let changed = false;
	const next = (rules as RuleSource[]).map((rule) => {
		const chosen = isSchoolChoice(rule) ? choices.get(String(rule.id)) : undefined;
		if (!chosen || sameSchools(rule.chosenSchools, chosen)) return rule;
		changed = true;
		return { ...rule, chosenSchools: [...chosen] };
	});
	return changed ? next : null;
}

/** Stores each choice on the school choice rules of an item source that is not yet created. */
export function storeChosenSchoolsOnSource(
	source: { system?: unknown },
	choices: SchoolChoices,
): void {
	const rules = withChosenSchools(source.system, choices);
	if (rules) (source.system as { rules: unknown }).rules = rules;
}

/** Stores each choice on the school choice rule of every item of the actor that holds it. */
export async function storeChosenSchools(
	actor: { items: Iterable<ChoiceItem> },
	choices: SchoolChoices,
): Promise<void> {
	for (const item of actor.items) {
		const rules = withChosenSchools(item.system, choices);
		if (rules) await item.update({ 'system.rules': rules });
	}
}

/** The level a school choice rule asks at: the minimum of its level condition. */
function choiceLevel(rule: RuleSource): number | undefined {
	const level = (rule.predicate as { level?: { min?: unknown } } | undefined)?.level;
	return typeof level?.min === 'number' ? level.min : undefined;
}

/** Takes back the school choices made at a level, when that level is taken back. */
export async function forgetSchoolChoicesAt(
	actor: { items: Iterable<ChoiceItem> },
	level: number,
): Promise<void> {
	const choices = new Map<string, string[]>();
	for (const item of actor.items) {
		const rules = item.system?.rules;
		if (!Array.isArray(rules)) continue;
		for (const rule of rules as RuleSource[]) {
			const chosen = rule?.chosenSchools;
			if (!isSchoolChoice(rule) || !Array.isArray(chosen) || chosen.length === 0) continue;
			if (choiceLevel(rule) === level) choices.set(String(rule.id), []);
		}
	}
	await storeChosenSchools(actor, choices);
}
