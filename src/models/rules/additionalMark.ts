import { SYSTEM_ID } from '#system';
import type { MeasurableTokenDocument } from '#types/movement.js';
import { rulesOfType } from '#utils/actor/actorRules.js';
import {
	readToggledEffects,
	TOGGLED_EFFECTS_FLAG_KEY,
	type ToggledTargetEntry,
} from '#utils/actor/toggledEffects.js';
import { isOut } from '#utils/combat/isOut.js';
import localize from '#utils/localize.js';
import { spacesBetween } from '#utils/movement/spacesBetween.js';
import { tokenHoverIn, tokenHoverOut } from '#utils/tokens/tokenHoverHighlight.js';
import { NimbleBaseRule } from './base.js';

function schema() {
	const { fields } = foundry.data;

	return {
		type: new fields.StringField({ required: true, nullable: false, initial: 'additionalMark' }),
		flagKey: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'quarry',
			label: 'NIMBLE.rules.additionalMark.flagKey.label',
			hint: 'NIMBLE.rules.additionalMark.flagKey.hint',
		}),
		within: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 1,
			initial: 6,
			label: 'NIMBLE.rules.additionalMark.within.label',
			hint: 'NIMBLE.rules.additionalMark.within.hint',
		}),
	};
}

declare namespace AdditionalMarkRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/** A token the rule can measure. The scene's tokens are the candidates. */
interface AdditionalMarkToken {
	uuid?: string;
	name?: string;
	hidden?: boolean;
	object?: unknown;
	combatant?: { isDefeated?: boolean } | null;
	actor?: { uuid?: string; name?: string; statuses?: Set<string> } | null;
	parent?: { tokens?: Iterable<AdditionalMarkToken> } | null;
}

interface MarkOwner {
	uuid: string;
	getFlag(scope: string, key: string): unknown;
	setFlag(scope: string, key: string, value: unknown): Promise<unknown>;
	rules?: unknown;
}

interface MarkAnotherArgs<Marked> {
	actor: MarkOwner;
	flagKey: string;
	/** The mark list just written. This flag key is not read back, so a stale flag cannot restore ended marks. */
	list: ToggledTargetEntry[];
	markedActorUuid: string;
	markedToken: AdditionalMarkToken | null;
	/** The card of the new mark. It shows the second creature, so its owner can end that mark. */
	cardId: string | null;
	applyMarker: (actor: Marked) => Promise<void>;
}

interface Candidate {
	token: AdditionalMarkToken;
	spaces: number;
	action: string;
}

const DECLINE = 'decline';

/**
 * After a mark that ends every earlier mark of the same flag, lets the owner also mark
 * another creature within `within` spaces of the new mark. That mark uses no item, so it
 * spends no action and no charges.
 */
class AdditionalMarkRule extends NimbleBaseRule<AdditionalMarkRule.Schema> {
	static override worksOnEffects = false;

	static override group = 'triggers';
	static override description = 'NIMBLE.rules.additionalMark.description';
	static override icon = 'fa-solid fa-crosshairs';

	declare flagKey: string;
	declare within: number;

	static override defineSchema(): AdditionalMarkRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['flagKey', 'string'],
				['within', 'number'],
			]),
		);
	}

	/** Runs the first rule of the owner that follows this flag, if any. */
	static async markAnotherAfter<Marked>(args: MarkAnotherArgs<Marked>): Promise<void> {
		const rule = rulesOfType(args.actor, 'additionalMark').find(
			(candidate) =>
				candidate.flagKey === args.flagKey &&
				candidate.isOnActor &&
				candidate.appliesTo() &&
				Number.isInteger(candidate.within) &&
				candidate.within >= 1,
		);
		await rule?.markAnother(args);
	}

	async markAnother<Marked>(args: MarkAnotherArgs<Marked>): Promise<void> {
		const origin = args.markedToken;
		if (!origin) return;

		const candidates = this.#candidatesNear(
			origin,
			new Set([args.actor.uuid, args.markedActorUuid]),
		);
		if (candidates.length === 0) return;

		const markedName = origin.actor?.name || origin.name || '';
		const chosen = await this.#ask(candidates, markedName);
		const actor = chosen?.token.actor;
		if (!chosen || !actor?.uuid) return;

		const entry: ToggledTargetEntry = {
			actorUuid: actor.uuid,
			tokenUuid: chosen.token.uuid ?? null,
			name: actor.name || chosen.token.name || localize('NIMBLE.mark.additional.unnamed'),
			...(args.cardId ? { cardId: args.cardId } : {}),
		};
		const flag = { ...readToggledEffects(args.actor) };
		const list = args.list.filter((existing) => existing.actorUuid !== entry.actorUuid);
		list.push(entry);
		flag[args.flagKey] = list;
		await args.actor.setFlag(SYSTEM_ID, TOGGLED_EFFECTS_FLAG_KEY, flag);
		await args.applyMarker(actor as Marked);
	}

	/** Creatures on the new mark's scene, within range, that are not out of the fight. */
	#candidatesNear(origin: AdditionalMarkToken, exclude: Set<string>): Candidate[] {
		const seen = new Set<string>();
		const candidates: Candidate[] = [];
		for (const token of origin.parent?.tokens ?? []) {
			const actor = token.actor;
			if (token.hidden || !actor?.uuid) continue;
			if (exclude.has(actor.uuid) || seen.has(actor.uuid)) continue;
			if (isOut(actor, token.combatant?.isDefeated)) continue;
			const spaces = spacesBetween(
				origin as MeasurableTokenDocument,
				token as MeasurableTokenDocument,
				undefined,
				this.within,
			);
			if (spaces > this.within) continue;
			seen.add(actor.uuid);
			candidates.push({ token, spaces, action: `mark:${token.uuid || actor.uuid}` });
		}
		return candidates;
	}

	/** The creature the owner picks, or null when they mark none. */
	async #ask(candidates: Candidate[], markedName: string): Promise<Candidate | null> {
		const buttons = candidates.map(({ token, spaces, action }) => ({
			action,
			label: localize(
				spaces === 1
					? 'NIMBLE.mark.additional.creatureOneSpace'
					: 'NIMBLE.mark.additional.creature',
				{
					name: token.name || token.actor?.name || localize('NIMBLE.mark.additional.unnamed'),
					spaces: String(spaces),
				},
			),
		}));

		const chosen = await foundry.applications.api.DialogV2.wait({
			window: { title: localize('NIMBLE.mark.additional.title') },
			content: `<p>${localize('NIMBLE.mark.additional.content', {
				name: foundry.utils.escapeHTML(markedName),
				spaces: String(this.within),
			})}</p>`,
			buttons: [...buttons, { action: DECLINE, label: localize('NIMBLE.mark.additional.decline') }],
			rejectClose: false,
			render: (_event, dialog) => {
				for (const button of dialog.element.querySelectorAll<HTMLElement>('[data-action]')) {
					const candidate = candidates.find(({ action }) => action === button.dataset.action);
					if (!candidate) continue;
					button.addEventListener('mouseenter', () => tokenHoverIn(candidate.token.object));
					button.addEventListener('mouseleave', () => tokenHoverOut(candidate.token.object));
				}
			},
			close: () => {
				tokenHoverOut(null);
			},
		});

		if (typeof chosen !== 'string' || chosen === DECLINE) return null;
		return candidates.find((candidate) => candidate.action === chosen) ?? null;
	}
}

export { AdditionalMarkRule, type AdditionalMarkToken };
