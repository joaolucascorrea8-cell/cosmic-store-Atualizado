import type { Instrumentation } from "next";
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  _request,
  context,
) => {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { recordStoreIssue } = await import("./lib/store-issues");
  await recordStoreIssue("servidor", error, context.routePath);
};
