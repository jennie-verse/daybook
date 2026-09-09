import test from 'node:test';
import assert from 'node:assert/strict';
import { chronologyRows, chronologicalMarkdown, rowTime } from '../src/chronology.js';
import { serializeMarkdown } from '../src/markdown.js';
import { readTodayTimeline } from '../src/today-timeline.js';
const date='2026-09-07', zone='America/Chicago';
const record=(id,app,kind,at,data={},title=id)=>({id,app,kind,at,updatedAt:at,title,data});
const shower=record('timeline:one','today','timeline-entry',`${date}T08:10:00-05:00`,{startedAt:`${date}T08:10:00-05:00`,endedAt:`${date}T08:30:00-05:00`},'샤워');
test('interleaves apps by actual start rather than upload timestamp or source clock',()=>{
 const focus=record('focus','focus','session',`${date}T18:00:00Z`,{startedAt:`${date}T13:20:00Z`,endedAt:`${date}T14:00:00Z`,subject:'공부'});
 const early=record('clip','clip','clip',`${date}T09:00:00+00:00`,{text:'메모'});
 const day={records:[focus,shower,early]};assert.deepEqual(chronologyRows(day).map(r=>r.id),['clip:clip','today:timeline:one','focus:focus']);
 const md=chronologicalMarkdown(day,date,{timeZone:zone});assert.ok(md.indexOf('[Clip]')<md.indexOf('[Today]'));assert.match(md,/08:10 AM - 08:30 AM \[Today\] 샤워/);assert.match(md,/08:20 AM - 09:00 AM \[Focus\] 공부/);
});
test('empty activity, start-only and Korean source text survive export',()=>{
 const md=chronologicalMarkdown({records:[{...shower,title:'',data:{...shower.data,endedAt:null}},record('c','clip','clip',shower.at,{text:'첫 줄\n<script>두 번째</script>'})]},date,{timeZone:zone,detail:'compact'});
 assert.match(md,/08:10 AM \[Today\]/);assert.doesNotMatch(md,/No activity name/);assert.match(md,/> 첫 줄/);assert.match(md,/\\<script\\>/);
});
test('task snapshots do not masquerade as activities or duplicate task summaries',()=>{
 const task=record('a','today','task',shower.at,{hasTime:true});const activity=record('a:2026-09-07','today','task-activity',shower.at,{lastAt:`${date}T11:00:00-05:00`,actions:['added','edited']});
 const rows=chronologyRows({records:[task,activity,record('b','today','task',shower.at)]});assert.equal(rows.length,2);assert.equal(rows[1].start,null);assert.match(rows[0].meaning,/Activity summary: Added, Edited/);
});
test('missing timestamps, invalid ends, breaks, same-time IDs and unknown sources remain visible',()=>{
 const rows=chronologyRows({records:[record('z','newapp','entry','bad'),record('b','focus','session',shower.at,{startedAt:shower.at,endedAt:'bad',mode:'break'}),shower]});assert.equal(rows.length,3);assert.equal(rows[0].meaning,'Break');assert.equal(rows[0].end,null);assert.equal(rows.at(-1).start,null);
});
test('cross-midnight, mixed offsets and repeated DST clocks are explicit',()=>{
 const cross=chronologyRows({records:[{...shower,data:{startedAt:`${date}T23:50:00-05:00`,endedAt:'2026-09-08T00:20:00-05:00'}}]})[0];assert.match(rowTime(cross,zone,date),/11:50 PM - 2026-09-08 12:20 AM/);
 const repeated=chronologyRows({records:[{...shower,data:{startedAt:'2026-11-01T01:30:00-05:00',endedAt:'2026-11-01T01:30:00-06:00'}}]})[0];assert.match(rowTime(repeated,zone,'2026-11-01'),/GMT-5.*GMT-6/);
});
test('chronological serializer preserves note; app layout remains available',()=>{
 const day={apps:{today:[shower]},records:[shower],failures:[]};const md=serializeMarkdown({day,date,note:'내 일기',layout:'chronological',timeZone:zone});assert.match(md,/## Timeline/);assert.match(md,/## Daily note\n\n내 일기/);assert.doesNotMatch(md,/## Today\n/);
 const byApp=serializeMarkdown({day,date});assert.match(byApp,/## Today activities/);assert.doesNotMatch(byApp,/### Today activities/);
});
function fixture(){
 const cache=new Map(),remote=new Map();let reads=0;
 const contract={validateCollection(rows){if(!Array.isArray(rows))throw Error('bad rows')},mergeEntries(...collections){const all=collections.flat(),heads=all.filter(r=>!all.some(n=>n.supersedes?.includes(r.revisionId)));const ids=new Map();for(const r of heads)ids.set(r.id,r);return {entries:[...ids.values()],conflicts:[]}}};
 const config={owner:'test',repo:'webapp-data'},localRows=[];
 const api={async listDir(c,path){if(path==='today/timeline')return [{type:'dir',name:'2026-09'}];return [...remote].map(([path,f])=>({type:'file',name:path.split('/').at(-1),path,sha:f.sha}))},async readFile(c,p){reads++;return {exists:true,...remote.get(p)}}};
 const options={api,config,local:async()=>localRows,readCache:async k=>cache.get(k),saveCache:async item=>cache.set(item.key,structuredClone(item)),getModel:async()=>contract};
 const first={id:'one',revisionId:'r1',supersedes:[],startDate:date,startedAt:shower.at,endedAt:null,bucket:'2026-09',title:'샤워'};
 const publish=(r,sha='1')=>remote.set('today/timeline/2026-09/data.phone.json',{sha,content:JSON.stringify({v:1,app:'today-timeline',context:'phone',bucket:'2026-09',entries:[r],conflicts:[]})});
 return {options,localRows,first,publish,remote,reads:()=>reads};
}
test('remote reader discovers creation buckets, skips unchanged SHA and updates same ID',async()=>{
 const f=fixture();f.publish(f.first);assert.equal((await readTodayTimeline(date,f.options)).records.length,1);await readTodayTimeline(date,f.options);assert.equal(f.reads(),1);
 f.publish({...f.first,revisionId:'r2',supersedes:['r1'],endedAt:`${date}T08:30:00-05:00`},'2');const r=await readTodayTimeline(date,f.options);assert.equal(r.records.length,1);assert.equal(r.records[0].data.endedAt,`${date}T08:30:00-05:00`);
});
test('delete and start-date moves remove old day; corrupt remote preserves last good cache',async()=>{
 const f=fixture();f.publish(f.first);await readTodayTimeline(date,f.options);f.remote.values().next().value.content='bad';f.remote.values().next().value.sha='bad';const failed=await readTodayTimeline(date,f.options);assert.equal(failed.records.length,1);assert.equal(failed.errors.length,1);
 f.publish({...f.first,revisionId:'r2',supersedes:['r1'],startDate:'2026-08-20',startedAt:'2026-08-20T08:10:00-05:00'},'2');assert.equal((await readTodayTimeline(date,f.options)).records.length,0);assert.equal((await readTodayTimeline('2026-08-20',f.options)).records.length,1);
 f.publish({...f.first,revisionId:'r3',supersedes:['r1','r2'],deletedAt:'2026-09-08T12:00:00Z'},'3');assert.equal((await readTodayTimeline(date,f.options)).records.length,0);
});
test('local rows and cached remote rows remain usable without a token',async()=>{
 const f=fixture();f.publish(f.first);await readTodayTimeline(date,f.options);f.localRows.push({...f.first,id:'two',revisionId:'local'});const r=await readTodayTimeline(date,{...f.options,config:undefined,api:undefined});assert.equal(r.records.length,2);
});

test('cache write failure keeps freshly read activities visible and reports it',async()=>{
 const f=fixture();f.localRows.push(f.first);const r=await readTodayTimeline(date,{...f.options,config:undefined,saveCache:async()=>{throw Error('full')}});assert.equal(r.records.length,1);assert.match(r.errors[0],/could not be cached/);
});
