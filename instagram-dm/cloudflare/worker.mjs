import {campaign,matches,message} from '../domain.mjs';

// Deliberately below the account-wide Free allowance: rejected traffic still invokes Workers.
export const REQUEST_LIMIT=90000;
export const SEND_LIMIT=1000;
const encoder=new TextEncoder();
const dayOf=now=>new Date(now).toISOString().slice(0,10);
const stmt=(db,sql,...args)=>db.prepare(sql).bind(...args);
const first=(db,sql,...args)=>stmt(db,sql,...args).first();
const run=(db,sql,...args)=>stmt(db,sql,...args).run();
const all=async(db,sql,...args)=>(await stmt(db,sql,...args).all()).results;
const resetAt=now=>Date.parse(dayOf(now)+'T00:00:00Z')+86400000;
const response=(status,data,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
const stopped=now=>response(429,{error:'本日の無料枠保護上限に達したため処理を停止しました。日本時間9時に自動再開します。',resetAt:resetAt(now)},{'Retry-After':String(Math.ceil((resetAt(now)-now)/1000))});
export async function admit(db,now=Date.now()){
 return !!await first(db,`INSERT INTO daily(day,requests) VALUES(?,1)
 ON CONFLICT(day) DO UPDATE SET requests=requests+1 WHERE requests<? RETURNING requests`,dayOf(now),REQUEST_LIMIT);
}
async function budget(db,now){const b=await first(db,'SELECT requests,sends FROM daily WHERE day=?',dayOf(now));return {day:dayOf(now),requests:b?.requests||0,requestLimit:REQUEST_LIMIT,sends:b?.sends||0,sendLimit:SEND_LIMIT,stopped:(b?.requests||0)>=REQUEST_LIMIT,resetAt:resetAt(now)};}
async function key(env){if(!env.SETTINGS_KEY||env.SETTINGS_KEY.length<32)throw Error('SETTINGS_KEY required');return crypto.subtle.importKey('raw',await crypto.subtle.digest('SHA-256',encoder.encode(env.SETTINGS_KEY)),{name:'AES-GCM'},false,['encrypt','decrypt']);}
function base64(bytes){let s='';for(const b of bytes)s+=String.fromCharCode(b);return btoa(s);}
async function seal(c,env){const iv=crypto.getRandomValues(new Uint8Array(12));const encrypted=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(env),encoder.encode(JSON.stringify(c)));return base64(new Uint8Array([...iv,...new Uint8Array(encrypted)]));}
async function config(db,env){const row=await first(db,'SELECT * FROM settings WHERE id=1');let c={account:'',username:'',token:'',secret:'',verify:env.META_VERIFY_TOKEN||'',version:env.GRAPH_API_VERSION||'v24.0',dryRun:true};if(row.sealed){const bytes=Uint8Array.from(atob(row.sealed),c=>c.charCodeAt(0));c=JSON.parse(new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes.slice(0,12)},await key(env),bytes.slice(12))));}return {...c,enabled:!!row.enabled,revision:row.revision};}
const publicConfig=c=>({account:c.account,username:c.username,version:c.version,dryRun:c.dryRun,hasToken:!!c.token,hasSecret:!!c.secret,hasVerify:!!c.verify});
async function authenticate(request,env){if(!env.ADMIN_TOKEN||env.ADMIN_TOKEN.length<32)throw Error('ADMIN_TOKEN required');const a=await crypto.subtle.digest('SHA-256',encoder.encode(request.headers.get('Authorization')||''));const b=await crypto.subtle.digest('SHA-256',encoder.encode('Bearer '+env.ADMIN_TOKEN));return new Uint8Array(a).every((v,i)=>v===new Uint8Array(b)[i]);}
async function signed(raw,sig,secret){if(!secret||!/^sha256=[a-f0-9]{64}$/.test(sig||''))return false;const k=await crypto.subtle.importKey('raw',encoder.encode(secret),{name:'HMAC',hash:'SHA-256'},false,['verify']);return crypto.subtle.verify('HMAC',k,Uint8Array.from(sig.slice(7).match(/../g),s=>parseInt(s,16)),raw);}
async function body(request){if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw Error('JSONを指定してください');if(Number(request.headers.get('Content-Length'))>256000)throw Error('データが大きすぎます');const reader=request.body?.getReader();if(!reader)return new Uint8Array();let size=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>256000){await reader.cancel();throw Error('データが大きすぎます');}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}return bytes;}
export async function locked(db,now,fn){const token=crypto.randomUUID();const row=await first(db,`INSERT INTO locks VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET token=excluded.token,expires=excluded.expires WHERE expires<? RETURNING token`,token,now+60000,now);if(!row)return null;try{return await fn();}finally{await run(db,'DELETE FROM locks WHERE id=1 AND token=?',token);}}
async function saveConfig(db,env,input,c){const n={...c};for(const k of ['account','username','version'])if(input[k]!==undefined)n[k]=String(input[k]).trim();for(const k of ['token','secret','verify'])if(typeof input[k]==='string'&&input[k].trim())n[k]=input[k].trim();n.dryRun=input.dryRun;
 if(!/^\d{1,40}$/.test(n.account)||!/^@?[A-Za-z0-9._]{0,30}$/.test(n.username)||!/^v\d{1,3}\.0$/.test(n.version)||typeof n.dryRun!=='boolean'||[n.token,n.secret,n.verify].some(v=>typeof v!=='string'||!v||v.length>4096))throw Error('接続設定のアカウントID・認証情報を確認してください');
 if(n.account!==c.account&&['token','secret','verify'].some(k=>!input[k]?.trim()))throw Error('接続先を変更するときは認証情報も再入力してください');
 const revision=crypto.randomUUID();const sealed=await seal(n,env);const queries=[stmt(db,'UPDATE settings SET sealed=?,revision=?,enabled=0 WHERE id=1',sealed,revision),stmt(db,"UPDATE jobs SET state='cancelled',detail='接続設定が変更されました' WHERE state='pending'")];if(n.account!==c.account)queries.push(stmt(db,'DELETE FROM campaigns'));await db.batch(queries);return publicConfig(n);
}
export async function ingest(db,payload,c,now){if(payload.object!=='instagram'||!c.account||!c.enabled)return 0;let count=0;const total=(payload.entry||[]).filter(e=>String(e.id)===c.account).reduce((n,e)=>n+(e.changes||[e]).filter(ch=>ch.field==='comments').length,0);if(total>20)throw Error('Webhook batch too large');
 for(const e of payload.entry||[]){if(String(e.id)!==c.account)continue;for(const ch of e.changes||[e]){if(ch.field!=='comments')continue;const v=ch.value||{};const mid=String(v.media?.id||'');const stored=await first(db,'SELECT data FROM campaigns WHERE media_id=?',mid);const post=stored?JSON.parse(stored.data):null;if(!post?.enabled||v.parent_id||v.from?.id===c.account||v.from?.self_ig_scoped_id||!/^\d+$/.test(v.id||'')||typeof v.text!=='string'||!matches(v.text,post))continue;
 const ts=v.timestamp?new Date(v.timestamp).getTime():now;if(Number.isFinite(ts)&&now-ts>7*86400000)continue;
 // The payload size is checked before any insert to stay under D1's 50-query limit.
  const r=await run(db,`INSERT OR IGNORE INTO jobs(id,media_id,text,state,created,due,revision) SELECT ?,?,?,?,?,?,? FROM settings WHERE id=1 AND revision=? AND enabled=1`,String(v.id),mid,message(post),c.dryRun?'dry_run':'pending',now,now,c.revision,c.revision);count+=r.meta.changes;
 }}return count;
}
export async function processOne(db,env,fetcher=fetch,now=Date.now()){
 return locked(db,now,async()=>{
 // A killed invocation is never replayed automatically: remote delivery may have happened.
 await run(db,"UPDATE jobs SET state='uncertain',detail='前回の送信結果が不明。Instagramで確認してください' WHERE state='sending'");
 const b=await budget(db,now);if(b.stopped||b.sends>=SEND_LIMIT)return false;
 const c=await config(db,env);if(!c.enabled||c.dryRun||!c.account||!c.token)return false;
 const j=await first(db,"SELECT * FROM jobs WHERE state='pending' AND due<=? ORDER BY due LIMIT 1",now);if(!j)return false;
 const post=await first(db,'SELECT data FROM campaigns WHERE media_id=?',j.media_id);
 const update=(state,detail='',due=now)=>run(db,'UPDATE jobs SET state=?,detail=?,due=? WHERE id=?',state,detail,due,j.id);
 if(j.revision!==c.revision||!post||!JSON.parse(post.data).enabled){await update('cancelled','投稿または接続設定が変更されています');return true;}
 if(now-j.created>6*86400000){await update('expired','送信期限を超えました');return true;}
 // Count attempts, including failed or uncertain calls, rather than just successful DMs.
 const send=await first(db,'UPDATE daily SET sends=sends+1 WHERE day=? AND sends<? AND requests<? RETURNING sends',dayOf(now),SEND_LIMIT,REQUEST_LIMIT);if(!send)return false;
 await run(db,"UPDATE jobs SET state='sending',attempts=attempts+1 WHERE id=?",j.id);
 try{const r=await fetcher(`https://graph.instagram.com/${c.version}/${c.account}/messages`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${c.token}`},body:JSON.stringify({recipient:{comment_id:j.id},message:{text:j.text}}),signal:AbortSignal.timeout(15000)});const data=await r.json();
 if(r.ok&&data.message_id)await update('sent',String(data.message_id));else if(data.error&&(r.status===429||data.error.is_transient===true)&&j.attempts<4)await update('pending',`Metaエラー ${data.error.code||r.status}`,now+Math.max(60000,2**j.attempts*60000));else await update(data.error?'failed':'uncertain',`Meta応答 ${data.error?.code||r.status}。送信結果を確認してください`);
 }catch{await update('uncertain','通信結果が不明。重複防止のため自動再送しません');}return true;
 });
}
export function createWorker(fetcher=fetch){return {
 async fetch(request,env){const now=Date.now();const url=new URL(request.url);const p=url.pathname;
 try{
 if(!await admit(env.DB,now))return stopped(now);
 if(p==='/healthz'&&request.method==='GET')return response(200,{ok:true});
 if(p.startsWith('/api/')&&!await authenticate(request,env))return response(401,{error:'管理キーが正しくありません'});
 if(!p.startsWith('/api/')&&p!=='/webhook')return response(404,{error:'Not found'});
 const c=await config(env.DB,env);
 if(p==='/webhook'&&request.method==='GET'){if(c.verify&&url.searchParams.get('hub.mode')==='subscribe'&&url.searchParams.get('hub.verify_token')===c.verify)return new Response(url.searchParams.get('hub.challenge')||'',{headers:{'Cache-Control':'no-store'}});return response(403,{error:'Verification failed'});}
 let input;
 if(request.method==='POST'){const raw=await body(request);if(p==='/webhook'){if(!await signed(raw,request.headers.get('x-hub-signature-256'),c.secret))return response(401,{error:'Invalid signature'});const count=await ingest(env.DB,JSON.parse(new TextDecoder().decode(raw)),c,now);return response(200,{received:true,queued:count});}input=JSON.parse(new TextDecoder().decode(raw));}
 if(p==='/api/state'&&request.method==='GET')return response(200,{enabled:c.enabled,dryRun:c.dryRun,connected:!!(c.account&&c.token&&c.secret&&c.verify),campaigns:(await all(env.DB,'SELECT data FROM campaigns')).map(r=>JSON.parse(r.data)),logs:await all(env.DB,'SELECT id,media_id,state,created,attempts,detail FROM jobs ORDER BY created DESC LIMIT 100'),quota:await budget(env.DB,now)});
 if(p==='/api/connection'&&request.method==='GET')return response(200,publicConfig(c));
 if(request.method==='POST'&&['/api/connection','/api/campaigns','/api/enabled'].includes(p)){
 const result=await locked(env.DB,now,async()=>{const fresh=await config(env.DB,env);if(p==='/api/connection')return {ok:true,connection:await saveConfig(env.DB,env,input,fresh)};
 if(p==='/api/campaigns'){const post=campaign(input);await run(env.DB,'INSERT INTO campaigns VALUES(?,?) ON CONFLICT(media_id) DO UPDATE SET data=excluded.data',post.mediaId,JSON.stringify(post));if(!post.enabled)await run(env.DB,"UPDATE jobs SET state='cancelled',detail='投稿の自動送信が停止されています' WHERE media_id=? AND state='pending'",post.mediaId);return {ok:true};}
 if(typeof input.enabled!=='boolean')throw Error('ON/OFFを指定してください');await run(env.DB,'UPDATE settings SET enabled=? WHERE id=1',input.enabled?1:0);return {ok:true};});return result?response(200,result):response(409,{error:'送信処理中です。数秒後に保存してください'});
 }
 if(p==='/api/preview'&&request.method==='POST'){const post=campaign(input.campaign);return response(200,{matches:matches(input.comment||'',post),message:message(post)});}
 if((p==='/api/media'&&request.method==='GET')||(p==='/api/connection/check'&&request.method==='POST')){
 if(!c.account||!c.token)return response(409,{error:'接続設定を先に保存してください'});
 const check=p.endsWith('/check');const u=new URL(`https://graph.instagram.com/${c.version}/${c.account}${check?'':'/media'}`);u.searchParams.set('fields',check?'id,username':'id,caption,media_type,permalink,timestamp');if(!check){u.searchParams.set('limit','25');const after=url.searchParams.get('after');if(after){if(after.length>2000)throw Error('カーソルを確認してください');u.searchParams.set('after',after);}}
 const r=await fetcher(u,{headers:{Authorization:`Bearer ${c.token}`},signal:AbortSignal.timeout(15000)});const data=await r.json();if(!r.ok||(check&&String(data.id)!==c.account))return response(502,{error:'InstagramのアカウントID・トークン・権限を確認してください'});return response(200,check?{ok:true,username:data.username||'',message:'アカウント取得に成功しました。Webhook購読とDM配送は別途確認してください'}:{data:data.data||[],after:data.paging?.next?data.paging.cursors?.after:null});
 }
 return response(404,{error:'Not found'});
 }catch(error){
 // DB/quota failures must not acknowledge a webhook or continue sending.
 if(error instanceof SyntaxError)return response(400,{error:'JSONの形式を確認してください'});
 if(/確認してください|指定してください|再入力してください|大きすぎます/.test(error.message))return response(400,{error:error.message});
 return response(503,{error:'処理を停止しました。無料枠・DB・サーバー設定を確認してください。'},{'Retry-After':'60'});
 }
 },
 async scheduled(event,env){const now=Date.now();if(!await admit(env.DB,now))return;await processOne(env.DB,env,fetcher,now);}
 };}
export default createWorker();
