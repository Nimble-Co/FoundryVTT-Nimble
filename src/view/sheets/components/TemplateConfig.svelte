<script>
    import { getContext } from "svelte";
    import TagGroup from "../../components/TagGroup.svelte";

    function getTemplateShapeOptions() {
        return Object.entries(templateShapes).map(([key, label]) => ({
            label,
            value: key,
        }));
    }

    const { templateShapes } = CONFIG.NIMBLE;
    const templateShapeOptions = getTemplateShapeOptions();

    let { activationData, toggleTemplateShapeOption } = $props();

    let document = getContext("document");
    let templateShape = $derived(activationData.template.shape);
    let templateLength = $derived(activationData.template.length);
    let templateRadius = $derived(activationData.template.radius);
    let templateWidth = $derived(activationData.template.width);
</script>

{#snippet templateSizeField(label, value, updatePath)}
    <label class="nimble-field" data-field-variant="stacked">
        <span class="nimble-heading" data-heading-variant="field">
            {label}
        </span>

        <input
            type="number"
            {value}
            onchange={({ target }) =>
                document.update({
                    [updatePath]: target.value,
                })}
        />
    </label>
{/snippet}

<section>
    <header class="nimble-section-header" style="margin-block-start: 0.5rem;">
        <h3
            class="nimble-heading nimble-field__label"
            data-heading-variant="field"
        >
            Template Shape
        </h3>
    </header>

    <TagGroup
        options={templateShapeOptions}
        selectedOptions={[templateShape]}
        toggleOption={toggleTemplateShapeOption}
    />
</section>

<section>
    <div style="display: flex; gap: 0.5rem; margin-top: 0.625rem;">
        {#if templateShape === "cone" || templateShape === "line"}
            {@render templateSizeField(
                "Length (spaces)",
                templateLength,
                "system.activation.template.length",
            )}
        {/if}

        {#if templateShape === "circle" || templateShape === "emanation"}
            {@render templateSizeField(
                "Radius (spaces)",
                templateRadius,
                "system.activation.template.radius",
            )}
        {/if}

        {#if templateShape === "line" || templateShape === "square"}
            {@render templateSizeField(
                "Width (spaces)",
                templateWidth,
                "system.activation.template.width",
            )}
        {/if}
    </div>
</section>

<style>
    input[type="number"] {
        width: 14ch;
        text-align: center;
    }
</style>
