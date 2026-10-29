import type { HeroRowProps } from '#types/components/actorSheets/HeroRow.d.ts';
import { dragDataOf, droppedItemData, mayDrag } from '../../shared/drag.ts';
import { askConfirm, closeConfirm, toggleChoice } from '../../shared/sheetUiState.ts';

/** The state and the handlers of one row: use, ask, drop and drag. Call it while the component starts. */
export function heroRowControls(props: () => HeroRowProps) {
	let pointerType: string | null = null;
	let dropOver = $state(false);

	const row = $derived(props().row);
	const ui = $derived(props().ui);
	const editing = $derived(ui.editing);
	const use = $derived(row.use);
	const stepOpen = $derived(!editing && !!row.choice && ui.choiceStep === row.id);
	const askId = $derived(`ask:${row.id}`);
	const removeId = $derived(`remove:${row.id}`);
	const asking = $derived.by(() => {
		if (!editing && use?.kind === 'ask' && ui.confirm === askId) return use.ask;
		if (editing && row.remove && ui.confirm === removeId) return row.remove;
		return null;
	});
	const perform = (intent: Parameters<HeroRowProps['perform']>[0]) => props().perform(intent);

	return {
		get editing() {
			return editing;
		},
		get stepOpen() {
			return stepOpen;
		},
		get asking() {
			return asking;
		},
		get dropOver() {
			return dropOver;
		},
		get hasFields() {
			return row.fields.length > 0 || !!row.storeIn || !!row.remove;
		},
		get useLabel() {
			return use?.kind === 'ask' ? use.ask.label : use?.label;
		},
		get useExpanded() {
			if (use?.kind === 'choose') return stepOpen;
			return use?.kind === 'ask' ? !!asking : undefined;
		},
		onuse() {
			if (!use) return;
			if (use.kind === 'act') void perform(use.intent);
			else if (use.kind === 'choose') toggleChoice(ui, row.id);
			else if (use.kind === 'ask') askConfirm(ui, askId);
		},
		askRemove() {
			askConfirm(ui, removeId);
		},
		confirm() {
			const intent = asking?.intent;
			closeConfirm(ui);
			if (intent) void perform(intent);
		},
		onpointerdown(event: PointerEvent) {
			pointerType = event.pointerType;
		},
		ondragenter() {
			if (row.dropInto && row.dropInto === row.id) dropOver = true;
		},
		// crossing onto a child of the row is not leaving it
		ondragleave(event: DragEvent) {
			const to = event.relatedTarget;
			if (to instanceof Node && (event.currentTarget as Node).contains(to)) return;
			dropOver = false;
		},
		ondragend() {
			dropOver = false;
		},
		ondrop(event: DragEvent) {
			dropOver = false;
			if (row.dropInto === undefined) return;
			const data = droppedItemData(event.dataTransfer);
			if (!data) return;
			event.preventDefault();
			event.stopPropagation();
			void perform({ kind: 'dropItem', data, containerId: row.dropInto });
		},
		ondragstart(event: DragEvent) {
			if (!row.drag || !mayDrag(pointerType, editing)) {
				event.preventDefault();
				return;
			}
			event.dataTransfer?.setData('text/plain', JSON.stringify(dragDataOf(row.drag)));
		},
	};
}
