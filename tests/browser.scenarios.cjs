module.exports = async(page)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(process.env.SWIPE_TEST_URL || 'http://127.0.0.1:8080/');
 const passed=[],check=(name,value)=>{if(!value)throw new Error(name);passed.push(name);};
 const a=['BEGIN:VCARD','VERSION:3.0','UID:synthetic-a','FN:Léa Exemple','N:Exemple;Léa;;;','item1.EMAIL;TYPE=HOME:lea@example.com','item1.X-ABLabel:Perso','TEL;TYPE=CELL:06 00 00 00 01','ADR;TYPE=HOME:;;1 rue Fictive;Ville;;00000;France','PHOTO;ENCODING=b;TYPE=PNG:YWJj','URL:https://example.com/profile','NOTE:Note A','END:VCARD'].join('\r\n');
 const b=['BEGIN:VCARD','VERSION:3.0','UID:synthetic-b','FN:Lea Exemple','N:Exemple;Lea;;;','EMAIL;TYPE=WORK:lea@example.com','TEL;TYPE=CELL:+33 6 00 00 00 01','X-SYNTHETIC:Conservé','NOTE:Note B','END:VCARD'].join('\r\n');
 const third=['BEGIN:VCARD','VERSION:3.0','FN:Un autre exemple','X-PRIVATE-TEST:Valeur fictive','END:VCARD'].join('\r\n');
 await page.locator('#importContacts').click();await page.locator('#importCountry').selectOption('FR');await page.locator('#importFiles').setInputFiles({name:'synthetic.vcf',mimeType:'text/vcard',buffer:Buffer.from(a+'\r\n'+b+'\r\n'+third)});await page.locator('#confirmImport').click();await page.locator('#modal').waitFor({state:'hidden'});
 check('Import atomique : 3 fiches, 1 paire',await page.locator('#total').innerText()==='3 fiches'&&await page.locator('.pair').count()===1);
 check('Session réelle distincte de la démo',(await page.locator('#sessionInfo').innerText()).includes('Ton carnet'));
 check('Numéro international seul présélectionné',await page.locator('input[name="phones"]:checked').count()===1&&(await page.locator('#preview').innerText()).includes('+33'));
 check('Champs supplémentaires visibles',(await page.locator('#preview').innerText()).includes('Adresse')&&(await page.locator('#preview').innerText()).includes('Photo · contenu conservé'));
 check('Pas de confirmation pour variantes de nom',await page.locator('#confirmConflict').count()===0);
 const readDownload=async()=>{const p=page.waitForEvent('download');await page.locator('#download').click();const d=await p;let text='';for await(const c of await d.createReadStream())text+=c.toString();return {text,name:d.suggestedFilename()};};
 await page.locator('#export').click();await page.locator('input[value="original"]').check();let out=await readDownload();check('Originaux exportés sans perte',out.text.includes('item1.X-ABLabel:Perso')&&out.text.includes('PHOTO;ENCODING=b;TYPE=PNG:YWJj')&&out.text.includes('N:Exemple;Léa;;;'));
 check('Export personnel sans marqueur de démo',!out.name.includes('DEMO')&&!out.text.includes('DÉMONSTRATION'));
 await page.locator('input[name="name"]').first().check();
 await page.locator('input[name="extras"]').evaluateAll(inputs=>{const target=inputs.find(e=>e.parentElement.textContent.includes('Site web'));target.click();});
 await page.locator('#merge').click();check('Fusion du carnet importé',await page.locator('#total').innerText()==='2 fiches');
 await page.locator('#export').click();out=await readDownload();check('Export fusionné : champs conservés',out.text.includes('ADR;TYPE=HOME:')&&out.text.includes('PHOTO;ENCODING=b;TYPE=PNG:YWJj')&&out.text.includes('X-SYNTHETIC:Conservé')&&out.text.includes('X-PRIVATE-TEST:Valeur fictive'));
 check('Labels groupés préservés après fusion',out.text.includes('sns0-item1.EMAIL;TYPE=HOME:lea@example.com')&&out.text.includes('sns0-item1.X-ABLabel:Perso'));
 check('Champ décoché absent',!out.text.includes('URL:https://example.com/profile'));
 check('Pas de doublon de téléphone dans la fusion',!out.text.includes('TEL;TYPE=CELL:06 00 00 00 01')&&out.text.includes('TEL;TYPE=CELL:+33 6 00 00 00 01'));
 await page.locator('#undo').click();check('Annulation restaure les données importées',await page.locator('#total').innerText()==='3 fiches');
 await page.locator('#importContacts').click();await page.locator('#importFiles').setInputFiles({name:'invalid.vcf',mimeType:'text/vcard',buffer:Buffer.from('BEGIN:VCARD\r\nVERSION:2.1\r\nFN:Exemple\r\nEND:VCARD')});await page.locator('#confirmImport').click();await page.locator('#importError').waitFor({state:'visible'});check('Import refusé sans remplacer le carnet',await page.locator('#importError').isVisible()&&await page.locator('#total').innerText()==='3 fiches');await page.locator('#cancelImport').click();
 await page.context().setOffline(true);await page.locator('#export').click();out=await readDownload();check('Export utilisable hors ligne',(out.text.match(/BEGIN:VCARD/g)||[]).length===3);await page.context().setOffline(false);
 check('Aucune ressource distante chargée',await page.evaluate(()=>performance.getEntriesByType('resource').length===0));check('Aucun stockage persistant',await page.evaluate(()=>localStorage.length===0&&sessionStorage.length===0));
 for(const width of [320,478,1440]){await page.setViewportSize({width,height:935});check('Aucun débordement '+width,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));}
 await page.locator('#leaveContacts').click();await page.locator('#confirmLeave').click();check('Effacer le carnet revient à la démo',await page.locator('#total').innerText()==='16 fiches');check('Aucune erreur JavaScript',errors.length===0);
 return {passed,errors};
}
