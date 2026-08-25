import { describe, expect, it, vi } from "vitest";

import type { RuntimeBoardCard, RuntimeBoardData } from "../../../src/core/api-contract";
import { type CreateKanbanApiDependencies, createKanbanApi } from "../../../src/trpc/kanban-api";

function createCard(
	overrides: Partial<RuntimeBoardCard> & { id: string; title: string; prompt: string },
): RuntimeBoardCard {
	return {
		startInPlanMode: false,
		baseRef: "main",
		createdAt: 0,
		updatedAt: 0,
		...overrides,
	};
}

function createEmptyBoard(): RuntimeBoardData {
	return {
		columns: [
			{ id: "backlog", title: "Backlog", cards: [] },
			{ id: "in_progress", title: "In Progress", cards: [] },
			{ id: "review", title: "Review", cards: [] },
			{ id: "trash", title: "Done", cards: [] },
		],
		dependencies: [],
	};
}

function createDefaultDeps(overrides: Partial<CreateKanbanApiDependencies> = {}): CreateKanbanApiDependencies {
	return {
		listProjectsLight: vi.fn(async () => []),
		loadWorkspaceBoard: vi.fn(async () => createEmptyBoard()),
		warn: vi.fn(),
		...overrides,
	};
}

describe("getAggregateState", () => {
	it("returns an empty result when there are no projects", async () => {
		const api = createKanbanApi(createDefaultDeps());
		const result = await api.getAggregateState();
		expect(result).toEqual({ cards: [], failedProjectIds: [] });
	});

	it("merges cards from every project, tagging each with projectId, projectName, and columnId", async () => {
		const boardsByWorkspaceId: Record<string, RuntimeBoardData> = {
			"project-a": {
				...createEmptyBoard(),
				columns: [
					{
						id: "backlog",
						title: "Backlog",
						cards: [createCard({ id: "task-1", title: "Task 1", prompt: "do thing" })],
					},
					{ id: "in_progress", title: "In Progress", cards: [] },
					{ id: "review", title: "Review", cards: [] },
					{ id: "trash", title: "Done", cards: [] },
				],
			},
			"project-b": {
				...createEmptyBoard(),
				columns: [
					{ id: "backlog", title: "Backlog", cards: [] },
					{
						id: "review",
						title: "Review",
						cards: [createCard({ id: "task-2", title: "Task 2", prompt: "do other thing" })],
					},
					{ id: "in_progress", title: "In Progress", cards: [] },
					{ id: "trash", title: "Done", cards: [] },
				],
			},
		};
		const deps = createDefaultDeps({
			listProjectsLight: vi.fn(async () => [
				{ id: "project-a", path: "/repos/a", name: "a" },
				{ id: "project-b", path: "/repos/b", name: "b" },
			]),
			loadWorkspaceBoard: vi.fn(
				async (workspaceId: string) => boardsByWorkspaceId[workspaceId] ?? createEmptyBoard(),
			),
		});
		const api = createKanbanApi(deps);
		const result = await api.getAggregateState();
		expect(result.failedProjectIds).toEqual([]);
		expect(result.cards).toHaveLength(2);
		expect(result.cards).toContainEqual(
			expect.objectContaining({ id: "task-1", projectId: "project-a", projectName: "a", columnId: "backlog" }),
		);
		expect(result.cards).toContainEqual(
			expect.objectContaining({ id: "task-2", projectId: "project-b", projectName: "b", columnId: "review" }),
		);
	});

	it("records a project as failed and warns, without throwing, when its board fails to load", async () => {
		const warn = vi.fn();
		const deps = createDefaultDeps({
			listProjectsLight: vi.fn(async () => [
				{ id: "good-project", path: "/repos/good", name: "good" },
				{ id: "broken-project", path: "/repos/broken", name: "broken" },
			]),
			loadWorkspaceBoard: vi.fn(async (workspaceId: string) => {
				if (workspaceId === "broken-project") {
					throw new Error("board.json is corrupt");
				}
				return createEmptyBoard();
			}),
			warn,
		});
		const api = createKanbanApi(deps);
		const result = await api.getAggregateState();
		expect(result.failedProjectIds).toEqual(["broken-project"]);
		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("broken-project"));
		expect(warn).toHaveBeenCalledWith(expect.stringContaining("board.json is corrupt"));
	});
});
