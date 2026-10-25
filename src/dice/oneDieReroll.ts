import { applyKeep } from './nimbleDieModifiers.js';

/** One die result of an evaluated dice term. */
interface DieResultLike {
	result: number;
	active?: boolean;
	discarded?: boolean;
	exploded?: boolean;
	provenance?: string;
}

/** An evaluated dice term, as a one-die reroll reads and changes it. */
interface DieTermLike {
	faces: number;
	/** How many dice the term rolls before explosions. */
	number: number;
	modifiers?: string[];
	results: DieResultLike[];
}

/**
 * How a term's dice explode at their max: `standard` rolls one more die,
 * `vicious` rolls two, of which only the first can go on.
 */
type ExplosionStyle = 'none' | 'standard' | 'vicious';

/** A die on a roll: the index of its term in `roll.terms` and of its result in that term. */
interface DieRef {
	term: number;
	result: number;
}

type PickableRole = 'primary' | 'kept' | 'dropped' | 'explosion';

interface PickableDie extends DieRef {
	faces: number;
	value: number;
	role: PickableRole;
}

interface RollLike {
	terms: readonly unknown[];
	primaryDie?: unknown;
	options?: { brutalPrimary?: boolean };
}

interface DieNode {
	result: DieResultLike;
	children: DieNode[];
}

const MAX_EXPLOSIONS = 100;

function isDieTerm(term: unknown): term is DieTermLike {
	const candidate = term as Partial<DieTermLike> | null;
	return typeof candidate?.faces === 'number' && Array.isArray(candidate.results);
}

function isActive(result: DieResultLike): boolean {
	return result.active !== false && result.discarded !== true;
}

/**
 * The term's results as trees: each die with the dice its explosion rolled.
 * Foundry appends a standard explosion die in the order its parents are
 * checked, which is breadth first; a vicious chain is appended in pairs, one
 * base die after the other.
 */
function dieTree(results: DieResultLike[], baseCount: number, style: ExplosionStyle): DieNode[] {
	const nodes: DieNode[] = results.map((result) => ({ result, children: [] }));
	const roots = nodes.slice(0, baseCount);
	let next = baseCount;
	if (style === 'standard') {
		for (let i = 0; i < nodes.length && next < nodes.length; i++) {
			if (nodes[i].result.exploded) nodes[i].children.push(nodes[next++]);
		}
	} else if (style === 'vicious') {
		for (const root of roots) {
			let parent = root;
			while (parent.result.exploded && next + 1 < nodes.length) {
				parent.children = [nodes[next], nodes[next + 1]];
				next += 2;
				parent = parent.children[0];
			}
		}
	}
	if (next < nodes.length) throw new Error('The dice term has results no die explains.');
	return roots;
}

function flattenDieTree(roots: DieNode[], style: ExplosionStyle): DieResultLike[] {
	if (style === 'vicious') {
		const out = roots.map((root) => root.result);
		for (const root of roots) {
			let parent = root;
			while (parent.children.length > 0) {
				out.push(...parent.children.map((child) => child.result));
				parent = parent.children[0];
			}
		}
		return out;
	}
	const out: DieResultLike[] = [];
	const queue = [...roots];
	for (let node = queue.shift(); node; node = queue.shift()) {
		out.push(node.result);
		queue.push(...node.children);
	}
	return out;
}

function findNode(roots: DieNode[], result: DieResultLike): DieNode | null {
	const stack = [...roots];
	for (let node = stack.pop(); node; node = stack.pop()) {
		if (node.result === result) return node;
		stack.push(...node.children);
	}
	return null;
}

function cutExplosion(node: DieNode): void {
	node.children = [];
	delete node.result.exploded;
}

function keepRule(modifiers: readonly string[] = []): { count: number; highest: boolean } | null {
	for (const modifier of modifiers) {
		const match = /^k(hn|ln|h|l)?(\d+)?$/i.exec(modifier);
		if (match) {
			return { count: Number(match[2]) || 1, highest: !match[1]?.toLowerCase().startsWith('l') };
		}
	}
	return null;
}

/**
 * Reroll one die of an evaluated term in place. The term keeps the highest or
 * lowest again, the dice the old result made explode are dropped, and a new
 * max explodes in the term's style. A die a reroll newly keeps explodes at its
 * max too. `draw` rolls one die of the term's size.
 */
async function rerollDieInTerm(
	term: DieTermLike,
	index: number,
	style: ExplosionStyle,
	draw: (faces: number) => Promise<number>,
): Promise<{ previous: number; next: number; drawn: number[] }> {
	const baseCount =
		style === 'none' ? term.results.length : Math.min(term.number, term.results.length);
	const roots = dieTree(term.results, baseCount, style);
	const target = term.results[index];
	const picked = target ? findNode(roots, target) : null;
	if (!picked) throw new Error(`The dice term has no result ${index}.`);

	const drawn: number[] = [];
	const roll = async () => {
		const value = await draw(term.faces);
		drawn.push(value);
		return value;
	};

	const previous = picked.result.result;
	const next = await roll();
	picked.result.result = next;
	cutExplosion(picked);

	const keptBefore = new Set(roots.filter((root) => isActive(root.result)));
	const keep = roots.includes(picked) ? keepRule(term.modifiers) : null;
	if (keep) {
		applyKeep(
			roots.map((root) => root.result),
			keep.count,
			keep.highest,
		);
		for (const root of roots) if (!isActive(root.result)) cutExplosion(root);
	}

	const canExplode = (node: DieNode) =>
		style !== 'none' &&
		isActive(node.result) &&
		node.result.result === term.faces &&
		node.result.provenance !== 'viciousBonus';
	const newlyKept = roots.filter(
		(root) => root !== picked && !keptBefore.has(root) && isActive(root.result),
	);
	for (const node of [picked, ...newlyKept]) {
		if (!canExplode(node)) continue;
		let parent = node;
		for (let i = 0; i < MAX_EXPLOSIONS && canExplode(parent); i++) {
			parent.result.exploded = true;
			if (style === 'vicious') {
				const chain = {
					result: { result: await roll(), active: true, provenance: 'viciousChain' },
				};
				const extra = {
					result: { result: await roll(), active: true, provenance: 'viciousBonus' },
				};
				parent.children = [
					{ ...chain, children: [] },
					{ ...extra, children: [] },
				];
			} else {
				parent.children = [{ result: { result: await roll(), active: true }, children: [] }];
			}
			parent = parent.children[0];
		}
	}

	term.results = flattenDieTree(roots, style);
	return { previous, next, drawn };
}

/**
 * The dice a player can pick to reroll: every die that counts, explosion dice
 * included. Dropped dice only of the term `droppedFrom` names.
 */
function pickableDice(roll: RollLike, options: { droppedFrom?: number } = {}): PickableDie[] {
	const primary = primaryDieRef(roll);
	const dice: PickableDie[] = [];
	roll.terms.forEach((term, termIndex) => {
		if (!isDieTerm(term)) return;
		term.results.forEach((result, resultIndex) => {
			const counts = isActive(result);
			if (!counts && options.droppedFrom !== termIndex) return;
			let role: PickableRole = 'kept';
			if (!counts) role = 'dropped';
			else if (primary?.term === termIndex && primary.result === resultIndex && roll.primaryDie)
				role = 'primary';
			else if (resultIndex >= term.number) role = 'explosion';
			dice.push({
				term: termIndex,
				result: resultIndex,
				faces: term.faces,
				value: result.result,
				role,
			});
		});
	});
	return dice;
}

/** The kept result of the roll's Primary Die, or of a check's d20. */
function primaryDieRef(roll: RollLike): DieRef | null {
	const termIndex = roll.primaryDie
		? roll.terms.indexOf(roll.primaryDie)
		: roll.terms.findIndex((term) => isDieTerm(term) && term.faces === 20);
	const term = roll.terms[termIndex];
	if (!isDieTerm(term)) return null;

	let best = -1;
	term.results.forEach((result, index) => {
		if (!isActive(result)) return;
		if (best === -1) best = index;
		else if (roll.options?.brutalPrimary && result.result > term.results[best].result) best = index;
	});
	return best === -1 ? null : { term: termIndex, result: best };
}

interface OneDieRoll {
	terms: unknown[];
	toJSON(): object;
	explosionStyleOf?(term: unknown): ExplosionStyle;
	refreshOutcome?(): void;
}

function hasExplodeModifier(modifiers: readonly string[] = []): boolean {
	return modifiers.some((modifier) => /^xo?(?![a-z])/i.test(modifier));
}

/** A roll of only the dice a one-die reroll rolled, for the 3D dice to throw. */
function thrownDice(term: DieTermLike & { options?: object }, drawn: number[]): foundry.dice.Roll {
	return foundry.dice.Roll.fromData({
		class: 'Roll',
		formula: `${drawn.length}d${term.faces}`,
		terms: [
			{
				class: 'Die',
				number: drawn.length,
				faces: term.faces,
				modifiers: [],
				options: { ...(term.options ?? {}) },
				results: drawn.map((result) => ({ result, active: true })),
				evaluated: true,
			},
		],
		total: drawn.reduce((sum, value) => sum + value, 0),
		evaluated: true,
	} as never) as foundry.dice.Roll;
}

/**
 * Reroll one die of an evaluated roll. The old roll is not changed: the new
 * roll is a copy with that die rolled again and its total, crit and miss
 * worked out again. `thrown` holds only the dice this reroll rolled.
 */
async function rerollOneDie<TRoll extends OneDieRoll>(
	roll: TRoll,
	ref: DieRef,
): Promise<{
	roll: TRoll;
	faces: number;
	previous: number;
	next: number;
	thrown: foundry.dice.Roll;
}> {
	const copy = foundry.dice.Roll.fromData(
		foundry.utils.deepClone(roll.toJSON()) as never,
	) as unknown as TRoll;
	const term = copy.terms[ref.term];
	if (!isDieTerm(term)) throw new Error(`The roll has no dice term ${ref.term}.`);

	const style =
		copy.explosionStyleOf?.(term) ?? (hasExplodeModifier(term.modifiers) ? 'standard' : 'none');
	const changed = await rerollDieInTerm(term, ref.result, style, async (faces) =>
		new foundry.dice.terms.Die({ faces }).randomFace(),
	);

	if (copy.refreshOutcome) copy.refreshOutcome();
	else {
		const internals = copy as unknown as {
			_total: number;
			_evaluateASTSync(node: unknown): number;
		};
		internals._total = internals._evaluateASTSync(CONFIG.Dice.parser.toAST(copy.terms as never));
	}

	return {
		roll: copy,
		faces: term.faces,
		previous: changed.previous,
		next: changed.next,
		thrown: thrownDice(term, changed.drawn),
	};
}

export {
	type DieRef,
	type DieTermLike,
	type ExplosionStyle,
	type OneDieRoll,
	type PickableDie,
	type PickableRole,
	hasExplodeModifier,
	pickableDice,
	primaryDieRef,
	rerollDieInTerm,
	rerollOneDie,
};
