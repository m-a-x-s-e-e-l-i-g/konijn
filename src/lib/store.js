import { writable } from 'svelte/store';
import { toast } from 'svelte-sonner';
import { Howl } from 'howler';

// Check if localStorage is available
const isBrowser = typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

// Retrieve the initial value from localStorage or default to 0
const storedBounceCount = isBrowser ? localStorage.getItem('bounceCount') : null;
const initialBounceCount = storedBounceCount ? parseInt(storedBounceCount, 10) : 0;

export const bounceCount = writable(initialBounceCount);

// Achievement goals
const achievementGoals = [50, 100, 250, 1000, 10000, 100000, 1000000];

var achievementSound = new Howl({
	src: ['/audio/achievement.mp3']
});

// Subscribe to changes and update localStorage
if (isBrowser) {
	bounceCount.subscribe((value) => {
		localStorage.setItem('bounceCount', value.toString());

		// Check for achievements
		if (achievementGoals.includes(value)) {
			achievementSound.play();
			toast(`🏆 Achievement unlocked: ${value} bounces!`);
		}
	});	
}
