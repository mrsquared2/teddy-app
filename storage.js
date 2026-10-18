// Atomic revision checks coordinate every writer. Immutable composition snapshots
// are content-addressed once; portable exports still contain expanded records.
import {validateState} from './core.js';
export const LEGACY_KEY='teddy.nutrition.v1';
export class StorageConflict extends Error {
  constructor(){super('Another tab changed the diary. Your change was not saved. Load the latest diary before editing again.');this.name='StorageConflict';}
}
let opening;
function database() {
  return opening ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open('teddy-diary',1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('meta');request.result.createObjectStore('snapshots');};
    request.onsuccess=()=>{request.result.onversionchange=()=>{request.result.close();opening=null;};resolve(request.result);};
    request.onerror=()=>{opening=null;reject(request.error);};
    request.onblocked=()=>reject(new Error('Close other Teddy tabs, then reload to open the diary database.'));
  });
}
const digest=async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
async function encode(state) {
  const unique=new Map();
  function collect(value){const text=JSON.stringify(value);if(!unique.has(text))unique.set(text,null);return text;}
  const collectItems=items=>items.forEach(e=>collect(e.food));
  for(const d of Object.values(state.days)){collect(d.profile);collectItems(d.entries);for(const p of d.planned || []){collectItems(p.items);collectItems(p.expected || []);}}
  for(const r of state.recipes || [])collectItems(r.components);
  for(const text of unique.keys())unique.set(text,await digest(text));
  const pack=items=>items.map(({food,...rest})=>({...rest,foodRef:unique.get(JSON.stringify(food))}));
  const days=Object.fromEntries(Object.entries(state.days).map(([date,day])=>{
    const {profile,entries,...rest}=day;
    if(rest.planned)rest.planned=rest.planned.map(p=>({...p,items:pack(p.items),...(p.expected?{expected:pack(p.expected)}:{})}));
    return [date,{...rest,profileRef:unique.get(JSON.stringify(profile)),entries:pack(entries)}];
  }));
  return {state:{...state,days,...(state.recipes?{recipes:state.recipes.map(r=>({...r,components:pack(r.components)}))}:{})},snapshots:new Map([...unique].map(([text,id])=>[id,JSON.parse(text)]))};
}
function decode(compact,snapshots) {
  const state=structuredClone(compact);
  const lookup=ref=>{if(!snapshots.has(ref))throw new Error('A saved composition snapshot is missing. Export recovery data before restoring a backup.');return structuredClone(snapshots.get(ref));};
  const unpack=items=>items.map(({foodRef,...rest})=>({...rest,food:lookup(foodRef)}));
  state.days=Object.fromEntries(Object.entries(state.days).map(([date,day])=>{
    const {profileRef,entries,...rest}=day;
    if(rest.planned)rest.planned=rest.planned.map(p=>({...p,items:unpack(p.items),...(p.expected?{expected:unpack(p.expected)}:{})}));
    return [date,{...rest,profile:lookup(profileRef),entries:unpack(entries)}];
  }));
  if(state.recipes)state.recipes=state.recipes.map(r=>({...r,components:unpack(r.components)}));
  return state;
}
export async function load(recoveryKind) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['meta','snapshots'],'readonly'),meta=tx.objectStore('meta');
    const head=meta.get(recoveryKind?`recovery-${recoveryKind}`:'current'),keys=tx.objectStore('snapshots').getAllKeys(),values=tx.objectStore('snapshots').getAll();
    const migration=meta.get('recovery-migration'),restore=meta.get('recovery-restore'),legacy=meta.get('recovery-legacy'),exported=meta.get('last-export');
    tx.onabort=()=>reject(tx.error);tx.onerror=()=>{};
    tx.oncomplete=()=>{try{
      const record=head.result;
      if(record?.state && record.format!==1)throw new Error('Unsupported diary database format.');
      const snapshots=new Map((keys.result || []).map((k,i)=>[k,values.result[i]]));
      resolve({revision:record?.revision || 0,state:record?.state?decode(record.state,snapshots):null,raw:record?.raw || null,
        legacyDigest:record?.legacyDigest || null,lastExportAt:exported.result || null,
        recovery:{migration:migration.result?.at || null,restore:restore.result?.at || null,legacy:legacy.result?.at || null}});
    }catch(error){reject(error);}};
  });
}
export async function commit(next,expectedRevision,{checkpoint=null,legacyRaw=null}={}) {
  validateState(next);
  const encoded=await encode(next),legacyDigest=legacyRaw==null?null:await digest(legacyRaw),db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction(['meta','snapshots'],'readwrite',{durability:'strict'}),meta=tx.objectStore('meta'),snapshots=tx.objectStore('snapshots');
    let failure=null,revision;
    tx.onabort=()=>reject(failure || tx.error || new Error('Save aborted. Previous diary retained.'));tx.onerror=()=>{};
    tx.oncomplete=()=>resolve(revision);
    const request=meta.get('current');
    request.onsuccess=()=>{try {
      const previous=request.result;
      if((previous?.revision || 0)!==expectedRevision){failure=new StorageConflict();tx.abort();return;}
      revision=expectedRevision+1;
      if(checkpoint && previous)meta.put({...previous,at:new Date().toISOString()},`recovery-${checkpoint}`);
      if(legacyRaw!=null)meta.put({raw:legacyRaw,at:new Date().toISOString()},previous?'recovery-legacy':'recovery-migration');
      for(const [id,value] of encoded.snapshots){const found=snapshots.getKey(id);found.onsuccess=()=>{try{if(found.result===undefined)snapshots.add(value,id);}catch(error){failure=error;tx.abort();}};}
      meta.put({format:1,revision,state:encoded.state,legacyDigest:legacyDigest || previous?.legacyDigest || null},'current');
    }catch(error){failure=error;tx.abort();}};
  });
}
export async function markExport() {
  const db=await database(),at=new Date().toISOString();
  return new Promise((resolve,reject)=>{const tx=db.transaction('meta','readwrite');tx.objectStore('meta').put(at,'last-export');tx.oncomplete=()=>resolve(at);tx.onabort=()=>reject(tx.error);});
}
export async function legacyChanged(savedDigest) {
  const raw=localStorage.getItem(LEGACY_KEY);
  return savedDigest!=null && raw!=null && await digest(raw)!==savedDigest;
}
