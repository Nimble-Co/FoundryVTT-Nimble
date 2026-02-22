<script lang="ts">
	import { getContext } from 'svelte';
	import type { NimbleCharacter } from '../../../documents/actor/character.js';
	import ActorConditionsList from '../../components/ActorConditionsList.svelte';

	let actor: NimbleCharacter = getContext('actor');
</script>

<section class="nimble-sheet__body nimble-sheet__body--player-character">
	<ActorConditionsList {actor} mode="sheet" allowRemove={true} />
</section>
