"use client";

import { ConversationPanel } from "../../components/conversations/ConversationPanel";
import { Topbar } from "../../components/layout/Topbar";

export default function ConversationsPage() {
  return (
    <div>
      <Topbar title="Chats" />
      <div className="dashboard-page dashboard-page--lg">
        <ConversationPanel />
      </div>
    </div>
  );
}
