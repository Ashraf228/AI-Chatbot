"use client";

import { useRef } from "react";
import { KnowledgeImportPanel } from "./KnowledgeImportPanel";
import { KnowledgeManager, type KnowledgeManagerHandle } from "./KnowledgeManager";

export function KnowledgeWorkspace({ siteId }: { siteId: string }) {
  const managerRef = useRef<KnowledgeManagerHandle>(null);

  return (
    <>
      <KnowledgeImportPanel siteId={siteId} onImported={() => managerRef.current?.reload()} />
      <div className="dashboard-mt-14">
        <KnowledgeManager ref={managerRef} siteId={siteId} />
      </div>
    </>
  );
}
