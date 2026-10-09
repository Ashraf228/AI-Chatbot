export type WidgetUiState = {
  isOpen: boolean;
  unreadCount: number;
};

export function createWidgetStore(initial?: Partial<WidgetUiState>): WidgetUiState {
  return {
    isOpen: initial?.isOpen ?? false,
    unreadCount: initial?.unreadCount ?? 0,
  };
}
