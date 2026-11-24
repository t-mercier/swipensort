const assert=require('node:assert/strict');
const S=require('../src/engine.js');
let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
const contact=(name,extra={})=>({id:'a',name,emails:[],phones:[],country:'FR',company:'',notes:'',birthday:'',...extra});
test('email case and whitespace, without removing meaningful plus aliases',()=>{assert.equal(S.match(contact('Léa Martin',{emails:[' LEA@example.com ']}),contact('Léa Martin',{emails:['lea@example.com']})).level,'strong');assert.equal(S.match(contact('',{emails:['lea+work@example.com']}),contact('',{emails:['lea@example.com']})),null);});
test('country-aware domestic and international formats',()=>{for(const [country,local,intl] of [['FR','06 12 34 56 78','+33612345678'],['NL','06 12345678','+31612345678'],['GB','07123 456789','+447123456789'],['BE','0470 12 34 56','+32470123456'],['ES','612 345 678','+34612345678'],['DE','030 12345678','+493012345678'],['IT','06 12345678','+390612345678'],['US','(202) 555-0101','+12025550101']])assert.equal(S.normalizePhone(local,country),intl);assert.equal(S.normalizePhone('0033612345678','FR'),'+33612345678');});
test('ambiguous countries, extensions, short numbers are not matched',()=>{assert.equal(S.normalizePhone('0612345678','ZZ'),null);assert.equal(S.normalizePhone('0612345678 ext 2','FR'),null);assert.equal(S.normalizePhone('12345','FR'),null);assert.notEqual(S.normalizePhone('0612345678','FR'),S.normalizePhone('0612345678','NL'));});
test('accents and reordered names',()=>{assert.equal(S.match(contact('Émilie Bernard'),contact('Emilie BERNARD')).level,'probable');assert.match(S.match(contact('Martin Sophie'),contact('Sophie Martin')).reasons.join(),/réordonnés/);});
test('nickname, initial and spelling remain reviewable',()=>{assert.equal(S.match(contact('Alexandre Dupont'),contact('Alex Dupont')).level,'probable');assert.equal(S.match(contact('Camille Moreau'),contact('C. Moreau')).level,'review');assert.equal(S.match(contact('Juliette Fontaine'),contact('Juliette Fontane')).level,'review');assert.equal(S.match(contact('Alex Dupont'),contact('Alex Dumas')),null);});
test('shared household identifier with unrelated names flags conflict',()=>{const m=S.match(contact('Thomas Leroy',{emails:['home@example.com']}),contact('Marie Leroy',{emails:['home@example.com']}));assert.equal(m.level,'review');assert.ok(m.conflicts.length);});
test('conflicting emails, phones, birthdays, organisations lower confidence',()=>{const a=contact('Sophie Martin',{emails:['a@example.com'],phones:['0612345678'],birthday:'1991-01-01',company:'A'}),b=contact('Sophie Martin',{emails:['b@example.com'],phones:['0612345679'],birthday:'1992-01-01',company:'B'});const m=S.match(a,b);assert.equal(m.level,'review');assert.equal(m.conflicts.length,4);});
test('merge selects fields, permits omission and leaves originals untouched',()=>{const a=contact('A',{emails:['a@example.com'],notes:'first'}),b=contact('B',{emails:['b@example.com'],notes:'second'});const before=JSON.stringify([a,b]);const merged=S.merge(a,b,{name:'B',emails:['b@example.com'],phones:[],notes:''});assert.deepEqual(merged.emails,['b@example.com']);assert.equal(merged.name,'B');assert.equal(merged.notes,'');assert.equal(JSON.stringify([a,b]),before);});
test('candidate pairs are unique and sorted; demo calls return fresh objects',()=>{const d=S.demo(),pairs=S.candidates(d);assert.equal(d.length,16);assert.equal(new Set(pairs.map(p=>p.a+':'+p.b)).size,pairs.length);assert.ok(pairs.every((p,i)=>!i||pairs[i-1].score>=p.score));d[0].emails.push('mutation');assert.ok(!S.demo()[0].emails.includes('mutation'));});
test('vCard uses CRLF, required properties and escapes property injection',()=>{const v=S.vcard([contact('A, B; C\\D\nEND:VCARD\nBEGIN:VCARD',{notes:'hello\r\nTEL:evil',emails:['a@example.com\nTEL:evil']})]);assert.equal(v.split('\r\n').filter(l=>l==='BEGIN:VCARD').length,1);assert.equal(v.split('\r\n').filter(l=>l==='END:VCARD').length,1);assert.ok(v.includes('FN:A\\, B\\; C\\\\D\\n'));assert.ok(v.includes('NOTE:hello\\nTEL:evil'));assert.ok(v.includes('VERSION:3.0\r\n'));assert.ok(v.includes('\r\nN:;'));assert.ok(!/(?<!\r)\n/.test(v));});
test('vCard folds UTF8 at 75 bytes without splitting Unicode codepoints',()=>{const value='é🪩'.repeat(100);const v=S.vcard([contact(value)]);assert.ok(v.split('\r\n').every(l=>Buffer.byteLength(l,'utf8')<=75));assert.ok(v.replace(/\r\n /g,'').includes('FN:'+value+'\r\n'));assert.ok(!v.includes('�'));});
function exhaustive(contacts){const out=[];for(let i=0;i<contacts.length;i++)for(let j=i+1;j<contacts.length;j++){const m=S.match(contacts[i],contacts[j]);if(m)out.push({a:contacts[i].id,b:contacts[j].id,...m});}return out.sort((a,b)=>b.score-a.score||a.a.localeCompare(b.a));}
test('indexed candidates exactly match exhaustive results across demo and edge cases',()=>{const names=['Émilie Bernard','Emilie BERNARD','Bernard Emilie','Alexandre Dupont','Dupont Alex','A. Dupont','Camille Moreau','C Moreau','Moreau Camille','Juliette Fontaine','Juliette Fontane','Julie Fontaine','J Fontaine','Tom Smith','Thomas Smith','T Smith','','A','B','Same Same','Léa de Vries','Vries Léa de','Robert Brown','Bob Brown','a'.repeat(64)+' Martin','a'.repeat(65)+' Martin','a'.repeat(66)+' Martin'];const set=names.map((n,i)=>contact(n,{id:'edge-'+String(i).padStart(3,'0')}));set.push(contact('Unrelated Person',{id:'shared-email',emails:['shared@example.com']}),contact('Other Human',{id:'shared-email2',emails:['SHARED@example.com']}));assert.deepEqual(S.candidates(set),exhaustive(set));assert.deepEqual(S.candidates(S.demo()),exhaustive(S.demo()));});
test('seeded randomized variants have no missed or changed matches',()=>{let seed=7321;const random=n=>{seed=(seed*1664525+1013904223)>>>0;return seed%n;};const first=['Camille','Alexandre','Alex','Thomas','Tom','Émilie','Emilie','Juliette','Julie','Nicolas','Nico','C','A','T'];const last=['Moreau','Dupont','Fontaine','Fontane','Bernard','Martin','Smith','Laurent'];for(let round=0;round<5;round++){const data=Array.from({length:100},(_,i)=>{const parts=[first[random(first.length)],last[random(last.length)]];if(random(3)===0)parts.reverse();const extra={id:'r'+round+'-'+String(i).padStart(3,'0')};if(random(8)===0)extra.emails=['shared'+random(5)+'@example.com'];if(random(8)===0)extra.phones=['060000000'+random(5)];return contact(parts.join(' '),extra);});assert.deepEqual(S.candidates(data),exhaustive(data));}});
test('international phone selected by default while equivalent local form remains available',()=>{
 const a=contact('Noor',{country:'NL',phones:['06 00000001']}),b=contact('Noor',{country:'NL',phones:['+31 6 00000001']});
 assert.deepEqual(S.preferredPhones(a,b),['+31 6 00000001']);
 assert.deepEqual(a.phones,['06 00000001']);
 assert.deepEqual(S.preferredPhones(b,a),['+31 6 00000001']);
 assert.deepEqual(S.preferredPhones(contact('a',{phones:['0033600000001']}),contact('b',{phones:['+33 6 00 00 00 01']})),['+33 6 00 00 00 01']);
});
test('distinct, ambiguous and national-only phones remain selected',()=>{
 const cases=[
 [contact('a',{country:'NL',phones:['06 00000002']}),contact('b',{country:'NL',phones:['+31 6 00000001']})],
 [contact('a',{country:'ZZ',phones:['06 00000001']}),contact('b',{country:'NL',phones:['+31 6 00000001']})],
 [contact('a',{phones:['06 00 00 00 01']}),contact('b',{phones:['0600000001']})],
 [contact('a',{country:'FR',phones:['0612345678']}),contact('b',{country:'NL',phones:['0612345678','+31612345678']})]
 ];
 for(const [a,b] of cases)assert.deepEqual(S.preferredPhones(a,b),[...new Set([...a.phones,...b.phones])]);
});
test('coordinate and organisation differences do not require extra identity confirmation',()=>{
 const a=contact('Noor de Vries',{emails:['a@example.com'],phones:['0600000001'],company:'Studio A'}),b=contact('Noor de Vries',{emails:['b@example.com'],phones:['0600000002'],company:'Studio B'});
 const result=S.match(a,b);assert.equal(result.requiresConfirmation,false);assert.equal(result.conflicts.length,3);
 assert.equal(S.match(a,{...b,birthday:'1990-01-01'}).requiresConfirmation,false);
});
test('incompatible names or conflicting birth dates still require confirmation',()=>{
 assert.equal(S.match(contact('Thomas Leroy',{emails:['foyer@example.com']}),contact('Marie Leroy',{emails:['foyer@example.com']})).requiresConfirmation,true);
 assert.equal(S.match(contact('Noor de Vries',{birthday:'1990-01-01'}),contact('Noor de Vries',{birthday:'1991-01-01'})).requiresConfirmation,true);
 assert.equal(S.match(contact('Noor de Vries',{birthday:'1990-01-01'}),contact('Noor de Vries',{birthday:'1990-01-01'})).requiresConfirmation,false);
});
test('dense imports stop explicitly instead of omitting candidates',()=>{assert.throws(()=>S.candidates(Array.from({length:500},(_,i)=>contact('Même Nom',{id:'dense-'+i}))),/Trop de correspondances/);});
test('linear one-edit comparison agrees with reference Levenshtein on deterministic short strings',()=>{
 const reference=(a,b)=>{let row=Array.from({length:b.length+1},(_,i)=>i);for(let i=1;i<=a.length;i++){const next=[i];for(let j=1;j<=b.length;j++)next[j]=Math.min(next[j-1]+1,row[j]+1,row[j-1]+(a[i-1]===b[j-1]?0:1));row=next;}return row[b.length];};
 const words=[];for(const length of [4,5])for(let i=0;i<2**length;i++)words.push(i.toString(2).padStart(length,'0').replace(/0/g,'a').replace(/1/g,'b'));
 for(const a of words)for(const b of words){const actual=S.match(contact(a+' Smith'),contact(b+' Smith'));assert.equal(!!actual,reference(a,b)<=1,a+' / '+b);}
});
test('100k-character fuzzy tokens finish without quadratic edit-distance work',()=>{
 const token='a'.repeat(100000),start=performance.now();
 assert.equal(S.match(contact(token+' Smith'),contact('b'+token.slice(1)+' Smith')).level,'review');
 assert.equal(S.match(contact(token+' Smith'),contact(token+'a Smith')).level,'review');
 assert.equal(S.match(contact(token+' Smith'),contact('bb'+token.slice(2)+' Smith')),null);
 assert.ok(performance.now()-start<2000,'Long-token comparisons should finish in less than two seconds.');
});
console.log(`${count} total engine tests passed after long-token hardening`);
