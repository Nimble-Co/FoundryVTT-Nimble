<script lang="ts">
	import type { NimbleChatMessage } from '#documents/chatMessage.ts';
	import type { TextNode } from '#types/effectTree.js';
	import type { MovementContext } from '#utils/movement/movementContext.js';

	import { getContext } from 'svelte';
	import Hint from '../../components/Hint.svelte';
	import { resolveMovementPlaceholders } from '../../dataPreparationHelpers/resolveMovementPlaceholders.js';

	function getNodeIcon(noteType: TextNode['noteType']) {
		switch (noteType) {
			case 'flavor':
				return 'fa-solid fa-comment';
			case 'reminder':
				return 'fa-solid fa-bell';
			case 'warning':
				return 'fa-solid fa-circle-exclamation';
			default:
				return '';
		}
	}

	let { node }: { node: TextNode } = $props();

	const messageDocument = getContext<NimbleChatMessage | undefined>('messageDocument');

	const movementContext = $derived(
		(messageDocument?.reactive?.system as { movementContext?: MovementContext } | undefined)
			?.movementContext,
	);
	const text = $derived(resolveMovementPlaceholders(node.text, movementContext));
</script>

<Hint hintIcon={getNodeIcon(node.noteType)} hintText={text} hintType={node.noteType} />
