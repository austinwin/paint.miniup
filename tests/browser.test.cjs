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
  });
  const textField=page.locator('#textEntry');
  await textField.fill('Inspect valve');
  await textField.press('Enter');
  await page.keyboard.type('Check pressure');
  assert.deepEqual((await textField.inputValue()).split(String.fromCharCode(10)),['Inspect valve','Check pressure'],'Enter creates a new line');
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.objects.filter(x=>x.type==='text').length),0,'Enter does not finish text');
  await page.locator('#italicBtn').click();
  await page.locator('#underlineBtn').click();
  await page.locator('.text-align-btn[data-align="center"]').click();
  assert.equal(await page.evaluate(()=>getComputedStyle(document.querySelector('#textEntry')).display),'block','Formatting controls keep editor open');
  await page.locator('#finishTextBtn').click();
  const annotation=await page.evaluate(()=>window.PaintDebug.state.objects.find(x=>x.type==='text'));
  assert.equal(annotation.labelMode,'label','Editable label mode');
  assert.deepEqual(annotation.text.split(String.fromCharCode(10)),['Inspect valve','Check pressure'],'Multiline text saved');
  assert.equal(annotation.italic,true,'Italic text saved');
  assert.equal(annotation.underline,true,'Underline text saved');
  assert.equal(annotation.align,'center','Centered text saved');
  const countText=await page.evaluate(()=>window.PaintDebug.state.objects.filter(x=>x.type==='text').length);
  await page.evaluate(()=>{
   const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=window.PaintDebug.state.zoom;
   c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,pointerId:11,pointerType:'mouse',clientX:r.left+75*z,clientY:r.top+50*z}));
  });
  await textField.fill('Temporary');
  await page.locator('#cancelTextBtn').click();
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.objects.filter(x=>x.type==='text').length),countText,'Cancel discards pending text');
  await page.evaluate(()=>{
   const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=window.PaintDebug.state.zoom;
   c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,pointerId:12,pointerType:'mouse',clientX:r.left+70*z,clientY:r.top+48*z}));
  });
  await textField.fill('Finish by outside click');
  await page.evaluate(()=>document.querySelector('#docTitle').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,pointerId:22,pointerType:'mouse'})));
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.objects.filter(x=>x.type==='text').length),countText+1,'Clicking outside commits text');
  assert.equal(await page.evaluate(()=>document.querySelector('#textMoveHandle').hidden),true,'Move handle hides after committing');

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

  // Paint.NET-like Shapes tool: retain transform handles until Finish.
  const shapeResults=await page.evaluate(()=>{
   const st=window.PaintDebug.state,c=document.querySelector('#canvas');
   const rect=c.getBoundingClientRect(),z=st.zoom;
   function emit(type,x,y,id=70){
    c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,pointerId:id,pointerType:'mouse',clientX:rect.left+x*z,clientY:rect.top+y*z}));
   }
   function choose(kind){
    const select=document.querySelector('#shapeType');select.value=kind;
    select.dispatchEvent(new Event('change',{bubbles:true}));
   }
   window.PaintDebug.setTool('shape');choose('rectangle');
   emit('pointerdown',12,12);emit('pointermove',68,38);emit('pointerup',68,38);
   const shape=st.objects.at(-1),editSelected=st.selected===st.objects.length-1&&!document.querySelector('#finishShapeBtn').hidden;
   document.querySelector('#finishShapeBtn').click();
   const finished=st.selected===-1;
   choose('custom');
   for(const [x,y] of [[12,12],[46,10],[64,39],[20,47]])emit('pointerdown',x,y);
   const previews=st.polygonDraft?.points.length;
   document.querySelector('#finishShapeBtn').click();
   const polygon=st.objects.at(-1),polygonFinished=st.selected===-1;
   choose('customSmooth');
   const method=document.querySelector('#shapeMethod');method.value='trace';method.dispatchEvent(new Event('change',{bubbles:true}));
   emit('pointerdown',17,20,71);
   for(const [x,y] of [[30,11],[44,16],[65,29],[53,48],[32,53],[17,36]])emit('pointermove',x,y,71);
   emit('pointerup',17,36,71);
   const smooth=st.objects.at(-1);
   document.querySelector('#finishShapeBtn').click();
   window.PaintDebug.setTool('curve');
   const select=document.querySelector('#curveMode');select.value='bezier';select.dispatchEvent(new Event('change',{bubbles:true}));
   emit('pointerdown',12,55,72);emit('pointermove',78,55,72);emit('pointerup',78,55,72);
   const curve=st.objects.at(-1),before=curve.controls?.[0].y;
   const x=curve.controls[0].x,y=curve.controls[0].y;
   emit('pointerdown',x,y,73);emit('pointermove',x,y-18,73);emit('pointerup',x,y-18,73);
   const edited=st.objects.at(-1).controls[0].y;
   select.value='spline';select.dispatchEvent(new Event('change',{bubbles:true}));
   const spline=st.objects.at(-1).curveMode;
   document.querySelector('#finishShapeBtn').click();
   return{shapeType:shape.type,editSelected,finished,previews,polygonPoints:polygon.points?.length,polygonFinished,smoothType:smooth.type,smoothPoints:smooth.points?.length,smoothEnabled:smooth.smooth,curveType:curve.type,controls:curve.controls?.length,before,edited,spline,curveFinished:st.selected===-1};
  });
  assert.equal(shapeResults.shapeType,'shape','Shape created as an editable object');
  assert.ok(shapeResults.editSelected,'Shapes remain in handle-edit mode');
  assert.ok(shapeResults.finished,'Finish exits the edit mode');
  assert.equal(shapeResults.previews,4,'Arbitrary polygon collects clicked vertices');
  assert.ok(shapeResults.polygonPoints>=4&&shapeResults.polygonFinished,'Polygon is closed and committed');
  assert.equal(shapeResults.smoothType,'polygon','Freeform curve produces a polygon shape');
  assert.ok(shapeResults.smoothEnabled&&shapeResults.smoothPoints>=3,'Drag-traced freeform curve has a smooth closed outline');
  assert.equal(shapeResults.curveType,'curve','Curve object exists');
  assert.equal(shapeResults.controls,2,'Curve has both Bézier control nubs');
  assert.ok(shapeResults.edited<shapeResults.before-10,'Dragging control nub changes curvature');
  assert.equal(shapeResults.spline,'spline','Spline and Bézier modes can be switched on live curve');
  assert.ok(shapeResults.curveFinished,'Curve Finish exits live edit mode');

  // Undo / Redo after selection.
  const count=await page.evaluate(()=>window.PaintDebug.state.historyIdx);
  await page.evaluate(()=>{
   document.activeElement?.blur();
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}));
  });
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.historyIdx),count-1,'Undo works');
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true,bubbles:true,cancelable:true})));
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.historyIdx),count,'Redo works');

  // In-app copy/paste must preserve editable vector annotations.
  const copyResult=await page.evaluate(()=>{
   const st=window.PaintDebug.state;
   st.selected=st.objects.findIndex(x=>x.type==='arrow');
   const before=st.objects.length;
   document.querySelector('#copySelectionBtn').click();
   document.querySelector('#menuEdit').click();
   const paste=[...document.querySelectorAll('.menupopup button')].find(b=>b.textContent.includes('Paste Selection'));
   if(!paste)throw Error('Paste Selection menu item missing');
   paste.click();
   return{before,after:st.objects.length,type:st.objects.at(-1)?.type};
  });
  assert.equal(copyResult.after,copyResult.before+1,'Pasting should add a new annotation');
  assert.equal(copyResult.type,'arrow','Pasted object should remain an editable arrow');

  // Two fingers should pinch with Paintbrush selected without creating an unwanted stroke.
  const touchResult=await page.evaluate(()=>{
   window.PaintDebug.setTool('pen');
   const st=window.PaintDebug.state,canvas=document.querySelector('#canvas');
   const rect=canvas.getBoundingClientRect(),beforeZoom=st.zoom,beforeCount=st.objects.length;
   function fire(type,id,dx){
    canvas.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerType:'touch',
     button:0,buttons:type==='pointerup'?0:1,pointerId:id,clientX:rect.left+dx,clientY:rect.top+30}));
   }
   fire('pointerdown',41,30);fire('pointerdown',42,80);
   fire('pointermove',42,145);
   const zoomAfterPinch=st.zoom;
   fire('pointerup',42,145);fire('pointerup',41,30);
   return{beforeZoom,zoomAfterPinch,beforeCount,afterCount:st.objects.length};
  });
  assert.ok(touchResult.zoomAfterPinch>touchResult.beforeZoom,'Pinch should zoom with Paintbrush selected');
  assert.equal(touchResult.afterCount,touchResult.beforeCount,'Pinch must not leave an accidental stroke');

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
