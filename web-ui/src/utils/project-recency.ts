import { LocalStorageKey, readLocalStorageItem, writeLocalStorageItem } from "@/storage/local-storage-store";

type ProjectRecencyMap = Record<string, number>;

function readRecencyMap(): ProjectRecencyMap {
	const raw = readLocalStorageItem(LocalStorageKey.ProjectRecency);
	if (!raw) {
		return {};
	}
	try {
		const parsed: unknown = JSON.parse(raw);
		if (parsed && typeof parsed === "object") {
			return parsed as ProjectRecencyMap;
		}
	} catch {
		// Ignore malformed storage payloads.
	}
	return {};
}

export function touchProjectRecency(projectId: string): void {
	const map = readRecencyMap();
	map[projectId] = Date.now();
	writeLocalStorageItem(LocalStorageKey.ProjectRecency, JSON.stringify(map));
}

export function sortProjectsByRecency<T extends { id: string; path: string }>(projects: T[]): T[] {
	const map = readRecencyMap();
	return [...projects].sort((a, b) => {
		const aTime = map[a.id] ?? 0;
		const bTime = map[b.id] ?? 0;
		if (aTime !== bTime) {
			return bTime - aTime;
		}
		return a.path.localeCompare(b.path);
	});
}
