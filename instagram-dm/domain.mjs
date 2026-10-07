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
