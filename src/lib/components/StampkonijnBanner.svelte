<script lang="ts">
	import { onMount } from 'svelte';
	import * as THREE from 'three';
	import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

	let host: HTMLElement;
	let canvas: HTMLCanvasElement;
	let loading = $state(true);
	let failed = $state(false);

	onMount(() => {
		const scene = new THREE.Scene();
		const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 40);
		const renderer = new THREE.WebGLRenderer({
			canvas,
			alpha: true,
			antialias: true,
			powerPreference: 'high-performance'
		});
		renderer.outputColorSpace = THREE.SRGBColorSpace;
		renderer.toneMapping = THREE.ACESFilmicToneMapping;
		renderer.toneMappingExposure = 1.15;
		renderer.shadowMap.enabled = true;
		renderer.shadowMap.type = THREE.PCFSoftShadowMap;
		camera.position.set(0, 2.3, 10.1);
		camera.lookAt(0.72, 1.48, 0);

		const stage = new THREE.Group();
		stage.position.x = 1.1;
		const rabbit = new THREE.Group();
		const rabbitSpin = new THREE.Group();
		stage.add(rabbitSpin);
		rabbitSpin.add(rabbit);
		scene.add(stage);

		const floor = new THREE.Mesh(
			new THREE.CircleGeometry(2.35, 64),
			new THREE.MeshStandardMaterial({
				color: 0x17201b,
				metalness: 0.35,
				roughness: 0.72
			})
		);
		floor.rotation.x = -Math.PI / 2;
		floor.position.y = -0.04;
		floor.receiveShadow = true;
		stage.add(floor);

		const halo = new THREE.Mesh(
			new THREE.TorusGeometry(1.55, 0.018, 8, 96),
			new THREE.MeshBasicMaterial({ color: 0xe89a4d, transparent: true, opacity: 0.72 })
		);
		halo.rotation.x = -Math.PI / 2;
		halo.position.y = 0.005;
		stage.add(halo);

		const hemisphere = new THREE.HemisphereLight(0xf6f0d8, 0x101512, 1.9);
		scene.add(hemisphere);

		const keyLight = new THREE.SpotLight(0xffb15c, 105, 18, Math.PI * 0.22, 0.58, 1.25);
		keyLight.position.set(-4.5, 6.8, 5.8);
		keyLight.target.position.set(0, 0.55, 0);
		keyLight.castShadow = true;
		keyLight.shadow.mapSize.set(1024, 1024);
		scene.add(keyLight, keyLight.target);

		const rimLight = new THREE.DirectionalLight(0x8dcc9d, 4.2);
		rimLight.position.set(4.5, 3.6, -4.5);
		scene.add(rimLight);

		const floorGlow = new THREE.PointLight(0xe55e35, 14, 7, 2);
		floorGlow.position.set(2.6, 0.45, 2.2);
		scene.add(floorGlow);

		const loader = new GLTFLoader();
		const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
		let reducedMotion = reducedMotionQuery.matches;
		let visible = true;
		let animationFrame = 0;
		let resizeObserver: ResizeObserver | null = null;

		const updateSize = () => {
			const bounds = host.getBoundingClientRect();
			if (bounds.width <= 0 || bounds.height <= 0) return;
			renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
			renderer.setSize(bounds.width, bounds.height, false);
			camera.aspect = bounds.width / bounds.height;
			camera.updateProjectionMatrix();
		};

		loader.load(
			'/models/konijn-v18.glb',
			(gltf) => {
				const model = gltf.scene;
				model.updateMatrixWorld(true);
				const initialBounds = new THREE.Box3().setFromObject(model);
				const initialSize = initialBounds.getSize(new THREE.Vector3());
				const scale = 3.72 / Math.max(initialSize.y, 0.001);
				model.scale.setScalar(scale);
				model.updateMatrixWorld(true);

				const scaledBounds = new THREE.Box3().setFromObject(model);
				const center = scaledBounds.getCenter(new THREE.Vector3());
				model.position.set(-center.x, -scaledBounds.min.y, -center.z);
				model.traverse((child) => {
					if (!(child instanceof THREE.Mesh)) return;
					child.castShadow = true;
					child.receiveShadow = true;
				});
				rabbit.add(model);
				loading = false;
			},
			undefined,
			() => {
				loading = false;
				failed = true;
			}
		);

		const handleMotionPreference = (event: MediaQueryListEvent) => {
			reducedMotion = event.matches;
		};
		reducedMotionQuery.addEventListener('change', handleMotionPreference);

		const visibilityObserver = new IntersectionObserver(
			([entry]) => {
				visible = entry?.isIntersecting ?? true;
			},
			{ threshold: 0.01 }
		);
		visibilityObserver.observe(host);

		resizeObserver = new ResizeObserver(updateSize);
		resizeObserver.observe(host);
		window.addEventListener('resize', updateSize);
		updateSize();

		const clock = new THREE.Clock();
		const animate = () => {
			animationFrame = requestAnimationFrame(animate);
			if (!visible) return;

			const elapsed = clock.getElapsedTime();
			if (!reducedMotion) {
				rabbitSpin.rotation.y = elapsed * 0.42;
				rabbit.position.y = Math.sin(elapsed * 1.2) * 0.045;
				halo.rotation.z = elapsed * 0.16;
			}
			renderer.render(scene, camera);
		};
		animate();

		return () => {
			cancelAnimationFrame(animationFrame);
			visibilityObserver.disconnect();
			resizeObserver?.disconnect();
			window.removeEventListener('resize', updateSize);
			reducedMotionQuery.removeEventListener('change', handleMotionPreference);
			rabbit.traverse((child) => {
				if (!(child instanceof THREE.Mesh)) return;
				child.geometry.dispose();
				const materials = Array.isArray(child.material) ? child.material : [child.material];
				materials.forEach((material) => material.dispose());
			});
			floor.geometry.dispose();
			floor.material.dispose();
			halo.geometry.dispose();
			halo.material.dispose();
			renderer.dispose();
		};
	});
</script>

<section class="stampkonijn-banner" bind:this={host} aria-labelledby="stampkonijn-banner-title">
	<div class="banner-light banner-light--amber" aria-hidden="true"></div>
	<div class="banner-light banner-light--green" aria-hidden="true"></div>
	<div class="banner-grid" aria-hidden="true"></div>
	<canvas bind:this={canvas} aria-hidden="true"></canvas>

	<div class="banner-copy">
		<p class="banner-kicker"><span class="kicker-dot"></span> LIVE FROM THE ARTROOM</p>
		<h2 id="stampkonijn-banner-title">STAM<span>P</span><br /><em>KONIJN</em></h2>
		<p class="banner-description">
			Een 3D-konijn. Een kamer vol kunst. Eén doel: alles kapot stampen.
		</p>
		<a class="banner-cta" href="/stampkonijn" data-sveltekit-reload>
			<span>SPEEL DE GAME</span>
			<span aria-hidden="true">↗</span>
		</a>
		<p class="banner-meta">GRATIS · DESKTOP + MOBIEL · GEEN ACCOUNT</p>
	</div>

	<div class="banner-badge" aria-hidden="true">
		<span>NEW</span>
		<span>GAME</span>
	</div>

	{#if loading}
		<div class="banner-status" role="status">Konijn wordt geladen…</div>
	{:else if failed}
		<div class="banner-status">Stampkonijn staat klaar →</div>
	{/if}
</section>

<style>
	.stampkonijn-banner {
		--ink: #0d110f;
		--paper: #f6efdc;
		--orange: #f0a14d;
		position: relative;
		isolation: isolate;
		min-height: clamp(30rem, 62vw, 44rem);
		width: 100%;
		overflow: hidden;
		background:
			radial-gradient(circle at 68% 46%, rgba(224, 129, 58, 0.16), transparent 24%),
			linear-gradient(116deg, #101612 0%, #121a16 46%, #1b211b 100%);
		color: var(--paper);
		box-shadow: inset 0 0 0 1px rgba(246, 239, 220, 0.14);
	}

	.stampkonijn-banner::after {
		position: absolute;
		inset: 1rem;
		z-index: -1;
		border: 1px solid rgba(246, 239, 220, 0.17);
		content: '';
		pointer-events: none;
	}

	canvas {
		position: absolute;
		inset: 0;
		z-index: 1;
		height: 100%;
		width: 100%;
	}

	.banner-grid {
		position: absolute;
		inset: 0;
		z-index: 0;
		background-image:
			linear-gradient(rgba(246, 239, 220, 0.06) 1px, transparent 1px),
			linear-gradient(90deg, rgba(246, 239, 220, 0.06) 1px, transparent 1px);
		background-size: 4rem 4rem;
		mask-image: linear-gradient(90deg, black, transparent 72%);
		opacity: 0.55;
	}

	.banner-light {
		position: absolute;
		z-index: 0;
		border-radius: 999px;
		filter: blur(1px);
		pointer-events: none;
		transform-origin: center;
	}

	.banner-light--amber {
		top: -34%;
		left: 48%;
		height: 145%;
		width: 13rem;
		background: linear-gradient(90deg, transparent, rgba(239, 157, 73, 0.16), transparent);
		transform: rotate(28deg);
	}

	.banner-light--green {
		right: 12%;
		bottom: -52%;
		height: 140%;
		width: 10rem;
		background: linear-gradient(90deg, transparent, rgba(126, 199, 151, 0.14), transparent);
		transform: rotate(-28deg);
	}

	.banner-copy {
		position: relative;
		z-index: 3;
		display: flex;
		width: min(31rem, 44%);
		min-height: clamp(30rem, 62vw, 44rem);
		flex-direction: column;
		align-items: flex-start;
		justify-content: center;
		padding: clamp(3rem, 8vw, 7rem) clamp(1.5rem, 6vw, 7rem);
		pointer-events: none;
	}

	.banner-copy > * {
		pointer-events: auto;
	}

	.banner-kicker,
	.banner-meta {
		font-family: 'Rubik', sans-serif;
		font-size: 0.68rem;
		font-weight: 700;
		letter-spacing: 0.16em;
	}

	.banner-kicker {
		display: flex;
		align-items: center;
		gap: 0.55rem;
		margin: 0 0 1.25rem;
		color: #e8bd77;
	}

	.kicker-dot {
		display: inline-block;
		height: 0.45rem;
		width: 0.45rem;
		border-radius: 50%;
		background: #f2a34f;
		box-shadow: 0 0 1rem rgba(242, 163, 79, 0.85);
	}

	h2 {
		margin: 0;
		font-family: 'Permanent Marker', sans-serif;
		font-size: clamp(3.7rem, 8vw, 7.8rem);
		font-weight: 400;
		letter-spacing: -0.04em;
		line-height: 0.82;
		text-shadow: 0.08em 0.08em 0 rgba(0, 0, 0, 0.3);
	}

	h2 span {
		color: var(--orange);
	}

	h2 em {
		color: #ecdfbc;
		font-style: normal;
	}

	.banner-description {
		max-width: 24rem;
		margin: 1.7rem 0 0;
		font-family: 'Rubik', sans-serif;
		font-size: clamp(0.95rem, 1.4vw, 1.15rem);
		line-height: 1.45;
		color: rgba(246, 239, 220, 0.78);
	}

	.banner-cta {
		display: inline-flex;
		align-items: center;
		gap: 1.1rem;
		margin-top: 1.8rem;
		border: 2px solid var(--paper);
		background: var(--orange);
		padding: 0.85rem 1.1rem 0.78rem 1.3rem;
		color: var(--ink);
		font-family: 'Chewy', sans-serif;
		font-size: 1.35rem;
		line-height: 1;
		text-decoration: none;
		box-shadow: 0.3rem 0.3rem 0 #070a08;
		transition:
			transform 180ms cubic-bezier(0.22, 1, 0.36, 1),
			box-shadow 180ms cubic-bezier(0.22, 1, 0.36, 1),
			background-color 180ms ease;
	}

	.banner-cta:hover {
		background: #f6b562;
		box-shadow: 0.45rem 0.45rem 0 #070a08;
		transform: translate(-0.12rem, -0.12rem) rotate(-1deg);
	}

	.banner-cta:focus-visible {
		outline: 3px solid #f6efdc;
		outline-offset: 5px;
	}

	.banner-meta {
		margin: 1.35rem 0 0;
		color: rgba(246, 239, 220, 0.46);
	}

	.banner-badge {
		position: absolute;
		right: clamp(1.4rem, 5vw, 6rem);
		bottom: clamp(1.3rem, 5vw, 4rem);
		z-index: 3;
		display: grid;
		height: 5.4rem;
		width: 5.4rem;
		place-content: center;
		transform: rotate(11deg);
		border: 2px solid var(--paper);
		border-radius: 50%;
		background: #c85e3b;
		color: var(--paper);
		font-family: 'Chewy', sans-serif;
		font-size: 1rem;
		line-height: 0.95;
		text-align: center;
		box-shadow: 0.25rem 0.25rem 0 #070a08;
	}

	.banner-status {
		position: absolute;
		right: 2rem;
		top: 2rem;
		z-index: 4;
		color: rgba(246, 239, 220, 0.66);
		font-family: 'Rubik', sans-serif;
		font-size: 0.7rem;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	@media (max-width: 700px) {
		.stampkonijn-banner {
			min-height: 38rem;
		}

		.banner-copy {
			width: 100%;
			min-height: 38rem;
			justify-content: flex-start;
			padding: 3rem 1.5rem;
		}

		.banner-copy::after {
			position: absolute;
			inset: 0;
			z-index: -1;
			background: linear-gradient(90deg, rgba(13, 17, 15, 0.94), rgba(13, 17, 15, 0.3));
			content: '';
			pointer-events: none;
		}

		.banner-description {
			max-width: 18rem;
		}

		.banner-badge {
			right: 1.3rem;
			bottom: 1.4rem;
		}

		.banner-status {
			top: auto;
			bottom: 1.8rem;
			left: 1.5rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.banner-cta {
			transition: none;
		}

		.banner-cta:hover {
			transform: none;
		}
	}
</style>
