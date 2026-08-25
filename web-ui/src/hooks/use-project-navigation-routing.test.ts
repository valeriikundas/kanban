import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { type UseProjectNavigationResult, useProjectNavigation } from "@/hooks/use-project-navigation";
import type { RuntimeProjectSummary } from "@/runtime/types";

const runtimeStateStreamMocks = vi.hoisted(() => ({
	currentProjectId: null as string | null,
	projects: [] as RuntimeProjectSummary[],
}));

vi.mock("@/runtime/use-runtime-state-stream", () => ({
	useRuntimeStateStream: (_requestedProjectId: string | null) => ({
		currentProjectId: runtimeStateStreamMocks.currentProjectId,
		projects: runtimeStateStreamMocks.projects,
		workspaceState: null,
		workspaceMetadata: null,
		latestTaskChatMessage: null,
		taskChatMessagesByTaskId: {},
		latestTaskReadyForReview: null,
		latestMcpAuthStatuses: null,
		clineSessionContextVersion: 0,
		streamError: null,
		isRuntimeDisconnected: false,
		hasReceivedSnapshot: true,
	}),
}));

describe("useProjectNavigation URL routing", () => {
	let container: HTMLDivElement;
	let root: Root;
	let previousActEnvironment: boolean | undefined;

	beforeEach(() => {
		runtimeStateStreamMocks.currentProjectId = "project-a";
		runtimeStateStreamMocks.projects = [
			{ id: "project-a", path: "/repos/a", name: "a" } as RuntimeProjectSummary,
			{ id: "project-b", path: "/repos/b", name: "b" } as RuntimeProjectSummary,
		];
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
		window.history.replaceState({}, "", "/");
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		vi.restoreAllMocks();
		window.history.replaceState({}, "", "/");
		if (previousActEnvironment === undefined) {
			delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
			return;
		}
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
			previousActEnvironment;
	});

	async function renderHook(initialIsAllProjectsViewOpen: boolean): Promise<{
		getResult: () => UseProjectNavigationResult;
		setIsAllProjectsViewOpen: (open: boolean) => Promise<void>;
		onAllProjectsViewOpenChangeRequested: ReturnType<typeof vi.fn>;
	}> {
		let hookResult: UseProjectNavigationResult | null = null;
		const onProjectSwitchStart = vi.fn();
		const onAllProjectsViewOpenChangeRequested = vi.fn();
		let isAllProjectsViewOpen = initialIsAllProjectsViewOpen;

		function HookHarness(): null {
			hookResult = useProjectNavigation({
				onProjectSwitchStart,
				isAllProjectsViewOpen,
				onAllProjectsViewOpenChangeRequested,
			});
			return null;
		}

		async function rerender(): Promise<void> {
			await act(async () => {
				root.render(createElement(HookHarness));
				await Promise.resolve();
			});
		}

		await rerender();

		return {
			getResult: () => {
				if (!hookResult) {
					throw new Error("Hook result not available");
				}
				return hookResult;
			},
			setIsAllProjectsViewOpen: async (open: boolean) => {
				isAllProjectsViewOpen = open;
				await rerender();
			},
			onAllProjectsViewOpenChangeRequested,
		};
	}

	it("syncs the URL to /<projectId> once the current project resolves", async () => {
		await renderHook(false);

		expect(window.location.pathname).toBe("/project-a");
	});

	it("syncs the URL to /all while the All Projects view is open, without clobbering it with the project id", async () => {
		await renderHook(true);

		expect(window.location.pathname).toBe("/all");
	});

	it("restores /<projectId> when the All Projects view closes", async () => {
		const { setIsAllProjectsViewOpen } = await renderHook(true);
		expect(window.location.pathname).toBe("/all");

		await setIsAllProjectsViewOpen(false);

		expect(window.location.pathname).toBe("/project-a");
	});

	it("requests opening the All Projects view on popstate to /all", async () => {
		const { onAllProjectsViewOpenChangeRequested } = await renderHook(false);

		await act(async () => {
			window.history.pushState({}, "", "/all");
			window.dispatchEvent(new PopStateEvent("popstate"));
			await Promise.resolve();
		});

		expect(onAllProjectsViewOpenChangeRequested).toHaveBeenCalledWith(true);
	});

	it("requests closing the All Projects view and updates the requested project on popstate to a project path", async () => {
		const { getResult, onAllProjectsViewOpenChangeRequested } = await renderHook(true);

		await act(async () => {
			window.history.pushState({}, "", "/project-b");
			window.dispatchEvent(new PopStateEvent("popstate"));
			await Promise.resolve();
		});

		expect(onAllProjectsViewOpenChangeRequested).toHaveBeenCalledWith(false);
		expect(getResult().requestedProjectId).toBe("project-b");
	});
});
