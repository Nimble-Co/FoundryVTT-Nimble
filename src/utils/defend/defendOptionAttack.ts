import { DamageRoll } from '../../dice/DamageRoll.js';
import type { DefendOptionRule } from '../../models/rules/defendOption.js';
import localize from '../localize.js';
import { findActorToken } from '../movement/findActorToken.js';

const TEXT = 'NIMBLE.chat.defend.attackBack';

/**
 * Asks for each taken Defend Option's attack against the attacker, then rolls
 * the ones the player accepts on a card that targets the attacker. The GM
 * applies the damage from that card, and armor applies. Declining rolls nothing.
 */
export async function offerDefendOptionAttacks(input: {
	rules: readonly DefendOptionRule[];
	actor: Actor.Implementation;
	card: ChatMessage | null;
}): Promise<void> {
	const attacks = input.rules.flatMap((rule) => {
		const formula = rule.attackOffer();
		return formula ? [{ rule, formula }] : [];
	});
	if (attacks.length === 0 || !input.card) return;

	const target = attackerTarget(input.card);
	if (!target.actor || !target.tokenUuid) return;

	for (const { rule, formula } of attacks) {
		const name = rule.label || rule.parentDocument.name;
		const confirmed = await foundry.applications.api.DialogV2.confirm({
			window: { title: localize(`${TEXT}.title`) },
			content: `<p>${localize(`${TEXT}.message`, {
				name,
				attacker: target.actor.name ?? '',
				formula,
			})}</p>`,
			yes: { label: localize(`${TEXT}.yes`) },
			no: { label: localize(`${TEXT}.no`) },
			rejectClose: false,
		});
		if (confirmed !== true) continue;
		await dealDefendOptionAttack({
			actor: input.actor,
			formula,
			name,
			image: rule.parentDocument.img || '',
			targetUuid: target.tokenUuid,
		});
	}
}

function attackerTarget(card: ChatMessage): {
	actor: Actor.Implementation | null;
	tokenUuid: string | null;
} {
	const speaker = card.speaker ?? null;
	const scene = speaker?.scene ? game.scenes?.get(speaker.scene) : null;
	const token = speaker?.token && scene ? scene.tokens?.get(speaker.token) : null;
	const actor = (token?.actor ??
		ChatMessage.getSpeakerActor(speaker) ??
		null) as Actor.Implementation | null;
	return { actor, tokenUuid: token?.uuid ?? findActorToken(actor)?.uuid ?? null };
}

async function dealDefendOptionAttack(input: {
	actor: Actor.Implementation;
	formula: string;
	name: string;
	image: string;
	targetUuid: string;
}): Promise<void> {
	const roll = new DamageRoll(input.formula, input.actor.getRollData() as DamageRoll.Data);
	await roll.evaluate();
	const damageId = 'defend-option-attack';
	const node = {
		id: damageId,
		type: 'damage',
		formula: input.formula,
		canCrit: true,
		canMiss: true,
		roll: roll.toJSON(),
		parentNode: null,
		parentContext: null,
		on: {
			hit: [
				{
					id: `${damageId}-hit`,
					type: 'damageOutcome',
					parentNode: damageId,
					parentContext: 'hit',
				},
			],
		},
	};
	await ChatMessage.create({
		author: game.user?.id,
		flavor: `${input.actor.name ?? ''}: ${input.name}`,
		speaker: ChatMessage.getSpeaker({ actor: input.actor }),
		rolls: [roll],
		system: {
			name: input.name,
			image: input.image,
			isCritical: roll.isCritical === true,
			isMiss: roll.isMiss === true,
			activation: { effects: [node] },
			targets: [input.targetUuid],
		},
		type: 'feature',
	} as unknown as ChatMessage.CreateData);
}
