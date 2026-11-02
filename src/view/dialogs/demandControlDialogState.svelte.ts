import {
	AFFLICTIONS,
	type ControlChoice,
	type ControlOption,
	cantripsOf,
	choiceIsComplete,
	controlRules,
	optionRows,
	usedThisRound,
} from '#utils/demandControl/demandControl.js';

type DialogActor = Parameters<typeof optionRows>[0];

interface TokenView {
	actor?: { uuid?: string } | null;
	name?: string | null;
}

function sceneCreatures() {
	const tokens = (canvas?.tokens?.placeables ?? []) as unknown as TokenView[];
	return tokens
		.filter((token) => token.actor?.uuid)
		.map((token) => ({ uuid: token.actor?.uuid ?? '', name: token.name ?? '' }));
}

/** The state of the window with the options of the Control Table. */
export function createDemandControlState(input: {
	actor: DialogActor;
	locked?: ControlOption;
	reportsRound?: boolean;
}) {
	const { actor, locked } = input;
	const rules = controlRules(actor);
	const rows = optionRows(actor);
	const cantrips = cantripsOf(actor);
	const creatures = sceneCreatures();
	const [firstTarget] = Array.from(game.user?.targets ?? []) as unknown as TokenView[];

	let option = $state<ControlOption | null>(locked ?? null);
	let cantripId = $state<string | null>(cantrips[0]?.id ?? null);
	let creatureUuid = $state<string | null>(firstTarget?.actor?.uuid ?? null);
	let protectedUuid = $state<string | null>(null);
	let condition = $state<(typeof AFFLICTIONS)[number]>(AFFLICTIONS[0]);
	let twice = $state(false);
	let asReaction = $state(false);

	const choice = $derived<ControlChoice | null>(
		option
			? {
					option,
					cantripId,
					creatureUuid,
					protectedUuid,
					condition,
					twice,
					asReaction,
				}
			: null,
	);

	return {
		rows: locked ? rows.filter((row) => row.id === locked) : rows,
		cantrips,
		creatures,
		afflictions: AFFLICTIONS,
		offersTwice: !locked && rules.some((rule) => rule.triggerTwice),
		offersReaction: !locked && rules.some((rule) => rule.triggerTwice),
		roundUsed: !locked && input.reportsRound === true && usedThisRound(actor),
		get option() {
			return option;
		},
		set option(value: ControlOption | null) {
			option = locked ?? value;
		},
		get cantripId() {
			return cantripId;
		},
		set cantripId(value: string | null) {
			cantripId = value;
		},
		get creatureUuid() {
			return creatureUuid;
		},
		set creatureUuid(value: string | null) {
			creatureUuid = value;
		},
		get protectedUuid() {
			return protectedUuid;
		},
		set protectedUuid(value: string | null) {
			protectedUuid = value;
		},
		get condition() {
			return condition;
		},
		set condition(value: (typeof AFFLICTIONS)[number]) {
			condition = value;
		},
		get twice() {
			return twice;
		},
		set twice(value: boolean) {
			twice = value;
		},
		get asReaction() {
			return asReaction;
		},
		set asReaction(value: boolean) {
			asReaction = value;
		},
		get choice() {
			return choice;
		},
		get canConfirm() {
			return !!choice && choiceIsComplete(choice);
		},
	};
}
