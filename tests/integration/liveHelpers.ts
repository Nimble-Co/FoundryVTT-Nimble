/**
 * Shared primitives for the live-Foundry integration suite. Everything here
 * operates on the live page globals (game/canvas/document classes); nothing
 * is imported from src/, so the helpers exercise the built system bundle.
 */

const GRID_SIZE = 100;

const settle = (ms = 600) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Poll until `predicate` is true. Reaction execution, expiry hooks, and mark
 * writes are all fire-and-forget chains, so polling beats fixed sleeps.
 */
async function waitFor(
	predicate: () => boolean,
	label: string,
	{ timeout = 10_000, interval = 200 }: { timeout?: number; interval?: number } = {},
): Promise<void> {
	const deadline = Date.now() + timeout;
	while (Date.now() < deadline) {
		if (predicate()) return;
		await settle(interval);
	}
	if (predicate()) return;
	throw new Error(`Timed out waiting for ${label}`);
}

/** Run a flow that posts to chat and return the first new message of `type`. */
async function messageFromFlow(type: string, flow: () => Promise<unknown>) {
	const before = new Set(game.messages.contents.map((message) => message.id));
	await flow();
	await settle(800);
	return game.messages.contents.find((message) => !before.has(message.id) && message.type === type);
}

/** Import a compendium document matching `predicate` as an embedded item. */
async function importPackItem(
	actor: Actor,
	packName: string,
	predicate: (entry: any) => boolean,
	indexFields: string[] = ['system.activation.template'],
) {
	const pack = game.packs.get(`${game.system.id}.${packName}`)!;
	const index = await pack.getIndex({ fields: indexFields });
	const entry = index.contents.find(predicate);
	if (!entry) throw new Error(`${packName} has no document matching the predicate`);
	const doc = (await pack.getDocument(entry._id))!;
	const [item] = await actor.createEmbeddedDocuments('Item', [doc.toObject() as Item.CreateData]);
	return item!;
}

/**
 * Create a square-grid scene and make it the viewed canvas. Token-driven
 * tests need real placeables, which only exist for the viewed scene.
 */
async function createViewedTestScene(name: string): Promise<Scene> {
	const scene = (await Scene.create({
		name,
		width: 4000,
		height: 3000,
		grid: { type: CONST.GRID_TYPES.SQUARE, size: GRID_SIZE, distance: 1, units: 'spaces' },
	}))!;
	await scene.view();
	await waitFor(
		() => !!canvas?.ready && canvas.scene?.id === scene.id,
		`scene "${name}" to become the viewed canvas`,
	);
	await settle(800);
	return scene;
}

interface PlaceTokenSpec {
	name: string;
	actor: Actor;
	/** Grid-space coordinates (multiplied by the grid size). */
	gx: number;
	gy: number;
	disposition: number;
	/**
	 * Raw token creation defaults to `actorLink: false` (prototype defaults only
	 * apply when dragging from the sidebar), so document writes hit a synthetic
	 * token actor. Pass true when the test asserts against the base actor.
	 */
	actorLink?: boolean;
}

/** Place a token on the scene and wait for its canvas placeable to exist. */
async function placeToken(scene: Scene, spec: PlaceTokenSpec): Promise<TokenDocument> {
	const [tokenDoc] = await scene.createEmbeddedDocuments('Token', [
		{
			name: spec.name,
			actorId: spec.actor.id,
			x: spec.gx * GRID_SIZE,
			y: spec.gy * GRID_SIZE,
			disposition: spec.disposition,
			actorLink: spec.actorLink ?? false,
		} as TokenDocument.CreateData,
	]);
	await waitFor(
		() => !!canvas.tokens?.get(tokenDoc!.id!),
		`token "${spec.name}" placeable on the canvas`,
	);
	return tokenDoc!;
}

function placeableOf(tokenDoc: TokenDocument) {
	const placeable = canvas.tokens?.get(tokenDoc.id!);
	if (!placeable) throw new Error(`token "${tokenDoc.name}" has no canvas placeable`);
	return placeable;
}

/** Target a token the same way the T keybind does. */
async function targetToken(tokenDoc: TokenDocument): Promise<void> {
	placeableOf(tokenDoc).setTarget(true, { releaseOthers: true });
	await settle(200);
}

async function clearTargets(): Promise<void> {
	for (const token of [...(game.user?.targets ?? [])]) {
		token.setTarget(false, { releaseOthers: false });
	}
	await settle(200);
}

/** A feature with a single 1-target attack dealing `formula` damage. */
function attackFeatureData(
	name: string,
	{
		formula = '1d8',
		damageType = 'slashing',
		attackType = 'reach',
	}: { formula?: string; damageType?: string; attackType?: 'reach' | 'range' } = {},
) {
	return {
		name,
		type: 'feature',
		system: {
			activation: {
				cost: { type: 'action', quantity: 1 },
				targets: { attackType, count: 1 },
				effects: [
					{
						id: 'atk',
						type: 'damage',
						formula,
						damageType,
						canCrit: true,
						canMiss: true,
						parentNode: null,
						parentContext: null,
					},
				],
			},
		},
	};
}

/** A roll-less feature carrying the given rules. */
function ruleFeatureData(name: string, rules: Array<Record<string, unknown>>) {
	return { name, type: 'feature', system: { rules } };
}

function messageNode(messageId: string): HTMLElement | null {
	return document.querySelector(`#chat [data-message-id="${messageId}"]`);
}

/**
 * Click an incoming-reaction button on a chat card as a real DOM interaction
 * (the button's Svelte onclick handler runs). Returns after a settle so the
 * un-awaited reaction chain has time to start; callers still poll the
 * resulting document state.
 */
async function clickReactionButton(messageId: string, labelIncludes?: string): Promise<void> {
	let button: HTMLButtonElement | null = null;
	await waitFor(
		() => {
			const buttons =
				messageNode(messageId)?.querySelectorAll<HTMLButtonElement>(
					'.nimble-incoming-reaction-button',
				) ?? [];
			button =
				[...buttons].find(
					(candidate) => !labelIncludes || (candidate.textContent ?? '').includes(labelIncludes),
				) ?? null;
			return button !== null;
		},
		`reaction button${labelIncludes ? ` "${labelIncludes}"` : ''} on message ${messageId}`,
	);
	button!.click();
	await settle(800);
}

/**
 * Create a Combat with one combatant per member. Combatant `type` must match
 * the actor's subtype ('character' combatants keep `initiative: null`;
 * everything else is zeroed by NimbleCombatant's preCreate). Callers own
 * deletion — track the returned combat's id for cleanup.
 */
async function createCombatWith(
	members: Array<{ actor: { id: string | null; type?: string } }>,
	{ start = true }: { start?: boolean } = {},
): Promise<Combat> {
	const combat = (await Combat.create({ active: true } as Combat.CreateData))!;
	await combat.createEmbeddedDocuments(
		'Combatant',
		members.map((member) => ({
			actorId: member.actor.id!,
			type: member.actor.type ?? 'character',
		})) as Combatant.CreateData[],
	);
	if (start) await combat.startCombat();
	return combat;
}

const RULE_AUTOMATION_SETTING = 'automation.applyRuleEffects';

/**
 * The rule-automation world setting, read/written through the same casts the
 * system uses (see isRuleAutomationEnabled) — it is not in fvtt-types'
 * registered settings map. This is the toggle that gates ruleEventDispatch, so
 * suites that depend on rule lifecycle events firing (or not) must snapshot and
 * restore it. Note that the health-state sync (bloodied/dying status mirroring)
 * has its own toggle and is NOT gated by this setting.
 */
function getRuleAutomationEnabled(): boolean {
	return Boolean(
		game.settings.get(game.system.id as 'core', RULE_AUTOMATION_SETTING as 'rollMode'),
	);
}

async function setRuleAutomationEnabled(value: boolean): Promise<void> {
	await game.settings.set(
		game.system.id as 'core',
		RULE_AUTOMATION_SETTING as 'rollMode',
		value as never,
	);
}

/**
 * Delete world documents left by a test file: actors and scenes whose name
 * starts with `prefix`, and chat messages attributed to them. Run at the
 * start of setup (stale leftovers from a crashed run) and again in afterAll.
 */
async function purgeTestDocuments(prefix: string): Promise<void> {
	const messageIds = game.messages
		.filter((message) => {
			const alias = message.speaker?.alias ?? '';
			const actorName = (message.system as { actorName?: string })?.actorName ?? '';
			const flavor = message.flavor ?? '';
			return alias.startsWith(prefix) || actorName.startsWith(prefix) || flavor.startsWith(prefix);
		})
		.map((message) => message.id!);
	if (messageIds.length) {
		await ChatMessage.deleteDocuments(messageIds).catch((error) => console.error(error));
	}

	for (const scene of game.scenes.filter((scene) => scene.name.startsWith(prefix))) {
		await scene.delete().catch((error) => console.error(error));
	}
	for (const actor of game.actors.filter((actor) => actor.name.startsWith(prefix))) {
		await actor.delete().catch((error) => console.error(error));
	}
}

export {
	attackFeatureData,
	clearTargets,
	clickReactionButton,
	createCombatWith,
	createViewedTestScene,
	getRuleAutomationEnabled,
	GRID_SIZE,
	importPackItem,
	messageFromFlow,
	messageNode,
	placeableOf,
	placeToken,
	purgeTestDocuments,
	ruleFeatureData,
	setRuleAutomationEnabled,
	settle,
	targetToken,
	waitFor,
};
