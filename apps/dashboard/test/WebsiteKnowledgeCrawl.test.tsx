import { beforeEach, afterEach, expect, test, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
vi.mock("../lib/require-auth",()=>({requireSession:vi.fn()}));
vi.mock("../lib/dashboard-api",()=>({fetchDashboardBackend:vi.fn()}));
import { requireSession } from "../lib/require-auth";
import { fetchDashboardBackend } from "../lib/dashboard-api";
import { POST } from "../app/api/ingest/sources/[sourceId]/crawl-index/route";
import { KnowledgeSourceCard } from "../components/customer/setup-wizard/KnowledgeSourceCard";
import type { KnowledgeSource } from "../components/customer/setup-wizard/setupWizardTypes";
const context={params:Promise.resolve({sourceId:"source-1"})};
function request(body: unknown={maxPages:20},headers:Record<string,string>={}) {
 return new Request("https://dashboard.example/api/ingest/sources/source-1/crawl-index",{method:"POST",headers:{origin:"https://dashboard.example","sec-fetch-site":"same-origin","content-type":"application/json",...headers},body:JSON.stringify(body)});
}
beforeEach(()=>{
 vi.stubEnv("DASHBOARD_PUBLIC_URL","https://dashboard.example");
 vi.mocked(requireSession).mockResolvedValue({session:{sub:"synthetic",role:"admin"},response:null} as never);
 vi.mocked(fetchDashboardBackend).mockResolvedValue(new Response(JSON.stringify({pages:3,complete:true}),{status:201}));
});
afterEach(()=>{vi.clearAllMocks();vi.unstubAllEnvs();});
test("authorized same-origin action forwards only page bound, session and cancellation signal",async()=>{
 const req=request();const response=await POST(req,context);expect(response.status).toBe(201);
 expect(fetchDashboardBackend).toHaveBeenCalledWith("/admin/ingest/sources/source-1/crawl-index",expect.objectContaining({method:"POST",body:'{"maxPages":20}',session:expect.objectContaining({role:"admin"}),signal:req.signal}));
 expect(await response.json()).toEqual({pages:3,complete:true});
});
for(const headers of [{origin:"https://foreign.example"},{"sec-fetch-site":"cross-site"},{origin:""}])test(`rejects untrusted origin ${JSON.stringify(headers)}`,async()=>{
 expect((await POST(request({},headers),context)).status).toBe(403);expect(fetchDashboardBackend).not.toHaveBeenCalled();
});
for(const role of ["customer","viewer"])test(`does not extend ${role} rights`,async()=>{
 vi.mocked(requireSession).mockResolvedValue({session:{sub:"synthetic",role},response:null} as never);
 expect((await POST(request(),context)).status).toBe(403);expect(fetchDashboardBackend).not.toHaveBeenCalled();
});
for(const body of [{maxPages:21},{maxPages:1.5},{maxPages:0},{maxPages:20,tenantId:"foreign"}])test(`rejects invalid or extra client context ${JSON.stringify(body)}`,async()=>{
 expect((await POST(request(body),context)).status).toBe(400);expect(fetchDashboardBackend).not.toHaveBeenCalled();
});
test("missing trusted dashboard origin fails closed",async()=>{
 vi.stubEnv("DASHBOARD_PUBLIC_URL","");expect((await POST(request(),context)).status).toBe(503);expect(fetchDashboardBackend).not.toHaveBeenCalled();
});
test("upstream failure is sanitized",async()=>{
 vi.mocked(fetchDashboardBackend).mockRejectedValue(Error("PRIVATE_TRANSPORT_DETAIL"));const response=await POST(request(),context);
 expect(response.status).toBe(502);expect(await response.text()).not.toContain("PRIVATE");
});
const source={id:"source-1",type:"url",title:"Website",isActive:true,status:"ready",runtimeReadiness:"ready",metadata:{websiteCrawl:{pages:3,complete:true,maxPages:20}}} as KnowledgeSource;
test("source card exposes indexing action and actual page coverage",()=>{
 const refresh=vi.fn();render(<KnowledgeSourceCard source={source} canCrawlWebsite savingKey={null} onToggle={vi.fn()} onRefresh={refresh} onRemove={vi.fn()}/>);
 expect(screen.getByText(/3 Website-Seiten indexiert/)).toBeInTheDocument();
 fireEvent.click(screen.getByRole("button",{name:"Website durchsuchen & indexieren"}));expect(refresh).toHaveBeenCalledWith(source);
});
test("inactive source cannot index and incomplete coverage is explicit",()=>{
 render(<KnowledgeSourceCard source={{...source,isActive:false,metadata:{websiteCrawl:{pages:2,complete:false,maxPages:2}}}} savingKey={null} onToggle={vi.fn()} onRefresh={vi.fn()} onRemove={vi.fn()}/>);
 expect(screen.getByRole("button",{name:"Website durchsuchen & indexieren"})).toBeDisabled();expect(screen.getByText(/Unvollständiger Abruf/)).toBeInTheDocument();
});
test("source card does not present an enabled crawl action without confirmed management access",()=>{
 render(<KnowledgeSourceCard source={source} savingKey={null} onToggle={vi.fn()} onRefresh={vi.fn()} onRemove={vi.fn()}/>);
 expect(screen.getByRole("button",{name:"Website durchsuchen & indexieren"})).toBeDisabled();
});
