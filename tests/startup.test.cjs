'use strict';
/**
 * Lightweight browser-startup smoke test for Paint.
 * This caught the selector regression that made New Canvas and Open Image fail.
 * Run: node --test tests/startup.test.cjs
 * Note: this is a simulated DOM; real Safari/Chrome device testing remains necessary.
 */
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.resolve(__dirname,'../app.js'),'utf8');
const html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
const ids=[...new Set([...html.matchAll(/\\bid="([^"]+)"/g)].map(match=>match[1]))];

function mockBrowser(){
 const context2D={
  getImageData(x,y,w,h){return {data:new Uint8ClampedArray(w*h*4)}},
  createImageData(w,h){return {data:new Uint8ClampedArray(w*h*4)}},
  createRadialGradient(){return {addColorStop(){}}},
  createLinearGradient(){return {addColorStop(){}}},
  measureText(){return {width:12}},
  isPointInPath(){return false}
 };
 for(const method of 'drawImage clearRect fillRect beginPath moveTo lineTo stroke fill save restore translate rotate scale arc rect ellipse roundRect strokeRect strokeText fillText setLineDash putImageData quadraticCurveTo bezierCurveTo clip closePath'.split(' ')){
  context2D[method]=()=>{};
 }
 const classList=()=>({add(){},remove(){},toggle(){},contains(){return false}});
 class Element {
  constructor(id=''){
   this.id=id;this.style={display:'none'};this.classList=classList();this.dataset={};
   this.children=[];this.value='';this.checked=false;this.hidden=false;
   this.clientWidth=420;this.clientHeight=640;this.width=300;this.height=300;
   this.scrollLeft=0;this.scrollTop=0;this.tagName='DIV';this.innerHTML='';
   this.listeners={};this.clickCount=0;
  }
  getContext(){return context2D}
  addEventListener(name,callback){this.listeners[name]=callback}
  removeEventListener(){}
  setAttribute(){}
  getAttribute(){return null}
  removeAttribute(){}
  append(...children){this.children.push(...children)}
  appendChild(node){this.children.push(node)}
  replaceChildren(...children){this.children=children}
  closest(){return null}
  querySelectorAll(){return []}
  querySelector(){return new Element()}
  focus(){}
  select(){}
  click(){this.clickCount++;this.onclick?.();this.listeners.click?.({})}
  toDataURL(){return 'data:image/png;base64,AAAA'}
  toBlob(callback){callback({type:'image/png'})}
  getBoundingClientRect(){return {left:0,top:0,right:400,bottom:650,width:400,height:650}}
  get offsetWidth(){return 200}
  get offsetHeight(){return 140}
  get isConnected(){return true}
 }
 const elements=new Map(ids.map(id=>[id,new Element(id)]));
 const unresolved=[];
 const document={
  body:new Element('body'),activeElement:new Element(),documentElement:new Element(),title:'',
  querySelector(selector){
   if(selector.startsWith('#')){
    const id=selector.slice(1);
    if(!elements.has(id))unresolved.push(id);
    return elements.get(id)||null;
   }
   return new Element(selector);
  },
  querySelectorAll(){return []},
  createElement(tag){return new Element(tag)},
  addEventListener(){},removeEventListener(){}
 };
 const window={
  innerWidth:390,innerHeight:900,devicePixelRatio:1,
  addEventListener(){},removeEventListener(){},
  matchMedia(){return {matches:false}},
  location:{href:'https://paint.miniup.app'}
 };
 const globals={
  document,window,navigator:{},
  localStorage:{getItem(){return null},setItem(){},removeItem(){}},
  requestAnimationFrame(){},
  setTimeout(){return 1},clearTimeout(){},
  Image:class{},HTMLCanvasElement:Element,
  createImageBitmap:async()=>({width:96,height:64,close(){}}),
  Blob:class{},URL:{createObjectURL(){return ''},revokeObjectURL(){}},
  ResizeObserver:class{observe(){}unobserve(){}disconnect(){}},
  confirm(){return true},alert(){},
  getComputedStyle(){return {getPropertyValue(){return ''}}},
  console
 };
 return{context:globals,elements,window,unresolved};
}
function boot(){
 const browser=mockBrowser();
 vm.runInNewContext(source,browser.context,{filename:'app.js',timeout:10000});
 assert.ok(browser.window.PaintDebug,'The editor did not finish bootstrapping');
 assert.deepEqual(browser.unresolved,[],'DOM IDs referenced by startup code are missing');
 return browser;
}
test('startup renders a new blank canvas and creates an image tab',()=>{
 const {window}=boot();
 assert.equal(window.PaintDebug.state.base.width,1280);
 assert.equal(window.PaintDebug.state.base.height,720);
 assert.equal(window.PaintDebug.tabs.length,1);
});
test('New Canvas button opens another editable tab without discarding first',()=>{
 const {window,elements}=boot();
 const before=window.PaintDebug.state.base;
 elements.get('newTabBtn').click();
 assert.equal(window.PaintDebug.tabs.length,2);
 assert.notEqual(window.PaintDebug.state.base,before);
 assert.equal(window.PaintDebug.state.base.width,1280);
});
test('Open Image button opens the file picker',()=>{
 const {elements}=boot();
 elements.get('openBtn').click();
 assert.equal(elements.get('fileInput').clickCount,1);
});
test('Choosing an image decodes it and adds a new image tab',async()=>{
 const {window,elements}=boot();
 const input=elements.get('fileInput');
 assert.equal(typeof input.listeners.change,'function','File picker lacks a change handler');
 input.files=[{name:'sample.png',type:'image/png'}];
 input.listeners.change({target:input});
 // File decode is asynchronous; allow its promise chain to settle.
 for(let i=0;i<4;i++)await Promise.resolve();
 assert.equal(window.PaintDebug.tabs.length,2);
 assert.equal(window.PaintDebug.state.base.width,96);
 assert.equal(window.PaintDebug.state.base.height,64);
 assert.equal(window.PaintDebug.state.name,'sample.png');
});
