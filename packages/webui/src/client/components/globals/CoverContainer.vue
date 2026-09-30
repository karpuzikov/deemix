<script setup lang="ts">
import { sendAddToQueueWithFolder } from "@/utils/downloads";
import { useI18n } from "vue-i18n";

const { t } = useI18n();

interface Props {
	cover: string;
	isRounded?: boolean;
	isCircle?: boolean;
	link: string;
}

const props = defineProps<Props>();

const canChooseFolder =
	typeof window !== "undefined" && typeof window.api?.invoke === "function";

async function downloadToFolder() {
	await sendAddToQueueWithFolder(props.link);
}
</script>

<template>
	<div class="cover-container group relative">
		<img
			aria-hidden="true"
			class="coverart block w-full opacity-100"
			:class="{ rounded: isRounded, 'rounded-full': isCircle }"
			:src="cover"
		/>

		<div class="download_actions absolute flex gap-2 opacity-0">
			<button
				role="button"
				aria-label="download"
				:data-link="link"
				class="download_overlay hover:bg-primary rounded-full border-0 bg-black p-0 text-center"
				tabindex="0"
				v-bind="$attrs"
			>
				<i
					class="material-icons cursor-pointer text-white"
					:title="t('globals.download_hint')"
					>get_app</i
				>
			</button>
			<button
				v-if="canChooseFolder"
				type="button"
				aria-label="download to folder"
				class="download_overlay hover:bg-primary rounded-full border-0 bg-black p-0 text-center"
				:title="t('globals.download_to_folder')"
				@click.stop.prevent="downloadToFolder"
			>
				<i class="material-icons cursor-pointer text-white">folder_open</i>
			</button>
		</div>
	</div>
</template>

<style scoped>
.cover-container {
	width: 156px;
	height: 156px;
	margin: 0px auto 10px;
}
.cover-container .coverart {
	backface-visibility: hidden;
	transition: 0.5s ease;
	height: auto;
}
.cover-container .download_actions {
	top: 50%;
	left: 50%;
	transform: translate(-50%, -50%);
	transition: 0.5s ease;
}
.cover-container .download_overlay {
	min-width: 2.75rem;
	height: 2.75rem;
	text-align: center;
}
.cover-container .download_overlay i {
	padding: 0.625rem;
}
.cover-container .download_actions:focus-within {
	opacity: 1;
}
.cover-container:hover .coverart {
	opacity: 0.75;
}
.cover-container:hover .download_actions {
	opacity: 1;
}
.cover-container:hover .download_overlay {
	border: 0;
}
</style>
