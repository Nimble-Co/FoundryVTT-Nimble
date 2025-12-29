export default async function updateDocumentImage(document, options = { shiftKey: false }) {
	// Add support for tokenizer
	if (game.modules.get('vtta-tokenizer')?.active && !options.shiftKey) {
		if (['character', 'soloMonster', 'npc', 'minion'].includes(document.type)) {
			// eslint-disable-next-line no-undef
			Tokenizer?.tokenizeActor(document);
			return null;
		}
	}

	const filePicker = new FilePicker({
		type: 'image',
		current: document.img,
		callback: async (path) => {
			await document.update({ img: path });
		},
	});

	return filePicker.browse();
}
