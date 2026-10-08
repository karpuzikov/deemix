import { ref, watch } from "vue";

const THEMES = {
	dark: "dark",
	light: "light",
	purple: "purple",
};

const initialTheme =
	localStorage.getItem("selectedTheme") ||
	document.documentElement.dataset.theme ||
	THEMES.dark;
const currentTheme = ref(initialTheme);

watch(currentTheme, (newTheme, oldTheme) => {
	// No operation needed
	if (oldTheme === newTheme) return;

	localStorage.setItem("selectedTheme", newTheme);
	document.documentElement.dataset.theme = newTheme;

});

export const useTheme = () => ({
	THEMES,
	currentTheme,
});
