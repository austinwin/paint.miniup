'use strict';
// Real Chromium smoke test. Run against a local static server after installing Playwright.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const base=process.env.PAINT_TEST_URL||'http://127.0.0.1:8765';
function pointer(x,y,type='pointerdown',id=7){
 const canvas=document.querySelector('#canvas'),r=canvas.getBoundingClientRect();
 canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,
  pointerId:id,pointerType:'mouse',clientX:r.left+x*window.PaintDebug.state.zoom,clientY:r.top+y*window.PaintDebug.state.zoom}));
}
async function main(){
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 try{
  await page.goto(base,{waitUntil:'load'});
  await page.waitForFunction(()=>window.PaintDebug?.state?.base?.width===1280);
  assert.equal(await page.evaluate(()=>window.PaintDebug.tabs.length),1,'A blank canvas should boot');
  await page.locator('#newTabBtn').click();
  assert.equal(await page.evaluate(()=>window.PaintDebug.tabs.length),2,'New Image adds a tab');

  const dataURL=await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=96;canvas.height=64;
   const g=canvas.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,96,64);
   g.fillStyle='#0078d4';g.fillRect(12,12,30,24);
   return canvas.toDataURL('image/png');
  });
  await page.locator('#fileInput').setInputFiles({name:'sample.png',mimeType:'image/png',buffer:Buffer.from(dataURL.split(',')[1],'base64')});
  await page.waitForFunction(()=>window.PaintDebug.tabs.length===3&&window.PaintDebug.state.name==='sample.png');
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.base.width),96,'Upload image dimensions');

  const before=await page.locator('#documentTabList .document-tab.active img').getAttribute('src');
  await page.evaluate(()=>{
   window.PaintDebug.setTool('text');
   const mode=document.querySelector('#textMode');mode.value='number';mode.dispatchEvent(new Event('change',{bubbles:true}));
   const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),zoom=window.PaintDebug.state.zoom;
   for(const [x,y] of [[20,20],[65,35]]){
    c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,pointerId:7,pointerType:'mouse',clientX:r.left+x*zoom,clientY:r.top+y*zoom}));
   }
  });
  assert.deepEqual(await page.evaluate(()=>window.PaintDebug.state.objects.filter(x=>x.type==='number-marker').map(x=>x.number)),[1,2],'Sequential markers');
  const after=await page.locator('#documentTabList .document-tab.active img').getAttribute('src');
  assert.notEqual(after,before,'Tab thumbnail should include annotations');

  await page.evaluate(()=>{
   window.PaintDebug.setTool('text');
   const mode=document.querySelector('#textMode');mode.value='label';mode.dispatchEvent(new Event('change',{bubbles:true}));
   const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=window.PaintDebug.state.zoom;
   c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,pointerId:9,pointerType:'mouse',clientX:r.left+8*z,clientY:r.top+8*z}));
   const field=document.querySelector('#textEntry');field.value='Inspect valve';
   document.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Enter'}));
  });
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.objects.find(x=>x.type==='text')?.labelMode),'label','Editable label mode');

  await page.evaluate(()=>{
   const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=window.PaintDebug.state.zoom;
   const emit=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,pointerId:15,pointerType:'mouse',clientX:r.left+x*z,clientY:r.top+y*z}));
   window.PaintDebug.setTool('arrow');
   emit('pointerdown',10,10);emit('pointermove',50,10);emit('pointerup',50,10);
   window.PaintDebug.setTool('select');
   const st=window.PaintDebug.state,idx=st.objects.findIndex(x=>x.type==='arrow');
   if(idx<0)throw Error('Arrow did not draw');
   st.selected=idx;
   emit('pointerdown',50,10);emit('pointermove',65,25);emit('pointerup',65,25);
  });
  assert.ok(await page.evaluate(()=>window.PaintDebug.state.objects.some(x=>x.type==='arrow'&&x.x2>55)),'Arrow endpoint is editable');

  // Undo / Redo after selection.
  const count=await page.evaluate(()=>window.PaintDebug.state.historyIdx);
  await page.evaluate(()=>{
   document.activeElement?.blur();
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
  });
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.historyIdx),count-1,'Undo works');
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true,bubbles:true,cancelable:true})));
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.historyIdx),count,'Redo works');

  // Share is handled by the browser when available, with a PNG File.
  await page.evaluate(()=>{
   navigator.canShare=()=>true;
   navigator.share=async ({files})=>{window.__paintShared=files[0]};
   document.querySelector('#shareBtn').click();
  });
  await page.waitForFunction(()=>!!window.__paintShared);
  assert.equal(await page.evaluate(()=>window.__paintShared.type),'image/png','Native share uses PNG');
  assert.deepEqual(errors,[],'No uncaught browser exceptions');
  process.stdout.write('PASS: startup, tabs, import, numbered labels, tab preview, text label, arrow endpoints, undo/redo, share\n');
 }finally{await browser.close()}
}
main().catch(error=>{console.error(error);process.exitCode=1});
