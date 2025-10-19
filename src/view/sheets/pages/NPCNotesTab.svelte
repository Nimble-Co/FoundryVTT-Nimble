<script>
import { getContext } from 'svelte';

import Editor from '../components/Editor.svelte';

let actor = getContext('actor');
</script>

<section class="nimble-sheet__body nimble-sheet__body--notes">
    <header class="nimble-sheet-section-header">
        <h3 class="nimble-heading" data-heading-variant="section">
            Notes
        </h3>
    </header>

    {#key actor.reactive.system.description}
        <Editor
            field="system.description"
            content={actor.reactive.system.description}
            document={actor}
        />
    {/key}
</section>

<style lang="scss">
    :global(.nimble-sheet__body--notes) {
        height: 100% !important;
        display: block !important;
        overflow: visible !important;
    }

    .nimble-sheet-section-header {
        display: flex;
        align-items: center;
        gap: 1ch;
        margin-block-end: 0.375rem;
        width: 100%;
    }

    :global(.nimble-sheet__body--notes prose-mirror) {
        height: 100% !important;
    }

    :global(.nimble-sheet__body--notes .editor-content) {
        height: 100% !important;
        overflow-y: auto !important;
		padding-bottom: 15px !important;
    }
</style>
