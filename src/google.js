(function(root){
'use strict';
const WRITABLE=['addresses','biographies','birthdays','calendarUrls','clientData','emailAddresses','events','externalIds','genders','imClients','interests','locales','locations','memberships','miscKeywords','names','nicknames','occupations','organizations','phoneNumbers','relations','sipAddresses','urls','userDefined'];
const READ_FIELDS=[...WRITABLE,'metadata','photos','coverPhotos','skills'].join(',');
const CORE=new Set(['names','emailAddresses','phoneNumbers','organizations','birthdays','biographies']);
const SINGLETON=new Set(['names','birthdays','biographies','genders']);
const BASE='https://people.googleapis.com/v1/';
const clone=value=>JSON.parse(JSON.stringify(value));
const unique=values=>[...new Set(values)];
const dedup=values=>[...new Map(values.map(v=>[JSON.stringify(v),v])).values()];
const safeId=id=>typeof id==='string'&&/^people\/[A-Za-z0-9_-]+$/.test(id);
const fail=message=>{throw new Error(message);};
function contactSource(person){const sources=(person.metadata?.sources||[]).filter(s=>s.type==='CONTACT');if(sources.length!==1||!sources[0].id||!sources[0].etag)fail('Une fiche Google ne possède pas de version modifiable fiable. Recharge le carnet.');return sources[0];}
function sourceVersion(person){const s=contactSource(person);return JSON.stringify([s.id,s.etag]);}
function cleanEntry(value){if(Array.isArray(value))return value.map(cleanEntry);if(value&&typeof value==='object'){const out={};for(const [key,v]of Object.entries(value))if(!['metadata','formattedType','canonicalForm','displayName','displayNameLastFirst'].includes(key))out[key]=cleanEntry(v);return out;}return value;}
function contactEntries(person,field){return (person[field]||[]).filter(v=>!v.metadata?.source?.type||v.metadata.source.type==='CONTACT');}
function payloadOf(person){const payload={};for(const field of WRITABLE){const values=contactEntries(person,field).map(cleanEntry);if(values.length)payload[field]=values;}return payload;}
function nameOf(entry){return entry?.displayName||[entry?.honorificPrefix,entry?.givenName,entry?.middleName,entry?.familyName,entry?.honorificSuffix].filter(Boolean).join(' ')||entry?.unstructuredName||'';}
function birthdayOf(entry){if(!entry)return '';if(entry.text)return entry.text;const d=entry.date;if(!d)return '';return (d.year?String(d.year).padStart(4,'0'):'--')+(d.year?'-':'')+String(d.month||0).padStart(2,'0')+'-'+String(d.day||0).padStart(2,'0');}
function extra(field,value){return JSON.stringify({field,value:cleanEntry(value)});}
function parseExtra(raw){let p;try{p=JSON.parse(raw);}catch{fail('Un champ Google sélectionné est invalide.');}if(!p||!WRITABLE.includes(p.field)||!p.value||typeof p.value!=='object'||Array.isArray(p.value))fail('Un champ Google sélectionné est invalide.');return p;}
function extrasOf(payload){const extras=[];for(const field of WRITABLE){const values=payload[field]||[];if(field==='organizations')for(const v of values)extras.push(extra(field,v));else if(!CORE.has(field))for(const v of values)extras.push(extra(field,v));}return unique(extras);}
function toContacts(people,{country='',accountId=null}={}){
 if(accountId!==null&&(!safeId(accountId)||accountId==='people/me'))fail('Le compte Google n’a pas pu être identifié.');
 if(!Array.isArray(people)||people.length>10000)fail('Le carnet Google dépasse 10 000 fiches ou sa réponse est invalide.');
 const seen=new Set(),result=[];
 for(const person of people){
  if(person.metadata?.deleted||!(person.metadata?.sources||[]).some(s=>s.type==='CONTACT'))continue;
  if(!safeId(person.resourceName)||seen.has(person.resourceName))fail('La réponse Google contient une fiche invalide ou répétée.');seen.add(person.resourceName);contactSource(person);
  const payload=payloadOf(person),nameEntry=contactEntries(person,'names')[0];
  if(nameEntry&&payload.names?.length&&!Object.keys(payload.names[0]).length)payload.names[0]={unstructuredName:nameOf(nameEntry)};
  for(const field of SINGLETON)if((payload[field]||[]).length>1)fail('Une fiche Google contient plusieurs valeurs incompatibles pour un champ unique.');
  result.push({id:person.resourceName,name:nameOf(nameEntry)||'Sans nom',emails:unique((payload.emailAddresses||[]).map(v=>v.value).filter(Boolean)),phones:unique((payload.phoneNumbers||[]).map(v=>v.value).filter(Boolean)),company:payload.organizations?.[0]?.name||'',birthday:birthdayOf(payload.birthdays?.[0]),notes:payload.biographies?.[0]?.value||'',country:String(country||'').toUpperCase(),source:'Google Contacts',extras:extrasOf(payload),_google:{kind:'original',accountId,keeper:person.resourceName,sources:{[person.resourceName]:clone(person)},payload}});
 }
 return result;
}
function describe(raw){const {field,value}=parseExtra(raw);const labels={addresses:'Adresse',calendarUrls:'Calendrier',clientData:'Donnée personnalisée',events:'Événement',externalIds:'Identifiant',genders:'Genre',imClients:'Messagerie',interests:'Centre d’intérêt',locales:'Langue',locations:'Lieu',memberships:'Groupe Google',miscKeywords:'Mot-clé',nicknames:'Surnom',occupations:'Profession',organizations:'Organisation',relations:'Relation',sipAddresses:'Adresse SIP',urls:'Site web',userDefined:'Champ personnalisé'};let text=field==='memberships'?'conservé':value.formattedValue||value.value||value.name||value.username||value.url||value.country||value.streetAddress||value.city||value.type||'';if(field==='organizations')text=[value.name,value.title,value.department,value.type].filter(Boolean).join(' · ');if(field==='userDefined')text=[value.key,value.value].filter(Boolean).join(' : ');const full=(labels[field]||field)+(text?' · '+text:'');return full.length>160?full.slice(0,157)+'…':full;}
function sourcesOf(a,b){return {...(a._google?.sources||{}),...(b._google?.sources||{})};}
function selectedPhotos(sources,keeper){const current=(sources[keeper]?.photos||[]).filter(p=>!p.default&&(!p.metadata?.source?.type||p.metadata.source.type==='CONTACT')).map(p=>p.url);for(const [id,person]of Object.entries(sources))if(id!==keeper)for(const photo of person.photos||[])if(!photo.default&&(!photo.metadata?.source?.type||photo.metadata.source.type==='CONTACT')&&!current.includes(photo.url))return false;return true;}
function selectedReadOnly(sources,keeper,field){const kept=new Set(contactEntries(sources[keeper]||{},field).map(v=>JSON.stringify(cleanEntry(v))));return Object.entries(sources).every(([id,p])=>id===keeper||contactEntries(p,field).every(v=>kept.has(JSON.stringify(cleanEntry(v)))));}
function mergeIssue(a,b,selection={}){
 if(!a._google||!b._google)return 'Les fiches Google doivent être fusionnées avec d’autres fiches du même carnet Google.';
 if(!a._google.accountId||a._google.accountId!==b._google.accountId)return 'Les fiches doivent appartenir au même compte Google identifié.';
 const sources=sourcesOf(a,b),keeper=selection.keeper||a.id;
 if(!safeId(keeper)||!sources[keeper])return 'Choisis la fiche Google à conserver.';
 if(!selectedReadOnly(sources,keeper,'skills'))return 'Une compétence Google appartient à une fiche qui serait supprimée et ne peut pas être transférée par cette API. Choisis la fiche qui la conserve ou garde les fiches séparées.';
 if(!selectedReadOnly(sources,keeper,'coverPhotos'))return 'Une photo de couverture Google ne peut pas être transférée par cette API. Choisis la fiche qui la conserve ou garde les fiches séparées.';
 if(!selectedPhotos(sources,keeper))return 'Une photo appartient à une fiche qui serait supprimée. Choisis comme fiche conservée celle qui porte cette photo, ou garde les fiches séparées.';
 const allowed=new Set([...(a.extras||[]),...(b.extras||[])]),chosen=selection.extras??[...allowed];
 if(!Array.isArray(chosen)||chosen.some(raw=>!allowed.has(raw)))return 'La sélection des champs Google est invalide.';
 const extras=chosen.map(parseExtra),genders=dedup(extras.filter(e=>e.field==='genders').map(e=>e.value));
 if(genders.length>1)return 'Choisis une seule valeur de genre dans les autres champs avant de fusionner.';
 const hadMemberships=Object.values(sources).some(p=>(p.memberships||[]).length);
 if(hadMemberships&&!extras.some(e=>e.field==='memberships'&&e.value.contactGroupMembership))return 'Conserve au moins un groupe Google dans les autres champs.';
 return '';
}
function withMergeMetadata(a,b,selection,merged){
 const issue=mergeIssue(a,b,selection);if(issue)fail(issue);
 const sources=sourcesOf(a,b),keeper=selection.keeper||a.id,payload={},inputs=[a,b],raw=field=>inputs.flatMap(c=>c._google.payload[field]||[]);
 const chosenNames=inputs.find(c=>c.name===merged.name)?._google.payload.names||[];
 if(merged.name)payload.names=chosenNames.length?clone(chosenNames):[{unstructuredName:merged.name}];
 for(const [field,core]of [['emailAddresses','emails'],['phoneNumbers','phones']]){
  const values=merged[core]||[];payload[field]=dedup(values.flatMap(value=>{const found=raw(field).filter(v=>v.value===value);return found.length?found:[{value}];}));
 }
 if(merged.birthday){const found=raw('birthdays').find(v=>birthdayOf(v)===merged.birthday);payload.birthdays=[found?clone(found):{text:merged.birthday}];}
 if(merged.notes){const found=raw('biographies').find(v=>v.value===merged.notes);payload.biographies=[found?clone(found):{value:merged.notes,contentType:'TEXT_PLAIN'}];}
 const chosenExtras=selection.extras??unique([...(a.extras||[]),...(b.extras||[])]);
 for(const encoded of chosenExtras){const {field,value}=parseExtra(encoded);payload[field]??=[];payload[field].push(clone(value));}
 for(const field of Object.keys(payload))payload[field]=dedup(payload[field]);
 return {...merged,id:keeper,company:payload.organizations?.[0]?.name||'',source:'Google Contacts · fusion locale',extras:unique(chosenExtras),_google:{kind:'merged',accountId:a._google.accountId,keeper,sources:clone(sources),payload}};
}
function plan(originalContacts,currentContacts,{deletedIds=[]}={}){
 if(!originalContacts.length&&!currentContacts.length)return {accountId:null,operations:[],updatedCount:0,deletedCount:0};
 const accounts=unique(originalContacts.map(c=>c._google?.accountId));if(accounts.length!==1||!safeId(accounts[0])||accounts[0]==='people/me')fail('Le compte Google initial n’est pas identifié. Recharge le carnet.');const accountId=accounts[0];
 const baseline={};for(const c of originalContacts){if(!c._google)fail('Le carnet initial Google est manquant.');for(const [id,p]of Object.entries(c._google.sources))baseline[id]=p;}
 if(!Array.isArray(deletedIds)||new Set(deletedIds).size!==deletedIds.length||deletedIds.some(id=>!safeId(id)||!baseline[id]))fail('La liste des suppressions Google est invalide.');const removed=new Set(deletedIds);
 const used=new Set(),operations=[];
 for(const c of currentContacts){if(!c._google||c._google.accountId!==accountId)fail('Le carnet courant mélange plusieurs sources incompatibles.');const meta=c._google,ids=Object.keys(meta.sources||{});for(const id of ids){if(!safeId(id)||!baseline[id]||used.has(id)||removed.has(id))fail('Le plan de fusion Google est incohérent.');used.add(id);if(sourceVersion(meta.sources[id])!==sourceVersion(baseline[id]))fail('Une version locale Google est incohérente. Recharge le carnet.');}
  if(meta.kind!=='merged'||ids.length<2)continue;
  const keeper=meta.keeper;if(!safeId(keeper)||!ids.includes(keeper)||c.id!==keeper)fail('La fiche Google conservée est invalide.');
  if(!selectedReadOnly(meta.sources,keeper,'skills')||!selectedReadOnly(meta.sources,keeper,'coverPhotos'))fail('Cette fusion supprimerait un champ Google qui ne peut pas être transféré.');
  if(!selectedPhotos(meta.sources,keeper))fail('Cette fusion supprimerait une photo non transférée.');
  const payload={};for(const field of WRITABLE)if(meta.payload[field])payload[field]=meta.payload[field].map(cleanEntry);
  for(const field of SINGLETON)if((payload[field]||[]).length>1)fail('Une fusion Google contient plusieurs valeurs pour un champ unique.');
  const mask=WRITABLE.filter(field=>(payload[field]||[]).length||ids.some(id=>(contactEntries(baseline[id],field)||[]).length));
  if(mask.includes('memberships')&&!(payload.memberships||[]).some(m=>m.contactGroupMembership))fail('Une fusion Google doit conserver au moins un groupe.');
  const body={};for(const field of mask)body[field]=payload[field]||[];
  operations.push({keeper,body,fields:mask,remove:ids.filter(id=>id!==keeper),expected:Object.fromEntries(ids.map(id=>[id,sourceVersion(baseline[id])]))});
 }
 if(Object.keys(baseline).some(id=>!used.has(id)&&!removed.has(id)))fail('Une fiche Google manque dans le plan local. Recharge le carnet avant de continuer.');
 const deletions=deletedIds.map(id=>({id,expected:sourceVersion(baseline[id])}));
 return {accountId,operations,deletions,updatedCount:operations.length,deletedCount:deletions.length+operations.reduce((sum,o)=>sum+o.remove.length,0)};
}
function validToken(token){if(typeof token!=='string'||!token||/\s/.test(token))fail('La connexion Google a expiré. Reconnecte ton compte.');}
class ApiError extends Error{constructor(message,{code,uncertain=false}={}){super(message);this.code=code;this.uncertain=uncertain;}}
async function request(token,url,{method='GET',body,fetchImpl}={}){
 validToken(token);const write=method!=='GET';let response;
 try{response=await fetchImpl(url,{method,headers:{Authorization:'Bearer '+token,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),cache:'no-store',redirect:'error'});}catch{throw new ApiError(write?'La réponse Google est inconnue. Recharge le carnet avant toute nouvelle action.':'Google est momentanément inaccessible. Réessaie la connexion.',{code:'NETWORK',uncertain:write});}
 if(!response.ok)throw new ApiError(response.status===401?'La connexion Google a expiré. Reconnecte ton compte.':response.status===403?'Google refuse cet accès. Vérifie les autorisations de l’app.':response.status===400?'Google a refusé la modification. Recharge le carnet avant de continuer.':'Google n’a pas pu terminer cette opération. Recharge le carnet.',{code:'HTTP_'+response.status,uncertain:write&&response.status>=500});
 if(method==='DELETE')return null;
 try{return await response.json();}catch{throw new ApiError('La réponse Google est illisible. Recharge le carnet.',{code:'INVALID_RESPONSE',uncertain:write});}
}
async function load(token,{country='',fetchImpl=root.fetch}={}){
 validToken(token);if(typeof fetchImpl!=='function')fail('Le navigateur ne permet pas la connexion Google.');
 const accountId=await readAccount(token,fetchImpl);
 const people=[],seenTokens=new Set();let pageToken='',bytes=0;
 do{const url=new URL(BASE+'people/me/connections');url.searchParams.set('personFields',READ_FIELDS);url.searchParams.set('sources','READ_SOURCE_TYPE_CONTACT');url.searchParams.set('pageSize','1000');if(pageToken)url.searchParams.set('pageToken',pageToken);
  const data=await request(token,url.toString(),{fetchImpl});if(!data||!Array.isArray(data.connections??[]))fail('La réponse du carnet Google est invalide.');
  if(data.totalItems>10000)fail('Le carnet Google dépasse 10 000 fiches.');people.push(...(data.connections||[]));if(people.length>10000)fail('Le carnet Google dépasse 10 000 fiches.');
  bytes+=new TextEncoder().encode(JSON.stringify(data.connections||[])).length;if(bytes>20*1024*1024)fail('Le carnet Google dépasse la limite de 20 Mo.');
  pageToken=data.nextPageToken||'';if(typeof pageToken!=='string'||(pageToken&&seenTokens.has(pageToken)))fail('La pagination Google est invalide.');if(pageToken)seenTokens.add(pageToken);
 }while(pageToken);
 const complete=await hydrateCapped(token,people,fetchImpl);
 const contacts=toContacts(complete,{country,accountId});contacts.accountId=accountId;return contacts;
}
async function hydrateCapped(token,people,fetchImpl){
 // connections.list truncates emails and phone numbers at 100 entries.
 // getBatchGet supplies the complete arrays before the local baseline exists.
 const capped=people.filter(p=>(p.metadata?.sources||[]).some(s=>s.type==='CONTACT')&&((p.emailAddresses||[]).length>=100||(p.phoneNumbers||[]).length>=100)),hydrated=new Map();
 for(let offset=0;offset<capped.length;offset+=50){
  const batch=capped.slice(offset,offset+50),requested=new Map();
  const url=new URL(BASE+'people:batchGet');url.searchParams.set('personFields',READ_FIELDS);url.searchParams.set('sources','READ_SOURCE_TYPE_CONTACT');
  for(const p of batch){if(!safeId(p.resourceName)||requested.has(p.resourceName))fail('La réponse Google contient une fiche invalide ou répétée.');contactSource(p);requested.set(p.resourceName,p);url.searchParams.append('resourceNames',p.resourceName);}
  const data=await request(token,url.toString(),{fetchImpl});
  if(!data||!Array.isArray(data.responses)||data.responses.length!==requested.size)fail('Google n’a pas renvoyé toutes les coordonnées. Aucun carnet partiel n’a été chargé.');
  for(const entry of data.responses){
   const prior=requested.get(entry.requestedResourceName),p=entry.person;
   if(!prior||hydrated.has(entry.requestedResourceName)||entry.status?.code||(entry.httpStatusCode&&entry.httpStatusCode!==200)||!p||p.resourceName!==entry.requestedResourceName||p.metadata?.deleted||contactSource(p).id!==contactSource(prior).id)fail('Une fiche Google a changé ou n’a pas pu être lue entièrement. Recharge le carnet.');
   hydrated.set(p.resourceName,p);
  }
 }
 const complete=people.map(p=>hydrated.get(p.resourceName)||p);
 if(new TextEncoder().encode(JSON.stringify(complete)).length>20*1024*1024)fail('Le carnet Google complet dépasse la limite de 20 Mo.');
 return complete;
}
async function readAccount(token,fetchImpl){const person=await request(token,BASE+'people/me?personFields=metadata',{fetchImpl});if(!safeId(person?.resourceName)||person.resourceName==='people/me')throw new ApiError('Le compte Google n’a pas pu être identifié. Reconnecte-le.',{code:'INVALID_ACCOUNT'});return person.resourceName;}
function readUrl(id){if(!safeId(id))fail('Identifiant Google invalide.');const url=new URL(BASE+id);url.searchParams.set('personFields',READ_FIELDS);url.searchParams.set('sources','READ_SOURCE_TYPE_CONTACT');return url.toString();}
function validatePlan(value){if(!value||!safeId(value.accountId)||value.accountId==='people/me'||!Array.isArray(value.operations))fail('Le plan Google est invalide.');const seen=new Set();for(const op of value.operations){if(!safeId(op.keeper)||!Array.isArray(op.remove)||!Array.isArray(op.fields)||!op.fields.length||op.fields.some(f=>!WRITABLE.includes(f))||!op.expected||!op.body||typeof op.body!=='object')fail('Le plan Google est invalide.');for(const id of [op.keeper,...op.remove]){if(!safeId(id)||seen.has(id)||typeof op.expected[id]!=='string')fail('Le plan Google est invalide.');seen.add(id);}if(Object.keys(op.body).some(f=>!op.fields.includes(f)||!Array.isArray(op.body[f])||(SINGLETON.has(f)&&op.body[f].length>1)))fail('Le plan Google est invalide.');}if(value.deletions!==undefined&&!Array.isArray(value.deletions))fail('Le plan Google est invalide.');for(const entry of value.deletions||[]){if(!safeId(entry.id)||seen.has(entry.id)||typeof entry.expected!=='string')fail('La liste des suppressions Google est invalide.');seen.add(entry.id);}}
function containsValue(expected,actual){
 if(Array.isArray(expected))return Array.isArray(actual)&&expected.every(e=>actual.some(a=>containsValue(e,a)));
 if(expected&&typeof expected==='object')return !!actual&&Object.entries(expected).every(([k,v])=>containsValue(v,actual[k]));
 return expected===actual;
}
function verifiedUpdate(person,body){const actual=payloadOf(person);return Object.entries(body).every(([field,values])=>values.length?values.every(v=>(actual[field]||[]).some(a=>containsValue(v,a))):!(actual[field]||[]).length);}
async function apply(token,mergePlan,{fetchImpl=root.fetch}={}){
 const result={ok:false,updated:[],deleted:[],uncertain:false,stage:'preflight'};
 try{
  validToken(token);validatePlan(mergePlan);result.stage='account-check';if(await readAccount(token,fetchImpl)!==mergePlan.accountId)throw new ApiError('Le compte Google choisi n’est pas celui du carnet ouvert. Reconnecte le même compte.',{code:'ACCOUNT_MISMATCH'});result.stage='preflight';const latest=new Map();
  for(const op of mergePlan.operations)for(const id of [op.keeper,...op.remove]){const p=await request(token,readUrl(id),{fetchImpl});if(p.resourceName!==id||sourceVersion(p)!==op.expected[id])throw new ApiError('Le carnet Google a changé depuis la lecture. Recharge-le avant de fusionner.',{code:'CONFLICT'});latest.set(id,p);}
  for(const entry of mergePlan.deletions||[]){const p=await request(token,readUrl(entry.id),{fetchImpl});if(p.resourceName!==entry.id||sourceVersion(p)!==entry.expected)throw new ApiError('Une fiche à supprimer a changé. Recharge le carnet.',{code:'CONFLICT'});latest.set(entry.id,p);}
  for(const op of mergePlan.operations){
   result.stage='update';const body={...clone(op.body),resourceName:op.keeper,metadata:{sources:[clone(contactSource(latest.get(op.keeper)))]}};const url=new URL(BASE+op.keeper+':updateContact');url.searchParams.set('updatePersonFields',op.fields.join(','));url.searchParams.set('personFields',READ_FIELDS);url.searchParams.set('sources','READ_SOURCE_TYPE_CONTACT');
   const updated=await request(token,url.toString(),{method:'PATCH',body,fetchImpl});
   if(updated?.resourceName!==op.keeper)throw new ApiError('La confirmation Google est incomplète. Recharge le carnet.',{code:'INVALID_RESPONSE',uncertain:true});
   result.updated.push(op.keeper);if(!verifiedUpdate(updated,op.body))throw new ApiError('Google n’a pas confirmé tous les champs de la fiche fusionnée. Aucun doublon de ce groupe n’a été supprimé ; recharge le carnet.',{code:'INCOMPLETE_UPDATE'});
   // DELETE has no documented conditional version parameter. This final read
   // narrows, but cannot eliminate, a concurrent-write race before deletion.
   for(const id of op.remove){result.stage='delete-check';const current=await request(token,readUrl(id),{fetchImpl});if(current.resourceName!==id||sourceVersion(current)!==op.expected[id])throw new ApiError('Une fiche à retirer a changé. La fiche fusionnée est conservée ; recharge le carnet.',{code:'CONFLICT'});result.stage='delete';await request(token,BASE+id+':deleteContact',{method:'DELETE',fetchImpl});result.deleted.push(id);}
  }
  for(const entry of mergePlan.deletions||[]){result.stage='delete-check';const p=await request(token,readUrl(entry.id),{fetchImpl});if(p.resourceName!==entry.id||sourceVersion(p)!==entry.expected)throw new ApiError('Une fiche à supprimer a changé. Recharge le carnet.',{code:'CONFLICT'});result.stage='delete';await request(token,BASE+entry.id+':deleteContact',{method:'DELETE',fetchImpl});result.deleted.push(entry.id);}
  result.ok=true;result.stage='complete';return result;
 }catch(error){result.uncertain=!!error.uncertain;result.error=error instanceof ApiError?error.message:'Le plan Google n’a pas pu être appliqué. Recharge le carnet avant de continuer.';result.code=error.code||'INVALID_PLAN';return result;}
}
const GoogleContacts={load,toContacts,mergeIssue,withMergeMetadata,describe,plan,apply,READ_FIELDS,WRITABLE};root.GoogleContacts=GoogleContacts;if(typeof module!=='undefined'&&module.exports)module.exports=GoogleContacts;
})(globalThis);
