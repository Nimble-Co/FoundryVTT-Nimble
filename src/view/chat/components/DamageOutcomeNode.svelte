<script>
	import DamageRoll from './DamageRoll.svelte';

	let { node } = $props();
	let damageType = $derived(node.damageType);
	let ignoreArmor = $derived(node.ignoreArmor);
	let outcome = $derived(node.outcome);
	let roll = $derived(node.roll);
</script>

<DamageRoll {damageType} {ignoreArmor} {outcome} {roll} />
