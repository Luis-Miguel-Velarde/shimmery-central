'use strict';
const $ = s => document.querySelector(s);
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = cents => '₱ ' + (cents / 100).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dateToday = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const time = v => v ? new Date(v).toLocaleTimeString('en-PH', {timeZone:'Asia/Manila',hour:'2-digit',minute:'2-digit',second:'2-digit'}) : '—';
const modules = [['dash','Dashboard'],['pos','Point of Sale'],['pur','Purchasing'],['log','Logistics'],['per','Personnel & Payroll'],['mig','Database Setup']];
const roles = {owner:['Business Owner','dash,pur,log,per,mig'],manager:['Manager','dash,pos,pur,log,per,mig'],purchasing:['Purchasing Staff','dash,pur,log'],accounting:['Accounting Staff','dash,per'],retail:['Retail Staff','pos'],packing:['Packing Staff','log']};
let user = null, current = '', products = [], suppliers = [], orders = [], employees = [], cart = [], forcedOffline = false, networkUnavailable = false, syncing = false, loading = false, latestReceipt = null;
const branch = () => Number($('#branch').value);
function toast(message) { $('#toast').textContent = message; $('#toast').style.display = 'block'; clearTimeout(toast.timer); toast.timer = setTimeout(() => $('#toast').style.display = 'none', 4500); }
function showLogin() { user = null; cart = []; $('#login').classList.remove('gone'); $('#pn').value = ''; }
async function api(endpoint, data) {
  let response;
  try { response = await fetch(endpoint, { method: data === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: data === undefined ? {} : {'Content-Type':'application/json'}, body: data === undefined ? undefined : JSON.stringify(data) }); }
  catch { networkUnavailable = true; networkUI(); throw Object.assign(new Error('Server unavailable. Start the server or reconnect.'), {network:true}); }
  networkUnavailable = false; networkUI();
  const result = await response.json();
  if (!response.ok) { if (response.status === 401 && !endpoint.startsWith('/api/login')) showLogin(); throw Object.assign(new Error(result.error || 'Request failed'), {status:response.status}); }
  return result;
}
async function act(fn, element) { if (element) element.disabled = true; try { await fn(); } catch (e) { toast(e.message); } finally { if (element) element.disabled = false; } }
const queueKey = 'shimmery.pending.v1';
function queue() { try { return JSON.parse(localStorage.getItem(queueKey) || '[]'); } catch { throw new Error('Offline storage is unreadable. Do not clear browser data; restore it before continuing.'); } }
function myQueue() { return queue().filter(s => user && s.user_id === user.id); }
function saveQueue(items) { localStorage.setItem(queueKey, JSON.stringify(items)); networkUI(); }
function networkUI() {
  const offline = forcedOffline || networkUnavailable || !navigator.onLine;
  $('#net').textContent = offline ? '○ Offline · reconnect' : '● Online · simulate offline';
  $('#offbar').style.display = offline ? 'block' : 'none';
  $('#offbar').textContent = 'Offline demo: cash sales stay in this browser until synced. Other changes require the server. Load each branch online first; the installed offline shell supports reloads.';
  let pending = []; try { pending = myQueue(); } catch { /* checkout will surface storage errors */ }
  $('#queueInfo').textContent = pending.length ? `${pending.length} pending sale(s) for this account on this device. Conflicts remain queued for review; reconnect to retry.` : '';
}
function stockProducts() { const queued = myQueue().filter(s => s.branch === branch()); return products.map(p => ({ ...p, quantity: Math.max(0, p.quantity - queued.reduce((n, s) => n + s.items.filter(i => i.product_id === p.id).reduce((a,i) => a+i.quantity,0),0)) })); }
function productList() { const query = $('#q').value.toLowerCase(); $('#plist').innerHTML = stockProducts().filter(p => (p.name+p.code).toLowerCase().includes(query)).map(p => `<button class="prod" data-product="${p.id}" ${p.quantity <= 0 ? 'disabled' : ''}><span>${escapeHtml(p.name)}<br><small class="sub">${escapeHtml(p.code)} · ${p.quantity} available</small></span><b>${money(p.price_cents)}</b></button>`).join('') || '<p class="sub">No products found.</p>'; }
function renderCart() { $('#cart').innerHTML = cart.length ? cart.map(p => `<div class="row" style="justify-content:space-between;padding:6px 0"><span>${escapeHtml(p.name)} × ${p.quantity}</span><span>${money(p.quantity*p.price_cents)} <button class="btn" data-remove="${p.id}" aria-label="Remove ${escapeHtml(p.name)}">×</button></span></div>`).join('') : '<p class="sub">Tap a product to start a sale.</p>'; $('#tot').textContent = money(cart.reduce((n,p) => n+p.quantity*p.price_cents,0)); }
function renderReceipt(sale, pending = false) {
  latestReceipt = sale;
  const content = `<h3>${pending ? 'Pending offline sale' : 'Receipt '+escapeHtml(sale.receipt)}</h3><p class="small">${escapeHtml(user.branches.find(b=>b.id===sale.branch_id)?.name || '')}<br>${escapeHtml(new Date(sale.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}))}</p>${sale.items.map(i => `<div>${escapeHtml(i.name)} × ${i.quantity} — ${money(i.quantity*i.price_cents)}</div>`).join('')}<p><b>Total ${money(sale.total_cents)}</b></p><p class="small">${pending ? 'Not yet saved to the central database. Keep browser data until synced. Reference: '+escapeHtml(sale.client_key) : 'Cash sale · returns within 7 days using this receipt number.'}</p>`;
  $('#rcpt').innerHTML = `<div class="card">${content}<button class="btn noprint" id="printReceipt">Print receipt</button></div>`;
  $('#receiptPrint').innerHTML = content;
  $('#printReceipt').onclick = () => { $('#receiptPrint').innerHTML=content; document.body.classList.add('printing-receipt'); window.print(); document.body.classList.remove('printing-receipt'); };
}
function alerts(items) { return items.length ? items.map(p=>`<div class="row" style="justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)"><span>${escapeHtml(p.name)}<br><small class="sub">${p.quantity} left · reorder at ${p.reorder_level}</small></span><span class="chip bad">Low</span></div>`).join('') : '<p class="sub">Stock levels are above reorder thresholds.</p>'; }
async function dashboard() { const d = await api('/api/dashboard?branch='+branch()); $('#salesStat').textContent = d.sales_cents === null ? 'Restricted' : money(d.sales_cents); $('#refundStat').textContent = d.refunds_cents === null ? '' : 'Refunds today: '+money(d.refunds_cents); $('#staffStat').textContent = d.active_staff ?? 'Restricted'; $('#lowc').textContent=d.low_stock.length; $('#dashAlerts').innerHTML=alerts(d.low_stock); $('#syncT').innerHTML='<tr><th>Branch</th><th>Saved sales</th></tr>'+d.branches.map(b=>`<tr><td>${escapeHtml(b.name)}</td><td>${b.sales}</td></tr>`).join(''); }
async function fetchProducts() { const b = branch(); try { products = await api('/api/products?branch='+b); localStorage.setItem('shimmery.products.'+b,JSON.stringify(products)); } catch(e) { if (!e.network) throw e; products = JSON.parse(localStorage.getItem('shimmery.products.'+b)||'[]'); if (!products.length) throw new Error('No cached products for this branch. Reconnect first.'); } }
function supplierOptions(id) { return suppliers.map(s=>`<option value="${s.id}" ${s.id===id?'selected':''}>${escapeHtml(s.name)}</option>`).join(''); }
function renderPurchasing() { $('#purT').innerHTML='<tr><th>Item</th><th>Stock</th><th>Supplier</th><th>Order qty</th></tr>'+products.map(p=>`<tr data-order-product="${p.id}"><td>${escapeHtml(p.name)}</td><td>${p.quantity}</td><td><select class="orderSupplier" aria-label="Supplier for ${escapeHtml(p.name)}" ${user.role!=='purchasing'?'disabled':''}>${supplierOptions(p.supplier_id)}</select></td><td><input class="orderQty" aria-label="Order quantity for ${escapeHtml(p.name)}" type="number" min="0" max="10000" value="0" style="width:80px" ${user.role!=='purchasing'?'disabled':''}></td></tr>`).join(''); $('#orders').innerHTML='<h3>Purchase orders</h3>'+renderOrders(); }
function renderOrders() { return orders.length ? orders.map(o=>`<div class="order"><div class="row"><b>PO-${o.id} · ${escapeHtml(o.supplier_name)}</b><span class="chip ${o.status==='pending'?'warn':'ok'}">${o.status}</span>${o.status==='pending'&&['owner','manager'].includes(user.role)?`<button class="btn g" data-approve="${o.id}">Approve</button>`:''}</div><div class="small">${o.items.map(i=>`${escapeHtml(i.name)}: ${i.quantity} ordered / ${i.received_quantity} received`).join('<br>')}</div></div>`).join('') : '<p class="sub">No orders yet. Log in as Purchasing Staff to create one.</p>'; }
function deliveryProducts() { const order = orders.find(o=>o.id===Number($('#drOrder').value)); $('#drProduct').innerHTML=(order?.items.filter(i=>i.received_quantity<i.quantity)||[]).map(i=>`<option value="${i.product_id}">${escapeHtml(i.name)} · ${i.quantity-i.received_quantity} remaining</option>`).join(''); $('#drNote').textContent=order?'PO-'+order.id+' · '+order.supplier_name:'Create and approve a purchase order first.'; }
function logistics() { $('#logA').innerHTML=alerts(products.filter(p=>p.quantity<=p.reorder_level)); $('#drOrder').innerHTML=orders.filter(o=>o.status==='approved').map(o=>`<option value="${o.id}">PO-${o.id} · ${escapeHtml(o.supplier_name)}</option>`).join(''); deliveryProducts(); }
async function attendance() { const rows = await api('/api/attendance?branch='+branch()+'&date='+$('#ad').value); const status = r => !r.time_in ? 'No record' : r.time_out ? 'Timed out' : 'Timed in'; $('#attT').innerHTML='<tr><th>Employee</th><th>Time in</th><th>Time out</th><th>Status</th></tr>'+rows.map(r=>`<tr><td>${escapeHtml(r.name)}</td><td>${time(r.time_in)}</td><td>${time(r.time_out)}</td><td><span class="chip ${r.time_in?'ok':'warn'}">${status(r)}</span></td></tr>`).join(''); $('#asum').innerHTML=['Timed in','Timed out','No record'].map(s=>`<span class="chip">${s}: ${rows.filter(r=>status(r)===s).length}</span>`).join(''); }
async function personnel() { employees=await api('/api/employees?branch='+branch()); const opts=employees.map(e=>`<option value="${e.id}">${escapeHtml(e.name)}</option>`).join(''); $('#emp').innerHTML=opts; $('#scanEmployee').innerHTML=opts; $('#slip').innerHTML='<p class="sub">Select an employee and calculate an estimate.</p>'; await attendance(); }
async function setup() { const d=await api('/api/setup'); $('#setupInfo').innerHTML=`<p><span class="chip ok">Database ready</span></p><p>${escapeHtml(d.engine)} · ${escapeHtml(d.mode)}</p><p class="small">${escapeHtml(d.fingerprint)}</p><div class="row">${Object.entries(d.counts).map(([k,v])=>`<span class="chip">${escapeHtml(k.replaceAll('_',' '))}: ${v}</span>`).join('')}</div>`; $('#auditT').innerHTML='<tr><th>Activity</th><th>User</th><th>Time</th></tr>'+d.recent_events.map(e=>`<tr><td>${escapeHtml(e.action)}</td><td>${escapeHtml(e.name)}</td><td>${escapeHtml(new Date(e.created_at).toLocaleString('en-PH',{timeZone:'Asia/Manila'}))}</td></tr>`).join(''); }
async function loadModule() {
  if (!user || loading) return; loading=true;
  try {
    if (forcedOffline && current !== 'pos') throw new Error('Reconnect to load this module. Offline mode supports cash sales only.');
    if(current==='dash') await dashboard();
    if(current==='pos') { if(!forcedOffline) await fetchProducts(); else products=JSON.parse(localStorage.getItem('shimmery.products.'+branch())||'[]'); productList(); renderCart(); }
    if(current==='pur'||current==='log') { await fetchProducts(); if(current==='pur') suppliers=await api('/api/suppliers'); orders=await api('/api/orders?branch='+branch()); current==='pur'?renderPurchasing():logistics(); }
    if(current==='per') await personnel();
    if(current==='mig') await setup();
  } finally { loading=false; }
}
async function go(id) { if(!user || !roles[user.role][1].split(',').includes(id)) return; current=id; document.querySelectorAll('.sec').forEach(e=>e.classList.toggle('on',e.id===id)); document.querySelectorAll('nav button').forEach(e=>e.classList.toggle('on',e.dataset.module===id)); $('#ttl').textContent=modules.find(m=>m[0]===id)[1]; $('#sub').textContent=roles[user.role][0]+' · '+user.branches.find(b=>b.id===branch()).name; await loadModule(); }
async function enter(account) { user=account; $('#who').textContent=roles[user.role][0]; $('#branch').innerHTML=user.branches.map(b=>`<option value="${b.id}">${escapeHtml(b.name)}</option>`).join(''); document.querySelectorAll('[data-r]').forEach(e=>e.classList.toggle('hide',!e.dataset.r.split(',').includes(user.role))); $('#nav').innerHTML='<h1>Shimmery Central</h1>'+modules.filter(m=>roles[user.role][1].split(',').includes(m[0])).map(m=>`<button data-module="${m[0]}">${m[1]}</button>`).join(''); $('#login').classList.add('gone'); forcedOffline=false; networkUI(); await go(roles[user.role][1].split(',')[0]); await syncQueue(); }
async function syncQueue() {
  if (!user || syncing || forcedOffline || !navigator.onLine || !['manager','retail'].includes(user.role)) return;
  syncing=true; let count=0;
  try {
    for(const sale of myQueue()) {
      try { const result=await api('/api/sales',sale); saveQueue(queue().filter(s=>s.client_key!==sale.client_key)); count++; if(latestReceipt?.client_key===sale.client_key) renderReceipt(result); }
      catch(e) { toast('Pending sale '+sale.client_key.slice(0,8)+': '+e.message); break; }
    }
    if(count) { toast(`${count} offline sale(s) synced`); if(current==='pos') { await fetchProducts(); productList(); } }
  } finally { syncing=false; networkUI(); }
}
$('#demo').innerHTML=Object.keys(roles).map(r=>`<button class="chip" type="button" data-demo="${r}" style="border:0;cursor:pointer">${roles[r][0]}</button>`).join('');
$('#demo').onclick=e=>{ const role=e.target.dataset.demo; if(role) { $('#un').value=role; $('#pn').value='1234'; $('#err').textContent=''; } };
$('#lf').onsubmit=e=>{ e.preventDefault(); act(async()=>{ $('#err').textContent=''; try { await enter(await api('/api/login',{username:$('#un').value,password:$('#pn').value})); } catch(err) { $('#err').textContent=err.message; throw err; } },e.submitter); };
$('#nav').onclick=e=>{ const id=e.target.dataset.module; if(id) act(()=>go(id)); };
$('#branch').onchange=()=>{ cart=[]; $('#rcpt').innerHTML=''; $('#rres').innerHTML=''; latestReceipt=null; act(()=>go(current)); };
$('#out').onclick=()=>act(async()=>{ if(forcedOffline||networkUnavailable||!navigator.onLine) throw new Error('Reconnect before logging out.'); await api('/api/logout',{}); showLogin(); });
$('#net').onclick=()=>act(async()=>{ forcedOffline=!forcedOffline; networkUI(); if(!forcedOffline) { await syncQueue(); await loadModule(); } else toast('Offline simulation enabled. Cash sales will be queued.'); });
$('#q').oninput=productList;
$('#plist').onclick=e=>{ const button=e.target.closest('[data-product]'); if(!button) return; const product=stockProducts().find(p=>p.id===Number(button.dataset.product)); const line=cart.find(p=>p.id===product.id); if((line?.quantity||0)>=product.quantity) return toast('No more stock available for '+product.name); if(line) line.quantity++; else cart.push({...product,quantity:1}); renderCart(); };
$('#cart').onclick=e=>{ const id=Number(e.target.dataset.remove); if(id) { cart=cart.filter(p=>p.id!==id); renderCart(); } };
$('#clr').onclick=()=>{cart=[];renderCart();};
$('#pay').onclick=e=>act(async()=>{
  if(!cart.length) throw new Error('Add a product first');
  const sale={branch:branch(),user_id:user.id,client_key:crypto.randomUUID(),items:cart.map(p=>({product_id:p.id,quantity:p.quantity,expected_price_cents:p.price_cents}))};
  let result,pending=false;
  if(!forcedOffline&&!networkUnavailable&&navigator.onLine) { try { result=await api('/api/sales',sale); } catch(err) { if(!err.network) throw err; } }
  if(!result) { pending=true; sale.offline=true; sale.created_at=new Date().toISOString(); sale.offline_recorded_at=sale.created_at; saveQueue([...queue(),sale]); result={...sale,branch_id:sale.branch,total_cents:cart.reduce((n,p)=>n+p.quantity*p.price_cents,0),items:cart.map(p=>({name:p.name,quantity:p.quantity,price_cents:p.price_cents}))}; }
  cart=[];renderCart();renderReceipt(result,pending);if(!pending) await fetchProducts();productList();toast(pending?'Sale queued in this browser':'Sale saved to database');
},e.target);
$('#chk').onclick=e=>act(async()=>{ if(forcedOffline) throw new Error('Returns require the server'); const r=await api('/api/receipts?branch='+branch()+'&receipt='+encodeURIComponent($('#rno').value.trim())); $('#rres').innerHTML=`<p><b>${escapeHtml(r.receipt)}</b> · ${money(r.total_cents)}</p>${r.items.map(i=>`<div class="small">${escapeHtml(i.name)} × ${i.quantity} (${i.returned_quantity} returned)</div>`).join('')}<p><span class="chip ${r.eligible?'ok':'bad'}">${r.eligible?'Eligible for full return':'Already returned or outside the 7-day window'}</span></p>${r.eligible?'<div class="row"><button class="btn g" data-return="refund">Refund and restock</button><button class="btn" data-return="defective">Refund defective goods</button></div>':''}`; $('#rres').dataset.receipt=r.receipt; },e.target);
$('#rres').onclick=e=>{ const kind=e.target.dataset.return; if(kind) act(async()=>{ if(forcedOffline) throw new Error('Returns require the server'); const receipt=$('#rres').dataset.receipt; const result=await api('/api/returns',{branch:branch(),receipt,kind}); $('#rres').innerHTML='<span class="chip ok">Return recorded · '+money(result.amount_cents)+'</span>'; await fetchProducts();productList();toast('Return saved'); },e.target); };
$('#supplierForm').onsubmit=e=>{e.preventDefault();act(async()=>{ if(forcedOffline) throw new Error('Reconnect to save suppliers'); await api('/api/suppliers',{name:$('#sn').value,contact:$('#sc').value,items:$('#si').value,terms:$('#st').value}); e.target.reset(); await loadModule();toast('Supplier saved');},e.submitter);};
$('#saveOrders').onclick=e=>act(async()=>{
  if(forcedOffline) throw new Error('Reconnect to submit orders');
  const groups=new Map();document.querySelectorAll('[data-order-product]').forEach(row=>{const value=Number(row.querySelector('.orderQty').value);if(!Number.isInteger(value)||value<0||value>10000) throw new Error('Order quantities must be whole numbers from 0 to 10000');if(value){const id=Number(row.querySelector('.orderSupplier').value);if(!groups.has(id))groups.set(id,[]);groups.get(id).push({product_id:Number(row.dataset.orderProduct),quantity:value});}});
  if(!groups.size)throw new Error('Enter at least one order quantity');
  let saved=0;for(const [supplier_id,items] of groups){await api('/api/orders',{branch:branch(),supplier_id,items});saved++;document.querySelectorAll('[data-order-product]').forEach(row=>{if(Number(row.querySelector('.orderSupplier').value)===supplier_id)row.querySelector('.orderQty').value='0';});toast(saved+' supplier order(s) saved');}await loadModule();
},e.target);
$('#orders').onclick=e=>{const id=Number(e.target.dataset.approve);if(id)act(async()=>{if(forcedOffline)throw new Error('Reconnect to approve orders');await api('/api/orders/approve',{branch:branch(),order_id:id});await loadModule();toast('Order approved');},e.target);};
$('#drOrder').onchange=deliveryProducts;
$('#deliveryForm').onsubmit=e=>{e.preventDefault();act(async()=>{if(forcedOffline)throw new Error('Reconnect to record deliveries');await api('/api/deliveries',{branch:branch(),order_id:Number($('#drOrder').value),product_id:Number($('#drProduct').value),quantity:Number($('#drQty').value),damaged_quantity:Number($('#drDamage').value)});await loadModule();toast('Delivery saved; usable stock updated');},e.submitter);};
$('#ad').value=dateToday();$('#ad').onchange=()=>act(attendance);
$('#scanForm').onsubmit=e=>{e.preventDefault();act(async()=>{if(forcedOffline)throw new Error('Reconnect to record attendance');const action=$('#scanAction').value;await api('/api/attendance/scan',{branch:branch(),employee_id:Number($('#scanEmployee').value),action});$('#ad').value=dateToday();await attendance();toast('Simulated scan: time '+action+' saved');},e.submitter);};
$('#payrollForm').onsubmit=e=>{e.preventDefault();act(async()=>{if(forcedOffline)throw new Error('Reconnect to calculate payroll');const d=await api('/api/payroll',{branch:branch(),employee_id:Number($('#emp').value),days:Number($('#dw').value),advance_cents:Math.round(Number($('#ca').value)*100)});$('#slip').innerHTML=`<h3>${escapeHtml(d.employee.name)}</h3><p class="small">Daily rate ${money(d.employee.daily_rate_cents)}</p><table class="tbl">${[['Gross earnings',d.gross_cents],['SSS',-d.sss_cents],['PhilHealth',-d.philhealth_cents],['Pag-IBIG',-d.pagibig_cents],['Cash advance',-d.advance_cents],['Net pay',d.net_cents]].map(([label,value])=>`<tr><td>${label}</td><td style="text-align:right">${money(value)}</td></tr>`).join('')}</table><p class="small">${escapeHtml(d.note)}</p>`;},e.submitter);};
$('#printAttendance').onclick=()=>window.print();
window.addEventListener('online',()=>act(syncQueue));window.addEventListener('offline',networkUI);
setInterval(()=>{if(user&&myQueue().length&&!forcedOffline)act(syncQueue);},30000);

