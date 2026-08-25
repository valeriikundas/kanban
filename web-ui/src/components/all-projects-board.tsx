import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { RuntimeBoardColumnId, RuntimeKanbanAggregateCard } from "@/runtime/types";
import { normalizePromptForDisplay, truncateTaskPromptLabel } from "@/utils/task-prompt";

const ALL_PROJECTS_COLUMN_ORDER: Array<{ id: RuntimeBoardColumnId; title: string }> = [
	{ id: "backlog", title: "Backlog" },
	{ id: "in_progress", title: "In Progress" },
	{ id: "review", title: "Review" },
	{ id: "trash", title: "Done" },
];

export function AllProjectsBoard({
	cards,
	failedProjectIds,
	isLoading,
	error,
	onRetry,
	onOpenCard,
}: {
	cards: RuntimeKanbanAggregateCard[];
	failedProjectIds: string[];
	isLoading: boolean;
	error: Error | null;
	onRetry: () => void;
	onOpenCard: (projectId: string, taskId: string) => void;
}): React.ReactElement {
	return (
		<div className="flex flex-1 min-h-0 min-w-0 flex-col">
			{error ? (
				<div className="flex items-center gap-2 border-b border-border bg-surface-1 px-4 py-2 text-[13px] text-status-red">
					<AlertTriangle size={14} />
					<span className="flex-1">Couldn&apos;t load the all-projects board. {error.message}</span>
					<Button variant="ghost" size="sm" onClick={onRetry}>
						Retry
					</Button>
				</div>
			) : failedProjectIds.length > 0 ? (
				<div className="flex items-center gap-2 border-b border-border bg-surface-1 px-4 py-2 text-[13px] text-status-orange">
					<AlertTriangle size={14} />
					<span>
						Couldn&apos;t load {failedProjectIds.length} project{failedProjectIds.length === 1 ? "" : "s"}.
						Showing the rest.
					</span>
				</div>
			) : null}
			<div className="flex flex-1 min-h-0 min-w-0 gap-3 overflow-x-auto p-4">
				{ALL_PROJECTS_COLUMN_ORDER.map((column) => {
					const columnCards = cards.filter((card) => card.columnId === column.id);
					return (
						<section key={column.id} className="flex w-72 shrink-0 flex-col rounded-lg bg-surface-1">
							<div className="flex items-center justify-between px-3 py-2.5">
								<span className="text-sm font-semibold text-text-primary">{column.title}</span>
								<span className="text-xs text-text-tertiary">{columnCards.length}</span>
							</div>
							<div className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto px-2 pb-2">
								{columnCards.length === 0 && !isLoading ? (
									<div className="px-2 py-1 text-xs text-text-tertiary">No tasks</div>
								) : null}
								{columnCards.map((card) => (
									<button
										key={`${card.projectId}-${card.id}`}
										type="button"
										onClick={() => onOpenCard(card.projectId, card.id)}
										className="flex flex-col gap-1.5 rounded-md border border-border bg-surface-2 p-2.5 text-left hover:border-border-bright"
									>
										<span className="line-clamp-2 text-[13px] font-medium text-text-primary">
											{normalizePromptForDisplay(card.title) || truncateTaskPromptLabel(card.prompt)}
										</span>
										<span className="truncate text-[11px] text-text-secondary">{card.projectName}</span>
									</button>
								))}
							</div>
						</section>
					);
				})}
			</div>
			{isLoading && cards.length === 0 ? (
				<div className="flex flex-1 items-center justify-center">
					<Spinner size={24} />
				</div>
			) : null}
		</div>
	);
}
