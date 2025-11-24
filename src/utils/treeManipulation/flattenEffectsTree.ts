import type { ActionConsequence, EffectNode } from '#types/effectTree.js';

/**
 * Parses a string reference (format: `@{key=value; key2=value2}`) into an EffectNode.
 * Automatically converts values to numbers, booleans, or null when appropriate.
 */
function parseStringReference(ref: string): EffectNode | null {
	if (!ref.startsWith('@{') || !ref.endsWith('}')) return null;

	const content = ref.slice(2, -1); // Remove "@{" and "}"
	const parts = content.split(';').map((p) => p.trim());
	const node: any = {};

	for (const part of parts) {
		const [key, value] = part.split('=').map((p) => p.trim());
		if (key && value) {
			// Try to parse as number or boolean, otherwise keep as string
			if (value === 'null') node[key] = null;
			else if (value === 'true') node[key] = true;
			else if (value === 'false') node[key] = false;
			else if (!Number.isNaN(Number(value)) && value !== '') node[key] = Number(value);
			else node[key] = value;
		}
	}

	return node as EffectNode;
}

/**
 * Converts string references (format: `@{key=value}`) in an array to EffectNode objects.
 */
function resolveNodeArray(nodeArray: any[]): EffectNode[] {
	return nodeArray.map((item) => {
		if (typeof item === 'string' && item.startsWith('@{')) {
			const parsed = parseStringReference(item);
			if (parsed) return parsed;
		}
		return item;
	});
}

/**
 * Flattens a hierarchical tree of effect nodes into a single array.
 * Recursively processes nested nodes in `on` and `sharedRolls` properties,
 * sets `parentNode` and `parentContext` on each node, and removes nested structures.
 */
export function flattenEffectsTree(
	nodes: (EffectNode | string)[],
	parentNode: string | null = null,
	parentContext: string | null = null,
): EffectNode[] {
	if (!nodes) return [];

	const flattened: EffectNode[] = [];

	for (const node of nodes) {
		// Handle string references
		if (typeof node === 'string' && node.startsWith('@{')) {
			const parsed = parseStringReference(node);
			if (parsed) {
				parsed.parentContext = parentContext;
				parsed.parentNode = parentNode;
				flattened.push(parsed);
				continue;
			}
		}

		// At this point, node must be an EffectNode (not a string)
		if (typeof node === 'string') continue; // Skip invalid strings

		const newNode = foundry.utils.deepClone(node);
		newNode.parentContext = parentContext;
		newNode.parentNode = parentNode;
		flattened.push(newNode);

		if (newNode.type === 'damage' || newNode.type === 'savingThrow') {
			newNode.on ??= {};

			if (newNode.on.failedSaveBy) {
				for (const [failDegree, nodeArray] of Object.entries(newNode.on.failedSaveBy)) {
					flattened.push(
						...flattenEffectsTree(nodeArray ?? [], newNode.id, `failedSaveBy${failDegree}`),
					);
				}

				delete newNode.on.failedSaveBy;
			}

			for (const [context, nodeArray] of Object.entries(
				newNode.on as Omit<ActionConsequence, 'failedSaveBy'>,
			)) {
				if (Array.isArray(nodeArray)) {
					const resolvedArray = resolveNodeArray(nodeArray);
					flattened.push(...flattenEffectsTree(resolvedArray ?? [], newNode.id, context));
				}
			}

			delete newNode.on;
		}

		if (newNode.type === 'savingThrow') {
			if (Array.isArray(newNode.sharedRolls)) {
				const resolvedSharedRolls = resolveNodeArray(newNode.sharedRolls);
				flattened.push(...flattenEffectsTree(resolvedSharedRolls ?? [], newNode.id, 'sharedRolls'));
			}

			delete newNode.sharedRolls;
		}
	}

	return flattened;
}
