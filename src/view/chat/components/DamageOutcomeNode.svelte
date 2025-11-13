<script>
	import DamageRoll from './DamageRoll.svelte';

	let { node } = $props();
	let { damageType, ignoreArmor, outcome, roll } = node;
</script>

<DamageRoll {damageType} {ignoreArmor} {outcome} {roll} />
