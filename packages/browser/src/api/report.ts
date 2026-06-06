import { currentApiKey, currentEndpoint } from "../core/init.js";
import type { ManualReportResponse, ReportBugInput } from "../types/index.js";
import { ensureRuntime } from "../utils/env.js";
import { getApiRoot } from "../utils/url.js";

export async function reportBug(
  input: ReportBugInput,
): Promise<ManualReportResponse> {
  ensureRuntime();
  if (!currentApiKey) {
    throw new Error("ArtsTrace reportBug requires init(apiKey)");
  }
  if (!input.title.trim()) {
    throw new Error("ArtsTrace reportBug requires a title");
  }

  const response = await fetch(
    `${getApiRoot(currentEndpoint)}/manual-reports`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        projectKey: currentApiKey,
        title: input.title,
        description: input.description,
        screenshotData: input.screenshotData,
        annotations: input.annotations,
        url: input.url ?? window.location.href,
        userAgent: input.userAgent ?? navigator.userAgent,
        createdByUserId: input.createdByUserId,
      }),
    },
  );

  if (!response.ok) {
    const message = await response.text().catch(() => "");
    throw new Error(
      message
        ? `Failed to submit bug report: ${message}`
        : "Failed to submit bug report",
    );
  }

  return (await response.json()) as ManualReportResponse;
}
