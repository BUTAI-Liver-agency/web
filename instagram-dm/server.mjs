import {createServer} from 'node:http';
import {readFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {timingSafeEqual} from 'node:crypto';
import {Store,campaign,matches,message,signature} from './core.mjs';
import {processOne} from './core.mjs';
import {Connection} from './connection.mjs';
export function createApp(env=process.env,fetcher=fetch){
 if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32)throw Error('ADMIN_TOKEN must contain at least 32 characters');
 const dir=env.DATA_DIR||'./data';mkdirSync(dir,{recursive:true});const store=new Store(resolve(dir,'butai.sqlite'));
 const connection=new Connection(store,env);let cfg=connection.value;
 if(!/^v\d+\.0$/.test(cfg.version)||cfg.account&&!/^\d+$/.test(cfg.account))throw Error('Invalid Instagram configuration');
 const html=readFileSync(new URL('./public/index.html',import.meta.url));const js=readFileSync(new URL('./public/admin.js',import.meta.url));
 let running=false;const tick=async()=>{if(running)return;running=true;try{await processOne(store,cfg,fetcher);}finally{running=false;}};
 const timer=setInterval(()=>tick().catch(()=>{}),5000);timer.unref();
 const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
 const server=createServer(async(req,res)=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' https:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
 try{const url=new URL(req.url,'http://localhost');const p=url.pathname;
 if(p==='/healthz'&&req.method==='GET')return json(res,200,{ok:true});
 if(p==='/webhook'&&req.method==='GET'){if(cfg.verify&&url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===cfg.verify){res.writeHead(200,{'Content-Type':'text/plain'});return res.end(url.searchParams.get('hub.challenge')||'');}return json(res,403,{error:'Verification failed'});}
 if(req.method==='GET'&&(p==='/'||p==='/admin.js')){res.setHeader('Content-Type',p==='/'?'text/html; charset=utf-8':'text/javascript; charset=utf-8');return res.end(p==='/'?html:js);}
 if(p.startsWith('/api/')){const supplied=req.headers.authorization||'';const expected=`Bearer ${env.ADMIN_TOKEN}`;if(supplied.length!==expected.length||!timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))return json(res,401,{error:'管理キーが正しくありません'});}
 let raw=Buffer.alloc(0);if(req.method==='POST'){if(!String(req.headers['content-type']||'').startsWith('application/json'))return json(res,415,{error:'JSON required'});for await(const chunk of req){raw=Buffer.concat([raw,chunk]);if(raw.length>256000)return json(res,413,{error:'Payload too large'});}}
 if(p==='/webhook'&&req.method==='POST'){if(!signature(raw,req.headers['x-hub-signature-256'],cfg.secret))return json(res,401,{error:'Invalid signature'});const count=store.ingest(JSON.parse(raw),cfg.account,Date.now(),cfg.dryRun);return json(res,200,{received:true,queued:count});}
 if(p==='/api/state'&&req.method==='GET')return json(res,200,{enabled:store.enabled(),dryRun:cfg.dryRun,connected:!!(cfg.token&&cfg.account&&cfg.secret&&cfg.verify),campaigns:store.campaigns(),logs:store.logs()});
 if(p==='/api/connection'&&req.method==='GET')return json(res,200,connection.public());
 if(p==='/api/connection'&&req.method==='POST'){if(running)return json(res,409,{error:'送信処理中です。数秒後に接続設定を保存してください'});const data=connection.save(JSON.parse(raw));cfg=connection.value;return json(res,200,{ok:true,connection:data});}
 if(p==='/api/connection/check'&&req.method==='POST'){if(!cfg.account||!cfg.token)return json(res,409,{error:'接続設定を先に保存してください'});const r=await fetcher(`https://graph.instagram.com/${cfg.version}/${cfg.account}?fields=id,username`,{headers:{Authorization:`Bearer ${cfg.token}`},signal:AbortSignal.timeout(15000)});const b=await r.json();if(!r.ok||String(b.id)!==cfg.account)return json(res,502,{error:'Instagramの接続を確認できません。アカウントID・トークン・権限を確認してください'});return json(res,200,{ok:true,username:b.username||'',message:'アカウント取得に成功しました。Webhook購読とDM配送は別途確認してください'});}
 if(p==='/api/campaigns'&&req.method==='POST'){const c=campaign(JSON.parse(raw));store.save(c);return json(res,200,{ok:true});}
 if(p==='/api/enabled'&&req.method==='POST'){const b=JSON.parse(raw);if(typeof b.enabled!=='boolean')return json(res,400,{error:'enabled must be boolean'});store.enabled(b.enabled);return json(res,200,{ok:true});}
 if(p==='/api/preview'&&req.method==='POST'){const b=JSON.parse(raw);const c=campaign(b.campaign);return json(res,200,{matches:matches(b.comment||'',c),message:message(c)});}
 if(p==='/api/media'&&req.method==='GET'){
 if(!cfg.account||!cfg.token)return json(res,409,{error:'Instagram認証を設定すると投稿一覧を取得できます'});
 const after=url.searchParams.get('after')||'';if(after.length>2000)return json(res,400,{error:'Invalid cursor'});
 const u=new URL(`https://graph.instagram.com/${cfg.version}/${cfg.account}/media`);u.searchParams.set('fields','id,caption,media_type,permalink,timestamp');u.searchParams.set('limit','25');if(after)u.searchParams.set('after',after);
 const r=await fetcher(u,{headers:{Authorization:`Bearer ${cfg.token}`},signal:AbortSignal.timeout(15000)});const b=await r.json();if(!r.ok)return json(res,502,{error:`Instagram認証・権限を確認してください（${b.error?.code||r.status}）`});return json(res,200,{data:b.data||[],after:b.paging?.next?b.paging?.cursors?.after:null});}
 return json(res,404,{error:'Not found'});
 }catch(e){return json(res,400,{error:e instanceof SyntaxError?'JSONの形式を確認してください':e.message?.includes('投稿')||e.message?.includes('LINE')||e.message?.includes('接続')?e.message:'処理に失敗しました。設定を確認してください'});}
 });return {server,store,close:async()=>{clearInterval(timer);while(running)await new Promise(r=>setTimeout(r,10));await new Promise(r=>server.close(r));store.close();}};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){const app=createApp();app.server.listen(Number(process.env.PORT||3000),'0.0.0.0',()=>console.log('BUTAI Instagram DM server ready'));for(const s of ['SIGTERM','SIGINT'])process.on(s,async()=>{await app.close();process.exit(0);});}
