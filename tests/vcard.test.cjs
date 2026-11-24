const assert=require('node:assert/strict');
const V=require('../src/vcard.js');let count=0;
const card=(lines,version='3.0')=>['BEGIN:VCARD','VERSION:'+version,...lines,'END:VCARD'].join('\r\n')+'\r\n';
const parse=(text,extra={})=>V.parse(text,{country:'FR',source:'Carnet fictif',idPrefix:'fixture',...extra});
const unfold=text=>text.replace(/\r\n[ \t]/g,'');
function test(name,fn){fn();count++;console.log('PASS '+name);}
test('parse core escaped values and structured names',()=>{
 const [c]=parse(card(['N:Du\\;pont;Émilie;;;','EMAIL;TYPE=HOME:emilie@example.com','TEL;TYPE=CELL:+33600000001','ORG:Studio;Design','NOTE:Ligne 1\\nLigne 2\\, merci','BDAY:1993-06-18']));
 assert.equal(c.name,'Émilie Du;pont');assert.deepEqual(c.emails,['emilie@example.com']);assert.equal(c.company,'Studio · Design');assert.equal(c.notes,'Ligne 1\nLigne 2, merci');assert.equal(c.country,'FR');assert.equal(c.id,'fixture-0');
});
test('preserve untouched properties, UTF8 folding and CRLF',()=>{
 const input=card(['FN:Zoé Test','N:Test;Zoé;;;','UID:original-fictif','item1.EMAIL;TYPE=HOME:zoe@example.com','item1.X-ABLabel:maison','ADR;TYPE=HOME:;;Rue fictive;Paris;;;France','URL:https://example.com','PHOTO;ENCODING=b;TYPE=JPEG:'+('YWJj'.repeat(60)),'CATEGORIES:amis\\, proches','X-CUSTOM:texte']).replace('Rue fictive','Rue fic\r\n tive');
 const [c]=parse(input);assert(c.extras.length>=6);const output=V.export([c]);assert.equal(unfold(output),unfold(input));assert(output.includes('UID:original-fictif'));for(const line of output.split('\r\n'))assert(Buffer.byteLength(line)<=75);assert(!/(?<!\r)\n/.test(output));
});
test('v4 tel URI and quoted colon parameter',()=>{
 const [c]=parse(card(['FN:Camille Test','N:Test;Camille;;;','TEL;VALUE=uri;TYPE="voice,home":tel:+33600000001;ext=2','X-TEST;LABEL="a:b;c":valeur'],'4.0'));
 assert.deepEqual(c.phones,['+33600000001;ext=2']);assert(V.export([c]).includes('VERSION:4.0'));assert(V.export([c]).includes('LABEL="a:b;c"'));
});
test('transactional malformed or unsupported input is rejected without exposing values',()=>{
 for(const input of [card(['FN:Secret Person'],'2.1'),card(['FN:Secret Person','NOTE;ENCODING=QUOTED-PRINTABLE:private']),card(['FN;CHARSET=ISO-8859-1:Secret Person']),card(['FN:Secret Person','invalid property']),card(['FN:Secret Person','BDAY:1990-01-01','BDAY:1991-01-01']),card(['FN:Secret Person'])+'BEGIN:VCARD\nVERSION:3.0\nFN:private'])assert.throws(()=>parse(input),e=>!e.message.includes('Secret')&&!e.message.includes('private'));
 assert.throws(()=>parse(card(['FN:Test fictif','x.BEGIN:VCARD'])));assert.throws(()=>parse(card(['FN:Test fictif','END:OTHER'])));assert.throws(()=>parse('not a card'));assert.throws(()=>parse('BEGIN:VCARD\nVERSION:3.0\nFN:x'));
});
test('internal ids remain unique despite identical original UID',()=>{
 const input=card(['FN:Premier Test','UID:same'])+card(['FN:Deuxième Test','UID:same']);const contacts=parse(input);assert.notEqual(contacts[0].id,contacts[1].id);assert.equal((V.export(contacts).match(/UID:same/g)||[]).length,2);
});
test('multiple organisation and note fields remain available as extras',()=>{
 const [c]=parse(card(['FN:Contact fictif','ORG:First','ORG:Second','NOTE:One','NOTE:Two']));assert.equal(c.company,'First');assert.equal(c.notes,'One');assert.deepEqual(c.extras,['ORG:Second','NOTE:Two']);assert(V.export([c]).includes('ORG:Second'));
});
test('merged selected fields preserve parameters, N components and extras',()=>{
 const [a]=parse(card(['FN:Alex Test','N:Test;Alex;Middle;Dr.;Jr.','UID:source-a','EMAIL;TYPE=WORK:alex@example.com','TEL;TYPE=CELL:+33600000001','ADR;TYPE=HOME:;;Rue fictive;Paris;;;France','X-CUSTOM:one']));
 const [b]=parse(card(['FN:Alexandre Test','N:Test;Alexandre;;;','UID:source-b','EMAIL;TYPE=HOME:autre@example.com','TEL;TYPE=HOME:+33600000002','URL:https://example.com']),{idPrefix:'second'});
 const selected={name:a.name,emails:a.emails,phones:a.phones,company:'',birthday:'',notes:'',country:'FR',extras:[a.extras[0],b.extras[0]]};
 const merged=V.withMergeMetadata(a,b,selected,{id:'merged-fixture',...selected});const output=unfold(V.export([merged]));
 assert(output.includes('N:Test;Alex;Middle;Dr.;Jr.'));assert(output.includes('EMAIL;TYPE=WORK:alex@example.com'));assert(output.includes('TEL;TYPE=CELL:+33600000001'));assert(!output.includes('autre@example.com'));assert(!output.includes('X-CUSTOM'));assert(output.includes('ADR;TYPE=HOME:'));assert(output.includes('URL:https://example.com'));assert(output.includes('UID:merged-fixture'));assert(!output.includes('UID:source-'));
});
test('group labels are remapped per source when merging',()=>{
 const [a]=parse(card(['FN:Test One','item1.TEL;TYPE=CELL:+33600000001','item1.X-ABLabel:maison']));const [b]=parse(card(['FN:Test One','item1.TEL;TYPE=WORK:+33600000002','item1.X-ABLabel:travail']),{idPrefix:'b'});
 const selection={name:a.name,emails:[],phones:[...a.phones,...b.phones],extras:[...a.extras,...b.extras]};const output=unfold(V.export([V.withMergeMetadata(a,b,selection,{id:'merged',...selection})]));assert(output.includes('sns0-item1.TEL'));assert(output.includes('sns0-item1.X-ABLabel:maison'));assert(output.includes('sns1-item1.TEL'));assert(output.includes('sns1-item1.X-ABLabel:travail'));
});
test('mixed version merging and forged extras are rejected',()=>{
 const [a]=parse(card(['FN:Test One'])),[b]=parse(card(['FN:Test One'],'4.0'));assert.throws(()=>V.withMergeMetadata(a,b,{},{}),/versions/);assert.throws(()=>V.withMergeMetadata(a,a,{extras:['X-INJECTED:bad']},{}),/invalide/);
});
test('descriptions do not expose media contents or create remote requests',()=>{
 assert.equal(V.describe('PHOTO;ENCODING=b:private-base64'),'Photo · contenu conservé');assert.equal(V.describe('LOGO:https://example.com/private'),'Logo · contenu conservé');assert(V.describe('ADR:;;Rue fictive;Paris;;;France').startsWith('Adresse · '));assert(V.describe('X-NOTE:'+('a'.repeat(1000))).length<200);
});
test('new plain contacts escape CRLF property injection and fold multibyte text',()=>{
 const output=V.export([{id:'demo',name:'É'.repeat(80)+'\r\nEND:VCARD',emails:[],phones:[],notes:'one\r\nTEL:fake',extras:[]}]);assert.equal(output.split('\r\n').filter(l=>l==='END:VCARD').length,1);assert(output.includes('\\nTEL:fake'));for(const line of output.split('\r\n'))assert(Buffer.byteLength(line)<=75);
});
test('changed original core values cannot silently export stale data',()=>{const [c]=parse(card(['FN:Test fictif']));c.name='Changed';assert.throws(()=>V.export([c]),/modifiée/);});
test('contact and byte limits are enforced',()=>{
 assert.throws(()=>parse(' '.repeat(V.LIMIT_BYTES+1)),/20 Mo/);assert.throws(()=>parse(card(['FN:Fictif']).repeat(10001)),/10 000/);
});
test('successive merges preserve the chosen name and do not resurrect dropped field metadata',()=>{
 const [a]=parse(card(['FN:Alex Test','N:Test;Alex;;;','EMAIL;TYPE=HOME:dropped@example.com']));
 const [b]=parse(card(['FN:Alexandre Test','N:Test;Alexandre;;;','EMAIL;TYPE=WORK:kept@example.com']),{idPrefix:'b'});
 const firstSelection={name:b.name,emails:b.emails,phones:[],extras:[]};
 const first=V.withMergeMetadata(a,b,firstSelection,{id:'first',...firstSelection});
 const [third]=parse(card(['FN:Alexandre Test','N:Test;Alexandre;;;','EMAIL;TYPE=OTHER:dropped@example.com']),{idPrefix:'third'});
 const finalSelection={name:first.name,emails:third.emails,phones:[],extras:[]};const result=V.withMergeMetadata(first,third,finalSelection,{id:'final',...finalSelection});
 const output=unfold(V.export([result]));assert(output.includes('FN:Alexandre Test'));assert(output.includes('N:Test;Alexandre;;;'));assert(output.includes('EMAIL;TYPE=OTHER:dropped@example.com'));assert(!output.includes('TYPE=HOME'));
});
test('advanced v4 references remain roundtrippable but cannot merge ambiguously',()=>{
 const [a]=parse(card(['FN:Test fictif','EMAIL;PID=1.1:test@example.com','CLIENTPIDMAP:1;urn:uuid:fixture'],'4.0'));
 assert(V.export([a]).includes('PID=1.1'));assert(V.mergeIssue(a,a).includes('avancées'));assert.throws(()=>V.withMergeMetadata(a,a,{},{}),/avancées/);
});
console.log(`${count} vCard import/export tests passed`);
