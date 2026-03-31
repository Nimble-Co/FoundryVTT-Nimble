import type { NimbleCharacter } from '../../documents/actor/character.js';
import { sortCombatants } from '../../documents/combat/combatSorting.js';
import { getActiveCombatForCurrentScene } from '../../utils/combatState.js';
import { initiativeRollLock } from '../../utils/initiativeRollLock.js';
import localize from '../../utils/localize.js';

const pendingActorIds = new Set<string>();

type CombatWithInitiativeRollOptions = Combat & {
	createEmbeddedDocuments: (
		documentName: 'Combatant',
		data: Combatant.CreateData[],
	) => Promise<Combatant.Implementation[]>;
	rollInitiative: (
		ids: string | string[],
		options?: Combat.InitiativeOptions & { rollOptions?: Record<string, unknown> },
	) => Promise<Combat>;
};

type TokenDocumentLike = {
	actor?: Actor.Implementation | null;
	actorId?: string | null;
	document?: TokenDocumentLike | null;
	hidden?: boolean | null;
	id?: string | null;
	parent?: { id?: string | null } | null;
};

function getPendingActorKey(actor: { id?: string | null; uuid?: string | null }): string | null {
	if (typeof actor.id === 'string' && actor.id.length > 0) return actor.id;
	if (typeof actor.uuid === 'string' && actor.uuid.length > 0) return actor.uuid;
	return null;
}

function getCurrentSceneId(): string | null {
	const sceneId = canvas.scene?.id ?? null;
	return typeof sceneId === 'string' && sceneId.length > 0 ? sceneId : null;
}

function resolveTokenDocument(
	token: TokenDocumentLike | null | undefined,
): TokenDocumentLike | null {
	if (!token) return null;
	if (token.document) return token.document;
	return token;
}

function getSceneTokenDocuments(): TokenDocumentLike[] {
	const sceneTokens = canvas.scene?.tokens as
		| TokenDocumentLike[]
		| {
				contents?: TokenDocumentLike[];
				[Symbol.iterator]?: () => Iterator<TokenDocumentLike>;
		  }
		| null
		| undefined;
	if (!sceneTokens) return [];
	if (Array.isArray(sceneTokens)) return sceneTokens;
	if (Array.isArray(sceneTokens.contents)) return sceneTokens.contents;
	if (typeof sceneTokens[Symbol.iterator] === 'function') {
		return [...(sceneTokens as Iterable<TokenDocumentLike>)];
	}
	return [];
}

function getTokenSceneId(token: TokenDocumentLike | null): string | null {
	const sceneId = token?.parent?.id ?? null;
	return typeof sceneId === 'string' && sceneId.length > 0 ? sceneId : null;
}

function resolveActorCurrentSceneToken(actor: NimbleCharacter): TokenDocumentLike | null {
	const currentSceneId = getCurrentSceneId();
	if (!currentSceneId) return null;

	const activeTokens =
		typeof actor.getActiveTokens === 'function'
			? (actor.getActiveTokens() as TokenDocumentLike[])
			: [];
	for (const activeToken of activeTokens) {
		const tokenDocument = resolveTokenDocument(activeToken);
		if (getTokenSceneId(tokenDocument) === currentSceneId) return tokenDocument;
	}

	const actorToken = resolveTokenDocument(actor.token as TokenDocumentLike | null | undefined);
	if (getTokenSceneId(actorToken) === currentSceneId) return actorToken;

	return (
		getSceneTokenDocuments().find((tokenDocument) => {
			if (getTokenSceneId(tokenDocument) !== currentSceneId) return false;
			if (tokenDocument.actorId === actor.id) return true;
			return tokenDocument.actor?.id === actor.id;
		}) ?? null
	);
}

function getCombatantSceneId(combatant: Combatant.Implementation): string | null {
	const sceneId = combatant.sceneId ?? combatant.token?.parent?.id ?? null;
	return typeof sceneId === 'string' && sceneId.length > 0 ? sceneId : null;
}

function getCombatantManualSortValue(combatant: Combatant.Implementation): number {
	const sortValue = Number(foundry.utils.getProperty(combatant, 'system.sort') ?? 0);
	return Number.isFinite(sortValue) ? sortValue : 0;
}

function sortSceneCombatants(
	combat: Combat,
	sceneCombatants: Combatant.Implementation[],
): Combatant.Implementation[] {
	const combatWithSort = combat as Combat & {
		_sortCombatants?: (left: Combatant.Implementation, right: Combatant.Implementation) => number;
	};
	const compareCombatants =
		typeof combatWithSort._sortCombatants === 'function'
			? combatWithSort._sortCombatants.bind(combatWithSort)
			: sortCombatants;
	return [...sceneCombatants].sort(compareCombatants);
}

function resolveLateJoinerCharacterSortValue(combat: Combat): number {
	const currentSceneId = getCurrentSceneId();
	if (!currentSceneId) return 0;

	const sceneCombatants = combat.combatants.contents.filter(
		(combatant) => getCombatantSceneId(combatant) === currentSceneId,
	);
	if (sceneCombatants.length < 1) return 0;

	const orderedSceneCombatants = sortSceneCombatants(combat, sceneCombatants);
	let lastCharacterCombatant: Combatant.Implementation | null = null;
	let nextCombatantAfterCharacterBlock: Combatant.Implementation | null = null;

	for (const [index, combatant] of orderedSceneCombatants.entries()) {
		if (combatant.type !== 'character') continue;
		lastCharacterCombatant = combatant;
		nextCombatantAfterCharacterBlock = orderedSceneCombatants[index + 1] ?? null;
	}

	if (!lastCharacterCombatant) {
		return getCombatantManualSortValue(orderedSceneCombatants[0]) - 1;
	}

	const lastCharacterSortValue = getCombatantManualSortValue(lastCharacterCombatant);
	if (!nextCombatantAfterCharacterBlock) return lastCharacterSortValue + 1;

	const nextSortValue = getCombatantManualSortValue(nextCombatantAfterCharacterBlock);
	if (nextSortValue === lastCharacterSortValue) return lastCharacterSortValue + 0.5;
	return lastCharacterSortValue + (nextSortValue - lastCharacterSortValue) / 2;
}

function findCurrentSceneCombatant(
	combat: Combat,
	actor: NimbleCharacter,
	tokenDocument: TokenDocumentLike | null,
): Combatant.Implementation | null {
	const currentSceneId = getCurrentSceneId();
	const preferredTokenId = tokenDocument?.id ?? null;

	return (
		combat.combatants.contents.find((combatant) => {
			if (combatant.actorId !== actor.id) return false;
			if (currentSceneId && getCombatantSceneId(combatant) !== currentSceneId) return false;
			if (preferredTokenId) return combatant.tokenId === preferredTokenId;
			return true;
		}) ?? null
	);
}

async function createCurrentSceneCharacterCombatant(
	combat: CombatWithInitiativeRollOptions,
	actor: NimbleCharacter,
	tokenDocument: TokenDocumentLike,
): Promise<Combatant.Implementation | null> {
	const tokenId = tokenDocument.id ?? null;
	const sceneId = getTokenSceneId(tokenDocument);
	if (!actor.id || !tokenId || !sceneId) return null;

	const createData: Record<string, unknown> = {
		type: 'character',
		actorId: actor.id,
		tokenId,
		sceneId,
		hidden: Boolean(tokenDocument.hidden),
	};
	foundry.utils.setProperty(createData, 'system.sort', resolveLateJoinerCharacterSortValue(combat));

	const createdCombatants = await combat.createEmbeddedDocuments('Combatant', [
		createData as Combatant.CreateData,
	]);
	return createdCombatants[0] ?? null;
}

async function executeCharacterInitiativeRoll(actor: NimbleCharacter): Promise<void> {
	const combat = getActiveCombatForCurrentScene();
	if (!combat) {
		await actor.rollInitiativeToChat();
		return;
	}

	const combatWithRollOptions = combat as CombatWithInitiativeRollOptions;
	const tokenDocument = resolveActorCurrentSceneToken(actor);
	let combatant = findCurrentSceneCombatant(combat, actor, tokenDocument);
	if (initiativeRollLock.hasActiveLock(combatant)) return;
	if (combatant?.initiative != null) {
		ui.notifications?.info(localize('NIMBLE.ui.heroicActions.initiativeAlreadyRolled'));
		return;
	}

	if (!combatant && !tokenDocument) {
		await actor.rollInitiativeToChat();
		return;
	}

	const rollData = await actor.getInitiativeRollData();
	if (!rollData) return;

	if (!combatant && tokenDocument) {
		combatant = findCurrentSceneCombatant(combat, actor, tokenDocument);
		if (!combatant) {
			combatant = await createCurrentSceneCharacterCombatant(
				combatWithRollOptions,
				actor,
				tokenDocument,
			);
		}
	}
	if (!combatant?.id) return;

	const messageOptions =
		rollData.visibilityMode == null
			? {}
			: ({ rollMode: rollData.visibilityMode } as ChatMessage.CreateData);

	await combatWithRollOptions.rollInitiative([combatant.id], {
		messageOptions,
		rollOptions: {
			rollMode: rollData.rollMode,
		},
	});
}

export const characterInitiativeRoll = {
	async roll(actor: NimbleCharacter): Promise<void> {
		const pendingKey = getPendingActorKey(actor);
		if (!pendingKey) {
			await executeCharacterInitiativeRoll(actor);
			return;
		}
		if (pendingActorIds.has(pendingKey)) return;

		pendingActorIds.add(pendingKey);
		try {
			await executeCharacterInitiativeRoll(actor);
		} catch (error) {
			console.error('[Nimble][Sheet] Initiative roll failed', {
				actorId: actor.id ?? null,
				error,
			});
			ui.notifications?.warn(localize('NIMBLE.ui.heroicActions.noPermissionRollInitiative'));
		} finally {
			pendingActorIds.delete(pendingKey);
		}
	},
};
