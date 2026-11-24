(function (root) {
'use strict';
const clean = v => String(v ?? '').normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[’']/g,'').replace(/[^\p{L}\p{N}]+/gu,' ').trim();
const email = v => String(v ?? '').trim().toLowerCase();
const unique = values => [...new Set(values.filter(v => String(v).trim()).map(v => String(v).trim()))];
const regions = {FR:['33',9,true],NL:['31',9,true],GB:['44',10,true],US:['1',10,false],CA:['1',10,false],DE:['49',[7,12],true],BE:['32',[8,9],true],ES:['34',9,false],IT:['39',[6,11],false]};
function normalizePhone(value,country) {
 let raw=String(value ?? '').trim();
 if(!raw || /[a-z#;,]/i.test(raw) || !/^[+\d\s().-]+$/.test(raw)) return null;
 let international=raw.startsWith('+') || raw.startsWith('00');
 let digits=raw.replace(/\D/g,'');
 if(raw.startsWith('00')) digits=digits.slice(2);
 if(international) return /^[1-9]\d{6,14}$/.test(digits)?'+'+digits:null;
 country=String(country ?? '').toUpperCase(); const rule=regions[country]; if(!rule) return null;
 if(rule[2] && digits.startsWith('0')) digits=digits.slice(1);
 if((country==='US'||country==='CA') && digits.length===11 && digits.startsWith('1')) digits=digits.slice(1);
 const length=rule[1];
 if(Array.isArray(length)?digits.length<length[0]||digits.length>length[1]:digits.length!==length) return null;
 if(!digits || digits.length+rule[0].length>15) return null;
 return '+'+rule[0]+digits;
}
function preferredPhones(a,b) {
 const variants=new Map();
 for(const contact of [a,b])for(const raw of contact.phones||[]){
  if(!variants.has(raw))variants.set(raw,new Set());
  variants.get(raw).add(normalizePhone(raw,contact.country));
 }
 const canonical=new Map();
 for(const [raw,forms] of variants)if(forms.size===1&&!forms.has(null))canonical.set(raw,[...forms][0]);
 const preferred=new Map();
 for(const [raw,number] of canonical){
  if(!/^(?:\+|00)/.test(raw.trim()))continue;
  const prior=preferred.get(number);
  if(!prior || (raw.trim().startsWith('+')&&!prior.trim().startsWith('+')))preferred.set(number,raw);
 }
 return [...variants.keys()].filter(raw=>!preferred.has(canonical.get(raw))||preferred.get(canonical.get(raw))===raw);
}
const nicknames = [['alexandre','alexander','alexandra','alex'],['thomas','tom','tommy'],['william','bill','billy','will'],['robert','bob','bobby','rob'],['elizabeth','liz','beth','lizzie'],['nicolas','nicholas','nick','nico'],['timothee','timothy','tim'],['catherine','katherine','kate','kat'],['benjamin','ben'],['michael','mike'],['sophie','sophia'],['joseph','joe'],['charles','charlie']];
const canon = token => { const group=nicknames.find(g=>g.includes(token)); return group?group[0]:token; };
function distance(a,b) {
 if(Math.abs(a.length-b.length)>1)return 2;
 let i=0,j=0,edits=0;
 while(i<a.length&&j<b.length){
  if(a[i]===b[j]){i++;j++;continue;}
  if(++edits>1)return 2;
  if(a.length>=b.length)i++;
  if(b.length>=a.length)j++;
 }
 return edits+(i<a.length||j<b.length?1:0);
}
function nameEvidence(a,b) {
 const x=clean(a).split(' ').filter(Boolean),y=clean(b).split(' ').filter(Boolean);
 if(!x.length||!y.length) return null;
 const sorted=t=>[...t].sort().join(' ');
 if(sorted(x)===sorted(y)) return {kind:'exact',score:80,reason:clean(a)===clean(b)?'Même nom, après normalisation des accents et de la casse.':'Même nom, avec prénom et nom réordonnés.'};
 if(x.length===y.length && sorted(x.map(canon))===sorted(y.map(canon))) return {kind:'nickname',score:70,reason:'Prénoms proches dans un dictionnaire de surnoms ; à confirmer.'};
 if(x.length===2 && y.length===2) {
  for(const p of [y,[y[1],y[0]]]) {
   if(x[1]===p[1] && x[1].length>=3 && (x[0].length===1||p[0].length===1) && x[0][0]===p[0][0]) return {kind:'initial',score:53,reason:'Même nom de famille et initiale compatible ; le prénom complet reste incertain.'};
   if(x[1]===p[1] && x[0].length>=4 && p[0].length>=4 && distance(x[0],p[0])===1) return {kind:'fuzzy',score:61,reason:'Même nom de famille et une lettre de différence dans le prénom.'};
   if(x[0]===p[0] && x[1].length>=5 && p[1].length>=5 && distance(x[1],p[1])===1) return {kind:'fuzzy',score:61,reason:'Même prénom et une lettre de différence dans le nom.'};
  }
 }
 return null;
}
function match(a,b) {
 const ae=unique(a.emails||[]).map(email),be=unique(b.emails||[]).map(email);
 const ap=unique((a.phones||[]).map(p=>normalizePhone(p,a.country)).filter(Boolean)),bp=unique((b.phones||[]).map(p=>normalizePhone(p,b.country)).filter(Boolean));
 const sharedEmail=ae.some(v=>be.includes(v)), sharedPhone=ap.some(v=>bp.includes(v));
 const name=nameEvidence(a.name,b.name), reasons=[],conflicts=[];
 if(!sharedEmail&&!sharedPhone&&!name) return null;
 let score=name?.score||0;
 if(name) reasons.push(name.reason);
 if(sharedEmail){score=Math.max(score,94);reasons.push('Adresse email commune, après suppression des espaces et normalisation de la casse.');}
 if(sharedPhone){score=Math.max(score,93);reasons.push('Numéro commun après normalisation du pays et du format téléphonique.');}
 if(sharedEmail&&sharedPhone)score=98;
 if(a.name&&b.name&&!name){conflicts.push('Les noms ne se ressemblent pas : une coordonnée peut être partagée.');score=Math.min(score,59);}
 if(ae.length&&be.length&&!sharedEmail)conflicts.push('Les adresses email diffèrent. Elles peuvent appartenir à deux personnes.');
 if(ap.length&&bp.length&&!sharedPhone)conflicts.push('Les numéros de téléphone diffèrent.');
 if(a.birthday&&b.birthday&&a.birthday!==b.birthday)conflicts.push('Les dates de naissance diffèrent.');
 if(a.company&&b.company&&clean(a.company)!==clean(b.company))conflicts.push('Les organisations diffèrent.');
 if(conflicts.length){score-=Math.min(18,conflicts.length*6);score=Math.max(score,35);}
 let level=score>=90?'strong':score>=68?'probable':'review';
 if(conflicts.length) level='review';
 const requiresConfirmation=!!((a.name&&b.name&&!name)||(a.birthday&&b.birthday&&a.birthday!==b.birthday));
 return {score,level,reasons,conflicts,requiresConfirmation};
}
function candidates(contacts){
 const count=contacts.length, pairs=new Set(), exact=new Map(), fuzzy=new Map(), initials=new Map(), fullInitials=new Map(), longTokens=new Map(), allLengths=new Map();
 const addPair=(a,b)=>{if(a!==b){pairs.add(Math.min(a,b)*count+Math.max(a,b));if(pairs.size>100000)throw new Error('Trop de correspondances possibles dans ce carnet. Importe des groupes plus petits pour continuer le tri.');}};
 const join=(map,key,index)=>{const prior=map.get(key);if(prior)for(const other of prior)addPair(other,index);};
 const put=(map,key,index)=>{if(!map.has(key))map.set(key,[]);const list=map.get(key);if(list[list.length-1]!==index)list.push(index);};
 const block=(map,key,index)=>{join(map,key,index);put(map,key,index);};
 contacts.forEach((contact,index)=>{
  for(const value of unique(contact.emails||[]))block(exact,'e:'+email(value),index);
  for(const value of unique((contact.phones||[]).map(p=>normalizePhone(p,contact.country)).filter(Boolean)))block(exact,'p:'+value,index);
  const tokens=clean(contact.name).split(' ').filter(Boolean);
  if(tokens.length){block(exact,'n:'+JSON.stringify([...tokens].sort()),index);block(exact,'k:'+JSON.stringify(tokens.map(canon).sort()),index);}
  if(tokens.length!==2)return;
  for(const [variable,fixed] of [tokens,[tokens[1],tokens[0]]]){
   const key=JSON.stringify([fixed,variable[0]]);
   if(fixed.length>=3){
    if(variable.length===1){join(fullInitials,key,index);block(initials,key,index);}
    else{join(initials,key,index);put(fullInitials,key,index);}
   }
   if(variable.length<4)continue;
   // Deletion signatures cover one insertion, deletion or substitution. Long
   // tokens use adjacent-length blocks to preserve matches without large signatures.
   if(variable.length>64){
    for(const length of [variable.length-1,variable.length,variable.length+1])join(allLengths,JSON.stringify([fixed,length]),index);
   } else {
    join(longTokens,JSON.stringify([fixed,variable.length]),index);
    const signatures=new Set([variable]);for(let i=0;i<variable.length;i++)signatures.add(variable.slice(0,i)+variable.slice(i+1));
    for(const signature of signatures)block(fuzzy,JSON.stringify([fixed,signature]),index);
   }
   put(allLengths,JSON.stringify([fixed,variable.length]),index);
   if(variable.length>64)for(const length of [variable.length-1,variable.length,variable.length+1])put(longTokens,JSON.stringify([fixed,length]),index);
  }
 });
 const result=[];
 for(const pair of [...pairs].sort((a,b)=>a-b)){const i=Math.floor(pair/count),j=pair%count,m=match(contacts[i],contacts[j]);if(m)result.push({a:contacts[i].id,b:contacts[j].id,...m});}
 Smart.lastStats={records:count,possiblePairs:count*(count-1)/2,comparedPairs:pairs.size};
 return result.sort((a,b)=>b.score-a.score||a.a.localeCompare(b.a));
}
function merge(a,b,selection={}) {
 return {id:a.id,name:selection.name??a.name??b.name??'',country:selection.country??a.country??b.country??'',company:selection.company??a.company??b.company??'',birthday:selection.birthday??a.birthday??b.birthday??'',notes:selection.notes??unique([a.notes||'',b.notes||'']).join('\n'),emails:unique(selection.emails??[...(a.emails||[]),...(b.emails||[])]),phones:unique(selection.phones??[...(a.phones||[]),...(b.phones||[])]),source:'Fusion validée'};
}
function escapeText(v){return String(v??'').replace(/\r\n|\r/g,'\n').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/;/g,'\\;').replace(/,/g,'\\,').replace(/\u0000/g,'');}
function fold(line){const encoder=new TextEncoder();let out='',part='',count=0;for(const ch of line){const n=encoder.encode(ch).length;if(count+n>75){out+=part+'\r\n';part=' ';count=1;}part+=ch;count+=n;}return out+part;}
function exportVCard(contacts){let lines=[];for(const c of contacts){const name=c.name||'Sans nom';lines.push('BEGIN:VCARD','VERSION:3.0','UID:'+escapeText(c.id),'FN:'+escapeText(name),'N:;'+escapeText(name)+';;;');for(const e of unique(c.emails||[]))lines.push('EMAIL;TYPE=INTERNET:'+escapeText(e));for(const p of unique(c.phones||[]))lines.push('TEL:'+escapeText(p));if(c.company)lines.push('ORG:'+escapeText(c.company));if(c.notes)lines.push('NOTE:'+escapeText(c.notes));if(c.birthday)lines.push((/^\d{4}-\d{2}-\d{2}$/.test(c.birthday)?'BDAY:':'X-SNS-BIRTHDAY:')+escapeText(c.birthday));if(c.country)lines.push('X-SNS-COUNTRY:'+escapeText(c.country));lines.push('END:VCARD');}return lines.map(fold).join('\r\n')+'\r\n';}
function demo(){const data=[
 ['Émilie Bernard',['emilie@example.com'],['06 00 00 00 01'],'FR','Studio Papier','Amie du cours de céramique','iCloud · démo'],
 ['Emilie BERNARD',['EMILIE@example.com'],['+33 6 00 00 00 01'],'FR','','Anniversaire en juin','Google · démo'],
 ['Sophie Martin',['sophie@example.com'],[],'FR','Atelier Soleil','','iCloud · démo'],
 ['Martin Sophie',[],[],'FR','','Préférence : email','Google · démo'],
 ['Alexandre Dupont',['alexandre@example.com'],[],'FR','','','iCloud · démo'],
 ['Alex Dupont',[],[],'FR','','Rencontré à la brocante','Google · démo'],
 ['Nicolas Laurent',[],['06 00 00 00 02'],'FR','','','iCloud · démo'],
 ['Nicolas Laurent',[],['+33 6 00 00 00 02'],'FR','','','Google · démo'],
 ['Camille Moreau',[],[],'FR','','','iCloud · démo'],
 ['C. Moreau',[],[],'FR','','','Google · démo'],
 ['Juliette Fontaine',[],[],'FR','','','iCloud · démo'],
 ['Juliette Fontane',[],[],'FR','','','Google · démo'],
 ['Thomas Leroy',['maison@example.com'],['06 00 00 00 03'],'FR','','Coordonnée de foyer partagée','iCloud · démo'],
 ['Marie Leroy',['maison@example.com'],['06 00 00 00 04'],'FR','','Ne pas confondre avec Thomas','Google · démo'],
 ['Noor de Vries',['noor@example.com'],['06 00000001'],'NL','Studio Noord','','iCloud · démo'],
 ['Noor de Vries',['noor.pro@example.com'],['+31 6 00000001'],'NL','Studio Noord','Coordonnées professionnelles','Google · démo']
 ];return data.map((x,i)=>({id:'demo-'+String(i+1).padStart(2,'0'),name:x[0],emails:x[1],phones:x[2],country:x[3],company:x[4],notes:x[5],birthday:i===0?'1993-06-18':'',source:x[6]}));}
const Smart={preferredPhones,demo,match,candidates,merge,exportVCard,vcard:exportVCard,normalizePhone,lastStats:{records:0,possiblePairs:0,comparedPairs:0}};root.Smart=Smart;if(typeof module!=='undefined'&&module.exports)module.exports=Smart;
})(globalThis);
