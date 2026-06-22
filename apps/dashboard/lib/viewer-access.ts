const VIEWER_ALLOWED_PATHS = new Set([
  "/evaluation",
  "/api/auth/logout",
  "/api/auth/session",
]);

export function isViewerAllowedPath(pathname: string) {
  return VIEWER_ALLOWED_PATHS.has(pathname);
}
