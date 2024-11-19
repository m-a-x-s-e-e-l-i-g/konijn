<script>
    import { gsap } from 'gsap';
    import { onMount } from 'svelte';

    onMount(() => {
        gsap.to('h1', { x: 100, duration: 1 });
    });
</script>

<h1>Welcome to SvelteKit</h1>