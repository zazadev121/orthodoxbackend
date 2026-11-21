import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import {createApp} from '../src/app.js';
import {sqlFixture,postgrestFixture} from './helpers/sql-fixture.js';
import {readFileSync} from 'node:fs';
const auth={Authorization:'Bearer fixture-owner'};
test('Georgian editorial updates preserve approved wording and central author relationships',async()=>{
 const pg=await sqlFixture({migrate:true}),db=postgrestFixture(pg);
 try {
 await pg.query('insert into auth.users(id) values($1)',[db.owner.id]);
 await pg.query('insert into admins(user_id) values($1)',[db.owner.id]);
 const r=request(createApp({db,env:{OWNER_EMAIL:db.owner.email}}));
 const a=(await r.post('/api/admin/authors').set(auth).send({slug:'georgian-test',name_en:'Preserved English',name_ckb:'دەقی پارێزراو',name_ka:'წმინდა მამა',biography_ka:'ხელით დაწერილი ბიოგრაფია.',published:true}).expect(201)).body;
 await r.patch('/api/admin/authors/'+a.id).set(auth).send({name_ka:'წმინდა იოანე',biography_ka:'  დამტკიცებული ტექსტი\nუცვლელად.  '}).expect(200);
 const saved=(await pg.query('select * from authors where id=$1',[a.id])).rows[0];
 assert.equal(saved.name_en,'Preserved English'); assert.equal(saved.name_ckb,'دەقی پارێزراو');
 assert.equal(saved.biography_ka,'  დამტკიცებული ტექსტი\nუცვლელად.  ');
 const q=(await r.post('/api/admin/quotes').set(auth).send({author_id:a.id,text_ka:'დამოწმებული ციტატის საცდელი ტექსტი.',reference_ka:'საცდელი წყარო, თავი 1',published:true}).expect(201)).body;
 assert.equal(q.author_id,a.id);
 const catalog=(await r.get('/api/cms/catalog').expect(200)).body;
 assert.equal(Number(catalog.authors.find(x=>x.id===a.id).quote_count),1);
 assert.equal(catalog.authors.find(x=>x.id===a.id).name_ka,'წმინდა იოანე');
 await r.post('/api/admin/doctrines').set(auth).send({slug:'georgian-history',title_ka:'ეკლესიის ისტორია',body_ka:'ხელით დამტკიცებული ისტორიული ტექსტი.',category:'history',reference_ka:'გამოცემა, თავი 1',published:true}).expect(201);
 } finally {await pg.close();}
});
test('additive Georgian migration is repeatable and retains original fields and server-only grants',async()=>{
 const pg=await sqlFixture({migrate:true});
 try {
 await pg.query("insert into authors(slug,name_en,biography_ckb,published) values('keep-original','Original','دەقی ڕەسەن',true)");
 const sql=readFileSync(new URL('../supabase/migrations/20261121173314_georgian_localization.sql',import.meta.url),'utf8');
 await pg.exec(sql);
 const a=(await pg.query("select * from author_public_stats where slug='keep-original'")).rows[0];
 assert.equal(a.name_en,'Original'); assert.equal(a.biography_ckb,'دەقی ڕەسەن'); assert.equal(a.name_ka,null);
 const grants=(await pg.query("select grantee from information_schema.role_table_grants where table_name='authors' and grantee in ('anon','authenticated')")).rows;
 assert.equal(grants.length,0);
 }finally{await pg.close();}
});
