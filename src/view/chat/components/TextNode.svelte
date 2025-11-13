<script>
	import Hint from '../../components/Hint.svelte';

	function getNodeIcon(noteType) {
		switch (noteType) {
			case 'flavor':
				return 'fa-solid fa-comment';
			case 'reminder':
				return 'fa-solid fa-bell';
			case 'warning':
				return 'fa-solid fa-circle-exclamation';
			default:
				return null;
		}
	}

	let { node } = $props();
</script>

<Hint hintIcon={getNodeIcon(node.noteType)} hintText={node.text} hintType={node.noteType} />
