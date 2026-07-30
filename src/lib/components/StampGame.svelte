<script lang="ts">
	import { onMount } from 'svelte';
	import { StampKonijnGame, type StampHudState } from '$lib/game/stampkonijn';

	const initialHud: StampHudState = {
		phase: 'idle',
		paused: false,
		score: 0,
		time: 90,
		combo: 1,
		destroyed: 0,
		total: 12,
		lastHit: '',
		lastValue: 0,
		weapon: 'poop',
		weaponReady: true
	};

	let canvas: HTMLCanvasElement;
	let shell: HTMLElement;
	let game = $state<StampKonijnGame | null>(null);
	let hud = $state<StampHudState>(initialHud);
	let ready = $state(false);
	let error = $state('');
	let muted = $state(false);
	let fullscreen = $state(false);
	let impactText = $state('');
	let impactNonce = $state(0);
	let impactTimer: ReturnType<typeof setTimeout> | null = null;
	let lastWeaponScrollAt = 0;

	const scoreFormatter = new Intl.NumberFormat('nl-NL', { maximumFractionDigits: 0 });

	function showImpact(message: string, duration = 1050) {
		impactText = message;
		impactNonce += 1;
		if (impactTimer) clearTimeout(impactTimer);
		impactTimer = setTimeout(() => {
			impactText = '';
		}, duration);
	}

	onMount(() => {
		const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		const handleFullscreenChange = () => {
			fullscreen = document.fullscreenElement === shell;
		};
		document.addEventListener('fullscreenchange', handleFullscreenChange);

		const instance = new StampKonijnGame(canvas, {
			onHud: (nextHud) => {
				hud = nextHud;
			},
			onImpact: (label, value, combo) => {
				showImpact(`${label} +€${scoreFormatter.format(value)}${combo > 1 ? ` · x${combo}` : ''}`);
			},
			onFeedback: (message) => showImpact(message, 900),
			onReady: () => {
				ready = true;
			},
			onError: (message) => {
				error = message;
			}
		});
		instance.setReducedMotion(prefersReducedMotion);
		instance.init();
		game = instance;

		return () => {
			if (impactTimer) clearTimeout(impactTimer);
			document.removeEventListener('fullscreenchange', handleFullscreenChange);
			instance.destroy();
		};
	});

	function startGame() {
		game?.start();
	}

	function toggleMute() {
		muted = !muted;
		game?.setMuted(muted);
	}

	function toggleFullscreen() {
		if (document.fullscreenElement) void document.exitFullscreen();
		else void shell.requestFullscreen?.();
	}

	function stampWithPointer(event: PointerEvent) {
		if (event.pointerType === 'mouse' && event.button === 2) {
			event.preventDefault();
			canvas.focus({ preventScroll: true });
			canvas.setPointerCapture(event.pointerId);
			game?.beginUseWeapon();
			return;
		}
		if (event.pointerType === 'mouse' && event.button !== 0) return;
		event.preventDefault();
		canvas.focus({ preventScroll: true });
		game?.beginStampAt(event.clientX, event.clientY);
	}

	function endCanvasWeapon(event: PointerEvent) {
		if (event.pointerType === 'mouse') game?.endUseWeapon();
	}

	function preventCanvasMenu(event: MouseEvent) {
		event.preventDefault();
	}

	function trackPointer(event: PointerEvent) {
		game?.setPointerTarget(event.clientX, event.clientY);
	}

	function stopTrackingPointer(event: PointerEvent) {
		if (event.pointerType === 'mouse') game?.clearPointerTarget();
	}

	function cycleWeapon() {
		game?.cycleWeapon();
	}

	function changeWeaponWithWheel(event: WheelEvent) {
		if (hud.phase !== 'playing' || hud.paused || Math.abs(event.deltaY) < 0.5) return;
		event.preventDefault();
		const now = performance.now();
		if (now - lastWeaponScrollAt < 180) return;
		lastWeaponScrollAt = now;
		game?.cycleWeapon();
	}

	function useWeaponStart(event: PointerEvent) {
		event.preventDefault();
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
		game?.beginUseWeapon();
	}

	function useWeaponEnd(event: PointerEvent) {
		event.preventDefault();
		game?.endUseWeapon();
	}

	function useWeaponKeyboard(event: MouseEvent) {
		if (event.detail !== 0) return;
		game?.beginUseWeapon();
		game?.endUseWeapon();
	}
</script>

<svelte:head>
	<title>STAMPKONIJN | Konine</title>
	<meta
		name="description"
		content="Bestuur het dikste konijn van het internet en stamp een kunstkamer compleet kapot."
	/>
</svelte:head>

<section class="game-shell" bind:this={shell} aria-label="Stampkonijn 3D game">
	<canvas
		bind:this={canvas}
		tabindex="0"
		aria-label="3D-kamer waarin Stampkonijn automatisch stuitert. Beweeg de muis om te sturen, klik links om te stampen, scroll om van wapen te wisselen en klik rechts om het geselecteerde wapen te gebruiken."
		onpointermove={trackPointer}
		onpointerenter={trackPointer}
		onpointerleave={stopTrackingPointer}
		onpointerdown={stampWithPointer}
		onpointerup={endCanvasWeapon}
		onpointercancel={endCanvasWeapon}
		onlostpointercapture={endCanvasWeapon}
		oncontextmenu={preventCanvasMenu}
		onwheel={changeWeaponWithWheel}
	></canvas>

	<header class="game-nav">
		<a href="/" class="back-link" aria-label="Terug naar de Konine kunstgalerie">
			<span aria-hidden="true">←</span>
			<span>GALERIE</span>
		</a>
		<div class="game-mark" aria-label="Stampkonijn">
			<span class="game-mark__rabbit">🐇</span>
			<span>STAMPKONIJN</span>
		</div>
		<div class="utility-actions">
			<button
				class="utility-icon"
				class:active={muted}
				type="button"
				onclick={toggleMute}
				aria-pressed={muted}
				aria-label={muted ? 'Geluid aanzetten' : 'Geluid uitzetten'}
				title={muted ? 'Geluid aan' : 'Geluid uit'}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					<path d="M11 5 6.4 9H3v6h3.4l4.6 4V5Z"></path>
					{#if muted}
						<path d="m16 9 5 6m0-6-5 6"></path>
					{:else}
						<path d="M15.2 9.2a4 4 0 0 1 0 5.6M18 6.5a7.6 7.6 0 0 1 0 11"></path>
					{/if}
				</svg>
			</button>
			<button
				class="utility-icon"
				class:active={fullscreen}
				type="button"
				onclick={toggleFullscreen}
				aria-pressed={fullscreen}
				aria-label={fullscreen ? 'Volledig scherm verlaten' : 'Volledig scherm openen'}
				title={fullscreen ? 'Volledig scherm verlaten' : 'Volledig scherm'}
			>
				<svg viewBox="0 0 24 24" aria-hidden="true">
					{#if fullscreen}
						<path d="M9 4v5H4m11-5v5h5M9 20v-5H4m11 5v-5h5"></path>
					{:else}
						<path d="M9 4H4v5m11-5h5v5M9 20H4v-5m11 5h5v-5"></path>
					{/if}
				</svg>
			</button>
		</div>
	</header>

	<div class="hud" aria-live="polite">
		<div class="hud-stat hud-stat--score">
			<span class="hud-label">KAPOTWAARDE</span>
			<strong>€{scoreFormatter.format(hud.score)}</strong>
		</div>
		<div class:urgent={hud.time <= 10 && hud.phase === 'playing'} class="hud-stat hud-stat--time">
			<span class="hud-label">TIJD</span>
			<strong>{hud.time}</strong>
		</div>
		<div class="hud-stat hud-stat--room">
			<span class="hud-label">KAMER</span>
			<strong>{hud.destroyed}/{hud.total}</strong>
		</div>
		{#if hud.combo > 1 && hud.phase === 'playing'}
			<div class="combo" aria-label={`Combo maal ${hud.combo}`}>x{hud.combo}</div>
		{/if}
	</div>
	{#key impactNonce}
		{#if impactText}
			<div class="impact-word" aria-live="assertive">{impactText}</div>
		{/if}
	{/key}

	{#if error}
		<div class="game-message game-message--error" role="alert">
			<p>{error}</p>
			<a href="/">TERUG NAAR DE GALERIE</a>
		</div>
	{:else if hud.phase === 'idle'}
		<div class="start-layer">
			<div class="start-copy">
				<p class="eyebrow">EEN KAMER VOL DURE SPULLEN</p>
				<h1>STAMP<br />ALLES<br /><span>KAPOT.</span></h1>
				<p class="intro">
					Elke vaas, lamp en Konijn kost geld. Met je dikke kont wordt dat jouw score.
				</p>
				<button class="start-button" type="button" onclick={startGame} disabled={!ready}>
					{ready ? 'KLIK: START' : 'KONIJN WORDT WAKKER…'}
				</button>
				<div class="control-hints" aria-label="Besturing">
					<span><kbd>MUIS</kbd> RICHTEN</span>
					<span><kbd>KLIK</kbd> VLOER OF MUUR</span>
					<span><kbd>AUTOMATISCH</kbd> STUITEREN</span>
					<span><kbd>SCROLL</kbd> WAPEN</span>
					<span><kbd>RECHTS</kbd> WAPENACTIE</span>
				</div>
			</div>
			<p class="start-callout">€20 VAAS? <strong>€20 PUNTEN.</strong></p>
		</div>
	{:else if hud.paused}
		<div class="pause-layer">
			<p class="eyebrow">KONIJN WACHT EVEN</p>
			<h2>PAUZE</h2>
			<button class="start-button" type="button" onclick={() => game?.togglePause()}
				>VERDER STAMPEN</button
			>
		</div>
	{:else if hud.phase === 'finished'}
		<div class="finish-layer">
			<p class="eyebrow">DE STOF DAALT NEER</p>
			<h2>€{scoreFormatter.format(hud.score)}</h2>
			<p>
				{hud.destroyed === hud.total
					? 'ALLES. IS. KAPOT.'
					: `${hud.destroyed} VAN DE ${hud.total} SPULLEN KAPOT.`}
			</p>
			<button class="start-button" type="button" onclick={startGame}>NOG EEN KEER STAMPEN</button>
			<a href="/" class="finish-link">BEKIJK DE KUNST DIE NOG HEEL IS</a>
		</div>
	{/if}

	<div class="desktop-hint" aria-hidden="true">
		<span><kbd>MUIS</kbd> richten</span>
		<span><kbd>KLIK VLAK</kbd> daar stampen</span>
		<span><kbd>SCROLL</kbd> wapen</span>
		<span><kbd>RECHTS</kbd> wapenactie</span>
		<span><kbd>AUTOMATISCH</kbd> stuiteren</span>
	</div>

	{#if hud.phase === 'playing'}
		<div class="weapon-controls" aria-label="Wapens">
			<button
				class="weapon-control weapon-select"
				type="button"
				onclick={cycleWeapon}
				disabled={hud.paused}
				aria-label={`Kies wapen. Nu geselecteerd: ${hud.weapon === 'poop' ? 'konijnenkeutels' : 'pistool'}`}
			>
				<span class="weapon-icon" aria-hidden="true">{hud.weapon === 'poop' ? '●●' : '↗'}</span>
				<span class="weapon-copy"
					><small>WAPEN</small><strong>{hud.weapon === 'poop' ? 'KEUTELS' : 'PISTOOL'}</strong
					></span
				>
			</button>
			<button
				class="weapon-control weapon-use"
				type="button"
				onpointerdown={useWeaponStart}
				onpointerup={useWeaponEnd}
				onpointercancel={useWeaponEnd}
				onlostpointercapture={useWeaponEnd}
				onclick={useWeaponKeyboard}
				disabled={hud.paused}
				aria-label={hud.weapon === 'poop'
					? 'Houd ingedrukt om konijnenkeutels te gebruiken'
					: 'Houd ingedrukt om met het pistool te schieten'}
			>
				<span aria-hidden="true">{hud.weapon === 'poop' ? '💨' : '💥'}</span>
				<strong
					>{hud.weapon === 'poop' ? 'HOUD SCHEET' : hud.weaponReady ? 'HOUD VUUR' : 'LADEN'}</strong
				>
			</button>
		</div>
	{/if}

	<button
		class="pause-button"
		type="button"
		onclick={() => game?.togglePause()}
		aria-label="Pauzeer het spel"
	>
		{hud.paused ? '▶' : 'Ⅱ'}
	</button>

	<p class="sr-only" aria-live="polite">
		Score {hud.score} euro. Nog {hud.time} seconden. {hud.destroyed} van {hud.total} voorwerpen kapot.
		Wapen: {hud.weapon === 'poop' ? 'konijnenkeutels' : 'pistool'}.
	</p>
</section>

<style>
	:global(body) {
		margin: 0;
		overflow: hidden;
		background: oklch(35% 0.03 45);
	}

	:global(*) {
		box-sizing: border-box;
	}

	.game-shell {
		--ink: oklch(25% 0.025 45);
		--cream: oklch(95% 0.035 83);
		--orange: oklch(69% 0.17 47);
		--red: oklch(60% 0.2 31);
		position: relative;
		isolation: isolate;
		width: 100%;
		height: 100dvh;
		overflow: hidden;
		background: oklch(80% 0.025 160);
		color: var(--ink);
		font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
		touch-action: none;
		user-select: none;
	}

	canvas {
		display: block;
		width: 100%;
		height: 100%;
		outline: none;
		cursor: crosshair;
		touch-action: none;
	}

	.game-nav {
		position: absolute;
		inset: 0 0 auto;
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		gap: 1rem;
		padding: 0.75rem 1rem;
		background: var(--ink);
		color: var(--cream);
		box-shadow: 0 0.18rem 0 rgba(37, 31, 27, 0.28);
		z-index: 10;
	}

	.back-link,
	.utility-actions button,
	.game-mark {
		font-size: 0.72rem;
		font-weight: 850;
		letter-spacing: 0.11em;
		text-transform: uppercase;
	}

	.back-link {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		width: fit-content;
		color: inherit;
		text-decoration: none;
	}

	.back-link span:first-child {
		font-size: 1.15rem;
		transition: transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.back-link:hover span:first-child,
	.back-link:focus-visible span:first-child {
		transform: translateX(-0.25rem);
	}

	.game-mark {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		font-family: 'Chewy', system-ui, sans-serif;
		font-size: 1.05rem;
		letter-spacing: 0.07em;
	}

	.game-mark__rabbit {
		font-size: 1.3rem;
	}

	.utility-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.35rem;
	}

	.utility-actions .utility-icon {
		display: grid;
		width: 2.35rem;
		height: 2.35rem;
		place-items: center;
		padding: 0;
	}

	.utility-icon svg {
		width: 1.2rem;
		height: 1.2rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.9;
		stroke-linecap: round;
		stroke-linejoin: round;
	}

	.utility-actions button,
	.pause-button {
		border: 1px solid oklch(95% 0.035 83 / 0.36);
		border-radius: 0.38rem;
		background: transparent;
		color: inherit;
		padding: 0.48rem 0.58rem;
		cursor: pointer;
		transition:
			background 180ms cubic-bezier(0.16, 1, 0.3, 1),
			color 180ms cubic-bezier(0.16, 1, 0.3, 1),
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.utility-actions button:hover,
	.utility-actions button:focus-visible,
	.utility-actions button.active {
		background: var(--cream);
		color: var(--ink);
		transform: translateY(-1px);
	}

	.hud {
		position: absolute;
		top: 4.25rem;
		left: 1rem;
		display: flex;
		align-items: stretch;
		gap: 0.42rem;
		z-index: 8;
		pointer-events: none;
	}

	.hud-stat {
		display: flex;
		min-width: 5.5rem;
		flex-direction: column;
		justify-content: center;
		padding: 0.58rem 0.72rem 0.52rem;
		border: 2px solid var(--ink);
		border-radius: 0.52rem;
		background: var(--cream);
		box-shadow: 0.2rem 0.2rem 0 var(--ink);
	}

	.hud-stat--score {
		min-width: 8.8rem;
		background: var(--orange);
	}

	.hud-stat--time {
		align-items: center;
		min-width: 4.4rem;
	}

	.hud-stat--time.urgent {
		background: var(--red);
		color: var(--cream);
	}

	.hud-label {
		font-size: 0.61rem;
		font-weight: 850;
		letter-spacing: 0.09em;
	}

	.hud-stat strong {
		font-family: 'Chewy', system-ui, sans-serif;
		font-size: 1.65rem;
		font-weight: 400;
		line-height: 1;
	}

	.combo {
		align-self: center;
		padding: 0.3rem 0.62rem;
		border: 2px solid var(--ink);
		border-radius: 999px;
		background: var(--red);
		color: var(--cream);
		font-family: 'Chewy', system-ui, sans-serif;
		font-size: 1.25rem;
		box-shadow: 0.16rem 0.16rem 0 var(--ink);
	}

	.start-layer,
	.pause-layer,
	.finish-layer,
	.game-message {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 5rem 1.2rem 2rem;
		background: oklch(25% 0.025 45 / 0.28);
		z-index: 7;
	}

	.start-layer {
		grid-template-columns: minmax(17rem, 31rem) minmax(10rem, 1fr);
		gap: clamp(1.5rem, 8vw, 8rem);
		justify-content: center;
	}

	.start-copy {
		justify-self: end;
		max-width: 31rem;
		padding: clamp(1.2rem, 3vw, 2.2rem);
		border: 3px solid var(--ink);
		border-radius: 0.8rem;
		background: var(--cream);
		box-shadow: 0.45rem 0.45rem 0 var(--ink);
	}

	.eyebrow {
		margin: 0 0 0.6rem;
		font-size: 0.74rem;
		font-weight: 900;
		letter-spacing: 0.14em;
		text-transform: uppercase;
	}

	.start-copy h1 {
		margin: 0;
		font-family: 'Road Rage', 'Chewy', system-ui, sans-serif;
		font-size: clamp(4rem, 9vw, 7.6rem);
		font-weight: 400;
		line-height: 0.7;
		letter-spacing: 0.015em;
	}

	.start-copy h1 span {
		color: var(--red);
	}

	.intro {
		max-width: 42ch;
		margin: 1.3rem 0 1.15rem;
		font-size: 1rem;
		font-weight: 650;
		line-height: 1.45;
	}

	.start-button {
		width: 100%;
		border: 3px solid var(--ink);
		border-radius: 0.5rem;
		background: var(--orange);
		color: var(--ink);
		padding: 0.9rem 1.2rem 0.78rem;
		font-family: 'Chewy', system-ui, sans-serif;
		font-size: 1.32rem;
		letter-spacing: 0.045em;
		box-shadow: 0.28rem 0.28rem 0 var(--ink);
		cursor: pointer;
		transition:
			transform 180ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 180ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.start-button:hover:not(:disabled),
	.start-button:focus-visible:not(:disabled) {
		transform: translate(-0.08rem, -0.08rem);
		box-shadow: 0.42rem 0.42rem 0 var(--ink);
	}

	.start-button:active:not(:disabled) {
		transform: translate(0.22rem, 0.22rem);
		box-shadow: 0.06rem 0.06rem 0 var(--ink);
	}

	.start-button:disabled {
		cursor: wait;
		opacity: 0.64;
	}

	.control-hints {
		display: flex;
		flex-wrap: wrap;
		gap: 0.7rem 1rem;
		margin-top: 1rem;
		font-size: 0.68rem;
		font-weight: 800;
		letter-spacing: 0.05em;
	}

	kbd {
		border: 1px solid var(--ink);
		border-radius: 0.28rem;
		background: oklch(88% 0.03 83);
		padding: 0.16rem 0.34rem;
		font: inherit;
		box-shadow: 0 2px 0 var(--ink);
	}

	.start-callout {
		align-self: end;
		justify-self: start;
		margin: 0 0 7vh;
		padding: 0.65rem 0.9rem;
		transform: rotate(-4deg);
		border: 2px solid var(--ink);
		background: var(--cream);
		font-family: 'Caveat Brush', system-ui, sans-serif;
		font-size: clamp(1.4rem, 3vw, 2.2rem);
		box-shadow: 0.28rem 0.28rem 0 var(--ink);
	}

	.pause-layer,
	.finish-layer,
	.game-message {
		align-content: center;
		background: oklch(25% 0.025 45 / 0.74);
		color: var(--cream);
		text-align: center;
	}

	.pause-layer h2,
	.finish-layer h2 {
		margin: 0;
		font-family: 'Road Rage', 'Chewy', system-ui, sans-serif;
		font-size: clamp(5rem, 14vw, 10rem);
		font-weight: 400;
		line-height: 0.85;
	}

	.pause-layer .start-button,
	.finish-layer .start-button {
		max-width: 22rem;
		margin-top: 1.2rem;
	}

	.finish-layer p:not(.eyebrow) {
		margin: 0.7rem 0 0;
		font-weight: 850;
		letter-spacing: 0.08em;
	}

	.finish-link,
	.game-message a {
		margin-top: 1.4rem;
		color: var(--cream);
		font-size: 0.75rem;
		font-weight: 850;
		letter-spacing: 0.1em;
	}

	.impact-word {
		position: absolute;
		top: 24%;
		left: 50%;
		min-width: max-content;
		transform: translateX(-50%) rotate(-3deg);
		color: var(--cream);
		font-family: 'Road Rage', 'Chewy', system-ui, sans-serif;
		font-size: clamp(2.7rem, 8vw, 6.4rem);
		line-height: 0.9;
		text-align: center;
		-webkit-text-stroke: 2px var(--ink);
		filter: drop-shadow(0.28rem 0.28rem 0 var(--ink));
		animation: impact 950ms cubic-bezier(0.16, 1, 0.3, 1) both;
		z-index: 9;
		pointer-events: none;
	}

	@keyframes impact {
		0% {
			opacity: 0;
			transform: translate(-50%, 2rem) rotate(-8deg) scale(0.62);
		}
		18% {
			opacity: 1;
			transform: translate(-50%, 0) rotate(2deg) scale(1.12);
		}
		72% {
			opacity: 1;
			transform: translate(-50%, -0.6rem) rotate(-2deg) scale(1);
		}
		100% {
			opacity: 0;
			transform: translate(-50%, -2rem) rotate(1deg) scale(0.94);
		}
	}

	.desktop-hint {
		position: absolute;
		bottom: 1rem;
		left: 1rem;
		display: flex;
		gap: 0.8rem;
		padding: 0.58rem 0.72rem;
		border: 1px solid oklch(25% 0.025 45 / 0.24);
		border-radius: 0.42rem;
		background: oklch(95% 0.035 83 / 0.88);
		font-size: 0.67rem;
		font-weight: 750;
		z-index: 6;
	}

	.weapon-controls {
		position: absolute;
		bottom: 1rem;
		left: 50%;
		display: flex;
		gap: 0.5rem;
		transform: translateX(-50%);
		z-index: 9;
	}

	.weapon-control {
		display: flex;
		height: 3.05rem;
		align-items: center;
		justify-content: center;
		gap: 0.55rem;
		border: 2px solid var(--ink);
		border-radius: 0.52rem;
		background: var(--cream);
		color: var(--ink);
		box-shadow: 0.18rem 0.18rem 0 var(--ink);
		cursor: pointer;
		font-family: inherit;
		transition:
			transform 160ms cubic-bezier(0.16, 1, 0.3, 1),
			box-shadow 160ms cubic-bezier(0.16, 1, 0.3, 1),
			opacity 160ms cubic-bezier(0.16, 1, 0.3, 1);
	}

	.weapon-control:hover:not(:disabled),
	.weapon-control:focus-visible:not(:disabled) {
		transform: translateY(-0.12rem);
		box-shadow: 0.22rem 0.28rem 0 var(--ink);
	}

	.weapon-control:active:not(:disabled) {
		transform: translate(0.08rem, 0.08rem);
		box-shadow: 0.05rem 0.05rem 0 var(--ink);
	}

	.weapon-control:disabled {
		cursor: not-allowed;
		opacity: 0.56;
	}

	.weapon-select {
		min-width: 9.5rem;
		justify-content: flex-start;
		padding: 0.34rem 0.55rem;
	}

	.weapon-icon {
		display: grid;
		width: 2rem;
		height: 2rem;
		place-items: center;
		border-radius: 0.35rem;
		background: oklch(88% 0.03 83);
		font-size: 0.82rem;
		font-weight: 950;
		letter-spacing: -0.12em;
	}

	.weapon-copy {
		display: flex;
		min-width: 4.25rem;
		flex-direction: column;
		align-items: flex-start;
		line-height: 1;
	}

	.weapon-copy small {
		font-size: 0.5rem;
		font-weight: 800;
		letter-spacing: 0.1em;
	}

	.weapon-copy strong,
	.weapon-use strong {
		font-size: 0.72rem;
		font-weight: 950;
		letter-spacing: 0.04em;
	}

	.weapon-use {
		min-width: 7.7rem;
		padding: 0.34rem 0.6rem;
		background: var(--orange);
	}

	.weapon-use > span {
		font-size: 1.15rem;
	}

	.pause-button {
		position: absolute;
		right: 1rem;
		bottom: 1rem;
		width: 2.8rem;
		height: 2.8rem;
		border: 2px solid var(--ink);
		background: var(--cream);
		color: var(--ink);
		font-size: 1rem;
		font-weight: 900;
		box-shadow: 0.18rem 0.18rem 0 var(--ink);
		z-index: 9;
	}

	.sr-only {
		position: absolute;
		width: 1px;
		height: 1px;
		padding: 0;
		margin: -1px;
		overflow: hidden;
		clip: rect(0, 0, 0, 0);
		white-space: nowrap;
		border: 0;
	}

	button:focus-visible,
	a:focus-visible {
		outline: 3px solid var(--orange);
		outline-offset: 3px;
	}

	@media (max-width: 760px) {
		.game-nav {
			grid-template-columns: auto 1fr auto;
			padding: 0.55rem 0.65rem;
		}

		.back-link span:last-child,
		.game-mark__rabbit {
			display: none;
		}

		.game-mark {
			justify-self: center;
			font-size: 0.92rem;
		}

		.utility-actions .utility-icon {
			width: 2.2rem;
			height: 2.2rem;
		}

		.hud {
			top: 3.7rem;
			left: 0.55rem;
			gap: 0.3rem;
		}

		.hud-stat {
			min-width: 3.5rem;
			padding: 0.42rem 0.5rem 0.38rem;
			box-shadow: 0.12rem 0.12rem 0 var(--ink);
		}

		.hud-stat--score {
			min-width: 7rem;
		}

		.hud-label {
			font-size: 0.49rem;
		}

		.hud-stat strong {
			font-size: 1.35rem;
		}

		.start-layer {
			grid-template-columns: 1fr;
			align-content: center;
			padding-top: 4.5rem;
		}

		.start-copy {
			justify-self: center;
			max-width: min(92vw, 28rem);
		}

		.start-copy h1 {
			font-size: clamp(4.3rem, 22vw, 6rem);
		}

		.start-callout,
		.desktop-hint {
			display: none;
		}

		.weapon-controls {
			bottom: 0.75rem;
			flex-direction: column;
			align-items: center;
			gap: 0.35rem;
		}

		.weapon-control {
			height: 2.7rem;
			box-shadow: 0.13rem 0.13rem 0 var(--ink);
		}

		.weapon-select {
			min-width: 7.25rem;
			padding: 0.25rem 0.42rem;
		}

		.weapon-icon {
			width: 1.65rem;
			height: 1.65rem;
			font-size: 0.7rem;
		}

		.weapon-copy {
			min-width: 3.8rem;
		}

		.weapon-copy small {
			display: none;
		}

		.weapon-use {
			min-width: 6.2rem;
			height: 3.15rem;
			padding: 0.25rem 0.5rem;
		}

		.pause-button {
			top: 7.2rem;
			right: 0.65rem;
			bottom: auto;
			width: 2.45rem;
			height: 2.45rem;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			animation-duration: 1ms !important;
			animation-iteration-count: 1 !important;
			transition-duration: 1ms !important;
		}
	}
</style>
