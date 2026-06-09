<script lang="ts">
	import { getContext } from 'svelte';
	import type { NimbleChatMessage } from '../../../documents/chatMessage.js';
	import DamageRoll from './DamageRoll.svelte';

	let { node } = $props();
	let damageType = $derived(node.damageType);
	let ignoreArmor = $derived(node.ignoreArmor);
	let roll = $derived(node.roll);
	let targetDisposition = $derived(node.targetDisposition);

	const messageDocument = getContext('messageDocument') as NimbleChatMessage;
	let outcome = $derived(
		(messageDocument?.system as { isMiss?: boolean })?.isMiss ? 'noDamage' : 'fullDamage',
	);
</script>

<DamageRoll {damageType} {ignoreArmor} {outcome} {roll} {targetDisposition} />
