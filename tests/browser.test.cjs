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
  // Shapes: tool click uses remembered preset and never opens the shape gallery.
  const defaultShape=await page.evaluate(()=>{
   const st=window.PaintDebug.state;
   const button=document.querySelector('.toolbutton[data-tool="shape"]'),gallery=document.querySelector('#shapeGallery');
   button.click();
   const before={tool:st.tool,kind:st.shapeKind,closed:gallery.hidden};
   const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=st.zoom;
   const fire=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,
    pointerId:301,pointerType:'mouse',clientX:r.left+x*z,clientY:r.top+y*z}));
   fire('pointerdown',36,36);fire('pointermove',120,90);fire('pointerup',120,90);
   return {...before,drawn:st.objects.at(-1)?.shapeKind,stillClosed:gallery.hidden};
  });
  assert.deepEqual(defaultShape,{tool:'shape',kind:'rectangle',closed:true,drawn:'rectangle',stillClosed:true},
   'Shapes defaults to Rectangle and draws immediately without opening gallery');

  await page.evaluate(()=>document.querySelector('#shapePickerTrigger').click());
  assert.equal(await page.locator('#shapeGallery').isVisible(),true,'Only explicit picker click opens gallery');
  await page.evaluate(()=>document.querySelector('.shape-gallery-option[data-kind="pentagon"]').click());
  const pickedShape=await page.evaluate(()=>{
   const st=window.PaintDebug.state;
   document.querySelector('.toolbutton[data-tool="pen"]').click();
   const closedAfterSwitch=document.querySelector('#shapeGallery').hidden;
   document.querySelector('.toolbutton[data-tool="shape"]').click();
   return{kind:st.shapeKind,choice:document.querySelector('#shapeType').value,
    label:document.querySelector('#selectedShapeName').textContent,closedAfterSwitch,
    closedOnReopen:document.querySelector('#shapeGallery').hidden};
  });
  assert.deepEqual(pickedShape,{kind:'pentagon',choice:'pentagon',label:'Pentagon',
   closedAfterSwitch:true,closedOnReopen:true},
   'Shapes returns to the last explicitly selected preset without gallery popping up');

  await page.reload({waitUntil:'load'});
  await page.waitForFunction(()=>window.PaintDebug?.state?.base?.width===1280);
  const persistedShape=await page.evaluate(()=>{
   document.querySelector('.toolbutton[data-tool="shape"]').click();
   return{kind:window.PaintDebug.state.shapeKind,
    closed:document.querySelector('#shapeGallery').hidden,
    stored:localStorage.getItem('paint-last-shape-v1')};
  });
  assert.deepEqual(persistedShape,{kind:'pentagon',closed:true,stored:'pentagon'},
   'Shape preset survives page reload while gallery remains closed');

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

  // Connector labels belong to the vector arrow and render during PNG export.
  const arrowCaption=await page.evaluate(()=>{
   window.PaintDebug.setTool('arrow');
   const field=document.querySelector('#lineCaption');field.value='Opens details';field.dispatchEvent(new Event('input',{bubbles:true}));field.dispatchEvent(new Event('change',{bubbles:true}));
   const st=window.PaintDebug.state,c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=st.zoom;
   const emit=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,pointerId:56,pointerType:'mouse',clientX:r.left+x*z,clientY:r.top+y*z}));
   emit('pointerdown',14,22);emit('pointermove',78,31);emit('pointerup',78,31);
   window.PaintDebug.composite();
   return{type:st.objects.at(-1).type,label:st.objects.at(-1).label};
  });
  assert.deepEqual(arrowCaption,{type:'arrow',label:'Opens details'},'Arrow label is editable and exported');

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

  // Sketch cleanup: opt-in classification preserves freehand drawings by default.
  const tidied=await page.evaluate(()=>{
   const p=(x,y)=>({x,y}),line=Array.from({length:20},(_,i)=>p(8+i*3,12+Math.sin(i)*.8));
   const rectangle=[...Array.from({length:10},(_,i)=>p(9+i*5,9)),...Array.from({length:8},(_,i)=>p(54,9+i*5)),...Array.from({length:10},(_,i)=>p(54-i*5,44)),...Array.from({length:8},(_,i)=>p(9,44-i*5)),p(9,9)];
   const ellipse=Array.from({length:40},(_,i)=>p(35+20*Math.cos(i*Math.PI*2/39),32+17*Math.sin(i*Math.PI*2/39)));
   const classify=pts=>window.PaintDebug.recognizeSketch({type:'brush-stroke',points:pts,width:3,color:'#333'})?.type;
   window.PaintDebug.setTool('pen');
   const toggle=document.querySelector('#shapeAssist');toggle.checked=true;toggle.dispatchEvent(new Event('change',{bubbles:true}));
   return{line:classify(line),rectangle:classify(rectangle),ellipse:classify(ellipse),enabled:window.PaintDebug.state.shapeAssist};
  });
  assert.deepEqual(tidied,{line:'line',rectangle:'rect',ellipse:'ellipse',enabled:true},'Conservative rough-shape cleanup');

  // Numbered callout and sticky note share the multiline text editor and remain editable.
  async function addNote(mode,x,y,message){
   await page.evaluate(({mode,x,y})=>{
    window.PaintDebug.setTool('note');
    const select=document.querySelector('#noteMode');select.value=mode;select.dispatchEvent(new Event('change',{bubbles:true}));
    const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=window.PaintDebug.state.zoom;
    c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,cancelable:true,button:0,buttons:1,pointerId:81,pointerType:'mouse',clientX:r.left+x*z,clientY:r.top+y*z}));
   },{mode,x,y});
   await page.locator('#textEntry').fill(message);
   await page.locator('#finishTextBtn').click();
  }
  await addNote('callout',18,22,'Click here to open settings');
  await addNote('sticky',19,44,'Keep this section simple');
  const notes=await page.evaluate(()=>window.PaintDebug.state.objects.filter(o=>o.noteStyle).map(o=>({style:o.noteStyle,number:o.noteNumber,anchor:o.noteAnchor,text:o.text})));
  assert.equal(notes[0].style,'callout','Callout created');
  assert.equal(notes[0].number,1,'Callout has automatic number');
  assert.deepEqual(notes[0].anchor,{x:18,y:22},'Marker attached to clicked point');
  assert.equal(notes[1].style,'sticky','Sticky created');
  assert.equal(notes[1].number,2,'Note numbering increments');

  // A numbered callout's marker can be retargeted without moving its text.
  const retargeted=await page.evaluate(()=>{
   const dbg=window.PaintDebug,st=dbg.state,i=st.objects.findIndex(o=>o.noteStyle==='callout');
   dbg.setTool('select');dbg.selectObjects([i]);
   const note=st.objects[i],beforeX=note.x,anchor={...note.noteAnchor};
   const c=document.querySelector('#canvas'),r=c.getBoundingClientRect(),z=st.zoom;
   const emit=(type,x,y)=>c.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,button:0,buttons:type==='pointerup'?0:1,pointerId:88,pointerType:'mouse',clientX:r.left+x*z,clientY:r.top+y*z}));
   emit('pointerdown',anchor.x,anchor.y);emit('pointermove',anchor.x+12,anchor.y+7);emit('pointerup',anchor.x+12,anchor.y+7);
   return{xUnchanged:st.objects[i].x===beforeX,anchorMoved:st.objects[i].noteAnchor.x===anchor.x+12&&st.objects[i].noteAnchor.y===anchor.y+7};
  });
  assert.ok(retargeted.xUnchanged&&retargeted.anchorMoved,'Move callout target independently of text');

  // Multi-select, group, nudge, duplicate and ungroup must operate on all selected objects.
  const multi=await page.evaluate(()=>{
   const dbg=window.PaintDebug,st=dbg.state,ids=st.objects.flatMap((o,i)=>o.noteStyle?[i]:[]);
   dbg.setTool('select');dbg.selectObjects(ids);
   document.querySelector('#groupObjectsBtn').click();
   const grouped=!!st.objects[ids[0]].groupId&&ids.every(i=>st.objects[i].groupId===st.objects[ids[0]].groupId);
   const before=ids.map(i=>st.objects[i].x);
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}));
   const moved=ids.every((i,j)=>st.objects[i].x===before[j]+1);
   const count=st.objects.length;
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'d',ctrlKey:true,bubbles:true,cancelable:true}));
   const duplicated=st.objects.length===count+2;
   document.dispatchEvent(new KeyboardEvent('keydown',{key:'g',ctrlKey:true,shiftKey:true,bubbles:true,cancelable:true}));
   const ungrouped=dbg.selectedIndexes().every(i=>!st.objects[i].groupId);
   return{grouped,moved,duplicated,ungrouped,count:dbg.selectedIndexes().length};
  });
  assert.ok(multi.grouped&&multi.moved&&multi.duplicated&&multi.ungrouped,'Editable multi-object grouping');
  assert.equal(multi.count,2,'Duplicated group stays selected');

  // Drag-and-drop screenshot creates a movable overlay, not a new document.
  const beforeDrop=await page.evaluate(()=>window.PaintDebug.state.objects.length);
  await page.evaluate(data=>{
   const bytes=Uint8Array.from(atob(data.split(',')[1]),c=>c.charCodeAt(0));
   const file=new File([bytes],'screenshot.png',{type:'image/png'}),dt=new DataTransfer();dt.items.add(file);
   document.querySelector('#workspace').dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:dt,clientX:100,clientY:100}));
  },dataURL);
  await page.waitForFunction(before=>window.PaintDebug.state.objects.length>before,beforeDrop);
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.objects.at(-1).type),'patch','Dropped screenshot overlays the canvas');


  // Layers: visibility, opacity, stacking, locking, move, duplicate, merge and solo.
  const layerResult=await page.evaluate(()=>{
   const dbg=window.PaintDebug;dbg.createBlank();
   const st=dbg.state,initial=st.layers.map(l=>({id:l.id,locked:l.locked}));
   const notes=dbg.addLayer('Notes');
   st.objects.push({type:'rect',layerId:'sketch',x1:15,y1:15,x2:55,y2:55,fillMode:'filled',fill:true,color:'#ff0000',width:2});
   st.objects.push({type:'rect',layerId:notes,x1:15,y1:15,x2:55,y2:55,fillMode:'filled',fill:true,color:'#0000ff',width:2});
   dbg.setLayerValue(notes,'opacity',100);
   const pixel=()=>[...dbg.composite().getContext('2d').getImageData(25,25,1,1).data];
   const top=pixel();
   dbg.setLayerValue(notes,'visible',false);const hidden=pixel();
   dbg.setLayerValue(notes,'visible',true);
   dbg.reorderLayer(notes,-1);const beneath=pixel();
   dbg.reorderLayer(notes,1);
   dbg.setLayerValue(notes,'opacity',50);const faded=pixel();
   dbg.setLayerValue(notes,'opacity',100);
   const blue=st.objects.findIndex(o=>o.color==='#0000ff');
   dbg.setLayerValue(notes,'locked',true);dbg.selectObjects([blue]);const blocked=st.selected===-1;
   dbg.setLayerValue(notes,'locked',false);dbg.selectObjects([blue]);const selectable=st.selected===blue;
   const moved=dbg.moveSelectionToLayer('sketch')&&st.objects[blue].layerId==='sketch';
   const duplicate=dbg.duplicateLayer('sketch');
   const copied=st.objects.filter(o=>o.layerId===duplicate).length===2;
   const merged=dbg.mergeLayerDown(duplicate)&&!st.layers.some(l=>l.id===duplicate)&&st.objects.filter(o=>o.layerId==='sketch').length===4;
   dbg.soloLayer('sketch');
   const isolated=dbg.composite().getContext('2d').getImageData(500,500,1,1).data[3]===0;
   dbg.soloLayer('sketch');
   dbg.setLayerValue('sketch','name','Wireframes');
   return{initial,notes,top,hidden,beneath,faded,blocked,selectable,moved,copied,merged,isolated,renamed:st.layers.find(l=>l.id==='sketch').name,historyIdx:st.historyIdx,panelHidden:document.querySelector('#panelLayers').classList.contains('hidden')};
  });
  assert.deepEqual(layerResult.initial,[{id:'background',locked:true},{id:'sketch',locked:false}],'Default sketch + locked background layers');
  assert.ok(layerResult.panelHidden,'Layers panel starts collapsed');
  assert.ok(layerResult.top[2]>220&&layerResult.top[0]<30,'Top layer determines composite color');
  assert.ok(layerResult.hidden[0]>220&&layerResult.hidden[2]<30,'Hidden layer absent from render');
  assert.ok(layerResult.beneath[0]>220&&layerResult.beneath[2]<30,'Layer reorder changes stacking');
  assert.ok(layerResult.faded[0]>60&&layerResult.faded[2]>60,'Group opacity renders through the compositor');
  assert.ok(layerResult.blocked&&layerResult.selectable,'Locked layers cannot be selected');
  assert.ok(layerResult.moved&&layerResult.copied&&layerResult.merged,'Move selection, duplicate and merge layers');
  assert.ok(layerResult.isolated,'Solo isolates layer contents without the background');
  assert.equal(layerResult.renamed,'Wireframes','Layer can be renamed');
  await page.evaluate(()=>{document.activeElement?.blur();document.dispatchEvent(new KeyboardEvent('keydown',{key:'z',ctrlKey:true,bubbles:true,cancelable:true}))});
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.layers.find(l=>l.id==='sketch').name),'Sketch','Undo restores layer metadata');
  await page.evaluate(()=>document.dispatchEvent(new KeyboardEvent('keydown',{key:'y',ctrlKey:true,bubbles:true,cancelable:true})));
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.layers.find(l=>l.id==='sketch').name),'Wireframes','Redo restores layer metadata');

  // Editable projects retain layer metadata when reopened from IndexedDB.
  await page.evaluate(()=>document.querySelector('#saveBtn').click());
  await page.locator('#projectSaveDialog').waitFor({state:'visible'});
  await page.locator('#projectNameInput').fill('Layer persistence regression');
  await page.locator('#confirmProjectSave').click();
  await page.waitForFunction(()=>!!window.PaintDebug.state.savedId&&!window.PaintDebug.state.dirty);
  const stored=await page.evaluate(()=>window.PaintDebug.state.savedId);
  await page.evaluate(()=>window.PaintDebug.createBlank());
  assert.ok(await page.evaluate(id=>window.PaintDebug.openProject(id),stored),'Saved layered image reopens');
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.layers.find(l=>l.id==='sketch')?.name),'Wireframes','Layers preserved in saved projects');
  assert.equal(await page.evaluate(()=>window.PaintDebug.state.objects.filter(o=>o.layerId==='sketch').length),4,'Layer object assignments preserved');


  // Extras menu exposes advanced actions without enlarging the everyday toolbar.
  await page.locator('#menuExtras').click();
  assert.ok((await page.locator('.menupopup:not([hidden]) .extras-heading').count())>=4,'Extras commands are grouped');
  assert.ok(await page.locator('.menupopup:not([hidden])').getByText('Export annotations (transparent PNG)').isVisible(),'Transparent export is discoverable');
  await page.locator('#menuExtras').click();

  const extraLayers=await page.evaluate(()=>{
   const api=window.PaintDebug;api.createBlank();const s=api.state;
   for(const [x,y,color] of [[10,10,'#cc0000'],[45,20,'#00cc00'],[105,35,'#0000cc']]){
    s.objects.push({type:'rect',layerId:'sketch',x1:x,y1:y,x2:x+20,y2:y+20,fill:true,fillMode:'filled',color,width:2});
   }
   api.setTool('select');api.selectObjects([0,1]);
   const target=api.selectionToNewLayer(false);
   const moved=s.objects.length===3&&s.objects[0].layerId===target&&s.objects[1].layerId===target&&s.objects[2].layerId==='sketch';
   const copyId=api.selectionToNewLayer(true);
   const copied=s.objects.length===5&&s.objects.filter(o=>o.layerId===copyId).length===2;
   api.layerToEdge('bottom');const bottom=s.layers[1].id===copyId;
   api.lockOtherLayers();const locked=s.layers.filter(l=>l.id!==copyId&&l.id!=='background').every(l=>l.locked);
   api.unlockDrawingLayers();const unlocked=s.layers.filter(l=>l.id!=='background').every(l=>!l.locked)&&s.layers[0].locked;
   api.setLayerValue(copyId,'visible',false);api.showAllLayers();
   const shown=s.layers.every(l=>l.visible)&&!s.soloLayerId;
   api.addLayer('Unused');
   const removed=api.removeEmptyLayers()>=1;
   const before=s.layers.length;const pair=api.prepareAnnotationLayers();
   const setup=pair.length===2&&s.layers.findIndex(l=>l.id===pair[1])>s.layers.findIndex(l=>l.id===pair[0]);
   api.prepareAnnotationLayers();const idempotent=s.layers.length===before+1;
   return {moved,copied,bottom,locked,unlocked,shown,removed,setup,idempotent,
    menuExists:!!document.querySelector('#menuExtras'),
    panelButtons:!!document.querySelector('#layerSelectionNew')&&!!document.querySelector('#layerSelectionCopy')};
  });
  for(const [key,value] of Object.entries(extraLayers))assert.ok(value,'Extras layer operation: '+key);

  const arranged=await page.evaluate(()=>{
   const api=window.PaintDebug;api.createBlank();const s=api.state;
   const geometries=[[10,50],[48,60],[110,85]];
   geometries.forEach(([x,y])=>s.objects.push({type:'rect',layerId:'sketch',x1:x,x2:x+20,y1:y,y2:y+20,color:'#333333',width:1,fill:false}));
   api.setTool('select');api.selectObjects([0,1,2]);
   const aligned=api.alignSelection('top')&&s.objects.every(o=>o.y1===50);
   const distributed=api.distributeSelection('horizontal');
   const centers=s.objects.map(o=>(o.x1+o.x2)/2);
   const evenlySpaced=distributed&&Math.abs((centers[1]-centers[0])-(centers[2]-centers[1]))<.0001;
   const compositePixel=[...api.composite().getContext('2d').getImageData(200,200,1,1).data];
   const toggled=api.toggleSketchGrid();
   const unchanged=[...api.composite().getContext('2d').getImageData(200,200,1,1).data].every((v,i)=>v===compositePixel[i]);
   const rgba=api.annotationsCanvas().getContext('2d').getImageData(200,200,1,1).data;
   const transparent=rgba[3]===0;
   return{aligned,evenlySpaced,toggled,unchanged,transparent};
  });
  for(const [key,value] of Object.entries(arranged))assert.ok(value,'Extras arrangement/export behavior: '+key);


  // Non-destructive canvas/image resize and edge expansion keep editability.
  const geom=await page.evaluate(()=>{
   const api=window.PaintDebug;api.createBlank();const st=api.state,old=st.base;
   st.objects.push({type:'text',layerId:'sketch',x:45,y:40,text:'Editable',fontSize:18,color:'#111111'});
   st.objects.push({type:'rect',layerId:'sketch',x1:100,y1:75,x2:180,y2:155,color:'#cc0000',width:2});
   const resized=api.changeCanvasGeometry(640,360,'resize')&&st.base.width===640&&st.objects[0].fontSize===9&&st.objects[1].x1===50&&st.objects.length===2;
   const canvasSize=api.changeCanvasGeometry(760,430,'canvas','center')&&st.objects[1].x1===110&&Math.abs(st.objects[1].y1-72.5)<.001;
   st.objects[1].x2=800;const expanded=api.expandCanvasToObjects([1])&&st.base.width>=832&&st.objects.length===2;
   return{resized,canvasSize,expanded,layer:st.layers[1].id,history:st.history.length};
  });
  assert.ok(geom.resized&&geom.canvasSize&&geom.expanded,'Canvas transforms preserve editability');
  assert.equal(geom.layer,'sketch','Resize keeps original layers');

  // Bind editable connectors to targets and follow movements automatically.
  const linked=await page.evaluate(()=>{
   const api=window.PaintDebug;api.createBlank();const st=api.state;
   st.objects.push({type:'rect',layerId:'sketch',x1:30,y1:40,x2:110,y2:115,color:'#2288dd',width:2});
   st.objects.push({type:'rect',layerId:'sketch',x1:340,y1:40,x2:440,y2:115,color:'#2288dd',width:2});
   st.objects.push({type:'arrow',layerId:'sketch',x1:110,y1:77,x2:340,y2:77,color:'#222222',width:3});
   api.setTool('select');api.selectObjects([0,1,2]);const success=api.attachSelection();
   const before=st.objects[2].x1;st.objects[0].x1+=60;st.objects[0].x2+=60;api.composite();
   const follows=st.objects[2].x1>before+40;
   api.selectObjects([2]);const detached=api.detachSelection()&&!st.objects[2].startAttachment&&!st.objects[2].endAttachment;
   return{success,follows,detached};
  });
  for(const [key,value] of Object.entries(linked))assert.ok(value,'Smart connections: '+key);

  // A screenshot region can be lifted with a separate editable background cover.
  const screenshot=await page.evaluate(()=>{
   const api=window.PaintDebug;api.createBlank();const st=api.state;
   st.marquee={kind:'rect',x1:30,y1:50,x2:180,y2:130};
   const copied=api.screenshotPiece('cut');
   const cover=st.objects.find(o=>o.type==='rect');
   const patch=st.objects.find(o=>o.type==='patch');
   const preserved=!!cover&&!!patch&&cover.layerId===patch.layerId&&st.layers.length===3;
   st.marquee={kind:'rect',x1:20,y1:20,x2:100,y2:80};const replaced=api.screenshotPiece('replace');
   const replacement=st.objects.at(-1);
   return{copied,preserved,replaced,editableText:replacement.type==='text',selected:st.selected===st.objects.length-1};
  });
  for(const [key,value] of Object.entries(screenshot))assert.ok(value,'Screenshot Pieces: '+key);

  // Idea Versions: independent editable alternatives, linked comparison, browser persistence.
  const variants=await page.evaluate(()=>{
   const api=window.PaintDebug;api.createBlank();const st=api.state;
   st.objects.push({type:'rect',layerId:'sketch',x1:5,y1:5,x2:65,y2:65,color:'#111111',width:2});
   const originalId=api.activeTabId;
   const optionA=api.createIdeaVersion();
   st.objects[0].color='#ee3344';
   const optionB=api.createIdeaVersion();
   st.objects[0].color='#3388ee';
   const versions=api.relatedVersions(),different=versions.length===3&&versions.map(v=>v.data.objects[0].color).join(',')==='#111111,#ee3344,#3388ee';
   const compare=api.versionComparisonCanvas();
   api.compareIdeaVersions();
   const cards=document.querySelectorAll('#ideaVersionList .version-card').length;
   document.querySelector('#closeVersionsBtn').click();
   return {optionA,optionB,different,cards,comparison:compare.width>1000&&compare.height>400,
    originalId,versionLabels:versions.map(v=>v.data.versionLabel)};
  });
  assert.ok(variants.optionA&&variants.optionB&&variants.different&&variants.comparison,'Idea versions are independent and comparable');
  assert.equal(variants.cards,3,'Comparison preview has all related versions');
  assert.deepEqual(variants.versionLabels,['Original','Option A','Option B'],'Version names are related');
  await page.evaluate(()=>document.querySelector('#saveBtn').click());
  await page.locator('#projectSaveDialog').waitFor({state:'visible'});
  await page.locator('#projectNameInput').fill('Comparison regression');
  await page.locator('#confirmProjectSave').click();
  await page.waitForFunction(()=>!!window.PaintDebug.state.savedId&&!window.PaintDebug.state.dirty);
  const versionProject=await page.evaluate(()=>window.PaintDebug.state.savedId);
  await page.evaluate(()=>{
   const api=window.PaintDebug,id=api.state.savedId;
   for(const tab of [...api.tabs].filter(t=>(t.id===api.activeTabId?api.state:t.document)?.savedId===id))api.closeTab(tab.id);
  });
  assert.ok(await page.evaluate(id=>window.PaintDebug.openProject(id),versionProject),'Reopen a versioned project from IndexedDB');
  assert.equal(await page.evaluate(()=>window.PaintDebug.relatedVersions().length),3,'All idea variants persist in one browser project');

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
