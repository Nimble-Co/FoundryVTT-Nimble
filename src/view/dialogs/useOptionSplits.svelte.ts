import type { ResourceCost } from '#types/resourceCost.d.ts';
import type { CostPayer } from '#types/useCost.d.ts';
import type {
	ChosenUseOption,
	UseOption,
	UseOptionGroup,
	UseOptionPick,
} from '#types/useOption.d.ts';
import { resourceKind, variableRangeOf, wholeAmount } from '#utils/cost/resourceCost.js';
import { resourceCostText } from '#utils/cost/resourceCostWords.js';
import localize from '#utils/localize.js';

/** One stepper of a split option. */
export interface SplitPickView {
	key: string;
	label: string;
	amount: number;
	/** The most this pick can take, after the other picks. */
	limit: number;
	/** The most the whole split can take, shown after the slash. */
	cap: number;
}

/** A split option as the dialog shows it: a heading, one stepper for each pick, a total line. */
export interface SplitView {
	key: string;
	heading: string;
	picks: SplitPickView[];
	totalLine: string;
}

/** "<pick>: +5 Radiant", "<pick>: armor 1 step lower", or the name alone. */
function pickLabel(pick: UseOptionPick): string {
	const effects: string[] = [];
	if (pick.damage) {
		const typeKey = CONFIG.NIMBLE.damageTypes?.[pick.damageType as never] as string | undefined;
		effects.push(
			localize('NIMBLE.useOptions.split.damage', {
				damage: pick.damage,
				type: typeKey ? localize(typeKey).toLocaleLowerCase() : '',
			}).trim(),
		);
	}
	if (pick.lowerArmorSteps > 0) {
		effects.push(
			pick.lowerArmorSteps === 1
				? localize('NIMBLE.useOptions.split.armorStep')
				: localize('NIMBLE.useOptions.split.armorSteps', { steps: String(pick.lowerArmorSteps) }),
		);
	}
	if (effects.length === 0) return pick.name;
	return localize('NIMBLE.useOptions.split.pick', { name: pick.name, effects: effects.join(', ') });
}

type SplitOption = UseOption & { picks: NonNullable<UseOption['picks']> };

/**
 * The split options of a use: an amount up to a cap, shared between named picks that each have
 * their own stepper. Nothing is put in a pick at first.
 */
export function useOptionSplits(actor: CostPayer, groups: readonly UseOptionGroup[]) {
	const splits = groups
		.flatMap((group) => group.options)
		.filter((option): option is SplitOption => (option.picks?.length ?? 0) > 0)
		.map((option) => ({
			option,
			cap: variableRangeOf(actor, option.cost)?.limit ?? 0,
		}));

	let amounts = $state<Record<string, Record<string, number>>>({});

	const totalOf = (key: string) =>
		Object.values(amounts[key] ?? {}).reduce((total, each) => total + each, 0);

	const views = $derived<SplitView[]>(
		splits.map(({ option, cap }) => {
			const total = totalOf(option.key);
			const { kind, spend } = option.cost;
			const max = spend.mode === 'variable' ? wholeAmount(spend.max) : cap;
			return {
				key: option.key,
				heading: localize('NIMBLE.useOptions.split.heading', {
					name: option.name,
					cost: resourceCostText(kind, max),
				}),
				picks: option.picks.map((pick) => {
					const amount = amounts[option.key]?.[pick.key] ?? 0;
					return {
						key: pick.key,
						label: pickLabel(pick),
						amount,
						limit: amount + Math.max(0, cap - total),
						cap,
					};
				}),
				totalLine: localize('NIMBLE.useOptions.split.total', {
					spent: String(total),
					cost: resourceCostText(kind, max),
					available: String(resourceKind(kind).have(actor)),
				}),
			};
		}),
	);

	function set(optionKey: string, pickKey: string, value: number): number {
		const split = splits.find(({ option }) => option.key === optionKey);
		if (!split?.option.picks.some((pick) => pick.key === pickKey)) return 0;
		const own = amounts[optionKey]?.[pickKey] ?? 0;
		const room = own + Math.max(0, split.cap - totalOf(optionKey));
		const next = Math.min(wholeAmount(value), room);
		amounts = { ...amounts, [optionKey]: { ...amounts[optionKey], [pickKey]: next } };
		return next;
	}

	const chosen = $derived<ChosenUseOption[]>(
		splits.flatMap(({ option }) => {
			const amount = totalOf(option.key);
			if (amount === 0) return [];
			const picks = Object.fromEntries(
				Object.entries(amounts[option.key] ?? {}).filter(([, each]) => each > 0),
			);
			return [{ key: option.key, amount, picks }];
		}),
	);

	return {
		get views() {
			return views;
		},
		/** The split options with an amount, as the dialog submits them. */
		get chosen() {
			return chosen;
		},
		/** The costs of the split options with an amount, for the spend line. */
		costs(): ResourceCost[] {
			return chosen.flatMap((choice) => {
				const split = splits.find(({ option }) => option.key === choice.key);
				return split ? [{ ...split.option.cost, amount: choice.amount ?? 0 }] : [];
			});
		},
		set,
		adjust(optionKey: string, pickKey: string, delta: number) {
			set(optionKey, pickKey, (amounts[optionKey]?.[pickKey] ?? 0) + delta);
		},
	};
}
