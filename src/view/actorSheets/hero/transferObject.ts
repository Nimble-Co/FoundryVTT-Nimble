import type { NimbleCharacter } from '#documents/actor/character.js';
import localize from '#utils/localize.ts';
import { requestItemTransfer } from '#utils/partyStash/requestItemTransfer.ts';
import { readPartyStash } from '../../../settings/partyStashSetting.ts';
import type { HeroIntent } from './heroIntent.ts';

const INV = 'NIMBLE.actorSheet.hero.inventory';

type TransferIntent = Extract<HeroIntent, { kind: 'transferObject' }>;

function escapeHtml(value: string): string {
	return value
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;');
}

function quantityOf(system: Record<string, unknown>): number {
	const value = Math.floor(Number(system.quantity ?? 1));
	return Number.isFinite(value) && value > 0 ? value : 1;
}

function isContainer(system: Record<string, unknown>): boolean {
	const container = system.container as { enabled?: boolean } | undefined;
	return container?.enabled === true;
}

function heldOf(
	actor: NimbleCharacter,
	intent: TransferIntent,
): { name: string; system: Record<string, unknown> } | null {
	if (intent.source === 'actor') {
		const item = actor.items.get(intent.itemId);
		if (!item || item.type !== 'object') return null;
		return { name: item.name, system: item.system as unknown as Record<string, unknown> };
	}
	const stored = readPartyStash().items.find((item) => item._id === intent.itemId);
	if (!stored) return null;
	return {
		name: typeof stored.name === 'string' ? stored.name : '',
		system: stored.system ?? {},
	};
}

function clampQuantity(raw: string, have: number): number {
	const value = Math.floor(Number(raw));
	if (!Number.isFinite(value)) return 1;
	return Math.min(have, Math.max(1, value));
}

/** The number and the slider show the same amount. Dragging jumps, typing sets the slider. */
function bindQuantitySlider(root: ParentNode, have: number): void {
	const amount = root.querySelector<HTMLInputElement>('input[name="quantity"]');
	const slider = root.querySelector<HTMLInputElement>('input[data-quantity-slider]');
	if (!amount || !slider) return;
	slider.addEventListener('input', () => {
		amount.value = String(clampQuantity(slider.value, have));
	});
	amount.addEventListener('input', () => {
		const value = Math.floor(Number(amount.value));
		if (!Number.isFinite(value)) return;
		slider.value = String(Math.min(have, Math.max(1, value)));
	});
	amount.addEventListener('change', () => {
		const next = clampQuantity(amount.value, have);
		amount.value = String(next);
		slider.value = String(next);
	});
}

function quantityDialogContent(question: string, have: number): string {
	return `<div class="nimble-how-many" style="display:flex;flex-direction:column;gap:10px;min-width:16rem">
		<label id="nimble-how-many-label" for="nimble-how-many-amount">${question}</label>
		<input type="range" data-quantity-slider min="1" max="${have}" step="1" value="${have}" aria-labelledby="nimble-how-many-label" style="width:100%">
		<input id="nimble-how-many-amount" type="number" name="quantity" min="1" max="${have}" step="1" value="${have}" style="width:6rem">
	</div>`;
}

async function askQuantity(
	name: string,
	have: number,
	equippedNote: string | null,
): Promise<number | null> {
	const question = localize(`${INV}.howMany`, { name: escapeHtml(name) });
	const note = equippedNote ? `<p>${equippedNote}</p>` : '';
	const chosen = (await foundry.applications.api.DialogV2.wait({
		window: {
			title: equippedNote
				? localize(`${INV}.unequipToGiveTitle`, { name })
				: localize(`${INV}.howManyTitle`),
		},
		content: `${note}${quantityDialogContent(question, have)}`,
		buttons: [
			{
				action: 'move',
				label: localize(`${INV}.howManyConfirm`),
				default: true,
				callback: (_event: Event, button: HTMLButtonElement) => {
					const field = button.form?.elements.namedItem('quantity') as { value?: string } | null;
					return Number(field?.value);
				},
			},
		],
		render: (_event: Event, dialog: { element: ParentNode }) => {
			bindQuantitySlider(dialog.element, have);
		},
		rejectClose: false,
		modal: true,
	} as never)) as unknown;
	const quantity = Math.floor(Number(chosen));
	if (!Number.isFinite(quantity) || quantity < 1 || quantity > have) return null;
	return quantity;
}

function actorName(actorId: string): string {
	const actors = game.actors as
		| { get?: (id: string) => { name?: string | null } | null }
		| undefined;
	const name = actors?.get?.(actorId)?.name;
	return typeof name === 'string' ? name : '';
}

function destinationPhrase(
	actor: NimbleCharacter,
	destination: TransferIntent['destination'],
): string {
	if (destination.kind === 'stash') return localize(`${INV}.partyName`);
	const name =
		actorName(destination.actorId) ||
		(destination.actorId === actor.id ? actor.name : '') ||
		destination.actorId;
	return localize(`${INV}.namedInventory`, { name: escapeHtml(name) });
}

async function confirmText(title: string, body: string): Promise<boolean> {
	return Boolean(
		await foundry.applications.api.DialogV2.confirm({
			window: { title },
			content: `<p>${body}</p>`,
			rejectClose: false,
			modal: true,
		}),
	);
}

/** One confirmation. A stack counts in that dialog. An equipped object says it will be unequipped there too. */
export async function transferObject(
	actor: NimbleCharacter,
	intent: TransferIntent,
): Promise<void> {
	const held = heldOf(actor, intent);
	if (!held) return;
	const have = quantityOf(held.system);
	const container = isContainer(held.system);
	const equipped = held.system.equipped === true;
	const destination = destinationPhrase(actor, intent.destination);
	const equippedNote = equipped
		? localize(`${INV}.unequipToGive`, { name: escapeHtml(held.name), destination })
		: null;
	let quantity: number | null = have;
	if (!container && have > 1) {
		quantity = await askQuantity(held.name, have, equippedNote);
	} else if (equippedNote) {
		const accepted = await confirmText(
			localize(`${INV}.unequipToGiveTitle`, { name: held.name }),
			equippedNote,
		);
		quantity = accepted ? have : null;
	} else {
		const accepted = await confirmText(
			localize(`${INV}.moveConfirmTitle`, { name: held.name }),
			localize(`${INV}.moveConfirm`, { name: escapeHtml(held.name), destination }),
		);
		quantity = accepted ? have : null;
	}
	if (quantity === null) return;
	await requestItemTransfer({
		source: intent.source,
		sourceActorId: intent.sourceActorId,
		itemId: intent.itemId,
		quantity,
		destination: intent.destination,
	});
}
