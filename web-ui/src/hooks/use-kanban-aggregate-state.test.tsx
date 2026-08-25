import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RuntimeKanbanAggregateStateResponse } from "@/runtime/types";
import { type UseKanbanAggregateStateResult, useKanbanAggregateState } from "./use-kanban-aggregate-state";

const kanbanAggregateQueryMocks = vi.hoisted(() => ({
	fetchKanbanAggregateState: vi.fn<() => Promise<RuntimeKanbanAggregateStateResponse>>(),
}));

vi.mock("@/runtime/kanban-aggregate-query", () => ({
	fetchKanbanAggregateState: kanbanAggregateQueryMocks.fetchKanbanAggregateState,
}));

function createResponse(
	overrides: Partial<RuntimeKanbanAggregateStateResponse> = {},
): RuntimeKanbanAggregateStateResponse {
	return {
		cards: [],
		failedProjectIds: [],
		...overrides,
	};
}

describe("useKanbanAggregateState", () => {
	let container: HTMLDivElement;
	let root: Root;
	let previousActEnvironment: boolean | undefined;

	beforeEach(() => {
		kanbanAggregateQueryMocks.fetchKanbanAggregateState.mockReset();
		container = document.createElement("div");
		document.body.appendChild(container);
		root = createRoot(container);
		previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean })
			.IS_REACT_ACT_ENVIRONMENT;
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
	});

	afterEach(() => {
		act(() => {
			root.unmount();
		});
		container.remove();
		vi.restoreAllMocks();
		if (previousActEnvironment === undefined) {
			delete (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
			return;
		}
		(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT =
			previousActEnvironment;
	});

	async function renderHook(
		initialEnabled: boolean,
	): Promise<{ getState: () => UseKanbanAggregateStateResult; setEnabled: (enabled: boolean) => Promise<void> }> {
		let hookResult: UseKanbanAggregateStateResult | null = null;
		let setEnabledState: ((enabled: boolean) => void) | null = null;

		function HookHarness({ enabled }: { enabled: boolean }): null {
			hookResult = useKanbanAggregateState(enabled);
			return null;
		}

		function Harness(): React.ReactElement {
			const [enabled, setEnabled] = useState(initialEnabled);
			setEnabledState = setEnabled;
			return <HookHarness enabled={enabled} />;
		}

		await act(async () => {
			root.render(<Harness />);
			await Promise.resolve();
			await Promise.resolve();
		});

		return {
			getState: () => {
				if (!hookResult) {
					throw new Error("Hook state not available");
				}
				return hookResult;
			},
			setEnabled: async (enabled: boolean) => {
				await act(async () => {
					setEnabledState?.(enabled);
					await Promise.resolve();
					await Promise.resolve();
				});
			},
		};
	}

	it("does not fetch when disabled", async () => {
		const { getState } = await renderHook(false);

		expect(kanbanAggregateQueryMocks.fetchKanbanAggregateState).not.toHaveBeenCalled();
		expect(getState().cards).toEqual([]);
	});

	it("fetches and surfaces cards when enabled", async () => {
		kanbanAggregateQueryMocks.fetchKanbanAggregateState.mockResolvedValue(
			createResponse({ cards: [{ id: "task-1" } as RuntimeKanbanAggregateStateResponse["cards"][number]] }),
		);

		const { getState } = await renderHook(true);

		expect(getState().cards).toHaveLength(1);
		expect(getState().error).toBeNull();
	});

	it("surfaces an error when the fetch rejects", async () => {
		kanbanAggregateQueryMocks.fetchKanbanAggregateState.mockRejectedValue(new Error("network down"));

		const { getState } = await renderHook(true);

		expect(getState().error?.message).toBe("network down");
	});

	it("ignores a stale in-flight response that resolves after a newer request was issued", async () => {
		let resolveFirst: ((response: RuntimeKanbanAggregateStateResponse) => void) | null = null;
		const firstResponsePromise = new Promise<RuntimeKanbanAggregateStateResponse>((resolve) => {
			resolveFirst = resolve;
		});
		kanbanAggregateQueryMocks.fetchKanbanAggregateState
			.mockReturnValueOnce(firstResponsePromise)
			.mockResolvedValueOnce(
				createResponse({ cards: [{ id: "fresh-task" } as RuntimeKanbanAggregateStateResponse["cards"][number]] }),
			);

		const { getState } = await renderHook(true);

		await act(async () => {
			getState().refresh();
			await Promise.resolve();
		});

		expect(getState().cards).toEqual([{ id: "fresh-task" }]);

		await act(async () => {
			resolveFirst?.(
				createResponse({ cards: [{ id: "stale-task" } as RuntimeKanbanAggregateStateResponse["cards"][number]] }),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(getState().cards).toEqual([{ id: "fresh-task" }]);
	});

	it("ignores a response that resolves after the view has been disabled", async () => {
		let resolveFetch: ((response: RuntimeKanbanAggregateStateResponse) => void) | null = null;
		kanbanAggregateQueryMocks.fetchKanbanAggregateState.mockReturnValue(
			new Promise<RuntimeKanbanAggregateStateResponse>((resolve) => {
				resolveFetch = resolve;
			}),
		);

		const { getState, setEnabled } = await renderHook(true);

		await setEnabled(false);

		await act(async () => {
			resolveFetch?.(
				createResponse({ cards: [{ id: "late-task" } as RuntimeKanbanAggregateStateResponse["cards"][number]] }),
			);
			await Promise.resolve();
			await Promise.resolve();
		});

		expect(getState().cards).toEqual([]);
	});
});
