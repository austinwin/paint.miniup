'use strict';
/**
 * Pure logic smoke tests for tools in the dependency-free Paint editor.
 * Run: node --test tests/drawing-tools.test.cjs
 * Browser-only clipboard, Canvas, touch and IndexedDB behavior still need device QA.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');

function functionSource(name){
 const at=source.indexOf('function '+name+'(');
 assert.ok(at>=0,'Missing '+name);
 const brace=source.indexOf('{',at);
 let depth=0,quote='',escaped=false,lineComment=false;
 for(let i=brace;i<source.length;i++){
  const c=source[i];
  if(lineComment){if(c==='\n')lineComment=false;continue}
  if(quote){
   if(escaped){escaped=false;continue}
   if(c==='\\'){escaped=true;continue}
   if(c===quote)quote='';
   continue;
  }
  if(c==='/'&&source[i+1]==='/'){lineComment=true;i++;continue}
  if(c==='"'||c==="'"||c==='`'){quote=c;continue}
  if(c==='{')depth++;
  if(c==='}'&&--depth===0)return source.slice(at,i+1);
 }
 throw new Error('Unbalanced function: '+name);
}
function isolated(name,dependencies={}){
 const keys=Object.keys(dependencies);
 return new Function(...keys,functionSource(name)+';return '+name+';')(...keys.map(k=>dependencies[k]));
}
function context(){
 const events=[];
 return{
  events,
  save(){events.push('saved')},
  redraw(){events.push('redraw')},
  toast(message){events.push(message)}
 };
}

test('contextual tools and controls exist without permanent tool duplication',()=>{
 for(const id of ['brushMode','brushSmoothing','brushPressure','eraserMode','highlighterOpacity',
   'lineMode','finishPolylineBtn','fillType','gradientMode','gradientEndColor',
   'redactMode','redactStrength','clonePickSource','objectForward','objectBackward']){
  assert.match(html,new RegExp('id="'+id+'"'));
 }
 assert.match(source,/function makeClonePatch\(/);
 assert.match(source,/function makePrivacyPatch\(/);
 assert.match(source,/function clipStrokeToSelection\(/);
 assert.match(source,/function drawAirbrush\(/);
});
test('linear and radial gradients use correct stops and canvas dimensions',()=>{
 const calls=[];
 const fill={
  save(){},restore(){},
  createLinearGradient(...params){calls.push(['linear',...params]);return{addColorStop:(...args)=>calls.push(['stop',...args])}},
  createRadialGradient(...params){calls.push(['radial',...params]);return{addColorStop:(...args)=>calls.push(['stop',...args])}},
  fillRect(...params){calls.push(['fill',...params])}
 };
 const draw=isolated('drawGradient',{st:{base:{width:400,height:240}}});
 draw(fill,{start:{x:5,y:10},end:{x:45,y:10},color:'#ff0000',endColor:'#ffffff',gradientMode:'linear'});
 assert.ok(calls.some(v=>v[0]==='linear'));
 assert.equal(calls.filter(v=>v[0]==='stop').length,2);
 assert.ok(calls.some(v=>v[0]==='fill'&&v[3]===400&&v[4]===240));
 calls.length=0;
 draw(fill,{start:{x:5,y:10},end:{x:45,y:10},color:'#ff0000',endColor:'#ffffff',gradientMode:'radial'});
 assert.ok(calls.some(v=>v[0]==='radial'&&v[6]===40));
});
test('selected pixel mask retains alpha only inside the selection',()=>{
 const buffer=Uint8ClampedArray.from(Array.from({length:4},()=>[10,20,30,255]).flat());
 let result=buffer;
 const canvas={getContext:()=>({
  getImageData:()=>({data:new Uint8ClampedArray(result)}),
  putImageData:({data})=>{result=data}
 })};
 const mask=isolated('maskCanvasToSelection',{st:{base:{width:4,height:2}}});
 assert.equal(mask(canvas,{x:1,y:0,w:2,h:2},{
  w:4,h:2,mask:Uint8Array.from([0,1,0,0,0,0,1,0])
 }),true);
 assert.deepEqual(Array.from(result).filter((_,i)=>i%4===3),[255,0,0,255]);
});
test('object forward and backward actions snapshot and protect destructive pixel operations',()=>{
 const st={selected:1,objects:[{type:'text',id:1},{type:'rect',id:2},{type:'line',id:3}]};
 const ctx=context();
 const reorder=isolated('reorderSelectedObject',{
  st,snapshot:ctx.save,updateContextOptions:()=>{},paint:ctx.redraw,toast:ctx.toast
 });
 reorder(1);
 assert.deepEqual(st.objects.map(o=>o.id),[1,3,2]);
 assert.equal(st.selected,2);
 reorder(-1);
 assert.deepEqual(st.objects.map(o=>o.id),[1,2,3]);
 st.objects[0].type='erase-region';
 reorder(-1);
 assert.equal(st.selected,1);
 assert.ok(ctx.events.some(x=>String(x).includes('Flatten')));
 assert.equal(ctx.events.filter(x=>x==='saved').length,2);
});
test('polyline completes as one undoable editable annotation',()=>{
 const st={polylineDraft:{type:'polyline',points:[{x:1,y:2},{x:8,y:9}],color:'#ff0000',width:2},objects:[],draft:{}};
 const ctx=context();
 const finish=isolated('finishPolyline',{st,updateContextOptions:()=>{},snapshot:ctx.save,paint:ctx.redraw,toast:ctx.toast});
 finish();
 assert.equal(st.objects.length,1);
 assert.equal(st.objects[0].type,'polyline');
 assert.equal(st.objects[0].points.length,2);
 assert.equal(st.polylineDraft,null);
 assert.ok(ctx.events.includes('saved'));
});
test('large drawing allocations remain local to stroke bounds',()=>{
 const bounds=isolated('operationBounds',{
  st:{base:{width:100,height:70}},
  getBounds:()=>({x:20,y:15,w:5,h:10})
 });
 assert.deepEqual(bounds({type:'brush-stroke',width:2}),{x:13,y:8,w:19,h:24});
 assert.deepEqual(bounds({type:'gradient'}),{x:0,y:0,w:100,h:70});
});
