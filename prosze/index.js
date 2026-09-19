'use strict';
// Rynek Shop EXTREME-LITE — Node.js 18, 0 paczek npm, tylko moduły wbudowane.
const https=require('https'),tls=require('tls'),crypto=require('crypto'),fs=require('fs'),path=require('path');

// .env (opcjonalny; ACLClouds może używać Environment Variables)
try{for(const l of fs.readFileSync(path.join(__dirname,'.env'),'utf8').split(/\r?\n/)){if(!l||l[0]==='#')continue;const i=l.indexOf('=');if(i>0&&!process.env[l.slice(0,i)])process.env[l.slice(0,i)]=l.slice(i+1).trim();}}catch{}
const TOKEN=process.env.DISCORD_TOKEN,GUILD=process.env.GUILD_ID;
if(!TOKEN||!GUILD){console.error('Brak DISCORD_TOKEN lub GUILD_ID');process.exit(1)}

const BRAND='Rynek Shop',COLOR=0x3498DB,CAT='1499321421979975833',STAFF='1499321419648077883',LEGIT='1506203473778049096';
const PRODUCTS={Jailbreak:{channel:'1506203233633304688',count:71},Robux:{channel:'1512697980011151432',count:4},MM2:{channel:'1546969811798462474',count:50},'case-world':{channel:'1548648793095020574',count:15},Petsim99:{channel:'1506203270757089322',count:4}};
const ASSET={ticket:'ticket-banner.png',legit:'legit-banner.jpg',products:'products-banner.png'};
const tickets=new Map(),emojis=new Map(),stickyTimers=new Map(); let BOT='',SEQ=null,HB=null,sock=null,buf=Buffer.alloc(0),frag='';
const STORE_FILE=path.join(__dirname,'storage.json');
let store={stickies:{}};try{const x=JSON.parse(fs.readFileSync(STORE_FILE,'utf8'));if(x&&typeof x==='object')store={stickies:x.stickies&&typeof x.stickies==='object'?x.stickies:{}}}catch{}
function saveStore(){try{fs.writeFileSync(STORE_FILE,JSON.stringify(store))}catch(e){console.error('storage:',e.message)}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const j=x=>JSON.stringify(x), row=(...c)=>({type:1,components:c}), btn=(id,label,style=1,e)=>({type:2,custom_id:id,label,style,...(e?{emoji:emoji(e)}:{})});
function ce(n,f){const e=emojis.get(n);return e?`<${e.animated?'a':''}:${e.name}:${e.id}>`:f}
function emoji(n){const e=emojis.get(n);return e?{id:e.id,name:e.name,animated:e.animated}:undefined}
function staff(m){return !!m&&(((BigInt(m.permissions||'0')&8n)===8n)||(m.roles||[]).includes(STAFF))}
function footer(t){return {text:`© 2026 ${BRAND} × ${t}`}}
function val(i,id){for(const r of i.data?.components||[])for(const c of r.components||[])if(c.custom_id===id)return String(c.value||'');return ''}
function clean(s){return String(s||'user').toLowerCase().replace(/[^a-z0-9-_]/g,'-').replace(/-+/g,'-').slice(0,28)||'user'}

// REST przez wbudowane https — bez fetch/undici.
function req(method,route,body,extra={}){return new Promise((resolve,reject)=>{let data=body==null?null:Buffer.from(typeof body==='string'?body:j(body));const q=https.request({hostname:'discord.com',path:'/api/v10'+route,method,headers:{Authorization:'Bot '+TOKEN,...(data?{'Content-Type':'application/json','Content-Length':data.length}:{}),...extra}},r=>{const a=[];r.on('data',x=>a.push(x));r.on('end',async()=>{const s=Buffer.concat(a).toString();if(r.statusCode===429){let t=1000;try{t=Math.ceil(JSON.parse(s).retry_after*1000)}catch{};await sleep(t+50);return req(method,route,body,extra).then(resolve,reject)}if(r.statusCode>=400)return reject(Error(`Discord ${r.statusCode}: ${s.slice(0,250)}`));if(!s)return resolve(null);try{resolve(JSON.parse(s))}catch{resolve(s)}})});q.on('error',reject);if(data)q.end(data);else q.end()})}
function upload(channel,payload,file){return new Promise((resolve,reject)=>{const boundary='----rs'+Date.now().toString(36),fileBuf=fs.readFileSync(path.join(__dirname,file)),p={...payload,attachments:[{id:0,filename:file}]};const head=Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="payload_json"\r\nContent-Type: application/json\r\n\r\n${j(p)}\r\n--${boundary}\r\nContent-Disposition: form-data; name="files[0]"; filename="${file}"\r\nContent-Type: image/${file.endsWith('.png')?'png':'jpeg'}\r\n\r\n`),tail=Buffer.from(`\r\n--${boundary}--\r\n`),len=head.length+fileBuf.length+tail.length;const q=https.request({hostname:'discord.com',path:`/api/v10/channels/${channel}/messages`,method:'POST',headers:{Authorization:'Bot '+TOKEN,'Content-Type':'multipart/form-data; boundary='+boundary,'Content-Length':len}},r=>{const a=[];r.on('data',x=>a.push(x));r.on('end',()=>{const s=Buffer.concat(a).toString();if(r.statusCode>=400)return reject(Error(`Upload ${r.statusCode}: ${s.slice(0,250)}`));try{resolve(JSON.parse(s))}catch{resolve(null)}})});q.on('error',reject);q.write(head);q.write(fileBuf);q.end(tail)})}
const cb=(i,type,data)=>req('POST',`/interactions/${i.id}/${i.token}/callback`,data===undefined?{type}:{type,data});
const eph=(i,content)=>cb(i,4,{content,flags:64});

function panelTicket(){return {embeds:[{color:COLOR,title:'🌊  ·  RYNEK SHOP × TICKETY',description:`${ce('71334shop','🛒')} · **Chcesz zakupić przedmiot lub potrzebujesz pomocy od administracji?**\n\n${ce('259419darkbluearrow','»')} · Kliknij __przycisk__, a my się nim **zajmiemy**!`,image:{url:'attachment://ticket-banner.png'},footer:footer('Panel Ticketów')}],components:[row(btn('t:new','Stwórz ticket',1,'71334shop'))]}}
function panelProducts(){return {embeds:[{color:COLOR,title:'🌊  ·  RYNEK SHOP × PRODUKTY',description:`${ce('259419darkbluearrow','»')}︲ **Chcesz zakupić przedmiot ale nie wiesz gdzie znajdziesz aktualne ceny?**\n\n> ${ce('259419darkbluearrow','»')}︲ **Użyj PRZYCISKU poniżej** i wybierz kategorię produktu, który Cię **interesuje.**`,image:{url:'attachment://products-banner.png'},footer:footer('Produkty')}],components:[row({type:3,custom_id:'p:pick',placeholder:'Wybierz kategorię',options:Object.keys(PRODUCTS).map(x=>({label:x,value:x}))})]}}
function stickyLegitText(){return `          ✅ ⠂ **RYNEK SHOP × legitki** ⠂ ✅\n\n${ce('23646yes','✅')} × **Wzór legitki:**\n\n\`+rep @auto_wywrotka  [przedmiot]  [metoda płatnosci]\`\n\n📝 **Przykład:**\n\n\`+rep @auto_wywrotka PROTO [blik]\``}
function modal(){const f=(id,l,p)=>({type:4,custom_id:id,label:l,style:1,required:true,max_length:100,placeholder:p});return {custom_id:'t:modal',title:'Formularz Zakupu',components:[row(f('item','Co chcesz zakupić?','np. Robux / item')),row(f('amount','Kwota','np. 50 PLN')),row(f('pay','Metoda płatności','np. BLIK / PSC'))]}}
function ticketEmbed(u,t){return {embeds:[{color:COLOR,title:'🌊  ·  RYNEK SHOP × ZAKUP',description:`${ce('71334shop','🛒')} **Informacje o tickecie**\n• Klient: <@${u.id}>\n• ID: \`${t.id}\`\n• Co kupuje: **${t.item}**\n• Kwota: **${t.amount}**\n• Płatność: **${t.pay}**\n• Przejął: ${t.claim?`<@${t.claim}>`:'Nikt'}`,footer:footer('Zakup')}],components:[row(btn('t:close','Zamknij',4,'31274xids'),btn('t:claim','Przejmij',1,'weryfikacja_1'),btn('t:set','Ustawienia',2,'bot'))]}}

async function commands(){const channelOpt={type:3,name:'kanal',description:'ID lub oznaczenie kanału, np. <#123456789012345678>',required:true};await req('PUT',`/applications/${BOT}/guilds/${GUILD}/commands`,[{name:'panel-tickety',description:'Wyślij panel ticketów'},{name:'panel-produkty',description:'Wyślij panel produktów'},{name:'sticky-legit',description:'Ustaw sticky legit na wybranym kanale',options:[channelOpt]},{name:'sticky-usun',description:'Usuń sticky legit z wybranego kanału',options:[channelOpt]}])}
function slashOpt(i,n){return i.data?.options?.find(x=>x.name===n)?.value}
function channelId(v){const m=String(v||'').match(/\d{17,20}/);return m?m[0]:null}
async function postSticky(ch){const m=await req('POST',`/channels/${ch}/messages`,{content:stickyLegitText(),allowed_mentions:{parse:[]}});store.stickies[ch]={messageId:m.id};saveStore();return m}
async function removeSticky(ch,del=true){const cur=store.stickies[ch];delete store.stickies[ch];saveStore();const t=stickyTimers.get(ch);if(t){clearTimeout(t);stickyTimers.delete(ch)}if(del&&cur?.messageId)try{await req('DELETE',`/channels/${ch}/messages/${cur.messageId}`)}catch{} }
function bumpSticky(ch){if(!store.stickies[ch])return;const old=stickyTimers.get(ch);if(old)clearTimeout(old);stickyTimers.set(ch,setTimeout(async()=>{stickyTimers.delete(ch);const cur=store.stickies[ch];if(!cur)return;if(cur.messageId)try{await req('DELETE',`/channels/${ch}/messages/${cur.messageId}`)}catch{}try{await postSticky(ch)}catch(e){console.error('sticky:',e.message)}},500))}
async function onInteraction(i){try{const u=i.member?.user||i.user||{};if(i.type===2){if(!staff(i.member))return eph(i,'❌ Tylko administracja/sprzedawca.');if(i.data.name==='panel-tickety'){await upload(i.channel_id,panelTicket(),ASSET.ticket);return eph(i,'✅ Panel ticketów wysłany.')}if(i.data.name==='panel-produkty'){await upload(i.channel_id,panelProducts(),ASSET.products);return eph(i,'✅ Panel produktów wysłany.')}if(i.data.name==='sticky-legit'){const ch=channelId(slashOpt(i,'kanal'));if(!ch)return eph(i,'❌ Podaj kanał w formacie <#ID> albo samo ID.');await removeSticky(ch,true);await postSticky(ch);return eph(i,`✅ Sticky legit ustawione na <#${ch}>.`)}if(i.data.name==='sticky-usun'){const ch=channelId(slashOpt(i,'kanal'));if(!ch)return eph(i,'❌ Podaj kanał w formacie <#ID> albo samo ID.');if(!store.stickies[ch])return eph(i,`ℹ️ Na <#${ch}> nie ma aktywnego sticky legit.`);await removeSticky(ch,true);return eph(i,`✅ Sticky legit usunięte z <#${ch}>.`)}}
if(i.type===3){const id=i.data.custom_id;if(id==='t:new')return cb(i,9,modal());if(id==='p:pick'){const x=i.data.values?.[0],p=PRODUCTS[x];if(!p)return eph(i,'❌ Nieznana kategoria.');return eph(i,`${ce('259419darkbluearrow','»')} **︲** Przeglądasz produkty w kategorii **<#${p.channel}> ⭢**\n${ce('259419darkbluearrow','»')}**︲** W tej kategorii jest **${p.count} przedmiotów.**`)}const t=tickets.get(i.channel_id);if(!t)return eph(i,'Ticket nie jest już aktywny.');if(!staff(i.member))return eph(i,'❌ Te przyciski są tylko dla administracji/sprzedawcy.');if(id==='t:claim'){t.claim=u.id;await cb(i,7,ticketEmbed({id:t.owner},t));return}if(id==='t:set')return eph(i,'⚙️ Ustawienia ticketu są dostępne dla staffu.');if(id==='t:close'){await cb(i,6);try{const dm=await req('POST','/users/@me/channels',{recipient_id:t.owner});await req('POST',`/channels/${dm.id}/messages`,{embeds:[{color:COLOR,title:'🌊  ·  RYNEK SHOP × ZAMKNIĘTO TICKET',description:`Twój ticket został **zamknięty**.\n\n${ce('71334shop','🛒')} **Informacje:**\n• ID: \`${t.id}\`\n• Przedmiot: **${t.item}**\n• Kwota: **${t.amount}**\n• Płatność: **${t.pay}**\n• Zamknął: <@${u.id}>`,footer:footer('Zamknięto ticket')}]})}catch{}tickets.delete(i.channel_id);setTimeout(()=>req('DELETE',`/channels/${i.channel_id}`).catch(()=>{}),1000);return}}
if(i.type===5&&i.data.custom_id==='t:modal'){await cb(i,5,{flags:64});const t={id:crypto.randomBytes(4).toString('hex'),owner:u.id,item:val(i,'item'),amount:val(i,'amount'),pay:val(i,'pay'),claim:null};const ch=await req('POST',`/guilds/${GUILD}/channels`,{name:`ticket-${clean(u.username)}`,type:0,parent_id:CAT,permission_overwrites:[{id:GUILD,type:0,deny:'1024'},{id:u.id,type:1,allow:'68608'},{id:STAFF,type:0,allow:'68608'}]});tickets.set(ch.id,t);await req('POST',`/channels/${ch.id}/messages`,ticketEmbed(u,t));await req('PATCH',`/webhooks/${i.application_id}/${i.token}/messages/@original`,{content:`✅ Ticket utworzony: <#${ch.id}>`});}}
catch(e){console.error('interaction:',e.message);try{await eph(i,'❌ Wystąpił błąd.')}catch{}}}

// Minimalny WebSocket RFC6455 do Discord Gateway.
// Stabilny, lekki WebSocket RFC6455 do Discord Gateway.
// Ważne: tylko JEDEN reconnect naraz. Poprzednia wersja mogła uruchamiać
// kilka reconnectów równocześnie (error + close), co z czasem zwiększało RAM.
let reconnectTimer=null, connSerial=0, hsBuf=Buffer.alloc(0),didInit=false,lastAck=true;
const MAX_FRAME=8*1024*1024, MAX_HS=32*1024;

function makeFrame(op,payload){
  const p=Buffer.isBuffer(payload)?payload:Buffer.from(payload||'');
  const n=p.length, mask=crypto.randomBytes(4);
  let h;
  if(n<126){h=Buffer.alloc(2);h[0]=0x80|op;h[1]=0x80|n}
  else if(n<=0xffff){h=Buffer.alloc(4);h[0]=0x80|op;h[1]=0xfe;h.writeUInt16BE(n,2)}
  else{h=Buffer.alloc(10);h[0]=0x80|op;h[1]=0xff;h.writeBigUInt64BE(BigInt(n),2)}
  const x=Buffer.allocUnsafe(n);
  for(let i=0;i<n;i++)x[i]=p[i]^mask[i&3];
  return Buffer.concat([h,mask,x]);
}
function sendFrame(op,payload){const s=sock;if(s&&!s.destroyed&&s.writable)s.write(makeFrame(op,payload))}
function sendGW(o){sendFrame(1,j(o))}

function scheduleReconnect(reason){
  clearInterval(HB);HB=null;
  if(reconnectTimer)return;
  const s=sock;sock=null;
  if(s){try{s.removeAllListeners('data');s.removeAllListeners('error');s.removeAllListeners('close');s.destroy()}catch{}}
  buf=Buffer.alloc(0);hsBuf=Buffer.alloc(0);frag='';
  reconnectTimer=setTimeout(()=>{reconnectTimer=null;connect()},3000);
  if(reason)console.log('Gateway reconnect:',reason);
}

function parse(){
  while(buf.length>=2){
    const b0=buf[0],b1=buf[1],op=b0&15,fin=!!(b0&128),masked=!!(b1&128);
    let n=b1&127,p=2;
    if(n===126){if(buf.length<4)return;n=buf.readUInt16BE(2);p=4}
    else if(n===127){if(buf.length<10)return;const bn=buf.readBigUInt64BE(2);if(bn>BigInt(MAX_FRAME))return scheduleReconnect('frame too large');n=Number(bn);p=10}
    if(n>MAX_FRAME)return scheduleReconnect('frame too large');
    let mask=null;if(masked){if(buf.length<p+4)return;mask=buf.subarray(p,p+4);p+=4}
    if(buf.length<p+n)return;
    let d=buf.subarray(p,p+n);buf=buf.subarray(p+n);
    if(mask){const u=Buffer.allocUnsafe(n);for(let i=0;i<n;i++)u[i]=d[i]^mask[i&3];d=u}
    if(op===8){sendFrame(8,d);return scheduleReconnect('server close')}
    if(op===9){sendFrame(10,d);continue}
    if(op===10)continue;
    if(op===1){
      frag=d.toString('utf8');
      if(fin){const s=frag;frag='';handle(s)}
    }else if(op===0){
      frag+=d.toString('utf8');
      if(frag.length>MAX_FRAME)return scheduleReconnect('fragment too large');
      if(fin){const s=frag;frag='';handle(s)}
    }
  }
}

function handle(s){
  let x;try{x=JSON.parse(s)}catch{return}
  if(x.s!=null)SEQ=x.s;
  if(x.op===1){sendGW({op:1,d:SEQ});return}
  if(x.op===11){lastAck=true;return}
  if(x.op===10){
    clearInterval(HB);
    lastAck=true;
    HB=setInterval(()=>{
      if(!lastAck)return scheduleReconnect('heartbeat timeout');
      lastAck=false;
      sendGW({op:1,d:SEQ});
    },Math.max(1000,x.d.heartbeat_interval));
    sendGW({op:2,d:{token:TOKEN,intents:512,properties:{os:'linux',browser:'rynek',device:'rynek'}}});
    return;
  }
  if(x.op===7)return scheduleReconnect('opcode 7');
  if(x.op===9)return scheduleReconnect('invalid session');
  if(x.t==='READY'){
    BOT=x.d.user.id;
    if(!didInit){
      didInit=true;
      req('GET',`/guilds/${GUILD}/emojis`).then(a=>{emojis.clear();for(const e of a||[])emojis.set(e.name,e)}).catch(()=>{});
      commands().then(()=>console.log('Rynek Shop online. MIN-RAM v2.')).catch(e=>console.error(e.message));
    }else{
      console.log('Gateway READY po reconnect.');
    }
    return;
  }
  if(x.t==='MESSAGE_CREATE'){const m=x.d;if(m?.channel_id&&store.stickies[m.channel_id]&&m.author?.id!==BOT)bumpSticky(m.channel_id);return}
  if(x.t==='INTERACTION_CREATE')onInteraction(x.d);
}

function connect(){
  if(sock||reconnectTimer)return;
  const id=++connSerial,key=crypto.randomBytes(16).toString('base64');
  const s=tls.connect(443,'gateway.discord.gg',{servername:'gateway.discord.gg'});sock=s;
  let handshaking=true;hsBuf=Buffer.alloc(0);buf=Buffer.alloc(0);frag='';
  s.setNoDelay(true);
  s.setKeepAlive(true,30000);
  s.on('secureConnect',()=>{
    if(sock!==s||id!==connSerial)return;
    s.write(`GET /?v=10&encoding=json HTTP/1.1\r\nHost: gateway.discord.gg\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: ${key}\r\nSec-WebSocket-Version: 13\r\n\r\n`);
  });
  s.on('data',d=>{
    if(sock!==s||id!==connSerial)return;
    if(handshaking){
      hsBuf=Buffer.concat([hsBuf,d]);
      if(hsBuf.length>MAX_HS)return scheduleReconnect('handshake too large');
      const i=hsBuf.indexOf('\r\n\r\n');if(i<0)return;
      const head=hsBuf.subarray(0,i).toString('latin1');
      if(!head.startsWith('HTTP/1.1 101'))return scheduleReconnect('handshake rejected');
      handshaking=false;
      const rest=hsBuf.subarray(i+4);hsBuf=Buffer.alloc(0);
      if(rest.length){buf=rest;parse()}
      return;
    }
    if(buf.length+d.length>MAX_FRAME*2)return scheduleReconnect('receive buffer too large');
    buf=buf.length?Buffer.concat([buf,d]):d;
    parse();
  });
  s.on('error',e=>{if(sock===s&&id===connSerial)scheduleReconnect(e.code||'socket error')});
  s.on('close',()=>{if(sock===s&&id===connSerial)scheduleReconnect('socket closed')});
}

// Monitoring co 10 s. Jeśli zewnętrzne bufory zaczną rosnąć, bot sam je czyści.
let memTicks=0;
setInterval(()=>{
  const m=process.memoryUsage(), mb=x=>Math.round(x/1048576);
  console.log(`RAM: rss=${mb(m.rss)}MB heap=${mb(m.heapUsed)}MB ext=${mb(m.external)}MB buf=${mb(m.arrayBuffers||0)}MB`);
  memTicks++;
  if(memTicks%3===0 && global.gc)global.gc();
  if(m.rss>210*1048576){
    buf=Buffer.alloc(0);hsBuf=Buffer.alloc(0);frag='';
    if(global.gc)global.gc();
  }
  if(m.rss>250*1048576 && sock){
    console.log('RAM guard: restart Gateway przed limitem hostingu.');
    scheduleReconnect('RAM guard');
  }
},10000).unref();

process.on('uncaughtException',e=>console.error('uncaught:',e&&e.stack||e));
process.on('unhandledRejection',e=>console.error('rejection:',e&&e.stack||e));

connect();
