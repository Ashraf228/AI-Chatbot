'use strict';
// Next 16.3.8's instance-local AsyncCallbackSet uses allSettled and discards rejections.
// Preserve execution of every callback, but require their successful settlement for our receipt.
async function closeNextStrict(wrapper, AsyncCallbackSet, capture=()=>{}) {
  const callbacks=wrapper?.server?.cleanupListeners;
  if(!(callbacks instanceof AsyncCallbackSet)||!Array.isArray(callbacks.callbacks)
    ||typeof wrapper.close!=='function'||Object.hasOwn(callbacks,'runAll'))throw Error('next_close_failed');
  const original=callbacks.runAll;let invoked=0;
  callbacks.runAll=async function(){
    invoked++;
    if(invoked!==1||!Array.isArray(this.callbacks)||!this.callbacks.every(f=>typeof f==='function'))throw Error('next_close_failed');
    const pending=this.callbacks;this.callbacks=[];
    const results=await Promise.allSettled(pending.map(async f=>{try{return await f();}catch(error){capture(Object.assign(Error('next_close_failed'),{code:'next_close_failed'}),'next');throw error;}}));
    const errors=results.filter(r=>r.status==='rejected').map(r=>r.reason);
    if(errors.length)throw new AggregateError(errors,'next_close_failed');
    if(this.callbacks.length)throw Error('next_close_failed');
  };
  try{await wrapper.close();if(invoked!==1||callbacks.callbacks.length)throw Error('next_close_failed');}
  finally{delete callbacks.runAll;if(callbacks.runAll!==original)throw Error('next_close_failed');}
}
function bindWaitUntil(wrapper,AwaiterOnce,capture) {
  const server=wrapper?.server;
  if(!server||server.internalWaitUntil!==undefined||typeof server.createInternalWaitUntil!=='function'
    ||typeof server.onServerClose!=='function'||Object.hasOwn(server,'createInternalWaitUntil'))throw Error('next_close_failed');
  server.createInternalWaitUntil=function(){
    const awaiter=new AwaiterOnce({onError:()=>capture(Object.assign(Error('next_close_failed'),{code:'next_close_failed'}),'next')});
    this.onServerClose(()=>awaiter.awaiting());return awaiter.waitUntil;
  };
}
function bindErrorSink(target,capture,output) {
  if(!target||typeof target.error!=='function'||typeof capture!=='function'||typeof output!=='function'
    ||Object.getOwnPropertyDescriptor(target,'error')?.configurable===false)throw Error('next_close_failed');
  // Bundled Next after() handlers can log and swallow errors before waitUntil sees them.
  // In this dedicated process every error log vetoes graceful shutdown; never inspect or export its arguments.
  Object.defineProperty(target,'error',{configurable:false,writable:false,value:function(){
    capture(Object.assign(Error('next_task_failed'),{code:'next_task_failed'}),'next');
    try{output('SSB_DASHBOARD_TASK_FAILED\n');}catch(error){capture(error,'receipt');}
  }});
}
module.exports={closeNextStrict,bindWaitUntil,bindErrorSink};
