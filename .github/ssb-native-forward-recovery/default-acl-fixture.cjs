'use strict';
// Offline SQL-result model, not a PostgreSQL execution or a recovered raw snapshot.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const oldExpression='c.relacl::text';
const expression='COALESCE(c.relacl,acldefault(CASE c.relkind WHEN \'S\' THEN \'s\' ELSE \'r\' END::"char",c.relowner))::text';
const oldQuery="SELECT n.nspname,c.relname,pg_get_userbyid(c.relowner) owner,c.relacl::text acl FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('public','maintenance_admin') AND c.relkind IN('r','p','S') ORDER BY 1,2";
const query=oldQuery.replace(oldExpression,expression);
function project(rows,sql){
 assert.ok(sql===oldQuery||sql===query,'unexpected SQL result contract');
 return rows.map(row=>{
  assert.ok(['r','p','S'].includes(row.kind));assert.match(row.owner,/^[a-z_]+$/);
  assert.ok(row.acl===null||typeof row.acl==='string');
  const acl=sql===query&&row.acl===null?'{'+row.owner+'='+(row.kind==='S'?'rwU':'arwdDxt')+'/'+row.owner+'}':row.acl;
  return{nspname:row.nspname,relname:row.relname,owner:row.owner,acl};
 });
}
function historical(){
 const sql=fs.readFileSync(path.join(__dirname,'adapters/scripts/ops/admin-writer-roles.sql'),'utf8');
 const names=[...sql.match(/expected text\[\] := ARRAY\[([\s\S]*?)\];/)[1].matchAll(/'([^']+)'/g)].map(m=>m[1]);
 assert.equal(names.length,34);assert.deepEqual(names,[...names].sort());
 const rights=Object.fromEntries(names.map(name=>[name,{ssb_runtime:new Set(),ssb_admin_writer:new Set()}])),chars={SELECT:'r',INSERT:'a',UPDATE:'w',DELETE:'d'};let statements=0;
 for(const m of sql.replace(/--[^\n]*/g,'').matchAll(/GRANT (SELECT|INSERT|UPDATE|DELETE)((?:, (?:SELECT|INSERT|UPDATE|DELETE))*) ON ([a-z_,\s]+?) TO (ssb_runtime|ssb_admin_writer)(, ssb_admin_writer)?;/g)){
  statements++;for(const table of m[3].split(/,\s*/).map(t=>t.trim()))for(const role of (m[4]+(m[5]||'')).split(/,\s*/))for(const p of (m[1]+m[2]).split(/,\s*/))rights[table][role].add(chars[p]);
 }
 assert.equal(statements,6);
 const acl=rights=>'{'+['ssb_migrator=arwdDxt/ssb_migrator',...Object.entries(rights).filter(([,v])=>v.size).map(([r,v])=>r+'='+[...'arwdDxt'].filter(c=>v.has(c)).join('')+'/ssb_migrator')].join(',')+'}';
 const before=[{nspname:'maintenance_admin',relname:'writer_receipts',owner:'ssb_migrator',acl:acl({ssb_admin_writer:new Set(['a','r'])}),kind:'r'},...names.map(name=>({nspname:'public',relname:name,owner:'ssb_migrator',acl:acl(rights[name]),kind:'r'}))];
 const after=structuredClone(before);after.find(r=>r.relname==='schema_migrations').acl=null;return{before,after};
}
module.exports={oldExpression,expression,oldQuery,query,project,historical};
