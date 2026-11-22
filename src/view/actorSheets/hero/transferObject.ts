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

async function askQuantity(name: string, have: number): Promise<number | null> {
	const question = localize(`${INV}.howMany`, { name: escapeHtml(name) });
	const chosen = (await foundry.applications.api.DialogV2.wait({
		window: { title: localize(`${INV}.howManyTitle`) },
		content: quantityDialogContent(question, have),
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

async function confirmUnequip(name: string): Promise<boolean> {
	return Boolean(
		await foundry.applications.api.DialogV2.confirm({
			window: { title: localize(`${INV}.unequipToGiveTitle`) },
			content: `<p>${localize(`${INV}.unequipToGive`, { name: escapeHtml(name) })}</p>`,
			rejectClose: false,
			modal: true,
		}),
	);
}

/** Asks how many, and whether to unequip, then moves the object. */
export async function transferObject(
	actor: NimbleCharacter,
	intent: TransferIntent,
): Promise<void> {
	const held = heldOf(actor, intent);
	if (!held) return;
	const have = quantityOf(held.system);
	const container = isContainer(held.system);
	const quantity = !container && have > 1 ? await askQuantity(held.name, have) : have;
	if (quantity === null) return;
	const leavesEquipped = held.system.equipped === true && quantity >= have;
	if (leavesEquipped && !(await confirmUnequip(held.name))) return;
	await requestItemTransfer({
		source: intent.source,
		sourceActorId: intent.sourceActorId,
		itemId: intent.itemId,
		quantity,
		destination: intent.destination,
	});
}
