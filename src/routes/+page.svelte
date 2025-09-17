<script lang="ts">
    import { ArrowPathRoundedSquare, Sparkles } from '@steeze-ui/heroicons';
    import { Icon } from '@steeze-ui/svelte-icon';
    import { bounceCount } from '$lib/stores/bounce';
    import { currentWeapon } from '$lib/stores/weapon';
    import { gsap } from 'gsap';
    import { onMount } from 'svelte';
    import { Toaster } from "$lib/components/ui/sonner";
    import { Modal } from "$lib/components/ui/modal";
    import { Magnifier } from "$lib/components/ui/magnifier";
    import { Tag } from "$lib/components/ui/tag";
    import { Howl } from 'howler';
    import { Image } from "@unpic/svelte";
    import { artworkCollection, getArtworkById } from '$lib/data/artwork-tags';

    // Image preview modal
    let previewModalOpen = $state(false);
    let selectedImage = $state<string | null>(null);
    let selectedImageAlt = $state("Konijn Artwork");
    
    // Initialize isMobileDevice to false, will be properly set in onMount
    let isMobile = $state(false);
    
    function openImagePreview(imageNumber: number) {
        // Skip opening preview on mobile devices
        if (isMobile) return;
        
        selectedImage = `/images/artwork/${imageNumber}.jpg`;
        selectedImageAlt = `Konijn Artwork ${imageNumber}`;
        previewModalOpen = true;
    }

    function closeImagePreview() {
        previewModalOpen = false;
        selectedImage = null;
    }

    function getImageProps(artwork) {
        const props = {
            src: `/images/artwork/${artwork.id}.jpg`,
            alt: artwork.title || `Konijn Artwork ${artwork.id}`,
            aspectRatio: 12/15,
            width: 800,
            background: "auto"
        };
        if (!import.meta.env.DEV) {
            props.cdn = "netlify";
        }
        return props;
    }

    var bounceSound = new Howl({
        src: ['/audio/bounce.mp3']
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

    // Weapon selection
    let fartSound = new Howl({ 
        src: ['/audio/weapons/fart.mp3'],
        onplay: () => {
            // Randomize the pitch between 0.5 and 1.5
            fartSound.rate(Math.random() * (1.5 - 0.5) + 0.5);
        }
    });
    const fartEquipSound = new Howl({ src: ['/audio/weapons/fart-equip.mp3'] });
    const pistolSound = new Howl({ src: ['/audio/weapons/pistol.mp3'] });
    const pistolEquipSound = new Howl({ src: ['/audio/weapons/pistol-equip.mp3'] });
    const weapons = [
        { id: 0, name: 'fart', sound: fartSound, equipSound: fartEquipSound, fireRate: 200 },
        { id: 1, name: 'pistol', sound: pistolSound, equipSound: pistolEquipSound, fireRate: 100 },
    ];

    function switchWeapon() {
        $currentWeapon = ($currentWeapon + 1) % weapons.length;
        const nextWeapon = weapons[$currentWeapon];
        nextWeapon.equipSound.play();
    }
    
    let timeout: number | null = null;

    function shoot() {
        if (timeout) return;

        weapons[$currentWeapon].sound.play();
        
        // Add shooting animation for pistol
        if (weapons[$currentWeapon].name === 'pistol') {
            const pistolElement = document.getElementById('pistol');
            const muzzleFlash = document.getElementById('muzzle-flash');
            
            if (pistolElement) {
                // Create a quick recoil animation
                gsap.fromTo(pistolElement, 
                    { rotation: 0 },
                    { 
                        rotation: -4,
                        transformOrigin: "bottom-left",
                        duration: 0.06, 
                        ease: 'power2.out',
                        yoyo: true,
                        repeat: 1
                    }
                );
            }
            
            if (muzzleFlash) {
                const xStart = 345; // X initial position of the muzzle flash
                const yStart = 130; // Y initial position of the muzzle flash
                const rotateStart = -45; // Initial rotation angle of the muzzle flash

                // Randomize muzzle flash for more organic, directional feel
                // Small jitter so every shot looks a bit different
                const jitterX = (Math.random() - 0.5) * 6; // -3..3
                const jitterY = (Math.random() - 0.5) * 6; // -3..3
                // Make flash more elongated forward with variable scale
                const scaleX = 1.9 + Math.random() * 0.7;
                const scaleY = 1.6 + Math.random() * 0.5;
                const rotate = (Math.random() - 0.5) * 16; // -8..8 degrees
                const appear = 0.04 + Math.random() * 0.03; // 0.04..0.07s
                const fade = 0.01 + Math.random() * 0.06; // 0.08..0.14s

                muzzleFlash.style.display = 'block';
                // Ensure starting transform resets per shot using provided baseline
                gsap.set(muzzleFlash, { opacity: 0, scaleX: 0.6, scaleY: 0.6, rotation: rotateStart, x: xStart, y: yStart });

                gsap.to(muzzleFlash, {
                    transformOrigin: "0% 50%", // left-center of the flash group points forward
                    opacity: 1,
                    scaleX,
                    scaleY,
                    rotation: rotateStart + rotate,
                    x: xStart + jitterX,
                    y: yStart + jitterY,
                    duration: appear,
                    ease: 'power2.out',
                    onComplete: () => {
                        gsap.to(muzzleFlash, {
                            opacity: 0,
                            scaleX: scaleX * 1.1,
                            duration: fade,
                            ease: 'power1.in',
                            onComplete: () => {
                                muzzleFlash.style.display = 'none';
                            }
                        });
                    }
                });
            }
        }
        
        timeout = setTimeout(() => {
            timeout = null;
        }, weapons[$currentWeapon].fireRate);
    }

    onMount(() => {
        // Function to detect mobile devices - only called in the browser
        function isMobileDevice() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }
        
        // Set the isMobile variable for use throughout the component
        isMobile = isMobileDevice();
        
        // Konijn animation
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

        function displayWeapon() {
            const weapon = weapons[$currentWeapon];
            // Hide all weapons within the weapon group in svg
            const weaponGroup = document.getElementById('weapons');
            if (!weaponGroup) return;
            for (let i = 0; i < weaponGroup.children.length; i++) {
                (weaponGroup.children[i] as HTMLElement).style.display = 'none';
            }
            // Show the selected weapon if it exists
            const selectedWeapon = document.getElementById(weapon.name);
            if (selectedWeapon) {
                selectedWeapon.style.display = 'block';
            }
        }

        window.addEventListener('keydown', (event) => {
            if (event.key === 'n') {
                switchWeapon();
            } else if (event.key === 'x') {
                shoot();
            }
        });
        
        $effect(() => {
            displayWeapon();
        });
    });
</script>

<style>
    #background {
        position: absolute;
        left:0;right:0;top:0;bottom:0;
        background: linear-gradient(to bottom, #87CEEB, #4682B4);
        overflow: hidden;
    }

    #konijn-container {
        position: absolute;
        bottom: 0;
        left: 50%;
        transform: translateX(-50%);

        #konijn {
            width: auto;
            height: 480px; /* increased to give muzzle flash more room */
            overflow: visible; /* allow effects (muzzle flash) to render outside SVG viewport */
        }
    
        #word-container {
            position: absolute;
            bottom: 0;
            left: 50%;
            transform: translateX(-65%);
            font-size: 2rem;
            font-weight: bold;
            pointer-events: none;
            text-align: center;
        }
    }


    #grass {
        position: absolute;
        bottom: 0;
        left: 0;
        width: 100%;
        height: 100px;
        background: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><path d="M0 100 Q10 80 20 100 T40 100 T60 100 T80 100 T100 100 V100 H0 Z" fill="%2352a300"/></svg>') repeat-x;
    }

    #boing-counter {
        position: absolute;
        top: 0;
        left: 50%;
        transform: translateX(-50%);
        font-size: 2rem;
        font-weight: bold;
        pointer-events: none;
    }

    #switch-weapon-button, #shoot-button {
        position: absolute;
        bottom: 100px;
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: 2px solid #ccc;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 1.5rem;
        cursor: pointer;
        z-index: 1;
    }

    #switch-weapon-button {
        left: 10%;
        background-color: #7fa9dc;
    }

    #shoot-button {
        right: 10%;
        background-color: #de884b;
    }

    main {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        height: auto;
        background-image: url('/images/carrot-tile.png');
        display: flex;
        align-items: center;
        justify-content: center;
        flex-direction: column;
    }

    #title {
        background: linear-gradient(90deg, #f12711bd 0%, #f5af19db 100%);
        border-radius: 10px;
        border: 3px solid #000;
    }

    #image-container {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        gap: 40px;
        width: 100%;
    }

    :global(.konijn-artwork) {
    width: 400px;
    border: 5px solid black;
    margin: 0 auto;
    background-color: black;
    align-content: space-evenly;
    cursor: pointer;
    transition: transform 0.2s ease-in-out;
  }

    :global(.konijn-artwork:hover) {
    transform: scale(1.03);
  }

  /* Style for disabled artwork buttons on mobile */
    :global(.mobile-disabled) {
    cursor: default;
    position: relative;
  }
  
    :global(.mobile-disabled:hover) {
    transform: none !important;
  }

  .indie-flower-regular {
  font-family: "Indie Flower", serif;
  font-weight: 400;
  font-style: normal;
}

.permanent-marker-regular {
  font-family: "Permanent Marker", serif;
  font-weight: 400;
  font-style: normal;
}

.rubik-regular {
  font-family: "Rubik", serif;
  font-optical-sizing: auto;
  font-weight: 400;
  font-style: normal;
}

/* Ensure SVG transforms use the element's box and originate from the barrel side */
#muzzle-flash {
    transform-box: fill-box;
    transform-origin: 0% 50%; /* left-center of the flash group points forward */
}
</style>

<svelte:head>
    <title>🐰 Konine - KO9 - Konijn 🐇</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous">
    <link href="https://fonts.googleapis.com/css2?family=Indie+Flower&family=Permanent+Marker&family=Rubik:ital,wght@0,300..900;1,300..900&display=swap" rel="stylesheet">

</svelte:head>

<div id="background">
    <div id="konijn-container">
    <svg id="konijn" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 356.31 525.12" overflow="visible"><defs><style>.cls-1,.cls-4{fill:#fff;}.cls-1,.cls-3{stroke:#231f20;stroke-miterlimit:10;}.cls-1{stroke-width:4px;}.cls-2,.cls-3{fill:#231f20;}</style></defs><path id="right_arm" data-name="right arm" class="cls-1" d="M369.79,487.72c-29.84,27.6-63,40.29-74.06,28.34s4.16-44,34-71.64,48.35-27.58,59.41-15.63S399.63,460.11,369.79,487.72Z" transform="translate(-77.63 -202.44)"/><ellipse id="body" class="cls-1" cx="150.5" cy="381.12" rx="148.5" ry="142"/><g id="left_foot" data-name="left foot"><circle class="cls-1" cx="99" cy="464.12" r="46"/><path class="cls-2" d="M161.63,623.29l1.18,11,.17,1.59a2.55,2.55,0,0,0,2.5,2.5,2.53,2.53,0,0,0,2.5-2.5l-1.18-11-.17-1.59a2.5,2.5,0,0,0-5,0Z" transform="translate(-77.63 -202.44)"/><path class="cls-2" d="M183,621.75l-1.82,10.46-.27,1.51a2.57,2.57,0,0,0,1.75,3.08,2.53,2.53,0,0,0,3.07-1.75l1.83-10.46.26-1.52A2.56,2.56,0,0,0,186.1,620a2.53,2.53,0,0,0-3.07,1.75Z" transform="translate(-77.63 -202.44)"/></g><g id="right_foot" data-name="right foot"><circle class="cls-1" cx="191" cy="469.12" r="46"/><path class="cls-2" d="M248.4,631l4,10.7.57,1.52a2.5,2.5,0,0,0,4.82-1.32l-4-10.71-.57-1.52a2.56,2.56,0,0,0-3.07-1.75A2.53,2.53,0,0,0,248.4,631Z" transform="translate(-77.63 -202.44)"/><path class="cls-2" d="M269.19,626.4l-.44,12.82-.07,1.85a2.5,2.5,0,0,0,5,0l.45-12.82.06-1.85a2.51,2.51,0,0,0-2.5-2.5,2.55,2.55,0,0,0-2.5,2.5Z" transform="translate(-77.63 -202.44)"/></g><path id="left_arm" data-name="left arm" class="cls-1" d="M105.53,503.42q5,5,10.62,9.87c30.84,26.48,47.91,23.86,58.52,11.5s10.74-29.76-20.1-56.24c-2-1.71-4-3.34-6-4.92A146.58,146.58,0,0,0,105.53,503.42Z" transform="translate(-77.63 -202.44)"/><g id="head"><path id="right_ear" data-name="right ear" class="cls-1" d="M303,282.75c-14.2,38.09-33.35,65.38-48.61,59.69s-16.11-41.18-1.91-79.27,34.58-50.45,49.84-44.76S317.22,244.66,303,282.75Z" transform="translate(-77.63 -202.44)"/><path id="left_ear" data-name="left ear" class="cls-1" d="M174.42,270.89c14.62,40.46,18.75,75.55,34.89,73.35s24.5-38.63,18.69-81.38-23.12-60.43-39.26-58.24S160.09,231.25,174.42,270.89Z" transform="translate(-77.63 -202.44)"/><ellipse id="head-2" data-name="head" class="cls-1" cx="154.13" cy="172.29" rx="71.95" ry="76.98"/><circle id="left_eye" data-name="left eye" class="cls-3" cx="132.53" cy="146.82" r="6.89"/><circle id="right_eye" data-name="right eye" class="cls-3" cx="177.47" cy="146.82" r="6.89"/><path id="nose" class="cls-3" d="M241.68,381.18,233,389.82a2.35,2.35,0,0,1-3.33,0l-8.63-8.64a2.35,2.35,0,0,1,1.66-4H240A2.36,2.36,0,0,1,241.68,381.18Z" transform="translate(-77.63 -202.44)"/><g id="mouth"><path class="cls-4" d="M194.81,389.84c0,16.3,8.18,29.51,18.28,29.51s18.29-13.21,18.29-29.51c0,16.3,8.19,29.51,18.28,29.51S268,406.14,268,389.84" transform="translate(-77.63 -202.44)"/><path class="cls-2" d="M192.31,389.84a45.69,45.69,0,0,0,3.81,18.56c2,4.51,5.17,8.85,9.51,11.37a14.7,14.7,0,0,0,13.51.72c4.44-2,7.8-6,10-10.24a44.16,44.16,0,0,0,4.71-20.41h-5a45.69,45.69,0,0,0,3.81,18.56c2,4.51,5.17,8.85,9.51,11.37a14.7,14.7,0,0,0,13.51.72c4.44-2,7.8-6,10-10.24a44.16,44.16,0,0,0,4.71-20.41c0-3.22-5-3.22-5,0a40.29,40.29,0,0,1-3,15.72c-1.64,3.85-4.21,7.68-7.63,9.75a9.48,9.48,0,0,1-9.16.64c-3.6-1.73-6.14-5-8-8.68a38.83,38.83,0,0,1-3.79-17.43c0-3.22-5-3.22-5,0a40.47,40.47,0,0,1-3,15.72c-1.65,3.85-4.21,7.68-7.63,9.75a9.48,9.48,0,0,1-9.16.64c-3.6-1.73-6.14-5-8-8.68a38.83,38.83,0,0,1-3.79-17.43c0-3.22-5-3.22-5,0Z" transform="translate(-77.63 -202.44)"/></g></g><g id="weapons"><path id="pistol" d="M383.16,482.23a.6.6,0,0,0,.21-.14l2.14-2.07a.62.62,0,0,1,.88,0l0,0a.68.68,0,0,1,.17.5,6,6,0,0,0,.15,2.44.64.64,0,0,0,.15.25l.78.8c.65.68,1.11.24,1.11.24L408.09,466l.07-.08a3.9,3.9,0,0,0,.94-2.84.61.61,0,0,0-.17-.34l-1.83-1.9a1.26,1.26,0,0,0-1.81,0l-.19-.25.23-.22c1.93-2.73.41-4.57-.86-5.51a7.73,7.73,0,0,1-2.29-2.75l-.89-1.74,0-.09-2.07-6.14a1.36,1.36,0,0,1,.17-1.22,2.12,2.12,0,0,0,.3-2.38,3.63,3.63,0,0,0-1.87-1.34,2.28,2.28,0,0,1-1.39-1.42L395.11,434a2.22,2.22,0,0,1-.06-1.3c.29-1.12.77-3.35.12-4a3.88,3.88,0,0,0-1.3-.83,2.83,2.83,0,0,1-1.61-1.66l-1.84-5.09,0-.07c-.15-.32-1.41-3-.13-4.63s1.8-1.75,1.8-1.75a14.12,14.12,0,0,0,6-2.31l.09-.07,17.27-17.19.06-.06c1.33-1.73,1.11-2.39.46-3.06a8.8,8.8,0,0,0-2.59-1.36l-.1,0a27,27,0,0,1-7.61-6.53c-2.22-3.12-.81-5.23-.6-5.52l.05-.06c8-8.17,15.73-16,17.58-17.9a.61.61,0,0,0,0-.86L422,359a.62.62,0,0,1,0-.87l1.81-1.76a.63.63,0,0,1,.88,0l.88.92a.63.63,0,0,0,.88,0l2.25-2.19c4.66-4.87,5.2-7.84,5.25-8.73a.61.61,0,0,0-.18-.46l-6.16-6.36a.62.62,0,0,1,0-.87h0a.62.62,0,0,0,0-.89l-6.11-6.3a.62.62,0,0,0-.89,0l-.45.44-.08-.09-.49-.5a.56.56,0,0,0-.2-.14,2.78,2.78,0,0,0-2,.42l-.12.09-1.06,1a.59.59,0,0,1-.56.16l-1.57-.33a.59.59,0,0,0-.56.16l-.79.76a.64.64,0,0,0-.13.72l.47,1a.59.59,0,0,1-.13.71l-75,71.88a.63.63,0,0,1-.68.12l-2-.9a.63.63,0,0,0-.68.12l-1.95,1.9a.6.6,0,0,0-.14.68l.84,2a.63.63,0,0,1-.14.69l-3.52,3.4a.74.74,0,0,0-.16.27,3.21,3.21,0,0,0,.18,2.19.48.48,0,0,0,.12.16l8.76,9a.62.62,0,0,1,.16.31c1.06,4.89,3.91,3,3.91,3,7.85-5.87,13.52.43,13.52.43,6.6,7.65,10.34,20,10.73,21.34a.46.46,0,0,1,0,.2c-.09,1.61,3.31,16.38,3.31,16.38.79,3.86,4.62,10.43,4.91,10.92l0,.06C376.87,484.38,382.28,482.56,383.16,482.23Zm3-73.62c-2-2.47-1.93-4.24-1.93-4.24a10.16,10.16,0,0,0,7.77-1.95c2.17,1.29,9.11.44,10.68-.65s.47-1.76.47-1.76c.68-1.1.24-1.11.24-1.11-2.67.4-8.19-1.24-8.19-1.24l-4.38-4.06,3-3.77c1.85-2.24,2.65-2.57,2.65-2.57s4-3,8.84,1.91,2.08,8.9,2.08,8.9l-9.91,10.05c-3.38,3.28-6.48,2.79-6.48,2.79A6.15,6.15,0,0,1,386.17,408.61Z" transform="translate(-77.63 -202.44)"/>
        <!-- Muzzle flash positioned at the pistol barrel (directional forward cone) -->
    <g id="muzzle-flash" style="display: none;">
            <!-- Base bright core ellipse pointing forward (right) -->
            <ellipse cx="6" cy="0" rx="10" ry="4" fill="#fff7cc" opacity="0.95"/>
            <!-- Hot inner core -->
            <ellipse cx="12" cy="0" rx="6" ry="2.6" fill="#fff" opacity="0.9"/>
            <!-- Orange cone -->
            <polygon points="0,-4 28,0 0,4" fill="#ff9a1a" opacity="0.85"/>
            <!-- Yellow cone inside for gradient-like look -->
            <polygon points="0,-2.2 20,0 0,2.2" fill="#ffe057" opacity="0.95"/>
            <!-- Small sparks forward -->
            <circle cx="30" cy="0" r="1.6" fill="#ffd24d" opacity="0.9"/>
            <circle cx="24" cy="2" r="1.2" fill="#ffad33" opacity="0.9"/>
            <circle cx="24" cy="-2" r="1.2" fill="#ffad33" opacity="0.9"/>
        </g>
    </g></svg>
        <div id="word-container"></div>
    </div>

    <button id="switch-weapon-button" onclick={switchWeapon} title="N">
        <Icon src={ArrowPathRoundedSquare} theme="solid" size="60%" />
    </button>
    <button id="shoot-button" onclick={shoot} title="X">
        <Icon src={Sparkles} theme="solid" size="60%" />
    </button>

    <div id="grass"></div>
    <div id="boing-counter">
        <span class="text-4xl chewy-regular">{$bounceCount}</span>
    </div>
</div>
<main class="pb-5">
    <div id="title" class="my-10 p-4 text-center">
        <h1 class="text-2xl sm:text-3xl md:text-4xl">🐰 <span class="rubik-regular">Konine</span> - <span class="permanent-marker-regular">KO9</span> - <span class="indie-flower-regular">Konijn</span> 🐇</h1>
        <p class="text-lg">The bounciest rabbit in the world!</p>
    </div>
    
    <div id="image-container">
        {#each artworkCollection as artwork}
            <button 
                class="konijn-artwork bg-black border-5 border-black m-0 auto align-content-space-evenly transition-transform duration-200 hover:scale-105 p-0 w-[400px] {isMobile ? 'mobile-disabled' : ''}" 
                onclick={() => openImagePreview(artwork.id)} 
                aria-label={`View larger version of artwork ${artwork.id}`}
                title={isMobile ? "Image preview disabled on mobile devices" : "Click to view larger image"}
            >
                <span class="text-xs text-white inline-block absolute bg-black w-10 h-5 text-center -translate-x-1/2 rounded-b">
                    #{artwork.id}
                </span>
                <Image {...getImageProps(artwork)} />
                <div class="mt-2 flex flex-col items-center">
                    <div class="flex flex-wrap justify-center">
                        {#each artwork.tags as tag}
                            <Tag {tag} />
                        {/each}
                    </div>
                </div>
            </button>
        {/each}
    </div>

    <footer class="w-full flex items-center justify-center mt-10">
      <a href="https://maxmade.nl" target="_blank" rel="noopener noreferrer">
        <img src="/images/logo-MAXmade.svg" alt="MAXmade logo" class="h-4 w-auto" />
      </a>
    </footer>
</main>


<Modal open={previewModalOpen} onClose={closeImagePreview} class="max-w-3xl">
    {#if selectedImage}
        <div class="flex flex-col items-center justify-center">
            <Magnifier 
                src={selectedImage} 
                alt={selectedImageAlt} 
                zoomLevel={10} 
                zoomBoxSize={150} 
                zoomBoxRadius={10}
                borderColor="#f5af19"
                borderWidth={3}
            />
            
            {#if selectedImage && selectedImage.includes('/artwork/')}
                {@const imageId = parseInt(selectedImage.split('/').pop()?.split('.')[0] || '0')}
                {@const artwork = getArtworkById(imageId)}
                {#if artwork}
                    <div class="mt-4 flex flex-wrap justify-center">
                        {#each artwork.tags as tag}
                            <Tag {tag} />
                        {/each}
                    </div>
                {/if}
            {/if}
        </div>
    {/if}
</Modal>

<Toaster/>
