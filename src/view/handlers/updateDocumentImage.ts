declare const Tokenizer: { tokenizeActor?(actor: Actor): void } | undefined;

export default async function updateDocumentImage(
	document: Actor | Item,
	options = { shiftKey: false },
) {
	// Add support for tokenizer
	if (game.modules.get('vtta-tokenizer')?.active && !options.shiftKey) {
		if (['character', 'soloMonster'].includes(document.type)) {
			Tokenizer?.tokenizeActor?.(document as Actor);
			return null;
		}
	}

	const filePicker = new FilePicker({
		type: 'image',
		current: document.img ?? undefined,
		callback: async (path) => {
			await document.update({ img: path });
		},
	});

	return filePicker.browse();
}
