import type { Listener } from "@/types/listener.js";
import { DownloadObject } from "./DownloadObject.js";

export class Collection extends DownloadObject {
	collection: any;

	constructor(obj) {
		super(obj);
		this.collection = obj.collection;
		this.__type__ = "Collection";
	}

	override toDict() {
		const item = super.toDict();

		return { ...item, collection: this.collection };
	}

	completeTrackProgress(listener: Listener) {
		this.progressNext += (1 / this.size) * 100;
		this.updateProgress(listener);
	}

	removeTrackProgress(listener: Listener) {
		this.progressNext -= (1 / this.size) * 100;
		this.updateProgress(listener);
	}
}

export class Convertable<T = any> extends Collection {
	plugin: string;
	conversionData: T[];

	constructor(obj) {
		super(obj);
		this.plugin = obj.plugin;
		this.conversionData = obj.conversion_data;
		this.__type__ = "Convertable";
	}

	override toDict() {
		const item = super.toDict();

		return {
			...item,
			plugin: this.plugin,
			conversion_data: this.conversionData,
		};
	}
}
