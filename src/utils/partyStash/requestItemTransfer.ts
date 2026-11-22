import { SYSTEM_ID } from '#system';
import { isActiveGM } from '#utils/isActiveGM.ts';
import localize from '#utils/localize.ts';
import {
	type PartyStash,
	partyCoin,
	readPartyStash,
	writePartyStash,
} from '../../settings/partyStashSetting.ts';
import {
	type ItemTransferPlan,
	mayTransferItem,
	planItemTransfer,
	type TransferItem,
} from './planItemTransfer.ts';

const SOCKET_NAME = `system.${SYSTEM_ID}`;
const REQUEST_TYPE = 'partyStash';

export type TransferSource = 'actor' | 'stash';

export interface TransferDestination {
	kind: 'actor' | 'stash';
	actorId?: string;
}

export interface ItemTransferRequest {
	source: TransferSource;
	sourceActorId: string;
	itemId: string;
	quantity: number;
	destination: TransferDestination;
}

interface PartyStashMoveMessage extends ItemTransferRequest {
	type: typeof REQUEST_TYPE;
	op: 'move';
	userId: string;
}

interface PartyStashCoinMessage {
	type: typeof REQUEST_TYPE;
	op: 'currency';
	userId: string;
	coin: string;
	value: number;
}

interface HeldItem {
	toObject(): TransferItem;
	update(data: Record<string, unknown>): Promise<unknown>;
}

interface HeldActor {
	id?: string | null;
	name?: string | null;
	type?: string;
	items: Iterable<HeldItem> & { get(id: string): HeldItem | undefined };
	testUserPermission?(user: unknown, permission: unknown): boolean;
	createEmbeddedDocuments(
		name: string,
		data: object[],
		options?: { keepId?: boolean },
	): Promise<unknown>;
	deleteEmbeddedDocuments(name: string, ids: string[]): Promise<unknown>;
}

interface StashUser {
	id?: string;
	name?: string | null;
	isGM: boolean;
}

function getSocket():
	| {
			on?: (eventName: string, listener: (payload: unknown) => void) => void;
			emit?: (eventName: string, payload: unknown) => void;
	  }
	| undefined {
	return game.socket as ReturnType<typeof getSocket>;
}

function userById(userId: string): StashUser | null {
	const users = game.users as unknown as { get?: (id: string) => StashUser | null };
	return users.get?.(userId) ?? null;
}

function actorById(actorId: string): HeldActor | null {
	const actors = game.actors as unknown as { get?: (id: string) => HeldActor | null };
	return actors.get?.(actorId) ?? null;
}

function ownsActor(actor: HeldActor, user: StashUser): boolean {
	if (user.isGM) return true;
	const level = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3;
	return Boolean(actor.testUserPermission?.(user, level));
}

function ownsACharacter(user: StashUser): boolean {
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

async function createOnActor(actor: HeldActor, items: TransferItem[]): Promise<void> {
	const containers = items.filter((item) => {
		const container = item.system?.container as { enabled?: boolean } | undefined;
		return container?.enabled === true;
	});
	const rest = items.filter((item) => !containers.includes(item));
	if (containers.length) {
		await actor.createEmbeddedDocuments('Item', containers, { keepId: true });
	}
	if (rest.length) {
		await actor.createEmbeddedDocuments('Item', rest, { keepId: true });
	}
}

async function applyPlanToActor(
	actor: HeldActor,
	plan: ItemTransferPlan,
	side: 'source' | 'destination',
) {
	if (side === 'destination') {
		if (plan.merge) {
			const item = actor.items.get(plan.merge.id);
			if (!item) return;
			const current = Math.floor(Number(item.toObject().system?.quantity ?? 1));
			const quantity = (Number.isFinite(current) && current > 0 ? current : 1) + plan.merge.add;
			await item.update({ 'system.quantity': quantity });
		}
		if (plan.add.length) await createOnActor(actor, plan.add);
		return;
	}

	if (plan.sourceQuantity) {
		const item = actor.items.get(plan.sourceQuantity.id);
		await item?.update({ 'system.quantity': plan.sourceQuantity.quantity });
	}
	if (plan.removeIds.length) await actor.deleteEmbeddedDocuments('Item', plan.removeIds);
}

function applyPlanToStash(
	stash: PartyStash,
	plan: ItemTransferPlan,
	side: 'source' | 'destination',
): void {
	if (side === 'source') {
		const remove = new Set(plan.removeIds);
		stash.items = stash.items.flatMap((item) => {
			if (remove.has(item._id)) return [];
			if (plan.sourceQuantity && item._id === plan.sourceQuantity.id) {
				return [{ ...item, system: { ...item.system, quantity: plan.sourceQuantity.quantity } }];
			}
			return [item];
		});
		return;
	}

	if (plan.merge) {
		stash.items = stash.items.map((item) => {
			if (item._id !== plan.merge?.id) return item;
			const current = Math.floor(Number(item.system?.quantity ?? 1));
			const quantity = (Number.isFinite(current) && current > 0 ? current : 1) + plan.merge.add;
			return { ...item, system: { ...item.system, quantity } };
		});
	}
	stash.items = [...stash.items, ...plan.add];
}

async function postChat(
	user: StashUser,
	plan: ItemTransferPlan,
	destination: string,
): Promise<void> {
	const key =
		plan.moved === 1
			? 'NIMBLE.actorSheet.hero.inventory.gave'
			: 'NIMBLE.actorSheet.hero.inventory.gaveCount';
	const content = `<p>${localize(key, {
		user: escapeHtml(user.name || localize('NIMBLE.actorSheet.hero.inventory.someone')),
		item: escapeHtml(plan.name),
		destination: escapeHtml(destination),
		count: String(plan.moved),
	})}</p>`;
	await ChatMessage.create({
		user: user.id,
		speaker: { alias: user.name ?? '' },
		content,
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
	if (request.source === 'stash' && request.destination.kind === 'stash') return;
	if (request.source === 'actor' && destinationActor && sourceActor?.id === destinationActor.id) {
		return;
	}

	const allowed = mayTransferItem({
		isGM: user.isGM,
		source: request.source,
		ownsSource: sourceActor ? ownsActor(sourceActor, user) : false,
		ownsACharacter: ownsACharacter(user),
	});
	if (!allowed) return;

	const stash = readPartyStash();
	const sourceItems = sourceActor ? itemsOf(sourceActor) : stash.items;
	const destinationItems = destinationActor ? itemsOf(destinationActor) : stash.items;
	const plan = planItemTransfer(
		sourceItems,
		destinationItems,
		{ itemId: request.itemId, quantity: request.quantity },
		newItemId,
	);
	if (!plan) return;

	const stashTouched = request.source === 'stash' || request.destination.kind === 'stash';
	const nextStash: PartyStash = { currency: { ...stash.currency }, items: [...stash.items] };
	if (request.destination.kind === 'stash') applyPlanToStash(nextStash, plan, 'destination');
	if (destinationActor) await applyPlanToActor(destinationActor, plan, 'destination');
	if (request.source === 'stash') applyPlanToStash(nextStash, plan, 'source');
	if (sourceActor) await applyPlanToActor(sourceActor, plan, 'source');
	if (stashTouched) await writePartyStash(nextStash);

	const destinationName =
		request.destination.kind === 'stash'
			? localize('NIMBLE.actorSheet.hero.inventory.partyName')
			: (destinationActor?.name ?? '');
	await postChat(user, plan, destinationName);
}

async function applyCurrency(userId: string, coin: string, value: number): Promise<void> {
	const user = userById(userId);
	if (!user || !partyCoin(coin)) return;
	if (
		!mayTransferItem({
			isGM: user.isGM,
			source: 'stash',
			ownsSource: false,
			ownsACharacter: ownsACharacter(user),
		})
	) {
		return;
	}
	const number = Math.floor(Number(value));
	const stash = readPartyStash();
	stash.currency[coin] = Number.isFinite(number) && number > 0 ? number : 0;
	await writePartyStash(stash);
}

function activeGmOnline(): boolean {
	const users = game.users as unknown as { activeGM?: { id?: string | null } | null };
	return Boolean(users?.activeGM?.id) || Boolean(game.user?.isGM);
}

async function send(message: PartyStashMoveMessage | PartyStashCoinMessage): Promise<boolean> {
	if (isActiveGM()) {
		await enqueue(async () => {
			if (message.op === 'move') await applyMove(message.userId, message);
			else await applyCurrency(message.userId, message.coin, message.value);
		});
		return true;
	}
	if (!activeGmOnline()) {
		ui.notifications?.warn(localize('NIMBLE.actorSheet.hero.inventory.noGm'));
		return false;
	}
	const socket = getSocket();
	if (!socket?.emit || !game.user?.id) {
		ui.notifications?.warn(localize('NIMBLE.actorSheet.hero.inventory.noGm'));
		return false;
	}
	socket.emit(SOCKET_NAME, message);
	return true;
}

/** Moves an object. The active GM writes both sides, so the sender needs no permission on the destination. */
export async function requestItemTransfer(request: ItemTransferRequest): Promise<boolean> {
	if (!game.user?.id) return false;
	return send({ type: REQUEST_TYPE, op: 'move', userId: game.user.id, ...request });
}

/** Sets one denomination of the party's coins. */
export async function requestPartyCurrency(coin: string, value: number): Promise<boolean> {
	if (!game.user?.id) return false;
	return send({ type: REQUEST_TYPE, op: 'currency', userId: game.user.id, coin, value });
}

let listening = false;

/** GM-side listener for party-stash moves. Safe to call once from `ready`. */
export function registerPartyStashSocketListener(): void {
	if (listening) return;
	listening = true;
	getSocket()?.on?.(SOCKET_NAME, (payload) => {
		if (!isActiveGM()) return;
		if (!payload || typeof payload !== 'object') return;
		const message = payload as PartyStashMoveMessage | PartyStashCoinMessage;
		if (message.type !== REQUEST_TYPE || !message.userId || !message.op) return;
		if (message.op === 'move') {
			const move = message;
			void enqueue(async () => {
				await applyMove(move.userId, {
					source: move.source,
					sourceActorId: move.sourceActorId,
					itemId: move.itemId,
					quantity: Number(move.quantity),
					destination: move.destination,
				});
			});
			return;
		}
		if (message.op !== 'currency') return;
		const coins = message;
		void enqueue(async () => {
			await applyCurrency(coins.userId, coins.coin, Number(coins.value));
		});
	});
}
