import { SYSTEM_ID, systemHookName } from '#system';
import { isMovementTrackingAutomationEnabled } from '../../settings/automationSettings.js';
import { buildMovementRecord } from '../../utils/movement/buildMovementRecord.js';

interface CombatantCreateData {
	type: string;
	tokenId: string;
	sceneId: string;
	actorId: string;
	hidden: boolean;
}

export class NimbleTokenDocument extends TokenDocument {
	static getCombatantType(token: TokenDocument): string {
		const actorType = token.actor?.type as string | undefined;
		switch (actorType) {
			case 'character':
				return 'character';
			case 'soloMonster':
				return 'soloMonster';
			default:
				return 'npc';
		}
	}

	static override async createCombatants(
		tokens: TokenDocument[],
		{ combat }: { combat?: Combat | null } = {},
	): Promise<Combatant[]> {
		// Get the current scene ID - this is the authoritative source
		const currentSceneId = canvas.scene?.id;
		if (!currentSceneId) throw new Error('No active scene');

		// Identify the target Combat encounter
		let targetCombat: Combat | undefined = combat ?? game.combats.viewed ?? undefined;

		// If no combat exists or the viewed combat is for a different scene, create a new one
		if (!targetCombat || (targetCombat.scene?.id && targetCombat.scene.id !== currentSceneId)) {
			if (game.user.isGM) {
				const cls = getDocumentClass('Combat');
				targetCombat = await cls.create({ scene: currentSceneId, active: true });
			} else throw new Error(game.i18n.localize('COMBAT.NoneActive'));
		}

		if (!targetCombat) throw new Error('Could not create combat');

		// Add tokens to the Combat encounter
		const createData = new Set(tokens).reduce<CombatantCreateData[]>((arr, token) => {
			if (token.inCombat) return arr;

			const combatantType = NimbleTokenDocument.getCombatantType(token);

			// Use token.parent?.id if available, otherwise fall back to current scene ID
			const tokenSceneId = token.parent?.id ?? currentSceneId;

			arr.push({
				type: combatantType,
				tokenId: token.id ?? '',
				sceneId: tokenSceneId,
				actorId: token.actorId ?? '',
				hidden: token.hidden ?? false,
			});

			return arr;
		}, []);

		const created = await targetCombat.createEmbeddedDocuments(
			'Combatant',
			createData as Combatant.CreateData[],
		);
		return created ?? [];
	}

	#lastFinishedMovementId: string | null = null;

	/** Offers seen on this token's movement operations, keyed by the chain's first movement id. */
	#offersByMovement = new Map<string, { id: string; messageId: string | null }>();

	protected override _onUpdateMovement(
		movement: TokenDocument.MovementOperation,
		operation: TokenDocument.Database.OnUpdateOptions,
		user: User.Stored,
	): void {
		super._onUpdateMovement(movement, operation, user);
		if (this.movement.id !== movement.id) return;
		const offer = (
			operation as unknown as Record<
				string,
				{ offerId?: string; messageId?: string | null } | undefined
			>
		)[SYSTEM_ID];
		if (offer?.offerId) {
			this.#offersByMovement.set(movement.chain[0] ?? movement.id, {
				id: offer.offerId,
				messageId: offer.messageId ?? null,
			});
		}
		this.#emitMovementFinished();
	}

	protected override _onMovementStopped(): void {
		super._onMovementStopped();
		this.#emitMovementFinished();
	}

	// Runs on every client. `this.movement` already carries the final state when
	// core calls the callbacks above, so one check covers checkpoints and stops.
	#emitMovementFinished(): void {
		if (!isMovementTrackingAutomationEnabled()) return;
		const movement = this.movement as unknown as Parameters<typeof buildMovementRecord>[1];
		if (movement.state !== 'completed' && movement.state !== 'stopped') return;
		const movementId = movement.chain[0] ?? movement.id;
		if (this.#lastFinishedMovementId === movementId) return;
		this.#lastFinishedMovementId = movementId;

		const record = buildMovementRecord(
			this as unknown as Parameters<typeof buildMovementRecord>[0],
			movement,
			this.#offersByMovement.get(movementId) ?? null,
		);
		this.#offersByMovement.delete(movementId);
		if (!record) return;
		// @ts-expect-error - movementFinished is a custom system hook
		Hooks.callAll(systemHookName('movementFinished'), record);
	}

	override getBarAttribute(
		barName: string,
		options?: { alternative?: string },
	): ReturnType<TokenDocument['getBarAttribute']> {
		const attribute = super.getBarAttribute(barName, options);
		if (!attribute) return null;

		const isMana = attribute.attribute === 'resources.mana';
		if (isMana) {
			attribute.editable = true;
		}

		return attribute;
	}
}
