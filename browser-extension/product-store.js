/* Extension-origin IndexedDB. Legacy Chrome storage remains the durable compatibility source. */
(function(root,factory){const api=factory(root);if(typeof module==='object'&&module.exports)module.exports=api;if(root)root.vjaProductStore=api;})(globalThis,function(root){
  'use strict';const NAME='violetta-product',VERSION=2;let pending=null;
  const INDEXES=['collection','vacancyId','company','title','createdAt','analyzedAt','appliedAt','updatedAt','status','fitScore','outcome','source','canonicalFingerprint'];
  function db(){if(pending)return pending;pending=new Promise((resolve,reject)=>{
    if(!root.indexedDB){reject(new Error('IndexedDB недоступен. Данные остаются в Chrome storage.'));return;}
    let settled=false;const request=root.indexedDB.open(NAME,VERSION);
    request.onupgradeneeded=()=>{const d=request.result;
      if(!d.objectStoreNames.contains('checkpoints')){const s=d.createObjectStore('checkpoints',{keyPath:'id'});s.createIndex('createdAt','createdAt');}
      if(!d.objectStoreNames.contains('meta'))d.createObjectStore('meta',{keyPath:'key'});
      const s=d.objectStoreNames.contains('records')?request.transaction.objectStore('records'):d.createObjectStore('records',{keyPath:'id'});
      for(const name of INDEXES)if(!s.indexNames.contains(name))s.createIndex(name,name);
      if(!s.indexNames.contains('collectionUpdated'))s.createIndex('collectionUpdated',['collection','updatedAt','id']);
    };
    request.onerror=()=>{settled=true;reject(request.error);};
    request.onblocked=()=>{settled=true;reject(new Error('Закройте другие вкладки центра управления и повторите.'));};
    request.onsuccess=()=>{const d=request.result;if(settled){d.close();return;}d.onversionchange=()=>{d.close();pending=null;};resolve(d);};
  }).catch(e=>{pending=null;throw e;});return pending;}
  async function transaction(store,mode,work){const d=await db();return new Promise((resolve,reject)=>{
    const tx=d.transaction(store,mode);let value;const set=x=>{value=x;};
    tx.oncomplete=()=>resolve(value);tx.onabort=tx.onerror=()=>reject(tx.error||new Error('IndexedDB transaction failed.'));
    try{work(tx.objectStore(store),set,tx);}catch(e){try{tx.abort();}catch{}reject(e);}
  });}
  const request=(store,mode,fn)=>transaction(store,mode,(s,set)=>{fn(s).onsuccess=e=>set(e.target.result);});
  async function save(envelope){if(envelope?.format!=='violetta-encrypted-backup')throw new Error('Vault принимает только зашифрованные копии.');const id=root.crypto.randomUUID();await request('checkpoints','readwrite',s=>s.put({id,createdAt:Date.now(),envelope}));return id;}
  async function list(){return transaction('checkpoints','readonly',(s,set)=>{const items=[];s.index('createdAt').openCursor(null,'prev').onsuccess=e=>{const c=e.target.result;if(!c){set(items);return;}items.push({id:c.value.id,createdAt:c.value.createdAt,bytes:c.value.envelope.data.length});c.continue();};});}
  async function read(id){return (await request('checkpoints','readonly',s=>s.get(id)))?.envelope||null;}
  async function remove(id){await request('checkpoints','readwrite',s=>s.delete(id));}
  const num=x=>Number.isFinite(Number(x))?Number(x):0;
  function record(key,payload){
    const collection=key.startsWith('vjaVacancyIntel:')?'vacancies':key.startsWith('vjaApplicationJob:')?'applications':key.startsWith('vjaVacancyDecision:')?'decisions':key.startsWith('vjaConversation:')?'conversations':null;
    if(!collection||!payload||typeof payload!=='object')return null;
    const c=payload.context||{},v=payload.vacancy||c.vacancy||{},p=payload.plan||{};
    return {id:key,collection,vacancyId:String(v.vacancyId||payload.vacancyId||p.trackedId||''),company:String(v.company||''),title:String(v.title||p.title||p.jobTitle||''),createdAt:num(payload.createdAt||c.createdAt||payload.at),analyzedAt:num(payload.at),appliedAt:num(c.appliedAt||(c.coverLetterMemory||{}).submittedAt),updatedAt:num(payload.updatedAt||c.updatedAt||payload.at||payload.createdAt),status:String(c.status||payload.status||payload.decision||''),fitScore:num(payload.fit?.score||c.fitScore),outcome:String(c.outcome||c.status||''),source:String(v.source||v.provider||payload.provider||'hh'),canonicalFingerprint:String(v.canonicalFingerprint||payload.canonicalFingerprint||''),archived:payload.archived===true,payload};
  }
  async function mirror(items){return transaction('records','readwrite',(s,set)=>{let count=0;for(const [key,value] of Object.entries(items)){const r=record(key,value);if(r){const old=s.get(key);old.onsuccess=()=>s.put({...r,archived:r.archived||old.result?.archived===true});count++;}else if(/^(vjaVacancyIntel:|vjaApplicationJob:|vjaVacancyDecision:|vjaConversation:)/.test(key)&&value===undefined)s.delete(key);}set(count);});}
  async function query({collection='vacancies',offset=0,limit=25,search='',status='',archived=false}={}){
    if(!['vacancies','applications','decisions','conversations'].includes(collection))throw new Error('Unknown collection.');
    limit=Math.max(1,Math.min(100,Math.floor(num(limit))||25));offset=Math.max(0,Math.floor(num(offset)));search=String(search).toLocaleLowerCase('ru-RU').trim();
    const range=root.IDBKeyRange.bound([collection,0,''],[collection,Number.MAX_SAFE_INTEGER,'\uffff']);
    return transaction('records','readonly',(s,set)=>{const rows=[];let skipped=0;
      s.index('collectionUpdated').openCursor(range,'prev').onsuccess=e=>{const cursor=e.target.result;if(!cursor){set({rows,offset,limit,hasMore:false});return;}
        const r=cursor.value;if((archived===null||r.archived===archived)&&(!status||r.status===status)&&(!search||(r.title+' '+r.company).toLocaleLowerCase('ru-RU').includes(search))){if(skipped<offset)skipped++;else if(rows.length<limit)rows.push(r);else{set({rows,offset,limit,hasMore:true});return;}}cursor.continue();};
    });
  }
  async function stats(){return transaction('records','readonly',(s,set)=>{const counts={vacancies:0,applications:0,decisions:0,conversations:0,archived:0};s.openCursor().onsuccess=e=>{const c=e.target.result;if(!c){set(counts);return;}if(c.value.archived)counts.archived++;else counts[c.value.collection]++;c.continue();};});}
  async function archiveBefore(cutoff){if(!Number.isFinite(cutoff)||cutoff<0)throw new Error('Invalid retention cutoff.');return transaction('records','readwrite',(s,set)=>{let n=0;s.openCursor().onsuccess=e=>{const c=e.target.result;if(!c){set(n);return;}if(c.value.updatedAt>0&&c.value.updatedAt<cutoff&&!c.value.archived){c.update({...c.value,archived:true});n++;}c.continue();};});}
  async function meta(key,value){if(arguments.length===2){await request('meta','readwrite',s=>s.put({key,value}));return value;}return (await request('meta','readonly',s=>s.get(key)))?.value;}
  async function close(){if(pending)(await pending).close();pending=null;}
  return {NAME,VERSION,INDEXES,db,save,list,read,remove,record,mirror,query,stats,archiveBefore,meta,close};
});
