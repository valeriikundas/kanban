import { useCallback, useEffect, useRef, useState } from "react";
import { fetchKanbanAggregateState } from "@/runtime/kanban-aggregate-query";
import type { RuntimeKanbanAggregateStateResponse } from "@/runtime/types";
import { useDocumentEvent, useInterval } from "@/utils/react-use";

const POLL_INTERVAL_MS = 15000;

export interface UseKanbanAggregateStateResult {
	cards: RuntimeKanbanAggregateStateResponse["cards"];
	failedProjectIds: string[];
	isLoading: boolean;
	error: Error | null;
	refresh: () => void;
}

export function useKanbanAggregateState(enabled: boolean): UseKanbanAggregateStateResult {
	const [state, setState] = useState<RuntimeKanbanAggregateStateResponse | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<Error | null>(null);
	const latestRequestIdRef = useRef(0);
	const enabledRef = useRef(enabled);
	enabledRef.current = enabled;

	const load = useCallback(() => {
		if (!enabled) {
			return;
		}
		const requestId = ++latestRequestIdRef.current;
		setIsLoading(true);
		fetchKanbanAggregateState()
			.then((response) => {
				if (latestRequestIdRef.current !== requestId || !enabledRef.current) {
					return;
				}
				setState(response);
				setError(null);
			})
			.catch((caughtError: unknown) => {
				if (latestRequestIdRef.current !== requestId || !enabledRef.current) {
					return;
				}
				setError(caughtError instanceof Error ? caughtError : new Error(String(caughtError)));
			})
			.finally(() => {
				if (latestRequestIdRef.current === requestId) {
					setIsLoading(false);
				}
			});
	}, [enabled]);

	useEffect(() => {
		load();
	}, [load]);

	useInterval(load, enabled ? POLL_INTERVAL_MS : null);

	useDocumentEvent("visibilitychange", () => {
		if (enabled && document.visibilityState === "visible") {
			load();
		}
	});

	return {
		cards: state?.cards ?? [],
		failedProjectIds: state?.failedProjectIds ?? [],
		isLoading,
		error,
		refresh: load,
	};
}
