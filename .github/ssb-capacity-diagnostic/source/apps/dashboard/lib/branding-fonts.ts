export const BRANDING_FONT_OPTIONS = [
  { value: "system", label: "System Sans" },
  { value: "inter", label: "Inter" },
  { value: "avenir", label: "Avenir Next" },
  { value: "georgia", label: "Georgia" },
  { value: "times", label: "Times New Roman" },
  { value: "trebuchet", label: "Trebuchet MS" },
  { value: "verdana", label: "Verdana" },
  { value: "monospace", label: "Monospace" },
] as const;

export type BrandingFontOption = (typeof BRANDING_FONT_OPTIONS)[number]["value"];

export function resolveBrandingFontStack(fontFamily?: string) {
  switch (fontFamily) {
    case "inter":
      return '"Inter", "Helvetica Neue", Arial, sans-serif';
    case "avenir":
      return '"Avenir Next", "Segoe UI", Arial, sans-serif';
    case "georgia":
      return 'Georgia, "Times New Roman", serif';
    case "times":
      return '"Times New Roman", Times, serif';
    case "trebuchet":
      return '"Trebuchet MS", "Segoe UI", sans-serif';
    case "verdana":
      return "Verdana, Geneva, sans-serif";
    case "monospace":
      return '"SFMono-Regular", Consolas, "Liberation Mono", monospace';
    case "system":
    default:
      return '"Arial", "Helvetica Neue", sans-serif';
  }
}
