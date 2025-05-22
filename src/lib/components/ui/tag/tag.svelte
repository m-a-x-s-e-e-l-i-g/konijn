<script lang="ts">
  import { cn } from '$lib/utils';
  import { getTagColor } from '$lib/data/artwork-tags';

  let { tag } = $props<{
    tag: string;
  }>();
</script>

<span 
  class={cn(
    "inline-block px-2 py-0.5 text-xs font-semibold text-white rounded-full shadow-sm mr-1 mb-1",
    getTagColor(tag)
  )}>
  {tag}
</span>
