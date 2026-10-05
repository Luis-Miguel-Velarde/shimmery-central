'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { AsyncLocalStorage } = require('node:async_hooks');
const { Pool, types } = require('pg');
const root = __dirname;
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));
types.setTypeParser(20, value => Number(value));
const schema = process.env.TEST_SCHEMA || 'public';
if (!/^(public|shimmery_test_[a-z0-9_]+)$/.test(schema)) throw new Error('Invalid database schema');
const production = process.env.NODE_ENV === 'production';
if (production && !process.env.DATABASE_URL) throw new Error('Set DATABASE_URL to your Neon connection string');
let connection;
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  if (production) {
    url.searchParams.set('sslmode', 'verify-full');
    url.searchParams.delete('uselibpqcompat');
  }
  connection = {connectionString:url.toString()};
} else {
  connection = {host:process.env.PGHOST || '127.0.0.1',port:Number(process.env.PGPORT || 5432),database:process.env.PGDATABASE || 'shimmery_central',user:process.env.PGUSER || 'shimmery_app',password:process.env.PGPASSWORD};
}
// Neon transaction pooling rejects startup options. The hosted app uses the
// default public schema; only isolated local tests need a custom search path.
const schemaOptions = schema === 'public' ? {} : {options:`-c search_path=${schema}`};
const pool = new Pool({...connection,...schemaOptions,connectionTimeoutMillis:15000,max:10});
const context = new AsyncLocalStorage();
const query = async (sql, params=[]) => (context.getStore() || pool).query(sql,params);
const all = async (sql,...args) => (await query(sql,args)).rows;
const one = async (sql,...args) => (await all(sql,...args))[0];
const run = async (sql,...args) => { const result=await query(sql,args);return {changes:result.rowCount,id:result.rows[0]?.id}; };
async function transaction(fn) { if(context.getStore())return fn(); const client=await pool.connect();try{await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock(739425)');const result=await context.run(client,fn);await client.query('COMMIT');return result;}catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();} }
async function initialize() {
  if(schema!=='public')await query(`CREATE SCHEMA IF NOT EXISTS ${schema}`);
  await query(fs.readFileSync(path.join(root,'postgres.sql'),'utf8'));
}
module.exports={pool,query,all,one,run,transaction,initialize,schema};
