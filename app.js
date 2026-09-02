// ══ ALDAR REPOSTERÍA — LÓGICA DE LA APP ══
// Este archivo requiere que config.js se cargue ANTES que este script
// en el HTML (para tener disponibles SB_URL y SB_KEY).

async function sbFetch(table, method='GET', body=null, query='', preferExtra=''){
  const url=`${SB_URL}/rest/v1/${table}${query}`;
  const headers={
    'apikey': SB_KEY,
    'Authorization': `Bearer ${SB_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': `return=representation${preferExtra?','+preferExtra:''}`
  };
  const res = await fetch(url, {method, headers, body: body?JSON.stringify(body):null});
  if(!res.ok){
    const e=await res.text();
    console.error('SB error:',e);
    if(typeof showToast==='function') showToast(`⚠ Error guardando en la nube (${table})`);
    if(typeof showSyncStatus==='function') showSyncStatus(`⚠ Error al sincronizar ${table}`,false,true);
    return null;
  }
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

async function sbGet(table, query=''){ return sbFetch(table,'GET',null,query); }
async function sbUpsert(table, data, conflictCol='id'){
  return sbFetch(table,'POST', Array.isArray(data)?data:[data],
    `?on_conflict=${conflictCol}`, 'resolution=merge-duplicates');
}
async function sbDelete(table, id){
  return sbFetch(table,'DELETE',null,`?id=eq.${id}`);
}
async function sbPatch(table, id, data){
  return sbFetch(table,'PATCH',data,`?id=eq.${id}`);
}

// ── Sync helpers ──
// Convert camelCase app objects to snake_case DB rows
function invToRow(i){return{id:i.id,cat:i.cat,name:i.name,prov:i.prov||'',where:i.where||'',description:i.desc||'',pkg_qty:i.pkgQty||1,pkg_cost:i.pkgCost||0,unit_cost:i.unitCost||0,unit:i.unit||'gr',unit_size:i.unitSize||1,min_stock:i.min||0,max_stock:i.max||0,stock:i.stock||0};}
function rowToInv(r){return{id:r.id,cat:r.cat,name:r.name,prov:r.prov,where:r.where,desc:r.description,pkgQty:r.pkg_qty,pkgCost:r.pkg_cost,unitCost:r.unit_cost,unit:r.unit,unitSize:r.unit_size,min:r.min_stock,max:r.max_stock,stock:r.stock};}
function recToRow(r){return{id:r.id,name:r.name,emoji:r.emoji,cat:r.cat,batch:r.batch,description:r.desc||'',price:r.price||0,img:r.img||'',ings:r.ings||[]};}
function rowToRec(r){return{id:r.id,name:r.name,emoji:r.emoji,cat:r.cat,batch:r.batch,desc:r.description,price:r.price,img:r.img,ings:r.ings||[]};}
function cliToRow(c){return{id:c.id,name:c.name,type:c.type,phone:c.phone||'',birth:c.birth||null,civil:c.civil||'',addr:c.addr||'',notes:c.notes||'',order_count:c.orderCount||0,last_order:c.lastOrder||''};}
function rowToCli(r){return{id:r.id,name:r.name,type:r.type,phone:r.phone,birth:r.birth,civil:r.civil,addr:r.addr,notes:r.notes,orderCount:r.order_count,lastOrder:r.last_order};}
function ordToRow(o){return{id:o.id,ts:o.ts,lines:o.lines||[],rec_name:o.recName,rec_emoji:o.recEmoji,total_pcs:o.totalPcs||0,cli_id:o.cliId||null,cli_name:o.cliName||'',cli_addr:o.cliAddr||'',price:o.price||0,pay_status:o.payStatus,pay_type:o.payType,notes:o.notes||'',cancelled:o.cancelled||false,needs_production:o.needsProduction||false,date:o.date,prod_date:o.prodDate||'',prod_date_raw:o.prodDateRaw||'',delivery:o.delivery||'',delivery_raw:o.deliveryRaw||'',ings:o.ings||[]};}
function rowToOrd(r){return{id:r.id,ts:r.ts,lines:r.lines,recName:r.rec_name,recEmoji:r.rec_emoji,totalPcs:r.total_pcs,cliId:r.cli_id,cliName:r.cli_name,cliAddr:r.cli_addr,price:r.price,payStatus:r.pay_status,payType:r.pay_type,notes:r.notes,cancelled:r.cancelled,needsProduction:r.needs_production||false,date:r.date,prodDate:r.prod_date,prodDateRaw:r.prod_date_raw,delivery:r.delivery,deliveryRaw:r.delivery_raw,ings:r.ings||[]};}
function purToRow(p){return{id:p.id,ts:p.ts,date:p.date,date_raw:p.dateRaw||'',prov:p.prov||'',notes:p.notes||'',items:p.items||[],total:p.total||0};}
function rowToPur(r){return{id:r.id,ts:r.ts,date:r.date,dateRaw:r.date_raw,prov:r.prov,notes:r.notes,items:r.items,total:r.total};}

// ── Load all data from Supabase on startup ──
let _sbReady=false;
async function loadFromSupabase(){
  showSyncStatus('Conectando con la nube…');
  try{
    const [invRows,recRows,cliRows,ordRows,purRows,poolRows,cfgRows]=await Promise.all([
      sbGet('inventory','?order=name'),
      sbGet('recipes','?order=name'),
      sbGet('clients','?order=name'),
      sbGet('orders','?order=ts.desc'),
      sbGet('purchases','?order=ts.desc'),
      sbGet('batch_pool'),
      sbGet('config','?id=eq.1'),
    ]);
    if(invRows&&invRows.length){ inv=invRows.map(rowToInv); ss('aldar_inv',inv); }
    if(recRows&&recRows.length){ recipes=recRows.map(rowToRec); ss('aldar_rec',recipes); }
    if(cliRows&&cliRows.length){ clients=cliRows.map(rowToCli); ss('aldar_cli',clients); }
    if(ordRows&&ordRows.length){ orders=ordRows.map(rowToOrd); ss('aldar_ord',orders); }
    if(purRows&&purRows.length){ purchases=purRows.map(rowToPur); ss('aldar_comp',purchases); }
    if(poolRows){ batchPool={}; poolRows.forEach(r=>batchPool[r.rec_id]=r.qty); ss('aldar_pool',batchPool); }
    if(cfgRows&&cfgRows.length){
      const c=cfgRows[0];
      cfg={waNum:c.wa_num,waOn:c.wa_on,bizName:c.biz_name,bizPhone:c.biz_phone||'',bizAddr:c.biz_addr||''};
      ss('aldar_cfg',cfg);
    }
    _sbReady=true;
    showSyncStatus('✓ Sincronizado',true);
    renderHome();
  }catch(e){
    console.error('Supabase load error:',e);
    showSyncStatus('⚠ Sin conexión (modo local)',false,true);
  }
}

function showSyncStatus(msg, ok=false, warn=false){
  let el=document.getElementById('syncStatus');
  if(!el){
    el=document.createElement('div');
    el.id='syncStatus';
    el.style.cssText='position:fixed;top:60px;left:50%;transform:translateX(-50%);background:var(--surface2);border:1px solid var(--border);padding:6px 16px;border-radius:20px;font-size:11px;z-index:400;transition:opacity .5s;white-space:nowrap';
    document.body.appendChild(el);
  }
  el.textContent=msg;
  el.style.color=ok?'var(--green)':warn?'var(--yellow)':'var(--muted)';
  el.style.opacity='1';
  if(ok)setTimeout(()=>el.style.opacity='0',2500);
}

// ── Override saveAll to also push to Supabase ──
async function saveAll(){
  // local first
  ss('aldar_inv',inv);ss('aldar_rec',recipes);ss('aldar_ord',orders);
  ss('aldar_cli',clients);ss('aldar_pool',batchPool);ss('aldar_comp',purchases);
}

async function sbSaveInv(item){
  saveAll();
  if(!_sbReady)return;
  showSyncStatus('Guardando…');
  await sbUpsert('inventory',invToRow(item));
  showSyncStatus('✓ Guardado',true);
}
async function sbDeleteInv(id){
  saveAll();
  if(!_sbReady)return;
  await sbDelete('inventory',id);
  showSyncStatus('✓ Eliminado',true);
}
async function sbSaveRec(rec){
  saveAll();
  if(!_sbReady)return;
  showSyncStatus('Guardando…');
  await sbUpsert('recipes',recToRow(rec));
  showSyncStatus('✓ Guardado',true);
}
async function sbDeleteRec(id){
  saveAll();
  if(!_sbReady)return;
  await sbDelete('recipes',id);
  showSyncStatus('✓ Eliminado',true);
}
async function sbSaveCli(cli){
  saveAll();
  if(!_sbReady)return;
  showSyncStatus('Guardando…');
  await sbUpsert('clients',cliToRow(cli));
  showSyncStatus('✓ Guardado',true);
}
async function sbDeleteCli(id){
  saveAll();
  if(!_sbReady)return;
  await sbDelete('clients',id);
  showSyncStatus('✓ Eliminado',true);
}
async function sbSaveOrd(ord){
  saveAll();
  if(!_sbReady)return;
  showSyncStatus('Guardando…');
  await sbUpsert('orders',ordToRow(ord));
  showSyncStatus('✓ Guardado',true);
}
async function sbSaveOrdPatch(id,data){
  saveAll();
  if(!_sbReady)return;
  await sbPatch('orders',id,data);
  showSyncStatus('✓ Guardado',true);
}
async function sbSavePur(p){
  saveAll();
  if(!_sbReady)return;
  showSyncStatus('Guardando…');
  await sbUpsert('purchases',purToRow(p));
  showSyncStatus('✓ Guardado',true);
}
async function sbSavePool(){
  saveAll();
  if(!_sbReady)return;
  const rows=Object.entries(batchPool).map(([k,v])=>{return{rec_id:parseInt(k),qty:v}});
  if(rows.length)await sbUpsert('batch_pool',rows,'rec_id');
}
async function sbSaveCfg(){
  ss('aldar_cfg',cfg);
  if(!_sbReady)return;
  await sbPatch('config',1,{wa_num:cfg.waNum,wa_on:cfg.waOn,biz_name:cfg.bizName,biz_phone:cfg.bizPhone,biz_addr:cfg.bizAddr});
  showSyncStatus('✓ Config guardada',true);
}

// ══════════════════════════════════════════════════════
//  DATA
// ══════════════════════════════════════════════════════
const CAT_ICONS={'EMPAQUES':'📦','MATERIA PRIMA':'🌾','ESPECIAS':'🌿','CHOCOLATES':'🍫','LACTEOS':'🥛','ACEITES -HUEVO ORGANICOS':'🥚','SUSTITUTOS DE AZUCAR':'🍯','SUSTITUTOS DE MANTEQUILLA':'🧈','FRUTAS':'🍓','TOPPING':'🍬'};
const CATS=Object.keys(CAT_ICONS);

const DEF_INV=[
  {id:1,cat:'EMPAQUES',name:'CHICAS CUADRADAS',prov:'AMAZON',where:'Amazon',desc:'Cajas chicas cuadradas para empaque individual',pkgQty:60,pkgCost:498,unitCost:8.3,unit:'pzas',unitSize:1,min:30,max:40,stock:0},
  {id:2,cat:'EMPAQUES',name:'MEDIANAS RECTANGULARES',prov:'AMAZON',where:'Amazon',desc:'',pkgQty:50,pkgCost:607,unitCost:12.14,unit:'pzas',unitSize:1,min:25,max:30,stock:22},
  {id:3,cat:'EMPAQUES',name:'GRANDES CUADRADAS',prov:'AMAZON',where:'Amazon',desc:'',pkgQty:30,pkgCost:538.8,unitCost:17.96,unit:'pzas',unitSize:1,min:15,max:30,stock:21},
  {id:4,cat:'EMPAQUES',name:'GRANDE ALTA PARA PASTELES',prov:'AMAZON',where:'Amazon',desc:'',pkgQty:36,pkgCost:648,unitCost:18.0,unit:'pzas',unitSize:1,min:15,max:20,stock:17},
  {id:5,cat:'EMPAQUES',name:'CAKES MINIS',prov:'AMAZON',where:'Amazon',desc:'',pkgQty:50,pkgCost:319,unitCost:6.38,unit:'pzas',unitSize:1,min:20,max:30,stock:27},
  {id:6,cat:'EMPAQUES',name:'CAJA TRANSPARENTE CUADRADA CHICA',prov:'AMAZON',where:'Amazon',desc:'',pkgQty:20,pkgCost:550,unitCost:27.5,unit:'pzas',unitSize:1,min:10,max:20,stock:16},
  {id:7,cat:'EMPAQUES',name:'CAJA TRANSPARENTE INDIVIDUAL GALLETA',prov:'AMAZON',where:'Amazon',desc:'',pkgQty:100,pkgCost:476,unitCost:4.76,unit:'pzas',unitSize:1,min:30,max:60,stock:84},
  {id:8,cat:'EMPAQUES',name:'CAJA INDIVIDUAL CUPCAKE-PINGUINO',prov:'TERESITA',where:'Proveedor Teresita',desc:'',pkgQty:100,pkgCost:431,unitCost:4.31,unit:'pzas',unitSize:1,min:30,max:50,stock:0},
  {id:10,cat:'EMPAQUES',name:'CAJA DE 2 PINGUINOS-CUPCAKES',prov:'TERESITA',where:'Proveedor Teresita',desc:'',pkgQty:30,pkgCost:210,unitCost:7.0,unit:'pzas',unitSize:1,min:10,max:20,stock:22},
  {id:11,cat:'EMPAQUES',name:'CAJA DE 4 PINGUINOS-CUPCAKES',prov:'TERESITA',where:'Proveedor Teresita',desc:'',pkgQty:30,pkgCost:240,unitCost:8.0,unit:'pzas',unitSize:1,min:20,max:25,stock:12},
  {id:12,cat:'EMPAQUES',name:'CAJA DE 6 PINGUINOS-CUPCAKES',prov:'TERESITA',where:'Proveedor Teresita',desc:'',pkgQty:30,pkgCost:300,unitCost:10.0,unit:'pzas',unitSize:1,min:20,max:25,stock:0},
  {id:13,cat:'EMPAQUES',name:'CAJA DE 12 PINGUINOS-CUPCAKES',prov:'TERESITA',where:'Proveedor Teresita',desc:'',pkgQty:30,pkgCost:360,unitCost:12.0,unit:'pzas',unitSize:1,min:20,max:25,stock:0},
  {id:14,cat:'EMPAQUES',name:'TAPETES DORADO 20CM',prov:'TERESITA',where:'Proveedor Teresita',desc:'',pkgQty:100,pkgCost:150,unitCost:1.5,unit:'pzas',unitSize:1,min:30,max:50,stock:95},
  {id:15,cat:'EMPAQUES',name:'TAPETES DORADO 30CM',prov:'TERESITA',where:'Proveedor Teresita',desc:'',pkgQty:100,pkgCost:150,unitCost:1.5,unit:'pzas',unitSize:1,min:30,max:50,stock:12},
  {id:21,cat:'MATERIA PRIMA',name:'HARINA DE AVENA MOLIDA TIA OFILIA',prov:'AMAZON',where:'Amazon',desc:'Bolsa de 300gr. Se usa en cookies.',pkgQty:1,pkgCost:112,unitCost:112,unit:'gr',unitSize:300,min:2,max:3,stock:2},
  {id:22,cat:'MATERIA PRIMA',name:'HOJUELAS DE AVENA BOB RED MILL',prov:'AMAZON',where:'Amazon',desc:'Bolsa de 907gr.',pkgQty:1,pkgCost:249,unitCost:249,unit:'gr',unitSize:907,min:1,max:2,stock:1},
  {id:23,cat:'MATERIA PRIMA',name:'HARINA DE ALMENDRAS KIRKLAND',prov:'AMAZON',where:'Amazon/Costco',desc:'Bolsa de 1361gr. Ingrediente base de la mayoría de recetas fit.',pkgQty:1,pkgCost:349,unitCost:349,unit:'gr',unitSize:1361,min:1,max:2,stock:2},
  {id:24,cat:'MATERIA PRIMA',name:'HARINA SIN GLUTEN BOB RED MILL',prov:'AMAZON',where:'Amazon',desc:'Bolsa de 624gr.',pkgQty:1,pkgCost:179,unitCost:179,unit:'gr',unitSize:624,min:2,max:3,stock:2},
  {id:25,cat:'MATERIA PRIMA',name:'HARINA DE COCO TIA OFILIA',prov:'AMAZON',where:'Amazon',desc:'Bolsa de 300gr.',pkgQty:1,pkgCost:81,unitCost:81,unit:'gr',unitSize:300,min:1,max:2,stock:1},
  {id:26,cat:'ESPECIAS',name:'MAIZENA FECULA DE MAIZ',prov:'AMAZON',where:'Amazon',desc:'750gr.',pkgQty:1,pkgCost:97,unitCost:97,unit:'gr',unitSize:750,min:1,max:2,stock:1},
  {id:27,cat:'ESPECIAS',name:'POLVO PARA HORNEAR REXAL',prov:'AMAZON',where:'Amazon',desc:'500gr.',pkgQty:1,pkgCost:50,unitCost:50,unit:'gr',unitSize:500,min:1,max:2,stock:1},
  {id:28,cat:'ESPECIAS',name:'POLVO DE HORNEAR SIN ALUMINIO BOB RED MILL',prov:'TERESITA',where:'Proveedor Teresita',desc:'397gr. Sin aluminio, apto para línea fit.',pkgQty:1,pkgCost:179,unitCost:179,unit:'gr',unitSize:397,min:1,max:2,stock:0},
  {id:29,cat:'ESPECIAS',name:'FRUTOS SECOS VERDE VALLE',prov:'TERESITA',where:'Proveedor Teresita',desc:'80gr.',pkgQty:1,pkgCost:35,unitCost:35,unit:'gr',unitSize:80,min:2,max:3,stock:2},
  {id:30,cat:'ESPECIAS',name:'CANELA EN POLVO KIRKLAND',prov:'TERESITA',where:'Costco',desc:'303gr.',pkgQty:1,pkgCost:169,unitCost:169,unit:'gr',unitSize:303,min:1,max:2,stock:1},
  {id:31,cat:'ESPECIAS',name:'SAL HIMALAYA ROSA PRAGNA',prov:'TERESITA',where:'Proveedor Teresita',desc:'500gr.',pkgQty:1,pkgCost:69,unitCost:69,unit:'gr',unitSize:500,min:1,max:2,stock:1},
  {id:32,cat:'ESPECIAS',name:'BICARBONATO DE SODIO PROMESA',prov:'TERESITA',where:'Proveedor Teresita',desc:'220gr.',pkgQty:1,pkgCost:23.66,unitCost:23.66,unit:'gr',unitSize:220,min:1,max:2,stock:1},
  {id:33,cat:'ESPECIAS',name:'PUMPKIN SPICE MACCORMICK',prov:'TERESITA',where:'Proveedor Teresita',desc:'45gr.',pkgQty:1,pkgCost:51,unitCost:51,unit:'gr',unitSize:45,min:1,max:2,stock:1},
  {id:36,cat:'ESPECIAS',name:'ESCENCIA DE VAINILLA PROGOURMET',prov:'LEY',where:'Ley',desc:'500ml.',pkgQty:1,pkgCost:164.66,unitCost:164.66,unit:'ml',unitSize:500,min:1,max:2,stock:1},
  {id:37,cat:'ESPECIAS',name:'CARDAMOMO TERANA',prov:'BODEGUITA',where:'La Bodeguita',desc:'80gr.',pkgQty:1,pkgCost:136,unitCost:136,unit:'gr',unitSize:80,min:1,max:1,stock:1},
  {id:38,cat:'CHOCOLATES',name:'CHOCOLATE AMARGO WAFFER ALPEZZI',prov:'AMAZON',where:'Amazon',desc:'907gr. Para cobertura de pinguinos.',pkgQty:1,pkgCost:478,unitCost:478,unit:'gr',unitSize:907,min:1,max:2,stock:1},
  {id:39,cat:'CHOCOLATES',name:'CHOCOLATE OSCURO VEGANO PICARD',prov:'AMAZON',where:'Amazon',desc:'50 pzas.',pkgQty:1,pkgCost:254.66,unitCost:254.66,unit:'pzas',unitSize:50,min:1,max:2,stock:1},
  {id:40,cat:'CHOCOLATES',name:'CACAO KIRKLAND',prov:'COSTCO',where:'Costco',desc:'1000gr.',pkgQty:1,pkgCost:235,unitCost:235,unit:'gr',unitSize:1000,min:1,max:2,stock:1},
  {id:41,cat:'CHOCOLATES',name:'CHISPA DE CHOCOLATE SEMIAMARGO ALPEZZI',prov:'BODEGUITA',where:'La Bodeguita',desc:'100gr.',pkgQty:1,pkgCost:90,unitCost:90,unit:'gr',unitSize:100,min:1,max:2,stock:1},
  {id:43,cat:'LACTEOS',name:'LECHE DE ALMENDRAS GUD',prov:'WALMART',where:'Walmart',desc:'1 litro.',pkgQty:1,pkgCost:50,unitCost:50,unit:'ml',unitSize:1000,min:1,max:2,stock:1},
  {id:48,cat:'ACEITES -HUEVO ORGANICOS',name:'ACEITE DE COCO PRASADA',prov:'COSTCO',where:'Costco',desc:'2.28 litros.',pkgQty:1,pkgCost:389,unitCost:389,unit:'ml',unitSize:2280,min:1,max:2,stock:1},
  {id:50,cat:'ACEITES -HUEVO ORGANICOS',name:'HUEVOS ORGANICOS CHICOS',prov:'ESTACION ORGANICA',where:'Estación Orgánica',desc:'30 pzas por caja.',pkgQty:30,pkgCost:99.9,unitCost:3.33,unit:'pzas',unitSize:1,min:1,max:2,stock:30},
  {id:52,cat:'SUSTITUTOS DE AZUCAR',name:'MONK FRUIT LIGHT LIFE QUERETARO',prov:'VIDA LIJERA',where:'Vida Lijera',desc:'1kg.',pkgQty:1,pkgCost:480,unitCost:480,unit:'gr',unitSize:1000,min:1,max:2,stock:3},
  {id:53,cat:'SUSTITUTOS DE AZUCAR',name:'MIEL ORGANICA TIA OFILIA',prov:'WALMART',where:'Walmart',desc:'1 litro.',pkgQty:1,pkgCost:177,unitCost:177,unit:'ml',unitSize:1000,min:1,max:2,stock:1},
  {id:55,cat:'SUSTITUTOS DE AZUCAR',name:'AZUCAR DE COCO ENATURE',prov:'WALMART',where:'Walmart',desc:'300gr.',pkgQty:1,pkgCost:86,unitCost:86,unit:'gr',unitSize:300,min:2,max:3,stock:2},
  {id:57,cat:'SUSTITUTOS DE MANTEQUILLA',name:'CREMA DE ALMENDRAS KIRKLAND',prov:'COSTCO',where:'Costco',desc:'765gr.',pkgQty:1,pkgCost:259,unitCost:259,unit:'gr',unitSize:765,min:2,max:3,stock:2},
  {id:58,cat:'SUSTITUTOS DE MANTEQUILLA',name:'NUCOLATO CLASICO GLUTEN FREE',prov:'WALMART',where:'Walmart',desc:'355gr.',pkgQty:1,pkgCost:160,unitCost:160,unit:'gr',unitSize:355,min:2,max:3,stock:2},
  {id:63,cat:'SUSTITUTOS DE MANTEQUILLA',name:'MANTEQUILLA SIN SAL LALA',prov:'WALMART',where:'Walmart',desc:'360gr.',pkgQty:1,pkgCost:79,unitCost:79,unit:'gr',unitSize:360,min:4,max:8,stock:10},
  {id:65,cat:'FRUTAS',name:'FRESAS ORGANICAS KIRKLAND',prov:'COSTCO',where:'Costco',desc:'1.81kg.',pkgQty:1,pkgCost:312.34,unitCost:312.34,unit:'gr',unitSize:1810,min:1,max:1,stock:1},
  {id:72,cat:'FRUTAS',name:'DATIL MEDJOOL',prov:'COSTCO',where:'Costco',desc:'908gr.',pkgQty:1,pkgCost:274.5,unitCost:274.5,unit:'gr',unitSize:908,min:1,max:2,stock:1},
];

const DEF_RECIPES=[
  {id:1,name:'PINGUINOS FIT GOURMET',emoji:'🐧',cat:'Línea Fit',batch:6,desc:'Pinguinos de chocolate fit gourmet. Cobertura de chocolate amargo.',price:45,img:'',
   ings:[
    {invId:23,name:'HARINA DE ALMENDRAS KIRKLAND',qty:150,unit:'gr'},
    {invId:40,name:'CACAO KIRKLAND',qty:35,unit:'gr'},
    {invId:27,name:'POLVO PARA HORNEAR REXAL',qty:15,unit:'gr'},
    {invId:52,name:'MONK FRUIT LIGHT LIFE QUERETARO',qty:100,unit:'gr'},
    {invId:31,name:'SAL HIMALAYA ROSA PRAGNA',qty:3,unit:'gr'},
    {invId:43,name:'LECHE DE ALMENDRAS GUD',qty:75,unit:'ml'},
    {invId:50,name:'HUEVOS ORGANICOS CHICOS',qty:5,unit:'pzas'},
    {invId:48,name:'ACEITE DE COCO PRASADA',qty:65,unit:'ml'},
    {invId:36,name:'ESCENCIA DE VAINILLA PROGOURMET',qty:15,unit:'ml'},
    {invId:38,name:'CHOCOLATE AMARGO WAFFER ALPEZZI',qty:200,unit:'gr'},
    {invId:57,name:'CREMA DE ALMENDRAS KIRKLAND',qty:65,unit:'gr'},
  ]},
  {id:2,name:'CHOCOFIT COOKIES',emoji:'🍪',cat:'Línea Fit',batch:8,desc:'Galletas de chocolate fit sin gluten.',price:35,img:'',
   ings:[
    {invId:23,name:'HARINA DE ALMENDRAS KIRKLAND',qty:90,unit:'gr'},
    {invId:21,name:'HARINA DE AVENA MOLIDA TIA OFILIA',qty:32,unit:'gr'},
    {invId:55,name:'AZUCAR DE COCO ENATURE',qty:71,unit:'gr'},
    {invId:32,name:'BICARBONATO DE SODIO PROMESA',qty:3,unit:'gr'},
    {invId:31,name:'SAL HIMALAYA ROSA PRAGNA',qty:2,unit:'gr'},
    {invId:36,name:'ESCENCIA DE VAINILLA PROGOURMET',qty:15,unit:'ml'},
    {invId:50,name:'HUEVOS ORGANICOS CHICOS',qty:1,unit:'pzas'},
    {invId:57,name:'CREMA DE ALMENDRAS KIRKLAND',qty:83,unit:'gr'},
    {invId:41,name:'CHISPA DE CHOCOLATE SEMIAMARGO ALPEZZI',qty:32,unit:'gr'},
  ]},
];

// ── STORAGE ──
function ls(k,def){try{const v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch{return def;}}
function ss(k,v){
  try{localStorage.setItem(k,JSON.stringify(v));}
  catch(e){
    console.error('Storage error:',e);
    if(typeof showToast==='function') showToast('⚠ No se pudo guardar localmente (memoria llena)');
  }
}

let inv=ls('aldar_inv',DEF_INV);
let purchases=ls('aldar_comp',[]);
let recipes=ls('aldar_rec',DEF_RECIPES);
let orders=ls('aldar_ord',[]);
let clients=ls('aldar_cli',[{id:1,name:'Cafetería El Nido',type:'cafeteria',phone:'667-000-0001',addr:'Centro, Culiacán',notes:'Pedidos los lunes'}]);
// batchPool: piezas producidas disponibles por recetaId
let batchPool=ls('aldar_pool',{});

function saveAll(){ss('aldar_inv',inv);ss('aldar_rec',recipes);ss('aldar_ord',orders);ss('aldar_cli',clients);ss('aldar_pool',batchPool);ss('aldar_comp',purchases);}

// ── HELPERS ──
let _editStockQty=0,_editInvId=null,_editOrdQty=1,_viewOrdId=null;

function showToast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('on');setTimeout(()=>t.classList.remove('on'),2800);}
function closeOv(id){document.getElementById(id).classList.remove('on');}
function openOv(id){document.getElementById(id).classList.add('on');}

function stockSt(i){if(i.stock<=0)return'out';if(i.stock<i.min)return'low';return'ok';}
function bHtml(s){const m={ok:'bok',low:'blow',out:'bout'};const l={ok:'OK',low:'BAJO',out:'SIN STOCK'};return`<span class="badge ${m[s]}">${l[s]}</span>`;}
function fmtDate(){return new Date().toLocaleString('es-MX',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});}
function fmtMoney(n){return'$'+(+n||0).toFixed(2);}

function findInvById(id){return inv.find(i=>i.id===id);}
function findInvByName(name){
  const n=name.toUpperCase().replace(/\s+/g,' ').trim();
  let r=inv.find(i=>i.name.toUpperCase()===n);
  if(r)return r;
  const words=n.split(' ').filter(w=>w.length>3);
  return inv.find(i=>words.length>1&&words.every(w=>i.name.toUpperCase().includes(w)));
}
function getInvItem(ing){return ing.invId?findInvById(ing.invId):findInvByName(ing.name);}

// ── NAV ──
const TITLES={home:'Aldar Repostería',inv:'Inventario',rec:'Recetas',ord:'Órdenes',cli:'Clientes',comp:'Compras',rep:'Reportes',cfg:'Configuración'};
const SUBS={home:'',inv:'Todos los insumos',rec:'Catálogo de recetas',ord:'Historial de órdenes',cli:'Clientes y puntos de entrega',comp:'Entradas de insumos y gastos',rep:'Ventas vs. compras y utilidad',cfg:'Ajustes generales'};

function go(page,btn){
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('on'));
  document.getElementById('pg-'+page).classList.add('on');
  if(btn)btn.classList.add('on');
  document.getElementById('htitle').textContent=TITLES[page];
  document.getElementById('hsub').textContent=SUBS[page];
  document.getElementById('fabMain').style.display=['home','ord','rec','inv'].includes(page)?'flex':'none';
  document.getElementById('fabSec').style.display=page==='rec'?'flex':'none';
  if(page==='home')renderHome();
  if(page==='inv')renderInv();
  if(page==='rec')renderRec();
  if(page==='ord')renderOrd();
  if(page==='cli')renderCli();
}

function fabMainClick(){
  const p=document.querySelector('.pg.on').id.replace('pg-','');
  if(p==='ord'||p==='home')openNewOrd();
  else if(p==='inv')openNewInvItem();
  else if(p==='rec')openNewRec();
  else if(p==='cli')openNewCli();
  else if(p==='comp')openNewComp();
}
function fabSecClick(){openNewRec();}

// ══ HOME ══
function renderHome(){
  const out=inv.filter(i=>i.stock<=0).length;
  const low=inv.filter(i=>i.stock>0&&i.stock<i.min).length;
  document.getElementById('stTotal').textContent=inv.length;
  document.getElementById('stOut').textContent=out;
  document.getElementById('stLow').textContent=low;
  document.getElementById('stOrders').textContent=orders.filter(o=>!o.cancelled).length;
  const active=orders.filter(o=>!o.cancelled);
  const pending=active.filter(o=>o.needsProduction);
  const rest=active.filter(o=>!o.needsProduction).reverse();
  const rec=[...pending.reverse(),...rest].slice(0,6);
  document.getElementById('homeOrders').innerHTML=rec.length?rec.map(miniOrdCard).join(''):'<div class="empty" style="padding:12px"><div>📋</div>Sin órdenes</div>';
  renderHomeProdNeeded();
}

function renderHomeProdNeeded(){
  const box=document.getElementById('homeProdNeeded');
  if(!box)return;
  const need={};
  orders.filter(o=>!o.cancelled&&o.needsProduction).forEach(o=>{
    (o.lines||[]).forEach(l=>{
      if(l.short>0)need[l.recId]=(need[l.recId]||0)+l.short;
    });
  });
  const entries=Object.entries(need).filter(([,short])=>short>0);
  if(entries.length===0){box.innerHTML='';return;}
  box.innerHTML=`<div class="slbl">🏭 Producción pendiente para completar pedidos</div>`+
    entries.map(([recId,short])=>{
      const rec=recipes.find(r=>r.id===parseInt(recId));
      if(!rec)return'';
      const lotes=Math.ceil(short/(rec.batch||1));
      return `<div class="ocard" style="display:flex;justify-content:space-between;align-items:center;border-color:var(--accent2)">
        <span style="font-size:13px">${rec.emoji} <b>${rec.name}</b><br><span style="color:var(--muted);font-size:11px">Faltan ${short} pzas</span></span>
        <span style="background:var(--accent2);color:#fff;padding:6px 12px;border-radius:10px;font-weight:700;font-size:13px">${lotes} lote${lotes===1?'':'s'}</span>
      </div>`;
    }).join('');
}

function invRowHtml(i){
  const st=stockSt(i);const col={ok:'var(--green)',low:'var(--yellow)',out:'var(--red)'};
  return`<div class="irow" onclick="openEditInvItem(${i.id})">
    <div class="iico">${CAT_ICONS[i.cat]||'📦'}</div>
    <div class="iinfo"><div class="iname">${i.name}</div><div class="isub">${bHtml(st)} · ${i.prov}</div></div>
    <div class="iright"><div class="irval" style="color:${col[st]}">${i.stock}</div><div class="irlbl">/ mín ${i.min}</div></div>
  </div>`;
}

function miniOrdCard(o){
  const st=o.cancelled?'<span class="badge bcan">CANCELADA</span>':o.needsProduction?'<span class="badge blow">🏭 A PRODUCIR</span>':o.payStatus==='paid'?'<span class="badge bpaid">PAGADO</span>':'<span class="badge blow">PENDIENTE</span>';
  return`<div class="irow" onclick="openOrdDet(${o.id})">
    <div class="iico">${o.recEmoji}</div>
    <div class="iinfo"><div class="iname">${o.recName}</div><div class="isub">${o.date} · ${o.cliName||'Sin cliente'}</div></div>
    <div class="iright"><div class="irval">${fmtMoney(o.price)}</div><div class="irlbl" style="margin-top:2px">${st}</div></div>
  </div>`;
}

// ══ INVENTORY ══
let _invCat='Todos',_invQ='',_invStockFilter='all';

function goToInvFiltered(mode){
  _invStockFilter=mode;_invCat='Todos';_invQ='';
  const el=document.getElementById('invQ');if(el)el.value='';
  go('inv',document.getElementById('nb-inv'));
}

function renderInv(){
  const cats=['Todos',...new Set(inv.map(i=>i.cat))];
  document.getElementById('invChips').innerHTML=cats.map(c=>`<div class="chip ${c===_invCat?'on':''}" onclick="setInvCat('${c}')">${c==='Todos'?'🌟 Todos':((CAT_ICONS[c]||'')+' '+c)}</div>`).join('');
  let list=inv;
  if(_invCat!=='Todos')list=list.filter(i=>i.cat===_invCat);
  if(_invQ)list=list.filter(i=>i.name.toLowerCase().includes(_invQ.toLowerCase()));
  if(_invStockFilter==='out')list=list.filter(i=>i.stock<=0);
  else if(_invStockFilter==='low')list=list.filter(i=>i.stock>0&&i.stock<i.min);
  const banner=_invStockFilter!=='all'?`<div class="ocard" style="display:flex;justify-content:space-between;align-items:center;border-color:var(--accent2)">
    <span style="font-size:13px">Mostrando: <b>${_invStockFilter==='out'?'Sin stock':'Stock bajo'}</b></span>
    <button class="btn bsm bg" onclick="_invStockFilter='all';renderInv()">Ver todos</button>
  </div>`:'';
  document.getElementById('invList').innerHTML=banner+(list.length?list.map(invRowHtml).join(''):'<div class="empty"><div>🔍</div>Sin resultados</div>');
}
function setInvCat(c){_invCat=c;_invStockFilter='all';renderInv();}
function filterInv(){_invQ=document.getElementById('invQ').value;renderInv();}
function toggleClearBtn(inputId,btnId){
  const v=document.getElementById(inputId).value;
  document.getElementById(btnId).style.display=v?'block':'none';
}
function clearSearch(inputId,btnId,cb){
  document.getElementById(inputId).value='';
  document.getElementById(btnId).style.display='none';
  if(cb)cb();
}

// OPEN INV MODAL
function openNewInvItem(){
  _editInvId=null;_editStockQty=0;
  document.getElementById('invMTitle').textContent='Nuevo Insumo';
  document.getElementById('invMId').value='';
  ['invMName','invMProv','invMWhere','invMDesc','invMUnit'].forEach(id=>document.getElementById(id).value='');
  ['invMPkgQty','invMPkgCost','invMUnitCost','invMSize','invMMin','invMMax'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('invMStock').textContent='0';
  document.getElementById('invMDel').style.display='none';
  fillCatSel('invMCat','');
  openOv('ovInv');
}

function openEditInvItem(id){
  const item=inv.find(i=>i.id===id);
  _editInvId=id;_editStockQty=item.stock;
  document.getElementById('invMTitle').textContent=item.name;
  document.getElementById('invMId').value=id;
  document.getElementById('invMName').value=item.name;
  document.getElementById('invMProv').value=item.prov||'';
  document.getElementById('invMWhere').value=item.where||'';
  document.getElementById('invMDesc').value=item.desc||'';
  document.getElementById('invMPkgQty').value=item.pkgQty||'';
  document.getElementById('invMPkgCost').value=item.pkgCost||'';
  document.getElementById('invMUnitCost').value=item.unitCost||'';
  document.getElementById('invMUnit').value=item.unit||'gr';
  document.getElementById('invMSize').value=item.unitSize||'';
  document.getElementById('invMMin').value=item.min||'';
  document.getElementById('invMMax').value=item.max||'';
  document.getElementById('invMStock').textContent=item.stock;
  document.getElementById('invMDel').style.display='block';
  fillCatSel('invMCat',item.cat);
  openOv('ovInv');
}

function fillCatSel(selId,selected){
  const allCats=[...CATS,...new Set(inv.map(i=>i.cat).filter(c=>!CATS.includes(c)))];
  document.getElementById(selId).innerHTML=allCats.map(c=>`<option value="${c}" ${c===selected?'selected':''}>${c}</option>`).join('');
}

function adjStock(d){_editStockQty=Math.max(0,_editStockQty+d);document.getElementById('invMStock').textContent=_editStockQty;}

function calcUnitCost(){
  const q=parseFloat(document.getElementById('invMPkgQty').value)||0;
  const c=parseFloat(document.getElementById('invMPkgCost').value)||0;
  if(q>0&&c>0)document.getElementById('invMUnitCost').value=(c/q).toFixed(4);
}

function saveInvItem(){
  const name=document.getElementById('invMName').value.trim();
  if(!name){showToast('Ingresa el nombre');return;}
  const item={
    id:_editInvId||Date.now(),
    cat:document.getElementById('invMCat').value,
    name,prov:document.getElementById('invMProv').value.trim(),
    where:document.getElementById('invMWhere').value.trim(),
    desc:document.getElementById('invMDesc').value.trim(),
    pkgQty:parseFloat(document.getElementById('invMPkgQty').value)||1,
    pkgCost:parseFloat(document.getElementById('invMPkgCost').value)||0,
    unitCost:parseFloat(document.getElementById('invMUnitCost').value)||0,
    unit:document.getElementById('invMUnit').value||'gr',
    unitSize:parseFloat(document.getElementById('invMSize').value)||1,
    min:parseInt(document.getElementById('invMMin').value)||0,
    max:parseInt(document.getElementById('invMMax').value)||0,
    stock:_editStockQty,
  };
  if(_editInvId){const idx=inv.findIndex(i=>i.id===_editInvId);inv[idx]=item;}
  else inv.push(item);
  sbSaveInv(item);closeOv('ovInv');showToast('Insumo guardado ✓');renderInv();renderHome();
}

function deleteInvItem(){
  if(!confirm('¿Eliminar este insumo?'))return;
  inv=inv.filter(i=>i.id!==_editInvId);
  sbDeleteInv(_editInvId);closeOv('ovInv');showToast('Insumo eliminado');renderInv();renderHome();
}

// ══ RECIPES ══
let _editRecId=null,_recImgData='';

let _recQ='';
function filterRec(){_recQ=document.getElementById('recQ').value;renderRec();}

function renderRec(){
  const q=_recQ.trim().toLowerCase();
  const list=q?recipes.filter(r=>r.name.toLowerCase().includes(q)||(r.cat||'').toLowerCase().includes(q)||(r.desc||'').toLowerCase().includes(q)):recipes;
  document.getElementById('recList').innerHTML=list.length?list.map(r=>{
    const cost=calcRecipeCostVal(r);
    const imgHtml=r.img?`<img src="${r.img}" class="recipe-photo" style="width:100%;height:140px;object-fit:cover;border-radius:11px;margin-bottom:10px">`:`<div class="rimg-placeholder">${r.emoji}</div>`;
    // production stats
    const myOrds=orders.filter(o=>!o.cancelled&&o.recId===r.id);
    const thisWeek=myOrds.filter(o=>isThisWeek(o.ts)).length;
    const thisMonth=myOrds.filter(o=>isThisMonth(o.ts)).length;
    const avail=batchPool[r.id]||0;
    return`<div class="rcard">
      ${imgHtml}
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
        <div style="flex:1"><div style="font-family:'DM Serif Display',serif;font-size:18px">${r.name}</div>
        <div style="font-size:11px;color:var(--muted)">${r.cat} · Lote de ${r.batch} pzas</div></div>
        <div style="text-align:right;flex-shrink:0"><div style="font-size:18px;color:var(--accent2);font-weight:700">${fmtMoney(r.price)}</div><div style="font-size:10px;color:var(--muted)">por pieza</div></div>
      </div>
      ${r.desc?`<div style="font-size:12px;color:var(--muted);margin-bottom:8px">${r.desc}</div>`:''}
      <div class="cbox" style="margin-bottom:10px">
        <div class="crow"><span>Costo del lote</span><span>${fmtMoney(cost.total)}</span></div>
        <div class="crow"><span>Costo por pieza</span><span>${fmtMoney(cost.perPiece)}</span></div>
        <div class="crow"><span>Precio de venta</span><span style="color:var(--accent2)">${fmtMoney(r.price)}</span></div>
        <div class="crow"><span>Margen por pieza</span><span style="color:var(--green)">${fmtMoney(r.price-cost.perPiece)} (${r.price>0?Math.round((r.price-cost.perPiece)/r.price*100):0}%)</span></div>
      </div>
      <div style="display:flex;gap:10px;margin-bottom:10px">
        <div class="stat" style="flex:1;padding:10px"><div class="sv" style="font-size:18px;color:var(--accent)">${avail}</div><div class="sl">Pzas disponibles</div></div>
        <div class="stat" style="flex:1;padding:10px"><div class="sv" style="font-size:18px">${thisWeek}</div><div class="sl">Órdenes esta semana</div></div>
        <div class="stat" style="flex:1;padding:10px"><div class="sv" style="font-size:18px">${thisMonth}</div><div class="sl">Órdenes este mes</div></div>
      </div>
      <div style="display:flex;gap:8px">
        <button class="btn bg bsm" style="flex:1" onclick="openEditRec(${r.id})">✏️ Editar</button>
        <button class="btn bg bsm" style="flex:1" onclick="produceRec(${r.id})">🍳 Producir lote</button>
      </div>
    </div>`;
  }).join(''):(q?'<div class="empty"><div>🔍</div>Sin resultados para "'+_recQ+'"</div>':'<div class="empty"><div>🍰</div>No hay recetas. Toca + para crear.</div>');
}

function isThisWeek(ts){if(!ts)return false;const d=new Date(ts),n=new Date();const s=new Date(n);s.setDate(n.getDate()-7);return d>=s;}
function isThisMonth(ts){if(!ts)return false;const d=new Date(ts),n=new Date();return d.getMonth()===n.getMonth()&&d.getFullYear()===n.getFullYear();}

function calcRecipeCostVal(r){
  let total=0;
  (r.ings||[]).forEach(ing=>{
    const item=getInvItem(ing);
    if(!item)return;
    const costPerUnit=item.unitCost/item.unitSize; // $ per gr/ml/pza
    total+=costPerUnit*ing.qty;
  });
  return{total,perPiece:r.batch>0?total/r.batch:0};
}

// produce a batch → deduct inventory → add to pool
function produceRec(id){
  const r=recipes.find(x=>x.id===id);
  if(!r)return;
  const missing=[];
  r.ings.forEach(ing=>{
    const item=getInvItem(ing);
    if(!item)return;
    const avail=item.stock*item.unitSize;
    if(avail<ing.qty)missing.push(`${item.name} (necesitas ${ing.qty}${ing.unit}, hay ${(avail).toFixed(1)}${ing.unit})`);
  });
  const avail=batchPool[id]||0;
  const warnTxt=missing.length?`\n\n⚠️ Insumos insuficientes:\n${missing.join('\n')}`:'';
  const confirmMsg=`¿Confirmar producción de 1 lote de "${r.name}"?\n\n• Se producirán ${r.batch} piezas\n• Se descontarán ${r.ings.length} insumos del inventario\n• Piezas disponibles actuales: ${avail}${warnTxt}\n${missing.length?'\n⚠️ ¿Producir de todas formas?':''}`;
  if(!confirm(confirmMsg))return;
  r.ings.forEach(ing=>{
    const item=getInvItem(ing);
    if(!item)return;
    const use=ing.qty/item.unitSize;
    item.stock=Math.max(0,parseFloat((item.stock-use).toFixed(4)));
  });
  batchPool[id]=(batchPool[id]||0)+r.batch;
  r.ings.forEach(ing=>{const item=getInvItem(ing);if(item)sbSaveInv(item);});sbSavePool();saveAll();showToast(`Lote producido ✓ · +${r.batch} pzas · Total disponible: ${batchPool[id]}`);renderRec();renderHome();
}

function calcRecipeCost(){
  // live calc in modal
  const rows=document.querySelectorAll('#recIngRows .ingrow');
  let total=0;const costRows=[];
  rows.forEach(row=>{
    const inputs=row.querySelectorAll('input,select');
    const invId=parseInt(inputs[0].value)||0;
    const qty=parseFloat(inputs[1].value)||0;
    const unit=inputs[2].value||'gr';
    const item=invId?findInvById(invId):null;
    if(item&&qty>0){
      const cpv=item.unitCost/item.unitSize;
      const lineCost=cpv*qty;
      total+=lineCost;
      costRows.push(`<div class="crow"><span>${item.name.split(' ').slice(0,3).join(' ')}… ${qty}${unit}</span><span>${fmtMoney(lineCost)}</span></div>`);
    }
  });
  const batch=parseInt(document.getElementById('recMBatch').value)||1;
  const price=parseFloat(document.getElementById('recMPrice').value)||0;
  const perPiece=batch>0?total/batch:0;
  const margin=price-perPiece;
  costRows.push(`<div class="crow"><span>Total lote</span><span>${fmtMoney(total)}</span></div>`);
  costRows.push(`<div class="crow"><span>Costo por pieza</span><span>${fmtMoney(perPiece)}</span></div>`);
  if(price>0)costRows.push(`<div class="crow"><span>Margen por pieza</span><span style="color:var(--green)">${fmtMoney(margin)}</span></div>`);
  const box=document.getElementById('recCostBox');
  box.style.display=total>0?'block':'none';
  document.getElementById('recCostRows').innerHTML=costRows.join('');
}

function openNewRec(){
  _editRecId=null;_recImgData='';
  document.getElementById('recMTitle').textContent='Nueva Receta';
  document.getElementById('recMId').value='';
  ['recMName','recMEmoji','recMCat','recMDesc','recMPrice'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('recMBatch').value='';
  document.getElementById('recIngRows').innerHTML='';
  document.getElementById('recImgPrev').innerHTML='📷';
  document.getElementById('recImgPrev').className='rimg-placeholder';
  document.getElementById('recMDel').style.display='none';
  document.getElementById('recCostBox').style.display='none';
  addIngRow();openOv('ovRec');
}

function openEditRec(id){
  const r=recipes.find(x=>x.id===id);
  _editRecId=id;_recImgData=r.img||'';
  document.getElementById('recMTitle').textContent='Editar Receta';
  document.getElementById('recMId').value=id;
  document.getElementById('recMName').value=r.name;
  document.getElementById('recMEmoji').value=r.emoji;
  document.getElementById('recMCat').value=r.cat;
  document.getElementById('recMBatch').value=r.batch;
  document.getElementById('recMDesc').value=r.desc||'';
  document.getElementById('recMPrice').value=r.price||'';
  document.getElementById('recIngRows').innerHTML='';
  if(r.img){const el=document.getElementById('recImgPrev');el.innerHTML=`<img src="${r.img}" class="recipe-photo" style="width:100%;height:100%;object-fit:cover;border-radius:11px">`;el.className='rimg';}
  else{document.getElementById('recImgPrev').innerHTML=r.emoji;document.getElementById('recImgPrev').className='rimg-placeholder';}
  r.ings.forEach(ing=>addIngRow(ing.invId,ing.qty,ing.unit));
  document.getElementById('recMDel').style.display='block';
  calcRecipeCost();openOv('ovRec');
}

function loadRecipeImg(){
  const f=document.getElementById('recImgFile').files[0];
  if(!f)return;
  const reader=new FileReader();
  reader.onload=e=>{
    const img=new Image();
    img.onload=()=>{
      const maxW=700;
      const scale=Math.min(1,maxW/img.width);
      const canvas=document.createElement('canvas');
      canvas.width=img.width*scale;
      canvas.height=img.height*scale;
      const ctx=canvas.getContext('2d');
      ctx.drawImage(img,0,0,canvas.width,canvas.height);
      _recImgData=canvas.toDataURL('image/jpeg',0.75);
      const el=document.getElementById('recImgPrev');
      el.innerHTML=`<img src="${_recImgData}" class="recipe-photo" style="width:100%;height:100%;object-fit:cover;border-radius:11px">`;
      el.className='rimg';
    };
    img.onerror=()=>showToast('⚠ No se pudo leer la imagen');
    img.src=e.target.result;
  };
  reader.onerror=()=>showToast('⚠ No se pudo leer el archivo');
  reader.readAsDataURL(f);
}

function addIngRow(invId='',qty='',unit='gr'){
  const div=document.createElement('div');
  div.className='ingrow';
  const opts=inv.map(i=>`<option value="${i.id}" ${i.id===invId?'selected':''}>${i.name} (${i.unit})</option>`).join('');
  div.innerHTML=`<select class="fc" style="flex:3;padding:7px 8px;font-size:12px" onchange="calcRecipeCost()"><option value="">Selecciona…</option>${opts}</select>
    <input class="fc" type="number" placeholder="Cant" value="${qty}" style="flex:1;padding:7px 8px;font-size:12px" oninput="calcRecipeCost()">
    <input class="fc" placeholder="ud" value="${unit}" style="flex:.7;padding:7px 8px;font-size:12px">
    <button class="irm" onclick="this.parentElement.remove();calcRecipeCost()">×</button>`;
  document.getElementById('recIngRows').appendChild(div);
}

function saveRecipe(){
  const name=document.getElementById('recMName').value.trim();
  if(!name){showToast('Ingresa el nombre');return;}
  const rows=document.querySelectorAll('#recIngRows .ingrow');
  const ings=[];
  rows.forEach(row=>{
    const inputs=row.querySelectorAll('input,select');
    const invId=parseInt(inputs[0].value)||0;
    const qty=parseFloat(inputs[1].value)||0;
    const unit=inputs[2].value||'gr';
    const item=invId?findInvById(invId):null;
    if(invId&&qty>0)ings.push({invId,name:item?item.name:'',qty,unit});
  });
  const rec={
    id:_editRecId||Date.now(),
    name,emoji:document.getElementById('recMEmoji').value||'🍰',
    cat:document.getElementById('recMCat').value||'General',
    batch:parseInt(document.getElementById('recMBatch').value)||1,
    desc:document.getElementById('recMDesc').value.trim(),
    price:parseFloat(document.getElementById('recMPrice').value)||0,
    img:_recImgData,ings,
  };
  if(_editRecId){const idx=recipes.findIndex(r=>r.id===_editRecId);recipes[idx]=rec;}
  else recipes.push(rec);
  sbSaveRec(rec);closeOv('ovRec');showToast('Receta guardada ✓');renderRec();
}

function deleteRecipe(){
  if(!confirm('¿Eliminar esta receta?'))return;
  recipes=recipes.filter(r=>r.id!==_editRecId);
  sbDeleteRec(_editRecId);closeOv('ovRec');showToast('Receta eliminada');renderRec();
}

// ══ ORDERS ══
let _ordFilter='all';

function renderOrd(){
  let list=orders;
  if(_ordFilter==='active')list=list.filter(o=>!o.cancelled);
  else if(_ordFilter==='paid')list=list.filter(o=>!o.cancelled&&o.payStatus==='paid');
  else if(_ordFilter==='pending')list=list.filter(o=>!o.cancelled&&o.payStatus==='pending');
  else if(_ordFilter==='cancelled')list=list.filter(o=>o.cancelled);
  document.getElementById('ordList').innerHTML=[...list].reverse().map(o=>miniOrdCard(o)).join('')||'<div class="empty"><div>📋</div>Sin órdenes</div>';
}

function filterOrd(f,el){
  _ordFilter=f;
  document.querySelectorAll('#ordChips .chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');renderOrd();
}

function openNewOrd(){
  document.getElementById('ordPrice').value='';
  document.getElementById('ordNotes').value='';
  document.getElementById('ordLines').innerHTML='';
  document.getElementById('ordSummary').style.display='none';
  document.getElementById('ordErrBox').style.display='none';
  const tomorrow=new Date();tomorrow.setDate(tomorrow.getDate()+1);
  document.getElementById('ordDelivery').value=tomorrow.toISOString().split('T')[0];
  document.getElementById('ordProdDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('ordCli').innerHTML='<option value="">Sin cliente asignado</option>'+clients.map(c=>`<option value="${c.id}">${c.name}</option>`).join('');
  addOrdLine();
  openOv('ovOrd');
}

function addOrdLine(){
  const div=document.createElement('div');
  div.className='ingrow';
  div.style.cssText='flex-wrap:wrap;gap:6px;margin-bottom:10px;background:var(--surface2);border-radius:10px;padding:10px;border:1px solid var(--border)';
  const opts=recipes.map(r=>`<option value="${r.id}">${r.emoji} ${r.name} (${batchPool[r.id]||0} pzas disp.)</option>`).join('');
  div.innerHTML=`
    <select class="fc" style="flex:1;min-width:180px;padding:7px 9px;font-size:12px" onchange="onOrdLineChange(this)">
      <option value="">Selecciona receta…</option>${opts}
    </select>
    <div style="display:flex;gap:6px;width:100%;align-items:flex-end">
      <div style="flex:1"><div class="fl">PIEZAS</div>
        <input class="fc" type="number" min="1" placeholder="0" style="padding:7px 9px;font-size:13px" oninput="updOrdSummary()">
      </div>
      <div style="flex:1"><div class="fl">PRECIO UNIT. ($)</div>
        <input class="fc" type="number" step="0.01" placeholder="0.00" style="padding:7px 9px;font-size:13px" oninput="updOrdSummary()">
      </div>
      <button class="irm" onclick="this.parentElement.remove();updOrdSummary()">×</button>
    </div>
    <div class="ord-line-avail" style="font-size:11px;color:var(--muted);width:100%;margin-top:2px"></div>`;
  document.getElementById('ordLines').appendChild(div);
}

function onOrdLineChange(sel){
  const recId=parseInt(sel.value);
  const row=sel.closest('.ingrow');
  const avail=recId?(batchPool[recId]||0):0;
  const rec=recId?recipes.find(r=>r.id===recId):null;
  const inputs=row.querySelectorAll('input');
  if(rec){
    inputs[0].value=rec.batch;
    inputs[1].value=rec.price||0;
    row.querySelector('.ord-line-avail').innerHTML=
      avail>0
        ?`<span style="color:var(--green)">✓ ${avail} piezas disponibles</span>`
        :`<span style="color:var(--red)">❌ Sin piezas disponibles — produce un lote primero</span>`;
  }
  updOrdSummary();
}

function updOrdSummary(){
  const rows=document.querySelectorAll('#ordLines .ingrow');
  const lines=[];
  let totalAuto=0;
  const errors=[];
  rows.forEach(row=>{
    const sel=row.querySelector('select');
    const inputs=row.querySelectorAll('input');
    const recId=parseInt(sel.value)||0;
    const pcs=parseInt(inputs[0].value)||0;
    const unitPrice=parseFloat(inputs[1].value)||0;
    if(!recId||pcs<=0)return;
    const rec=recipes.find(r=>r.id===recId);
    const avail=batchPool[recId]||0;
    const sub=pcs*unitPrice;
    totalAuto+=sub;
    lines.push({recId,name:rec?rec.name:'',emoji:rec?rec.emoji:'🍰',pcs,unitPrice,sub,avail});
    if(avail<=0)errors.push(`❌ ${rec?rec.name:'Receta'}: sin piezas disponibles`);
    else if(pcs>avail)errors.push(`❌ ${rec?rec.name:'Receta'}: pediste ${pcs} pzas pero solo hay ${avail}`);
  });
  const errBox=document.getElementById('ordErrBox');
  if(errors.length){errBox.style.display='block';errBox.innerHTML=errors.join('<br>');}
  else{errBox.style.display='none';}
  const sumEl=document.getElementById('ordSummary');
  if(lines.length>0){
    sumEl.style.display='block';
    document.getElementById('ordSummaryRows').innerHTML=lines.map(l=>`
      <tr style="border-top:1px solid var(--border)">
        <td style="padding:7px 10px">${l.emoji} ${l.name}</td>
        <td style="padding:7px 6px;text-align:center;color:var(--accent2)">${l.pcs}</td>
        <td style="padding:7px 10px;text-align:right">${fmtMoney(l.sub)}</td>
      </tr>`).join('');
    document.getElementById('ordSummaryTotal').textContent=fmtMoney(totalAuto);
    document.getElementById('ordPrice').value=totalAuto.toFixed(2);
  } else {
    sumEl.style.display='none';
  }
}


function updOrdPrev(){
  const recId=parseInt(document.getElementById('ordRec').value);
  if(!recId){document.getElementById('ordPrev').style.display='none';document.getElementById('batchStock').textContent='Selecciona una receta primero';return;}
  const r=recipes.find(x=>x.id===recId);
  const avail=batchPool[recId]||0;
  document.getElementById('batchStock').innerHTML=`<span style="color:${avail>0?'var(--green)':'var(--red)'};font-size:20px;font-weight:700">${avail}</span> piezas disponibles del lote producido.<br><span style="font-size:11px">Si no hay suficientes, ve a Recetas → Producir lote primero.</span>`;
  document.getElementById('ordPcsInfo').textContent=`Lote = ${r.batch} pzas · ${_ordQty} lote(s) = ${_ordQty*r.batch} pzas`;
  // ingredients preview
  document.getElementById('ordPrev').style.display='block';
  const warns=[];
  document.getElementById('ordPrevIng').innerHTML=r.ings.map(ing=>{
    const needed=ing.qty*_ordQty;
    const item=getInvItem(ing);
    let info='No vinculado',warn=false;
    if(item){const avail=item.stock*item.unitSize;info=`Disponible: ${avail.toFixed(1)}${ing.unit}`;if(avail<needed){warn=true;warns.push(item.name.split(' ')[0]);}}
    return`<div class="prow" style="${warn?'color:var(--red)':''}"><span>${ing.name.split(' ').slice(0,3).join(' ')}… ×${_ordQty}</span><span>${needed}${ing.unit}</span></div><div style="font-size:10px;color:var(--muted);margin:-3px 0 6px">${info}</div>`;
  }).join('');
  document.getElementById('ordPrevWarn').innerHTML=warns.length?`<div style="font-size:12px;color:var(--red);margin-top:6px">⚠️ Insuficiente: ${warns.join(', ')}</div>`:`<div style="font-size:11px;color:var(--green);margin-top:4px">✓ Insumos suficientes</div>`;
}

function confirmOrd(){
  const rows=document.querySelectorAll('#ordLines .ingrow');
  const lines=[];
  rows.forEach(row=>{
    const sel=row.querySelector('select');
    const inputs=row.querySelectorAll('input');
    const recId=parseInt(sel.value)||0;
    const pcs=parseInt(inputs[0].value)||0;
    const unitPrice=parseFloat(inputs[1].value)||0;
    if(!recId||pcs<=0)return;
    const rec=recipes.find(r=>r.id===recId);
    const avail=batchPool[recId]||0;
    const short=Math.max(0,pcs-avail);
    lines.push({recId,rec,pcs,unitPrice,sub:pcs*unitPrice,short});
  });
  if(lines.length===0){showToast('Agrega al menos una receta');return;}
  const shortLines=lines.filter(l=>l.short>0);
  lines.forEach(l=>{batchPool[l.recId]=Math.max(0,(batchPool[l.recId]||0)-l.pcs);});
  const cliId=parseInt(document.getElementById('ordCli').value)||null;
  const cli=cliId?clients.find(c=>c.id===cliId):null;
  const price=parseFloat(document.getElementById('ordPrice').value)||lines.reduce((s,l)=>s+l.sub,0);
  const payStatus=document.getElementById('ordStatus').value;
  const payType=document.getElementById('ordPayType').value;
  const notes=document.getElementById('ordNotes').value.trim();
  const deliveryRaw=document.getElementById('ordDelivery').value;
  const deliveryFmt=deliveryRaw?new Date(deliveryRaw).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'Sin fecha';
  const prodDateRaw=document.getElementById('ordProdDate').value;
  const prodDateFmt=prodDateRaw?new Date(prodDateRaw).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}):'Sin fecha';
  const ingSnapshot=[];
  lines.forEach(l=>{
    (l.rec.ings||[]).forEach(i=>{const item=getInvItem(i);ingSnapshot.push({name:i.name,qty:i.qty,unit:i.unit,invId:item?.id,recName:l.rec.name});});
  });
  const ord={
    id:Date.now(),ts:Date.now(),
    lines:lines.map(l=>({recId:l.recId,recName:l.rec.name,recEmoji:l.rec.emoji,pcs:l.pcs,unitPrice:l.unitPrice,sub:l.sub,short:l.short})),
    recName:lines.map(l=>l.rec.name).join(' + '),
    recEmoji:lines[0].rec.emoji,
    totalPcs:lines.reduce((s,l)=>s+l.pcs,0),
    cliId:cliId||null,cliName:cli?cli.name:null,cliAddr:cli?cli.addr:null,
    price,payStatus,payType,notes,cancelled:false,
    needsProduction:shortLines.length>0,
    date:fmtDate(),prodDate:prodDateFmt,prodDateRaw,delivery:deliveryFmt,deliveryRaw,ings:ingSnapshot,
  };
  orders.push(ord);
  if(cli){cli.orderCount=(cli.orderCount||0)+1;cli.lastOrder=fmtDate();}
  sbSaveOrd(ord);sbSavePool();closeOv('ovOrd');
  if(shortLines.length>0){
    const detail=shortLines.map(l=>{
      const lotes=Math.ceil(l.short/(l.rec.batch||1));
      return `${l.rec.emoji} ${l.rec.name}: faltan ${l.short} pzas (~${lotes} lote${lotes===1?'':'s'})`;
    }).join(' · ');
    showToast(`✓ Orden creada · Necesitas producir: ${detail}`);
  }else{
    showToast(`✓ Orden creada · ${ord.recName}`);
  }
  renderOrd();renderHome();
  sendWhatsAppNotification(ord);
}
function openOrdDet(id){
  const o=orders.find(x=>x.id===id);
  _viewOrdId=id;
  const st=o.cancelled?'<span class="badge bcan">CANCELADA</span>':o.payStatus==='paid'?'<span class="badge bpaid">PAGADO</span>':'<span class="badge blow">PENDIENTE</span>';
  document.getElementById('ordDetTitle').textContent=`${o.recEmoji} ${o.recName}`;
  const linesTable=o.lines?`
    <div class="fl" style="margin-bottom:8px">PRODUCTOS DE LA ORDEN</div>
    <div style="background:var(--bg);border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-bottom:14px">
      <table style="width:100%;border-collapse:collapse;font-size:12px">
        <thead><tr style="background:var(--surface2)">
          <th style="padding:7px 10px;text-align:left;color:var(--muted);font-weight:500">Producto</th>
          <th style="padding:7px 6px;text-align:center;color:var(--muted);font-weight:500">Pzas</th>
          <th style="padding:7px 10px;text-align:right;color:var(--muted);font-weight:500">Subtotal</th>
        </tr></thead>
        <tbody>${o.lines.map(l=>`<tr style="border-top:1px solid var(--border)">
          <td style="padding:7px 10px">${l.recEmoji} ${l.recName}</td>
          <td style="padding:7px 6px;text-align:center;color:var(--accent2)">${l.pcs}</td>
          <td style="padding:7px 10px;text-align:right">${fmtMoney(l.sub)}</td>
        </tr>`).join('')}</tbody>
        <tfoot><tr style="border-top:1px solid var(--border);background:var(--surface2)">
          <td colspan="2" style="padding:7px 10px;font-weight:600">TOTAL</td>
          <td style="padding:7px 10px;text-align:right;font-weight:700;color:var(--accent2)">${fmtMoney(o.price)}</td>
        </tr></tfoot>
      </table>
    </div>`:'';
  document.getElementById('ordDetBody').innerHTML=`
    <div style="margin-bottom:14px">
      ${st} &nbsp; <span style="font-size:12px;color:var(--muted)">${o.date}</span>
    </div>
    ${linesTable}
    <div class="cbox">
      <div class="crow"><span>Cliente</span><span>${o.cliName||'Sin asignar'}</span></div>
      ${o.cliAddr?`<div class="crow"><span>Dirección</span><span>${o.cliAddr}</span></div>`:''}
      <div class="crow"><span>Total piezas</span><span>${o.totalPcs||o.pcs||'—'}</span></div>
      <div class="crow"><span>Fecha de pedido</span><span>${o.date||'—'}</span></div>
      <div class="crow"><span>Fecha de producción</span><span>${o.prodDate||'Sin fecha'}</span></div>
      <div class="crow"><span>Entrega estimada</span><span style="color:var(--accent2)">${o.delivery||'Sin fecha'}</span></div>
      <div class="crow"><span>Precio total</span><span>${fmtMoney(o.price)}</span></div>
      <div class="crow"><span>Tipo de pago</span><span>${o.payType||'—'}</span></div>
      ${o.notes?`<div class="crow"><span>Notas</span><span>${o.notes}</span></div>`:''}
    </div>
  `;
  document.getElementById('ordDetCanBtn').style.display=o.cancelled?'none':'block';
  document.getElementById('ordDetPayBtn').style.display=(!o.cancelled&&o.payStatus!=='paid')?'block':'none';
  openOv('ovOrdDet');
}

function markOrdPaid(){
  const o=orders.find(x=>x.id===_viewOrdId);
  if(!o||o.cancelled)return;
  o.payStatus='paid';
  sbSaveOrdPatch(o.id,{pay_status:'paid'});saveAll();
  showToast('✓ Orden marcada como pagada');
  closeOv('ovOrdDet');
  renderOrd();renderHome();
}

function cancelOrdFromDet(){
  const o=orders.find(x=>x.id===_viewOrdId);
  if(!o||o.cancelled)return;
  if(!confirm('¿Cancelar esta orden? Se devolverán los insumos al inventario.'))return;
  o.cancelled=true;
  // restore batchPool
  batchPool[o.recId]=(batchPool[o.recId]||0)+o.pcs;
  sbSaveOrdPatch(o.id,{cancelled:true});sbSavePool();saveAll();closeOv('ovOrdDet');showToast('Orden cancelada · insumos devueltos ✓');renderOrd();renderHome();
}

// ══ TICKET ══
function printTicket(){
  const o=orders.find(x=>x.id===_viewOrdId);
  if(!o)return;
  const html=`<div id="printArea" style="font-family:monospace;font-size:13px;max-width:300px;margin:0 auto">
    <div style="text-align:center;margin-bottom:10px"><b style="font-size:16px">ALDAR REPOSTERÍA</b><br>Línea Fit Gourmet<br>─────────────────────</div>
    <div>Fecha: ${o.date}</div>
    <div>Orden #${String(o.id).slice(-6)}</div>
    <div>─────────────────────</div>
    <div>─────────────────────</div>
    ${(o.lines||[{recName:o.recName,recEmoji:o.recEmoji,pcs:o.pcs,sub:o.price}]).map(l=>`<div style="display:flex;justify-content:space-between"><span>${l.recEmoji} ${l.recName} x${l.pcs}</span><span>$${(+l.sub).toFixed(2)}</span></div>`).join('')}
    ${o.cliName?`<div>Cliente: ${o.cliName}</div>`:''}
    ${o.cliAddr?`<div>Entrega: ${o.cliAddr}</div>`:''}
    <div>─────────────────────</div>
    <div style="display:flex;justify-content:space-between"><span>Total</span><span><b>$${(+o.price).toFixed(2)}</b></span></div>
    <div>Pago: ${o.payType} · ${o.payStatus==='paid'?'PAGADO':'PENDIENTE'}</div>
    ${o.notes?`<div>Notas: ${o.notes}</div>`:''}
    <div style="text-align:center;margin-top:14px">─────────────────────<br>¡Gracias por tu compra!<br>www.aldarreposteria.com</div>
  </div>`;
  document.getElementById('printArea').innerHTML=html;
  document.getElementById('printArea').style.display='block';
  window.print();
  setTimeout(()=>{document.getElementById('printArea').style.display='none';},1000);
}

// ══ CLIENTS ══
let _editCliId=null;

function renderCli(){
  document.getElementById('cliList').innerHTML=clients.length?clients.map(c=>`
    <div class="clcard" onclick="openEditCli(${c.id})">
      <div style="display:flex;align-items:center;gap:10px">
        <div class="iico">${c.type==='cafeteria'?'☕':c.type==='empresa'?'🏢':'👤'}</div>
        <div style="flex:1"><div style="font-weight:600;font-size:14px">${c.name}</div>
          <div style="font-size:11px;color:var(--muted)">${c.type} · ${c.phone||'Sin teléfono'}</div>
          ${c.addr?`<div style="font-size:11px;color:var(--muted)">${c.addr}</div>`:''}
        </div>
        <div style="text-align:right;flex-shrink:0">
          <div style="font-size:18px;font-weight:700;color:var(--accent2)">${c.orderCount||0}</div>
          <div style="font-size:10px;color:var(--muted)">órdenes</div>
        </div>
      </div>
      ${renderCliStats(c.id)}
    </div>`).join(''):'<div class="empty"><div>👥</div>No hay clientes. Toca + para agregar.</div>';
}

function renderCliStats(cliId){
  const myOrds=orders.filter(o=>!o.cancelled&&o.cliId===cliId);
  if(!myOrds.length)return'';
  // top products
  const freq={};myOrds.forEach(o=>{freq[o.recName]=(freq[o.recName]||0)+1;});
  const top=Object.entries(freq).sort((a,b)=>b[1]-a[1]).slice(0,2);
  const thisMonth=myOrds.filter(o=>isThisMonth(o.ts)).length;
  const total=myOrds.reduce((s,o)=>s+(+o.price||0),0);
  return`<div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border)">
    <div style="display:flex;gap:8px;margin-bottom:6px">
      <div class="stat" style="flex:1;padding:8px"><div class="sv" style="font-size:16px">${thisMonth}</div><div class="sl">Este mes</div></div>
      <div class="stat" style="flex:1;padding:8px"><div class="sv" style="font-size:16px">${fmtMoney(total)}</div><div class="sl">Total ventas</div></div>
    </div>
    <div style="font-size:11px;color:var(--muted)">Más pedido: ${top.map(t=>`${t[0]} (${t[1]}x)`).join(', ')||'—'}</div>
  </div>`;
}

function openNewCli(){
  _editCliId=null;
  document.getElementById('cliMTitle').textContent='Nuevo Cliente';
  document.getElementById('cliMId').value='';
  ['cliMName','cliMPhone','cliMAddr','cliMNotes','cliMBirth','cliMCivil'].forEach(id=>document.getElementById(id).value='');
  document.getElementById('cliMType').value='cafeteria';
  document.getElementById('cliMDel').style.display='none';
  openOv('ovCli');
}

function openEditCli(id){
  const c=clients.find(x=>x.id===id);
  _editCliId=id;
  document.getElementById('cliMTitle').textContent=c.name;
  document.getElementById('cliMId').value=id;
  document.getElementById('cliMName').value=c.name;
  document.getElementById('cliMType').value=c.type||'cafeteria';
  document.getElementById('cliMPhone').value=c.phone||'';
  document.getElementById('cliMBirth').value=c.birth||'';
  document.getElementById('cliMCivil').value=c.civil||'';
  document.getElementById('cliMAddr').value=c.addr||'';
  document.getElementById('cliMNotes').value=c.notes||'';
  document.getElementById('cliMDel').style.display='block';
  openOv('ovCli');
}

function saveCli(){
  const name=document.getElementById('cliMName').value.trim();
  if(!name){showToast('Ingresa el nombre');return;}
  const cli={
    id:_editCliId||Date.now(),
    name,type:document.getElementById('cliMType').value,
    phone:document.getElementById('cliMPhone').value.trim(),
    birth:document.getElementById('cliMBirth').value,
    civil:document.getElementById('cliMCivil').value,
    addr:document.getElementById('cliMAddr').value.trim(),
    notes:document.getElementById('cliMNotes').value.trim(),
    orderCount:_editCliId?(clients.find(c=>c.id===_editCliId)?.orderCount||0):0,
  };
  if(_editCliId){const idx=clients.findIndex(c=>c.id===_editCliId);clients[idx]=cli;}
  else clients.push(cli);
  sbSaveCli(cli);closeOv('ovCli');showToast('Cliente guardado ✓');renderCli();
}
function openMapsRoute(){
  const addr=document.getElementById('cliMAddr').value.trim();
  if(!addr){showToast('Escribe primero la dirección');return;}
  window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`,'_blank');
}

function deleteCli(){
  if(!confirm('¿Eliminar este cliente?'))return;
  clients=clients.filter(c=>c.id!==_editCliId);
  sbDeleteCli(_editCliId);closeOv('ovCli');showToast('Cliente eliminado');renderCli();
}

// ══ PURCHASES ══
let _compFilter='all';

function renderComp(){
  const mes=purchases.filter(p=>isThisMonth(p.ts));
  const semana=purchases.filter(p=>isThisWeek(p.ts));
  let list=purchases;
  if(_compFilter==='mes')list=mes;
  else if(_compFilter==='semana')list=semana;
  document.getElementById('compTotalMes').textContent=fmtMoney(list.reduce((s,p)=>s+p.total,0));
  document.getElementById('compCountMes').textContent=list.length;
  document.getElementById('compTotalAll').textContent=fmtMoney(purchases.reduce((s,p)=>s+p.total,0));
  document.getElementById('compCountAll').textContent=purchases.length;
  document.getElementById('compList').innerHTML=[...list].reverse().map(p=>`
    <div class="irow" onclick="openEditComp(${p.id})">
      <div class="iico">🛒</div>
      <div class="iinfo">
        <div class="iname">${p.prov||'Sin proveedor'}</div>
        <div class="isub">${p.date} · ${p.items.length} insumo(s)${p.notes?' · '+p.notes:''}</div>
        <div style="font-size:11px;color:var(--muted);margin-top:3px">${p.items.map(i=>i.invName.split(' ')[0]).join(', ')}</div>
      </div>
      <div class="iright"><div class="irval" style="color:var(--accent2)">${fmtMoney(p.total)}</div><div class="irlbl">${p.items.reduce((s,i)=>s+i.qty,0)} paq</div></div>
    </div>`).join('')||'<div class="empty"><div>🛒</div>No hay compras registradas</div>';
}

function filterComp(f,el){
  _compFilter=f;
  document.querySelectorAll('#compChips .chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');
  const lbl=f==='mes'?'este mes':f==='semana'?'esta semana':'(filtrado)';
  document.getElementById('compTotalLbl').textContent='Gasto '+lbl;
  document.getElementById('compCountLbl').textContent='Entradas '+lbl;
  renderComp();
}

// ══ REPORTES ══
let _repFilter='mes';
function renderRep(){
  let ordsF,pursF;
  if(_repFilter==='mes'){
    ordsF=orders.filter(o=>!o.cancelled&&isThisMonth(o.ts));
    pursF=purchases.filter(p=>isThisMonth(p.ts));
  }else if(_repFilter==='semana'){
    ordsF=orders.filter(o=>!o.cancelled&&isThisWeek(o.ts));
    pursF=purchases.filter(p=>isThisWeek(p.ts));
  }else{
    ordsF=orders.filter(o=>!o.cancelled);
    pursF=purchases;
  }
  const ventas=ordsF.reduce((s,o)=>s+(o.price||0),0);
  const compras=pursF.reduce((s,p)=>s+(p.total||0),0);
  const utilidad=ventas-compras;
  const margen=ventas>0?(utilidad/ventas*100):0;
  document.getElementById('repVentas').textContent=fmtMoney(ventas);
  document.getElementById('repCompras').textContent=fmtMoney(compras);
  const uEl=document.getElementById('repUtilidad');
  uEl.textContent=fmtMoney(utilidad);
  uEl.style.color=utilidad>=0?'#2e7d4f':'#c0392b';
  document.getElementById('repMargen').textContent=margen.toFixed(0)+'%';
  const avgTicket=ordsF.length?ventas/ordsF.length:0;
  document.getElementById('repDetail').innerHTML=`
    <div class="ocard"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted)">Órdenes contabilizadas</span><b>${ordsF.length}</b></div></div>
    <div class="ocard"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted)">Compras registradas</span><b>${pursF.length}</b></div></div>
    <div class="ocard"><div style="display:flex;justify-content:space-between;font-size:13px"><span style="color:var(--muted)">Ticket promedio de venta</span><b>${fmtMoney(avgTicket)}</b></div></div>
  `;
}
function filterRep(f,el){
  _repFilter=f;
  document.querySelectorAll('#repChips .chip').forEach(c=>c.classList.remove('on'));
  el.classList.add('on');renderRep();
}

function openNewComp(){
  document.getElementById('compMTitle').textContent='Nueva Entrada de Compra';
  document.getElementById('compMId').value='';
  document.getElementById('compMDate').value=new Date().toISOString().split('T')[0];
  document.getElementById('compMProv').value='';
  document.getElementById('compMNotes').value='';
  document.getElementById('compRows').innerHTML='';
  document.getElementById('compTotalCalc').textContent='$0.00';
  addCompRow();
  openOv('ovComp');
}

function openEditComp(id){
  const p=purchases.find(x=>x.id===id);
  document.getElementById('compMTitle').textContent='Editar Entrada';
  document.getElementById('compMId').value=id;
  document.getElementById('compMDate').value=p.dateRaw||new Date().toISOString().split('T')[0];
  document.getElementById('compMProv').value=p.prov||'';
  document.getElementById('compMNotes').value=p.notes||'';
  document.getElementById('compRows').innerHTML='';
  p.items.forEach(i=>addCompRow(i.invId,i.qty,i.unitCost,i.total));
  calcCompTotal();
  openOv('ovComp');
}

function addCompRow(invId='',qty='',unitCost='',total=''){
  const div=document.createElement('div');
  div.className='ingrow';
  div.style.flexWrap='wrap';div.style.gap='6px';div.style.marginBottom='10px';div.style.background='var(--surface2)';div.style.borderRadius='10px';div.style.padding='10px';div.style.border='1px solid var(--border)';
  const opts=inv.map(i=>`<option value="${i.id}" ${i.id===invId?'selected':''}>${i.name} (${i.unit})</option>`).join('');
  div.innerHTML=`
    <select class="fc" style="flex:1;min-width:180px;padding:7px 9px;font-size:12px" onchange="onCompInvChange(this)">
      <option value="">Selecciona insumo…</option>${opts}
    </select>
    <div style="display:flex;gap:6px;width:100%">
      <div style="flex:1"><div class="fl">PAQUETES</div><input class="fc" type="number" min="1" placeholder="Cant" value="${qty}" style="padding:7px 9px;font-size:13px" oninput="calcCompRowTotal(this)"></div>
      <div style="flex:1"><div class="fl">COSTO UNITARIO ($)</div><input class="fc" type="number" step="0.01" placeholder="0.00" value="${unitCost}" style="padding:7px 9px;font-size:13px" oninput="calcCompRowTotal(this)"></div>
      <div style="flex:1"><div class="fl">TOTAL FILA ($)</div><input class="fc" type="number" step="0.01" placeholder="0.00" value="${total}" style="padding:7px 9px;font-size:13px;color:var(--accent2)" oninput="calcCompTotal()"></div>
    </div>
    <button class="irm" style="align-self:flex-start" onclick="this.parentElement.remove();calcCompTotal()">×</button>`;
  document.getElementById('compRows').appendChild(div);
}

function onCompInvChange(sel){
  const invId=parseInt(sel.value);
  if(!invId)return;
  const item=findInvById(invId);
  if(!item)return;
  const row=sel.closest('.ingrow');
  const inputs=row.querySelectorAll('input');
  inputs[1].value=item.pkgCost||item.unitCost||'';
  calcCompRowTotal(inputs[0]);
}

function calcCompRowTotal(input){
  const row=input.closest('.ingrow');
  const inputs=row.querySelectorAll('input');
  const qty=parseFloat(inputs[0].value)||0;
  const uc=parseFloat(inputs[1].value)||0;
  inputs[2].value=(qty*uc).toFixed(2);
  calcCompTotal();
}

function calcCompTotal(){
  const rows=document.querySelectorAll('#compRows .ingrow');
  let total=0;
  rows.forEach(row=>{const inputs=row.querySelectorAll('input');total+=parseFloat(inputs[2].value)||0;});
  document.getElementById('compTotalCalc').textContent=fmtMoney(total);
}

function saveComp(){
  const rows=document.querySelectorAll('#compRows .ingrow');
  const items=[];
  rows.forEach(row=>{
    const sel=row.querySelector('select');
    const inputs=row.querySelectorAll('input');
    const invId=parseInt(sel.value)||0;
    const qty=parseInt(inputs[0].value)||0;
    const unitCost=parseFloat(inputs[1].value)||0;
    const total=parseFloat(inputs[2].value)||0;
    if(!invId||qty<=0)return;
    const item=findInvById(invId);
    items.push({invId,invName:item?item.name:'',qty,unitCost,total});
  });
  if(items.length===0){showToast('Agrega al menos un insumo');return;}
  const dateRaw=document.getElementById('compMDate').value;
  const editId=parseInt(document.getElementById('compMId').value)||null;
  const purch={
    id:editId||Date.now(),
    ts:new Date(dateRaw).getTime()||Date.now(),
    date:new Date(dateRaw).toLocaleDateString('es-MX',{day:'2-digit',month:'short',year:'numeric'}),
    dateRaw,
    prov:document.getElementById('compMProv').value.trim(),
    notes:document.getElementById('compMNotes').value.trim(),
    items,
    total:items.reduce((s,i)=>s+i.total,0),
  };
  // Update inventory stock
  items.forEach(item=>{
    const invItem=findInvById(item.invId);
    if(!invItem)return;
    if(editId){
      // revert old qty first
      const old=purchases.find(p=>p.id===editId);
      if(old){const oldItem=old.items.find(i=>i.invId===item.invId);if(oldItem)invItem.stock=Math.max(0,invItem.stock-oldItem.qty);}
    }
    invItem.stock=parseFloat((invItem.stock+item.qty).toFixed(4));
    // update unitCost if changed
    if(item.unitCost>0)invItem.unitCost=item.unitCost;
    if(item.unitCost>0&&invItem.pkgQty)invItem.pkgCost=item.unitCost;
  });
  if(editId){const idx=purchases.findIndex(p=>p.id===editId);purchases[idx]=purch;}
  else purchases.push(purch);
  sbSavePur(purch);items.forEach(it=>{const ii=findInvById(it.invId);if(ii)sbSaveInv(ii);});saveAll();closeOv('ovComp');showToast(`✓ Entrada registrada · ${fmtMoney(purch.total)}`);renderComp();renderInv();renderHome();
}

// ══ MÁS MENU ══
function openMasMenu(){
  document.getElementById('nb-mas').classList.add('on');
  openOv('ovMas');
}
function goFromMas(page){
  closeOv('ovMas');
  document.querySelectorAll('.nb').forEach(b=>b.classList.remove('on'));
  document.getElementById('nb-mas').classList.add('on');
  document.querySelectorAll('.pg').forEach(p=>p.classList.remove('on'));
  document.getElementById('pg-'+page).classList.add('on');
  const TITLES={cli:'Clientes',comp:'Compras',rep:'Reportes',cfg:'Configuración'};
  const SUBS={cli:'Clientes y puntos de entrega',comp:'Entradas de insumos y gastos',rep:'Ventas vs. compras y utilidad',cfg:'Ajustes generales'};
  document.getElementById('htitle').textContent=TITLES[page];
  document.getElementById('hsub').textContent=SUBS[page];
  document.getElementById('fabMain').style.display=['cli','comp'].includes(page)?'flex':'none';
  document.getElementById('fabSec').style.display='none';
  if(page==='cli')renderCli();
  if(page==='comp')renderComp();
  if(page==='rep')renderRep();
  if(page==='cfg')loadCfg();
}

// ══ CONFIG ══
const DEF_CFG={waNum:'526671605657',waOn:'1',bizName:'Aldar Repostería',bizPhone:'',bizAddr:''};
let cfg=ls('aldar_cfg',DEF_CFG);

function loadCfg(){
  document.getElementById('cfgWANum').value=cfg.waNum||'';
  document.getElementById('cfgWAOn').value=cfg.waOn||'1';
  document.getElementById('cfgBizName').value=cfg.bizName||'';
  document.getElementById('cfgBizPhone').value=cfg.bizPhone||'';
  document.getElementById('cfgBizAddr').value=cfg.bizAddr||'';
}

function saveCfg(){
  cfg={
    waNum:document.getElementById('cfgWANum').value.replace(/\D/g,''),
    waOn:document.getElementById('cfgWAOn').value,
    bizName:document.getElementById('cfgBizName').value.trim(),
    bizPhone:document.getElementById('cfgBizPhone').value.trim(),
    bizAddr:document.getElementById('cfgBizAddr').value.trim(),
  };
  sbSaveCfg();
  showToast('Configuración guardada ✓');
}

async function limpiarOrdenes(){
  if(orders.length===0){showToast('No hay órdenes registradas');return;}
  if(!confirm(`Esto eliminará las ${orders.length} órdenes registradas, en este dispositivo y en la nube. ¿Continuar?`))return;
  if(!confirm('Confirma de nuevo: esta acción NO se puede deshacer. ¿Eliminar todo el historial de órdenes?'))return;
  orders=[];
  ss('aldar_ord',orders);
  showToast('Eliminando órdenes…');
  try{
    await sbFetch('orders','DELETE',null,'?id=gt.0');
    showToast('✓ Registro de órdenes eliminado');
  }catch(e){
    console.error('Error eliminando órdenes en Supabase:',e);
    showToast('⚠ Se borró localmente, pero hubo error al sincronizar');
  }
  renderOrd();renderHome();
}

async function vaciarStockTodo(){
  if(!confirm(`Esto pondrá en 0 el stock de los ${inv.length} insumos registrados, en este dispositivo y en la nube. ¿Continuar?`))return;
  if(!confirm('Confirma de nuevo: esta acción NO se puede deshacer. ¿Vaciar todo el stock?'))return;
  inv.forEach(item=>{item.stock=0;});
  ss('aldar_inv',inv);
  showToast('Vaciando stock…');
  try{
    await Promise.all(inv.map(item=>sbSaveInv(item)));
    showToast(`✓ Stock vaciado · ${inv.length} insumos`);
  }catch(e){
    console.error('Error vaciando stock en Supabase:',e);
    showToast('⚠ Se vació localmente, pero hubo error al sincronizar');
  }
  renderInv();renderHome();
}

function sendWhatsAppNotification(ord){
  if(cfg.waOn!=='1'||!cfg.waNum)return;
  const biz=cfg.bizName||'Aldar Repostería';
  const lines=(ord.lines||[]).map(l=>`- ${l.recEmoji} ${l.recName} x${l.pcs} pzas`).join('\n');
  const msg=`🍰 *Nueva Orden - ${biz}*
`+
    `─────────────────
`+
    `📋 *#${String(ord.id).slice(-6)}*
`+
    `👤 Cliente: ${ord.cliName||'Sin asignar'}
`+
    `📅 Entrega: ${ord.delivery||'Sin fecha'}

`+
    `*Productos:*
${lines}

`+
    `💰 Total: ${fmtMoney(ord.price)}
`+
    `💳 Pago: ${ord.payType} - ${ord.payStatus==='paid'?'✅ Pagado':'⏳ Pendiente'}
`+
    (ord.notes?`📝 Notas: ${ord.notes}
`:'')+
    `─────────────────
`+
    `Creada: ${ord.date}`;
  const url=`https://wa.me/${cfg.waNum}?text=${encodeURIComponent(msg)}`;
  window.open(url,'_blank');
}

// ══ INIT ══
renderHome();
renderRec();
loadFromSupabase();