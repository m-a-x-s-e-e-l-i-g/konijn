import { writable } from 'svelte/store';

// Check if localStorage is available
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Retrieve the initial value from localStorage or default to 0
const storedBounceCount = isBrowser ? localStorage.getItem('bounceCount') : null;
const initialBounceCount = storedBounceCount ? parseInt(storedBounceCount, 10) : 0;

export const bounceCount = writable(initialBounceCount);

// Subscribe to changes and update localStorage
if (isBrowser) {
	bounceCount.subscribe((value) => {
		localStorage.setItem('bounceCount', value.toString());
	});
}
