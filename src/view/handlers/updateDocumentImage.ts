declare const Tokenizer: { tokenizeActor?(actor: Actor): void } | undefined;

export type ImageType = 'actor' | 'token';

export interface UpdateDocumentImageOptions {
	shiftKey?: boolean;
	imageType?: ImageType;
}

export default async function updateDocumentImage(
	document: Actor | Item,
	options: UpdateDocumentImageOptions = {},
) {
	const { shiftKey = false, imageType = 'actor' } = options;

	// Add support for tokenizer
	if (game.modules.get('vtta-tokenizer')?.active && !shiftKey) {
		if (['character', 'soloMonster', 'npc', 'minion'].includes(document.type)) {
			// eslint-disable-next-line no-undef
			Tokenizer?.tokenizeActor?.(document as Actor);
			return null;
		}
	}

	// Determine current image and update path based on image type
	const isTokenImage = imageType === 'token' && 'prototypeToken' in document;
	const currentImage = isTokenImage
		? (document as Actor).prototypeToken?.texture?.src
		: document.img;

	const filePicker = new FilePicker({
		type: 'image',
		current: currentImage ?? undefined,
		callback: async (path) => {
			if (isTokenImage) {
				await document.update({ 'prototypeToken.texture.src': path } as Record<string, unknown>);
			} else {
				await document.update({ img: path });
			}
		},
	});

	return filePicker.browse();
}
