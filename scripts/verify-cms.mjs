// Explicit local QA harness. Never imported by src/server.js or enabled by production config.
import express from 'express';
import { createApp } from '../src/app.js';
import { sqlFixture,postgrestFixture } from '../test/helpers/sql-fixture.js';
export async function createCmsFixtureApp(){
const pg=await sqlFixture({migrate:true}),db=postgrestFixture(pg);
await pg.query('insert into auth.users(id) values($1)',[db.owner.id]);await pg.query('insert into admins(user_id) values($1)',[db.owner.id]);
const app=express();
app.get('/api/_fixture-media/icons/:filename',(req,res)=>{const bytes=db.images.get('icons/'+req.params.filename);if(!bytes)return res.sendStatus(404);res.type(req.params.filename.endsWith('png')?'png':'jpg').send(bytes);});
app.use(createApp({db,env:{OWNER_EMAIL:db.owner.email,FRONTEND_ORIGIN:'http://127.0.0.1:4173'},scriptureFetcher:fetch}));
return app;
}
