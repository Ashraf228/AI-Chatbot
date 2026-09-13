"use client";

import { useRef } from "react";
import type { DashboardSessionRole } from "../../lib/auth-core";
import { CustomerItKnowledgeTemplatesPanel } from "./CustomerItKnowledgeTemplatesPanel";
import { KnowledgeImportPanel } from "./KnowledgeImportPanel";
import { KnowledgeManager, type KnowledgeManagerHandle } from "./KnowledgeManager";

export function KnowledgeWorkspace({ siteId, role }: { siteId: string; role: DashboardSessionRole | null }) {
  const managerRef = useRef<KnowledgeManagerHandle>(null);
  const isCustomer = role === "customer";
  const canManageExistingKnowledge = role === "admin" || role === "operator";

  return (
    <>
      {isCustomer ? (
        <CustomerItKnowledgeTemplatesPanel siteId={siteId} onChanged={() => managerRef.current?.reload()} />
      ) : canManageExistingKnowledge ? (
        <KnowledgeImportPanel siteId={siteId} onImported={() => managerRef.current?.reload()} />
      ) : null}
      <div className="dashboard-mt-14">
        <KnowledgeManager ref={managerRef} siteId={siteId} readOnly={!canManageExistingKnowledge} />
      </div>
    </>
  );
}
