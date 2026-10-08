<script setup lang="ts">
import { pinia } from "@/stores";
import { useAppInfoStore } from "@/stores/appInfo";
import { useTheme } from "@/use/theme";
import { computed } from "vue";

const { THEMES, currentTheme } = useTheme();
const appInfoStore = useAppInfoStore(pinia);

const hasSlimSidebar = computed(() => appInfoStore.hasSlimSidebar);
</script>

<template>
	<div
		class="flex items-center justify-center gap-3 pb-6"
		:class="{ 'h-auto flex-col pb-6': hasSlimSidebar }"
		aria-label="theme selector"
	>
		<button
			v-for="theme of THEMES"
			:key="theme"
			type="button"
			:aria-label="`Select ${theme} theme`"
			:aria-pressed="currentTheme === theme"
			class="size-8 cursor-pointer rounded-full border border-neutral-500 transition-[border-width] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
			:class="{
				'border-[3px]': currentTheme === theme,
				'bg-white': theme === 'light',
				'bg-[#141414]': theme === 'dark',
				'bg-[#460eaf]': theme === 'purple',
			}"
			@click="currentTheme = theme"
		/>
	</div>
</template>
