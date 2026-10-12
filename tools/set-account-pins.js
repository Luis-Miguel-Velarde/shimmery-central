'use strict';
// One-time helper: gives every seeded account its own random PIN and a role-based display name.
// Usage: node tools/set-account-pins.js [site URL]   (default: the hosted site)
// Prompts for the Owner's current PIN, then prints the new usernames and PINs and saves them
// to a private file outside the repository. Never commit or share that file.
const crypto = require('node:crypto'), fs = require('node:fs'), path = require('node:path'), readline = require('node:readline');
const base = (process.argv[2] || 'https://shimmery-central.onrender.com').replace(/\/$/, '');
const roleNames = {owner:'Business Owner',manager:'Manager',purchasing:'Purchasing Staff',accounting:'Accounting Staff',retail:'Retail Staff',packing:'Packing Staff'};
const seeded = ['owner','manager','purchasing','accounting','retail','packing',...[2,3,4,5].flatMap(b => ['retail_'+b,'packing_'+b])];
const outFile = path.resolve(__dirname, '..', '..', 'shimmery-accounts-PRIVATE.txt');
function newPin() { for (;;) { const pin = String(crypto.randomInt(100000, 1000000)); if (!/^(\d)\1+$/.test(pin)) return pin; } }
function askHidden(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({input:process.stdin, output:process.stdout, terminal:true});
    rl._writeToOutput = text => { if (text.startsWith(question)) process.stdout.write(question); };
    rl.question(question, answer => { rl.close(); process.stdout.write('\n'); resolve(answer.trim()); });
  });
}
let cookie = '';
async function call(endpoint, data) {
  const response = await fetch(base + endpoint, {method:data === undefined ? 'GET' : 'POST', headers:{...(cookie ? {Cookie:cookie} : {}), ...(data === undefined ? {} : {'Content-Type':'application/json'})}, body:data === undefined ? undefined : JSON.stringify(data)});
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${endpoint}: ${result.error || response.status}`);
  if (endpoint === '/api/login') cookie = response.headers.get('set-cookie').split(';')[0];
  return result;
}
(async () => {
  console.log('Site: ' + base + '\nWaking the server (free hosting can take up to a minute)...');
  await call('/healthz');
  const ownerPin = await askHidden('Current Owner PIN: ');
  await call('/api/login', {username:'owner', password:ownerPin});
  const accounts = await call('/api/users'), results = [];
  const label = a => roleNames[a.role] + (['retail','packing'].includes(a.role) && a.branches.length === 1 ? ' · ' + a.branches[0].name : '');
  for (const a of accounts.filter(a => seeded.includes(a.username) && a.username !== 'owner')) {
    const pin = newPin(), branches = a.branches.map(b => b.id);
    await call('/api/users/update', {user_id:a.id, name:label(a), role:a.role, branches});
    await call('/api/users/pin', {user_id:a.id, pin});
    if (!a.active) await call('/api/users/status', {user_id:a.id, active:true});
    results.push({username:a.username, name:label(a), pin});
  }
  const owner = accounts.find(a => a.username === 'owner'), pin = newPin();
  await call('/api/users/update', {user_id:owner.id, name:roleNames.owner, role:'owner', branches:owner.branches.map(b => b.id)});
  await call('/api/me/pin', {current_pin:ownerPin, new_pin:pin});
  results.unshift({username:'owner', name:roleNames.owner, pin});
  const skipped = accounts.filter(a => !seeded.includes(a.username)).map(a => a.username);
  const table = results.map(r => r.username.padEnd(12) + r.pin.padEnd(9) + r.name).join('\n');
  const text = `Shimmery Central accounts · ${base} · ${new Date().toISOString()}\nPRIVATE: do not commit, screenshot or share publicly.\n\nUsername    PIN      Name / role\n${table}\n` + (skipped.length ? `\nNot changed (created by hand): ${skipped.join(', ')}\n` : '');
  fs.writeFileSync(outFile, text);
  console.log('\n' + text + '\nSaved to ' + outFile);
})().catch(e => { console.error('Stopped: ' + e.message); process.exitCode = 1; });
