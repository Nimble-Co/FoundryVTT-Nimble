#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Pre-tightening data audit for the rules builder foundation tech-spec.
 *
 * Walks `packs/**\/*.json` and, for every rule found inside any `system.rules`
 * array, reports values that fall outside the choice sets that Phase 2 will
 * enforce via `StringField({ choices: ... })`.
 *
 * The proposed choice sets mirror Task 6 of
 * `_bmad-output/implementation-artifacts/tech-spec-rules-builder-foundation.md`.
 * If this script reports a non-empty list of mismatches, Cutoff 3 must include
 * the conditional migration script (Task 8); otherwise migration can be
 * skipped.
 *
 * Run via `pnpm run audit:rules-choices`.
 */

import { readFileSync } from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import { glob } from 'glob';

const dirName = url.fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(dirName, '../..');
const packsRoot = path.resolve(projectRoot, 'packs');

// --- Choice sets that Phase 2 will declare on the corresponding fields. -----
//
// Keep these mirrored by hand with `src/config.ts` /
// `src/config/registerConditionsConfig.ts` until the tightened schemas land —
// at that point the audit can be regenerated dynamically. Until then, this is
// intentionally a literal copy: a static audit must not depend on importing
// runtime CONFIG, which is not populated outside Foundry.

const ABILITY_KEYS = ['strength', 'dexterity', 'intelligence', 'will'];
const SAVE_KEYS = ABILITY_KEYS;
const SKILL_KEYS = [
	'arcana',
	'examination',
	'finesse',
	'influence',
	'insight',
	'lore',
	'might',
	'naturecraft',
	'perception',
	'stealth',
];
const DAMAGE_TYPES = [
	'acid',
	'bludgeoning',
	'cold',
	'fire',
	'force',
	'lightning',
	'necrotic',
	'piercing',
	'poison',
	'psychic',
	'radiant',
	'slashing',
	'thunder',
];
const SPELL_SCHOOLS = ['fire', 'ice', 'lightning', 'necrotic', 'radiant', 'wind'];
const CONDITIONS = [
	'blinded',
	'bloodied',
	'charged',
	'charmed',
	'concentration',
	'confused',
	'dazed',
	'dead',
	'despair',
	'distracted',
	'dying',
	'frightened',
	'grappled',
	'hampered',
	'incapacitated',
	'invisible',
	'lastStand',
	'paralyzed',
	'petrified',
	'poisoned',
	'prone',
	'restrained',
	'riding',
	'silenced',
	'slowed',
	'smoldering',
	'stunned',
	'taunted',
	'unconscious',
	'wounded',
];
const MOVEMENT_TYPES = ['walk', 'fly', 'swim', 'climb', 'burrow'];
const ROLL_MODES = ['set', 'adjust'];

// --- Per-rule field audit map -----------------------------------------------
//
// Each entry: { rule type → { field path → { kind: 'scalar'|'array', values: string[] } } }
// Field paths are dot-notation against the rule object.

// Sentinel values resolved at runtime — kept as valid choices so existing pack
// data continues to validate. Mirror the schemas in src/models/rules/.
const ALL_SENTINEL = 'all';
const KNOWN_SENTINEL = 'known';

const RULE_FIELD_AUDITS = {
	abilityBonus: {
		abilities: { kind: 'array', values: [...ABILITY_KEYS, ALL_SENTINEL] },
	},
	applyCondition: {
		condition: { kind: 'scalar', values: CONDITIONS },
	},
	conditionImmunity: {
		conditions: { kind: 'array', values: CONDITIONS },
	},
	damageBonus: {
		damageType: { kind: 'scalar', values: DAMAGE_TYPES },
	},
	grantSpells: {
		schools: { kind: 'array', values: [...SPELL_SCHOOLS, KNOWN_SENTINEL] },
	},
	initiativeRollMode: {
		mode: { kind: 'scalar', values: ROLL_MODES },
	},
	savingThrowBonus: {
		savingThrows: { kind: 'array', values: [...SAVE_KEYS, ALL_SENTINEL] },
	},
	savingThrowRollMode: {
		mode: { kind: 'scalar', values: ROLL_MODES },
	},
	skillBonus: {
		skills: { kind: 'array', values: [...SKILL_KEYS, ALL_SENTINEL] },
	},
	speedBonus: {
		movementType: { kind: 'scalar', values: MOVEMENT_TYPES },
	},
};

// --- Walking and reporting --------------------------------------------------

/**
 * Recursively collect every `rules` array under `node`. We don't assume a
 * single shape because future content (e.g. nested feature groups) may carry
 * rules at deeper paths. Each hit returns {rules, ownerPath} so a mismatch
 * report can name where in the document the rule lives.
 */
function collectRulesArrays(node, ownerPath, sink) {
	if (!node || typeof node !== 'object') return;
	if (Array.isArray(node)) {
		node.forEach((entry, idx) => {
			collectRulesArrays(entry, `${ownerPath}[${idx}]`, sink);
		});
		return;
	}
	for (const [key, value] of Object.entries(node)) {
		const childPath = ownerPath ? `${ownerPath}.${key}` : key;
		if (key === 'rules' && Array.isArray(value)) {
			sink.push({ rules: value, ownerPath: childPath });
			continue;
		}
		collectRulesArrays(value, childPath, sink);
	}
}

function getByPath(obj, fieldPath) {
	return fieldPath.split('.').reduce((acc, key) => {
		if (acc === undefined || acc === null) return undefined;
		return acc[key];
	}, obj);
}

function auditRule(rule, context, mismatches) {
	const audits = RULE_FIELD_AUDITS[rule?.type];
	if (!audits) return;

	for (const [fieldPath, { kind, values }] of Object.entries(audits)) {
		const fieldValue = getByPath(rule, fieldPath);
		if (fieldValue === undefined || fieldValue === null) continue;

		if (kind === 'scalar') {
			if (typeof fieldValue !== 'string') continue;
			if (fieldValue === '') continue; // empty initial — not a mismatch
			if (!values.includes(fieldValue)) {
				mismatches.push({
					...context,
					rule: rule.type,
					field: fieldPath,
					value: fieldValue,
					allowed: values,
				});
			}
		} else if (kind === 'array') {
			if (!Array.isArray(fieldValue)) continue;
			for (const entry of fieldValue) {
				if (typeof entry !== 'string') continue;
				if (entry === '') continue;
				if (!values.includes(entry)) {
					mismatches.push({
						...context,
						rule: rule.type,
						field: fieldPath,
						value: entry,
						allowed: values,
					});
				}
			}
		}
	}
}

async function main() {
	const files = await glob('**/*.json', {
		cwd: packsRoot,
		ignore: ['ids.json', '**/ids.json'],
		absolute: true,
	});

	const mismatches = [];
	let rulesScanned = 0;
	let documentsScanned = 0;

	for (const filePath of files) {
		let json;
		try {
			json = JSON.parse(readFileSync(filePath, 'utf8'));
		} catch (err) {
			console.warn(`[WARN] Could not parse ${filePath}: ${err.message}`);
			continue;
		}
		if (!json || typeof json !== 'object' || !json.system) continue;
		documentsScanned += 1;

		const ruleArrays = [];
		collectRulesArrays(json.system, 'system', ruleArrays);
		for (const { rules, ownerPath } of ruleArrays) {
			rules.forEach((rule, idx) => {
				rulesScanned += 1;
				auditRule(
					rule,
					{
						file: path.relative(projectRoot, filePath),
						path: `${ownerPath}[${idx}]`,
						document: json.name ?? json._id ?? '<unnamed>',
					},
					mismatches,
				);
			});
		}
	}

	console.log('Rules-choice tightening audit');
	console.log('-----------------------------');
	console.log(`Documents scanned : ${documentsScanned}`);
	console.log(`Rules scanned     : ${rulesScanned}`);
	console.log(`Mismatches found  : ${mismatches.length}`);
	console.log('');

	if (mismatches.length === 0) {
		console.log('All audited fields match the proposed choice sets.');
		console.log('Conclusion: Task 8 (migration) NOT required.');
		return 0;
	}

	const grouped = new Map();
	for (const m of mismatches) {
		const key = `${m.rule}.${m.field}`;
		const bucket = grouped.get(key) ?? new Map();
		const examples = bucket.get(m.value) ?? [];
		examples.push(`${m.file} (${m.document}) at ${m.path}`);
		bucket.set(m.value, examples);
		grouped.set(key, bucket);
	}

	for (const [key, valueMap] of grouped) {
		console.log(`\n${key}`);
		for (const [value, examples] of valueMap) {
			console.log(`  '${value}'  (${examples.length} hit${examples.length === 1 ? '' : 's'})`);
			for (const example of examples.slice(0, 5)) {
				console.log(`    - ${example}`);
			}
			if (examples.length > 5) {
				console.log(`    … and ${examples.length - 5} more`);
			}
		}
	}

	console.log('\nConclusion: Task 8 (migration) IS required for the offending fields.');
	return 1;
}

main()
	.then((code) => process.exit(code))
	.catch((err) => {
		console.error(err);
		process.exit(2);
	});
