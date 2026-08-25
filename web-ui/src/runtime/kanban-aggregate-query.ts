import { getRuntimeTrpcClient } from "@/runtime/trpc-client";
import type { RuntimeKanbanAggregateStateResponse } from "@/runtime/types";

export async function fetchKanbanAggregateState(): Promise<RuntimeKanbanAggregateStateResponse> {
	const trpcClient = getRuntimeTrpcClient(null);
	return await trpcClient.kanban.getAggregateState.query();
}
