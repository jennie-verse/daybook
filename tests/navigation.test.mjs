import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const app=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const source=app.replace(/^import .*;\n/gm,'').replace(/^state.day = emptyDay\(state.date\);.*$/m,'');
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
function harness(){
  const elements=new Map(); const notes=new Map();
  const $=id=>{if(!elements.has(id))elements.set(id,{value:'',textContent:'',disabled:false});return elements.get(id);};
  const context=vm.createContext({console,Date,Map,Set,crypto:{randomUUID:()=> 'fixture'},SOURCE_APPS:[],
    localStorage:{getItem:()=>null,setItem(){}},document:{getElementById:$},setTimeout:()=>1,clearTimeout(){},
    navigator:{onLine:false},listItems:async()=>[],readLocalNote:async date=>notes.get(date),
    saveLocalNote:async(date,markdown)=>notes.set(date,{markdown}),refreshDay:async date=>({date,apps:{},records:[]}),
    reconcileNote:async date=>notes.get(date)});
  vm.runInContext(source,context);context.render=()=>{};context.setBanner=()=>{};context.toast=()=>{};
  return {context,$,notes,run:code=>vm.runInContext(code,context)};
}
test('rapid date changes ignore older responses and preserve the newest date-note pair',async()=>{
  const h=harness();const pending=new Map();
  h.context.refreshDay=date=>{const result=deferred();pending.set(date,result);return result.promise;};
  h.notes.set('2020-01-01',{markdown:'first day'});h.notes.set('2020-01-02',{markdown:'second day'});
  const first=h.run("changeDate('2020-01-01')");await new Promise(resolve=>setImmediate(resolve));const second=h.run("changeDate('2020-01-02')");await new Promise(resolve=>setImmediate(resolve));
  pending.get('2020-01-02').resolve({date:'2020-01-02',apps:{},records:[]});await second;
  pending.get('2020-01-01').resolve({date:'2020-01-01',apps:{},records:[]});await first;
  assert.equal(h.run('state.date'),'2020-01-02');assert.equal(h.run('state.day.date'),'2020-01-02');
  assert.equal(h.$('note-text').value,'second day');assert.equal(h.$('note-text').disabled,false);
});
test('a refresh finishing during typing cannot overwrite the new local note',async()=>{
  const h=harness();const pending=deferred();h.context.refreshDay=()=>pending.promise;
  h.context.readLocalNote=async()=>({markdown:'stale remote snapshot'});
  const loading=h.run('loadDay()');h.$('note-text').value='한글 new note';await h.run('persistNote()');
  pending.resolve({apps:{},records:[]});await loading;
  assert.equal(h.$('note-text').value,'한글 new note');assert.equal(h.run('state.note'),'한글 new note');
});
test('IME text is not replaced by a background refresh',async()=>{
  const h=harness();const pending=deferred();h.context.refreshDay=()=>pending.promise;
  const loading=h.run('loadDay()');h.run('composing = true; noteRevision += 1;');h.$('note-text').value='작성 중';
  pending.resolve({apps:{},records:[]});await loading;
  assert.equal(h.$('note-text').value,'작성 중');
});
test('failed storage reports an unsaved note and retains it when navigating back',async()=>{
  const h=harness();h.context.saveLocalNote=async()=>{throw new Error('QuotaExceededError');};
  await h.run("changeDate('2020-01-01')");h.$('note-text').value='보존할 메모';await h.run('persistNote()');
  assert.match(h.$('note-status').textContent,/Not saved/);
  await h.run("changeDate('2020-01-02')");await h.run("changeDate('2020-01-01')");
  assert.equal(h.$('note-text').value,'보존할 메모');
});
test('invalid calendar dates are rejected',async()=>{
  const h=harness();const original=h.run('state.date');await h.run("changeDate('2020-02-31')");assert.equal(h.run('state.date'),original);
});

test('activity refresh failure still restores the existing local note before enabling editing',async()=>{
  const h=harness();h.notes.set('2020-01-01',{markdown:'반드시 보존할 기존 메모'});
  h.context.refreshDay=async()=>{throw new Error('Activity cache full');};
  await h.run("changeDate('2020-01-01')");
  assert.equal(h.$('note-text').value,'반드시 보존할 기존 메모');
  assert.equal(h.$('note-text').disabled,false);
});
test('unreadable local notes stay protected from accidental blank overwrites',async()=>{
  const h=harness();h.context.readLocalNote=async()=>{throw new Error('Storage unavailable');};
  await h.run("changeDate('2020-01-01')");
  assert.equal(h.$('note-text').disabled,true);
  assert.match(h.$('note-status').textContent,/Could not load/);
});

test('a sync request made during a slow upload is drained after that upload finishes', async () => {
  const h = harness(); const upload = deferred(); const timers = []; let uploads = 0;
  h.context.navigator.onLine = true;
  h.run("state.token = 'test'; state.context = 'test-context'");
  h.context.listItems = async () => [{ date: h.run('state.date') }];
  h.context.flushNote = async () => { uploads++; if (uploads === 1) await upload.promise; return true; };
  h.context.setTimeout = fn => { timers.push(fn); return timers.length; };
  const first = h.run('flushOutbox()');
  await new Promise(resolve => setImmediate(resolve));
  await h.run('flushOutbox()');
  assert.equal(uploads, 1);
  upload.resolve(); await first;
  assert.equal(timers.length, 1);
  await timers.shift()();
  assert.equal(uploads, 2);
  assert.equal(timers.length, 0);
});
