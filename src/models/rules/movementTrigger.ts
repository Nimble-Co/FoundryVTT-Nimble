import localize from '#utils/localize.js';
import { hasRuleCharge, spendRuleCharge } from '../../utils/chargePool/ruleChargeGate.js';
import {
	type MovementTriggerOptions,
	matchMovementTrigger,
	type TriggerCreature,
	type TriggerGeometry,
} from '../../utils/movement/matchMovementTrigger.js';
import { postMovementTriggerCard } from '../../utils/movement/postMovementTriggerCard.js';
import { withWidget } from './_widgetOption.js';
import { type MovementFinishedContext, NimbleBaseRule } from './base.js';

const REACH_GEOMETRIES: ReadonlySet<unknown> = new Set([
	'endsAdjacent',
	'enteredReach',
	'leftReach',
]);

function schema() {
	const { fields } = foundry.data;

	return {
		event: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'selfMoved',
			choices: ['selfMoved', 'creatureMoved'],
			label: 'NIMBLE.rules.movementTrigger.event.label',
			hint: 'NIMBLE.rules.movementTrigger.event.hint',
		}),
		creature: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: ['enemy', 'ally', 'any'],
			label: 'NIMBLE.rules.movementTrigger.creature.label',
			hint: 'NIMBLE.rules.movementTrigger.creature.hint',
		}),
		kinds: new fields.ArrayField(
			new fields.StringField({
				required: true,
				nullable: false,
				blank: false,
				choices: ['regular', 'free', 'forced'],
			}),
			{
				required: true,
				nullable: false,
				initial: ['regular', 'free', 'forced'],
				label: 'NIMBLE.rules.movementTrigger.kinds.label',
				hint: 'NIMBLE.rules.movementTrigger.kinds.hint',
			},
		),
		minSpaces: new fields.NumberField({
			required: true,
			nullable: false,
			integer: true,
			min: 0,
			initial: 0,
			label: 'NIMBLE.rules.movementTrigger.minSpaces.label',
			hint: 'NIMBLE.rules.movementTrigger.minSpaces.hint',
		}),
		spacesScope: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'thisTurn',
			choices: ['thisTurn', 'thisMovement'],
			label: 'NIMBLE.rules.movementTrigger.spacesScope.label',
			hint: 'NIMBLE.rules.movementTrigger.spacesScope.hint',
		}),
		geometry: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'any',
			choices: ['any', 'endsAdjacent', 'enteredReach', 'leftReach', 'inPath', 'movedToward'],
			label: 'NIMBLE.rules.movementTrigger.geometry.label',
			hint: 'NIMBLE.rules.movementTrigger.geometry.hint',
		}),
		reach: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 1,
				initial: 1,
				label: 'NIMBLE.rules.movementTrigger.reach.label',
				hint: 'NIMBLE.rules.movementTrigger.reach.hint',
				showWhen: (data: Record<string, unknown>) => REACH_GEOMETRIES.has(data.geometry),
			}),
		),
		minTargets: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 1,
				initial: 1,
				label: 'NIMBLE.rules.movementTrigger.minTargets.label',
				hint: 'NIMBLE.rules.movementTrigger.minTargets.hint',
				showWhen: (data: Record<string, unknown>) =>
					data.event === 'selfMoved' && data.geometry !== 'any',
			}),
		),
		observerScope: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: 'self',
				choices: ['self', 'selfOrAllyWithin'],
				label: 'NIMBLE.rules.movementTrigger.observerScope.label',
				hint: 'NIMBLE.rules.movementTrigger.observerScope.hint',
				showWhen: (data: Record<string, unknown>) => data.event === 'creatureMoved',
			}),
		),
		allyRadius: new fields.NumberField(
			withWidget({
				required: true,
				nullable: false,
				integer: true,
				min: 0,
				initial: 6,
				label: 'NIMBLE.rules.movementTrigger.allyRadius.label',
				hint: 'NIMBLE.rules.movementTrigger.allyRadius.hint',
				showWhen: (data: Record<string, unknown>) =>
					data.event === 'creatureMoved' && data.observerScope === 'selfOrAllyWithin',
			}),
		),
		payload: new fields.StringField({
			required: true,
			nullable: false,
			initial: 'offer',
			choices: ['offer', 'reminder'],
			label: 'NIMBLE.rules.movementTrigger.payload.label',
			hint: 'NIMBLE.rules.movementTrigger.payload.hint',
		}),
		// Plain text: the templateString widget's hint names a formula this rule does not have.
		message: new fields.StringField({
			required: true,
			nullable: false,
			initial: '',
			label: 'NIMBLE.rules.movementTrigger.message.label',
			hint: 'NIMBLE.rules.movementTrigger.message.hint',
		}),
		chargePoolIdentifier: new fields.StringField(
			withWidget({
				required: true,
				nullable: false,
				initial: '',
				label: 'NIMBLE.rules.movementTrigger.chargePoolIdentifier.label',
				hint: 'NIMBLE.rules.movementTrigger.chargePoolIdentifier.hint',
				widget: 'chargePoolPicker',
			}),
		),
		type: new fields.StringField({ required: true, nullable: false, initial: 'movementTrigger' }),
	};
}

declare namespace MovementTriggerRule {
	type Schema = NimbleBaseRule.Schema & ReturnType<typeof schema>;
}

/**
 * Posts a card when a finished Movement matches the configured event and
 * geometry. The card offers the use of this rule's item, or only reminds the
 * table; the system never uses the item itself.
 */
class MovementTriggerRule extends NimbleBaseRule<MovementTriggerRule.Schema> {
	static override group = 'triggers';
	static override description = 'NIMBLE.rules.movementTrigger.description';

	declare event: MovementTriggerOptions['event'];
	declare creature: TriggerCreature;
	declare kinds: MovementTriggerOptions['kinds'];
	declare minSpaces: number;
	declare spacesScope: MovementTriggerOptions['spacesScope'];
	declare geometry: TriggerGeometry;
	declare reach: number;
	declare minTargets: number;
	declare observerScope: MovementTriggerOptions['observerScope'];
	declare allyRadius: number;
	declare payload: 'offer' | 'reminder';
	declare message: string;
	declare chargePoolIdentifier: string;

	static override defineSchema(): MovementTriggerRule.Schema {
		return {
			...NimbleBaseRule.defineSchema(),
			...schema(),
		};
	}

	override tooltipInfo(): string {
		return super.tooltipInfo(
			new Map([
				['event', 'string'],
				['creature', 'string'],
				['kinds', 'string[]'],
				['minSpaces', 'number'],
				['spacesScope', 'string'],
				['geometry', 'string'],
				['reach', 'number'],
				['minTargets', 'number'],
				['observerScope', 'string'],
				['allyRadius', 'number'],
				['payload', 'string'],
				['message', 'string'],
				['chargePoolIdentifier', 'string'],
			]),
		);
	}

	override async onMovementFinished(context: MovementFinishedContext): Promise<void> {
		if (!this.item.isEmbedded) return;
		if (!this.test()) return;

		const { record } = context;
		const sceneTokens = (record.token.parent?.tokens ?? []) as Iterable<TokenDocument>;
		const match = matchMovementTrigger(
			record,
			context.token,
			context.isMover,
			this.#options(),
			sceneTokens,
		);
		if (!match) return;

		const { actor } = this;
		if (!hasRuleCharge(actor, this.chargePoolIdentifier)) return;

		const moverName = record.token.name || record.actor?.name || '';
		const targetNames = match.targets.map((token) => token.name ?? '').filter(Boolean);
		const template =
			this.message.trim() ||
			localize(`NIMBLE.rules.movementTrigger.defaultMessages.${this.payload}`);
		const message = template
			.replaceAll('{mover}', moverName)
			.replaceAll('{spaces}', String(record.spaces))
			.replaceAll('{spacesThisTurn}', String(record.spacesThisTurn ?? record.spaces))
			.replaceAll('{targets}', targetNames.join(', '));

		const card = await postMovementTriggerCard({
			actor,
			item: this.item as unknown as Item,
			payload: this.payload,
			message,
			targets: match.targets.flatMap((token) => (token.uuid ? [token.uuid] : [])),
			moverName,
			spaces: record.spaces,
			spacesThisTurn: record.spacesThisTurn ?? 0,
		});
		if (card) await spendRuleCharge(actor, this.chargePoolIdentifier);
	}

	#options(): MovementTriggerOptions {
		return {
			event: this.event,
			creature: this.creature,
			kinds: [...this.kinds],
			minSpaces: this.minSpaces,
			spacesScope: this.spacesScope,
			geometry: this.geometry,
			reach: this.reach,
			minTargets: this.minTargets,
			observerScope: this.observerScope,
			allyRadius: this.allyRadius,
		};
	}
}

export { MovementTriggerRule };
