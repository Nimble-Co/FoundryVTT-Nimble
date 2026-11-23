import { SYSTEM_ID } from '#system';
import { COIN_ABBREVIATION, COIN_DENOMINATIONS, isCoinDenomination } from '#utils/coins.ts';
import { isActiveGM } from '#utils/isActiveGM.ts';
import localize from '#utils/localize.ts';
import {
	canWritePartyInventory,
	readPartyInventory,
	writePartyInventory,
} from '../../documents/actor/partyInventoryHolder.ts';
import type { PartyCurrency, PartyInventory } from '../../settings/partyInventorySetting.ts';
import {
	type ItemTransferPlan,
	isTrustedPlayer,
	mayTransferItem,
	planItemTransfer,
	type TransferItem,
} from './planItemTransfer.ts';

const SOCKET_NAME = `system.${SYSTEM_ID}`;
const REQUEST_TYPE = 'partyInventory';

export type TransferSource = 'actor' | 'party';

export interface TransferDestination {
	kind: 'actor' | 'party';
	actorId?: string;
}

export interface ItemTransferRequest {
	source: TransferSource;
	sourceActorId: string;
	itemId: string;
	quantity: number;
	destination: TransferDestination;
}

interface PartyInventoryMoveMessage extends ItemTransferRequest {
	type: typeof REQUEST_TYPE;
	op: 'move';
	userId: string;
}

interface PartyInventoryCoinMessage {
	type: typeof REQUEST_TYPE;
	op: 'currency';
	userId: string;
	coin: string;
	value: number;
}

export interface CurrencyTransferRequest {
	source: TransferSource;
	sourceActorId: string;
	destination: TransferDestination;
	gp: number;
	sp: number;
	cp: number;
}

interface PartyInventoryCoinsMessage extends CurrencyTransferRequest {
	type: typeof REQUEST_TYPE;
	op: 'giveCurrency';
	userId: string;
}

/** The destination character creates the objects, then the sender removes them. */
interface PartyInventoryReceiveMessage extends ItemTransferRequest {
	type: typeof REQUEST_TYPE;
	op: 'receive';
	userId: string;
}

interface PartyInventoryReleaseMessage {
	type: typeof REQUEST_TYPE;
	op: 'release';
	userId: string;
	sourceActorId: string;
	removeIds: string[];
	sourceQuantity: { id: string; quantity: number } | null;
}

/** The sender already subtracted these coins. The destination adds them. */
interface PartyInventoryReceiveCurrencyMessage extends CurrencyTransferRequest {
	type: typeof REQUEST_TYPE;
	op: 'receiveCurrency';
	userId: string;
}

type PartyMessage =
	| PartyInventoryMoveMessage
	| PartyInventoryCoinMessage
	| PartyInventoryCoinsMessage
	| PartyInventoryReceiveMessage
	| PartyInventoryReleaseMessage
	| PartyInventoryReceiveCurrencyMessage;

interface HeldItem {
	toObject(): TransferItem;
	update(data: Record<string, unknown>): Promise<unknown>;
}

interface HeldActor {
	id?: string | null;
	name?: string | null;
	type?: string;
	system?: { currency?: Record<string, number> };
	items: Iterable<HeldItem> & { get(id: string): HeldItem | undefined };
	testUserPermission?(user: unknown, permission: unknown): boolean;
	update?(data: Record<string, unknown>): Promise<unknown>;
	createEmbeddedDocuments(
		name: string,
		data: object[],
		options?: { keepId?: boolean },
	): Promise<unknown>;
	deleteEmbeddedDocuments(name: string, ids: string[]): Promise<unknown>;
}

interface TransferUser {
	id?: string;
	name?: string | null;
	isGM: boolean;
	role?: number;
	active?: boolean;
}

function getSocket():
	| {
			on?: (eventName: string, listener: (payload: unknown) => void) => void;
			emit?: (eventName: string, payload: unknown) => void;
	  }
	| undefined {
	return game.socket as ReturnType<typeof getSocket>;
}

function userById(userId: string): TransferUser | null {
	const users = game.users as unknown as { get?: (id: string) => TransferUser | null };
	return users.get?.(userId) ?? null;
}

function actorById(actorId: string): HeldActor | null {
	const actors = game.actors as unknown as { get?: (id: string) => HeldActor | null };
	return actors.get?.(actorId) ?? null;
}

function ownsActor(actor: HeldActor, user: TransferUser): boolean {
	if (user.isGM) return true;
	const level = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
	return Boolean(actor.testUserPermission?.(user, level));
}

function ownsACharacter(user: TransferUser): boolean {
	if (user.isGM) return true;
	const actors = game.actors as Iterable<HeldActor> | undefined;
	if (!actors) return false;
	for (const actor of actors) {
		if (actor.type === 'character' && ownsActor(actor, user)) return true;
	}
	return false;
}

function itemsOf(actor: HeldActor): TransferItem[] {
	return [...actor.items].map((item) => item.toObject());
}

function newItemId(): string {
	const randomID = (foundry.utils as { randomID?: () => string }).randomID;
	return randomID ? randomID() : crypto.randomUUID().replaceAll('-', '');
}

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

let pending: Promise<void> = Promise.resolve();

function enqueue(job: () => Promise<void>): Promise<void> {
	const run = pending.then(job, job);
	pending = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

function createdIds(result: unknown): string[] {
	if (!Array.isArray(result)) return [];
	return result.flatMap((entry) => {
		if (!entry || typeof entry !== 'object') return [];
		const id = (entry as { id?: unknown }).id;
		return typeof id === 'string' && id.length > 0 ? [id] : [];
	});
}

/** Creates the documents. Returns the ids that actually landed. */
async function createOnActor(actor: HeldActor, items: TransferItem[]): Promise<string[]> {
	const containers = items.filter((item) => {
		const container = item.system?.container as { enabled?: boolean } | undefined;
		return container?.enabled === true;
	});
	const rest = items.filter((item) => !containers.includes(item));
	const created: string[] = [];
	if (containers.length) {
		created.push(
			...createdIds(await actor.createEmbeddedDocuments('Item', containers, { keepId: true })),
		);
	}
	if (rest.length) {
		created.push(
			...createdIds(await actor.createEmbeddedDocuments('Item', rest, { keepId: true })),
		);
	}
	return created;
}

function creationLanded(expected: TransferItem[], created: readonly string[]): boolean {
	const present = new Set(created);
	return expected.every((item) => present.has(item._id));
}

async function removePartialCreate(
	actor: HeldActor,
	expected: TransferItem[],
	created: readonly string[],
): Promise<void> {
	const present = new Set(created);
	const ids = expected.map((item) => item._id).filter((id) => present.has(id));
	if (ids.length) await actor.deleteEmbeddedDocuments('Item', ids);
}

/** Applies one side. A destination that did not take the documents returns false. */
async function applyPlanToActor(
	actor: HeldActor,
	plan: ItemTransferPlan,
	side: 'source' | 'destination',
): Promise<boolean> {
	if (side === 'destination') {
		if (plan.merge) {
			const item = actor.items.get(plan.merge.id);
			if (!item) return false;
			const current = Math.floor(Number(item.toObject().system?.quantity ?? 1));
			const quantity = (Number.isFinite(current) && current > 0 ? current : 1) + plan.merge.add;
			await item.update({ 'system.quantity': quantity });
		}
		if (plan.add.length) {
			const created = await createOnActor(actor, plan.add);
			if (!creationLanded(plan.add, created)) {
				await removePartialCreate(actor, plan.add, created);
				return false;
			}
		}
		return true;
	}

	if (plan.sourceQuantity) {
		const item = actor.items.get(plan.sourceQuantity.id);
		await item?.update({ 'system.quantity': plan.sourceQuantity.quantity });
	}
	if (plan.removeIds.length) await actor.deleteEmbeddedDocuments('Item', plan.removeIds);
	return true;
}

function applyPlanToInventory(
	inventory: PartyInventory,
	plan: ItemTransferPlan,
	side: 'source' | 'destination',
): void {
	if (side === 'source') {
		const remove = new Set(plan.removeIds);
		inventory.items = inventory.items.flatMap((item) => {
			if (remove.has(item._id)) return [];
			if (plan.sourceQuantity && item._id === plan.sourceQuantity.id) {
				return [{ ...item, system: { ...item.system, quantity: plan.sourceQuantity.quantity } }];
			}
			return [item];
		});
		return;
	}

	if (plan.merge) {
		inventory.items = inventory.items.map((item) => {
			if (item._id !== plan.merge?.id) return item;
			const current = Math.floor(Number(item.system?.quantity ?? 1));
			const quantity = (Number.isFinite(current) && current > 0 ? current : 1) + plan.merge.add;
			return { ...item, system: { ...item.system, quantity } };
		});
	}
	inventory.items = [...inventory.items, ...plan.add];
}

function itemTransferChatKey(partyMove: boolean, moved: number): string {
	if (partyMove && moved === 1) return 'NIMBLE.actorSheet.hero.inventory.moved';
	if (partyMove) return 'NIMBLE.actorSheet.hero.inventory.movedCount';
	if (moved === 1) return 'NIMBLE.actorSheet.hero.inventory.gave';
	return 'NIMBLE.actorSheet.hero.inventory.gaveCount';
}

function coinTransferChatKey(partyMove: boolean): string {
	if (partyMove) return 'NIMBLE.actorSheet.hero.inventory.movedCoins';
	return 'NIMBLE.actorSheet.hero.inventory.gaveCoins';
}

function formatCoinAmount(spent: PartyCurrency): string {
	const parts = COIN_DENOMINATIONS.filter((coin) => spent[coin] > 0).map(
		(coin) => `${spent[coin]} ${localize(COIN_ABBREVIATION[coin])}`,
	);
	return new Intl.ListFormat(game.i18n.lang || 'en', { style: 'short', type: 'unit' }).format(
		parts,
	);
}

async function postTransferChat(
	user: TransferUser,
	key: string,
	fields: Record<string, string>,
): Promise<void> {
	const data: Record<string, string> = {
		user: escapeHtml(user.name || localize('NIMBLE.actorSheet.hero.inventory.someone')),
	};
	for (const [name, value] of Object.entries(fields)) data[name] = escapeHtml(value);
	await ChatMessage.create({
		user: user.id,
		speaker: { alias: user.name ?? '' },
		content: `<p>${localize(key, data)}</p>`,
	} as ChatMessage.CreateData);
}

async function applyMove(userId: string, request: ItemTransferRequest): Promise<void> {
	const user = userById(userId);
	if (!user) return;

	const sourceActor = request.source === 'actor' ? actorById(request.sourceActorId) : null;
	if (request.source === 'actor' && !sourceActor) return;
	const destinationActor =
		request.destination.kind === 'actor' && request.destination.actorId
			? actorById(request.destination.actorId)
			: null;
	if (request.destination.kind === 'actor' && !destinationActor) return;
	if (request.source === 'party' && request.destination.kind === 'party') return;
	if (request.source === 'actor' && destinationActor && sourceActor?.id === destinationActor.id) {
		return;
	}

	if (!senderMayMove(user, request, sourceActor, destinationActor)) return;

	const inventory = readPartyInventory();
	const sourceItems = sourceActor ? itemsOf(sourceActor) : inventory.items;
	const destinationItems = destinationActor ? itemsOf(destinationActor) : inventory.items;
	const plan = planItemTransfer(
		sourceItems,
		destinationItems,
		{ itemId: request.itemId, quantity: request.quantity },
		newItemId,
	);
	if (!plan) return;

	const inventoryTouched = request.source === 'party' || request.destination.kind === 'party';
	const nextInventory: PartyInventory = {
		currency: { ...inventory.currency },
		items: [...inventory.items],
	};
	if (request.destination.kind === 'party')
		applyPlanToInventory(nextInventory, plan, 'destination');
	if (destinationActor) {
		const landed = await applyPlanToActor(destinationActor, plan, 'destination');
		if (!landed) return;
	}
	if (request.source === 'party') applyPlanToInventory(nextInventory, plan, 'source');
	if (sourceActor) await applyPlanToActor(sourceActor, plan, 'source');
	if (inventoryTouched) await writePartyInventory(nextInventory);

	const destinationName =
		request.destination.kind === 'party'
			? localize('NIMBLE.actorSheet.hero.inventory.partyName')
			: (destinationActor?.name ?? '');
	await postTransferChat(user, itemTransferChatKey(inventoryTouched, plan.moved), {
		item: plan.name,
		destination: destinationName,
		count: String(plan.moved),
	});
}

function senderMayMove(
	user: TransferUser,
	request: { source: TransferSource; destination: TransferDestination },
	sourceActor: HeldActor | null,
	destinationActor: HeldActor | null,
): boolean {
	return mayTransferItem({
		isGM: user.isGM,
		trusted: isTrustedPlayer(user),
		source: request.source,
		destination: request.destination.kind,
		ownsSource: sourceActor ? ownsActor(sourceActor, user) : false,
		ownsDestination: destinationActor ? ownsActor(destinationActor, user) : false,
	});
}

function mayEditPartyCoins(user: TransferUser): boolean {
	return user.isGM || isTrustedPlayer(user) || ownsACharacter(user);
}

async function applyCurrency(userId: string, coin: string, value: number): Promise<void> {
	const user = userById(userId);
	if (!user || !isCoinDenomination(coin) || !mayEditPartyCoins(user)) return;
	const number = Math.floor(Number(value));
	const inventory = readPartyInventory();
	inventory.currency[coin] = Number.isFinite(number) && number > 0 ? number : 0;
	await writePartyInventory(inventory);
}

function coinBag(source: Record<string, number> | PartyCurrency | undefined): PartyCurrency {
	return {
		gp: Math.max(0, Math.floor(Number(source?.gp ?? 0)) || 0),
		sp: Math.max(0, Math.floor(Number(source?.sp ?? 0)) || 0),
		cp: Math.max(0, Math.floor(Number(source?.cp ?? 0)) || 0),
	};
}

function actorCoins(actor: HeldActor): PartyCurrency {
	return coinBag(actor.system?.currency);
}

async function writeActorCoins(actor: HeldActor, coins: PartyCurrency): Promise<void> {
	await actor.update?.({
		'system.currency.gp': coins.gp,
		'system.currency.sp': coins.sp,
		'system.currency.cp': coins.cp,
	});
}

function listedUsers(): TransferUser[] {
	const collection = game.users as Iterable<TransferUser> | undefined;
	const listed =
		collection && typeof collection[Symbol.iterator] === 'function'
			? [...collection].filter((user) => user && typeof user === 'object' && 'isGM' in user)
			: [];
	if (listed.length) return listed;
	const ids = [game.user?.id, (game.users as { activeGM?: { id?: string | null } })?.activeGM?.id];
	const found: TransferUser[] = [];
	for (const id of ids) {
		if (!id || found.some((user) => user.id === id)) continue;
		const user = userById(id);
		if (user) found.push(user);
	}
	return found;
}

function userIsActive(user: TransferUser): boolean {
	if (user.active === true) return true;
	if (user.active === false) return false;
	if (user.id && user.id === game.user?.id) return true;
	const gm = (game.users as { activeGM?: { id?: string | null } | null } | undefined)?.activeGM;
	return Boolean(user.id && gm?.id === user.id);
}

function moveActors(request: {
	source: TransferSource;
	sourceActorId: string;
	destination: TransferDestination;
}): {
	sourceActor: HeldActor | null;
	destinationActor: HeldActor | null;
} {
	return {
		sourceActor: request.source === 'actor' ? actorById(request.sourceActorId) : null,
		destinationActor:
			request.destination.kind === 'actor' && request.destination.actorId
				? actorById(request.destination.actorId)
				: null,
	};
}

function touchesInventory(request: {
	source: TransferSource;
	destination: TransferDestination;
}): boolean {
	return request.source === 'party' || request.destination.kind === 'party';
}

function userCanWriteMove(
	user: TransferUser,
	request: { source: TransferSource; sourceActorId: string; destination: TransferDestination },
): boolean {
	const { sourceActor, destinationActor } = moveActors(request);
	if (request.source === 'actor' && (!sourceActor || !ownsActor(sourceActor, user))) return false;
	if (
		request.destination.kind === 'actor' &&
		(!destinationActor || !ownsActor(destinationActor, user))
	) {
		return false;
	}
	if (touchesInventory(request) && !canWritePartyInventory(user)) return false;
	return true;
}

function activeGmOnline(): boolean {
	const users = game.users as unknown as { activeGM?: { id?: string | null } | null };
	return Boolean(users?.activeGM?.id) || Boolean(game.user?.isGM);
}

function warnInventory(message: string): void {
	ui.notifications?.warn(message);
}

async function applyGiveCurrency(userId: string, request: CurrencyTransferRequest): Promise<void> {
	const user = userById(userId);
	if (!user) return;
	const { sourceActor, destinationActor } = moveActors(request);
	if (request.source === 'actor' && !sourceActor) return;
	if (request.destination.kind === 'actor' && !destinationActor) return;
	if (sourceActor && destinationActor && sourceActor.id === destinationActor.id) return;
	if (!senderMayMove(user, request, sourceActor, destinationActor)) return;

	const sourceCoins = sourceActor ? actorCoins(sourceActor) : readPartyInventory().currency;
	const spent: PartyCurrency = {
		gp: Math.min(sourceCoins.gp, Math.max(0, Math.floor(Number(request.gp)) || 0)),
		sp: Math.min(sourceCoins.sp, Math.max(0, Math.floor(Number(request.sp)) || 0)),
		cp: Math.min(sourceCoins.cp, Math.max(0, Math.floor(Number(request.cp)) || 0)),
	};
	if (spent.gp + spent.sp + spent.cp <= 0) return;

	const nextSource: PartyCurrency = {
		gp: sourceCoins.gp - spent.gp,
		sp: sourceCoins.sp - spent.sp,
		cp: sourceCoins.cp - spent.cp,
	};
	const destinationCoins = destinationActor
		? actorCoins(destinationActor)
		: readPartyInventory().currency;
	const nextDestination: PartyCurrency = {
		gp: destinationCoins.gp + spent.gp,
		sp: destinationCoins.sp + spent.sp,
		cp: destinationCoins.cp + spent.cp,
	};

	if (destinationActor) await writeActorCoins(destinationActor, nextDestination);
	else {
		const inventory = readPartyInventory();
		inventory.currency = nextDestination;
		await writePartyInventory(inventory);
	}
	if (sourceActor) await writeActorCoins(sourceActor, nextSource);
	else {
		const inventory = readPartyInventory();
		inventory.currency = nextSource;
		await writePartyInventory(inventory);
	}

	const destinationName =
		request.destination.kind === 'party'
			? localize('NIMBLE.actorSheet.hero.inventory.partyName')
			: (destinationActor?.name ?? '');
	await postTransferChat(user, coinTransferChatKey(touchesInventory(request)), {
		amount: formatCoinAmount(spent),
		destination: destinationName,
	});
}

/** Spends the coins on the sender's character. The destination adds them when it receives the message. */
async function handCoinsToOwner(
	message: PartyInventoryCoinsMessage,
	sourceActor: HeldActor,
	destinationActor: HeldActor,
): Promise<boolean> {
	const ownerOnline = listedUsers().some(
		(user) => userIsActive(user) && ownsActor(destinationActor, user),
	);
	if (!ownerOnline) {
		warnInventory(
			localize('NIMBLE.actorSheet.hero.inventory.needsOnline', {
				name: destinationActor.name ?? '',
			}),
		);
		return false;
	}
	if (!getSocket()?.emit) return false;
	const taken: { spent: PartyCurrency | null } = { spent: null };
	await enqueue(async () => {
		const sourceCoins = actorCoins(sourceActor);
		const spent: PartyCurrency = {
			gp: Math.min(sourceCoins.gp, Math.max(0, Math.floor(Number(message.gp)) || 0)),
			sp: Math.min(sourceCoins.sp, Math.max(0, Math.floor(Number(message.sp)) || 0)),
			cp: Math.min(sourceCoins.cp, Math.max(0, Math.floor(Number(message.cp)) || 0)),
		};
		if (spent.gp + spent.sp + spent.cp <= 0) return;
		await writeActorCoins(sourceActor, {
			gp: sourceCoins.gp - spent.gp,
			sp: sourceCoins.sp - spent.sp,
			cp: sourceCoins.cp - spent.cp,
		});
		taken.spent = spent;
	});
	if (!taken.spent) return false;
	getSocket()?.emit?.(SOCKET_NAME, {
		...message,
		op: 'receiveCurrency',
		gp: taken.spent.gp,
		sp: taken.spent.sp,
		cp: taken.spent.cp,
	} satisfies PartyInventoryReceiveCurrencyMessage);
	return true;
}

async function applyReceiveCurrency(message: PartyInventoryReceiveCurrencyMessage): Promise<void> {
	const sender = userById(message.userId);
	const me = game.user as TransferUser | null | undefined;
	const { sourceActor, destinationActor } = moveActors(message);
	if (!sender || !me || !sourceActor || !destinationActor) return;
	if (!ownsActor(destinationActor, me)) return;
	if (!senderMayMove(sender, message, sourceActor, destinationActor)) return;
	const spent = coinBag(message);
	if (spent.gp + spent.sp + spent.cp <= 0) return;
	const next = actorCoins(destinationActor);
	await writeActorCoins(destinationActor, {
		gp: next.gp + spent.gp,
		sp: next.sp + spent.sp,
		cp: next.cp + spent.cp,
	});
	await postTransferChat(sender, coinTransferChatKey(false), {
		amount: formatCoinAmount(spent),
		destination: destinationActor.name ?? '',
	});
}

async function applyReceive(message: PartyInventoryReceiveMessage): Promise<void> {
	const sender = userById(message.userId);
	const destinationActor =
		message.destination.kind === 'actor' && message.destination.actorId
			? actorById(message.destination.actorId)
			: null;
	const sourceActor = message.source === 'actor' ? actorById(message.sourceActorId) : null;
	if (!sender || !destinationActor || !sourceActor) return;
	if (!senderMayMove(sender, message, sourceActor, destinationActor)) return;
	const me = game.user as TransferUser | null | undefined;
	if (!me || !ownsActor(destinationActor, me)) return;

	const plan = planItemTransfer(
		itemsOf(sourceActor),
		itemsOf(destinationActor),
		{ itemId: message.itemId, quantity: Number(message.quantity) },
		newItemId,
	);
	if (!plan) return;
	const landed = await applyPlanToActor(destinationActor, plan, 'destination');
	if (!landed) return;
	await postTransferChat(sender, itemTransferChatKey(false, plan.moved), {
		item: plan.name,
		destination: destinationActor.name ?? '',
		count: String(plan.moved),
	});
	getSocket()?.emit?.(SOCKET_NAME, {
		type: REQUEST_TYPE,
		op: 'release',
		userId: message.userId,
		sourceActorId: message.sourceActorId,
		removeIds: plan.removeIds,
		sourceQuantity: plan.sourceQuantity,
	} satisfies PartyInventoryReleaseMessage);
}

async function applyRelease(message: PartyInventoryReleaseMessage): Promise<void> {
	const me = game.user as TransferUser | null | undefined;
	if (!me || me.id !== message.userId) return;
	const sourceActor = actorById(message.sourceActorId);
	if (!sourceActor || !ownsActor(sourceActor, me)) return;
	if (message.sourceQuantity) {
		const item = sourceActor.items.get(message.sourceQuantity.id);
		await item?.update({ 'system.quantity': message.sourceQuantity.quantity });
	}
	if (message.removeIds.length)
		await sourceActor.deleteEmbeddedDocuments('Item', message.removeIds);
}

function shouldApplyRelayedMove(message: {
	source: TransferSource;
	sourceActorId: string;
	destination: TransferDestination;
}): boolean {
	const me = game.user as TransferUser | null | undefined;
	if (!me || !userCanWriteMove(me, message)) return false;
	if (me.isGM) return isActiveGM();
	return !activeGmOnline();
}

async function send(message: PartyMessage): Promise<boolean> {
	const me = game.user as TransferUser | null | undefined;
	if (!me?.id) return false;

	if (message.op === 'move' || message.op === 'giveCurrency') {
		const { sourceActor, destinationActor } = moveActors(message);
		if (!senderMayMove(me, message, sourceActor, destinationActor)) return false;
		if (userCanWriteMove(me, message)) {
			await enqueue(async () => {
				if (message.op === 'move') await applyMove(message.userId, message);
				else await applyGiveCurrency(message.userId, message);
			});
			return true;
		}
		const someoneCan = listedUsers().some(
			(user) => userIsActive(user) && userCanWriteMove(user, message),
		);
		if (someoneCan && getSocket()?.emit) {
			getSocket()?.emit?.(SOCKET_NAME, message);
			return true;
		}
		if (
			message.op === 'giveCurrency' &&
			message.source === 'actor' &&
			message.destination.kind === 'actor' &&
			sourceActor &&
			destinationActor &&
			ownsActor(sourceActor, me)
		) {
			return handCoinsToOwner(message, sourceActor, destinationActor);
		}
		if (
			message.op === 'move' &&
			message.source === 'actor' &&
			message.destination.kind === 'actor' &&
			destinationActor
		) {
			const ownerOnline = listedUsers().some(
				(user) => userIsActive(user) && ownsActor(destinationActor, user),
			);
			if (ownerOnline && getSocket()?.emit) {
				getSocket()?.emit?.(SOCKET_NAME, { ...message, op: 'receive' });
				return true;
			}
			warnInventory(
				localize('NIMBLE.actorSheet.hero.inventory.needsOnline', {
					name: destinationActor.name ?? '',
				}),
			);
			return false;
		}
		warnInventory(localize('NIMBLE.actorSheet.hero.inventory.partyNotReady'));
		return false;
	}

	if (message.op === 'currency') {
		if (!mayEditPartyCoins(me)) return false;
		if (canWritePartyInventory(me)) {
			await enqueue(() => applyCurrency(message.userId, message.coin, message.value));
			return true;
		}
		if (activeGmOnline() && getSocket()?.emit) {
			getSocket()?.emit?.(SOCKET_NAME, message);
			return true;
		}
		warnInventory(localize('NIMBLE.actorSheet.hero.inventory.partyNotReady'));
		return false;
	}

	return false;
}

/** Moves an object. The sender writes it when they can. Otherwise a connected owner does. */
export async function requestItemTransfer(request: ItemTransferRequest): Promise<boolean> {
	if (!game.user?.id) return false;
	return send({ type: REQUEST_TYPE, op: 'move', userId: game.user.id, ...request });
}

/** Moves coins from the open list to a character or the party inventory. */
export async function requestCurrencyTransfer(request: CurrencyTransferRequest): Promise<boolean> {
	if (!game.user?.id) return false;
	return send({ type: REQUEST_TYPE, op: 'giveCurrency', userId: game.user.id, ...request });
}

/** Sets one denomination of the party's coins. */
export async function requestPartyCurrency(coin: string, value: number): Promise<boolean> {
	if (!game.user?.id) return false;
	return send({ type: REQUEST_TYPE, op: 'currency', userId: game.user.id, coin, value });
}

let listening = false;

/** Listens for party-inventory moves. Safe to call once from `ready`. */
export function registerPartyInventorySocketListener(): void {
	if (listening) return;
	listening = true;
	getSocket()?.on?.(SOCKET_NAME, (payload) => {
		if (!payload || typeof payload !== 'object') return;
		const message = payload as PartyMessage;
		if (message.type !== REQUEST_TYPE || !message.userId || !message.op) return;
		if (message.op === 'move' || message.op === 'giveCurrency') {
			if (!shouldApplyRelayedMove(message)) return;
			void enqueue(async () => {
				if (message.op === 'move') await applyMove(message.userId, message);
				else await applyGiveCurrency(message.userId, message);
			});
			return;
		}
		if (message.op === 'receive') {
			void enqueue(() => applyReceive(message));
			return;
		}
		if (message.op === 'receiveCurrency') {
			void enqueue(() => applyReceiveCurrency(message));
			return;
		}
		if (message.op === 'release') {
			void enqueue(() => applyRelease(message));
			return;
		}
		if (message.op !== 'currency') return;
		const me = game.user as TransferUser | null | undefined;
		if (!me || !canWritePartyInventory(me) || (me.isGM && !isActiveGM())) return;
		const coins = message;
		void enqueue(() => applyCurrency(coins.userId, coins.coin, coins.value));
	});
}
