const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');let html=fs.readFileSync(path.join(root,'src/index.template.html'),'utf8');
for(const [marker,file] of [['ENGINE','engine.js'],['VCARD','vcard.js'],['APP','app.js']]){
 const token='/* '+marker+' */';if(!html.includes(token))throw Error('Missing build marker: '+marker);
 html=html.replace(token,()=>fs.readFileSync(path.join(root,'src',file),'utf8'));
}
fs.writeFileSync(path.join(root,'index.html'),html);console.log('Built standalone index.html');
