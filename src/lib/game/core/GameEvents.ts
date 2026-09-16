import type { StampHudState } from '../types';

export interface GameEventMap {
	hud: StampHudState;
	impact: { label: string; value: number };
	feedback: { message: string };
	sewerIntro: { active: boolean };
	ready: undefined;
	error: { message: string };
}

type GameEventName = keyof GameEventMap;
type GameEventListener<EventName extends GameEventName> = (
	payload: GameEventMap[EventName]
) => void;

export class GameEvents {
	private listeners = new Map<GameEventName, Set<(payload: never) => void>>();

	on<EventName extends GameEventName>(
		eventName: EventName,
		listener: GameEventListener<EventName>
	) {
		const listeners = this.listeners.get(eventName) ?? new Set<(payload: never) => void>();
		listeners.add(listener as (payload: never) => void);
		this.listeners.set(eventName, listeners);
		return () => listeners.delete(listener as (payload: never) => void);
	}

	emit<EventName extends GameEventName>(eventName: EventName, payload: GameEventMap[EventName]) {
		for (const listener of this.listeners.get(eventName) ?? []) {
			listener(payload as never);
		}
	}

	clear() {
		this.listeners.clear();
	}
}
