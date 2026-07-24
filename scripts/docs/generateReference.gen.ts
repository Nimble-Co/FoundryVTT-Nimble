/**
 * Generates the user-documentation reference pages from the system's source of
 * truth: rule DataModel schemas, settings registrations, and the conditions
 * config, with display text resolved through en.json.
 *
 * Runs as a vitest spec (`pnpm docs:generate`) so it can reuse tests/setup.ts,
 * which boots the real init()/i18nInit() under the Foundry mocks. Output lands
 * in docs/documentation/reference/ and is gitignored; CI regenerates it on
 * every docs deploy.
 *
 * Hand-written worked examples live in docs/documentation/reference/_partials/
 * (<ruleTypeKey>.md) and are inlined beneath the matching generated entry.
 */

import fs from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

import { registerAdjacencySettings } from '../../src/settings/adjacencySettings.js';
import { registerCombatTrackerSettings } from '../../src/settings/combatTrackerSettings.js';
import registerSystemSettings from '../../src/settings/index.js';
import { registerNcswSettings } from '../../src/settings/ncswSettings.js';

const OUT_DIR = path.resolve(process.cwd(), 'docs/documentation/reference');
const PARTIALS_DIR = path.join(OUT_DIR, '_partials');

const BANNER = `<!--
  GENERATED FILE. DO NOT EDIT.
  Generated from the system source by scripts/docs/generateReference.gen.ts.
  Regenerate with: pnpm docs:generate
  Worked examples are hand-written in docs/documentation/reference/_partials/.
-->`;

interface FoundryGlobals {
	game: { i18n: { localize(key: string): string } };
	CONFIG: { NIMBLE: Record<string, any> };
}

const globals = globalThis as object as FoundryGlobals;
const localize = (key: string): string => globals.game.i18n.localize(key);

function writePage(fileName: string, body: string): void {
	// The docs style bans em-dashes. Localized UI strings occasionally contain
	// them, so normalize on the way out: clause-joining dashes become colons,
	// anything left becomes a plain hyphen.
	const sanitized = body.replace(/ — /g, ': ').replace(/—/g, '-');
	fs.mkdirSync(OUT_DIR, { recursive: true });
	fs.writeFileSync(path.join(OUT_DIR, fileName), sanitized);
}

function readPartial(name: string): string | null {
	const partialPath = path.join(PARTIALS_DIR, `${name}.md`);
	if (!fs.existsSync(partialPath)) return null;
	return fs.readFileSync(partialPath, 'utf-8').trim();
}

/** Escape characters that would break a markdown table cell. */
function cell(value: string): string {
	return value.replace(/\|/g, '\\|').replace(/\n+/g, ' ').trim();
}

// Rule and settings strings are authored as plain text, but VitePress compiles
// pages through Vue so we need to escape some stuff.
const VUE_TEXT_ESCAPES: Array<[RegExp, string]> = [
	[/</g, '&lt;'],
	[/>/g, '&gt;'],
	[/\{/g, '&#123;'],
	[/\}/g, '&#125;'],
];

function escapeVueText(value: string): string {
	return VUE_TEXT_ESCAPES.reduce((acc, [pattern, entity]) => acc.replace(pattern, entity), value);
}

/* -------------------------------------------------- */
/*  Rules reference                                   */
/* -------------------------------------------------- */

// Keys and order mirror GROUP_META in the Rules Builder's type picker
// (src/view/rulesBuilder/components/RuleTypePicker.svelte.ts) so the docs
// match what users see in the UI.
const RULE_GROUPS: Array<{ key: string; title: string; intro: string }> = [
	{
		key: 'bonuses',
		title: 'Rules Reference: Bonuses',
		intro:
			'Bonus rules change a number or a roll on the character carrying the item: stats, defenses, speed, hit points, damage, hit dice, and similar. They apply automatically while the item is on the character, and they stack with other bonuses.',
	},
	{
		key: 'triggers',
		title: 'Rules Reference: Triggers',
		intro:
			'Trigger rules react to things happening in play. Use them for effects like "on a critical hit, the target starts burning".',
	},
	{
		key: 'grants',
		title: 'Rules Reference: Grants',
		intro:
			'Grant rules hand the character something extra: another item, spells, proficiencies, or a new movement type. Grants happen when the item is added to the character and are cleaned up when it is removed.',
	},
	{
		key: 'conditions',
		title: 'Rules Reference: Conditions',
		intro:
			'Condition rules interact with the condition system, for example by making a character immune to a condition entirely.',
	},
	{
		key: 'resource',
		title: 'Rules Reference: Resources',
		intro:
			'Resource rules give an item (or the character) a pool to spend: charges, dice, or combat-only mana. Pools can be consumed by item activations and refilled on rests or other events.',
	},
	{
		key: 'notes',
		title: 'Rules Reference: Notes',
		intro:
			'Note rules do not change any numbers. They add reminders and messages so useful information shows up where people are looking.',
	},
];

const BASE_RULE_FIELDS = new Set([
	'disabled',
	'id',
	'identifier',
	'label',
	'predicate',
	'priority',
	'suppressActivationCard',
	'type',
]);

interface FieldRow {
	name: string;
	label: string;
	description: string;
	options: string;
	defaultValue: string;
}

function widgetKindLabel(widget: string | undefined, constructorName: string): string {
	switch (widget) {
		case 'formula':
			return 'Number or formula';
		case 'diceFormula':
			return 'Dice formula';
		case 'documentUuid':
			return 'Drag & drop';
		case 'predicate':
			return 'Condition';
		case 'templateString':
			return 'Text template';
		case 'richText':
			return 'Rich text';
		case 'dicePoolPicker':
			return 'Dice pool picker';
		case 'chargePoolPicker':
			return 'Charge pool picker';
		default:
			break;
	}

	switch (constructorName) {
		case 'BooleanField':
			return 'On/off toggle';
		case 'NumberField':
			return 'Number';
		case 'PredicateField':
			return 'Condition';
		case 'ArrayField':
		case 'SetField':
			return 'List';
		case 'SchemaField':
			return 'Group of fields';
		case 'ObjectField':
			return 'Data';
		default:
			return 'Text';
	}
}

function resolveChoices(rawChoices: unknown): string | null {
	let choices = rawChoices;
	if (typeof choices === 'function') {
		try {
			choices = choices();
		} catch {
			return null;
		}
	}

	if (Array.isArray(choices)) return choices.map(String).join(', ');
	if (choices && typeof choices === 'object') {
		return Object.values(choices as Record<string, string>)
			.map((value) => localize(String(value)))
			.join(', ');
	}
	return null;
}

function resolveInitial(rawInitial: unknown): string {
	let initial = rawInitial;
	if (typeof initial === 'function') {
		try {
			initial = (initial as () => unknown)();
		} catch {
			return 'None';
		}
	}

	if (initial === undefined || initial === null || initial === '') return 'None';
	if (typeof initial === 'boolean') return initial ? 'On' : 'Off';
	if (typeof initial === 'object') return 'None';
	return String(initial);
}

function describeRuleField(name: string, field: any): FieldRow | null {
	const opts = field?.options ?? {};
	if (opts.widget === 'hidden') return null;

	const kind = widgetKindLabel(opts.widget, field?.constructor?.name ?? '');
	const hint = opts.hint ? escapeVueText(localize(opts.hint)) : '';
	const shownConditionally = typeof opts.showWhen === 'function';

	const choiceText = resolveChoices(opts.choices);
	let options = choiceText ?? kind;
	if (choiceText) options = choiceText;

	let description = hint || kind;
	if (hint && !choiceText) description = hint;
	if (shownConditionally) description += ' (Only shown when relevant.)';

	return {
		name,
		label: opts.label ? escapeVueText(localize(opts.label)) : name,
		description,
		options: choiceText ? options : kind,
		defaultValue: resolveInitial(opts.initial),
	};
}

/** Flatten a rule schema into display rows, descending one level into groups/lists. */
function collectFieldRows(schema: Record<string, any>, prefix = '', skipBase = true): FieldRow[] {
	const rows: FieldRow[] = [];

	for (const [name, field] of Object.entries(schema)) {
		if (skipBase && !prefix && BASE_RULE_FIELDS.has(name)) continue;

		const constructorName = field?.constructor?.name ?? '';

		if (constructorName === 'SchemaField' && field.fields) {
			const parent = describeRuleField(name, field);
			if (!parent) continue;
			rows.push(...collectFieldRows(field.fields, `${parent.label} → `, false));
			continue;
		}

		if (
			(constructorName === 'ArrayField' || constructorName === 'SetField') &&
			field.element?.constructor?.name === 'SchemaField' &&
			field.element.fields
		) {
			const parent = describeRuleField(name, field);
			if (!parent) continue;
			rows.push(...collectFieldRows(field.element.fields, `${parent.label} → `, false));
			continue;
		}

		const row = describeRuleField(name, field);
		if (!row) continue;
		row.label = `${prefix}${row.label}`;
		rows.push(row);
	}

	return rows;
}

function generateRulePages(): string[] {
	const { NIMBLE } = globals.CONFIG;
	const ruleDataModels: Record<string, any> = NIMBLE.ruleDataModels;
	const ruleTypes: Record<string, string> = NIMBLE.ruleTypes;

	const byGroup = new Map<string, Array<{ key: string; displayName: string; cls: any }>>();
	for (const [key, cls] of Object.entries(ruleDataModels)) {
		const group = cls.group ?? 'unsorted';
		if (!byGroup.has(group)) byGroup.set(group, []);
		byGroup.get(group)!.push({ key, displayName: localize(ruleTypes[key] ?? key), cls });
	}

	const knownGroups = new Set(RULE_GROUPS.map((g) => g.key));
	const unknownGroups = [...byGroup.keys()].filter((g) => !knownGroups.has(g));
	if (unknownGroups.length > 0) {
		throw new Error(
			`Rule groups without a reference page: ${unknownGroups.join(', ')}. ` +
				'Add them to RULE_GROUPS in scripts/docs/generateReference.gen.ts.',
		);
	}

	const written: string[] = [];

	for (const group of RULE_GROUPS) {
		const entries = (byGroup.get(group.key) ?? []).sort((a, b) =>
			a.displayName.localeCompare(b.displayName),
		);

		const sections = entries.map(({ key, displayName, cls }) => {
			const description = cls.description ? escapeVueText(localize(cls.description)) : '';
			const schema = cls.defineSchema();
			const rows = collectFieldRows(schema);

			let section = `## ${displayName}\n\n${description}\n`;

			if (rows.length > 0) {
				section += '\n| Field | What it does | Options | Default |\n';
				section += '| :--- | :--- | :--- | :--- |\n';
				for (const row of rows) {
					section += `| **${cell(row.label)}** | ${cell(row.description)} | ${cell(row.options)} | ${cell(row.defaultValue)} |\n`;
				}
			} else {
				section +=
					'\nThis rule has no settings of its own beyond the shared fields (label, condition, and so on).\n';
			}

			const partial = readPartial(key);
			if (partial) section += `\n${partial}\n`;

			return section;
		});

		const body = `---
title: "${group.title}"
---

${BANNER}

# ${group.title}

${group.intro}

::: tip Shared fields
Every rule also has a **Label**, **Identifier**, **Condition**, **Priority**, a **Disabled** toggle, and a **Suppress activation card** setting. Those are explained once in [Rules Builder Basics](../rules-builder/index.md).
:::

${sections.join('\n')}`;

		const fileName = `rules-${group.key}.md`;
		writePage(fileName, body);
		written.push(fileName);
	}

	return written;
}

/* -------------------------------------------------- */
/*  Conditions reference                              */
/* -------------------------------------------------- */

function generateConditionsPage(): void {
	const { NIMBLE } = globals.CONFIG;
	const conditions: Record<string, string> = NIMBLE.conditions;
	const descriptions: Record<string, string> = NIMBLE.conditionDescriptions ?? {};
	const aliased: Record<string, readonly string[]> = NIMBLE.conditionAliasedConditions ?? {};
	const linked: Record<string, readonly string[]> = NIMBLE.conditionLinkedConditions ?? {};
	const triggers: Record<string, { triggeredBy: readonly string[] }> =
		NIMBLE.conditionTriggerRelationships ?? {};
	const stackable: Set<string> = NIMBLE.conditionStackableConditions ?? new Set();
	const overlay: Set<string> = NIMBLE.conditionOverlayConditions ?? new Set();

	const name = (id: string): string => localize(conditions[id] ?? id);

	// Descriptions in en.json carry simple HTML; flatten paragraphs to <br>
	// so they behave inside a markdown table cell.
	const flattenHtml = (html: string): string =>
		html
			.replace(/<\/p>\s*<p>/g, '<br>')
			.replace(/<\/?p>/g, '')
			.trim();

	const rows = Object.keys(conditions)
		.sort((a, b) => name(a).localeCompare(name(b)))
		.map((id) => {
			const description = descriptions[id] ? flattenHtml(localize(descriptions[id])) : '';
			const notes: string[] = [];
			if (aliased[id]?.length) notes.push(`Also counts as ${aliased[id].map(name).join(', ')}.`);
			if (linked[id]?.length)
				notes.push(`Automatically applies ${linked[id].map(name).join(', ')}.`);
			if (triggers[id]?.triggeredBy?.length) {
				notes.push(
					`Applied automatically while the character has any of: ${triggers[id].triggeredBy.map(name).join(', ')}.`,
				);
			}
			if (stackable.has(id)) notes.push('Can be applied multiple times; the copies stack.');
			if (overlay.has(id)) notes.push('Shown as a full-token overlay.');

			return `| **${cell(name(id))}** | ${cell(description)} ${cell(notes.join(' '))} |`;
		});

	const body = `---
title: "Conditions Reference"
---

${BANNER}

# Conditions Reference

Every condition the system knows about, with what it does and how it interacts with other conditions. Conditions can be applied from the token, from a character sheet's Conditions tab, or automatically by the system. See [Conditions](../playing/conditions.md) for how that works at the table.

| Condition | What it does |
| :--- | :--- |
${rows.join('\n')}
`;

	writePage('conditions.md', body);
}

/* -------------------------------------------------- */
/*  Settings reference                                */
/* -------------------------------------------------- */

interface CapturedSetting {
	key: string;
	category: string;
	name?: string;
	hint?: string;
	scope?: string;
	config?: boolean;
	type?: any;
	default?: unknown;
	choices?: Record<string, string>;
}

function captureSettings(): CapturedSetting[] {
	const captured: CapturedSetting[] = [];
	const seen = new Set<string>();
	let currentCategory = 'General';

	const gameObject = globals.game as any;
	gameObject.settings = {
		register: (_namespace: string, key: string, data: Record<string, unknown>) => {
			if (seen.has(key)) return;
			seen.add(key);
			captured.push({ key, category: currentCategory, ...data } as CapturedSetting);
		},
		registerMenu: () => {},
		get: () => undefined,
		set: async () => {},
		settings: new Map(),
	};

	currentCategory = 'Token Adjacency';
	registerAdjacencySettings();
	currentCategory = 'Combat Tracker';
	registerCombatTrackerSettings();
	currentCategory = 'Nimble Character Widget';
	registerNcswSettings();
	currentCategory = 'General';
	registerSystemSettings();

	return captured;
}

function describeSettingDefault(setting: CapturedSetting): string {
	if (setting.choices && setting.default !== undefined) {
		const choiceLabel = setting.choices[String(setting.default)];
		if (choiceLabel) return localize(choiceLabel);
	}
	return resolveInitial(setting.default);
}

function generateSettingsPage(): void {
	const captured = captureSettings();

	const categories = ['General', 'Token Adjacency', 'Combat Tracker', 'Nimble Character Widget'];

	// Categories whose config:false settings are still user-facing because they
	// are edited from a dedicated in-app dialog rather than the settings window.
	const dialogManagedCategories = new Set(['Combat Tracker', 'Nimble Character Widget']);

	const sections = categories
		.map((category) => {
			const settings = captured.filter(
				(s) =>
					s.category === category && (s.config !== false || dialogManagedCategories.has(category)),
			);
			if (settings.length === 0) return null;

			const rows = settings.map((setting) => {
				const settingName = setting.name ? escapeVueText(localize(setting.name)) : setting.key;
				const hint = setting.hint ? escapeVueText(localize(setting.hint)) : '';
				const scope =
					setting.scope === 'world' ? 'Whole table (GM sets it)' : 'Each player individually';
				return `| **${cell(settingName)}** | ${cell(hint)} | ${cell(describeSettingDefault(setting))} | ${scope} |`;
			});

			const hasHidden = settings.some((s) => s.config === false);
			const note = hasHidden
				? '\n_Some of these settings are managed from their own dialog rather than the Foundry settings window._\n'
				: '';

			return `## ${category}
${note}
| Setting | What it does | Default | Who it affects |
| :--- | :--- | :--- | :--- |
${rows.join('\n')}`;
		})
		.filter(Boolean);

	const body = `---
title: "Settings Reference"
---

${BANNER}

# Settings Reference

Every system setting, what it does, and who it affects. Open them in Foundry under **Game Settings → Configure Settings → Nimble**. For suggested combinations, see [Settings](../gm/settings.md).

${sections.join('\n\n')}
`;

	writePage('settings.md', body);
}

/* -------------------------------------------------- */
/*  Entry point                                       */
/* -------------------------------------------------- */

it('generates the documentation reference pages', () => {
	const rulePages = generateRulePages();
	generateConditionsPage();
	generateSettingsPage();

	const expectedFiles = [...rulePages, 'conditions.md', 'settings.md'];
	for (const fileName of expectedFiles) {
		const filePath = path.join(OUT_DIR, fileName);
		expect(fs.existsSync(filePath), `${fileName} should exist`).toBe(true);
		expect(fs.statSync(filePath).size, `${fileName} should not be empty`).toBeGreaterThan(500);
	}
});
