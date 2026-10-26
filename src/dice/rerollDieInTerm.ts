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

interface DieNode {
	result: DieResultLike;
	children: DieNode[];
}

const MAX_EXPLOSIONS = 100;

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
 * A number added to the die of a term that stays, up to the die's size. `base`
 * is the result of that die before the number was added.
 */
interface KeptDieBonus {
	add: number;
	base: number;
}

/**
 * Reroll one die of an evaluated term in place. The term keeps the highest or
 * lowest again, the dice the old result made explode are dropped, and a new
 * max explodes in the term's style. A die a reroll newly keeps explodes at its
 * max too. `draw` rolls one die of the term's size. With a `bonus`, the keep
 * reads the dice before the bonus, and the die that stays gets it again.
 * `keptBase` is the result of that die before the bonus.
 */
async function rerollDieInTerm(
	term: DieTermLike,
	index: number,
	style: ExplosionStyle,
	draw: (faces: number) => Promise<number>,
	bonus: KeptDieBonus | null = null,
): Promise<{ previous: number; next: number; drawn: number[]; keptBase: number | null }> {
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
	const keptBefore = new Set(roots.filter((root) => isActive(root.result)));
	if (bonus) {
		const stayed = roots.find((root) => isActive(root.result));
		if (stayed) stayed.result.result = bonus.base;
	}
	picked.result.result = await roll();
	cutExplosion(picked);

	const keep = roots.includes(picked) ? keepRule(term.modifiers) : null;
	if (keep) {
		applyKeep(
			roots.map((root) => root.result),
			keep.count,
			keep.highest,
		);
		for (const root of roots) if (!isActive(root.result)) cutExplosion(root);
	}

	const stays = roots.find((root) => isActive(root.result));
	const keptBase = stays?.result.result ?? null;
	if (bonus && stays && keptBase !== null) {
		stays.result.result = Math.min(keptBase + bonus.add, term.faces);
	}
	const next = picked.result.result;

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
	return { previous, next, drawn, keptBase };
}

export { type DieTermLike, type ExplosionStyle, type KeptDieBonus, isActive, rerollDieInTerm };
