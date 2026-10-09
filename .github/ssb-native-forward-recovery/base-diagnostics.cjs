'use strict';
// Interpret only complete, allowlisted Docker messages. Never export message text.
const references=Object.freeze(require('./registry-bindings.json').images.map(x=>x.reference));
const categories=Object.freeze(['unknown','reported_authentication','reported_denial','reported_rate_limit','reported_manifest_missing','reported_platform_mismatch','reported_tls_error','reported_dns_error','reported_connection_error','reported_http_error']);
const statuses=Object.freeze({400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',408:'Request Timeout',429:'Too Many Requests',500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout'});
function boundReference(reference){if(!references.includes(reference))throw Object.assign(Error('base_diagnostic_binding'),{code:'base_diagnostic_binding'});return reference;}
function validateBase(value){
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='category,httpStatus,reference')throw Error('base_diagnostic_invalid');
  boundReference(value.reference);
  if(!categories.includes(value.category)||!(value.httpStatus===null||Number.isInteger(value.httpStatus)&&Object.hasOwn(statuses,value.httpStatus)))throw Error('base_diagnostic_invalid');
  if(value.category==='reported_http_error'?value.httpStatus===null:value.httpStatus!==null)throw Error('base_diagnostic_invalid');
  return value;
}
function registryURL(text){try{const u=new URL(text);return u.protocol==='https:'&&!u.username&&!u.password&&!u.port&&['registry-1.docker.io','auth.docker.io','registry.hub.docker.com'].includes(u.hostname);}catch{return false;}}
function message(line,reference){
  let s=line.replace(/^Error response from daemon: /,'');
  const wrapper=s.match(/^failed to resolve reference "([^"\r\n]+)": (.+)$/);
  if(wrapper){if(![reference,'docker.io/'+reference,reference.replace(/^library\//,'')].includes(wrapper[1]))return null;s=wrapper[2];}
  const exact={
    'unauthorized: authentication required':'reported_authentication',
    'denied: requested access to the resource is denied':'reported_denial',
    'toomanyrequests: You have reached your unauthenticated pull rate limit. https://www.docker.com/increase-rate-limit':'reported_rate_limit',
    'toomanyrequests: Too Many Requests':'reported_rate_limit',
    'no matching manifest for linux/amd64 in the manifest list entries':'reported_platform_mismatch',
  };
  if(Object.hasOwn(exact,s))return{category:exact[s],httpStatus:null};
  if(s===`manifest for ${reference} not found: manifest unknown: manifest unknown`||wrapper&&s==='manifest unknown: manifest unknown')return{category:'reported_manifest_missing',httpStatus:null};
  const http=s.match(/^unexpected status from (HEAD|GET) request to (https:\/\/\S+): ([45][0-9]{2}) ([A-Za-z ]+)$/);
  if(http&&registryURL(http[2])&&statuses[http[3]]===http[4])return{category:'reported_http_error',httpStatus:Number(http[3])};
  const transport=s.match(/^(?:failed to do request: )?(?:Head|Get) "(https:\/\/[^"\r\n]+)": (.+)$/);
  if(transport&&registryURL(transport[1])){
    const detail=transport[2];
    if(['tls: failed to verify certificate: x509: certificate signed by unknown authority','x509: certificate signed by unknown authority'].includes(detail))return{category:'reported_tls_error',httpStatus:null};
    if(/^dial tcp: lookup (?:registry-1\.docker\.io|auth\.docker\.io|registry\.hub\.docker\.com) on (?:[0-9.]+|\[[0-9a-f:]+\]):[0-9]+: no such host$/.test(detail))return{category:'reported_dns_error',httpStatus:null};
    if(/^dial tcp (?:[0-9.]+|\[[0-9a-f:]+\]):443: connect: (?:connection refused|network is unreachable)$/.test(detail))return{category:'reported_connection_error',httpStatus:null};
  }
  return null;
}
function classifyBase(stdout,stderr,reference){
  boundReference(reference);
  const unknown={reference,category:'unknown',httpStatus:null};
  if(!Buffer.isBuffer(stdout)||!Buffer.isBuffer(stderr)||stdout.length+stderr.length>65536)return unknown;
  const buffers=[stdout,stderr];
  if(buffers.some(b=>!Buffer.from(b.toString('utf8')).equals(b)))return unknown;
  const text=buffers.map(b=>b.toString('utf8')).join('\n');
  if(/[^\x09\x0a\x0d\x20-\x7e]/.test(text))return unknown;
  const lines=text.replace(/\r\n/g,'\n').split('\n').filter(s=>s.length>0);
  if(!lines.length||lines.length>128||lines.some(s=>s.length>4096))return unknown;
  const results=[];
  for(const line of lines){
    // Only these progress records may accompany a recognized error.
    if(/^[a-f0-9]{12}: (?:Pulling fs layer|Waiting|Verifying Checksum|Download complete|Pull complete)$/.test(line))continue;
    const r=message(line,reference);if(!r)return unknown;results.push(r);
  }
  if(!results.length||new Set(results.map(r=>JSON.stringify(r))).size!==1)return unknown;
  return{reference,...results[0]};
}
module.exports={boundReference,validateBase,classifyBase,references,categories};
