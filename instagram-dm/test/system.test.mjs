import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHmac} from 'node:crypto';
import {Store,campaign,signature,processOne,message} from '../core.mjs';
import {createApp} from '../server.mjs';
const base={mediaId:'123',name:'募集',keywords:['BUTAI'],mode:'exact',message:'ありがとうございます',enabled:true};
const payload=(id='456',text='ＢＵＴＡＩ',mid='123',account='999')=>({object:'instagram',entry:[{id:account,changes:[{field:'comments',value:{id,text,media:{id:mid},from:{id:'222'}}}]}]});
const cfg={account:'999',token:'secret',version:'v24.0',dryRun:false};
test('signed webhook, admin authentication, persistent dedupe and correct API recipient',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'butai-'));let requests=[];const remote=async(url,options)=>{requests.push({url,options});return Response.json({message_id:'sent-id'});};const env={ADMIN_TOKEN:'a'.repeat(40),DATA_DIR:dir,IG_ACCOUNT_ID:'999',IG_ACCESS_TOKEN:'test',META_APP_SECRET:'secret',META_VERIFY_TOKEN:'verify',DRY_RUN:'false'};
 const app=createApp(env,remote);await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 const post=(path,b,headers={})=>fetch(url+path,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(b)});const auth={Authorization:`Bearer ${env.ADMIN_TOKEN}`};
 try{
 assert.equal((await fetch(url+'/api/state')).status,401);
 assert.equal((await post('/api/campaigns',base,auth)).status,200);await post('/api/enabled',{enabled:true},auth);
 assert.equal((await fetch(url+'/webhook?hub.mode=subscribe&hub.verify_token=verify&hub.challenge=42')).status,200);
 assert.equal((await post('/webhook',payload())).status,401);
 const p=payload();const sig='sha256='+createHmac('sha256','secret').update(JSON.stringify(p)).digest('hex');
 assert.equal((await (await post('/webhook',p,{'x-hub-signature-256':sig})).json()).queued,1);
 assert.equal((await (await post('/webhook',p,{'x-hub-signature-256':sig})).json()).queued,0);
 await processOne(app.store,cfg,remote);assert.equal(requests.length,1);assert.equal(JSON.parse(requests[0].options.body).recipient.comment_id,'456');assert.equal(JSON.parse(requests[0].options.body).message.text,message(campaign(base)));assert.equal(app.store.logs()[0].state,'sent');
 }finally{await app.close();}
 const s=new Store(join(dir,'butai.sqlite'));assert.equal(s.ingest(payload(),'999',Date.now(),false),0);s.close();rmSync(dir,{recursive:true});
});
test('per-post matching, account filters, disabled settings, dry-run and LINE validation',()=>{
 const s=new Store(':memory:');s.save(campaign(base));assert.equal(s.ingest(payload(),'999'),0);s.enabled(true);
 assert.equal(s.ingest(payload('1','BUTAI','123','888'),'999'),0);assert.equal(s.ingest(payload('2','BUTAI','124'),'999'),0);assert.equal(s.ingest(payload('3','BUTAIお願いします'),'999'),0);
 assert.equal(s.ingest(payload('4',' butai '),'999'),1);assert.equal(s.logs()[0].state,'dry_run');
 s.save(campaign({...base,mode:'contains'}));assert.equal(s.ingest(payload('5','BUTAIお願いします'),'999'),1);
 const p=payload('6');p.entry[0].changes[0].value.parent_id='7';assert.equal(s.ingest(p,'999'),0);
 const old=payload('8');old.entry[0].changes[0].value.timestamp='2020-01-01';assert.equal(s.ingest(old,'999'),0);
 s.save(campaign({...base,enabled:false}));assert.equal(s.ingest(payload('9'),'999'),0);
 assert.throws(()=>campaign({...base,lineUrl:'https://evil.example'}));assert.throws(()=>campaign({...base,keywords:['']}));assert.equal(signature(Buffer.from('a'),'sha256=00','secret'),false);s.close();
});
test('uncertain delivery does not retry; explicit throttling retries; restart is conservative',async()=>{
 const s=new Store(':memory:');s.save(campaign(base));s.enabled(true);s.ingest(payload(),'999',1000,false);let calls=0;
 await processOne(s,cfg,async()=>{calls++;throw Error('timeout');},1000);await processOne(s,cfg,async()=>{calls++;},2000);assert.equal(calls,1);assert.equal(s.logs()[0].state,'uncertain');
 s.ingest(payload('777'),'999',1000,false);await processOne(s,cfg,async()=>Response.json({error:{code:4,is_transient:true}},{status:429}),1000);assert.equal(s.logs().find(x=>x.id==='777').state,'pending');
 await processOne(s,cfg,async()=>Response.json({message_id:'ok'}),61000);assert.equal(s.logs().find(x=>x.id==='777').state,'sent');
 s.ingest(payload('778'),'999',1000,false);s.save(campaign({...base,enabled:false}));await processOne(s,cfg,async()=>{throw Error('must not send');},2000);assert.equal(s.logs().find(x=>x.id==='778').state,'cancelled');s.close();
 const dir=mkdtempSync(join(tmpdir(),'butai-restart-'));const file=join(dir,'db');const a=new Store(file);a.save(campaign(base));a.enabled(true);a.ingest(payload(),'999',1000,false);a.db.exec("UPDATE jobs SET state='sending'");a.close();const b=new Store(file);assert.equal(b.logs()[0].state,'uncertain');b.close();rmSync(dir,{recursive:true});
});
test('connection settings are encrypted, redacted, persisted and safely isolate account changes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'butai-settings-'));const env={ADMIN_TOKEN:'a'.repeat(40),SETTINGS_KEY:'stable-key',DATA_DIR:dir};
 const app=createApp(env,async()=>Response.json({id:'999',username:'butai'}));await new Promise(r=>app.server.listen(0,'127.0.0.1',r));const url=`http://127.0.0.1:${app.server.address().port}`;
 const auth={Authorization:`Bearer ${env.ADMIN_TOKEN}`};const api=async(path,body)=>{const r=await fetch(url+'/api/'+path,{method:body===undefined?'GET':'POST',headers:{...auth,...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});return {status:r.status,data:await r.json()};};
 try{
 assert.equal((await fetch(url+'/api/connection')).status,401);
 let r=await api('connection',{account:'999',username:'@butai',token:'PRIVATE_TOKEN',secret:'PRIVATE_SECRET',verify:'PRIVATE_VERIFY',version:'v24.0',dryRun:true});assert.equal(r.status,200);assert.equal(JSON.stringify(r.data).includes('PRIVATE'),false);
 assert.equal((await api('connection/check',{})).data.ok,true);
 const sealed=app.store.db.prepare('SELECT sealed FROM connection').get().sealed;assert.equal(sealed.includes('PRIVATE'),false);
 await api('campaigns',base);await api('enabled',{enabled:true});
 const p=payload();const sig='sha256='+createHmac('sha256','PRIVATE_SECRET').update(JSON.stringify(p)).digest('hex');const wr=await fetch(url+'/webhook',{method:'POST',headers:{'Content-Type':'application/json','x-hub-signature-256':sig},body:JSON.stringify(p)});assert.equal((await wr.json()).queued,1);
 r=await api('connection',{account:'999',dryRun:false});assert.equal(r.status,200);assert.equal((await api('state')).data.enabled,false);assert.equal((await api('connection')).data.hasToken,true);
 app.store.enabled(true);app.store.ingest(payload('777'),'999',Date.now(),false);
 assert.equal((await api('connection',{account:'888',dryRun:false})).status,400);
 r=await api('connection',{account:'888',username:'next',token:'NEXT_TOKEN',secret:'NEXT_SECRET',verify:'NEXT_VERIFY',dryRun:true});assert.equal(r.status,200);assert.equal(app.store.campaigns().length,0);assert.equal(app.store.logs().find(x=>x.id==='777').state,'cancelled');
 }finally{await app.close();}
 const restored=createApp(env);assert.equal(restored.store.enabled(),false);await new Promise(r=>restored.server.listen(0,'127.0.0.1',r));const r=await fetch(`http://127.0.0.1:${restored.server.address().port}/api/connection`,{headers:auth});const b=await r.json();assert.equal(b.account,'888');assert.equal(b.hasToken,true);assert.equal(JSON.stringify(b).includes('NEXT_TOKEN'),false);await restored.close();rmSync(dir,{recursive:true});
});
