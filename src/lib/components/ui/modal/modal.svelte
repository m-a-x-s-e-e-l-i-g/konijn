<script lang="ts">
  import { fade } from 'svelte/transition';
  import { cn } from '$lib/utils';

  export let open = false;
  export let title: string | undefined = undefined;
  export let onClose: () => void = () => {};

  /**
   * Close the modal when clicking outside or pressing Escape
   */
  function handleOutsideClick(event: MouseEvent) {
    if (event.target === event.currentTarget) {
      onClose();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      onClose();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
  <div 
    class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 md:p-8"
    onclick={handleOutsideClick}
    onkeydown={(e) => e.key === 'Enter' && onClose()}
    role="dialog"
    aria-modal="true"
    transition:fade={{ duration: 200 }}
  >
    <div 
      class={cn(
        "bg-black rounded-lg shadow-lg max-w-full max-h-[90vh] overflow-hidden flex flex-col",
        $$props.class
      )}
    >
      {#if title}
        <div class="px-6 py-4 border-b">
          <h2 class="text-xl font-semibold">{title}</h2>
        </div>
      {/if}
      
      <div class="flex-1 overflow-auto p-1">
        <slot />
      </div>
      
      <div class="absolute top-2 right-2">
        <button 
          onclick={() => onClose()}
          class="rounded-full p-1.5 bg-black/20 hover:bg-black/40 text-white transition-colors"
          aria-label="Close"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M18 6 6 18"/>
            <path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>
    </div>
  </div>
{/if}
