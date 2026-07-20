import { SYSTEM_ID } from '#system';
import localize from '#utils/localize.ts';

const BANKED_DAMAGE_REDUCTION_FLAG = 'bankedDamageReduction';
const FLAG_PATH = `flags.${SYSTEM_ID}.${BANKED_DAMAGE_REDUCTION_FLAG}`;

interface BankedReductionEffect {
	id: string;
	disabled: boolean;
	update(changes: Record<string, unknown>): Promise<unknown>;
}

interface ActorWithEffects {
	effects: {
		find(predicate: (effect: BankedReductionEffect) => boolean): BankedReductionEffect | undefined;
		filter(predicate: (effect: BankedReductionEffect) => boolean): BankedReductionEffect[];
	};
	createEmbeddedDocuments(type: string, data: Record<string, unknown>[]): Promise<unknown>;
	deleteEmbeddedDocuments(type: string, ids: string[]): Promise<unknown>;
}

function effectValue(effect: BankedReductionEffect): number {
	const value = Number(foundry.utils.getProperty(effect, FLAG_PATH));
	if (!Number.isFinite(value) || value <= 0) return 0;
	return Math.floor(value);
}

function effectName(value: number): string {
	return localize('NIMBLE.ui.bankedDamageReduction', { value: String(value) });
}

function effectDescription(value: number): string {
	return localize('NIMBLE.ui.bankedDamageReductionDescription', { value: String(value) });
}

/**
 * One-shot incoming-damage reduction banked on an actor by a manual dice-pool
 * spend (a `diceConsumer` rule with `effectType: 'damageReduction'`, e.g.
 * Berserker's "That all you got?!").
 *
 * The bank is stored as an Active Effect on the actor so the pending
 * reduction is visible ("Damage Reduction (8)") in the same effects surface
 * as toggleEffect toggles, syncs to the GM's client, and can be dropped
 * (delete) or suspended (disable) by the player. It is consumed and removed
 * by the next damage applied to the actor.
 */
function getBankedDamageReduction(actor: Actor.Implementation): number {
	const effects = (actor as unknown as ActorWithEffects).effects;
	if (!effects?.filter) return 0;

	return effects
		.filter((effect) => !effect.disabled && effectValue(effect) > 0)
		.reduce((total, effect) => total + effectValue(effect), 0);
}

async function addBankedDamageReduction(
	actor: Actor.Implementation,
	amount: number,
	img?: string | null,
): Promise<void> {
	const addition = Math.floor(Number(amount));
	if (!Number.isFinite(addition) || addition <= 0) return;

	const actorWithEffects = actor as unknown as ActorWithEffects;
	const existing = actorWithEffects.effects?.find(
		(effect) => !effect.disabled && effectValue(effect) > 0,
	);

	if (existing) {
		const total = effectValue(existing) + addition;
		await existing.update({
			name: effectName(total),
			description: effectDescription(total),
			[FLAG_PATH]: total,
		});
		return;
	}

	await actorWithEffects.createEmbeddedDocuments('ActiveEffect', [
		{
			name: effectName(addition),
			description: effectDescription(addition),
			img: img || 'icons/svg/shield.svg',
			disabled: false,
			flags: {
				[SYSTEM_ID]: {
					[BANKED_DAMAGE_REDUCTION_FLAG]: addition,
				},
			},
		},
	]);
}

async function clearBankedDamageReduction(actor: Actor.Implementation): Promise<void> {
	const actorWithEffects = actor as unknown as ActorWithEffects;
	const consumed = actorWithEffects.effects?.filter(
		(effect) => !effect.disabled && effectValue(effect) > 0,
	);
	if (!consumed || consumed.length < 1) return;

	await actorWithEffects.deleteEmbeddedDocuments(
		'ActiveEffect',
		consumed.map((effect) => effect.id),
	);
}

export { addBankedDamageReduction, clearBankedDamageReduction, getBankedDamageReduction };
