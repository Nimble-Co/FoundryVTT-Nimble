<script>
	import DamageRoll from './DamageRoll.svelte';

	let { node } = $props();
	let { damageType, ignoreArmor, roll } = node;
</script>

<DamageRoll {damageType} {ignoreArmor} outcome="fullDamage" {roll} />
