import { readFileSync } from 'node:fs';
import path from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import {
	AFTER_RULES_PHASE,
	MULTIPLY_DOWN_CHANGE,
} from '#documents/activeEffect/multiplyDownChange.js';
import { flattenEffectsTree } from '#utils/treeManipulation/flattenEffectsTree.js';

type Json = Record<string, any>;

const MOVEMENT_KEYS = ['walk', 'fly', 'climb', 'swim', 'burrow'].map(
	(mode) => `system.attributes.movement.${mode}`,
);
const DAMAGE_BACK_TRIGGERS_WITH_CRITS = ['damaged', 'tempHpReduced'];
const SAVE_BRANCHES = ['failedSave', 'passedSave'];

const readDoc = (file: string): Json =>
	JSON.parse(readFileSync(path.resolve(process.cwd(), file), 'utf-8'));

/** Every item of the packs: the pack documents and the items of the actors. */
function packItems(): { file: string; item: Json }[] {
	const files = globSync('packs/**/*.json').filter((file) => !file.endsWith('ids.json'));
	return files.flatMap((file) => {
		const doc = readDoc(file);
		const embedded = Array.isArray(doc.items) ? (doc.items as Json[]) : [];
		return [doc, ...embedded].map((item) => ({ file, item }));
	});
}

const effectsOf = (doc: Json): Json[] =>
	Array.isArray(doc.effects) ? (doc.effects as Json[]) : [];

/** The rules of a document and of each effect on it. */
function rulesOfItemAndEffects(doc: Json): Json[] {
	return [doc, ...effectsOf(doc)].flatMap((holder) =>
		Array.isArray(holder.system?.rules) ? (holder.system.rules as Json[]) : [],
	);
}

function changesOf(effect: Json): Json[] {
	const system = Array.isArray(effect.system?.changes) ? (effect.system.changes as Json[]) : [];
	const legacy = Array.isArray(effect.changes) ? (effect.changes as Json[]) : [];
	return [...system, ...legacy];
}

function activationNodes(doc: Json): Json[] {
	return flattenEffectsTree(doc.system?.activation?.effects ?? []) as Json[];
}

const where = (file: string, item: Json, detail: string) =>
	`${file} | ${item.name ?? '?'} | ${detail}`;

function namesOwnInstantEffect(item: Json, id: string): boolean {
	return effectsOf(item).some((effect) => effect._id === id && effect.transfer === false);
}

describe('timed effect shapes, in packs', () => {
	const items = packItems();

	it('reads the packs', () => {
		expect(items.length).toBeGreaterThan(0);
	});

	it('has each Attacker Takes rule name an effect of its own item with transfer false', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const rule of rulesOfItemAndEffects(item)) {
				if (rule.type !== 'damageBack' || !rule.attackerEffectId) continue;
				if (!namesOwnInstantEffect(item, rule.attackerEffectId)) {
					misses.push(where(file, item, `damageBack ${rule.attackerEffectId}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('has each stacking effect name an effect of its own item with transfer false', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const effect of effectsOf(item)) {
				const id = effect.system?.stacks?.effectId;
				if (!id) continue;
				if (!namesOwnInstantEffect(item, id)) {
					misses.push(where(file, item, `${effect.name} stacks ${id}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('has each Multiply, round down change in the after-rules phase that halves or doubles', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const effect of effectsOf(item)) {
				for (const change of changesOf(effect)) {
					if (change.type !== MULTIPLY_DOWN_CHANGE) continue;
					if (change.phase !== AFTER_RULES_PHASE || !['0.5', '2'].includes(String(change.value))) {
						misses.push(
							where(file, item, `${effect.name} ${change.key} ${change.phase} ${change.value}`),
						);
					}
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('has an effect that halves or doubles movement change all five movement keys', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const effect of effectsOf(item)) {
				const halved = changesOf(effect)
					.filter((change) => change.type === MULTIPLY_DOWN_CHANGE)
					.map((change) => change.key);
				if (halved.length === 0) continue;
				const missing = MOVEMENT_KEYS.filter((key) => !halved.includes(key));
				if (missing.length > 0) {
					misses.push(where(file, item, `${effect.name} lacks ${missing.join(', ')}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('has each Attacker Takes rule on damage or lost temp HP set to every hit, unless the book says crits only', () => {
		// Book: "Crits against Azriel..." (GM guide) and "Whenever you are crit" (Heroes 1963).
		const CRIT_ONLY_ITEMS = ['PAIN!', 'Bring the Pain'];
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const rule of rulesOfItemAndEffects(item)) {
				if (rule.type !== 'damageBack') continue;
				const trigger = rule.trigger ?? 'damaged';
				const critOnly = rule.onlyCrits === true && CRIT_ONLY_ITEMS.includes(item.name);
				if (
					DAMAGE_BACK_TRIGGERS_WITH_CRITS.includes(trigger) &&
					rule.onlyCrits !== false &&
					!critOnly
				) {
					misses.push(where(file, item, `damageBack ${rule.id} ${trigger}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('puts each step for the creatures that fail or save under a branch of a save step', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			const nodes = activationNodes(item);
			for (const node of nodes) {
				if (node.recipient !== 'savers') continue;
				const parent = nodes.find((each) => each.id === node.parentNode);
				const underSave =
					parent?.type === 'savingThrow' && SAVE_BRANCHES.includes(node.parentContext);
				if (!underSave) {
					misses.push(where(file, item, `node ${node.id} under ${node.parentContext}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('gives an escape with no DC a blank DC', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const effect of effectsOf(item)) {
				const effectEscape = effect.system?.escape;
				if (effectEscape?.noDc === true && String(effectEscape.dc ?? '').trim() !== '') {
					misses.push(where(file, item, `${effect.name} dc ${effectEscape.dc}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('gives an escape by a skill either no DC or a DC', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const effect of effectsOf(item)) {
				const effectEscape = effect.system?.escape;
				const skills = Array.isArray(effectEscape?.skills) ? effectEscape.skills : [];
				if (skills.length === 0) continue;
				if (effectEscape.noDc !== true && String(effectEscape.dc ?? '').trim() === '') {
					misses.push(where(file, item, `${effect.name} skills ${skills.join(', ')}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('gives each save step a save type', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const node of activationNodes(item)) {
				if (node.type === 'savingThrow' && !node.savingThrowType) {
					misses.push(where(file, item, `node ${node.id}`));
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('has no save step whose old save type differs from its save type', () => {
		const misses: string[] = [];
		for (const { file, item } of items) {
			for (const node of activationNodes(item)) {
				if (node.type !== 'savingThrow' || !node.saveType) continue;
				if (node.saveType !== node.savingThrowType) {
					misses.push(
						where(
							file,
							item,
							`node ${node.id} saveType ${node.saveType} / ${node.savingThrowType}`,
						),
					);
				}
			}
		}
		expect(misses).toEqual([]);
	});

	it('has no effect with the Hampered status', () => {
		const hits: string[] = [];
		for (const { file, item } of items) {
			for (const effect of effectsOf(item)) {
				if (Array.isArray(effect.statuses) && effect.statuses.includes('hampered')) {
					hits.push(where(file, item, effect.name));
				}
			}
		}
		expect(hits).toEqual([]);
	});
});
