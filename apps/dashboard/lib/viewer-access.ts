const VIEWER_ALLOWED_PATHS = new Set([
  "/evaluation",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/evaluation/context",
  "/api/evaluation/chat/session",
  "/api/evaluation/chat/message",
  "/api/evaluation/chat/ticket/confirm",
  "/api/evaluation/chat/ticket/cancel",
]);

export function isViewerAllowedPath(pathname: string) {
  return VIEWER_ALLOWED_PATHS.has(pathname);
}
