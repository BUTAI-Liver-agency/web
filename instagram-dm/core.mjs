import {DatabaseSync} from 'node:sqlite';
import {createHmac,timingSafeEqual} from 'node:crypto';
export const LINE='https://lin.ee/pgwER6s';
export const normalize=s=>String(s).normalize('NFKC').trim().toLocaleLowerCase('ja');
export function matches(text,c){const t=normalize(text);return c.keywords.some(k=>c.mode==='contains'?t.includes(normalize(k)):t===normalize(k));}
export function campaign(input){
 const c={mediaId:String(input.mediaId||''),name:String(input.name||'').trim(),keywords:input.keywords,mode:input.mode||'exact',message:String(input.message||'').trim(),lineUrl:input.lineUrl||LINE,enabled:input.enabled===true};
 if(!/^\d{1,40}$/.test(c.mediaId)||!c.name||c.name.length>100||!Array.isArray(c.keywords)||!c.keywords.length||c.keywords.length>20||c.keywords.some(k=>typeof k!=='string'||!normalize(k)||k.length>100)||!['exact','contains'].includes(c.mode)||!c.message||c.message.length>800)throw Error('投稿ID・名前・キーワード・DM文章を確認してください');
 const u=new URL(c.lineUrl);if(u.protocol!=='https:'||!['lin.ee','line.me'].includes(u.hostname))throw Error('公式LINEのHTTPS URLを指定してください');
 return c;
}
export function message(c){return c.message.includes(c.lineUrl)?c.message:`${c.message}\n\nBUTAI公式LINEはこちら\n${c.lineUrl}`;}
export function signature(raw,sig,secret){if(!secret||!/^sha256=[a-f0-9]{64}$/.test(sig||''))return false;return timingSafeEqual(Buffer.from(sig.slice(7),'hex'),createHmac('sha256',secret).update(raw).digest());}
export class Store{
 constructor(path){this.db=new DatabaseSync(path);this.db.exec(`PRAGMA journal_mode=WAL; CREATE TABLE IF NOT EXISTS campaigns(media_id TEXT PRIMARY KEY,data TEXT NOT NULL); CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY,media_id TEXT NOT NULL,text TEXT NOT NULL,state TEXT NOT NULL,created INTEGER NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,due INTEGER NOT NULL,detail TEXT NOT NULL DEFAULT ''); CREATE TABLE IF NOT EXISTS settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL); INSERT OR IGNORE INTO settings VALUES(1,0); UPDATE jobs SET state='uncertain',detail='再起動前の送信結果が不明。Instagramで確認してください' WHERE state='sending';`);}
 campaigns(){return this.db.prepare('SELECT data FROM campaigns').all().map(r=>JSON.parse(r.data));}
 save(c){this.db.prepare('INSERT INTO campaigns VALUES(?,?) ON CONFLICT(media_id) DO UPDATE SET data=excluded.data').run(c.mediaId,JSON.stringify(c));}
 enabled(value){if(value!==undefined)this.db.prepare('UPDATE settings SET enabled=? WHERE id=1').run(value?1:0);return !!this.db.prepare('SELECT enabled FROM settings').get().enabled;}
 ingest(payload,account,now=Date.now(),dry=true){let count=0;if(payload.object!=='instagram'||!account||!this.enabled())return count;
 for(const e of payload.entry||[]){if(e.id!==account)continue;for(const ch of e.changes||[e]){if(ch.field!=='comments')continue;const v=ch.value||{};const mid=String(v.media?.id||'');const c=this.campaigns().find(c=>c.mediaId===mid&&c.enabled);if(!c||v.parent_id||v.from?.id===account||v.from?.self_ig_scoped_id||!/^\d+$/.test(v.id||'')||typeof v.text!=='string'||!matches(v.text,c))continue;
 const ts=v.timestamp?new Date(v.timestamp).getTime():now;if(Number.isFinite(ts)&&now-ts>7*86400000)continue;
 count+=Number(this.db.prepare('INSERT OR IGNORE INTO jobs(id,media_id,text,state,created,due) VALUES(?,?,?,?,?,?)').run(v.id,mid,message(c),dry?'dry_run':'pending',now,now).changes);
 }}return count;
 }
 logs(){return this.db.prepare('SELECT id,media_id,state,created,attempts,detail FROM jobs ORDER BY created DESC LIMIT 100').all();}
 close(){this.db.close();}
}
export async function processOne(store,config,fetcher=fetch,now=Date.now()){
 if(!store.enabled()||config.dryRun||!config.token||!config.account)return false;
 const j=store.db.prepare("SELECT * FROM jobs WHERE state='pending' AND due<=? ORDER BY created LIMIT 1").get(now);if(!j)return false;
 const update=(state,detail='',due=now)=>store.db.prepare('UPDATE jobs SET state=?,detail=?,due=? WHERE id=?').run(state,detail,due,j.id);
 if(!store.campaigns().some(c=>c.mediaId===j.media_id&&c.enabled)){update('cancelled','投稿の自動送信が停止されています');return true;}
 if(now-j.created>6*86400000){update('expired','送信期限を超えました');return true;}
 store.db.prepare("UPDATE jobs SET state='sending',attempts=attempts+1 WHERE id=? AND state='pending'").run(j.id);
 try{
 const r=await fetcher(`https://graph.instagram.com/${config.version}/${config.account}/messages`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${config.token}`},body:JSON.stringify({recipient:{comment_id:j.id},message:{text:j.text}}),signal:AbortSignal.timeout(15000)});
 const b=await r.json();if(r.ok&&b.message_id)update('sent',String(b.message_id));
 else if(b.error&&(r.status===429||b.error.is_transient===true)&&j.attempts<4)update('pending',`Metaエラー ${b.error.code||r.status}`,now+Math.max(60000,2**j.attempts*60000));
 else update(b.error?'failed':'uncertain',`Meta応答 ${b.error?.code||r.status}。認証・権限または送信結果を確認してください`);
 }catch{update('uncertain','通信結果が不明。重複防止のため自動再送しません');}return true;
}
