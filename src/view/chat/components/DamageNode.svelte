<script>
	import { getContext } from 'svelte';
	import DamageRoll from './DamageRoll.svelte';

	let { node } = $props();
	let damageType = $derived(node.damageType);
	let ignoreArmor = $derived(node.ignoreArmor);
	let roll = $derived(node.roll);

	const messageDocument = getContext('messageDocument');
	let outcome = $derived(messageDocument?.system?.isMiss ? 'noDamage' : 'fullDamage');
</script>

<DamageRoll {damageType} {ignoreArmor} {outcome} {roll} />
