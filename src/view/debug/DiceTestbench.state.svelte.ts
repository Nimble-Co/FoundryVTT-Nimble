import { hasWeaponProficiency } from '#utils/attackUtils.js';
import localize from '#utils/localize.js';
import type { CategorizedPrimary, ResultDump, TestbenchActor } from './DiceTestbench.types.js';
import { categorizeDie, parseFormulaForDice } from './DiceTestbench.utils.js';
import { type Scenario, scenarios } from './scenarios.js';
import { type StagedValue, stageAndRoll } from './stageAndRoll.js';

export function createDiceTestbenchState() {
	// ============================================================================
	// Actor selection
	// ============================================================================

	let selectedActorId = $state<string | null>(null);

	const actors = $derived.by(() => {
		const all = (game.actors?.contents ?? []) as TestbenchActor[];
		return all.filter((a) => a.type === 'character' || a.type === 'npc' || a.type === 'minion');
	});

	const selectedActor = $derived(actors.find((a) => a.id === selectedActorId) ?? null);

	// ============================================================================
	// Roll builder state
	// ============================================================================

	let formula = $state('1d8');
	let isVicious = $state(false);
	let canCrit = $state(true);
	let canMiss = $state(true);
	let primaryDieAsDamage = $state(true);
	let templateShape = $state('');
	let weaponType = $state('');
	let advCount = $state(0);
	let disCount = $state(0);
	let forceCrit = $state(false);
	let forceMiss = $state(false);
	let brutalPrimary = $state(false);
	let specificValues = $state<Array<number | null>>([]);
	let showSpecific = $state(false);

	// ============================================================================
	// Derived flags
	// ============================================================================

	const effectiveCanCrit = $derived(templateShape !== '' ? false : canCrit);
	const effectiveCanMiss = $derived(templateShape !== '' ? false : canMiss);
	const flagsLocked = $derived(templateShape !== '');
	const netRollMode = $derived(advCount - disCount);

	const rollModeSourcesArray = $derived([
		...Array.from({ length: advCount }, () => 1),
		...Array.from({ length: disCount }, () => -1),
	]);

	function setForceCrit(value: boolean) {
		forceCrit = value;
		if (value) forceMiss = false;
	}

	function setForceMiss(value: boolean) {
		forceMiss = value;
		if (value) forceCrit = false;
	}

	const proficient = $derived.by(() => {
		if (weaponType === '') return null;
		return hasWeaponProficiency(
			selectedActor as unknown as Parameters<typeof hasWeaponProficiency>[0],
			{ system: { weaponType } },
		);
	});

	const isMinion = $derived(selectedActor?.type === 'minion');
	const critSuppressedForNonProf = $derived(proficient === false);

	const resolvedCanCrit = $derived(
		effectiveCanCrit && !isMinion && (proficient === null || proficient === true),
	);
	const resolvedCanMiss = $derived(effectiveCanMiss);

	const critSuppressionReason = $derived.by<string | null>(() => {
		if (resolvedCanCrit) return null;
		if (templateShape !== '') {
			return localize('NIMBLE.diceTestbench.rollBuilder.suppressionReason.aoe');
		}
		if (isMinion) {
			return localize('NIMBLE.diceTestbench.rollBuilder.suppressionReason.minion');
		}
		if (proficient === false) {
			return localize('NIMBLE.diceTestbench.rollBuilder.suppressionReason.nonProficient');
		}
		if (!canCrit) {
			return localize('NIMBLE.diceTestbench.rollBuilder.suppressionReason.flagOff');
		}
		return null;
	});

	const missSuppressionReason = $derived.by<string | null>(() => {
		if (resolvedCanMiss) return null;
		if (templateShape !== '') {
			return localize('NIMBLE.diceTestbench.rollBuilder.suppressionReason.aoe');
		}
		if (!canMiss) {
			return localize('NIMBLE.diceTestbench.rollBuilder.suppressionReason.flagOff');
		}
		return null;
	});

	// ============================================================================
	// Formula parsing & specific values
	// ============================================================================

	const parsedDice = $derived.by(() => parseFormulaForDice(formula));

	$effect(() => {
		if (specificValues.length !== parsedDice.length) {
			specificValues = parsedDice.map((_, i) => specificValues[i] ?? null);
		}
	});

	// ============================================================================
	// Results
	// ============================================================================

	let lastResult = $state<ResultDump | null>(null);
	let lastError = $state<string | null>(null);
	let showRawJson = $state(false);

	const outcomeBadge = $derived.by<{ label: string; kind: 'crit' | 'miss' | 'hit' | 'none' }>(
		() => {
			if (!lastResult) return { label: '', kind: 'none' };
			if (lastResult.isCritical) {
				return { label: localize('NIMBLE.diceTestbench.results.crit'), kind: 'crit' };
			}
			if (lastResult.isMiss) {
				return { label: localize('NIMBLE.diceTestbench.results.miss'), kind: 'miss' };
			}
			return { label: localize('NIMBLE.diceTestbench.results.hit'), kind: 'hit' };
		},
	);

	const primaryTerms = $derived(lastResult?.terms.filter((t) => t.type === 'PrimaryDie') ?? []);

	const categorizedPrimary = $derived.by<CategorizedPrimary[]>(() => {
		return primaryTerms.map((term) => {
			const baseCount = term.number ?? term.results?.length ?? 0;
			return {
				faces: term.faces,
				dice: (term.results ?? []).map((r, i) => ({
					result: r.result,
					active: r.active,
					discarded: r.discarded,
					exploded: r.exploded,
					category: categorizeDie(r, i, baseCount),
				})),
			};
		});
	});

	const bonusDieTerms = $derived(
		lastResult?.terms.filter((t) => t.type === 'Die' || t.type === 'NimbleDie') ?? [],
	);
	const numericTerms = $derived(
		lastResult?.terms.filter((t) => t.type === 'NumericTerm' && t.number !== null) ?? [],
	);

	// ============================================================================
	// Scenarios
	// ============================================================================

	let activeScenarioId = $state<string | null>(null);
	const activeScenario = $derived(scenarios.find((s) => s.id === activeScenarioId) ?? null);

	function applyScenario(scenario: Scenario) {
		activeScenarioId = scenario.id;
		formula = scenario.formula ?? '1d8';
		isVicious = scenario.isVicious ?? false;
		canCrit = scenario.canCrit ?? true;
		canMiss = scenario.canMiss ?? true;
		primaryDieAsDamage = scenario.primaryDieAsDamage ?? true;
		templateShape = scenario.templateShape ?? '';
		weaponType = scenario.weaponType ?? '';
		advCount = scenario.advCount ?? 0;
		disCount = scenario.disCount ?? 0;
		forceCrit = scenario.forceCrit ?? false;
		forceMiss = scenario.forceMiss ?? false;
		brutalPrimary = scenario.brutalPrimary ?? false;
		specificValues = [];
		showSpecific = false;
		lastResult = null;
		lastError = null;
	}

	// ============================================================================
	// Rolling
	// ============================================================================

	function getPrimaryFaces(): number | null {
		const first = parsedDice[0];
		return first ? first.faces : null;
	}

	async function performRoll(stagedValues: StagedValue[]) {
		lastError = null;
		try {
			const actorData = (selectedActor?.getRollData?.() ?? {}) as Record<string, unknown>;
			const result = await stageAndRoll(
				formula,
				{
					isVicious,
					canCrit: resolvedCanCrit,
					canMiss: resolvedCanMiss,
					primaryDieAsDamage,
					primaryDieValue: 0,
					primaryDieModifier: 0,
					rollMode: 0,
					rollModeSources: rollModeSourcesArray,
					brutalPrimary,
				},
				stagedValues,
				actorData as never,
			);
			lastResult = {
				trace: result.trace,
				isCritical: result.roll.isCritical,
				isMiss: result.roll.isMiss,
				total: result.roll.total,
				terms: result.roll.terms.map((t) => {
					const anyT = t as {
						constructor: { name: string };
						formula?: string;
						faces?: number;
						results?: Array<{
							result: number;
							active?: boolean;
							discarded?: boolean;
							exploded?: boolean;
						}>;
						number?: number;
						operator?: string;
					};
					const isDie = Array.isArray(anyT.results);
					return {
						type: anyT.constructor.name,
						formula: anyT.formula ?? '',
						faces: typeof anyT.faces === 'number' ? anyT.faces : null,
						results: isDie
							? (anyT.results ?? []).map((r) => {
									const provRaw = (r as { provenance?: unknown }).provenance;
									return {
										result: r.result,
										active: r.active !== false,
										discarded: r.discarded === true,
										exploded: r.exploded === true,
										provenance: typeof provRaw === 'string' ? provRaw : null,
									};
								})
							: null,
						number: typeof anyT.number === 'number' ? anyT.number : null,
						operator: typeof anyT.operator === 'string' ? anyT.operator : null,
					};
				}),
			};
		} catch (err) {
			lastError = err instanceof Error ? err.message : String(err);
			lastResult = null;
		}
	}

	async function onRoll() {
		if (forceCrit || forceMiss) {
			const faces = getPrimaryFaces();
			if (faces === null) {
				lastError = localize('NIMBLE.diceTestbench.rollBuilder.errors.noPrimaryDie');
				return;
			}
			const value = forceCrit ? faces : 1;
			await performRoll([{ value, faces }]);
			return;
		}
		await performRoll([]);
	}

	async function onRollWithSpecific() {
		const staged: StagedValue[] = [];
		for (let i = 0; i < parsedDice.length; i += 1) {
			const v = specificValues[i];
			if (v && v > 0) {
				staged.push({ value: v, faces: parsedDice[i].faces });
			} else {
				break;
			}
		}
		await performRoll(staged);
	}

	const resultJson = $derived(lastResult ? JSON.stringify(lastResult, null, 2) : '');

	// ============================================================================
	// Public API
	// ============================================================================

	return {
		// Actor selection
		get selectedActorId() {
			return selectedActorId;
		},
		set selectedActorId(v) {
			selectedActorId = v;
		},
		get actors() {
			return actors;
		},
		get selectedActor() {
			return selectedActor;
		},

		// Roll builder (read/write — used with bind:)
		get formula() {
			return formula;
		},
		set formula(v) {
			formula = v;
		},
		get isVicious() {
			return isVicious;
		},
		set isVicious(v) {
			isVicious = v;
		},
		get canCrit() {
			return canCrit;
		},
		set canCrit(v) {
			canCrit = v;
		},
		get canMiss() {
			return canMiss;
		},
		set canMiss(v) {
			canMiss = v;
		},
		get primaryDieAsDamage() {
			return primaryDieAsDamage;
		},
		set primaryDieAsDamage(v) {
			primaryDieAsDamage = v;
		},
		get templateShape() {
			return templateShape;
		},
		set templateShape(v) {
			templateShape = v;
		},
		get weaponType() {
			return weaponType;
		},
		set weaponType(v) {
			weaponType = v;
		},
		get advCount() {
			return advCount;
		},
		set advCount(v) {
			advCount = v;
		},
		get disCount() {
			return disCount;
		},
		set disCount(v) {
			disCount = v;
		},
		get forceCrit() {
			return forceCrit;
		},
		get forceMiss() {
			return forceMiss;
		},
		get brutalPrimary() {
			return brutalPrimary;
		},
		set brutalPrimary(v) {
			brutalPrimary = v;
		},
		get specificValues() {
			return specificValues;
		},
		set specificValues(v) {
			specificValues = v;
		},
		get showSpecific() {
			return showSpecific;
		},
		set showSpecific(v) {
			showSpecific = v;
		},
		get showRawJson() {
			return showRawJson;
		},
		set showRawJson(v) {
			showRawJson = v;
		},

		// Derived (read-only)
		get flagsLocked() {
			return flagsLocked;
		},
		get netRollMode() {
			return netRollMode;
		},
		get proficient() {
			return proficient;
		},
		get critSuppressedForNonProf() {
			return critSuppressedForNonProf;
		},
		get resolvedCanCrit() {
			return resolvedCanCrit;
		},
		get resolvedCanMiss() {
			return resolvedCanMiss;
		},
		get critSuppressionReason() {
			return critSuppressionReason;
		},
		get missSuppressionReason() {
			return missSuppressionReason;
		},
		get parsedDice() {
			return parsedDice;
		},
		get lastResult() {
			return lastResult;
		},
		get lastError() {
			return lastError;
		},
		get outcomeBadge() {
			return outcomeBadge;
		},
		get categorizedPrimary() {
			return categorizedPrimary;
		},
		get bonusDieTerms() {
			return bonusDieTerms;
		},
		get numericTerms() {
			return numericTerms;
		},
		get activeScenarioId() {
			return activeScenarioId;
		},
		get activeScenario() {
			return activeScenario;
		},
		get resultJson() {
			return resultJson;
		},

		// Actions
		setForceCrit,
		setForceMiss,
		applyScenario,
		onRoll,
		onRollWithSpecific,
	};
}
