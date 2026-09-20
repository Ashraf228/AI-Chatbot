const test = require('node:test');
const assert = require('node:assert/strict');
const { Pool } = require('pg');
const { VectorService } = require('../dist/vector/vector.service');
const { KnowledgeSourcesService } = require('../dist/knowledge-sources/knowledge-sources.service');
const { WebsiteKnowledgeIndexService } = require('../dist/ingest/website-knowledge-index.service');
const crawler = require('../dist/ingest/website-crawl');

// Dedicated, disposable local database with pgvector already installed. No
// application DATABASE_URL is accepted, and all tables/data are temporary.
const enabled = process.env.KNOWLEDGE_CORE_POSTGRES_TEST === '1';
test('knowledge core SQL on isolated PostgreSQL/pgvector', { skip: !enabled }, async (t) => {
  const url = new URL(process.env.KNOWLEDGE_CORE_TEST_DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /^\/knowledge_core_test_[a-z0-9_]+$/);
  assert.equal(url.search, '');
  const pool = new Pool({ connectionString: url.toString(), max: 1, connectionTimeoutMillis: 3000 });
  let client;
  const originalCrawl = crawler.crawlWebsite;
  t.after(async () => {
    crawler.crawlWebsite = originalCrawl;
    const errors = [];
    if (client) {
      try { await client.query('ROLLBACK'); } catch (e) { errors.push(e); }
      try { client.release(); } catch (e) { errors.push(e); }
    }
    try { await pool.end(); } catch (e) { errors.push(e); }
    if (errors.length) throw new AggregateError(errors, 'Knowledge test cleanup failed');
  });
  client = await pool.connect();
  assert.equal((await client.query("SELECT 1 FROM pg_extension WHERE extname='vector'")).rowCount, 1);
  await client.query(`BEGIN; SET LOCAL statement_timeout='10s'; SET LOCAL lock_timeout='3s';
    CREATE TEMP TABLE sites (id text PRIMARY KEY, tenant_id text);
    CREATE TEMP TABLE knowledge_sources (
      id text PRIMARY KEY, site_id text REFERENCES sites(id), tenant_id text, source_type text,
      label text, description text, source_url text, sync_status text DEFAULT 'ready', is_active boolean DEFAULT true,
      last_synced_at timestamptz, last_ingest_at timestamptz, error_message text,
      ingest_status text DEFAULT 'extracted', index_status text DEFAULT 'indexed', runtime_readiness text DEFAULT 'ready',
      ingest_error_code text, ingest_error_message_sanitized text, normalized_source_url text, source_domain text,
      config jsonb DEFAULT '{}', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT clock_timestamp());
    CREATE TEMP TABLE documents (id text PRIMARY KEY, source_id text REFERENCES knowledge_sources(id) ON DELETE SET NULL,
      tenant_id text, site_id text, type text, title text, source_url text);
    CREATE TEMP TABLE chunks (id text PRIMARY KEY, document_id text REFERENCES documents(id) ON DELETE CASCADE,
      tenant_id text, site_id text, content text, content_hash text, metadata jsonb, embedding vector(1536));
    INSERT INTO sites VALUES ('s','t'),('foreign-site','t'),('foreign-tenant-site','foreign');`);
  const vector = [1, ...Array(1535).fill(0)];
  async function insert(id, tenant='t', site='s', active=true, ready='ready', cosine=1, orphan=false) {
    await client.query(`INSERT INTO knowledge_sources(id,tenant_id,site_id,source_type,label,source_url,is_active,runtime_readiness)
      VALUES($1,$2,$3,'manual','Handbuch','https://example.com/',$4,$5)`,[id,tenant,site,active,ready]);
    await client.query(`INSERT INTO documents(id,source_id,tenant_id,site_id,type,title) VALUES($1,$2,$3,$4,'manual','Handbuch')`,['d'+id,orphan?null:id,tenant,site]);
    const embedding=[cosine,Math.sqrt(1-cosine*cosine),...Array(1534).fill(0)];
    await client.query(`INSERT INTO chunks(id,document_id,tenant_id,site_id,content,metadata,embedding) VALUES($1,$2,$3,$4,'Sicherung täglich','{}',$5::vector)`,['c'+id,'d'+id,tenant,site,JSON.stringify(embedding)]);
  }
  await insert('allowed'); await insert('foreign','foreign','foreign-tenant-site'); await insert('other-site','t','foreign-site');
  await insert('inactive','t','s',false); await insert('pending','t','s',true,'not_ready'); await insert('orphan','t','s',true,'ready',1,true);
  await insert('negative','t','s',true,'ready',-1);
  // Even a forged chunk tenant/site cannot authorize a foreign document/source.
  await client.query("UPDATE chunks SET tenant_id='t',site_id='s' WHERE id='cforeign'");
  const db={ query:(sql,p)=>client.query(sql,p), async transaction(fn) {
    await client.query('SAVEPOINT index_test');
    try { const result=await fn(this); await client.query('RELEASE SAVEPOINT index_test'); return result; }
    catch(error){ await client.query('ROLLBACK TO SAVEPOINT index_test'); throw error; }
  }};
  const search=new VectorService(db);
  await t.test('hybrid search excludes foreign, inactive, unready, orphaned and negative-match chunks',async()=>{
    const hits=await search.searchKnowledge('t','s',vector,'Wie funktioniert die Sicherung?');
    assert.deepEqual(hits.map(h=>h.id),['callowed']);
    assert.deepEqual((await search.searchKnowledge('t','s',vector,'und die')).map(h=>h.id),['callowed']);
    assert.deepEqual(await search.searchKnowledge('t','s',vector,'Sicherung',{demoOnly:true}),[]);
  });
  await client.query("UPDATE knowledge_sources SET source_type='url', source_url='https://example.com/' WHERE id='allowed'");
  const knowledge=new KnowledgeSourcesService(db,{});
  const embeddings={resolveConfig(){return{providerKey:'openai',model:'text-embedding-3-small'};},async embed(){return vector;}};
  crawler.crawlWebsite=async()=>({pages:[{finalUrl:'https://example.com/help',pageTitle:'Wiederherstellung',extractedText:'Sicherung und Wiederherstellung: Die Administration hilft.'}],complete:true,maxPages:20,excluded:[]});
  const index=new WebsiteKnowledgeIndexService(db,knowledge,embeddings,search);
  await t.test('real storage replaces only the source snapshot and returns page-level citations',async()=>{
    const result=await index.index('allowed'); assert.equal(result.chunks,1);
    assert.equal((await client.query("SELECT 1 FROM documents WHERE id='dallowed'")).rowCount,0);
    assert.equal((await client.query("SELECT 1 FROM documents WHERE id='dother-site'")).rowCount,1);
    const hits=await search.searchKnowledge('t','s',vector,'Wiederherstellung');assert.equal(hits.length,1);assert.equal(hits[0].source_url,'https://example.com/help');
    assert.equal((await knowledge.getById('allowed')).metadata.websiteCrawl.pages,1);
  });
  await t.test('a storage failure after delete rolls back the original document/chunk binding',async()=>{
    const before=await client.query("SELECT id FROM documents WHERE source_id='allowed'");
    const failing=new WebsiteKnowledgeIndexService(db,knowledge,embeddings,{async upsertChunk(){throw Error('synthetic storage fault');}});
    await assert.rejects(failing.index('allowed'));
    assert.deepEqual((await client.query("SELECT id FROM documents WHERE source_id='allowed'")).rows,before.rows);
    assert.equal((await search.searchKnowledge('t','s',vector,'Wiederherstellung')).length,1);
    assert.equal((await knowledge.getById('allowed')).runtimeReadiness,'ready');
  });
  await t.test('source edit during embedding causes conflict without replacing documents',async()=>{
    const before=await client.query("SELECT id FROM documents WHERE source_id='allowed'");
    const racing=new WebsiteKnowledgeIndexService(db,knowledge,{...embeddings,async embed(){
      await client.query("UPDATE knowledge_sources SET updated_at=clock_timestamp() WHERE id='allowed'");return vector;
    }},search);
    await assert.rejects(racing.index('allowed'),e=>e.getStatus()===409);
    assert.deepEqual((await client.query("SELECT id FROM documents WHERE source_id='allowed'")).rows,before.rows);
  });
});
