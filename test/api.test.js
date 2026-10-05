const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
let server, db, base, temp, pool, taskSchema;
const cookies = {};
before(async () => {
  taskSchema='shimmery_test_'+Date.now();
  process.env.PORT='0'; process.env.TEST_SCHEMA=taskSchema;
  const backend=require('../server.js');
  ({server, db, pool}=backend);
  await backend.ready;
  base='http://127.0.0.1:'+server.address().port;
});
after(async()=>{
  if(server)await new Promise(resolve=>server.close(resolve));
  if(pool){if(!/^shimmery_test_\d+$/.test(taskSchema))throw new Error('Invalid test schema cleanup target');await pool.query('DROP SCHEMA '+taskSchema+' CASCADE');await pool.end();}
});
async function request(role,endpoint,data,expected=200,extraHeaders={}){
  const response=await fetch(base+endpoint,{method:data===undefined?'GET':'POST',headers:{...(cookies[role]?{Cookie:cookies[role]}:{}),...(data===undefined?{}:{'Content-Type':'application/json'}),...extraHeaders},body:data===undefined?undefined:JSON.stringify(data)});
  const result=await response.json();assert.equal(response.status,expected,JSON.stringify(result));return result;
}
async function login(role){const response=await fetch(base+'/api/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:role,password:'1234'})});assert.equal(response.status,200);cookies[role]=response.headers.get('set-cookie').split(';')[0];return response.json();}
test('integrated workflows enforce permissions, stock and duplicate protection',async t=>{
  await t.test('authentication and branch permissions',async()=>{
    await request('', '/api/products?branch=1',undefined,401);
    await request('', '/api/login',{username:'manager',password:'wrong'},401);
    for(const role of ['owner','manager','purchasing','accounting','retail','packing'])await login(role);
    await request('retail','/api/products?branch=2',undefined,403);
    await request('retail','/api/setup',undefined,403);
    await request('packing','/api/sales',{branch:1,client_key:'bad-role',items:[{product_id:1,quantity:1}]},403);
    await request('manager','/api/orders',{branch:1,supplier_id:1,items:[{product_id:1,quantity:1}]},403);
    await request('manager','/api/sales',{branch:1,client_key:'cross-site',items:[]},403,{Origin:'https://example.invalid'});
  });
  let sale;
  await t.test('sale uses server prices, deducts inventory and retries once',async()=>{
    const start=await request('retail','/api/products?branch=1');assert.equal(start.find(p=>p.id===1).quantity,12);
    const input={branch:1,client_key:'sale-test-1',items:[{product_id:1,quantity:2,price_cents:1}]};
    sale=await request('retail','/api/sales',input,201);assert.equal(sale.total_cents,250000);
    const retry=await request('retail','/api/sales',input);assert.equal(retry.id,sale.id);assert.equal(retry.duplicate,true);
    const products=await request('retail','/api/products?branch=1');assert.equal(products.find(p=>p.id===1).quantity,10);
    await request('retail','/api/sales',{branch:1,client_key:'oversell',items:[{product_id:2,quantity:1},{product_id:1,quantity:11}]},409);
    const unchanged=await request('retail','/api/products?branch=1');assert.equal(unchanged.find(p=>p.id===2).quantity,60);
    await request('retail','/api/sales',{branch:1,client_key:'negative',items:[{product_id:1,quantity:-1}]},400);
    await request('retail','/api/sales',{branch:1,client_key:'offline-price',offline:true,items:[{product_id:1,quantity:1,expected_price_cents:1}]},409);
  });
  await t.test('returns restock only once; defective returns do not restock',async()=>{
    const receipt=await request('retail','/api/receipts?branch=1&receipt='+sale.receipt);assert.equal(receipt.eligible,true);
    const result=await request('retail','/api/returns',{branch:1,receipt:sale.receipt,kind:'refund'},201);assert.equal(result.amount_cents,250000);
    await request('retail','/api/returns',{branch:1,receipt:sale.receipt,kind:'refund'},409);
    const items=await request('retail','/api/products?branch=1');assert.equal(items.find(p=>p.id===1).quantity,12);
    const defective=await request('retail','/api/sales',{branch:1,client_key:'defective-test',items:[{product_id:1,quantity:1}]},201);
    await request('retail','/api/returns',{branch:1,receipt:defective.receipt,kind:'defective'},201);
    const remaining=await request('retail','/api/products?branch=1');assert.equal(remaining.find(p=>p.id===1).quantity,11);
  });
  await t.test('purchase approval and delivery respect remaining quantities and damage',async()=>{
    const supplier=await request('purchasing','/api/suppliers',{name:'Test supplier',contact:'demo',items:'Rice',terms:'Cash'},201);
    const order=await request('purchasing','/api/orders',{branch:1,supplier_id:supplier.id,items:[{product_id:1,quantity:10}]},201);
    const delivery={branch:1,order_id:order.id,product_id:1,quantity:6,damaged_quantity:1};
    await request('packing','/api/deliveries',delivery,409);
    await request('purchasing','/api/orders/approve',{branch:1,order_id:order.id},403);
    await request('owner','/api/orders/approve',{branch:1,order_id:order.id});
    await request('packing','/api/deliveries',delivery,201);
    await request('packing','/api/deliveries',{...delivery,quantity:5,damaged_quantity:0},409);
    await request('packing','/api/deliveries',{...delivery,quantity:4,damaged_quantity:0},201);
    const products=await request('retail','/api/products?branch=1');assert.equal(products.find(p=>p.id===1).quantity,20);
    const orders=await request('purchasing','/api/orders?branch=1');assert.equal(orders.find(o=>o.id===order.id).status,'received');
    await request('packing','/api/deliveries',delivery,409);
  });
  await t.test('simulated scans persist attendance and prevent duplicate actions',async()=>{
    await request('manager','/api/attendance/scan',{branch:1,employee_id:1,action:'out'},409);
    const record=await request('manager','/api/attendance/scan',{branch:1,employee_id:1,action:'in'},201);assert.equal(record.source,'simulated-fingerprint');
    await request('manager','/api/attendance/scan',{branch:1,employee_id:1,action:'in'},409);
    await request('manager','/api/attendance/scan',{branch:1,employee_id:3,action:'in'},404);
    const out=await request('accounting','/api/attendance/scan',{branch:1,employee_id:1,action:'out'},201);assert.ok(out.time_out);
    await request('accounting','/api/attendance/scan',{branch:1,employee_id:1,action:'out'},409);
    const sheet=await request('accounting','/api/attendance?branch=1&date='+record.work_date);assert.ok(sheet.find(r=>r.employee_id===1).time_out);
  });
  await t.test('payroll uses database rates and discloses sample deductions',async()=>{
    const payroll=await request('accounting','/api/payroll',{branch:1,employee_id:1,days:13,advance_cents:50000});
    assert.equal(payroll.gross_cents,793000);assert.equal(payroll.net_cents,667665);assert.match(payroll.note,/not statutory/);
    await request('retail','/api/payroll',{branch:1,employee_id:1,days:13,advance_cents:0},403);
    await request('accounting','/api/payroll',{branch:1,employee_id:1,days:-1,advance_cents:0},400);
    const setup=await request('owner','/api/setup');assert.equal(setup.engine,'PostgreSQL');assert.ok(setup.counts.audit_events>=9);
  });
  await t.test('catalog, employee maintenance and stock adjustments persist with permissions',async()=>{
    const p=await request('manager','/api/products',{branch:1,code:'P-TEST',name:'Demo test product',price_cents:1000,cost_cents:600,supplier_id:1,reorder_level:2,opening_quantity:10},201);
    await request('manager','/api/products/update',{branch:1,product_id:p.id,name:'Updated test product',price_cents:1200,cost_cents:650,supplier_id:1,reorder_level:3});
    const rows=await request('manager','/api/products?branch=1');assert.equal(rows.find(x=>x.id===p.id).quantity,10);assert.equal(rows.find(x=>x.id===p.id).price_cents,1200);
    await request('retail','/api/products',{branch:1},403);
    await request('manager','/api/inventory/adjust',{branch:1,product_id:p.id,delta:-20,reason:'Cannot go negative'},409);
    await request('manager','/api/inventory/adjust',{branch:1,product_id:p.id,delta:-2,reason:'Demo damage'});
    const moves=await request('manager','/api/movements?branch=1');assert.ok(moves.some(m=>m.product_id===p.id&&m.delta===-2));
    const employee=await request('manager','/api/employees',{branch:2,name:'New demo employee',daily_rate_cents:60000},201);
    await request('manager','/api/employees/update',{branch:2,employee_id:employee.id,name:'Updated employee',daily_rate_cents:65000});
    const emps=await request('accounting','/api/employees?branch=2');assert.equal(emps.find(e=>e.id===employee.id).daily_rate_cents,65000);
  });
  await t.test('automatic replenishment proposals are unique and convert to registered orders once',async()=>{
    const first=await request('purchasing','/api/replenishment?branch=1');const second=await request('purchasing','/api/replenishment?branch=1');assert.deepEqual(first.map(p=>p.id),second.map(p=>p.id));
    const p=first.find(p=>p.product_id===1);assert.ok(p);
    const o=await request('purchasing','/api/replenishment/order',{branch:1,proposal_id:p.id},201);
    await request('purchasing','/api/replenishment/order',{branch:1,proposal_id:p.id},409);
    const orders=await request('manager','/api/orders?branch=1');const saved=orders.find(x=>x.id===o.id);assert.equal(saved.status,'pending');assert.ok(saved.total_cents>0);
  });
  await t.test('branch requests and transfers update both branches atomically and retry once',async()=>{
    await login('retail_2');await request('retail_2','/api/products?branch=1',undefined,403);
    const r=await request('retail_2','/api/stock-requests',{branch:2,source_branch:1,product_id:2,quantity:5},201);
    await request('manager','/api/transfers',{request_id:r.id},409);
    await request('manager','/api/stock-requests/approve',{branch:2,request_id:r.id});
    await request('manager','/api/transfers',{request_id:r.id},201);await request('manager','/api/transfers',{request_id:r.id});
    const source=await request('manager','/api/products?branch=1'),dest=await request('retail_2','/api/products?branch=2');assert.equal(source.find(p=>p.id===2).quantity,55);assert.equal(dest.find(p=>p.id===2).quantity,65);
    const transfer={source_branch:1,destination_branch:2,product_id:2,quantity:3,client_key:'transfer-retry'};
    await request('manager','/api/transfers',transfer,201);await request('manager','/api/transfers',transfer);
    await request('manager','/api/transfers',{...transfer,quantity:1000,client_key:'transfer-oversell'},409);
    const final=await request('manager','/api/products?branch=1');assert.equal(final.find(p=>p.id===2).quantity,52);
    await request('retail_2','/api/transfers',transfer,403);
  });
  await t.test('payroll records preserve snapshots, integrate attendance and reject overlap',async()=>{
    const start='2026-10-01',end='2026-10-31';
    const data={branch:1,employee_id:1,days:13,advance_cents:50000,period_start:start,period_end:end};
    const saved=await request('accounting','/api/payroll-records',data,201);assert.equal(saved.net_cents,667665);
    await request('accounting','/api/payroll-records',data,409);
    await request('accounting','/api/payroll-records',{...data,period_start:'2026-10-15',period_end:'2026-11-05'},409);
    await request('accounting','/api/payroll-records',{...data,period_start:'2026-11-01',period_end:'2026-11-02'},400);
    await request('manager','/api/employees/update',{branch:1,employee_id:1,name:'Ana Updated',daily_rate_cents:70000});
    const rows=await request('accounting','/api/payroll-records?branch=1');assert.equal(rows[0].employee_name,'Ana Reyes');assert.equal(rows[0].daily_rate_cents,61000);
    const sheet=await request('accounting','/api/attendance/summary?branch=1&start=2020-01-01&end=2030-01-01');assert.equal(sheet.find(x=>x.id===1).completed_days,1);
    await request('retail','/api/payroll-records?branch=1',undefined,403);
  });
  await t.test('wholesale quote needs approval and fulfillment uses quoted prices exactly once',async()=>{
    const customer=await request('retail','/api/customers',{name:'Demo wholesale buyer',contact:'Fictional'},201);
    const w=await request('retail','/api/wholesale',{branch:1,customer_id:customer.id,items:[{product_id:3,quantity:2,price_cents:2000}]},201);
    await request('retail','/api/wholesale/fulfill',{branch:1,order_id:w.id},409);
    await request('retail','/api/wholesale/accept',{branch:1,order_id:w.id},403);
    await request('manager','/api/wholesale/accept',{branch:1,order_id:w.id});
    const sale=await request('retail','/api/wholesale/fulfill',{branch:1,order_id:w.id},201);assert.equal(sale.total_cents,4000);
    const retry=await request('retail','/api/wholesale/fulfill',{branch:1,order_id:w.id});assert.equal(retry.id,sale.id);
    const stock=await request('manager','/api/products?branch=1');assert.equal(stock.find(p=>p.id===3).quantity,16);
    const report=await request('accounting','/api/reports?branch=1');assert.ok(report.purchase_ordered_cents>0);assert.equal(report.payroll_saved_cents,667665);
  });
  await t.test('concurrent checkouts cannot oversell the final unit',async()=>{
    await request('manager','/api/inventory/adjust',{branch:1,product_id:4,delta:-199,reason:'Prepare one-unit concurrency scenario'});
    const submit=async key=>{const response=await fetch(base+'/api/sales',{method:'POST',headers:{Cookie:cookies.retail,'Content-Type':'application/json'},body:JSON.stringify({branch:1,client_key:key,items:[{product_id:4,quantity:1}]})});return response.status;};
    const results=await Promise.all([submit('concurrent-a'),submit('concurrent-b')]);assert.deepEqual(results.sort(),[201,409]);
    const stock=await request('manager','/api/products?branch=1');assert.equal(stock.find(p=>p.id===4).quantity,0);
  });
  await t.test('owner creates scoped accounts and retail cannot inspect accounts',async()=>{
    await request('manager','/api/users',{username:'test_cashier',name:'Test',role:'retail',pin:'1234',branches:[2]},403);
    await request('owner','/api/users',{username:'test_cashier',name:'Test',role:'retail',pin:'1234',branches:[2]},201);
    await login('test_cashier');await request('test_cashier','/api/products?branch=2');await request('test_cashier','/api/products?branch=1',undefined,403);
    await request('retail','/api/users',undefined,403);
    const status=await request('retail','/api/sync-status?client_key=sale-test-1');assert.equal(status.exists,true);
  });
  await t.test('purchasing controls reorder levels and accounting records supplier invoices',async()=>{
    await request('purchasing','/api/reorder-levels',{branch:1,items:[{product_id:2,reorder_level:50}]});
    const rows=await request('manager','/api/products?branch=1');assert.equal(rows.find(p=>p.id===2).reorder_level,50);
    await request('retail','/api/reorder-levels',{branch:1,items:[{product_id:2,reorder_level:20}]},403);
    const order=(await request('manager','/api/orders?branch=1')).find(o=>o.status==='received');assert.ok(order);
    await request('accounting','/api/invoices',{branch:1,order_id:order.id,invoice_number:'INV-DEMO-001',amount_cents:order.total_cents,invoice_date:'2026-10-06'},201);
    await request('accounting','/api/invoices',{branch:1,order_id:order.id,invoice_number:'INV-DEMO-002',amount_cents:order.total_cents,invoice_date:'2026-10-06'},409);
    const invoices=await request('accounting','/api/invoices?branch=1');assert.equal(invoices[0].amount_cents,invoices[0].order_total_cents);
    await request('retail','/api/invoices?branch=1',undefined,403);
  });
  await t.test('logout invalidates the session',async()=>{
    await request('retail','/api/logout',{});await request('retail','/api/me',undefined,401);
  });
});
