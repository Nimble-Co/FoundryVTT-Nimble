<script>
function getStatIncreaseOptions(characterClass, statIncreaseType) {
	if (!characterClass) return [];
	if (!statIncreaseType) return [];

	const abilityScores = Object.keys(document.system.abilities);
	const keyAbilityScores = characterClass.system.keyAbilityScores;

	if (statIncreaseType === 'primary') return keyAbilityScores;

	if (statIncreaseType === 'secondary') {
		return abilityScores.filter((abilityKey) => !keyAbilityScores.includes(abilityKey));
	}

	return abilityScores;
}

function getStatIncreaseType(characterClass) {
	if (!characterClass) return null;

	return characterClass?.system?.abilityScoreData?.[levelingTo]?.statIncreaseType;
}

let {
	boons,
	characterClass,
	document,
	levelingTo,
	chooseBoon = $bindable(),
	selectedAbilityScore = $bindable(),
	selectedBoon = $bindable(),
} = $props();

const { abilityScores } = CONFIG.NIMBLE;

const statIncreaseType = getStatIncreaseType(characterClass);
const statOptions = getStatIncreaseOptions(characterClass, statIncreaseType);
</script>

{#if statIncreaseType && statOptions.length && characterClass}
    <section>
        <header class="nimble-section-header">
            <h3 class="nimble-heading" data-heading-variant="section">
                Stat Increase
            </h3>
        </header>

        <div class="nimble-stat-selection">
            {#each statOptions as abilityKey}
                <label
                    class="nimble-stat-selection__option"
                    class:nimble-stat-selection__option--selected={abilityKey ===
                        selectedAbilityScore}
                >
                    {abilityScores[abilityKey] ?? abilityKey}

                    <input
                        class="nimble-stat-selection__input"
                        type="radio"
                        name="{document.id}-stat-increase"
                        value={abilityKey}
                        bind:group={selectedAbilityScore}
                    />
                </label>
            {/each}
        </div>
    </section>
{/if}

<style lang="scss">
    .nimble-stat-selection {
        display: flex;
        gap: 0.5rem;
        margin-block-end: 0.75rem;
        font-size: var(--nimble-sm-text);
        font-weight: 500;

        &__option {
            display: flex;
            align-self: center;
            justify-content: center;
            width: fit-content;
            padding: 0.5rem 1rem;
            line-height: 1;
            border: 1px solid black;
            border-radius: 4px;
            box-shadow: var(--nimble-card-box-shadow);
            cursor: pointer;
            transition: var(--nimble-standard-transition);

            &--selected {
                color: var(--nimble-light-text-color);
                background: hsl(0, 0%, 24%);
            }
        }

        &__input {
            display: none;
        }
    }
</style>
