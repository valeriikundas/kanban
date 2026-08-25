import { describe, expect, it } from "vitest";

import {
	buildDetailTaskUrl,
	buildProjectPathname,
	isAllProjectsPathname,
	parseDetailTaskIdFromSearch,
	parseProjectIdFromPathname,
} from "@/hooks/app-utils";

describe("isAllProjectsPathname", () => {
	it("returns true for the reserved /all path", () => {
		expect(isAllProjectsPathname("/all")).toBe(true);
		expect(isAllProjectsPathname("/all/")).toBe(true);
	});

	it("returns false for project paths and root", () => {
		expect(isAllProjectsPathname("/")).toBe(false);
		expect(isAllProjectsPathname("/my-project")).toBe(false);
		expect(isAllProjectsPathname("/allotment")).toBe(false);
	});
});

describe("parseProjectIdFromPathname", () => {
	it("extracts a decoded project id from the first path segment", () => {
		expect(parseProjectIdFromPathname("/my-project")).toBe("my-project");
		expect(parseProjectIdFromPathname("/my%20project")).toBe("my project");
	});

	it("returns null for the root path and the reserved /all path", () => {
		expect(parseProjectIdFromPathname("/")).toBeNull();
		expect(parseProjectIdFromPathname("/all")).toBeNull();
	});

	it("returns null for an unparseable segment", () => {
		expect(parseProjectIdFromPathname("/%")).toBeNull();
	});
});

describe("buildProjectPathname", () => {
	it("encodes the project id into a leading path segment", () => {
		expect(buildProjectPathname("my project")).toBe("/my%20project");
	});
});

describe("parseDetailTaskIdFromSearch", () => {
	it("returns the selected task id when present", () => {
		expect(parseDetailTaskIdFromSearch("?task=task-123")).toBe("task-123");
	});

	it("returns null when the task id is missing or blank", () => {
		expect(parseDetailTaskIdFromSearch("")).toBeNull();
		expect(parseDetailTaskIdFromSearch("?task=")).toBeNull();
		expect(parseDetailTaskIdFromSearch("?task=%20%20")).toBeNull();
	});
});

describe("buildDetailTaskUrl", () => {
	it("adds the task id while preserving other query params and hash", () => {
		expect(
			buildDetailTaskUrl({
				pathname: "/project-1",
				search: "?view=board",
				hash: "#panel",
				taskId: "task-123",
			}),
		).toBe("/project-1?view=board&task=task-123#panel");
	});

	it("removes the task id while preserving other query params", () => {
		expect(
			buildDetailTaskUrl({
				pathname: "/project-1",
				search: "?view=board&task=task-123",
				hash: "",
				taskId: null,
			}),
		).toBe("/project-1?view=board");
	});
});
