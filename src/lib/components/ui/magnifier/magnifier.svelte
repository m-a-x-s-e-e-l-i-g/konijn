<script lang="ts">
  // Make the zoomLevel reactive so it updates properly
  let zoomFactor = $state(2);
  
  let { 
    src, 
    alt = "Image", 
    zoomLevel = 2, 
    zoomBoxSize = 150,
    zoomBoxRadius = 0,
    borderColor = "amber-500",
    borderWidth = 2
  } = $props<{
    src: string;
    alt?: string;
    zoomLevel?: number;
    zoomBoxSize?: number;
    zoomBoxRadius?: number;
    borderColor?: string;
    borderWidth?: number;
  }>();

  // Update reactive zoomFactor when zoomLevel prop changes
  $effect(() => {
    zoomFactor = Number(zoomLevel);
  });


  let container: HTMLDivElement;
  let showZoom = $state(false);
  let zoomBoxStyle = $state("");
  let zoomImageStyle = $state("");
  
  function handleMouseMove(e: MouseEvent) {
    if (!container) return;
    
    const rect = container.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Position the zoom box
    let zoomBoxLeft = x - zoomBoxSize/2;
    let zoomBoxTop = y - zoomBoxSize/2;
    
    // Keep the box within the image boundaries
    zoomBoxLeft = Math.max(0, Math.min(rect.width - zoomBoxSize, zoomBoxLeft));
    zoomBoxTop = Math.max(0, Math.min(rect.height - zoomBoxSize, zoomBoxTop));
    
    // Calculate relative positions (0-1)
    const relX = x / rect.width;
    const relY = y / rect.height;
    
    // Update styles
    zoomBoxStyle = `
      display: block;
      left: ${zoomBoxLeft}px;
      top: ${zoomBoxTop}px;
      width: ${zoomBoxSize}px;
      height: ${zoomBoxSize}px;
      border-radius: ${zoomBoxRadius}px;
      border: ${borderWidth}px solid ${borderColor.startsWith('#') ? borderColor : ''};
    `;
    
    // Ensure zoomLevel is applied as a number
  const zoomLevelNum = Number(zoomLevel);
  
  zoomImageStyle = `
      transform: scale(${zoomLevelNum});
      transform-origin: ${relX * 100}% ${relY * 100}%;
    `;
  }
</script>

<div class="magnifier-container relative" 
     bind:this={container}
     on:mousemove={handleMouseMove}
     on:mouseenter={() => showZoom = true}
     on:mouseleave={() => showZoom = false}>
  
  <!-- Original image -->
  <img {src} {alt} class="max-w-full max-h-[80vh] object-contain block" />
  
  <!-- Zoom box -->
  {#if showZoom}
    <div class="zoom-box absolute pointer-events-none overflow-hidden shadow-lg"
         class:border-amber-500={!borderColor.startsWith('#')}
         style={zoomBoxStyle}>
      <img {src} {alt} class="absolute top-0 left-0 w-full h-full object-cover" 
           style={zoomImageStyle}
           data-zoom-level={zoomLevel} />
    </div>
  {/if}
</div>

<style>
  .magnifier-container {
    cursor: crosshair;
    user-select: none;
  }
  
  .zoom-box {
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
    border-radius: 0.375rem; /* rounded-md default */
  }
</style>
