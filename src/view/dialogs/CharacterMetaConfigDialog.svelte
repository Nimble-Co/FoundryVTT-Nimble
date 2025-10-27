<script>
  import TagGroup from "../components/TagGroup.svelte"

  const { sizeCategories } = CONFIG.NIMBLE

  let { actor } = $props()

  // Get current size and available sizes from ancestry
  let currentSize = $derived(
    actor.reactive.system.attributes.sizeCategory ?? "medium"
  )
  let ancestryItem = $derived(
    actor.reactive.items.find((item) => item.type === "ancestry") ?? null
  )
  let availableSizes = $derived.by(() => {
    let ancestrySizes = ancestryItem?.system?.size ?? []
    if (!ancestrySizes || ancestrySizes.length === 0) {
      // If ancestry has no sizes defined, allow all playable sizes (small, medium, large)
      ancestrySizes = ["small", "medium", "large"]
    }

    return ancestrySizes.map((sizeCategory) => ({
      value: sizeCategory,
      label: sizeCategories[sizeCategory] ?? sizeCategory,
    }))
  })
</script>

<section class="nimble-sheet__body nimble-sheet__body--item">
  <label
    class="nimble-details-field nimble-details-field--column"
    style="grid-area: size;"
  >
    <span
      class="nimble-heading nimble-heading--clickable"
      data-heading-variant="field"
      data-tooltip={availableSizes.length === 1
        ? "Size is determined by ancestry"
        : "Available sizes from ancestry"}
      data-tooltip-direction="UP"
    >
      Size
    </span>

    <TagGroup
      options={availableSizes}
      selectedOptions={[currentSize]}
      toggleOption={(sizeCategory) =>
        actor.update({ "system.attributes.sizeCategory": sizeCategory })}
    />
  </label>
</section>

<style>
  .nimble-sheet__body {
    padding: 0.5rem;
  }
</style>
