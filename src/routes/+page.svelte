<script>
    import { gsap } from 'gsap';
    import { onMount } from 'svelte';
    import {Howl} from 'howler';
    import { bounceCount } from '$lib/store';
    import { Toaster } from "$lib/components/ui/sonner";

    var bounceSound = new Howl({
        src: ['/audio/bounce.wav']
    });

    const fontClassList = ['chewy-regular', 'caveat-brush-regular', 'road-rage-regular'];

    function getRandomFontClass() {
        return fontClassList[Math.floor(Math.random() * fontClassList.length)];
    }

    function emitBoing() {
        bounceSound.play();
        bounceCount.update(n => n + 1);

        const wordElement = document.createElement('div');
        wordElement.classList.add(getRandomFontClass());
        const wordContainer = document.getElementById('word-container');
        wordElement.textContent = 'BOING';
        if (wordContainer) {
            wordContainer.appendChild(wordElement);
        }

        gsap.fromTo(wordElement, 
            { opacity: 1, y: 50 }, 
            { opacity: 0, y: -50, duration: 1, ease: 'power2.out', onComplete: () => {
                wordElement.remove();
            }}
        );
    }

    onMount(() => {
        const tl = gsap.timeline({ repeat: -1 });
        tl.fromTo('#konijn', { y: -300 }, { y: 30, duration: .4, ease: 'power2.in' }) // jump
          .to('#konijn', { scaleY: 0.8, scaleX: 1.2, duration: 0.2, onComplete: emitBoing }, '0.3') // squash
          .to('#konijn', { y: -300, duration: .4, ease: 'power2.out' }) // fall
          .to('#konijn', { scale: 1, duration: .1 }, '0.5'); // stretch

        // Force full page reload on changes, for development
        if (import.meta.hot) {
            import.meta.hot.on('vite:beforeUpdate', () => {
                window.location.reload();
            });
        }
    });
</script>

<style>
    #background {
        position: fixed;
        left:0;right:0;top:0;bottom:0;
        background: linear-gradient(to bottom, #87CEEB, #4682B4);    
    }

    #konijn {
        width: auto;
        height: 400px;
        position: fixed;
        bottom:0;
        left: 20px;
    }

    #grass {
        position: fixed;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100px;
        background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 100 Q10 80 20 100 T40 100 T60 100 T80 100 T100 100 V100 H0 Z" fill="green"/></svg>') repeat-x;
    }

    #word-container {
        position: fixed;
        bottom: 0;
        left: 80px;
        font-size: 2rem;
        font-weight: bold;
        pointer-events: none;
    }

    #boing-counter {
        position: fixed;
        top: 0;
        right: 10px;
        font-size: 2rem;
        font-weight: bold;
        pointer-events: none;
    }

</style>
<div id="background">
    <svg id="konijn" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320.12 525.12"><defs><style>.cls-1{fill:#fff;stroke-width:4px;}.cls-1,.cls-3{stroke:#231f20;stroke-miterlimit:10;}.cls-2,.cls-3{fill:#231f20;}</style></defs><path id="right_arm" data-name="right arm" class="cls-1" d="M464.16,332.16c-29.84,27.6-63,40.29-74.06,28.34s4.16-44,34-71.63,48.35-27.59,59.41-15.64S494,304.55,464.16,332.16Z" transform="translate(-172 -46.88)"/><ellipse id="body" class="cls-1" cx="150.5" cy="381.12" rx="148.5" ry="142"/><g id="left_foot" data-name="left foot"><circle class="cls-1" cx="99" cy="464.12" r="46"/><path class="cls-2" d="M256,467.73l1.18,11,.17,1.59a2.55,2.55,0,0,0,2.5,2.5,2.52,2.52,0,0,0,2.5-2.5l-1.18-11-.17-1.59a2.57,2.57,0,0,0-2.5-2.5,2.53,2.53,0,0,0-2.5,2.5Z" transform="translate(-172 -46.88)"/><path class="cls-2" d="M277.4,466.19l-1.82,10.46-.27,1.52a2.56,2.56,0,0,0,1.75,3.07,2.53,2.53,0,0,0,3.07-1.75L282,469l.26-1.51a2.56,2.56,0,0,0-1.75-3.08,2.53,2.53,0,0,0-3.07,1.75Z" transform="translate(-172 -46.88)"/></g><g id="right_foot" data-name="right foot"><circle class="cls-1" cx="191" cy="469.12" r="46"/><path class="cls-2" d="M342.77,475.46l4,10.7.58,1.53a2.5,2.5,0,0,0,4.82-1.33l-4-10.71-.57-1.52a2.5,2.5,0,1,0-4.82,1.33Z" transform="translate(-172 -46.88)"/><path class="cls-2" d="M363.56,470.84l-.44,12.82-.07,1.85a2.5,2.5,0,0,0,5,0l.45-12.82.06-1.85a2.51,2.51,0,0,0-2.5-2.5,2.55,2.55,0,0,0-2.5,2.5Z" transform="translate(-172 -46.88)"/></g><path id="left_arm" data-name="left arm" class="cls-1" d="M199.9,347.86q5,5,10.62,9.88c30.84,26.48,47.91,23.85,58.52,11.49s10.74-29.76-20.1-56.24q-3-2.55-6-4.92A146.58,146.58,0,0,0,199.9,347.86Z" transform="translate(-172 -46.88)"/><g id="head"><path id="right_ear" data-name="right ear" class="cls-1" d="M397.38,127.19c-14.2,38.09-33.35,65.38-48.61,59.69s-16.11-41.18-1.91-79.27,34.58-50.45,49.84-44.76S411.59,89.1,397.38,127.19Z" transform="translate(-172 -46.88)"/><path id="left_ear" data-name="left ear" class="cls-1" d="M268.78,115.33c14.63,40.46,18.76,75.55,34.89,73.36s24.51-38.64,18.7-81.39-23.12-60.43-39.26-58.24S254.46,75.69,268.78,115.33Z" transform="translate(-172 -46.88)"/><ellipse id="head-2" data-name="head" class="cls-1" cx="154.13" cy="172.29" rx="71.95" ry="76.98"/><circle id="left_eye" data-name="left eye" class="cls-3" cx="132.53" cy="146.82" r="6.89"/><circle id="right_eye" data-name="right eye" class="cls-3" cx="177.47" cy="146.82" r="6.89"/><path id="nose" class="cls-3" d="M336.05,225.63l-8.64,8.63a2.35,2.35,0,0,1-3.33,0l-8.63-8.63a2.36,2.36,0,0,1,1.66-4h17.27A2.36,2.36,0,0,1,336.05,225.63Z" transform="translate(-172 -46.88)"/><g id="mouth"><path class="cls-2" d="M286.68,234.28a45.61,45.61,0,0,0,3.81,18.57c2,4.5,5.17,8.84,9.51,11.36a14.7,14.7,0,0,0,13.51.72c4.44-2,7.8-6,10-10.24a44.16,44.16,0,0,0,4.71-20.41h-5a45.77,45.77,0,0,0,3.81,18.57c2,4.5,5.17,8.84,9.51,11.36a14.7,14.7,0,0,0,13.51.72c4.44-2,7.8-6,10-10.24a44.16,44.16,0,0,0,4.71-20.41c0-3.22-5-3.22-5,0a40.29,40.29,0,0,1-3,15.72c-1.65,3.85-4.21,7.68-7.63,9.76a9.51,9.51,0,0,1-9.16.63c-3.6-1.73-6.14-5-8-8.67a38.91,38.91,0,0,1-3.79-17.44c0-3.22-5-3.22-5,0a40.66,40.66,0,0,1-3,15.72c-1.65,3.85-4.21,7.68-7.63,9.76a9.52,9.52,0,0,1-9.17.63c-3.59-1.73-6.13-5-8-8.67a38.91,38.91,0,0,1-3.79-17.44c0-3.21-5-3.22-5,0Z" transform="translate(-172 -46.88)"/></g></g></svg>
    <div id="grass"></div>
    <div id="word-container"></div>
    <div id="boing-counter">{$bounceCount}</div>
</div>
<Toaster/>
