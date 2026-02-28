<script>
	import { getContext } from 'svelte';
	import ActorConditionsList from '../../components/ActorConditionsList.svelte';

	let actor = getContext('actor');
</script>

<section class="nimble-sheet__body">
	<ActorConditionsList {actor} mode="sheet" allowRemove={true} />
</section>
