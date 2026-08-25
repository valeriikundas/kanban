import type { RuntimeBoardData, RuntimeKanbanAggregateStateResponse } from "../core/api-contract";
import type { RuntimeTrpcContext } from "./app-router";

export interface CreateKanbanApiDependencies {
	listProjectsLight: () => Promise<Array<{ id: string; path: string; name: string }>>;
	loadWorkspaceBoard: (workspaceId: string) => Promise<RuntimeBoardData>;
	warn: (message: string) => void;
}

export function createKanbanApi(deps: CreateKanbanApiDependencies): RuntimeTrpcContext["kanbanApi"] {
	return {
		getAggregateState: async () => {
			const projects = await deps.listProjectsLight();
			const failedProjectIds: string[] = [];
			const cardsByProject = await Promise.all(
				projects.map(async (project) => {
					try {
						const board = await deps.loadWorkspaceBoard(project.id);
						return board.columns.flatMap((column) =>
							column.cards.map((card) => ({
								...card,
								projectId: project.id,
								projectName: project.name,
								columnId: column.id,
							})),
						);
					} catch (error) {
						const reason = error instanceof Error ? error.message : String(error);
						deps.warn(
							`Failed to load workspace board for project ${project.id} in aggregate kanban view. ${reason}`,
						);
						failedProjectIds.push(project.id);
						return [];
					}
				}),
			);
			return {
				cards: cardsByProject.flat(),
				failedProjectIds,
			} satisfies RuntimeKanbanAggregateStateResponse;
		},
	};
}
