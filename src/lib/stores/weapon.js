import { writable } from 'svelte/store';

// Check if localStorage is available
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Retrieve the initial value from localStorage or default to 0
const storedWeapon = isBrowser ? localStorage.getItem('currentWeapon') : null;
const initialWeapon = storedWeapon ? parseInt(storedWeapon, 10) : 0;

export const currentWeapon = writable(initialWeapon);

// Subscribe to changes and update localStorage
if (isBrowser) {
	currentWeapon.subscribe((value) => {
		localStorage.setItem('currentWeapon', value.toString());
	});	
}
