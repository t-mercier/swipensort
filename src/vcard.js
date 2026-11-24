(function(root){
'use strict';
const LIMIT_BYTES=20*1024*1024,LIMIT_CONTACTS=10000;
const uniq=values=>[...new Set(values)];
const fail=message=>{throw new Error(message);};
function split(value,separator){const out=[];let part='',escaped=false,quoted=false;for(const ch of value){if(escaped){part+='\\'+ch;escaped=false;continue;}if(ch==='\\'){escaped=true;continue;}if(ch==='"')quoted=!quoted;if(ch===separator&&!quoted){out.push(part);part='';}else part+=ch;}if(escaped)part+='\\';out.push(part);return out;}
function unescapeText(value){return value.replace(/\\([nN,;\\])/g,(_,ch)=>ch==='n'||ch==='N'?'\n':ch);}
function escapeText(value){return String(value??'').replace(/\r\n|\r/g,'\n').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'');}
function property(line){
 if(typeof line!=='string'||/[\r\n\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(line))fail('Propriété vCard invalide.');
 let quoted=false,colon=-1;for(let i=0;i<line.length;i++){if(line[i]==='"'&&line[i-1]!=='\\')quoted=!quoted;if(line[i]===':'&&!quoted){colon=i;break;}}
 if(colon<1||quoted)fail('Une propriété vCard est mal formée.');
 const head=line.slice(0,colon),parts=split(head,';'),full=parts.shift(),match=/^(?:([A-Za-z0-9-]+)\.)?([A-Za-z0-9-]+)$/.exec(full);
 if(!match)fail('Nom de propriété vCard invalide.');
 const name=match[2].toUpperCase(),params={};
 if(name==='BEGIN'||name==='END')fail('Une propriété de structure vCard est invalide.');
 for(const part of parts){const equal=part.indexOf('=');if(equal<1)fail('Un paramètre vCard est mal formé.');const key=part.slice(0,equal).toUpperCase(),v=part.slice(equal+1);if(!/^[A-Z0-9-]+$/.test(key)||!v||v.startsWith('"')!==v.endsWith('"'))fail('Un paramètre vCard est mal formé.');params[key]=v.replace(/^"|"$/g,'');}
 if(params.CHARSET&&!/^UTF-?8$/i.test(params.CHARSET))fail('Encodage de caractères non pris en charge. Exporte les contacts en vCard UTF-8.');
 if(params.ENCODING&&!(['PHOTO','LOGO','SOUND','KEY'].includes(name)&&/^(B|BASE64)$/i.test(params.ENCODING)))fail('Encodage vCard non pris en charge. Exporte les contacts en vCard 3.0 ou 4.0 UTF-8.');
 return {raw:line,name,group:match[1]||'',params,value:line.slice(colon+1)};
}
function phoneValue(p){return unescapeText(p.value).replace(/^tel:/i,'');}
function displayValue(p){if(p.name==='TEL')return phoneValue(p);if(p.name==='ORG')return split(p.value,';').map(unescapeText).filter(Boolean).join(' · ');return unescapeText(p.value);}
function snapshot(c){return JSON.stringify([c.name,c.emails,c.phones,c.company,c.birthday,c.notes,c.country,c.extras]);}
function parse(text,options={}){
 if(typeof text!=='string')fail('Le fichier vCard doit contenir du texte UTF-8.');
 if(new TextEncoder().encode(text).length>LIMIT_BYTES)fail('Le fichier dépasse la limite de 20 Mo.');
 if(text.includes('\ufffd'))fail('Le fichier contient des caractères UTF-8 illisibles. Exporte une nouvelle copie UTF-8.');
 const physical=text.replace(/^\uFEFF/,'').replace(/\r\n|\r/g,'\n').split('\n'),lines=[];
 for(const line of physical){if(/^[ \t]/.test(line)){if(!lines.length)fail('Ligne vCard repliée sans propriété précédente.');lines[lines.length-1]+=line.slice(1);}else if(line!=='')lines.push(line);}
 let active=null;const cards=[];
 for(const line of lines){if(/^BEGIN:VCARD$/i.test(line)){if(active)fail('Début de fiche vCard imbriqué.');active=[];continue;}if(/^END:VCARD$/i.test(line)){if(!active)fail('Fin de fiche vCard sans début.');cards.push(active);active=null;if(cards.length>LIMIT_CONTACTS)fail('Le fichier dépasse la limite de 10 000 contacts.');continue;}if(!active)fail('Le fichier contient du texte en dehors des fiches vCard.');active.push(property(line));}
 if(active)fail('Une fiche vCard est incomplète.');if(!cards.length)fail('Aucun contact vCard trouvé dans ce fichier.');
 const prefix=String(options.idPrefix||'import-'+Date.now().toString(36));
 return cards.map((props,index)=>{
  const get=name=>props.filter(p=>p.name===name),one=name=>get(name)[0];
  for(const name of ['VERSION','FN','N','UID','BDAY'])if(get(name).length>1)fail('Une fiche contient plusieurs propriétés uniques incompatibles.');
  const version=one('VERSION')?.value;if(!['3.0','4.0'].includes(version))fail('Version vCard non prise en charge. Exporte en vCard 3.0 ou 4.0 UTF-8.');
  if(props.some(p=>['BEGIN','END'].includes(p.name)))fail('Structure vCard invalide.');
  const fn=one('FN'),n=one('N');let name=fn?displayValue(fn):'';
  if(!name&&n){const parts=split(n.value,';').map(unescapeText);name=[parts[3],parts[1],parts[2],parts[0],parts[4]].filter(Boolean).join(' ');}
  if(!name)name='Sans nom';
  const core=new Set(['VERSION','FN','N','UID','EMAIL','TEL','ORG','BDAY','NOTE']);
  const extras=props.filter(p=>!core.has(p.name)||(p.name==='ORG'&&p!==one('ORG'))||(p.name==='NOTE'&&p!==one('NOTE'))).map(p=>p.raw);
  const c={id:prefix+'-'+index,name,emails:uniq(get('EMAIL').map(displayValue).filter(Boolean)),phones:uniq(get('TEL').map(displayValue).filter(Boolean)),company:one('ORG')?displayValue(one('ORG')):'',birthday:one('BDAY')?displayValue(one('BDAY')):'',notes:one('NOTE')?displayValue(one('NOTE')):'',country:String(options.country||'').toUpperCase(),source:String(options.source||'Carnet importé'),extras};
  c._vcard={kind:'original',version,properties:props.map(p=>p.raw),snapshot:snapshot(c)};return c;
 });
}
function describe(line){const p=property(line);const names={ADR:'Adresse',PHOTO:'Photo',LOGO:'Logo',SOUND:'Son',KEY:'Clé',URL:'Site web',CATEGORIES:'Catégories',NICKNAME:'Surnom',TITLE:'Fonction',ROLE:'Rôle',ORG:'Organisation supplémentaire',NOTE:'Note supplémentaire',ANNIVERSARY:'Anniversaire',RELATED:'Relation'};const label=names[p.name]||p.name;if(['PHOTO','LOGO','SOUND','KEY'].includes(p.name))return label+' · contenu conservé';let value=p.name==='ADR'?split(p.value,';').map(unescapeText).filter(Boolean).join(', '):displayValue(p);value=value.replace(/\s+/g,' ').trim();return label+(value?' · '+(value.length>160?value.slice(0,157)+'…':value):'');}
function mergeIssue(a,b){
 const versions=uniq([a._vcard?.version,b._vcard?.version].filter(Boolean));
 if(versions.length>1)return 'Ces fiches utilisent des versions vCard différentes. Exporte les deux carnets dans la même version avant de les fusionner.';
 const references=[a,b].flatMap(c=>c._vcard?.properties||[]).map(property).some(p=>p.name==='CLIENTPIDMAP'||p.params.PID||p.params.ALTID);
 if(references)return 'Ces fiches utilisent des références vCard avancées. Leur fusion n’est pas prise en charge ; leurs originaux restent exportables.';
 return '';
}
function withMergeMetadata(a,b,selection,merged){
 const issue=mergeIssue(a,b);if(issue)fail(issue);
 const versions=uniq([a._vcard?.version,b._vcard?.version].filter(Boolean));
 const allowed=new Set([...(a.extras||[]),...(b.extras||[])]),extras=selection.extras??[...allowed];
 if(!Array.isArray(extras)||extras.some(line=>!allowed.has(line)))fail('Sélection de champs supplémentaires invalide.');
 const remap=(line,index)=>{const p=property(line);return p.group?'sns'+index+'-'+line:line;};
 const sourceProperties=[a,b].map(contact=>contact._vcard?.kind==='merged'?cardLines(contact).slice(1,-1):(contact._vcard?.properties||[]));
 const properties=sourceProperties.flatMap((lines,index)=>lines.map(line=>remap(line,index)));
 const selectedExtras=[a,b].flatMap((contact,index)=>(contact.extras||[]).filter(line=>extras.includes(line)).map(line=>remap(line,index)));
 const sourceIndex=[a,b].findIndex(c=>c.name===merged.name&&c._vcard);
 const nameProperties=sourceIndex>=0?sourceProperties[sourceIndex].filter(line=>['FN','N'].includes(property(line).name)).map(line=>remap(line,sourceIndex)):[];
 return {...merged,extras:uniq(selectedExtras),_vcard:{kind:'merged',version:versions[0]||'3.0',properties,nameProperties}};
}
function fold(line){let current='',bytes=0,result='';for(const char of line){const code=char.codePointAt(0),n=code<=0x7f?1:code<=0x7ff?2:code<=0xffff?3:4;if(bytes+n>75){result+=current+'\r\n';current=' ';bytes=1;}current+=char;bytes+=n;}return result+current;}
function cardLines(c){
 const meta=c._vcard;
 if(meta?.kind==='original'){
  if(meta.snapshot!==snapshot(c))fail('Une fiche originale a été modifiée sans aperçu de fusion.');
  const props=meta.properties.map(property);if(props.filter(p=>p.name==='VERSION').length!==1)fail('Version de fiche invalide.');return ['BEGIN:VCARD',...props.map(p=>p.raw),'END:VCARD'];
 }
 const version=meta?.version||'3.0';if(!['3.0','4.0'].includes(version))fail('Version de fiche invalide.');
 const lines=['BEGIN:VCARD','VERSION:'+version,'UID:'+escapeText(c.id)];
 const nameProperties=(meta?.nameProperties||[]).map(property);const fn=nameProperties.find(p=>p.name==='FN'),n=nameProperties.find(p=>p.name==='N');
 lines.push(fn?.raw||'FN:'+escapeText(c.name||'Sans nom'),n?.raw||'N:;'+escapeText(c.name||'Sans nom')+';;;');
 const props=(meta?.properties||[]).map(property);
 for(const [field,propertyName]of [['emails','EMAIL'],['phones','TEL']])for(const value of uniq(c[field]||[])){
  const originals=uniq(props.filter(p=>p.name===propertyName&&displayValue(p)===value).map(p=>p.raw));
  if(originals.length)lines.push(...originals);else lines.push(propertyName+':'+escapeText(value));
 }
 for(const [field,propertyName]of [['company','ORG'],['birthday','BDAY'],['notes','NOTE']])if(c[field]){
  const original=props.find(p=>p.name===propertyName&&displayValue(p)===c[field]);
  lines.push(original?.raw||propertyName+':'+escapeText(c[field]));
 }
 for(const raw of uniq(c.extras||[])){const p=property(raw);if(['BEGIN','END','VERSION','UID','FN','N','EMAIL','TEL','BDAY'].includes(p.name))fail('Champ supplémentaire réservé.');lines.push(p.raw);}
 lines.push('END:VCARD');return lines;
}
function exportCards(contacts){return contacts.map(c=>cardLines(c).map(fold).join('\r\n')).join('\r\n')+'\r\n';}
const VCards={parse,export:exportCards,withMergeMetadata,mergeIssue,describe,LIMIT_BYTES,LIMIT_CONTACTS};root.VCards=VCards;if(typeof module!=='undefined'&&module.exports)module.exports=VCards;
})(globalThis);
