<script>
	import { getContext } from 'svelte';
	import DamageRoll from './DamageRoll.svelte';

	let { node } = $props();
	let { damageType, ignoreArmor, roll } = node;

	const messageDocument = getContext('messageDocument');
	let outcome = $derived(messageDocument?.system?.isMiss ? 'noDamage' : 'fullDamage');
</script>

<DamageRoll {damageType} {ignoreArmor} {outcome} {roll} />
