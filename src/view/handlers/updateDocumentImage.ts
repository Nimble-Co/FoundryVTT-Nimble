declare const Tokenizer: { tokenizeActor?(actor: Actor): void } | undefined;

export default async function updateDocumentImage(
	document: Actor | Item,
	options = { shiftKey: false },
) {
	// Add support for tokenizer
	if (game.modules.get('vtta-tokenizer')?.active && !options.shiftKey) {
		if (['character', 'soloMonster', 'npc', 'minion'].includes(document.type)) {
			// eslint-disable-next-line no-undef
			Tokenizer?.tokenizeActor?.(document as Actor);
			return null;
		}
	}

	const filePickerImplementation =
		(
			foundry.applications as typeof foundry.applications & {
				apps?: {
					FilePicker?: {
						implementation?: new (options: {
							type: string;
							current?: string;
							callback: (path: string) => Promise<void>;
						}) => {
							browse: () => Promise<unknown>;
						};
					};
				};
			}
		).apps?.FilePicker?.implementation ??
		(
			globalThis as typeof globalThis & {
				FilePicker?: new (options: {
					type: string;
					current?: string;
					callback: (path: string) => Promise<void>;
				}) => {
					browse: () => Promise<unknown>;
				};
			}
		).FilePicker;

	if (!filePickerImplementation) {
		ui.notifications?.error('Unable to open the image picker.');
		return null;
	}

	const filePicker = new filePickerImplementation({
		type: 'image',
		current: document.img ?? undefined,
		callback: async (path) => {
			await document.update({ img: path });
		},
	});

	return filePicker.browse();
}
