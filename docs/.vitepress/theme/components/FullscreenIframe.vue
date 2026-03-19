<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps<{
  src: string
  label?: string
}>()

const open = ref(false)

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') open.value = false
}

watch(open, (isOpen) => {
  if (isOpen) {
    document.addEventListener('keydown', onKeydown)
    document.body.style.overflow = 'hidden'
  } else {
    document.removeEventListener('keydown', onKeydown)
    document.body.style.overflow = ''
  }
})

onUnmounted(() => {
  document.removeEventListener('keydown', onKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <button class="fullscreen-btn" @click="open = true">
    {{ label || 'View Mockups' }}
  </button>

  <Teleport to="body">
    <div v-if="open" class="fullscreen-overlay" @click.self="open = false">
      <div class="fullscreen-header">
        <span class="fullscreen-title">{{ label || 'View Mockups' }}</span>
        <button class="fullscreen-close" @click="open = false">✕ Close</button>
      </div>
      <iframe :src="src" class="fullscreen-iframe" />
    </div>
  </Teleport>
</template>

<style scoped>
.fullscreen-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.fullscreen-btn:hover {
  background: var(--vp-c-brand-1);
  color: white;
}

.fullscreen-overlay {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: var(--vp-c-bg);
  display: flex;
  flex-direction: column;
}

.fullscreen-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 16px;
  border-bottom: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg-soft);
}

.fullscreen-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.fullscreen-close {
  padding: 4px 12px;
  border-radius: 6px;
  border: 1px solid var(--vp-c-border);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}

.fullscreen-close:hover {
  background: var(--vp-c-danger-soft);
  color: var(--vp-c-danger-1);
  border-color: var(--vp-c-danger-1);
}

.fullscreen-iframe {
  flex: 1;
  width: 100%;
  border: none;
}
</style>
