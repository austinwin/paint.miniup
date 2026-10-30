(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const el={canvas:$('#canvas'),stage:$('#canvasStage'),work:$('#workspace'),center:$('#canvasCenter'),empty:$('#emptyState'),file:$('#fileInput'),text:$('#textEntry'),toast:$('#toast')};
const ctx=el.canvas.getContext('2d');
const colors=['#e23535','#f28b27','#f3c335','#1eae73','#2176e3','#7a4edb','#222d3d','#ffffff','#63758b','#a5afbc','#f59db8','#171717','#000000','#10b981'];
const patchImages=new Map();
const icons={select:'select',wand:'wand',bucket:'bucket',picker:'picker',pencil:'pencil',pen:'pen',highlight:'highlight',arrow:'arrow',curve:'curve',line:'line',rect:'rectangle',ellipse:'circle',text:'text',redact:'redact',crop:'crop',erase:'eraser',shape:'shapes',zoom:'zoom',pan:'hand',icon:'sticker',clone:'clone',note:'text'};
const names={select:'Select / move',wand:'Magic Wand',bucket:'Fill Bucket',picker:'Color Picker',pencil:'Pencil',pen:'Paintbrush',highlight:'Highlighter',arrow:'Arrow',curve:'Curve',line:'Line',rect:'Rectangle',ellipse:'Circle',text:'Text',redact:'Redact',crop:'Crop',erase:'Eraser',shape:'Shapes',zoom:'Zoom',pan:'Pan',icon:'Icon',clone:'Clone Stamp',note:'Notes & callouts'};
const hints={select:'Tap an object to move it, or drag to select an area · Delete removes the selection',wand:'Tap matching pixels to select, then choose Delete',bucket:'Click an area to fill with the primary color. Shift reverses flood mode.',picker:'Click a pixel to sample its color into the color wheel.',pencil:'Draw a fine line with the selected thickness',pen:'Paint naturally with mouse, touch, or pen',highlight:'Drag to mark an area with transparency',arrow:'Drag to draw an arrow; start/end heads are configurable',curve:'Drag a line, then shape with two handles. Choose Bézier or Spline; Enter to finish',line:'Drag to draw a straight line',rect:'Drag to outline a rectangle',ellipse:'Drag to outline a circle or ellipse',text:'Click to type · Enter adds a line · drag the move handle · click outside to finish',redact:'Drag to cover sensitive content on export',crop:'Drag to choose the crop area, then Apply crop',erase:'Drag to erase pixels to transparency',shape:'Drag a preset, edit handles, press Enter to finish. Custom: click corners or trace a freeform shape.',zoom:'Click to zoom in, Alt-click or right-click to zoom out',pan:'Drag to pan the image without changing it',clone:'Select source with the button or Alt-click, then paint its pixels elsewhere.',icon:'Pick an emoji or Lucide icon, then insert it on the canvas',note:'Tap where an annotation belongs, then type. Numbered callouts and sticky notes stay editable.'};
const st={base:null,objects:[],tool:'select',color:'#e23535',width:4,fontSize:28,zoom:1,history:[],historyIdx:-1,selected:-1,draft:null,crop:null,pointer:null,dragging:false,moving:false,originalObject:null,modified:false,name:'untitled',firstDraw:true,savedId:null,dirty:false,fillShapes:false,fontFamily:'Arial',fontBold:false,fontItalic:false,fontUnderline:false,fontStrike:false,textAlign:'left',headSettings:{line:{start:'none',end:'none'},arrow:{start:'none',end:'arrow'},curve:{start:'none',end:'none'}},wandTolerance:24,wandMode:'contiguous',fillTolerance:20,fillMode:'contiguous',wand:null,transform:null,panning:null,marquee:null,selectionShape:'smart',shapeKind:'rectangle',shapeMethod:'corners',curveMode:'bezier',secondaryColor:'#ffffff',polygonDraft:null,freeformTracing:false,iconPreset:{family:'emoji',emoji:'⭐',name:'Star',size:72,color:'#e23535',stroke:2},lineStrokeStyle:'solid',lineCaption:'',shapeStrokeStyle:'solid',fillModeShape:'outline',brushSize:12,brushHardness:80,brushOpacity:100,nonBrushWidth:4,brushMode:'normal',brushSmoothing:35,brushPressure:false,airbrushDensity:50,eraserMode:'hard',highlighterOpacity:28,fillType:'solid',gradientMode:'linear',gradientEndColor:'#ffffff',lineMode:'straight',redactMode:'solid',redactStrength:12,cloneSource:null,clonePicking:false,polylineDraft:null,textMode:'plain',labelBackground:'#ffffff',labelBorder:true,noteMode:'callout',noteAnchor:null,noteNumber:null,multiSelection:[],guides:[],snapEnabled:true,shapeAssist:false,gridVisible:false,versionGroupId:null,versionLabel:null,versionProjectName:null,layers:null,activeLayerId:'sketch',soloLayerId:null};
let toastTimer;

// Multiple open images share drawing controls, but every tab owns its canvas,
// objects, undo/redo history, selection, viewport and save/dirty state.
const documentStateKeys=['base','objects','layers','activeLayerId','soloLayerId','gridVisible','versionGroupId','versionLabel','versionProjectName','history','historyIdx','name','savedId','dirty','revision','zoom',
 'selected','multiSelection','guides','objectMarquee','draft','crop','pointer','dragging','moving','originalObject','modified','wand',
 'transform','panning','marquee','polygonDraft','freeformTracing','polylineDraft','cloneSource','clonePicking','firstDraw'];
const openTabs=[];
let activeTabId=null,tabSerial=0,untitledSerial=0;
const activeTab=()=>openTabs.find(tab=>tab.id===activeTabId);
const stateForTab=tab=>tab.id===activeTabId?st:tab.document;
function stashActiveTab(){
 const tab=activeTab();
 if(!tab)return;
 tab.document=Object.fromEntries(documentStateKeys.map(key=>[key,st[key]]));
 tab.scrollLeft=el.work.scrollLeft;tab.scrollTop=el.work.scrollTop;
}
function paintTabThumbnail(canvas,data){
 const source=data?.base;if(!source)return;
 const g=canvas.getContext('2d'),scale=Math.min(canvas.width/source.width,canvas.height/source.height);
 const width=source.width*scale,height=source.height*scale;
 g.clearRect(0,0,canvas.width,canvas.height);g.fillStyle='#fff';
 g.fillRect(0,0,canvas.width,canvas.height);
 g.save();g.translate((canvas.width-width)/2,(canvas.height-height)/2);g.scale(scale,scale);
 renderLayered(g,data);
 g.restore();
}
function renderTabs(){
 const list=$('#documentTabList');if(!list)return;
 const focused=document.activeElement?.closest?.('.document-tab-main')?.dataset.tabId;
 list.replaceChildren();
 for(const tab of openTabs){
  const data=stateForTab(tab);
  if(!data?.base)continue;
  const active=tab.id===activeTabId;
  const frame=document.createElement('div');frame.className='document-tab'+(active?' active':'');
  const select=document.createElement('button');
  select.type='button';select.className='document-tab-main';select.dataset.tabId=String(tab.id);
  select.setAttribute('role','tab');select.setAttribute('aria-selected',String(active));
  select.setAttribute('aria-controls','canvasStage');select.tabIndex=active?0:-1;
  select.title=data.name+(data.dirty?' (unsaved changes)':'');
  // Cache previews per base canvas so a large image isn't downscaled on every edit.
  if(tab.thumbnailBase!==data.base||tab.thumbnailRevision!==data.revision){
   const preview=document.createElement('canvas');preview.width=58;preview.height=46;
   paintTabThumbnail(preview,data);
   tab.thumbnailUrl=preview.toDataURL('image/png');tab.thumbnailBase=data.base;tab.thumbnailRevision=data.revision;
  }
  const thumb=document.createElement('img');thumb.className='document-tab-preview';
  thumb.alt='';thumb.setAttribute('aria-hidden','true');thumb.src=tab.thumbnailUrl;
  const label=document.createElement('span');label.className='document-tab-name';label.textContent=data.name||'Untitled';
  select.append(thumb,label);
  if(data.dirty){const dot=document.createElement('span');dot.className='document-tab-dirty';dot.title='Unsaved changes';dot.setAttribute('aria-label','Unsaved changes');select.append(dot)}
  select.addEventListener('click',()=>activateTab(tab.id));
  const close=document.createElement('button');close.type='button';close.className='document-tab-close';
  close.textContent='×';close.title='Close '+data.name;close.setAttribute('aria-label','Close '+data.name);
  close.addEventListener('click',()=>closeTab(tab.id));
  frame.append(select,close);list.append(frame);
 }
 if(focused){const target=[...list.querySelectorAll('.document-tab-main')].find(node=>node.dataset.tabId===focused);if(target)target.focus({preventScroll:true})}
}
function activateTab(id){
 if(id===activeTabId)return;
 const next=openTabs.find(tab=>tab.id===id);
 if(!next?.document)return;
 if(activeTabId!==null){finishText(true);stashActiveTab()}
 for(const key of documentStateKeys)st[key]=next.document[key];
 activeTabId=id;
 // Never resume half-completed drags or transforms after switching images.
 st.pointer=null;st.dragging=false;st.moving=false;st.panning=null;st.transform=null;st.draft=null;
 sizeCanvas();
 el.work.scrollLeft=next.scrollLeft||0;el.work.scrollTop=next.scrollTop||0;
 updateContextOptions();updateUI();paint();renderLayersPanel();setHistoryButtons();refreshHistoryPanel();refreshDirtyStatus();
 const selected=$('#documentTabList .document-tab.active');
 if(selected)selected.scrollIntoView({block:'nearest',inline:'nearest'});
}
function closeTab(id){
 const index=openTabs.findIndex(tab=>tab.id===id);if(index<0)return;
 if(id===activeTabId)finishText(true);
 const tab=openTabs[index],data=stateForTab(tab);
 if(data.dirty&&!confirm('Close "'+data.name+'"? Unsaved changes in this tab will be lost.'))return;
 const replacement=openTabs[index+1]||openTabs[index-1]||null;
 openTabs.splice(index,1);
 if(id===activeTabId){
  activeTabId=null;
  if(replacement)activateTab(replacement.id);
  else createBlank();
 }else renderTabs();
}
function cycleTab(direction){
 if(openTabs.length<2)return;
 const index=openTabs.findIndex(tab=>tab.id===activeTabId);
 activateTab(openTabs[(index+direction+openTabs.length)%openTabs.length].id);
}
function newUntitledName(){untitledSerial++;return untitledSerial===1?'Untitled canvas':'Untitled '+untitledSerial}
$('#newTabBtn').addEventListener('click',()=>createBlank());
$('#documentTabList').addEventListener('keydown',event=>{
 const target=event.target.closest('.document-tab-main');if(!target)return;
 if(event.key==='ArrowLeft'||event.key==='ArrowRight'){
  event.preventDefault();
  cycleTab(event.key==='ArrowRight'?1:-1);
  $('#documentTabList .document-tab.active .document-tab-main')?.focus({preventScroll:true});
 }else if(event.key==='Delete'){
  event.preventDefault();closeTab(Number(target.dataset.tabId));
 }
});
function copyCanvas(source){let c=document.createElement('canvas');c.width=source.width;c.height=source.height;c.getContext('2d').drawImage(source,0,0);return c}
function copyObj(o){return JSON.parse(JSON.stringify(o))}

const BASE_LAYER='background';
function defaultLayers(){return[
 {id:'background',name:'Background',kind:'base',visible:true,locked:true,opacity:100},
 {id:'sketch',name:'Sketch',kind:'objects',visible:true,locked:false,opacity:100}]}
function ensureLayers(doc=st){
 if(!Array.isArray(doc.layers)||!doc.layers.length)doc.layers=defaultLayers();
 if(!doc.layers.some(l=>l.id==='background'))doc.layers.unshift(defaultLayers()[0]);
 if(!doc.layers.some(l=>l.id!=='background'))doc.layers.push(defaultLayers()[1]);
 if(!doc.layers.some(l=>l.id===doc.activeLayerId))doc.activeLayerId=doc.layers.find(l=>l.id!=='background').id;
 for(const o of doc.objects||[])if(!doc.layers.some(l=>l.id===o.layerId))o.layerId=doc.activeLayerId;
}
function layerById(id,doc=st){return(doc.layers||[]).find(l=>l.id===id)}
function activeLayer(){return layerById(st.activeLayerId)}
function layerVisible(layer,doc=st){return !!layer&&layer.visible!==false&&layer.opacity!==0&&(!doc.soloLayerId||doc.soloLayerId===layer.id)}
function layerEditable(id){const layer=layerById(id);return layerVisible(layer)&&!layer.locked}
function requireEditableLayer(){ensureLayers();if(layerEditable(st.activeLayerId))return true;toast('Choose a visible, unlocked layer to edit.');return false}
function orderedObjectEntries(doc=st,editableOnly=false){
 ensureLayers(doc);const rank=new Map(doc.layers.map((l,i)=>[l.id,i]));
 return (doc.objects||[]).map((object,index)=>({object,index})).filter(v=>{
  const l=layerById(v.object.layerId,doc);return layerVisible(l,doc)&&(!editableOnly||!l.locked);
 }).sort((a,b)=>rank.get(a.object.layerId)-rank.get(b.object.layerId)||a.index-b.index);
}
function renderLayered(g,doc=st,draft=null,options={}){
 ensureLayers(doc);syncConnections(doc);
 for(const layer of doc.layers){
  if(options.omitBackground&&layer.id===BASE_LAYER)continue;
  if(!layerVisible(layer,doc))continue;
  const objects=(doc.objects||[]).filter(o=>o.layerId===layer.id);if(draft&&doc.activeLayerId===layer.id)objects.push(draft);
  const opacity=Math.max(0,Math.min(1,Number(layer.opacity??100)/100));
  const buffered=opacity!==1||objects.some(o=>['eraser-stroke','erase-region'].includes(o.type));
  let target=g,temp=null;
  if(buffered){temp=document.createElement('canvas');temp.width=doc.base.width;temp.height=doc.base.height;target=temp.getContext('2d')}
  if(layer.id===BASE_LAYER)target.drawImage(doc.base,0,0);
  objects.forEach(o=>drawObject(target,o));
  if(temp){g.save();g.globalAlpha=opacity;g.drawImage(temp,0,0);g.restore()}
 }
}
function nextLayerId(){return'layer-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,7)}
function layerChanged(){st.selected=-1;st.multiSelection=[];snapshot();updateContextOptions();renderLayersPanel();paint()}
function addLayer(name='Layer',below=false){
 finishText(true);ensureLayers();const index=st.layers.findIndex(l=>l.id===st.activeLayerId);
 const layer={id:nextLayerId(),name,kind:'objects',visible:true,locked:false,opacity:100};
 st.layers.splice(Math.max(1,index+(below?0:1)),0,layer);st.activeLayerId=layer.id;layerChanged();return layer.id;
}
function activateLayer(id){ensureLayers();if(!layerById(id))return;finishText(true);st.activeLayerId=id;deselect();renderLayersPanel()}
function setLayerValue(id,key,value){
 const l=layerById(id);if(!l)return;
 if(key==='visible'||key==='locked')l[key]=!!value;
 else if(key==='opacity')l.opacity=Math.max(0,Math.min(100,Number(value)||0));
 else if(key==='name')l.name=String(value||'Layer').trim().slice(0,60)||'Layer';else return;
 layerChanged();
}
function reorderLayer(id,delta){
 const i=st.layers.findIndex(l=>l.id===id),next=i+delta;
 if(i<1||next<1||next>=st.layers.length)return;
 [st.layers[i],st.layers[next]]=[st.layers[next],st.layers[i]];snapshot();renderLayersPanel();paint();
}
function duplicateLayer(id=st.activeLayerId){
 const layer=layerById(id);if(!layer||id===BASE_LAYER)return null;
 const copy={...layer,id:nextLayerId(),name:layer.name+' copy',locked:false,visible:true};
 st.layers.splice(st.layers.indexOf(layer)+1,0,copy);
 const groups=new Map();let number=Math.max(0,...st.objects.filter(o=>o.noteStyle).map(o=>o.noteNumber||0));
 for(const o of st.objects.filter(o=>o.layerId===id)){
  const clone=copyObj(o);clone.objectId=objectId();clone.layerId=copy.id;if(clone.noteStyle)clone.noteNumber=++number;
  if(clone.groupId){if(!groups.has(clone.groupId))groups.set(clone.groupId,nextLayerId());clone.groupId=groups.get(clone.groupId)}
  st.objects.push(clone);
 }
 st.activeLayerId=copy.id;layerChanged();return copy.id;
}
function deleteLayer(id=st.activeLayerId){
 const l=layerById(id);if(!l||id===BASE_LAYER)return false;
 if(st.objects.some(o=>o.layerId===id)&&!confirm('Delete "'+l.name+'" and everything in it?'))return false;
 st.objects=st.objects.filter(o=>o.layerId!==id);st.layers=st.layers.filter(l=>l.id!==id);
 if(st.layers.length===1)st.layers.push({...defaultLayers()[1]});
 st.activeLayerId=st.layers.at(-1).id;if(st.soloLayerId===id)st.soloLayerId=null;
 layerChanged();return true;
}
function clearLayer(id=st.activeLayerId){
 const l=layerById(id);if(!l||l.id===BASE_LAYER||l.locked)return false;
 if(!st.objects.some(o=>o.layerId===id))return false;
 if(!confirm('Clear all contents of "'+l.name+'"?'))return false;
 st.objects=st.objects.filter(o=>o.layerId!==id);layerChanged();return true;
}
function moveSelectionToLayer(id){
 if(!layerEditable(id)){toast('Destination must be unlocked and visible.');return false}
 const indexes=selectedIndexes().filter(i=>layerEditable(st.objects[i].layerId));
 if(!indexes.length)return false;
 indexes.forEach(i=>st.objects[i].layerId=id);st.activeLayerId=id;
 snapshot();renderLayersPanel();paint();return true;
}
function selectLayerObjects(id=st.activeLayerId){
 if(!layerEditable(id)){toast('Unlock this layer to select its contents.');return}
 setTool('select');selectObjects(st.objects.flatMap((o,i)=>o.layerId===id&&!['eraser-stroke','erase-region','fill-region'].includes(o.type)?[i]:[]));renderLayersPanel();
}
function soloLayer(id=st.activeLayerId){st.soloLayerId=st.soloLayerId===id?null:id;deselect();renderLayersPanel();paint()}
function mergeLayerDown(id=st.activeLayerId){
 const i=st.layers.findIndex(l=>l.id===id),top=st.layers[i],below=st.layers[i-1];
 if(i<2||!top||!below||top.locked||below.locked||!layerVisible(top)||!layerVisible(below)||top.opacity!==100||below.opacity!==100){
  toast('Merge needs two visible, unlocked layers at 100% opacity.');return false}
 if(st.objects.some(o=>o.layerId===id&&['eraser-stroke','erase-region'].includes(o.type))){toast('Layer contains erasing. Flatten visible image to merge safely.');return false}
 const moving=st.objects.filter(o=>o.layerId===id);st.objects=st.objects.filter(o=>o.layerId!==id);
 moving.forEach(o=>{o.layerId=below.id;st.objects.push(o)});
 st.layers.splice(i,1);st.activeLayerId=below.id;st.soloLayerId=null;layerChanged();return true;
}



/* Sketch-first extras: power actions stay off the everyday drawing toolbar. */
function selectionToNewLayer(duplicate=false){
 finishText(true);ensureLayers();
 const ids=selectedIndexes().filter(i=>layerEditable(st.objects[i]?.layerId));
 if(!ids.length){toast('Select one or more unlocked objects first.');return null}
 const source=ids.map(i=>st.objects[i]),highest=Math.max(...source.map(o=>st.layers.findIndex(l=>l.id===o.layerId)));
 const layer={id:nextLayerId(),name:duplicate?'Copied selection':'Selected objects',kind:'objects',visible:true,locked:false,opacity:100};
 st.layers.splice(Math.max(1,highest+1),0,layer);
 if(duplicate){
  const groupMap=new Map();let number=Math.max(0,...st.objects.filter(o=>o.noteStyle).map(o=>o.noteNumber||0));
  const first=st.objects.length;
  for(const original of source){
   const copy=copyObj(original);copy.objectId=objectId();copy.layerId=layer.id;
   if(copy.noteStyle)copy.noteNumber=++number;
   if(copy.groupId){if(!groupMap.has(copy.groupId))groupMap.set(copy.groupId,nextLayerId());copy.groupId=groupMap.get(copy.groupId)}
   st.objects.push(copy);
  }
  st.multiSelection=source.map((_,i)=>first+i);st.selected=st.multiSelection.at(-1);
 }else{
  ids.forEach(i=>st.objects[i].layerId=layer.id);
 }
 st.activeLayerId=layer.id;snapshot();updateContextOptions();renderLayersPanel();paint();
 toast(duplicate?'Copied selection to a new layer.':'Moved selection to a new layer.');
 return layer.id;
}
function layerToEdge(edge){
 ensureLayers();const idx=st.layers.findIndex(l=>l.id===st.activeLayerId);
 if(idx<1)return false;
 const next=edge==='top'?st.layers.length-1:1;if(idx===next)return false;
 const [layer]=st.layers.splice(idx,1);st.layers.splice(next,0,layer);
 snapshot();renderLayersPanel();paint();return true;
}
function lockOtherLayers(){
 ensureLayers();let changed=false;
 for(const layer of st.layers){if(layer.id===st.activeLayerId||layer.id===BASE_LAYER)continue;if(!layer.locked){layer.locked=true;changed=true}}
 if(changed){snapshot();renderLayersPanel();paint()}toast('Other drawing layers locked.');return changed;
}
function unlockDrawingLayers(){
 ensureLayers();let changed=false;
 for(const layer of st.layers){if(layer.id===BASE_LAYER)continue;if(layer.locked){layer.locked=false;changed=true}}
 if(changed){snapshot();renderLayersPanel();paint()}toast('Drawing layers unlocked (background stays protected).');return changed;
}
function showAllLayers(){
 ensureLayers();let changed=!!st.soloLayerId;st.soloLayerId=null;
 for(const layer of st.layers)if(!layer.visible){layer.visible=true;changed=true}
 if(changed){snapshot();renderLayersPanel();paint()}return changed;
}
function removeEmptyLayers(){
 ensureLayers();const ids=new Set(st.objects.map(o=>o.layerId));
 const before=st.layers.length;
 st.layers=st.layers.filter(l=>l.id===BASE_LAYER||l.id==='sketch'||ids.has(l.id));
 const count=before-st.layers.length;
 if(!count){toast('No empty layers to remove.');return 0}
 if(!st.layers.some(l=>l.id===st.activeLayerId))st.activeLayerId=st.layers.at(-1).id;
 if(st.soloLayerId&&!st.layers.some(l=>l.id===st.soloLayerId))st.soloLayerId=null;
 snapshot();renderLayersPanel();paint();toast('Removed '+count+' empty layer'+(count!==1?'s':''));return count;
}
function prepareAnnotationLayers(){
 ensureLayers();finishText(true);
 const find=name=>st.layers.find(l=>l.id!==BASE_LAYER&&l.name.toLowerCase()===name.toLowerCase());
 let sketch=find('Sketch')||st.layers.find(l=>l.id==='sketch'),notes=find('Notes');
 let changed=false;
 if(!sketch){sketch={id:nextLayerId(),name:'Sketch',kind:'objects',visible:true,locked:false,opacity:100};st.layers.push(sketch);changed=true}
 if(!notes){notes={id:nextLayerId(),name:'Notes',kind:'objects',visible:true,locked:false,opacity:100};st.layers.push(notes);changed=true}
 if(st.layers.indexOf(notes)<st.layers.indexOf(sketch)){
  st.layers.splice(st.layers.indexOf(notes),1);st.layers.splice(st.layers.indexOf(sketch)+1,0,notes);changed=true;
 }
 if(sketch.locked||!sketch.visible){sketch.locked=false;sketch.visible=true;changed=true}
 st.activeLayerId=sketch.id;
 if(changed)snapshot();
 renderLayersPanel();paint();toast('Ready: Sketch below Notes. Draw freely and add callouts.');return [sketch.id,notes.id];
}
function alignSelection(mode){
 const ids=selectedIndexes().filter(i=>layerEditable(st.objects[i]?.layerId));
 if(ids.length<2){toast('Select at least two editable objects.');return false}
 const bounds=ids.map(i=>({i,b:getBounds(st.objects[i])}));
 const xs=bounds.map(x=>x.b.x),ys=bounds.map(x=>x.b.y);
 const rights=bounds.map(x=>x.b.x+x.b.w),bottoms=bounds.map(x=>x.b.y+x.b.h);
 const centerXs=bounds.map(x=>x.b.x+x.b.w/2),centerYs=bounds.map(x=>x.b.y+x.b.h/2);
 let t=0;
 if(mode==='left')t=Math.min(...xs);
 if(mode==='center')t=(Math.min(...xs)+Math.max(...rights))/2;
 if(mode==='right')t=Math.max(...rights);
 if(mode==='top')t=Math.min(...ys);
 if(mode==='middle')t=(Math.min(...ys)+Math.max(...bottoms))/2;
 if(mode==='bottom')t=Math.max(...bottoms);
 const horizontal=['left','center','right'].includes(mode);
 let moved=false;
 bounds.forEach(({i,b})=>{
  let dx=0,dy=0;
  if(horizontal)dx=t-(mode==='left'?b.x:mode==='center'?b.x+b.w/2:b.x+b.w);
  else dy=t-(mode==='top'?b.y:mode==='middle'?b.y+b.h/2:b.y+b.h);
  if(Math.abs(dx)>0.01||Math.abs(dy)>0.01){moveObject(st.objects[i],Math.round(dx*100)/100,Math.round(dy*100)/100);moved=true}
 });
 if(moved){snapshot();paint()}return moved;
}
function distributeSelection(axis){
 const ids=selectedIndexes().filter(i=>layerEditable(st.objects[i]?.layerId));
 if(ids.length<3){toast('Select three or more objects to distribute.');return false}
 const xAxis=axis==='horizontal',middle=b=>xAxis?b.x+b.w/2:b.y+b.h/2;
 const items=ids.map(i=>({i,b:getBounds(st.objects[i])})).sort((a,b)=>middle(a.b)-middle(b.b));
 const first=middle(items[0].b),last=middle(items.at(-1).b);
 if(last-first<1)return false;
 let changed=false;
 items.slice(1,-1).forEach(({i,b},offset)=>{
  const delta=first+(last-first)*(offset+1)/(items.length-1)-middle(b);
  if(Math.abs(delta)>.01){moveObject(st.objects[i],xAxis?delta:0,xAxis?0:delta);changed=true}
 });
 if(changed){snapshot();paint()}return changed;
}
function toggleSketchGrid(){
 st.gridVisible=!st.gridVisible;paint();toast(st.gridVisible?'Grid shown (not included in export).':'Grid hidden.');return st.gridVisible;
}
function renderSketchGrid(){
 if(!st.gridVisible||!st.base)return;
 const step=32, w=st.base.width,h=st.base.height;
 ctx.save();ctx.strokeStyle='rgba(67,105,151,.20)';ctx.lineWidth=.8/Math.max(st.zoom,.05);
 ctx.beginPath();
 for(let x=step;x<w;x+=step){ctx.moveTo(x,0);ctx.lineTo(x,h)}
 for(let y=step;y<h;y+=step){ctx.moveTo(0,y);ctx.lineTo(w,y)}
 ctx.stroke();ctx.restore();
}
function saveCanvasPNG(can,suffix){
 can.toBlob(blob=>{
  if(!blob){toast('PNG export failed.');return}
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=safeFilename()+suffix+'.png';document.body.appendChild(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),2000);toast('PNG exported.');
 },'image/png');
}
function exportSelectionPNG(){
 finishText(true);const can=selectedPixelsCanvas();
 if(!can){toast('Select an object or area first.');return false}
 saveCanvasPNG(can,'-selection');return true;
}
function annotationsCanvas(){
 const can=document.createElement('canvas');can.width=st.base.width;can.height=st.base.height;
 renderLayered(can.getContext('2d'),st,null,{omitBackground:true});
 return can;
}
function exportTransparentAnnotations(){
 if(!st.base)return;finishText(true);
 if(!st.objects.some(o=>o.layerId!==BASE_LAYER&&layerVisible(layerById(o.layerId)))){toast('No visible annotations to export.');return false}
 saveCanvasPNG(annotationsCanvas(),'-transparent-annotations');return true;
}

function renderLayersPanel(){
 const list=$('#layerList');if(!list||!st.base)return;ensureLayers();list.replaceChildren();
 for(const layer of [...st.layers].reverse()){
  const row=document.createElement('div');
  row.className='layer-row'+(layer.id===st.activeLayerId?' active':'')+(layer.locked?' locked':'');
  row.dataset.layerId=layer.id;
  const eye=document.createElement('button');eye.type='button';eye.className='layer-icon';
  eye.title=layer.visible?'Hide layer':'Show layer';eye.setAttribute('aria-label',eye.title+' '+layer.name);eye.textContent=layer.visible?'◉':'○';
  eye.onclick=()=>setLayerValue(layer.id,'visible',!layer.visible);
  const label=document.createElement('button');label.type='button';label.className='layer-name';label.textContent=layer.name;
  label.title='Click to activate · Double-click to rename';label.onclick=()=>activateLayer(layer.id);
  label.ondblclick=()=>{
   const input=document.createElement('input');input.type='text';input.maxLength=60;input.value=layer.name;input.className='layer-rename';label.replaceWith(input);input.focus();input.select();
   input.onblur=()=>{if(layer.name!==input.value.trim())setLayerValue(layer.id,'name',input.value);else renderLayersPanel()};
   input.onkeydown=e=>{if(e.key==='Enter')input.blur();if(e.key==='Escape'){input.value=layer.name;input.blur()}};
  };
  const count=document.createElement('span');count.className='layer-count';count.textContent=layer.id===BASE_LAYER?'IMG':String(st.objects.filter(o=>o.layerId===layer.id).length);
  const lock=document.createElement('button');lock.type='button';lock.className='layer-icon';
  lock.title=layer.locked?'Unlock layer':'Lock layer';lock.setAttribute('aria-label',lock.title+' '+layer.name);lock.textContent=layer.locked?'🔒':'🔓';
  lock.onclick=()=>setLayerValue(layer.id,'locked',!layer.locked);
  row.append(eye,label,count,lock);row.onclick=e=>{if(e.target===row)activateLayer(layer.id)};
  row.draggable=layer.id!==BASE_LAYER;
  row.ondragstart=e=>{e.dataTransfer.setData('text/x-paint-layer',layer.id);e.dataTransfer.effectAllowed='move'};
  row.ondragover=e=>{if([...e.dataTransfer.types].includes('text/x-paint-layer'))e.preventDefault()};
  row.ondrop=e=>{const from=e.dataTransfer.getData('text/x-paint-layer'),si=st.layers.findIndex(l=>l.id===from),di=st.layers.findIndex(l=>l.id===layer.id);
   if(si<1||di<1||si===di)return;e.preventDefault();e.stopPropagation();
   const moved=st.layers.splice(si,1)[0];st.layers.splice(di,0,moved);snapshot();paint();renderLayersPanel()};
  list.append(row);
 }
 const layer=activeLayer(),i=st.layers.indexOf(layer);
 $('#layersActiveName').textContent=layer?.name||'None';
 $('#layerOpacity').value=layer?.opacity??100;$('#layerOpacityValue').textContent=(layer?.opacity??100)+'%';
 $('#layerOpacity').disabled=!layer;
 $('#layerUp').disabled=!layer||i>=st.layers.length-1||i===0;
 $('#layerDown').disabled=!layer||i<2;
 $('#layerDuplicate').disabled=!layer||i===0;
 $('#layerDelete').disabled=!layer||i===0;
 $('#layerClear').disabled=!layer||i===0||layer.locked||!st.objects.some(o=>o.layerId===layer.id);
 $('#layerMerge').disabled=!layer||i<2||layer.locked||st.layers[i-1]?.locked;
 $('#layerSolo').setAttribute('aria-pressed',String(st.soloLayerId===layer?.id));
 $('#layerSolo').textContent=st.soloLayerId===layer?.id?'Show all':'Solo';
 $('#layerSelect').disabled=!layerEditable(st.activeLayerId);
 const picker=$('#layerMoveTarget'),prior=picker.value;picker.replaceChildren();
 for(const to of st.layers.filter(l=>layerEditable(l.id)&&l.id!==st.activeLayerId)){
  const option=document.createElement('option');option.value=to.id;option.textContent=to.name;picker.append(option);
 }
 if([...picker.children].some(o=>o.value===prior))picker.value=prior;
 $('#layerMoveSelection').disabled=!selectedIndexes().length||!picker.children.length;
 $('#layerSelectionNew').disabled=!selectedIndexes().length;$('#layerSelectionCopy').disabled=!selectedIndexes().length;
 $('#layerStatus').textContent=st.layers.length+' layers · drag rows to reorder · double-click to rename';
}
function connectLayerControls(){
 $('#layersToggleBtn').onclick=()=>togglePanel('panelLayers');
 $('#layerAdd').onclick=()=>addLayer();
 $('#layerAddBelow').onclick=()=>addLayer('Layer',true);
 $('#layerRename').onclick=()=>{const l=activeLayer();if(!l)return;const name=prompt('Rename layer',l.name);if(name!==null)setLayerValue(l.id,'name',name)};
 $('#layerUp').onclick=()=>reorderLayer(st.activeLayerId,1);
 $('#layerDown').onclick=()=>reorderLayer(st.activeLayerId,-1);
 $('#layerDuplicate').onclick=()=>duplicateLayer();
 $('#layerDelete').onclick=()=>deleteLayer();
 $('#layerClear').onclick=()=>clearLayer();
 $('#layerSelect').onclick=()=>selectLayerObjects();
 $('#layerSolo').onclick=()=>soloLayer();
 $('#layerMerge').onclick=()=>mergeLayerDown();
 $('#layerMoveSelection').onclick=()=>moveSelectionToLayer($('#layerMoveTarget').value);
 $('#layerSelectionNew').onclick=()=>selectionToNewLayer(false);$('#layerSelectionCopy').onclick=()=>selectionToNewLayer(true);
 $('#layerOpacity').oninput=e=>{const layer=activeLayer();if(!layer)return;layer.opacity=Number(e.target.value);$('#layerOpacityValue').textContent=layer.opacity+'%';paint()};
 $('#layerOpacity').onchange=()=>{snapshot();renderLayersPanel();paint()};
}

function snapshot(){if(!st.base)return;ensureLayers();syncConnections();st.revision=(st.revision||0)+1;st.history=st.history.slice(0,st.historyIdx+1);st.history.push({base:st.base,objects:copyObj(st.objects),layers:copyObj(st.layers),activeLayerId:st.activeLayerId,name:st.name});if(st.history.length>50)st.history.shift();st.historyIdx=st.history.length-1;setHistoryButtons();refreshHistoryPanel();st.dirty=true;refreshDirtyStatus();renderLayersPanel()}
function restore(index){if(index<0||index>=st.history.length)return;finishText(true);st.historyIdx=index;let s=st.history[index];st.base=s.base;st.objects=copyObj(s.objects);st.layers=copyObj(s.layers||defaultLayers());st.activeLayerId=s.activeLayerId||'sketch';st.soloLayerId=null;ensureLayers();st.name=s.name;st.selected=-1;st.multiSelection=[];st.guides=[];st.crop=null;st.draft=null;st.dragging=false;st.wand=null;st.transform=null;st.marquee=null;st.polygonDraft=null;st.revision=(st.revision||0)+1;sizeCanvas();updateUI();paint();setHistoryButtons();updateContextOptions();renderLayersPanel();renderTabs()}
function setHistoryButtons(){$('#undoBtn').disabled=st.historyIdx<=0;$('#redoBtn').disabled=st.historyIdx>=st.history.length-1}
function toast(msg){clearTimeout(toastTimer);el.toast.textContent=msg;el.toast.classList.add('show');toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2900)}
function updateUI(){const loaded=!!st.base;el.empty.style.display=loaded?'none':'flex';el.stage.style.display=loaded?'block':'none';$('#docTitle').textContent=loaded?st.name:'Untitled canvas';document.title=loaded?st.name+' — Paint':'Paint — Image editor';$('#statusDimensions').textContent=loaded?`${st.base.width} × ${st.base.height} px`:'No image loaded';$('#statusTool').textContent=loaded?`${names[st.tool]} tool`:'Ready';$('#statusObjects').textContent=`${st.objects.filter(o=>!['erase-region','eraser-stroke','fill-region'].includes(o.type)).length} annotations`;$('#statusZoom').textContent=`${Math.round(st.zoom*100)}%`;$('#toolZoomValue').textContent=`${Math.round(st.zoom*100)}%`;$('#cropbar').style.display=st.crop?'flex':'none';if(st.crop)$('#cropReadout').textContent=`${Math.round(Math.abs(st.crop.x2-st.crop.x1))} × ${Math.round(Math.abs(st.crop.y2-st.crop.y1))} px`}
function sizeCanvas(){if(!st.base)return;el.canvas.width=st.base.width;el.canvas.height=st.base.height;el.canvas.style.width=Math.round(st.base.width*st.zoom)+'px';el.canvas.style.height=Math.round(st.base.height*st.zoom)+'px';el.stage.style.width=Math.round(st.base.width*st.zoom)+'px';el.stage.style.height=Math.round(st.base.height*st.zoom)+'px';syncTextEditorLayout()}
function fitZoom(){
 if(!st.base)return;
 // Floating panels overlay the image; don't reserve their width twice.
 const availW=Math.max(64,el.work.clientWidth-24),availH=Math.max(64,el.work.clientHeight-24);
 st.zoom=Math.max(.02,Math.min(2,availW/st.base.width,availH/st.base.height));
 sizeCanvas();updateUI();paint();
}
function zoomBy(factor){if(!st.base)return;st.zoom=Math.max(.02,Math.min(8,st.zoom*factor));sizeCanvas();updateUI();paint()}
function zoomAt(factor,clientX,clientY){if(!st.base)return;const r=el.canvas.getBoundingClientRect(),x=(clientX-r.left)/st.zoom,y=(clientY-r.top)/st.zoom;const next=Math.max(.02,Math.min(8,st.zoom*factor));if(next===st.zoom)return;st.zoom=next;sizeCanvas();updateUI();paint();const after=el.canvas.getBoundingClientRect();el.work.scrollLeft+=after.left+x*next-clientX;el.work.scrollTop+=after.top+y*next-clientY}
function updateContextOptions(){const obj=st.objects[st.selected];const lineObj=obj&&['line','arrow','curve'].includes(obj.type);const shapeObj=obj&&['rect','ellipse','shape','polygon'].includes(obj.type);const opts=['line','arrow','curve'].includes(st.tool)||lineObj;$('#lineOptions').hidden=!opts;$('#wandOptions').hidden=st.tool!=='wand';$('#eraserOptions').hidden=st.tool!=='erase';$('#highlighterOptions').hidden=st.tool!=='highlight';$('#redactOptions').hidden=st.tool!=='redact';$('#cloneOptions').hidden=st.tool!=='clone';$('#lineModeWrap').hidden=st.tool!=='line';$('#finishPolylineBtn').hidden=!(st.tool==='line'&&st.lineMode==='polyline'&&!!st.polylineDraft);
 $('#curveModeWrap').hidden=st.tool!=='curve'&&obj?.type!=='curve';
 $('#curveMode').value=obj?.type==='curve'?(obj.curveMode||'bezier'):st.curveMode;
 const canFinish=(st.tool==='shape'&&((obj&&['shape','polygon'].includes(obj.type))||!!st.polygonDraft))||(st.tool==='curve'&&obj?.type==='curve');
 $('#finishShapeBtn').hidden=!canFinish;
 $('#shapeMethodWrap').hidden=st.tool!=='shape'||!['custom','customSmooth'].includes(st.shapeKind);
 $('#shapeMethod').value=st.shapeMethod;$('#shapeFillColorWrap').hidden=!(st.tool==='shape'&&(obj?.fillMode||st.fillModeShape)==='filledOutline');$('#shapeFillColor').value=st.secondaryColor;
 $('#shapeEditingHint').hidden=!canFinish;$('#gradientSettings').hidden=!(st.tool==='bucket'&&st.fillType==='gradient');$('#redactStrengthWrap').hidden=st.redactMode==='solid';$('#cloneSourceStatus').textContent=st.clonePicking?'Tap source on image':st.cloneSource?'Source set · draw to clone':'Select a source first';$('#zoomOptions').hidden=st.tool!=='zoom';$('#selectionShapeOptions').hidden=st.tool!=='select';$('#iconOptions').hidden=!(st.tool==='icon'||obj?.type==='icon');$('#fillOptions').hidden=st.tool!=='bucket';const selectedBrush=obj?.type==='brush-stroke';$('#strokeOptions').hidden=!(st.tool==='pen'||(['highlight','line','curve','arrow','rect','ellipse','shape','erase','redact'].includes(st.tool))||(obj&&obj.type!=='patch'&&obj.type!=='pencilpath'));$('#brushOptions').hidden=!(st.tool==='pen'||st.tool==='pencil'||selectedBrush);$('#sketchCleanupWrap').hidden=!['pen','pencil'].includes(st.tool);$('#shapeAssist').checked=st.shapeAssist;$('#brushMode').value=st.brushMode;$('#pencilInfo').hidden=st.tool!=='pencil';if(st.tool==='pen'||selectedBrush){const hard=selectedBrush?obj.hardness??80:st.brushHardness,opacity=selectedBrush?obj.opacity??100:st.brushOpacity;$('#brushHardness').value=hard;$('#brushHardnessValue').textContent=hard+'%';$('#brushOpacity').value=opacity;$('#brushOpacityValue').textContent=opacity+'%';$('#brushMode').value=st.brushMode;$('#brushSmoothing').value=String(st.brushSmoothing);$('#brushPressure').checked=st.brushPressure;$('#airbrushDensityWrap').hidden=st.brushMode!=='airbrush';$('#airbrushDensity').value=String(st.airbrushDensity);$('#airbrushDensityValue').textContent=st.airbrushDensity+'%'}$('#fontPack').hidden=!(['text','note'].includes(st.tool)||obj?.type==='text'||el.text.style.display==='block');$('#noteOptions').hidden=st.tool!=='note'&&!(obj?.noteStyle);$('#noteMode').value=obj?.noteStyle||st.noteMode;updateTextOptions();const showFill=['rect','ellipse','shape'].includes(st.tool)||!!shapeObj;$('#fillShape').hidden=!showFill;document.querySelector('label[for=fillShape]').hidden=!showFill;$('#borderStyle').hidden=!showFill;$('#borderStyleLabel').hidden=!showFill;$('#shapeOptions').hidden=st.tool!=='shape'&&!(obj&&['shape','polygon'].includes(obj.type));if(obj?.type==='shape')$('#shapeType').value=obj.shapeKind||'rectangle';else $('#shapeType').value=st.shapeKind;if(window.__paintShapePickerSync)window.__paintShapePickerSync();$('#objectOptions').hidden=!(obj&&st.tool==='select');if(opts){$('#lineCaption').value=lineObj?(obj.label||''):st.lineCaption;$('#lineStyle').value=lineObj?(obj.strokeStyle||'solid'):st.lineStrokeStyle;$('#startHead').value=lineObj?(obj.startHead||'none'):st.headSettings[st.tool]?.start||'none';$('#endHead').value=lineObj?(obj.endHead||(obj.type==='arrow'?'arrow':'none')):(st.headSettings[st.tool]?.end||'none')}if(showFill){$('#borderStyle').value=shapeObj?(obj.strokeStyle||'solid'):st.shapeStrokeStyle;$('#fillShape').value=shapeObj?(obj.fillMode||(obj.fill?'filled':'outline')):st.fillModeShape}if(obj){$('#objectRotation').value=Math.round((obj.rotation||0)*180/Math.PI)}const count=selectedIndexes().length;
 $('#groupObjectsBtn').hidden=count<2;$('#ungroupObjectsBtn').hidden=!selectedIndexes().some(i=>st.objects[i]?.groupId);
 const has=!!st.wand||!!st.marquee||st.selected>=0;$('#selectionActions').hidden=!has}

function updateTextOptions(){
 const show=['text','note'].includes(st.tool)||st.objects[st.selected]?.type==='text'||el.text.style.display==='block';
 $('#textMode').value=st.textMode;
 $('#textLabelStyle').hidden=!show||st.textMode!=='label';
 $('#textBorderStyle').hidden=!show||st.textMode!=='label';
 for(const [id,active] of [['boldBtn',st.fontBold],['italicBtn',st.fontItalic],['underlineBtn',st.fontUnderline],['strikeBtn',st.fontStrike]])$('#'+id).setAttribute('aria-pressed',String(!!active));
 $$('.text-align-btn').forEach(btn=>btn.setAttribute('aria-pressed',String(btn.dataset.align===st.textAlign)));
 const editing=el.text.style.display==='block';
 $('#finishTextBtn').hidden=!editing;$('#cancelTextBtn').hidden=!editing;
}
function setTool(t){finishText(true);if(!names[t])return;window.__paintShapePickerClose?.();if(st.polygonDraft)finishPolygon();if(st.polylineDraft)finishPolyline();st.freeformTracing=false;st.tool=t;if(t==='pen')st.width=st.brushSize;else if(t==='pencil')st.width=1;else if(t!=='select')st.width=st.nonBrushWidth;$('#topWidth').value=st.width;$('#topWidthValue').value=st.width;$('#inspectorWidth').value=Math.min(40,st.width);$('#widthBadge').textContent=st.width+' px';if(t==='erase'&&st.width<10&&!st.hasSetEraserWidth){st.width=20;st.hasSetEraserWidth=true;$('#topWidth').value=20;$('#topWidthValue').value=20;$('#inspectorWidth').value=20;$('#widthBadge').textContent='20 px'}st.selected=-1;st.multiSelection=[];st.guides=[];st.crop=null;st.draft=null;st.transform=null;st.polygonDraft=null;st.polylineDraft=null;$$('.toolbutton').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('#activeToolIcon').setAttribute('href','#i-'+icons[t]);$('#activeToolLabel').textContent=names[t];$('#activeToolTrigger').setAttribute('aria-label',names[t]+' — Open Tools window');$('#toolHint').textContent=hints[t];$('#selectedToolText').textContent=names[t];$('#toolDescription').textContent=hints[t];el.canvas.style.cursor=t==='select'?'crosshair':t==='erase'?'crosshair':t==='pan'?'grab':t==='zoom'?'zoom-in':'crosshair';updateContextOptions();updateUI();paint()}
function setColor(color){st.color=color;$('#topColor').value=color;if(el.text.style.display==='block')el.text.style.color=color;if($('#hexInput'))syncColorWheel(color);$$('.swatch').forEach(x=>x.classList.toggle('selected',x.dataset.color.toLowerCase()===color.toLowerCase()));if(st.selected>=0&&st.objects[st.selected]){st.objects[st.selected].color=color;snapshot();paint()}}
function setWidth(value){if(st.tool==='pencil')return;st.width=Math.max(1,Math.min(48,Number(value)||1));if(st.tool==='pen')st.brushSize=st.width;else st.nonBrushWidth=st.width;$('#topWidth').value=st.width;$('#topWidthValue').value=st.width;$('#inspectorWidth').value=Math.min(40,st.width);$('#widthBadge').textContent=st.width+' px';if(st.selected>=0&&st.objects[st.selected]){st.objects[st.selected].width=st.width;snapshot();paint()}}
function initiate(c,name,dirty=false){
 if(activeTabId!==null){finishText(true);stashActiveTab()}
 const id=++tabSerial;openTabs.push({id,document:null,scrollLeft:0,scrollTop:0});activeTabId=id;
 st.base=c;st.objects=[];st.versionGroupId=null;st.versionLabel=null;st.versionProjectName=null;st.layers=defaultLayers();st.activeLayerId='sketch';st.soloLayerId=null;st.gridVisible=false;st.selected=-1;st.multiSelection=[];st.guides=[];st.draft=null;st.crop=null;st.wand=null;
 st.pointer=null;st.dragging=false;st.moving=false;st.panning=null;st.originalObject=null;st.transform=null;st.marquee=null;st.polygonDraft=null;
 st.name=name||'untitled';st.savedId=null;st.dirty=false;st.history=[];st.historyIdx=-1;st.revision=0;st.zoom=1;
 el.work.scrollLeft=0;el.work.scrollTop=0;
 setTool('select');sizeCanvas();snapshot();st.dirty=dirty;refreshDirtyStatus();updateUI();paint();
 requestAnimationFrame(()=>{if(activeTabId===id&&st.base===c)fitZoom()});
}
function blank(){let c=document.createElement('canvas');c.width=1280;c.height=720;let cc=c.getContext('2d');cc.fillStyle='#fff';cc.fillRect(0,0,c.width,c.height);initiate(c,newUntitledName(),false)}
async function readBlob(blob,name){
 if(!blob||!blob.type?.startsWith('image/')){toast('Please choose an image file.');return false}
 try{
  const image=await decodeSavedImage(blob);
  if(!image.width||!image.height||image.width*image.height>50000000){
   image.close?.();toast('Image is too large or unreadable (50 megapixel maximum).');return false;
  }
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  canvas.getContext('2d').drawImage(image,0,0);image.close?.();
  initiate(canvas,name||'Pasted image',true);
  toast('Image ready. Add an arrow, text, or numbered marker.');return true;
 }catch(error){console.error('Image import failed',error);toast('Could not open this image. Try PNG or JPG.');return false}
}
function nearest(p,unbounded=false){let rect=el.canvas.getBoundingClientRect(),x=(p.clientX-rect.left)/st.zoom,y=(p.clientY-rect.top)/st.zoom;return unbounded?{x,y}:{x:Math.max(0,Math.min(st.base.width,x)),y:Math.max(0,Math.min(st.base.height,y))}}
function rectFor(o){return{x:Math.min(o.x1,o.x2),y:Math.min(o.y1,o.y2),w:Math.abs(o.x2-o.x1),h:Math.abs(o.y2-o.y1)}}
function textFont(o){return `${o.italic?'italic ':''}${o.bold?'bold ':''}${o.fontSize||28}px "${String(o.fontFamily||'Arial').replace(/"/g,'')}" , sans-serif`}
function getBounds(o){if(o.type==='path'||o.type==='pencilpath'||o.type==='highlight'||o.type==='brush-stroke'||o.type==='polygon'||o.type==='polyline'||o.type==='airbrush-stroke'||o.type==='clone-preview'||o.type==='eraser-stroke'){let xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}if(o.type==='text'){const lines=o.text.split('\n'),size=o.fontSize||28,pad=o.labelMode==='label'?Math.max(6,size*.36):0;ctx.save();ctx.font=textFont(o);const width=Math.max(10,...lines.map(l=>ctx.measureText(l).width));ctx.restore();const align=o.align||'left',left=o.x-(align==='center'?width/2:align==='right'?width:0);return{x:left-pad,y:o.y-3-pad,w:width+pad*2,h:Math.max(size*1.3,lines.length*size*1.3)+pad*2}}if(o.type==='curve'&&(o.control||o.controls?.length)){const pts=[{x:o.x1,y:o.y1},{x:o.x2,y:o.y2},...(o.controls||(o.control?[o.control]:[]))],xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}return rectFor(o)}
function objectCenter(o){const b=getBounds(o);return{x:b.x+b.w/2,y:b.y+b.h/2}}
function spin(p,c,a){return{x:c.x+(p.x-c.x)*Math.cos(a)-(p.y-c.y)*Math.sin(a),y:c.y+(p.x-c.x)*Math.sin(a)+(p.y-c.y)*Math.cos(a)}}
function unspin(p,o){return spin(p,objectCenter(o),-(o.rotation||0))}
function distanceToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))}
function insidePolygon(p,pts){let hit=false;for(let i=0,j=pts.length-1;i<pts.length;j=i++){const a=pts[i],b=pts[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit}return hit}
function curveSegments(o){
 const a={x:o.x1,y:o.y1},b={x:o.x2,y:o.y2};
 if(!o.controls?.length){const c=o.control||{x:(a.x+b.x)/2,y:(a.y+b.y)/2};return[{a,b,c1:{x:a.x+(c.x-a.x)*2/3,y:a.y+(c.y-a.y)*2/3},c2:{x:b.x+(c.x-b.x)*2/3,y:b.y+(c.y-b.y)*2/3}}]}
 const pts=[a,...o.controls,b];if(o.curveMode!=='spline')return[{a,b,c1:pts[1],c2:pts[2]}];
 return pts.slice(0,-1).map((start,i)=>{const end=pts[i+1],prev=pts[Math.max(i-1,0)],next=pts[Math.min(i+2,pts.length-1)];return{a:start,b:end,c1:{x:start.x+(end.x-prev.x)/6,y:start.y+(end.y-prev.y)/6},c2:{x:end.x-(next.x-start.x)/6,y:end.y-(next.y-start.y)/6}}});
}
function sampleBezier(s,t){const u=1-t;return{x:u*u*u*s.a.x+3*u*u*t*s.c1.x+3*u*t*t*s.c2.x+t*t*t*s.b.x,y:u*u*u*s.a.y+3*u*u*t*s.c1.y+3*u*t*t*s.c2.y+t*t*t*s.b.y}}
function findObject(x,y){for(const {object:o,index:i} of orderedObjectEntries(st,true).reverse()){if(['erase-region','eraser-stroke','fill-region'].includes(o.type))continue;
 const p=unspin({x,y},o),b=getBounds(o),margin=Math.max(7/st.zoom,(o.width||3)+2);
 if(o.noteAnchor&&Math.hypot(p.x-o.noteAnchor.x,p.y-o.noteAnchor.y)<=Math.max(14,14/st.zoom))return i;
 if(p.x<b.x-margin||p.x>b.x+b.w+margin||p.y<b.y-margin||p.y>b.y+b.h+margin)continue;
 if(o.type==='polygon'&&o.points?.length>=3&&o.fill&&insidePolygon(p,o.points))return i;
 if(o.points){if(o.points.length===1&&Math.hypot(p.x-o.points[0].x,p.y-o.points[0].y)<margin)return i;
  for(let j=1;j<o.points.length;j++)if(distanceToSegment(p,o.points[j-1],o.points[j])<=margin+(o.type==='highlight'?o.width*2:0))return i;
  if(o.type==='polygon'&&o.points.length>2&&distanceToSegment(p,o.points.at(-1),o.points[0])<=margin)return i;continue}
 if(o.type==='curve'){for(const s of curveSegments(o)){let prev=s.a;for(let k=1;k<=40;k++){const q=sampleBezier(s,k/40);if(distanceToSegment(p,prev,q)<=margin)return i;prev=q}}continue}
 if(['line','arrow'].includes(o.type)){if(distanceToSegment(p,{x:o.x1,y:o.y1},{x:o.x2,y:o.y2})<margin)return i;continue}
 if(['rect','ellipse','shape'].includes(o.type)&&!o.fill){const edge=Math.min(Math.abs(p.x-b.x),Math.abs(p.x-(b.x+b.w)),Math.abs(p.y-b.y),Math.abs(p.y-(b.y+b.h)));if(edge>margin&&p.x>b.x+margin&&p.y>b.y+margin&&p.x<b.x+b.w-margin&&p.y<b.y+b.h-margin)continue}
 return i;
}return-1}
function handleLocations(o){
 const b=getBounds(o),midX=b.x+b.w/2,midY=b.y+b.h/2,c=objectCenter(o),ang=o.rotation||0;
 const raw=['line','arrow','curve'].includes(o.type)?
 [['endpoint-start',o.x1,o.y1],['endpoint-end',o.x2,o.y2],['rotate',midX,b.y-30/st.zoom]]:
 [['nw',b.x,b.y],['n',midX,b.y],['ne',b.x+b.w,b.y],['e',b.x+b.w,midY],['se',b.x+b.w,b.y+b.h],['s',midX,b.y+b.h],['sw',b.x,b.y+b.h],['w',b.x,midY],['rotate',midX,b.y-30/st.zoom]];
 if(o.type==='curve'){if(o.controls?.length)o.controls.forEach((p,i)=>raw.push(['control-'+i,p.x,p.y]));else if(o.control)raw.push(['control',o.control.x,o.control.y])}
 if(o.type==='polygon'&&o.points?.length<240)o.points.forEach((p,i)=>raw.push(['vertex-'+i,p.x,p.y]));
 if(o.noteStyle==='callout'&&o.noteAnchor)raw.push(['note-anchor',o.noteAnchor.x,o.noteAnchor.y]);
 return raw.map(([kind,x,y])=>({kind,...spin({x,y},c,ang)}));
}

function selectedIndexes(){const ids=(st.multiSelection||[]).filter(i=>i>=0&&i<st.objects.length);return st.selected>=0&&ids.includes(st.selected)?ids:st.selected>=0&&st.selected<st.objects.length?[st.selected]:[]}
function selectObjects(indices){
 st.multiSelection=[...new Set(indices)].filter(i=>i>=0&&i<st.objects.length&&layerEditable(st.objects[i].layerId)).sort((a,b)=>a-b);
 st.selected=st.multiSelection.at(-1)??-1;st.guides=[];
 updateContextOptions();paint();
}
function selectHit(index,add=false){
 let entries=index<0?[]:st.objects[index]?.groupId?st.objects.flatMap((o,i)=>o.groupId===st.objects[index].groupId?[i]:[]):[index];
 let current=selectedIndexes();
 if(add){if(entries.every(i=>current.includes(i)))current=current.filter(i=>!entries.includes(i));else current=[...current,...entries];entries=current}
 selectObjects(entries);
}
function unionBounds(indices,objects=st.objects){
 const bs=indices.map(i=>getBounds(objects[i])).filter(Boolean);if(!bs.length)return null;
 const left=Math.min(...bs.map(b=>b.x)),top=Math.min(...bs.map(b=>b.y));
 return{x:left,y:top,w:Math.max(...bs.map(b=>b.x+b.w))-left,h:Math.max(...bs.map(b=>b.y+b.h))-top};
}
function multiHandles(){const b=unionBounds(selectedIndexes());if(!b)return[];
 return [['nw',b.x,b.y],['ne',b.x+b.w,b.y],['se',b.x+b.w,b.y+b.h],['sw',b.x,b.y+b.h]].map(([kind,x,y])=>({kind,x,y}));
}
function duplicateObjects(){
 const ids=selectedIndexes();if(!ids.length)return;
 const group='group-'+Date.now(),startNumber=Math.max(0,...st.objects.filter(o=>o.noteStyle).map(o=>o.noteNumber||0));let nextNumber=startNumber;
 const additions=ids.map(i=>{const o=copyObj(st.objects[i]);o.objectId=objectId();moveObject(o,20,20);if(o.groupId)o.groupId=group;if(o.noteStyle)o.noteNumber=++nextNumber;return o});
 const start=st.objects.length;st.objects.push(...additions);selectObjects(additions.map((_,i)=>start+i));
 snapshot();paint();toast(additions.length+' object'+(additions.length>1?'s':'')+' duplicated');
}
function groupObjects(){
 const ids=selectedIndexes();if(ids.length<2)return;
 const id='group-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
 ids.forEach(i=>st.objects[i].groupId=id);snapshot();updateContextOptions();paint();toast('Grouped '+ids.length+' objects · Ctrl/⌘+Shift+G to ungroup');
}
function ungroupObjects(){
 const ids=selectedIndexes(),groups=new Set(ids.map(i=>st.objects[i]?.groupId).filter(Boolean));if(!groups.size)return;
 st.objects.forEach(o=>{if(groups.has(o.groupId))delete o.groupId});snapshot();updateContextOptions();paint();toast('Objects ungrouped');
}
function snapMovement(ids,originals,dx,dy,disable=false){
 if(disable||!st.snapEnabled){st.guides=[];return{dx,dy}}
 const b=unionBounds(ids,originals),other=orderedObjectEntries(st).filter(x=>!ids.includes(x.index)&&!['erase-region','eraser-stroke','fill-region'].includes(x.object.type)).map(x=>({o:x.object}));
 if(!b||!other.length){st.guides=[];return{dx,dy}}
 const threshold=Math.max(2,6/st.zoom);
 let bestX={delta:threshold+1},bestY={delta:threshold+1};
 const movingX=[b.x+dx,b.x+b.w/2+dx,b.x+b.w+dx],movingY=[b.y+dy,b.y+b.h/2+dy,b.y+b.h+dy];
 for(const {o} of other){
  const t=getBounds(o),xs=[t.x,t.x+t.w/2,t.x+t.w],ys=[t.y,t.y+t.h/2,t.y+t.h];
  for(const target of xs)for(const value of movingX){const delta=target-value;if(Math.abs(delta)<Math.abs(bestX.delta))bestX={delta,at:target}}
  for(const target of ys)for(const value of movingY){const delta=target-value;if(Math.abs(delta)<Math.abs(bestY.delta))bestY={delta,at:target}}
 }
 st.guides=[];
 if(Math.abs(bestX.delta)<=threshold){dx+=bestX.delta;st.guides.push({type:'v',at:bestX.at})}
 if(Math.abs(bestY.delta)<=threshold){dy+=bestY.delta;st.guides.push({type:'h',at:bestY.at})}
 return{dx,dy};
}
function renderGuides(){
 if(!st.guides?.length)return;
 ctx.save();ctx.lineWidth=1/st.zoom;ctx.strokeStyle='#e2559a';ctx.setLineDash([4/st.zoom,3/st.zoom]);
 for(const g of st.guides){ctx.beginPath();if(g.type==='v'){ctx.moveTo(g.at,0);ctx.lineTo(g.at,st.base.height)}else{ctx.moveTo(0,g.at);ctx.lineTo(st.base.width,g.at)}ctx.stroke()}
 ctx.restore();
}
function drawObjectMarquee(){
 if(!st.objectMarquee)return;const b=rectFor(st.objectMarquee);
 ctx.save();ctx.fillStyle='rgba(35,117,220,.10)';ctx.fillRect(b.x,b.y,b.w,b.h);
 ctx.lineWidth=1/st.zoom;ctx.strokeStyle='#2375dc';ctx.setLineDash([5/st.zoom,3/st.zoom]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.restore();
}

function selectedHandle(p,pointerType){if(st.selected<0)return null;const o=st.objects[st.selected],hs=selectedIndexes().length>1?multiHandles():handleLocations(o);for(let i=hs.length-1;i>=0;i--){if(Math.hypot(p.x-hs[i].x,p.y-hs[i].y)<=Math.max(10,(pointerType==='touch'?21:12)/st.zoom))return hs[i].kind}return null}
function resizeGeometry(o,original,b,scaleX,scaleY){let mid={x:b.x+b.w/2,y:b.y+b.h/2};const map=p=>({x:mid.x+(p.x-mid.x)*scaleX,y:mid.y+(p.y-mid.y)*scaleY});if(original.points){o.points=original.points.map(map)}else if(original.type==='text'){let q=map({x:original.x,y:original.y});o.x=q.x;o.y=q.y;o.fontSize=Math.max(6,Math.round(original.fontSize*Math.max(.15,Math.abs(scaleY))));if(original.noteAnchor)o.noteAnchor=map(original.noteAnchor)}else{let a=map({x:original.x1,y:original.y1}),d=map({x:original.x2,y:original.y2});o.x1=a.x;o.y1=a.y;o.x2=d.x;o.y2=d.y;if(original.control)o.control=map(original.control);if(original.controls)o.controls=original.controls.map(map)}}

function moveObject(o,dx,dy){if(o.points){o.points.forEach(p=>{p.x+=dx;p.y+=dy})}else if(o.type==='text'){o.x+=dx;o.y+=dy;if(o.noteAnchor){o.noteAnchor.x+=dx;o.noteAnchor.y+=dy}}else{o.x1+=dx;o.x2+=dx;o.y1+=dy;o.y2+=dy;if(o.control){o.control.x+=dx;o.control.y+=dy}if(o.controls)o.controls.forEach(p=>{p.x+=dx;p.y+=dy})}}

const ICON_CDN="https://cdn.jsdelivr.net/npm/lucide-static@0.468.0/";
const emojiIconCatalog=[["😀","Grinning"],["😃","Happy"],["😄","Big smile"],["😁","Smile"],["😆","Laughing"],["😂","Tears of joy"],["🤣","ROFL"],["😊","Smiling"],["🙂","Slight smile"],["🙃","Upside down"],["😉","Wink"],["😍","Heart eyes"],["🥰","Love"],["😘","Kiss"],["😎","Cool"],["🤔","Thinking"],["🤨","Skeptical"],["😐","Neutral"],["😑","Expressionless"],["🙄","Eye roll"],["😏","Smirk"],["😔","Sad"],["😢","Crying"],["😭","Loud cry"],["😤","Frustrated"],["😠","Angry"],["😡","Rage"],["🤯","Mind blown"],["😱","Scream"],["😨","Fear"],["😳","Blush"],["🥺","Pleading"],["😴","Sleep"],["🤢","Nauseous"],["🤮","Sick"],["🤒","Fever"],["🥳","Party"],["🤩","Star struck"],["🥹","Grateful"],["🫠","Melting"],["👍","Thumbs up approve yes"],["👎","Thumbs down dislike no"],["👌","Okay"],["✌️","Peace victory"],["🤞","Fingers crossed"],["🤟","Love you"],["🤘","Rock on"],["👏","Clap applause"],["🙌","Celebrate"],["🙏","Prayer thanks"],["👋","Wave hello"],["🤝","Handshake"],["💪","Strong muscle"],["👆","Point up"],["👇","Point down"],["👉","Point right"],["👈","Point left"],["☝️","Index up"],["✋","Stop hand"],["🖐️","Raised hand"],["🫶","Heart hands"],["🫡","Salute"],["💯","Hundred"],["❤️","Red heart love"],["🧡","Orange heart"],["💛","Yellow heart"],["💚","Green heart"],["💙","Blue heart"],["💜","Purple heart"],["🖤","Black heart"],["🤍","White heart"],["💔","Broken heart"],["💕","Two hearts"],["💖","Sparkling heart"],["⭐","Star"],["🌟","Glowing star"],["✨","Sparkles"],["🔥","Fire hot"],["💥","Explosion"],["💡","Idea light bulb"],["⚡","Lightning energy"],["💧","Water droplet"],["🌊","Wave water"],["☀️","Sun"],["🌙","Moon"],["☁️","Cloud"],["🌈","Rainbow"],["🌸","Flower"],["🌹","Rose"],["🌲","Pine tree"],["🍀","Clover luck"],["🍎","Apple"],["🍕","Pizza"],["☕","Coffee"],["🍰","Cake"],["🎂","Birthday cake"],["🎈","Balloon"],["🎉","Confetti"],["🎊","Celebration"],["🎁","Gift"],["✅","Green check correct"],["✔️","Checkmark"],["☑️","Checkbox"],["❌","Red X wrong"],["❎","X mark"],["⚠️","Warning"],["🚫","Prohibited"],["❗","Exclamation mark"],["❓","Question mark"],["ℹ️","Information"],["🔴","Red circle"],["🟠","Orange circle"],["🟡","Yellow circle"],["🟢","Green circle"],["🔵","Blue circle"],["🟣","Purple circle"],["⚫","Black circle"],["⚪","White circle"],["🟥","Red square"],["🟩","Green square"],["🟦","Blue square"],["⬆️","Up arrow"],["⬇️","Down arrow"],["⬅️","Left arrow"],["➡️","Right arrow"],["↗️","Northeast arrow"],["↘️","Southeast arrow"],["🔄","Refresh"],["🔁","Repeat"],["🔒","Lock"],["🔓","Unlock"],["📌","Pushpin"],["📍","Location pin"],["📝","Note memo"],["📎","Paperclip"],["📷","Camera"],["🖼️","Picture"],["📁","Folder"],["📄","Document"],["📊","Chart"],["📈","Graph rising"],["📉","Graph falling"],["📅","Calendar"],["⏰","Alarm clock"],["⌛","Hourglass"],["🔍","Magnifying glass"],["🔎","Search"],["⚙️","Settings gear"],["🛠️","Tools"],["🔧","Wrench"],["🔨","Hammer"],["🧰","Toolbox"],["🚀","Rocket"],["🎯","Target"],["🏁","Finish flag"],["🚩","Red flag"],["🏆","Trophy"],["🥇","Medal gold"],["👑","Crown"],["🛡️","Shield"],["🧭","Compass"],["🗺️","Map"],["🏠","Home"],["🏢","Office"],["🏭","Factory"],["🏥","Hospital"],["🚗","Car"],["✈️","Airplane"],["🚲","Bicycle"],["🦺","Safety vest"],["👷","Construction worker"],["♻️","Recycle"],["🌍","Earth world"],["📱","Phone mobile"],["💻","Laptop"],["🖥️","Desktop"],["🎮","Game controller"],["🎨","Art palette"],["🖌️","Paintbrush"],["✏️","Pencil"],["🎵","Music"],["🎬","Movie"],["📢","Megaphone"],["💬","Speech bubble"],["🗨️","Chat message"],["👁️","Eye"],["🐶","Dog"],["🐱","Cat"],["🦋","Butterfly"],["🐝","Bee"],["🐟","Fish"],["🦄","Unicorn"]];
const builtinLucideIcons={"heart":[["path",{"d":"M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"}]],"star":[["path",{"d":"m12 2 3.1 6.4 7.1 1-5.1 5 1.2 7L12 18l-6.3 3.4 1.2-7-5.1-5 7.1-1Z"}]],"check":[["path",{"d":"M20 6 9 17l-5-5"}]],"x":[["path",{"d":"M18 6 6 18M6 6l12 12"}]],"check-circle":[["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"m7.5 12 3 3L16.5 9"}]],"circle-alert":[["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M12 8v5M12 17h.01"}]],"info":[["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M12 16v-4M12 8h.01"}]],"triangle-alert":[["path",{"d":"m10.3 3.8-9 15.6a2 2 0 0 0 1.7 3h18a2 2 0 0 0 1.7-3l-9-15.6a2 2 0 0 0-3.4 0Z"}],["path",{"d":"M12 9v4M12 17h.01"}]],"arrow-right":[["path",{"d":"M5 12h14m-6-6 6 6-6 6"}]],"arrow-left":[["path",{"d":"M19 12H5m6-6-6 6 6 6"}]],"arrow-up":[["path",{"d":"M12 19V5m-6 6 6-6 6 6"}]],"arrow-down":[["path",{"d":"M12 5v14m-6-6 6 6 6-6"}]],"plus":[["path",{"d":"M12 5v14M5 12h14"}]],"minus":[["path",{"d":"M5 12h14"}]],"search":[["circle",{"cx":11,"cy":11,"r":8}],["path",{"d":"m21 21-4.3-4.3"}]],"house":[["path",{"d":"m3 10 9-7 9 7v11H3Z"}],["path",{"d":"M9 21v-7h6v7"}]],"map-pin":[["path",{"d":"M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"}],["circle",{"cx":12,"cy":10,"r":2.5}]],"user":[["circle",{"cx":12,"cy":8,"r":4}],["path",{"d":"M4 21a8 8 0 0 1 16 0"}]],"users":[["path",{"d":"M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"}],["circle",{"cx":8.5,"cy":7,"r":4}],["path",{"d":"M20 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"}]],"camera":[["rect",{"x":2,"y":6,"width":20,"height":15,"rx":2}],["circle",{"cx":12,"cy":13.5,"r":3.5}],["path",{"d":"m7 6 2-3h6l2 3"}]],"image":[["rect",{"x":3,"y":3,"width":18,"height":18,"rx":2}],["circle",{"cx":8.5,"cy":8.5,"r":1.5}],["path",{"d":"m3 17 5-5 5 5 3-3 5 5"}]],"mail":[["rect",{"x":2,"y":4,"width":20,"height":16,"rx":2}],["path",{"d":"m2 7 10 7L22 7"}]],"phone":[["path",{"d":"M22 16v4a2 2 0 0 1-2 2A18 18 0 0 1 2 4a2 2 0 0 1 2-2h4l2 5-3 3a14 14 0 0 0 7 7l3-3Z"}]],"bell":[["path",{"d":"M18 8a6 6 0 0 0-12 0c0 7-3 8-3 10h18c0-2-3-3-3-10M10 22h4"}]],"clock":[["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M12 6v6l4 2"}]],"calendar":[["rect",{"x":3,"y":5,"width":18,"height":16,"rx":2}],["path",{"d":"M7 3v4m10-4v4M3 10h18"}]],"settings":[["circle",{"cx":12,"cy":12,"r":3}],["path",{"d":"M10 2h4l1 3 2 1 3-1 2 4-3 2v2l3 2-2 4-3-1-2 1-1 3h-4l-1-3-2-1-3 1-2-4 3-2v-2L2 9l2-4 3 1 2-1Z"}]],"trash-2":[["path",{"d":"M3 6h18M8 6V4h8v2M6 6l1 15h10l1-15M10 10v7m4-7v7"}]],"lock":[["rect",{"x":5,"y":10,"width":14,"height":12,"rx":2}],["path",{"d":"M8 10V7a4 4 0 0 1 8 0v3"}]],"shield-check":[["path",{"d":"m12 2 8 3v6c0 5-3 9-8 11-5-2-8-6-8-11V5Z"}],["path",{"d":"m9 12 2 2 4-4"}]],"flag":[["path",{"d":"M5 22V4m0 0c3-3 6 3 9 0s6 0 6 0v11c-4-3-6 3-10 0-2-1-3-1-5 0"}]],"bookmark":[["path",{"d":"M5 3h14v19l-7-5-7 5Z"}]],"zap":[["path",{"d":"m13 2-9 12h7l-1 8 10-12h-7Z"}]],"lightbulb":[["path",{"d":"M9 18h6m-6 3h6M7.5 14c-2-2-3-4-2-7a7 7 0 0 1 13 0c1 3 0 5-2 7l-1.5 3H9Z"}]],"sun":[["circle",{"cx":12,"cy":12,"r":4}],["path",{"d":"M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"}]],"moon":[["path",{"d":"M20.5 14A9 9 0 0 1 10 3.5 9 9 0 1 0 20.5 14Z"}]],"cloud":[["path",{"d":"M20 17a4 4 0 0 0-1-8 7 7 0 0 0-13-1 4.5 4.5 0 1 0-1 9Z"}]],"droplet":[["path",{"d":"M12 2c4 6 7 9 7 13a7 7 0 0 1-14 0c0-4 3-7 7-13Z"}]],"message-circle":[["path",{"d":"M20 11a8 8 0 0 1-9 9l-7 2 2-7a8 8 0 1 1 14-4Z"}]],"thumbs-up":[["path",{"d":"M7 10v12H3V10ZM7 10l5-8c3-1 4 2 2 7h6a2 2 0 0 1 2 3l-3 8a2 2 0 0 1-2 2H7"}]],"smile":[["circle",{"cx":12,"cy":12,"r":10}],["path",{"d":"M8 14s1 3 4 3 4-3 4-3M8 9h.01M16 9h.01"}]]};
let lucideIconMap=null,lucideIconLoading=null;
function normalIconName(name){return String(name).replace(/([a-z0-9])([A-Z])/g,'$1-$2').replace(/[_\s]+/g,'-').toLowerCase()}
function lucideNames(){return lucideIconMap?Array.from(lucideIconMap.keys()):Object.keys(builtinLucideIcons)}
async function ensureLucideCatalog(){
 if(lucideIconMap)return;
 if(lucideIconLoading)return lucideIconLoading;
 lucideIconLoading=(async()=>{
  const ctrl=new AbortController(),timeout=setTimeout(()=>ctrl.abort(),9500);
  try{
   const response=await fetch(ICON_CDN+'icon-nodes.json',{signal:ctrl.signal,mode:'cors'});
   if(!response.ok)throw Error('Lucide catalog not available');
   const data=await response.json();
   const map=new Map();
   for(const [raw,entry] of Object.entries(data)){
    const name=normalIconName(raw);const nodes=Array.isArray(entry)?entry:null;
    if(nodes&&nodes.length&&Array.isArray(nodes[0]))map.set(name,nodes);
   }
   if(map.size<100)throw Error('Unexpected Lucide catalog structure');
   for(const [name,nodes] of Object.entries(builtinLucideIcons))if(!map.has(name))map.set(name,nodes);
   lucideIconMap=map;
  }catch(err){console.info('Using built-in Lucide icon set',err);lucideIconMap=new Map(Object.entries(builtinLucideIcons))}
  finally{clearTimeout(timeout)}
 })();return lucideIconLoading;
}
function drawLucideNodes(g,nodes){
 g.save();g.lineCap='round';g.lineJoin='round';
 for(const item of nodes||[]){
  if(!Array.isArray(item)||item.length<2)continue;
  const [tag,a]=item;if(!a||typeof a!=='object')continue;
  g.beginPath();
  const v=k=>Number(a[k]??0),str=k=>String(a[k]??'');
  try{
   switch(tag){
    case 'path':{const p=new Path2D(str('d'));g.stroke(p);break}
    case 'line':g.moveTo(v('x1'),v('y1'));g.lineTo(v('x2'),v('y2'));g.stroke();break;
    case 'circle':g.arc(v('cx'),v('cy'),Math.max(0,v('r')),0,Math.PI*2);g.stroke();break;
    case 'rect':{const rr=Math.max(0,v('rx')||0);if(rr&&g.roundRect)g.roundRect(v('x'),v('y'),v('width'),v('height'),rr);else g.rect(v('x'),v('y'),v('width'),v('height'));g.stroke();break}
    case 'ellipse':g.ellipse(v('cx'),v('cy'),Math.max(0.01,v('rx')),Math.max(0.01,v('ry')),0,0,Math.PI*2);g.stroke();break;
    case 'polyline':case 'polygon':{
     const points=str('points').trim().split(/[\s,]+/).map(Number);
     for(let i=0;i+1<points.length;i+=2){if(i===0)g.moveTo(points[i],points[i+1]);else g.lineTo(points[i],points[i+1])}
     if(tag==='polygon')g.closePath();g.stroke();break
    }
   }
  }catch(err){/* unsupported path in one icon; keep the remaining nodes */ }
 }
 g.restore();
}
function drawIconObject(g,o){
 const b=rectFor(o);if(!(b.w>0&&b.h>0))return;
 if(o.iconFamily==='emoji'){
  g.save();g.textAlign='center';g.textBaseline='middle';g.font=Math.round(Math.min(b.w,b.h)*.91)+'px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';g.fillStyle=o.color||'#000';
  g.fillText(o.emoji||'⭐',b.x+b.w/2,b.y+b.h/2+Math.min(b.w,b.h)*.035,Math.max(1,b.w));
  g.restore();return;
 }
 if(!o.nodes?.length)return;
 g.save();g.translate(b.x,b.y);g.scale(b.w/24,b.h/24);
 g.strokeStyle=o.color||'#2878c7';g.fillStyle=o.color||'#2878c7';
 g.lineWidth=Math.max(.6,Math.min(4.5,Number(o.width)||2));
 drawLucideNodes(g,o.nodes);g.restore();
}
function patchImage(src){if(!src)return null;let image=patchImages.get(src);if(!image){image=new Image();patchImages.set(src,image);image.onload=()=>{if(st.base)paint()};image.onerror=()=>patchImages.delete(src);image.src=src}return image}
function applyStrokePreset(g,style,width){g.setLineDash([]);if(style==='dash')g.setLineDash([Math.max(8,width*3),Math.max(6,width*2)]);else if(style==='dot')g.setLineDash([Math.max(1,width*.08),Math.max(5,width*2)])}
function hatchFill(g,b,mode,width){const step=Math.max(8,Math.round(width*3));for(let u=b.x-b.h;u<=b.x+b.w+b.h;u+=step){g.beginPath();g.moveTo(u,b.y+b.h);g.lineTo(u+b.h,b.y);g.stroke()}if(mode==='crosshatch'){for(let u=b.x;u<=b.x+b.w+b.h*2;u+=step){g.beginPath();g.moveTo(u,b.y);g.lineTo(u-b.h,b.y+b.h);g.stroke()}}}
function fillShapePattern(g,o,b){const mode=o.fillMode||(o.fill?'filled':'outline');if(mode==='outline'||mode==='none')return;if(mode==='filled'||mode==='filledOutline'){if(mode==='filledOutline'){g.save();g.fillStyle=o.fillColor||'#ffffff';g.fill();g.restore()}else g.fill();return}g.save();g.clip();g.setLineDash([]);g.strokeStyle=o.color||'#e23535';g.lineWidth=Math.max(1,Math.min(3,(o.width||4)*.55));hatchFill(g,b,mode,o.width||4);g.restore()}

function drawShapePath(g,o){
 const b=getBounds(o);g.beginPath();
 if(o.type==='polygon'){
  const pts=o.points||[];if(!pts.length)return;
  g.moveTo(pts[0].x,pts[0].y);
  if(o.smooth&&pts.length>=3){
   for(let i=0;i<pts.length;i++){const prev=pts[(i-1+pts.length)%pts.length],start=pts[i],end=pts[(i+1)%pts.length],next=pts[(i+2)%pts.length];
    g.bezierCurveTo(start.x+(end.x-prev.x)/6,start.y+(end.y-prev.y)/6,end.x-(next.x-start.x)/6,end.y-(next.y-start.y)/6,end.x,end.y)}
  }else for(const p of pts.slice(1))g.lineTo(p.x,p.y);
  g.closePath();return;
 }
 const kind=o.shapeKind||'rectangle',x=b.x,y=b.y,w=b.w,h=b.h,cx=x+w/2,cy=y+h/2;
 const poly=(pts)=>{g.moveTo(x+pts[0][0]*w,y+pts[0][1]*h);for(const [px,py] of pts.slice(1))g.lineTo(x+px*w,y+py*h);g.closePath()};
 const star=(points,inside=.43,turn=0)=>{for(let i=0;i<points*2;i++){const a=-Math.PI/2+turn+Math.PI*i/points;const r=i%2?inside:1;const px=cx+Math.cos(a)*w*.49*r,py=cy+Math.sin(a)*h*.49*r;if(i===0)g.moveTo(px,py);else g.lineTo(px,py)}g.closePath()};
 switch(kind){
 case 'rectangle':g.rect(x,y,w,h);break;
 case 'rounded':g.roundRect(x,y,w,h,Math.max(1,Math.min(w,h)*.2));break;
 case 'oval':g.ellipse(cx,cy,Math.max(.1,w/2),Math.max(.1,h/2),0,0,Math.PI*2);break;
 case 'diamond':poly([[.5,0],[1,.5],[.5,1],[0,.5]]);break;
 case 'trapezoid':poly([[.22,0],[.78,0],[1,1],[0,1]]);break;
 case 'parallelogram':poly([[.28,0],[1,0],[.72,1],[0,1]]);break;
 case 'triangle':poly([[.5,0],[1,1],[0,1]]);break;
 case 'rightTriangle':poly([[0,0],[0,1],[1,1]]);break;
 case 'arrowBlock':poly([[0,.26],[.59,.26],[.59,0],[1,.5],[.59,1],[.59,.74],[0,.74]]);break;
 case 'arrowNotched':poly([[.06,.26],[.58,.26],[.58,0],[1,.5],[.58,1],[.58,.74],[.06,.74],[.2,.5]]);break;
 case 'arrowPentagon':poly([[0,.14],[.67,.14],[1,.5],[.67,.86],[0,.86]]);break;
 case 'chevron':poly([[0,0],[.55,0],[1,.5],[.55,1],[0,1],[.42,.5]]);break;
 case 'calloutRect':poly([[0,0],[1,0],[1,.76],[.4,.76],[.18,1],[.2,.76],[0,.76]]);break;
 case 'calloutRound':{
  const r=Math.min(w,h)*.15;
  g.moveTo(x+r,y);g.lineTo(x+w-r,y);g.quadraticCurveTo(x+w,y,x+w,y+r);
  g.lineTo(x+w,y+h*.65);g.quadraticCurveTo(x+w,y+h*.8,x+w-r,y+h*.8);
  g.lineTo(x+w*.4,y+h*.8);g.lineTo(x+w*.18,y+h);
  g.lineTo(x+w*.2,y+h*.8);g.lineTo(x+r,y+h*.8);
  g.quadraticCurveTo(x,y+h*.8,x,y+h*.65);g.lineTo(x,y+r);
  g.quadraticCurveTo(x,y,x+r,y);g.closePath();break;
 }
 case 'calloutOval':{
  g.moveTo(x+w*.52,y+h*.04);
  g.bezierCurveTo(x+w*1.12,y-h*.03,x+w*1.18,y+h*.68,x+w*.64,y+h*.78);
  g.lineTo(x+w*.22,y+h);g.lineTo(x+w*.3,y+h*.76);
  g.bezierCurveTo(x-w*.12,y+h*.65,x-w*.14,y+h*.04,x+w*.52,y+h*.04);
  g.closePath();break;
 }
 case 'cloud':{
  g.moveTo(x+w*.2,y+h*.68);
  g.bezierCurveTo(x-w*.05,y+h*.7,x-w*.08,y+h*.38,x+w*.18,y+h*.3);
  g.bezierCurveTo(x+w*.12,y+h*.02,x+w*.47,y-h*.03,x+w*.56,y+h*.18);
  g.bezierCurveTo(x+w*.91,y+h*.03,x+w*1.05,y+h*.37,x+w*.89,y+h*.56);
  g.bezierCurveTo(x+w*1.09,y+h*.78,x+w*.78,y+h*.91,x+w*.68,y+h*.81);
  g.lineTo(x+w*.42,y+h*.81);g.lineTo(x+w*.28,y+h);g.lineTo(x+w*.29,y+h*.81);
  g.bezierCurveTo(x+w*.2,y+h*.87,x+w*.1,y+h*.79,x+w*.2,y+h*.68);g.closePath();break;
 }
 case 'bolt':poly([[.55,0],[.12,.57],[.47,.52],[.37,1],[.92,.39],[.59,.45]]);break;
 case 'check':poly([[0,.52],[.13,.35],[.39,.63],[.85,0],[1,.13],[.42,1]]);break;
 case 'cross':poly([[.12,0],[.5,.35],[.88,0],[1,.12],[.65,.5],[1,.88],[.88,1],[.5,.65],[.12,1],[0,.88],[.35,.5],[0,.12]]);break;
 case 'gear':{
  const n=24;for(let i=0;i<n;i++){const a=Math.PI*2*i/n-Math.PI/2;const rad=(i%3===0||i%3===1)?1:.79;const px=cx+Math.cos(a)*w*.49*rad,py=cy+Math.sin(a)*h*.49*rad;if(i===0)g.moveTo(px,py);else g.lineTo(px,py)}g.closePath();break;
 }
 case 'heart':{
  g.moveTo(cx,y+h*.9);g.bezierCurveTo(x-w*.12,y+h*.55,x,y+h*.1,cx,y+h*.26);
  g.bezierCurveTo(x+w,y+h*.1,x+w*1.12,y+h*.55,cx,y+h*.9);g.closePath();break;
 }
 case 'star4':star(4,.35);break;
 case 'star5':star(5,.44);break;
 case 'star6':star(6,.52);break;
 case 'custom':poly([[0,.7],[.21,.18],[.56,.13],[.92,.46],[.71,.95],[.32,.83]]);break;
 default:{
  const n=kind==='pentagon'?5:kind==='hexagon'?6:kind==='heptagon'?7:kind==='octagon'?8:5;
  for(let i=0;i<n;i++){const a=-Math.PI/2+2*Math.PI*i/n,px=cx+Math.cos(a)*w*.49,py=cy+Math.sin(a)*h*.49;if(i===0)g.moveTo(px,py);else g.lineTo(px,py)}g.closePath();
 }
 }
}

const brushTipCache=new Map();
const finishedBrushCache=new WeakMap();
function getBrushTip(width,color,hardness){
 const diameter=Math.max(1,Math.min(200,Number(width)||12));
 const hard=Math.max(0,Math.min(100,Number(hardness??80)));
 const key=diameter+'|'+color+'|'+hard;
 if(brushTipCache.has(key))return brushTipCache.get(key);
 const pad=2,extent=Math.ceil(diameter+pad*2),r=diameter/2;
 const can=document.createElement('canvas');can.width=extent;can.height=extent;
 const g=can.getContext('2d'),cx=extent/2,cy=extent/2;
 const grad=g.createRadialGradient(cx,cy,0,cx,cy,r);
 const rgba=(hex,a)=>{
  const s=String(hex).trim(),six=/^#[0-9a-fA-F]{6}$/.test(s)?s:'#e23535';
  const n=parseInt(six.slice(1),16);return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+a+')';
 };
 grad.addColorStop(0,rgba(color,1));
 // Hardness 100 still gets a tiny anti-aliased outer edge.
 grad.addColorStop(Math.min(.98,hard/100),rgba(color,1));
 grad.addColorStop(1,rgba(color,0));
 g.fillStyle=grad;g.beginPath();g.arc(cx,cy,r,0,Math.PI*2);g.fill();
 if(brushTipCache.size>90)brushTipCache.clear();
 brushTipCache.set(key,can);return can;
}
function drawPencilPixels(g,pts){
 if(!pts?.length)return;
 g.save();g.fillStyle=g.strokeStyle;g.globalAlpha=1;
 const pixel=(px,py)=>g.fillRect(px,py,1,1);
 let px=Math.floor(pts[0].x),py=Math.floor(pts[0].y);pixel(px,py);
 for(let i=1;i<pts.length;i++){
  let x1=Math.floor(pts[i].x),y1=Math.floor(pts[i].y);
  let dx=Math.abs(x1-px),sx=px<x1?1:-1,dy=-Math.abs(y1-py),sy=py<y1?1:-1,err=dx+dy;
  while(px!==x1||py!==y1){
   const twice=err*2;if(twice>=dy){err+=dy;px+=sx}
   if(twice<=dx){err+=dx;py+=sy}
   pixel(px,py);
  }
 }
 g.restore();
}
function drawPaintbrush(g,o){
 const pts=o.points||[];if(!pts.length)return;
 const width=Math.max(1,Math.min(200,Number(o.width)||12));
 const tip=getBrushTip(width,o.color||'#e23535',o.hardness??80);
 const opacity=Math.max(.05,Math.min(1,Number(o.opacity??100)/100));
 const last=pts[pts.length-1],first=pts[0];
 const bounds=getBounds(o),pad=Math.ceil(width+6);
 const left=Math.floor(bounds.x-pad),top=Math.floor(bounds.y-pad),w=Math.ceil(bounds.w+pad*2+2),h=Math.ceil(bounds.h+pad*2+2);
 const key=pts.length+'|'+last.x+'|'+last.y+'|'+first.x+'|'+first.y+'|'+width+'|'+(o.hardness??80)+'|'+o.color+'|'+(o.pressureEnabled?last.pressure:0);
 let cached=finishedBrushCache.get(o);
 const canUseLayer=w>0&&h>0&&w*h<=12000000&&w<=6500&&h<=6500;
 if(!cached||cached.key!==key){
  const layer=document.createElement('canvas');layer.width=canUseLayer?w:1;layer.height=canUseLayer?h:1;
  const cg=canUseLayer?layer.getContext('2d'):g;
  if(canUseLayer)cg.translate(-left,-top);else cg.globalAlpha*=opacity;
  // Spacing gives continuous, circular, smoothed brush marks.
  const spacing=Math.max(.6,width*.16);
  const stamp=p=>{
   const weight=o.pressureEnabled?Math.max(.12,Math.min(1,p.pressure||1)):1;
   const brush=o.pressureEnabled?getBrushTip(Math.max(1,Math.round(width*weight)),o.color||'#e23535',o.hardness??80):tip;
   cg.drawImage(brush,p.x-brush.width/2,p.y-brush.height/2);
  };
  let prev=pts[0];stamp(prev);
  let carry=0;
  for(let i=1;i<pts.length;i++){
   const next=pts[i],dx=next.x-prev.x,dy=next.y-prev.y,dist=Math.hypot(dx,dy);
   if(dist<.0001){prev=next;continue}
   let d=spacing-carry;
   while(d<=dist){const t=d/dist;stamp({x:prev.x+dx*t,y:prev.y+dy*t,pressure:(prev.pressure||1)+((next.pressure||1)-(prev.pressure||1))*t});d+=spacing}
   carry=Math.max(0,spacing-(d-dist));prev=next;
  }
  stamp(prev);
  cached=canUseLayer?{key,layer,left,top}:null;
  if(cached)finishedBrushCache.set(o,cached);
 }
 if(cached){g.save();g.globalAlpha*=opacity;g.drawImage(cached.layer,cached.left,cached.top);g.restore()}
 // For extremely large strokes, the stamps were drawn directly to the canvas.
}

// Seeded spray reproduces exactly on redraw, undo, export and project load.
const airbrushCache=new WeakMap();
function drawAirbrush(g,o){
 const pts=o.points||[];if(!pts.length)return;
 const width=Math.max(2,Number(o.width)||12),opacity=Math.max(.01,Math.min(1,(o.opacity??100)/100));
 const density=Math.max(.1,Math.min(1,Number(o.density??50)/100));
 const spacing=Math.max(1,width*.14),dotsPerStep=Math.min(55,Math.max(4,Math.round(width/2*density)));
 const bounds=getBounds(o),pad=width*.7+4,box={x:Math.floor(bounds.x-pad),y:Math.floor(bounds.y-pad)};
 box.w=Math.ceil(bounds.w+pad*2+2);box.h=Math.ceil(bounds.h+pad*2+2);
 const key=pts.length+'|'+pts.at(-1).x+'|'+pts.at(-1).y+'|'+width+'|'+o.color+'|'+opacity+'|'+density;
 let cache=airbrushCache.get(o);
 if(!cache||cache.key!==key){
  const canUse=box.w>0&&box.h>0&&box.w*box.h<=6000000;
  const layer=document.createElement('canvas');layer.width=canUse?box.w:1;layer.height=canUse?box.h:1;
  const cg=canUse?layer.getContext('2d'):g;
  cg.save();if(canUse)cg.translate(-box.x,-box.y);
  cg.fillStyle=o.color||'#e23535';cg.globalAlpha=opacity*.13;
  let seed=2166136261;
  const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
  function spray(x,y,pressure=1){
   const radius=width*.5*Math.max(.2,pressure);
   for(let n=0;n<dotsPerStep;n++){
    const a=rand()*Math.PI*2,r=Math.sqrt(rand())*radius;
    const dot=Math.max(.65,width*.025);
    cg.beginPath();cg.arc(x+Math.cos(a)*r,y+Math.sin(a)*r,dot,0,Math.PI*2);cg.fill();
   }
  }
  let prev=pts[0];spray(prev.x,prev.y,prev.pressure||1);
  for(let i=1;i<pts.length;i++){
   const p=pts[i],dx=p.x-prev.x,dy=p.y-prev.y,d=Math.hypot(dx,dy);
   const n=Math.min(600,Math.ceil(d/spacing));
   for(let t=1;t<=n;t++)spray(prev.x+dx*t/n,prev.y+dy*t/n,p.pressure||1);
   prev=p;
  }
  cg.restore();
  cache=canUse?{key,layer,x:box.x,y:box.y}:null;
  if(cache)airbrushCache.set(o,cache);
 }
 if(cache)g.drawImage(cache.layer,cache.x,cache.y);
}
function drawSoftEraser(g,o){
 const pts=o.points||[];if(!pts.length)return;
 const width=Math.max(1,o.width||20),tip=getBrushTip(width,'#000000',0);
 g.save();g.globalCompositeOperation='destination-out';g.globalAlpha=.65;
 const step=Math.max(1,width*.14),half=tip.width/2;
 let prev=pts[0];g.drawImage(tip,prev.x-half,prev.y-half);
 for(const p of pts.slice(1)){
  const d=Math.hypot(p.x-prev.x,p.y-prev.y),n=Math.min(900,Math.ceil(d/step));
  for(let i=1;i<=n;i++){const t=i/n;g.drawImage(tip,prev.x+(p.x-prev.x)*t-half,prev.y+(p.y-prev.y)*t-half)}
  prev=p;
 }
 g.restore();
}
function drawGradient(g,o){
 const a=o.start,b=o.end;
 if(!a||!b)return;
 const distance=Math.hypot(b.x-a.x,b.y-a.y);
 const gradient=o.gradientMode==='radial'
 ?g.createRadialGradient(a.x,a.y,0,a.x,a.y,Math.max(1,distance))
 :g.createLinearGradient(a.x,a.y,b.x+(distance<1?1:0),b.y);
 gradient.addColorStop(0,o.color||'#e23535');
 gradient.addColorStop(1,o.endColor||'#ffffff');
 g.save();g.fillStyle=gradient;g.fillRect(0,0,st.base.width,st.base.height);g.restore();
}
// Rasterize only a stroke's bounds so selection clipping doesn't allocate whole-image layers.
function operationBounds(o,width=0){
 if(o.type==='gradient')return{x:0,y:0,w:st.base.width,h:st.base.height};
 const b=getBounds(o),pad=Math.max(4,Number(width||o.width||2)*2+3);
 const x=Math.max(0,Math.floor(b.x-pad)),y=Math.max(0,Math.floor(b.y-pad));
 return{x,y,w:Math.max(0,Math.min(st.base.width,Math.ceil(b.x+b.w+pad))-x),
 h:Math.max(0,Math.min(st.base.height,Math.ceil(b.y+b.h+pad))-y)};
}
function boundedCanvas(bounds){
 const out=document.createElement('canvas');out.width=bounds.w;out.height=bounds.h;
 return out;
}
function eraseMaskStroke(g,o,left,top){
 const pts=o.points||[];if(!pts.length)return;
 g.save();g.translate(-left,-top);
 g.strokeStyle='#000';g.fillStyle='#000';g.lineWidth=Math.max(1,o.width||20);
 g.lineCap='round';g.lineJoin='round';
 if(o.mode==='soft'){
  const tip=getBrushTip(g.lineWidth,'#000000',0),half=tip.width/2,spacing=Math.max(1,g.lineWidth*.12);
  let prev=pts[0];g.drawImage(tip,prev.x-half,prev.y-half);
  for(const p of pts.slice(1)){
   const n=Math.min(900,Math.ceil(Math.hypot(p.x-prev.x,p.y-prev.y)/spacing));
   for(let i=1;i<=n;i++){const t=i/n;g.drawImage(tip,prev.x+(p.x-prev.x)*t-half,prev.y+(p.y-prev.y)*t-half)}
   prev=p;
  }
 }else{
  g.beginPath();g.moveTo(pts[0].x,pts[0].y);
  for(const point of pts.slice(1))g.lineTo(point.x,point.y);
  g.stroke();
  if(pts.length===1){g.beginPath();g.arc(pts[0].x,pts[0].y,g.lineWidth/2,0,Math.PI*2);g.fill()}
 }
 g.restore();
}
function maskCanvasToSelection(canvas,bounds,selected){
 if(!selected)return true;
 if(selected.w!==st.base.width||selected.h!==st.base.height)return false;
 const g=canvas.getContext('2d',{willReadFrequently:true});
 const pixels=g.getImageData(0,0,bounds.w,bounds.h);
 const {mask,w}=selected;
 let present=false;
 for(let y=0;y<bounds.h;y++){
  const line=(bounds.y+y)*w+bounds.x;
  for(let x=0;x<bounds.w;x++){
   const k=(y*bounds.w+x)*4+3;
   if(!mask[line+x])pixels.data[k]=0;
   else if(pixels.data[k])present=true;
  }
 }
 if(present)g.putImageData(pixels,0,0);
 return present;
}
function patchFromCanvas(canvas,bounds,erasing=false){
 const src=canvas.toDataURL('image/png');patchImages.set(src,canvas);
 return{type:erasing?'erase-region':'patch',src,
  x1:bounds.x,y1:bounds.y,x2:bounds.x+bounds.w,y2:bounds.y+bounds.h,width:1,rotation:0};
}
function clipStrokeToSelection(o,selection){
 const bounds=operationBounds(o);
 if(!bounds.w||!bounds.h||bounds.w*bounds.h>12000000){
  toast('Selected stroke is too large. Zoom in or reduce the selection.');return null;
 }
 const layer=boundedCanvas(bounds),g=layer.getContext('2d');
 if(o.type==='eraser-stroke')eraseMaskStroke(g,o,bounds.x,bounds.y);
 else{g.translate(-bounds.x,-bounds.y);drawObject(g,o)}
 if(!maskCanvasToSelection(layer,bounds,selection))return null;
 return patchFromCanvas(layer,bounds,o.type==='eraser-stroke');
}
function makeGradientPatch(o){
 const bounds={x:0,y:0,w:st.base.width,h:st.base.height};
 if(bounds.w*bounds.h>12000000){toast('Gradient is limited to 12 megapixels. Resize first.');return null}
 const layer=boundedCanvas(bounds);drawGradient(layer.getContext('2d'),o);
 return patchFromCanvas(layer,bounds);
}
function makeClonePatch(o,source,anchor){
 if(!source||!anchor||!o.points?.length)return null;
 const bounds=operationBounds(o);
 if(!bounds.w||!bounds.h||bounds.w*bounds.h>12000000){
  toast('Clone stroke too large. Work on a smaller area.');return null;
 }
 const layer=boundedCanvas(bounds),g=layer.getContext('2d');
 const first=o.points[0];
 const shiftX=anchor.x-first.x,shiftY=anchor.y-first.y;
 g.drawImage(source,shiftX-bounds.x,shiftY-bounds.y);
 g.globalCompositeOperation='destination-in';
 g.strokeStyle='#000';g.fillStyle='#000';g.lineWidth=o.width||12;
 g.lineCap='round';g.lineJoin='round';
 g.beginPath();g.moveTo(first.x-bounds.x,first.y-bounds.y);
 for(const p of o.points.slice(1))g.lineTo(p.x-bounds.x,p.y-bounds.y);
 g.stroke();
 if(o.points.length===1){g.beginPath();g.arc(first.x-bounds.x,first.y-bounds.y,g.lineWidth/2,0,Math.PI*2);g.fill()}
 g.globalCompositeOperation='source-over';
 if(!maskCanvasToSelection(layer,bounds,st.paintSelection))return null;
 return patchFromCanvas(layer,bounds);
}
function makePrivacyPatch(o){
 const b=rectFor(o),x=Math.max(0,Math.floor(b.x)),y=Math.max(0,Math.floor(b.y));
 const w=Math.max(0,Math.min(st.base.width,Math.ceil(b.x+b.w))-x);
 const h=Math.max(0,Math.min(st.base.height,Math.ceil(b.y+b.h))-y);
 if(w<2||h<2||w*h>12000000)return null;
 const bounds={x,y,w,h},layer=boundedCanvas(bounds),g=layer.getContext('2d');
 const source=composite(),strength=Math.max(2,Math.min(30,o.strength||12));
 if(o.mode==='blur'&&typeof g.filter==='string'){
  g.save();g.beginPath();g.rect(0,0,w,h);g.clip();
  g.filter='blur('+strength+'px)';
  g.drawImage(source,-x,-y);g.restore();
 }else{
  const mini=document.createElement('canvas');mini.width=Math.max(1,Math.ceil(w/strength));mini.height=Math.max(1,Math.ceil(h/strength));
  mini.getContext('2d').drawImage(source,x,y,w,h,0,0,mini.width,mini.height);
  g.imageSmoothingEnabled=false;g.drawImage(mini,0,0,w,h);
 }
 if(!maskCanvasToSelection(layer,bounds,st.paintSelection))return null;
 return patchFromCanvas(layer,bounds);
}
function drawObject(g,o){g.save();if(o.cutouts?.length){g.beginPath();g.rect(0,0,st.base.width,st.base.height);for(const area of o.cutouts)g.rect(area.x,area.y,area.w,area.h);g.clip('evenodd')}if(o.rotation){let ctr=objectCenter(o);g.translate(ctr.x,ctr.y);g.rotate(o.rotation);g.translate(-ctr.x,-ctr.y)}let c=o.color||'#e23535';g.lineWidth=o.width||4;g.strokeStyle=c;g.fillStyle=c;g.lineCap='round';g.lineJoin='round';if(o.type==='patch'||o.type==='erase-region'||o.type==='fill-region'){const image=patchImage(o.src);if(o.type==='erase-region')g.globalCompositeOperation='destination-out';if(image&&(image instanceof HTMLCanvasElement||(image.complete&&image.naturalWidth)))g.drawImage(image,Math.min(o.x1,o.x2),Math.min(o.y1,o.y2),Math.abs(o.x2-o.x1),Math.abs(o.y2-o.y1));else if(o.type==='erase-region'&&!o.src){let b=rectFor(o);g.fillRect(b.x,b.y,b.w,b.h)}}else if(o.type==='eraser-stroke'&&o.mode==='soft'){drawSoftEraser(g,o)}else if(o.type==='eraser-stroke'){g.globalCompositeOperation='destination-out';g.strokeStyle='#000';g.fillStyle='#000';g.lineWidth=o.width||20;g.beginPath();const pts=o.points||[];if(pts.length){g.moveTo(pts[0].x,pts[0].y);for(const pt of pts.slice(1))g.lineTo(pt.x,pt.y);if(pts.length===1){g.arc(pts[0].x,pts[0].y,g.lineWidth/2,0,Math.PI*2);g.fill()}else g.stroke()}}else if(o.type==='brush-stroke'){drawPaintbrush(g,o)}else if(o.type==='airbrush-stroke'){drawAirbrush(g,o)}else if(o.type==='gradient'){drawGradient(g,o)}else if(o.type==='clone-preview'){g.save();g.globalAlpha=.3;g.strokeStyle='#358ad2';g.lineWidth=o.width||12;g.beginPath();g.moveTo(o.points[0].x,o.points[0].y);for(const p of o.points.slice(1))g.lineTo(p.x,p.y);g.stroke();g.restore()}else if(o.type==='pencilpath'&&o.pixelMode){drawPencilPixels(g,o.points)}else if(o.type==='path'||o.type==='pencilpath'||o.type==='highlight'||o.type==='polyline'){if(o.points.length){if(o.type==='highlight'){g.globalAlpha=Math.max(.01,Math.min(1,(o.opacity??28)/100));g.lineWidth=Math.max(12,o.width*5)}g.beginPath();g.moveTo(o.points[0].x,o.points[0].y);for(const p of o.points.slice(1))g.lineTo(p.x,p.y);if(o.points.length===1){g.lineTo(o.points[0].x+.01,o.points[0].y+.01)}g.stroke()}}else if(o.type==='number-marker'){
  const bounds=rectFor(o),cx=bounds.x+bounds.w/2,cy=bounds.y+bounds.h/2,radius=Math.max(5,Math.min(bounds.w,bounds.h)/2);
  g.fillStyle=o.color||'#e23535';g.beginPath();g.arc(cx,cy,radius,0,Math.PI*2);g.fill();
  g.strokeStyle='#ffffff';g.lineWidth=Math.max(1,radius*.11);g.stroke();
  const hex=(o.color||'#e23535').replace('#','');
  const val=/^[0-9a-f]{6}$/i.test(hex)?parseInt(hex,16):0;
  const brightness=(((val>>16)&255)*299+((val>>8)&255)*587+(val&255)*114)/1000;
  g.font='bold '+Math.max(10,Math.round(radius*.98))+'px Arial,sans-serif';
  g.textAlign='center';g.textBaseline='middle';g.fillStyle=brightness>165?'#172c42':'#ffffff';
  g.fillText(String(o.number||1),cx,cy);
 }else if(o.type==='text'){
  if(o.noteStyle==='callout'&&o.noteAnchor){
   const b=getBounds(o),r=Math.max(10,Math.min(18,(o.fontSize||16)*.72)),anchor=o.noteAnchor;
   g.save();g.strokeStyle=o.color||'#e23535';g.lineWidth=Math.max(1.5,(o.width||3)*.55);g.setLineDash([]);
   const x=b.x>anchor.x?b.x:b.x+b.w,y=Math.max(b.y+6,Math.min(anchor.y,b.y+b.h-6));
   g.beginPath();g.moveTo(anchor.x,anchor.y);g.lineTo(x,y);g.stroke();
   g.fillStyle=o.color||'#e23535';g.beginPath();g.arc(anchor.x,anchor.y,r,0,Math.PI*2);g.fill();
   g.fillStyle='#ffffff';g.font='bold '+Math.round(r*1.05)+'px Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(String(o.noteNumber||1),anchor.x,anchor.y+.4);g.restore();
  }
  g.font=textFont(o);g.textBaseline='top';g.textAlign=o.align||'left';
  if(o.labelMode==='label'){
   const bounds=getBounds(o),round=o.noteStyle==='sticky'?5:Math.min(11,o.fontSize*.28);
   g.beginPath();
   if(typeof g.roundRect==='function')g.roundRect(bounds.x,bounds.y,bounds.w,bounds.h,round);
   else g.rect(bounds.x,bounds.y,bounds.w,bounds.h);
   g.fillStyle=o.backgroundColor||'#ffffff';g.fill();
   if(o.labelBorder!==false){g.strokeStyle=o.color||'#e23535';g.lineWidth=Math.max(1,o.width||2);g.stroke()}
  }
  g.fillStyle=c;
  o.text.split('\n').forEach((line,i)=>{
   const y=o.y+i*o.fontSize*1.3;
   g.fillText(line,o.x,y);
   if(line&&(o.underline||o.strike)){
    const width=g.measureText(line).width,align=o.align||'left',x=o.x-(align==='center'?width/2:align==='right'?width:0);
    g.save();g.lineWidth=Math.max(1,o.fontSize/16);g.strokeStyle=c;g.beginPath();
    if(o.underline){const underlineY=y+o.fontSize*1.12;g.moveTo(x,underlineY);g.lineTo(x+width,underlineY)}
    if(o.strike){const strikeY=y+o.fontSize*.56;g.moveTo(x,strikeY);g.lineTo(x+width,strikeY)}
    g.stroke();g.restore();
   }
  });
 }else{let b=o.type==='polygon'?getBounds(o):rectFor(o);if(o.type==='icon'){drawIconObject(g,o)}else if(o.type==='redact'){g.fillStyle='#131313';g.fillRect(b.x,b.y,b.w,b.h)}else if(o.type==='rect'){applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);g.beginPath();g.rect(b.x,b.y,b.w,b.h);fillShapePattern(g,o,b);g.stroke()}else if(o.type==='shape'||o.type==='polygon'){applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);drawShapePath(g,o);fillShapePattern(g,o,b);if(o.fillMode!=='filled')g.stroke()}else if(o.type==='ellipse'){applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);g.beginPath();g.ellipse(b.x+b.w/2,b.y+b.h/2,Math.max(.1,b.w/2),Math.max(.1,b.h/2),0,0,Math.PI*2);fillShapePattern(g,o,b);g.stroke()}else if(['arrow','line','curve'].includes(o.type)){const cp=o.control||{x:(o.x1+o.x2)/2,y:(o.y1+o.y2)/2};applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);g.beginPath();g.moveTo(o.x1,o.y1);if(o.type==='curve'){for(const s of curveSegments(o))g.bezierCurveTo(s.c1.x,s.c1.y,s.c2.x,s.c2.y,s.b.x,s.b.y)}else g.lineTo(o.x2,o.y2);g.stroke();g.setLineDash([]);const h1=o.startHead||'none',h2=o.endHead||(o.type==='arrow'?'arrow':'none');drawLineHead(g,o.x1,o.y1,o.type==='curve'?Math.atan2(o.y1-cp.y,o.x1-cp.x):Math.atan2(o.y1-o.y2,o.x1-o.x2),h1,o.width);drawLineHead(g,o.x2,o.y2,o.type==='curve'?Math.atan2(o.y2-cp.y,o.x2-cp.x):Math.atan2(o.y2-o.y1,o.x2-o.x1),h2,o.width);drawConnectorLabel(g,o)}}g.restore()}
function drawConnectorLabel(g,o){
 const text=(o.label||'').trim();if(!text)return;
 const segments=o.type==='curve'?curveSegments(o):null;
 const point=segments?.length?sampleBezier(segments[Math.floor((segments.length-1)/2)],segments.length%2?.5:1):
  {x:(o.x1+o.x2)/2,y:(o.y1+o.y2)/2};
 g.save();g.setLineDash([]);g.font='600 13px Arial,sans-serif';g.textAlign='center';g.textBaseline='middle';
 const width=g.measureText(text).width+15,x=point.x-width/2,y=point.y-21,h=22;
 g.beginPath();if(typeof g.roundRect==='function')g.roundRect(x,y,width,h,5);else g.rect(x,y,width,h);
 g.fillStyle='rgba(255,255,255,.96)';g.fill();g.lineWidth=1;g.strokeStyle='rgba(65,84,110,.4)';g.stroke();
 g.fillStyle='#273e59';g.fillText(text,point.x,y+h/2);g.restore();
}
function drawLineHead(g,x,y,a,mode,width){if(!mode||mode==='none')return;const len=Math.max(13,width*4),spread=.55;g.beginPath();if(mode==='circle'){g.arc(x,y,Math.max(4,width*1.7),0,Math.PI*2);g.fill();return}g.moveTo(x-len*Math.cos(a-spread),y-len*Math.sin(a-spread));g.lineTo(x,y);g.lineTo(x-len*Math.cos(a+spread),y-len*Math.sin(a+spread));if(mode==='filled'){g.closePath();g.fill()}else g.stroke()}
function renderSelection(){
 const indices=selectedIndexes();
 if(indices.length>1){
  const b=unionBounds(indices);
  ctx.save();ctx.strokeStyle='#2375dc';ctx.lineWidth=1.3/st.zoom;ctx.setLineDash([5/st.zoom,4/st.zoom]);
  indices.forEach(i=>{const q=getBounds(st.objects[i]);ctx.strokeRect(q.x,q.y,q.w,q.h)});
  ctx.setLineDash([]);ctx.strokeRect(b.x-3/st.zoom,b.y-3/st.zoom,b.w+6/st.zoom,b.h+6/st.zoom);
  multiHandles().forEach(h=>{ctx.fillStyle='#fff';ctx.fillRect(h.x-5/st.zoom,h.y-5/st.zoom,10/st.zoom,10/st.zoom);ctx.strokeRect(h.x-5/st.zoom,h.y-5/st.zoom,10/st.zoom,10/st.zoom)});
  ctx.restore();return;
 }
 if(st.selected<0||!st.objects[st.selected])return;const o=st.objects[st.selected],b=getBounds(o),c=objectCenter(o),a=o.rotation||0;ctx.save();ctx.translate(c.x,c.y);ctx.rotate(a);ctx.translate(-c.x,-c.y);ctx.strokeStyle='#2375dc';ctx.lineWidth=1.25/st.zoom;ctx.setLineDash([5/st.zoom,4/st.zoom]);ctx.strokeRect(b.x-3/st.zoom,b.y-3/st.zoom,b.w+6/st.zoom,b.h+6/st.zoom);ctx.setLineDash([]);ctx.restore();const hs=handleLocations(o);ctx.save();hs.forEach(v=>{let sz=7/st.zoom;ctx.fillStyle=v.kind==='rotate'?'#0c9d85':v.kind==='note-anchor'?'#f0ba4f':v.kind==='control'?'#9457d7':v.kind.startsWith('endpoint')?'#e9f2ff':'#ffffff';ctx.strokeStyle=v.kind==='note-anchor'?'#a06c1e':v.kind==='control'?'#7036ad':'#2375dc';ctx.lineWidth=1.5/st.zoom;if(v.kind==='rotate'||v.kind==='note-anchor'||v.kind==='control'||v.kind.startsWith('control-')||v.kind.startsWith('vertex-')||v.kind.startsWith('endpoint')){ctx.beginPath();ctx.arc(v.x,v.y,5.5/st.zoom,0,Math.PI*2);ctx.fill();ctx.stroke()}else{ctx.fillRect(v.x-sz/2,v.y-sz/2,sz,sz);ctx.strokeRect(v.x-sz/2,v.y-sz/2,sz,sz)}});ctx.restore()}

function marqueeBounds(){
 const m=st.marquee;if(!m||!st.base)return null;
 let bounds;
 if(m.kind==='lasso'){
  const pts=m.points||[];if(!pts.length)return null;
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  const x=Math.min(...xs),y=Math.min(...ys);
  bounds={x,y,w:Math.max(...xs)-x,h:Math.max(...ys)-y};
 }else bounds=rectFor(m);
 const x=Math.max(0,Math.floor(bounds.x)),y=Math.max(0,Math.floor(bounds.y));
 const right=Math.min(st.base.width,Math.ceil(bounds.x+bounds.w));
 const bottom=Math.min(st.base.height,Math.ceil(bounds.y+bounds.h));
 return {x,y,w:Math.max(0,right-x),h:Math.max(0,bottom-y)}
}
function traceMarquee(g,m){
 if(m.kind==='lasso'){
  const pts=m.points||[];if(!pts.length)return;
  g.moveTo(pts[0].x,pts[0].y);
  for(let i=1;i<pts.length;i++)g.lineTo(pts[i].x,pts[i].y);
  if(pts.length>2)g.closePath();
 }else{
  const b=rectFor(m);
  if(m.kind==='ellipse')g.ellipse(b.x+b.w/2,b.y+b.h/2,Math.max(.01,b.w/2),Math.max(.01,b.h/2),0,0,2*Math.PI);
  else g.rect(b.x,b.y,b.w,b.h);
 }
}
function maskForMarquee(m,r){
 const mask=document.createElement('canvas');mask.width=r.w;mask.height=r.h;
 const g=mask.getContext('2d');g.translate(-r.x,-r.y);g.beginPath();traceMarquee(g,m);g.fillStyle='#fff';g.fill();
 return mask;
}
function eraseSelectionRecord(m,r){
 const o={type:'erase-region',x1:r.x,y1:r.y,x2:r.x+r.w,y2:r.y+r.h};
 if(m.kind!=='rect'){
  const canvas=maskForMarquee(m,r);o.src=canvas.toDataURL('image/png');patchImages.set(o.src,canvas)
 }
 return o;
}
function paintMarquee(){
 const m=st.marquee,r=marqueeBounds();if(!m||!r||!r.w||!r.h)return;
 ctx.save();ctx.beginPath();traceMarquee(ctx,m);
 ctx.strokeStyle='#fff';ctx.lineWidth=2.5/st.zoom;ctx.setLineDash([]);ctx.stroke();
 ctx.strokeStyle='#1676cf';ctx.lineWidth=1.25/st.zoom;ctx.setLineDash([6/st.zoom,4/st.zoom]);ctx.stroke();
 if(m.kind==='rect'){ctx.setLineDash([]);ctx.lineWidth=1/st.zoom;
  ctx.fillStyle='#fff';ctx.strokeStyle='#1676cf';
  for(const [x,y] of [[r.x,r.y],[r.x+r.w,r.y],[r.x,r.y+r.h],[r.x+r.w,r.y+r.h]]){
   ctx.fillRect(x-3/st.zoom,y-3/st.zoom,6/st.zoom,6/st.zoom);
   ctx.strokeRect(x-3/st.zoom,y-3/st.zoom,6/st.zoom,6/st.zoom);
  }
 }
 ctx.restore();
}
function insideMarquee(p){
 const m=st.marquee,r=marqueeBounds();
 if(!m||!r||r.w<2||r.h<2)return false;
 if(m.kind==='ellipse'){
  const b=rectFor(m),rx=b.w/2,ry=b.h/2;
  return rx>0&&ry>0&&((p.x-b.x-rx)/rx)**2+((p.y-b.y-ry)/ry)**2<=1;
 }
 if(m.kind==='lasso'){
  const pts=m.points||[];let inside=false;
  for(let i=0,j=pts.length-1;i<pts.length;j=i++){
   const a=pts[i],b=pts[j];
   if(((a.y>p.y)!==(b.y>p.y))&&(p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
  }
  return inside;
 }
 return p.x>=r.x&&p.y>=r.y&&p.x<=r.x+r.w&&p.y<=r.y+r.h;
}
function liftMarquee(){
 const m=st.marquee,r=marqueeBounds();if(!m||!r||r.w<2||r.h<2)return false;
 const source=composite(),patch=document.createElement('canvas');patch.width=r.w;patch.height=r.h;
 const pg=patch.getContext('2d');pg.drawImage(source,r.x,r.y,r.w,r.h,0,0,r.w,r.h);
 if(m.kind!=='rect'){
  pg.globalCompositeOperation='destination-in';pg.drawImage(maskForMarquee(m,r),0,0);
  pg.globalCompositeOperation='source-over';
 }
 const src=patch.toDataURL('image/png');patchImages.set(src,patch);
 st.objects.push(eraseSelectionRecord(m,r));
 st.objects.push({type:'patch',src,x1:r.x,y1:r.y,x2:r.x+r.w,y2:r.y+r.h,color:'#fff',width:1,layerId:st.activeLayerId});
 st.selected=st.objects.length-1;st.marquee=null;updateContextOptions();return true;
}
// Convert pixel selections to binary masks, preserving rectangular, elliptical and lasso boundaries.
function maskOverlay(mask,w,h){
 const overlay=document.createElement('canvas');overlay.width=w;overlay.height=h;
 const g=overlay.getContext('2d'),pixels=g.createImageData(w,h);
 for(let i=0;i<mask.length;i++){
  if(!mask[i])continue;
  const x=i%w,y=(i/w)|0,k=i*4;
  const edge=x===0||y===0||x===w-1||y===h-1||!mask[i-1]||!mask[i+1]||!mask[i-w]||!mask[i+w];
  pixels.data[k]=edge?26:62;pixels.data[k+1]=edge?88:145;
  pixels.data[k+2]=230;pixels.data[k+3]=edge?235:52;
 }
 g.putImageData(pixels,0,0);return overlay;
}
function pixelSelectionMask(){
 if(!st.base)return null;
 const w=st.base.width,h=st.base.height;
 if(st.wand)return {w,h,mask:st.wand.mask.slice()};
 if(!st.marquee)return null;
 const mask=new Uint8Array(w*h),r=marqueeBounds();
 if(!r||!r.w||!r.h)return null;
 if(st.marquee.kind==='rect'){
  for(let y=r.y;y<r.y+r.h;y++)mask.fill(1,y*w+r.x,y*w+r.x+r.w);
 }else{
  const shape=maskForMarquee(st.marquee,r);
  const data=shape.getContext('2d',{willReadFrequently:true}).getImageData(0,0,r.w,r.h).data;
  for(let y=0;y<r.h;y++)for(let x=0;x<r.w;x++){
   if(data[(y*r.w+x)*4+3])mask[(y+r.y)*w+x+r.x]=1;
  }
 }
 return {w,h,mask};
}
function invertSelection(){
 if(!st.base){toast('Open an image first.');return false}
 if(st.base.width*st.base.height>12000000){toast('Invert Selection supports up to 12 megapixels.');return false}
 const data=pixelSelectionMask();
 if(!data){toast('Select pixels using Rectangle, Ellipse, Lasso, or Magic Wand first.');return false}
 const {w,h,mask}=data;let count=0;
 for(let i=0;i<mask.length;i++){mask[i]=mask[i]?0:1;count+=mask[i]}
 st.wand={mask,overlay:maskOverlay(mask,w,h),count,w,h,x:0,y:0,source:'inverted'};
 st.marquee=null;st.selected=-1;st.transform=null;
 updateContextOptions();paint();
 toast(`Selection inverted · ${count.toLocaleString()} pixels selected`);
 return true;
}
function wandSelection(x,y){const source=composite(),w=source.width,h=source.height,n=w*h;if(n>12000000){toast('Magic Wand supports images up to 12 megapixels.');return}const rgba=source.getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data,seed=(Math.floor(y)*w+Math.floor(x));const si=Math.max(0,Math.min(n-1,seed))*4,rr=rgba[si],gg=rgba[si+1],bb=rgba[si+2],aa=rgba[si+3],threshold=st.wandTolerance/100*255;const isMatch=i=>{const k=i*4;return Math.max(Math.abs(rgba[k]-rr),Math.abs(rgba[k+1]-gg),Math.abs(rgba[k+2]-bb),Math.abs(rgba[k+3]-aa))<=threshold};const mask=new Uint8Array(n);let count=0;if(st.wandMode==='global'){for(let i=0;i<n;i++){if(isMatch(i)){mask[i]=1;count++}}}else{const queue=new Int32Array(n);let front=0,back=0;queue[back++]=Math.max(0,Math.min(n-1,seed));mask[Math.max(0,Math.min(n-1,seed))]=1;while(front<back){const i=queue[front++];count++;const x=i%w,y=(i/w)|0;for(const pos of [x>0?i-1:-1,x<w-1?i+1:-1,y>0?i-w:-1,y<h-1?i+w:-1]){if(pos>=0&&!mask[pos]&&isMatch(pos)){mask[pos]=1;queue[back++]=pos}}}}if(!count){st.wand=null;paint();return}const overlay=maskOverlay(mask,w,h);st.wand={mask,overlay,count,w,h,x,y,source:'wand'};updateContextOptions();paint();toast(`${count.toLocaleString()} pixels selected`)}
// Both tools sample the visible result; the bucket changes only the raster base, so vector annotations stay editable.
function sampleColor(x,y){if(!st.base)return;const pixel=composite().getContext('2d').getImageData(Math.min(st.base.width-1,Math.max(0,Math.floor(x))),Math.min(st.base.height-1,Math.max(0,Math.floor(y))),1,1).data;const hex='#'+[pixel[0],pixel[1],pixel[2]].map(n=>n.toString(16).padStart(2,'0')).join('');setColor(hex);toast('Sampled '+hex+' · choose Brush or Fill Bucket to use it')}
function fillBucket(x,y,invertMode=false){
 if(!st.base)return;
 const w=st.base.width,h=st.base.height,n=w*h;
 if(n>12000000){toast('Fill Bucket supports images up to 12 megapixels.');return}
 const mode=invertMode?(st.fillMode==='contiguous'?'global':'contiguous'):st.fillMode;
 const pixels=composite().getContext('2d',{willReadFrequently:true}).getImageData(0,0,w,h).data;
 const selected=pixelSelectionMask()?.mask;
 const seed=Math.max(0,Math.min(n-1,Math.floor(y)*w+Math.floor(x))),q=seed*4;
 const rr=pixels[q],gg=pixels[q+1],bb=pixels[q+2],aa=pixels[q+3],tolerance=st.fillTolerance*2.55;
 const matches=i=>{if(selected&&!selected[i])return false;const k=i*4;return Math.max(Math.abs(pixels[k]-rr),Math.abs(pixels[k+1]-gg),Math.abs(pixels[k+2]-bb),Math.abs(pixels[k+3]-aa))<=tolerance};
 const color=st.color,cr=parseInt(color.slice(1,3),16),cg=parseInt(color.slice(3,5),16),cb=parseInt(color.slice(5,7),16);
 const mask=new Uint8Array(n);let count=0,changed=0,minX=w,minY=h,maxX=0,maxY=0;
 const write=i=>{const k=i*4;mask[i]=1;count++;if(pixels[k]!==cr||pixels[k+1]!==cg||pixels[k+2]!==cb||pixels[k+3]!==255)changed++;const xx=i%w,yy=(i/w)|0;minX=Math.min(minX,xx);minY=Math.min(minY,yy);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,yy)};
 if(mode==='global'){for(let i=0;i<n;i++)if(matches(i))write(i)}
 else{const visited=new Uint8Array(n),queue=new Int32Array(n);let head=0,tail=0;visited[seed]=1;queue[tail++]=seed;
   while(head<tail){const i=queue[head++];if(!matches(i))continue;write(i);const col=i%w,row=(i/w)|0;
    if(col>0&&!visited[i-1]){visited[i-1]=1;queue[tail++]=i-1}
    if(col+1<w&&!visited[i+1]){visited[i+1]=1;queue[tail++]=i+1}
    if(row>0&&!visited[i-w]){visited[i-w]=1;queue[tail++]=i-w}
    if(row+1<h&&!visited[i+w]){visited[i+w]=1;queue[tail++]=i+w}
   }
 }
 if(!changed){toast('This area already uses the selected color.');return}
 const pw=maxX-minX+1,ph=maxY-minY+1,patch=document.createElement('canvas');patch.width=pw;patch.height=ph;
 const g=patch.getContext('2d'),data=g.createImageData(pw,ph);
 for(let yy=minY;yy<=maxY;yy++)for(let xx=minX;xx<=maxX;xx++)if(mask[yy*w+xx]){
   const k=((yy-minY)*pw+xx-minX)*4;data.data[k]=cr;data.data[k+1]=cg;data.data[k+2]=cb;data.data[k+3]=255;
 }
 g.putImageData(data,0,0);const src=patch.toDataURL('image/png');patchImages.set(src,patch);
 st.objects.push({type:'fill-region',src,x1:minX,y1:minY,x2:maxX+1,y2:maxY+1,layerId:st.activeLayerId});snapshot();paint();
 toast(`Filled ${count.toLocaleString()} pixels · ${mode==='global'?'Global':'Contiguous'} · Undo to revert`);
}
function clearWandPixels(){
 if(!st.wand||!st.base)return false;
 const {mask,w,h,count}=st.wand;let minX=w,minY=h,maxX=-1,maxY=-1;
 for(let i=0;i<mask.length;i++)if(mask[i]){let x=i%w,y=(i/w)|0;minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y)}
 if(maxX<minX)return false;
 const width=maxX-minX+1,height=maxY-minY+1,patch=document.createElement('canvas');patch.width=width;patch.height=height;
 const pg=patch.getContext('2d'),pixels=pg.createImageData(width,height);
 for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++)if(mask[y*w+x])pixels.data[((y-minY)*width+x-minX)*4+3]=255;
 pg.putImageData(pixels,0,0);const src=patch.toDataURL('image/png');patchImages.set(src,patch);
 st.objects.push({type:'erase-region',src,x1:minX,y1:minY,x2:maxX+1,y2:maxY+1,layerId:st.activeLayerId});
 st.wand=null;st.selected=-1;st.marquee=null;snapshot();updateContextOptions();paint();toast(`Cleared ${count.toLocaleString()} pixels to transparency · Undo to restore`);return true;
}
function hasSelection(){return !!(st.wand||st.marquee||selectedIndexes().length)}
function deselect(){st.marquee=null;st.wand=null;st.selected=-1;st.multiSelection=[];st.guides=[];st.objectMarquee=null;st.transform=null;updateContextOptions();paint()}
function deleteSelection(){
 if(!st.base||!hasSelection()){toast('Select an object or area first.');return false}
 if(st.wand){if(!requireEditableLayer())return false;return clearWandPixels()}
 if(st.marquee){
   if(!requireEditableLayer())return false;
   const r=marqueeBounds();if(!r||r.w<2||r.h<2)return false;
   st.objects.push({...eraseSelectionRecord(st.marquee,r),layerId:st.activeLayerId});st.marquee=null;st.selected=-1;
   snapshot();updateContextOptions();paint();toast('Area cleared to transparency · Undo to restore');return true;
 }
 if(selectedIndexes().length){
   selectedIndexes().sort((a,b)=>b-a).forEach(i=>st.objects.splice(i,1));st.selected=-1;st.multiSelection=[];
   snapshot();updateContextOptions();paint();toast('Object deleted · Undo to restore');return true;
 }
 return false;
}
// Render only the selected object or pixels into a transparent PNG.
let internalSelection=null;let internalEditableObject=null; // Preserve editable objects for in-app paste.
function selectedPixelsCanvas(){
 if(!st.base||!hasSelection())return null;
 let x=0,y=0,w=0,h=0,object=null;
 if(st.wand){
  const {mask,w:mw,h:mh}=st.wand;
  let left=mw,top=mh,right=-1,bottom=-1;
  for(let i=0;i<mask.length;i++)if(mask[i]){
   const px=i%mw,py=Math.floor(i/mw);
   left=Math.min(left,px);top=Math.min(top,py);right=Math.max(right,px);bottom=Math.max(bottom,py);
  }
  if(right<left)return null;
  x=left;y=top;w=right-left+1;h=bottom-top+1;
 }else if(st.marquee){
  const bounds=marqueeBounds();
  if(!bounds||bounds.w<1||bounds.h<1)return null;
  ({x,y,w,h}=bounds);
 }else{
  object=st.objects[st.selected];if(!object)return null;
  const all=selectedIndexes(),b=all.length>1?unionBounds(all):getBounds(object),center=objectCenter(object),angle=all.length>1?0:object.rotation||0;
  const corners=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(([px,py])=>spin({x:px,y:py},center,angle));if(object.noteAnchor)corners.push(object.noteAnchor);
  const pad=Math.max(4,(object.width||1)*3);
  const left=Math.min(...corners.map(p=>p.x))-pad,top=Math.min(...corners.map(p=>p.y))-pad;
  const right=Math.max(...corners.map(p=>p.x))+pad,bottom=Math.max(...corners.map(p=>p.y))+pad;
  x=Math.max(0,Math.floor(left));y=Math.max(0,Math.floor(top));
  w=Math.min(st.base.width,Math.ceil(right))-x;h=Math.min(st.base.height,Math.ceil(bottom))-y;
 }
 if(w<=0||h<=0)return null;
 const output=document.createElement('canvas');output.width=w;output.height=h;
 const g=output.getContext('2d',{willReadFrequently:!!st.wand});
 g.save();g.translate(-x,-y);
 if(object){for(const i of selectedIndexes())drawObject(g,st.objects[i])}
 else{
  if(st.marquee){g.beginPath();traceMarquee(g,st.marquee);g.clip()}
  g.drawImage(composite(),0,0);
 }
 g.restore();
 if(st.wand){
  const {mask,w:mw}=st.wand,pixels=g.getImageData(0,0,w,h);
  for(let row=0;row<h;row++)for(let col=0;col<w;col++){
   if(!mask[(row+y)*mw+col+x])pixels.data[(row*w+col)*4+3]=0;
  }
  g.putImageData(pixels,0,0);
 }
 return output;
}
async function copySelectedPixels(){
 const selected=selectedPixelsCanvas();
 if(!selected){toast('Select an area or object first.');return}
 internalSelection=selected;internalEditableObject=selectedIndexes().length>1?selectedIndexes().map(i=>copyObj(st.objects[i])):st.selected>=0?copyObj(st.objects[st.selected]):null;
 try{
  if(!navigator.clipboard?.write||!window.ClipboardItem)throw new Error('Clipboard write unavailable');
  // Supply the PNG promise immediately to preserve user activation on mobile Safari.
  const png=new Promise((resolve,reject)=>selected.toBlob(blob=>blob?resolve(blob):reject(new Error('PNG conversion failed')),'image/png'));
  await navigator.clipboard.write([new ClipboardItem({'image/png':png})]);
  toast('Selection copied. Use Paste Selection to insert it.');
 }catch(error){
  console.warn('System clipboard unavailable',error);
  toast('Selection copied inside Paint. Use Paste Selection to insert it.');
 }
}
function composite(){const out=document.createElement('canvas');out.width=st.base.width;out.height=st.base.height;renderLayered(out.getContext('2d'));return out}
function paint(){if(!st.base)return;ctx.clearRect(0,0,st.base.width,st.base.height);renderLayered(ctx,st,st.draft);renderSketchGrid();if(st.wand)ctx.drawImage(st.wand.overlay,0,0);renderSelection();drawObjectMarquee();renderGuides();paintMarquee();$('#selectionActions').hidden=!(st.wand||st.marquee||st.selected>=0);if(st.crop){let b=rectFor(st.crop);ctx.save();ctx.fillStyle='#10223d55';ctx.fillRect(0,0,st.base.width,st.base.height);ctx.clearRect(b.x,b.y,b.w,b.h);ctx.drawImage(composite(),b.x,b.y,b.w,b.h,b.x,b.y,b.w,b.h);ctx.strokeStyle='#fff';ctx.lineWidth=2/st.zoom;ctx.setLineDash([8/st.zoom,5/st.zoom]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.restore()}updateUI();const move=$('#layerMoveSelection');if(move)move.disabled=!selectedIndexes().length||!$('#layerMoveTarget').children.length;
 const extract=$('#layerSelectionNew'),duplicate=$('#layerSelectionCopy');if(extract){extract.disabled=!selectedIndexes().length;duplicate.disabled=!selectedIndexes().length}}
function textIsEditing(){return el.text.style.display==='block'}
function syncTextEditorLayout(){
 if(!textIsEditing())return;
 const field=el.text,move=$('#textMoveHandle'),scale=st.zoom,px=Math.max(16,st.fontSize*scale);
 field.style.fontSize=px+'px';field.style.fontFamily=st.fontFamily;
 field.style.fontWeight=st.fontBold?'bold':'normal';field.style.fontStyle=st.fontItalic?'italic':'normal';
 field.style.textDecoration=[st.fontUnderline?'underline':'',st.fontStrike?'line-through':''].filter(Boolean).join(' ')||'none';
 field.style.textAlign=st.textAlign;field.style.color=st.color;
 field.style.background=st.textMode==='label'?st.labelBackground:'rgba(255,255,255,.10)';
 field.style.border=st.textMode==='label'&&st.labelBorder?'1px solid '+st.color:'1px solid transparent';
 const lines=field.value.split('\n'),font={fontFamily:st.fontFamily,fontSize:px,bold:st.fontBold,italic:st.fontItalic};
 ctx.save();ctx.font=textFont(font);
 const width=Math.max(84,Math.ceil(Math.max(...lines.map(l=>ctx.measureText(l||' ').width))+12));
 ctx.restore();
 const height=Math.max(26,Math.ceil(lines.length*px*1.3+5));
 const x=Number(field.dataset.x)*scale,y=Number(field.dataset.y)*scale;
 const left=x-(st.textAlign==='center'?width/2:st.textAlign==='right'?width:0);
 field.style.left=left+'px';field.style.top=y+'px';field.style.width=width+'px';field.style.height=height+'px';
 move.style.left=left+width-7+'px';move.style.top=y+height+5+'px';
}
function finishText(commit){
 if(!textIsEditing())return;
 const field=el.text,val=field.value.replace(/\r\n?/g,'\n'),x=Number(field.dataset.x),y=Number(field.dataset.y);
 const editing=st.editingOriginal,prior=editing?.object;
 field.style.display='none';$('#textMoveHandle').hidden=true;field.value='';
 st.editingOriginal=null;
 if(commit&&/\S/.test(val)){
  const isNote=!!(prior?.noteStyle||st.tool==='note');
  const newObj={type:'text',objectId:prior?.objectId||objectId(),noteTargetId:prior?.noteTargetId,layerId:prior?.layerId||st.activeLayerId,x,y,text:val,fontSize:st.fontSize,color:st.color,width:prior?.width??st.width,fontFamily:st.fontFamily,bold:st.fontBold,italic:st.fontItalic,underline:st.fontUnderline,strike:st.fontStrike,align:st.textAlign,rotation:prior?.rotation||0,labelMode:isNote?'label':st.textMode==='label'?'label':'plain',backgroundColor:isNote?(prior?.backgroundColor||'#fff9d9'):st.labelBackground,labelBorder:isNote?true:st.labelBorder};
  if(isNote){newObj.noteStyle=prior?.noteStyle||st.noteMode;newObj.noteAnchor=prior?.noteAnchor?copyObj(prior.noteAnchor):copyObj(st.noteAnchor||{x:x-36,y:y+8});newObj.noteNumber=prior?.noteNumber||st.noteNumber||1;newObj.backgroundColor=prior?.backgroundColor||'#fff9d9'}
  if(editing)st.objects.splice(editing.index,0,newObj);else st.objects.push(newObj);
  if(!editing||JSON.stringify(prior)!==JSON.stringify(newObj))snapshot();
 }else if(editing)st.objects.splice(editing.index,0,prior);
 st.noteAnchor=null;st.noteNumber=null;st.selected=-1;updateContextOptions();paint();
}
function showText(x,y,existing){
 if(!st.base)return;
 finishText(true);
 const field=el.text;let value='';
 if(existing>=0){
  const o=st.objects[existing];value=o.text;x=o.x;y=o.y;
  st.editingOriginal={object:copyObj(o),index:existing};
  st.fontSize=o.fontSize;st.fontFamily=o.fontFamily||'Arial';
  st.fontBold=!!o.bold;st.fontItalic=!!o.italic;st.fontUnderline=!!o.underline;st.fontStrike=!!o.strike;
  st.textAlign=o.align||'left';st.textMode=o.labelMode||'plain';if(o.noteStyle){st.noteMode=o.noteStyle;st.noteAnchor=copyObj(o.noteAnchor);st.noteNumber=o.noteNumber}
  st.labelBackground=o.backgroundColor||'#ffffff';st.labelBorder=o.labelBorder!==false;
  st.color=o.color;$('#topColor').value=st.color;syncColorWheel(st.color);
  $('#textBackground').value=st.labelBackground;$('#textBorder').checked=st.labelBorder;
  $('#fontSize').value=st.fontSize;$('#fontFamily').value=st.fontFamily;
  st.objects.splice(existing,1);st.selected=-1;
 }
 field.dataset.x=x;field.dataset.y=y;
 field.value=value;field.style.display='block';$('#textMoveHandle').hidden=false;
 syncTextEditorLayout();updateContextOptions();
 field.focus({preventScroll:true});field.setSelectionRange(value.length,value.length);paint();
}
function updateDraft(p,shift){if(!st.draft)return;if(st.draft.points){st.draft.points.push(p)}else{let a=st.draft,b={...p};if(shift&&(a.type==='rect'||a.type==='ellipse'||a.type==='shape')){let s=Math.max(Math.abs(b.x-a.x1),Math.abs(b.y-a.y1));b.x=a.x1+Math.sign(b.x-a.x1||1)*s;b.y=a.y1+Math.sign(b.y-a.y1||1)*s}if(shift&&(a.type==='arrow'||a.type==='line')){let ang=Math.atan2(b.y-a.y1,b.x-a.x1),snap=Math.round(ang/(Math.PI/4))*(Math.PI/4),length=Math.hypot(b.x-a.x1,b.y-a.y1);b.x=a.x1+length*Math.cos(snap);b.y=a.y1+length*Math.sin(snap)}a.x2=b.x;a.y2=b.y}}
// Cursor feedback is specific to the transform handle, including object rotation.
const rotateCursor='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M22 13a9 9 0 1 0-3 7" fill="none" stroke="#143c72" stroke-width="2.8" stroke-linecap="round"/><path d="m18 6 5 7 3-7" fill="#fff" stroke="#143c72" stroke-width="2" stroke-linejoin="round"/></svg>')+'") 14 14, crosshair';
function cursorForHandle(handle,object){
 if(handle==='rotate')return rotateCursor;
 if(handle==='note-anchor'||handle==='control'||handle.startsWith('control-')||handle.startsWith('vertex-'))return 'move';if(handle==='endpoint-start'||handle==='endpoint-end')return 'crosshair';
 const angles={e:0,ne:-45,n:-90,nw:-135,w:180,sw:135,s:90,se:45};
 const deg=(angles[handle]+(object?.rotation||0)*180/Math.PI+1800)%180;
 return ['ew-resize','nwse-resize','ns-resize','nesw-resize'][Math.round(deg/45)%4];
}
function updateSelectCursor(e){
 if(!st.base||!['select','shape','curve'].includes(st.tool)||st.dragging||e.pointerType==='touch')return;
 if(st.tool!=='select'&&!(st.selected>=0&&st.objects[st.selected]&&(st.tool==='curve'?st.objects[st.selected].type==='curve':['shape','polygon'].includes(st.objects[st.selected].type))))return;
 const p=nearest(e),handle=selectedHandle(p);
 if(handle){el.canvas.style.cursor=cursorForHandle(handle,st.objects[st.selected]);return}
 if(st.marquee&&insideMarquee(p)){el.canvas.style.cursor='grab';return}
 const hit=findObject(p.x,p.y);
 el.canvas.style.cursor=hit>=0&&(st.selectionShape==='smart'||(hit===st.selected&&st.objects[hit]?.type==='patch'))?'grab':'crosshair';
}

// Optional rough-sketch cleanup. Conservative confidence thresholds preserve deliberate doodles.
function recognizeSketch(o){
 const pts=o.points||[];if(pts.length<8||!['brush-stroke','pencilpath'].includes(o.type))return null;
 const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),x=Math.min(...xs),y=Math.min(...ys),w=Math.max(...xs)-x,h=Math.max(...ys)-y;
 const diagonal=Math.hypot(w,h);if(diagonal<18)return null;
 const start=pts[0],end=pts.at(-1),travel=Math.hypot(end.x-start.x,end.y-start.y);
 const meanLine=pts.reduce((sum,p)=>sum+distanceToSegment(p,start,end),0)/pts.length;
 const span=pts.slice(1).reduce((sum,p,i)=>sum+Math.hypot(p.x-pts[i].x,p.y-pts[i].y),0);
 if(travel>diagonal*.72&&meanLine<Math.max(3,diagonal*.065)&&span<Math.max(travel*1.65,30))
  return{type:'line',x1:start.x,y1:start.y,x2:end.x,y2:end.y,color:o.color,width:o.width,strokeStyle:'solid',startHead:'none',endHead:'none'};
 const closeEnough=travel<Math.max(13,Math.min(w,h)*.27);
 if(!closeEnough||w<18||h<18||Math.max(w,h)/Math.min(w,h)>7)return null;
 const edgeError=pts.reduce((sum,p)=>sum+Math.min(p.x-x,x+w-p.x,p.y-y,y+h-p.y),0)/(pts.length*Math.min(w,h));
 const ellipseError=pts.reduce((sum,p)=>sum+Math.abs(Math.hypot((p.x-x-w/2)/(w/2),(p.y-y-h/2)/(h/2))-1),0)/pts.length;
 const data={x1:x,y1:y,x2:x+w,y2:y+h,color:o.color,width:o.width,fill:false,fillMode:'outline',strokeStyle:'solid'};
 if(edgeError<.115&&edgeError*3<ellipseError)return{type:'rect',...data};
 if(ellipseError<.21)return{type:'ellipse',...data};
 if(edgeError<.075)return{type:'rect',...data};
 return null;
}

function finishShapeEdit(){st.transform=null;st.selected=-1;updateContextOptions();paint()}
function pointerDown(e){
 if(!st.base||e.button!==0)return;
 if(el.text.style.display!=='none')finishText(true);
 const p=nearest(e);
 if(st.tool==='zoom'){zoomAt(e.altKey?1/1.35:1.35,e.clientX,e.clientY);return}
 if(!['select','pan','zoom','picker','wand','crop'].includes(st.tool)&&!requireEditableLayer())return;
 if((st.tool==='shape'||st.tool==='curve')&&st.selected>=0&&!st.polygonDraft){
   const o=st.objects[st.selected],compatible=st.tool==='curve'?o?.type==='curve':['shape','polygon'].includes(o?.type);
   if(compatible){
    const handle=selectedHandle(p),hit=findObject(p.x,p.y)===st.selected;
    if(handle||hit){
     st.pointer=p;st.dragging=true;st.moving=false;
     st.transform={mode:handle||'move',original:copyObj(o),origin:p,center:objectCenter(o),bounds:getBounds(o)};
     try{el.canvas.setPointerCapture(e.pointerId)}catch(_){}
     el.canvas.style.cursor=handle?cursorForHandle(handle,o):'grabbing';
     return;
    }
   }
   finishShapeEdit();
  }
  if(st.tool==='line'&&st.lineMode==='polyline'){
  if(!st.polylineDraft)st.polylineDraft={type:'polyline',points:[],color:st.color,width:st.width,strokeStyle:st.lineStrokeStyle};
  const last=st.polylineDraft.points.at(-1);
  if(!last||Math.hypot(last.x-p.x,last.y-p.y)>=1)st.polylineDraft.points.push(p);
  st.draft={...st.polylineDraft,points:[...st.polylineDraft.points,p]};
  updateContextOptions();paint();return;
 }
 if(st.tool==='clone'&&(e.altKey||st.clonePicking)){
  st.cloneSource={x:p.x,y:p.y};st.clonePicking=false;updateContextOptions();toast('Clone source set. Paint where you want to copy pixels.');return;
 }
 if(st.tool==='wand'){st.selected=-1;st.marquee=null;wandSelection(p.x,p.y,e.shiftKey);return}
 if(st.tool==='bucket'&&st.fillType==='solid'){st.selected=-1;fillBucket(p.x,p.y,e.shiftKey);return}
 if(st.tool==='picker'){sampleColor(p.x,p.y);return}
 if(st.tool==='note'){
  e.preventDefault();st.noteAnchor={x:p.x,y:p.y};
  st.noteNumber=Math.max(0,...st.objects.filter(o=>o.noteStyle).map(o=>o.noteNumber||0))+1;
  st.fontSize=Math.min(22,Math.max(14,st.fontSize));st.fontFamily='Arial';st.textAlign='left';st.textMode='label';st.labelBackground='#fff9d9';st.labelBorder=true;
  showText(p.x+(st.noteMode==='callout'?37:0),p.y+(st.noteMode==='callout'?-9:0));return;
 }
 if(st.tool==='text'&&st.textMode==='number'){
  const size=Math.max(24,st.fontSize+12),number=Math.max(0,...st.objects.filter(x=>x.type==='number-marker').map(x=>Number(x.number)||0))+1;
  const radius=size/2;
  st.objects.push({type:'number-marker',x1:p.x-radius,y1:p.y-radius,x2:p.x+radius,y2:p.y+radius,number,color:st.color,width:2,rotation:0});
  st.selected=st.objects.length-1;snapshot();paint();
  toast('Marker '+number+' placed · Select to move or resize');return;
 }
 if(st.tool==='shape'&&['custom','customSmooth'].includes(st.shapeKind)){
   if(!st.polygonDraft)st.polygonDraft={type:'polygon',points:[],smooth:st.shapeKind==='customSmooth',fill:st.fillModeShape!=='outline',fillMode:st.fillModeShape,fillColor:st.secondaryColor,strokeStyle:st.shapeStrokeStyle,color:st.color,width:st.width};
   const poly=st.polygonDraft,first=poly.points[0];
   if(st.shapeMethod==='trace'){
    poly.points=[p];st.pointer=p;st.dragging=true;st.freeformTracing=true;st.draft={...poly,points:[p]};
    try{el.canvas.setPointerCapture(e.pointerId)}catch(_){}paint();return;
   }
   if(first&&poly.points.length>=3&&Math.hypot(first.x-p.x,first.y-p.y)<Math.max(9,12/st.zoom)){finishPolygon();return}
   if(!poly.points.length||Math.hypot(poly.points.at(-1).x-p.x,poly.points.at(-1).y-p.y)>=1)poly.points.push(p);
   st.draft={...poly,points:[...poly.points,p]};updateContextOptions();paint();return;
  }
 st.pointer=p;st.dragging=true;st.moving=false;
 st.paintSelection=(st.wand||st.marquee)?pixelSelectionMask():null;
 if(st.tool==='pan'){st.panning={x:e.clientX,y:e.clientY,left:el.work.scrollLeft,top:el.work.scrollTop};el.canvas.style.cursor='grabbing'}
 else if(st.tool==='select'){
  st.wand=null;
  const hit=findObject(p.x,p.y),handle=selectedHandle(p,e.pointerType);
  if((e.shiftKey||st.multiPick)&&hit>=0){selectHit(hit,true);st.dragging=false;st.transform=null;return}
  if(e.shiftKey&&hit<0){
   st.marquee=null;st.objectMarquee={x1:p.x,y1:p.y,x2:p.x,y2:p.y};st.transform={mode:'object-marquee',origin:p};
  }else if(st.marquee&&insideMarquee(p)){
   if(liftMarquee()){st.multiSelection=[st.selected];st.transform={mode:'move',original:copyObj(st.objects[st.selected]),origin:p,center:objectCenter(st.objects[st.selected]),bounds:getBounds(st.objects[st.selected])};st.originalObject=copyObj(st.objects[st.selected]);st.moving=false}
  }else{
   st.marquee=null;
   if(handle&&st.selected>=0){
    st.transform={mode:handle,origin:p,center:objectCenter(st.objects[st.selected]),bounds:unionBounds(selectedIndexes()),original:copyObj(st.objects[st.selected])};
   }else if(hit>=0&&st.selectionShape==='smart'){
    if(!selectedIndexes().includes(hit))selectHit(hit);
    st.transform={mode:'move',origin:p,center:objectCenter(st.objects[st.selected]),bounds:unionBounds(selectedIndexes()),original:copyObj(st.objects[st.selected])};
   }else{
    st.selected=-1;st.multiSelection=[];st.guides=[];
    const kind=st.selectionShape==='smart'?'rect':st.selectionShape;
    st.marquee={kind,x1:p.x,y1:p.y,x2:p.x,y2:p.y,...(kind==='lasso'?{points:[p]}:{})};
    st.transform={mode:'marquee',origin:p};
   }
   if(st.transform&&st.selected>=0)st.originalObject=copyObj(st.objects[st.selected]);
  }
  if(st.transform&&st.selected>=0&&!['marquee','object-marquee'].includes(st.transform.mode)){
   const ids=selectedIndexes();
   if(e.altKey&&st.transform.mode==='move'){
    const group='group-'+Date.now(),clones=ids.map(i=>{const o=copyObj(st.objects[i]);if(o.groupId)o.groupId=group;return o}),first=st.objects.length;
    st.objects.push(...clones);st.selected=first+clones.length-1;st.multiSelection=clones.map((_,i)=>first+i);st.duplicating=true;
   }
   const indices=selectedIndexes();st.transform.indices=indices;
   st.transform.originals=Object.fromEntries(indices.map(i=>[i,copyObj(st.objects[i])]));
   st.transform.bounds=unionBounds(indices);
   st.transform.center={x:st.transform.bounds.x+st.transform.bounds.w/2,y:st.transform.bounds.y+st.transform.bounds.h/2};
  }
  updateContextOptions();
  if(st.transform?.mode==='move')el.canvas.style.cursor='grabbing';
  else if(st.selected>=0&&st.transform?.mode!=='marquee')el.canvas.style.cursor=cursorForHandle(st.transform.mode,st.objects[st.selected]);
 }
 else if(st.tool==='erase'){st.selected=-1;st.draft={type:'eraser-stroke',points:[p],width:Math.max(1,st.width),mode:st.eraserMode};}
 else if(st.tool==='bucket'&&st.fillType==='gradient'){
  st.draft={type:'gradient',start:p,end:p,color:st.color,endColor:st.gradientEndColor,gradientMode:st.gradientMode};
 }
 else if(st.tool==='clone'){
  if(!st.cloneSource){st.dragging=false;toast('Choose a clone source first (Set source or Alt-click).');return}
  st.cloneBase=composite();st.draft={type:'clone-preview',points:[p],width:Math.max(2,st.width)};
 }
 else if(st.tool==='text'){
   // Stop the canvas pointerdown default action from immediately blurring text input.
   e.preventDefault();st.dragging=false;showText(p.x,p.y);return
 }
 else if(st.tool==='crop'){st.crop={type:'crop',x1:p.x,y1:p.y,x2:p.x,y2:p.y}}
 else{st.selected=-1;st.draft=['pen','pencil','highlight'].includes(st.tool)?{type:st.tool==='pen'?(st.brushMode==='airbrush'?'airbrush-stroke':'brush-stroke'):st.tool==='pencil'?'pencilpath':'highlight',points:[{...p,pressure:st.brushPressure&&e.pointerType==='pen'?Math.max(.1,e.pressure||.5):1}],color:st.color,width:st.tool==='pen'?st.brushSize:st.tool==='pencil'?1:st.width,...(st.tool==='pen'?{hardness:st.brushHardness,opacity:st.brushOpacity,pressureEnabled:st.brushPressure,smoothing:st.brushSmoothing,density:st.airbrushDensity}:st.tool==='pencil'?{pixelMode:true}:{opacity:st.highlighterOpacity})}:{type:st.tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:st.color,width:st.width,fill:st.fillModeShape!=='outline',fillMode:['rect','ellipse','shape'].includes(st.tool)?st.fillModeShape:'outline',strokeStyle:['line','arrow','curve'].includes(st.tool)?st.lineStrokeStyle:st.shapeStrokeStyle,shapeKind:st.shapeKind,label:['line','arrow','curve'].includes(st.tool)?st.lineCaption:'',startHead:st.headSettings[st.tool]?.start||'none',endHead:st.headSettings[st.tool]?.end||'none',...(st.tool==='redact'?{mode:st.redactMode,strength:st.redactStrength}:{})}}
 if(st.draft?.type==='shape')st.draft.fillColor=st.secondaryColor;
 try{el.canvas.setPointerCapture(e.pointerId)}catch(_){}paint();
}
function pointerMove(e){
 if(!st.dragging||!st.base){
  if(st.tool==='line'&&st.lineMode==='polyline'&&st.polylineDraft?.points.length){
   st.draft={...st.polylineDraft,points:[...st.polylineDraft.points,nearest(e)]};paint();
  }
  if(st.tool==='shape'&&st.polygonDraft?.points.length&&!st.freeformTracing&&st.shapeMethod==='corners'){
   st.draft={...st.polygonDraft,points:[...st.polygonDraft.points,nearest(e)]};paint();
  }
  updateSelectCursor(e);return;
 }
 const p=nearest(e,st.tool==='select'&&st.transform&&['move','nw','ne','se','sw','n','s','e','w'].includes(st.transform.mode)),dx=p.x-st.pointer.x,dy=p.y-st.pointer.y;
 if(st.freeformTracing&&st.polygonDraft){
  const pts=st.polygonDraft.points,last=pts.at(-1);
  if(Math.hypot(p.x-last.x,p.y-last.y)>=Math.max(2,3/st.zoom))pts.push(p);
  st.draft={...st.polygonDraft,points:[...pts]};paint();return;
 }
 if(st.tool==='pan'&&st.panning){el.work.scrollLeft=st.panning.left+st.panning.x-e.clientX;el.work.scrollTop=st.panning.top+st.panning.y-e.clientY;return}
 if(st.tool==='select'&&st.transform?.mode==='object-marquee'&&st.objectMarquee){st.objectMarquee.x2=p.x;st.objectMarquee.y2=p.y}
 else if(st.tool==='select'&&st.transform?.mode==='marquee'&&st.marquee){st.marquee.x2=p.x;st.marquee.y2=p.y;if(st.marquee.kind==='lasso'){const points=st.marquee.points,last=points[points.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=1.5)points.push(p)}}
 else if(['select','shape','curve'].includes(st.tool)&&st.selected>=0&&st.transform){
  const tr=st.transform,o=copyObj(tr.original);
  if(tr.indices?.length>1){
   const ids=tr.indices;
   if(tr.mode==='move'){
    let ddx=dx,ddy=dy;if(e.shiftKey){if(Math.abs(ddx)>Math.abs(ddy))ddy=0;else ddx=0}
    const snap=snapMovement(ids,tr.originals,ddx,ddy,e.ctrlKey||e.metaKey);
    ids.forEach(i=>{const item=copyObj(tr.originals[i]);moveObject(item,snap.dx,snap.dy);st.objects[i]=item});
   }else{
    const sx=tr.mode.includes('w')?-1:tr.mode.includes('e')?1:0,sy=tr.mode.includes('n')?-1:tr.mode.includes('s')?1:0;
    const bx=Math.max(1,tr.bounds.w/2),by=Math.max(1,tr.bounds.h/2);
    const fx=sx?Math.max(.06,(bx+sx*(p.x-tr.origin.x))/bx):1,fy=sy?Math.max(.06,(by+sy*(p.y-tr.origin.y))/by):1;
    ids.forEach(i=>{const item=copyObj(tr.originals[i]);resizeGeometry(item,tr.originals[i],tr.bounds,fx,fy);st.objects[i]=item});
   }
   st.moving=true;paint();return;
  }
  if(tr.mode==='move'){
   let ddx=dx,ddy=dy;if(e.shiftKey){if(Math.abs(ddx)>Math.abs(ddy))ddy=0;else ddx=0}
   const snap=st.tool==='select'?snapMovement([st.selected],{[st.selected]:tr.original},ddx,ddy,e.ctrlKey||e.metaKey):{dx:ddx,dy:ddy};
   moveObject(o,snap.dx,snap.dy);st.moving=Math.hypot(dx,dy)>2
  }
  else if(tr.mode==='rotate'){const a=Math.atan2(p.y-tr.center.y,p.x-tr.center.x),b=Math.atan2(tr.origin.y-tr.center.y,tr.origin.x-tr.center.x);o.rotation=(o.rotation||0)+a-b;if(e.shiftKey)o.rotation=Math.round(o.rotation/(Math.PI/12))*(Math.PI/12);st.moving=true}
  else if(tr.mode==='control'&&o.type==='curve'){const prev=unspin(p,tr.original),orig=unspin(tr.origin,tr.original);o.control={x:tr.original.control.x+prev.x-orig.x,y:tr.original.control.y+prev.y-orig.y};st.moving=true}
  else if(tr.mode.startsWith('control-')&&o.type==='curve'){
   const idx=Number(tr.mode.slice(8)),prev=unspin(p,tr.original),orig=unspin(tr.origin,tr.original);
   o.controls[idx]={x:tr.original.controls[idx].x+prev.x-orig.x,y:tr.original.controls[idx].y+prev.y-orig.y};st.moving=true;
  }
  else if(tr.mode.startsWith('vertex-')&&o.type==='polygon'){
   const idx=Number(tr.mode.slice(7)),prev=unspin(p,tr.original),orig=unspin(tr.origin,tr.original);
   o.points[idx]={x:tr.original.points[idx].x+prev.x-orig.x,y:tr.original.points[idx].y+prev.y-orig.y};st.moving=true;
  }
  else if(tr.mode==='note-anchor'&&o.type==='text'&&o.noteAnchor){
   const next=unspin(p,tr.original),origin=unspin(tr.origin,tr.original);
   o.noteAnchor={x:tr.original.noteAnchor.x+next.x-origin.x,y:tr.original.noteAnchor.y+next.y-origin.y};delete o.noteTargetId;st.moving=true;
  }
  else if(tr.mode==='endpoint-start'||tr.mode==='endpoint-end'){
   const q=unspin(p,tr.original),start=tr.mode==='endpoint-start';
   const anchor=start?{x:tr.original.x2,y:tr.original.y2}:{x:tr.original.x1,y:tr.original.y1};
   let next=q;
   if(e.shiftKey){const theta=Math.atan2(q.y-anchor.y,q.x-anchor.x),snap=Math.round(theta/(Math.PI/4))*Math.PI/4,d=Math.hypot(q.x-anchor.x,q.y-anchor.y);next={x:anchor.x+Math.cos(snap)*d,y:anchor.y+Math.sin(snap)*d}}
   if(start){o.x1=next.x;o.y1=next.y;delete o.startAttachment}else{o.x2=next.x;o.y2=next.y;delete o.endAttachment}
   st.moving=true;
  }
  else{const a=spin(tr.origin,tr.center,-(o.rotation||0)),b=spin(p,tr.center,-(o.rotation||0));const sx=tr.mode.includes('w')?-1:tr.mode.includes('e')?1:0,sy=tr.mode.includes('n')?-1:tr.mode.includes('s')?1:0;const bx=Math.max(1,tr.bounds.w/2),by=Math.max(1,tr.bounds.h/2),fx=sx?Math.max(.06,(bx+sx*(b.x-a.x))/bx):1,fy=sy?Math.max(.06,(by+sy*(b.y-a.y))/by):1;resizeGeometry(o,tr.original,tr.bounds,fx,fy);st.moving=true}
  st.objects[st.selected]=o;
 }
 else if(st.tool==='crop'&&st.crop){st.crop.x2=p.x;st.crop.y2=p.y}
 else if(st.draft?.type==='gradient'){st.draft.end=p}
 else if(st.draft){if(['brush-stroke','airbrush-stroke','pencilpath','clone-preview','eraser-stroke'].includes(st.draft.type)){const coalesced=typeof e.getCoalescedEvents==='function'?e.getCoalescedEvents():null;for(const event of coalesced?.length?coalesced:[e]){const raw=nearest(event),prev=st.draft.points[st.draft.points.length-1];
 const smoothing=st.draft.type==='brush-stroke'||st.draft.type==='airbrush-stroke'?Number(st.draft.smoothing)||0:0;
 const alpha=smoothing?Math.max(.15,1-smoothing/100):1;
 const pressure=st.draft.pressureEnabled&&event.pointerType==='pen'?Math.max(.1,event.pressure||.5):1;
 const q=prev?{x:prev.x+(raw.x-prev.x)*alpha,y:prev.y+(raw.y-prev.y)*alpha,pressure}:{...raw,pressure};
 if(!prev||Math.hypot(q.x-prev.x,q.y-prev.y)>=.5)st.draft.points.push(q)}}else updateDraft(p,e.shiftKey)}
 paint();
}
function pointerUp(e){
 if(!st.dragging)return;
 st.dragging=false;st.panning=null;
 if(st.tool==='pan'){el.canvas.style.cursor='grab';return}
 if(st.freeformTracing&&st.polygonDraft){
   st.freeformTracing=false;
   const pts=st.polygonDraft.points;
   // Limit freehand vertex density so editing remains responsive.
   if(pts.length>160){const step=Math.ceil(pts.length/160);st.polygonDraft.points=pts.filter((p,i)=>i%step===0||i===pts.length-1)}
   finishPolygon();return;
  }
  if(['select','shape','curve'].includes(st.tool)&&st.transform){
  if(st.transform?.mode==='object-marquee'){
   const area=rectFor(st.objectMarquee),indices=st.objects.flatMap((o,i)=>{
    if(['erase-region','eraser-stroke','fill-region'].includes(o.type))return[];
    const b=getBounds(o);return b.x<=area.x+area.w&&b.x+b.w>=area.x&&b.y<=area.y+area.h&&b.y+b.h>=area.y?[i]:[];
   });st.objectMarquee=null;selectObjects(indices);
  }else if(st.transform?.mode==='marquee'){const r=marqueeBounds();if(!r||r.w<4||r.h<4||(st.marquee?.kind==='lasso'&&st.marquee.points.length<3))st.marquee=null;else toast('Area selected. Drag to move or tap Delete.');updateContextOptions()}
  else if(st.moving||st.duplicating){
   // Do not expand when editing callout anchors, resize handles or objects that
   // were already outside the canvas. A genuine move from inside may expand it.
   const originals=st.transform.originals,indices=st.transform.indices||selectedIndexes();
   if(st.transform.mode==='move'&&originals?.[indices[0]]){
    const b=unionBounds(indices,originals);
    if(b&&b.x>=0&&b.y>=0&&b.x+b.w<=st.base.width&&b.y+b.h<=st.base.height)expandCanvasToObjects(indices);
   }
   snapshot();
  }
  else if(st.transform?.mode==='move'&&st.objects[st.selected]?.type==='patch'){snapshot()}
  st.transform=null;st.duplicating=false;st.guides=[];updateSelectCursor(e);
 }
 if(st.draft&&!(st.tool==='shape'&&st.shapeKind==='custom')){
  const o=st.draft;st.draft=null;
  const valid=o.type==='gradient'||o.points?.length>=1||Math.hypot((o.x2||0)-(o.x1||0),(o.y2||0)-(o.y1||0))>=2;
  if(valid){
   if(o.type==='curve'){
    const dx=o.x2-o.x1,dy=o.y2-o.y1;o.curveMode=st.curveMode;
    o.controls=[{x:o.x1+dx/3,y:o.y1+dy/3},{x:o.x1+dx*2/3,y:o.y1+dy*2/3}];
   }
   let finished=st.shapeAssist&&!st.paintSelection?recognizeSketch(o)||o:o;
   if(finished!==o)toast('Sketch tidied to a '+finished.type+'. Undo to restore the original.');
   if(o.type==='clone-preview')finished=makeClonePatch(o,st.cloneBase,st.cloneSource);
   else if(o.type==='gradient'&&!st.paintSelection)finished=makeGradientPatch(o);
   else if(o.type==='redact'&&o.mode!=='solid')finished=makePrivacyPatch(o);
   else if(st.paintSelection)finished=clipStrokeToSelection(o,st.paintSelection);
   if(finished){st.objects.push(finished);st.selected=['shape','curve'].includes(o.type)?st.objects.length-1:-1;snapshot();updateContextOptions()}
   if(o.type==='curve'&&finished===o)toast('Drag the control handles to shape the curve · Enter to finish');
  }
 }
 st.paintSelection=null;st.cloneBase=null;
 if(st.crop){const b=rectFor(st.crop);if(b.w<5||b.h<5)st.crop=null}paint();
}
function finishPolyline(){
 const line=st.polylineDraft;
 st.polylineDraft=null;st.draft=null;updateContextOptions();
 if(!line||line.points.length<2){paint();return}
 st.objects.push({...line,points:line.points.map(p=>({...p}))});
 snapshot();paint();toast('Polyline added. Use Select to move or adjust it.');
}
function finishPolygon(){
 if(!st.polygonDraft)return;
 const o=st.polygonDraft;st.polygonDraft=null;st.draft=null;st.freeformTracing=false;
 const pts=o.points;while(pts.length>2&&Math.hypot(pts.at(-1).x-pts[0].x,pts.at(-1).y-pts[0].y)<1)pts.pop();
 if(pts.length<3){updateContextOptions();paint();toast('Add at least three points to draw a polygon.');return}
 st.objects.push(copyObj(o));st.selected=st.objects.length-1;snapshot();updateContextOptions();paint();
 toast('Adjust corners or curve points, then press Enter to finish.');
}
function applyCrop(){if(!st.base||!st.crop)return;let b=rectFor(st.crop),x=Math.max(0,Math.floor(b.x)),y=Math.max(0,Math.floor(b.y)),w=Math.min(st.base.width-x,Math.ceil(b.w)),h=Math.min(st.base.height-y,Math.ceil(b.h));if(w<5||h<5)return;let c=composite(),out=document.createElement('canvas');out.width=w;out.height=h;out.getContext('2d').drawImage(c,x,y,w,h,0,0,w,h);st.base=out;st.objects=[];st.layers=defaultLayers();st.activeLayerId='sketch';st.soloLayerId=null;st.crop=null;st.selected=-1;sizeCanvas();snapshot();renderLayersPanel();fitZoom();setTool('select');toast('Image cropped. Undo will restore the original.')}
function commitRaster(canvas,message){
 finishText(true);st.base=canvas;st.objects=[];st.layers=defaultLayers();st.activeLayerId='sketch';st.soloLayerId=null;st.selected=-1;st.multiSelection=[];st.guides=[];st.wand=null;st.marquee=null;st.crop=null;st.polygonDraft=null;st.draft=null;
 sizeCanvas();snapshot();renderLayersPanel();fitZoom();updateContextOptions();paint();toast(message+' · Undo restores the previous edit');
}
function transformImage(mode){
 if(!st.base)return;const old=composite(),w=old.width,h=old.height,swap=mode==='cw'||mode==='ccw';
 const canvas=document.createElement('canvas');canvas.width=swap?h:w;canvas.height=swap?w:h;
 const g=canvas.getContext('2d');if(mode==='cw'){g.translate(h,0);g.rotate(Math.PI/2)}
 else if(mode==='ccw'){g.translate(0,w);g.rotate(-Math.PI/2)}
 else if(mode==='180'){g.translate(w,h);g.rotate(Math.PI)}
 else if(mode==='flipH'){g.translate(w,0);g.scale(-1,1)}
 else if(mode==='flipV'){g.translate(0,h);g.scale(1,-1)}
 g.drawImage(old,0,0);commitRaster(canvas,{cw:'Rotated 90° clockwise',ccw:'Rotated 90° counter-clockwise','180':'Rotated 180°',flipH:'Flipped horizontally',flipV:'Flipped vertically'}[mode]);
}
function flattenImage(){if(!st.base||!st.objects.length){toast('Image is already flattened.');return}commitRaster(composite(),'Flattened annotations into image')}
function showSizeDialog(mode){
 if(!st.base)return;const dialog=$('#imageSizeDialog');dialog.dataset.mode=mode;
 $('#imageSizeTitle').textContent=mode==='resize'?'Resize image':'Canvas size';
 $('#imageSizeWidth').value=st.base.width;$('#imageSizeHeight').value=st.base.height;
 $('#keepRatioWrap').hidden=mode!=='resize';$('#canvasAnchorWrap').hidden=mode==='resize';
 $('#keepRatio').checked=true;dialog.showModal();$('#imageSizeWidth').focus();$('#imageSizeWidth').select();
}

function transformGeometry(o,sx,sy,dx=0,dy=0){
 const map=p=>{if(!p)return p;return{x:p.x*sx+dx,y:p.y*sy+dy,...(p.pressure!==undefined?{pressure:p.pressure}:{})}};
 if(o.points)o.points=o.points.map(map);
 if(o.type==='text'){o.x=o.x*sx+dx;o.y=o.y*sy+dy;o.fontSize=Math.max(6,(o.fontSize||28)*Math.min(sx,sy))}
 else if(Number.isFinite(o.x1)&&Number.isFinite(o.y1)){o.x1=o.x1*sx+dx;o.x2=o.x2*sx+dx;o.y1=o.y1*sy+dy;o.y2=o.y2*sy+dy}
 if(o.control)o.control=map(o.control);
 if(o.controls)o.controls=o.controls.map(map);
 if(o.noteAnchor)o.noteAnchor=map(o.noteAnchor);
 if(o.start)o.start=map(o.start);
 if(o.end)o.end=map(o.end);
 if(o.cutouts)o.cutouts=o.cutouts.map(b=>({x:b.x*sx+dx,y:b.y*sy+dy,w:b.w*sx,h:b.h*sy}));
 if(o.width)o.width=Math.max(.5,o.width*Math.sqrt(sx*sy));
 if(o.iconSize)o.iconSize*=Math.sqrt(sx*sy);
 if(o.labelSize)o.labelSize*=Math.sqrt(sx*sy);
}

function objectId(){return'obj-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,9)}
function indexObjectIds(doc=st){const seen=new Set();for(const o of doc.objects||[]){if(!o.objectId||seen.has(o.objectId))o.objectId=objectId();seen.add(o.objectId)}}
function targetEdge(o,other){const b=getBounds(o),cx=b.x+b.w/2,cy=b.y+b.h/2,dx=other.x-cx,dy=other.y-cy;const t=Math.min(1,Math.abs(dx)>1e-7?b.w/2/Math.abs(dx):Infinity,Math.abs(dy)>1e-7?b.h/2/Math.abs(dy):Infinity);return{x:cx+dx*t,y:cy+dy*t}}
function syncConnections(doc=st){indexObjectIds(doc);const byId=new Map(doc.objects.map(o=>[o.objectId,o]));for(const o of doc.objects){
 if(['line','arrow','curve'].includes(o.type))for(const side of ['start','end']){const link=o[side+'Attachment'];if(!link)continue;const target=byId.get(link);if(!target||target===o){delete o[side+'Attachment'];continue}const other=side==='start'?{x:o.x2,y:o.y2}:{x:o.x1,y:o.y1},p=targetEdge(target,other);if(side==='start'){o.x1=p.x;o.y1=p.y}else{o.x2=p.x;o.y2=p.y}}
 if(o.type==='text'&&o.noteTargetId){const target=byId.get(o.noteTargetId);if(target&&target!==o)o.noteAnchor=targetEdge(target,{x:o.x,y:o.y});else delete o.noteTargetId}
}}
function attachSelection(){const objs=selectedIndexes().map(i=>st.objects[i]);indexObjectIds();const line=objs.find(o=>['line','arrow','curve'].includes(o.type)),targets=objs.filter(o=>o!==line&&o.type!=='text'),note=objs.find(o=>o.type==='text'&&o.noteStyle==='callout');
 if(line&&targets.length){const score=(p,o)=>{const b=getBounds(o);return Math.hypot(p.x-b.x-b.w/2,p.y-b.y-b.h/2)};const start={x:line.x1,y:line.y1},end={x:line.x2,y:line.y2};if(targets.length>1){const [a,b]=targets;const swap=score(start,a)+score(end,b)>score(start,b)+score(end,a);line.startAttachment=(swap?b:a).objectId;line.endAttachment=(swap?a:b).objectId}else{line[score(start,targets[0])<=score(end,targets[0])?'startAttachment':'endAttachment']=targets[0].objectId}}
 else if(note&&targets.length===1)note.noteTargetId=targets[0].objectId;
 else{toast('Select an arrow and one or two shapes, or a callout and a shape.');return false}
 syncConnections();snapshot();paint();toast('Connection attached. Move a shape to test.');return true;
}
function detachSelection(){let changed=false;for(const i of selectedIndexes())for(const key of ['startAttachment','endAttachment','noteTargetId'])if(st.objects[i][key]){delete st.objects[i][key];changed=true}if(changed){snapshot();paint()}return changed}
function screenshotPiece(mode='copy'){
 if(!st.base)return false;finishText(true);
 if(!st.marquee||st.marquee.kind!=='rect'){setTool('select');toast('Select a rectangular screenshot area first.');return false}
 const b=marqueeBounds();if(!b||b.w<3||b.h<3)return false;
 const image=composite(),tile=document.createElement('canvas');tile.width=b.w;tile.height=b.h;tile.getContext('2d').drawImage(image,b.x,b.y,b.w,b.h,0,0,b.w,b.h);
 const src=tile.toDataURL('image/png');patchImages.set(src,tile);const px=image.getContext('2d').getImageData(b.x,b.y,1,1).data;
 const color='#'+[...px].slice(0,3).map(v=>v.toString(16).padStart(2,'0')).join('');
 const layer={id:nextLayerId(),name:'Screenshot Pieces',kind:'objects',visible:true,locked:false,opacity:100};st.layers.splice(Math.max(1,st.layers.findIndex(l=>l.id===st.activeLayerId)+1),0,layer);
 if(mode!=='copy')st.objects.push({type:'rect',layerId:layer.id,x1:b.x,y1:b.y,x2:b.x+b.w,y2:b.y+b.h,color,fillColor:color,fill:true,fillMode:'filled',width:1});
 if(mode!=='replace')st.objects.push({type:'patch',layerId:layer.id,src,x1:b.x,y1:b.y,x2:b.x+b.w,y2:b.y+b.h,color:'#ffffff',width:1,rotation:0});
 else st.objects.push({type:'text',layerId:layer.id,x:b.x+8,y:b.y+8,text:'Edit this text',fontSize:Math.max(12,Math.min(26,b.h/3)),color:'#26384f',fontFamily:'Arial',labelMode:'plain'});
 st.activeLayerId=layer.id;st.marquee=null;st.wand=null;snapshot();setTool('select');selectObjects([st.objects.length-1]);toast(mode==='replace'?'Editable replacement created. Double-click its text.':'Screenshot piece created. Drag to rearrange.');return true;
}


function relatedVersions(group=st.versionGroupId){return group?openTabs.filter(tab=>stateForTab(tab)?.versionGroupId===group).map(tab=>({tab,data:stateForTab(tab)})):[]}
function createIdeaVersion(){
 if(!st.base)return false;finishText(true);
 if(!st.versionGroupId){st.versionGroupId='family-'+Date.now()+'-'+Math.random().toString(36).slice(2);st.versionLabel='Original';st.versionProjectName=st.name}
 const group=st.versionGroupId,project=st.versionProjectName||st.name,saved=st.savedId,used=new Set(relatedVersions(group).map(v=>v.data.versionLabel));
 let num=1,label;do{label='Option '+String.fromCharCode(65+(num-1)%26)+(num>26?' '+Math.ceil(num/26):'');num++}while(used.has(label));
 const base=copyCanvas(st.base),objects=copyObj(st.objects),layers=copyObj(st.layers),layerId=st.activeLayerId;
 st.dirty=true;stashActiveTab();initiate(base,project+' • '+label,true);
 st.objects=objects;st.layers=layers;st.activeLayerId=layerId;st.versionGroupId=group;st.versionLabel=label;st.versionProjectName=project;st.savedId=saved;
 st.history=[];st.historyIdx=-1;snapshot();st.dirty=true;updateUI();refreshDirtyStatus();paint();
 toast(label+' created. Original remains unchanged.');return true;
}
function renameIdeaVersion(){
 if(!st.versionGroupId){toast('Create a version first.');return false}
 const name=prompt('Version name',st.versionLabel||'Option');if(name===null||!name.trim())return false;
 if(relatedVersions().some(v=>v.tab.id!==activeTabId&&v.data.versionLabel===name.trim())){toast('Version name already used.');return false}
 st.versionLabel=name.trim().slice(0,48);st.name=(st.versionProjectName||st.name)+' • '+st.versionLabel;snapshot();return true;
}
function versionComposite(doc){const c=document.createElement('canvas');c.width=doc.base.width;c.height=doc.base.height;renderLayered(c.getContext('2d'),doc);return c}
function versionComparisonCanvas(){
 const docs=relatedVersions();if(!docs.length){toast('Create an idea version first.');return null}
 const pw=620,ph=440,header=40,gap=16,cols=Math.min(3,docs.length),rows=Math.ceil(docs.length/cols);
 const result=document.createElement('canvas');result.width=cols*pw+(cols+1)*gap;result.height=rows*(ph+header)+(rows+1)*gap;
 if(result.width*result.height>50000000){toast('Comparison exceeds image limit.');return null}
 const g=result.getContext('2d');g.fillStyle='#edf2f8';g.fillRect(0,0,result.width,result.height);
 docs.forEach(({data},i)=>{const x=gap+(i%cols)*(pw+gap),y=gap+Math.floor(i/cols)*(ph+header+gap),img=versionComposite(data),s=Math.min(pw/img.width,ph/img.height);
  g.fillStyle='#ffffff';g.fillRect(x,y,pw,ph+header);g.fillStyle='#26384f';g.font='bold 20px Arial';g.fillText(data.versionLabel||data.name,x+12,y+27);
  g.drawImage(img,x+(pw-img.width*s)/2,y+header+(ph-img.height*s)/2,img.width*s,img.height*s)});
 return result;
}
function exportIdeaVersions(){const c=versionComparisonCanvas();if(!c)return false;saveCanvasPNG(c,'-idea-versions');return true}
function compareIdeaVersions(){
 const dlg=$('#ideaVersionsDialog'),list=$('#ideaVersionList');if(!dlg||!list)return;
 const variants=relatedVersions();if(!variants.length){toast('Create a version first.');return}
 list.replaceChildren();
 for(const {tab,data} of variants){const card=document.createElement('div');card.className='version-card';
  const canvas=document.createElement('canvas');canvas.width=200;canvas.height=125;paintTabThumbnail(canvas,data);
  const label=document.createElement('strong');label.textContent=data.versionLabel||data.name;
  const open=document.createElement('button');open.textContent=tab.id===activeTabId?'Current':'Open version';open.disabled=tab.id===activeTabId;open.onclick=()=>{dlg.close();activateTab(tab.id)};
  card.append(canvas,label,open);list.append(card)}
 $('#exportVersionsBtn').onclick=exportIdeaVersions;$('#closeVersionsBtn').onclick=()=>dlg.close();if(!dlg.open)dlg.showModal();
}

function changeCanvasGeometry(w,h,mode='canvas',anchor='center'){
 if(!st.base)return false;
 w=Math.floor(Number(w));h=Math.floor(Number(h));
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>12000||h>12000||w*h>50000000){toast('Maximum size: 12,000 px and 50 megapixels.');return false}
 finishText(true);
 const old=st.base,ow=old.width,oh=old.height;
 if(w===ow&&h===oh)return false;
 const out=document.createElement('canvas');out.width=w;out.height=h;
 const g=out.getContext('2d');let dx=0,dy=0,sx=1,sy=1;
 if(mode==='resize'){sx=w/ow;sy=h/oh;g.imageSmoothingQuality='high';g.drawImage(old,0,0,w,h)}
 else{dx=anchor==='left'?0:anchor==='right'?w-ow:Math.round((w-ow)/2);dy=anchor==='top'?0:anchor==='bottom'?h-oh:Math.round((h-oh)/2);g.drawImage(old,dx,dy)}
 st.objects.forEach(o=>transformGeometry(o,sx,sy,dx,dy));
 st.base=out;st.marquee=null;st.wand=null;st.crop=null;st.selected=-1;st.multiSelection=[];
 snapshot();sizeCanvas();fitZoom();renderLayersPanel();paint();
 toast(mode==='resize'?'Image and editable objects resized.':'Canvas changed; layers and objects stay editable.');
 return true;
}
function expandCanvasToObjects(indices,padding=32){
 if(!st.base||!indices.length)return false;
 const bounds=unionBounds(indices);if(!bounds)return false;
 // A nearby edge is not a crossing: only extend if artwork actually leaves the canvas.
 if(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.w<=st.base.width&&bounds.y+bounds.h<=st.base.height)return false;
 const left=Math.max(0,Math.ceil(padding-bounds.x)),top=Math.max(0,Math.ceil(padding-bounds.y));
 const right=Math.max(0,Math.ceil(bounds.x+bounds.w+padding-st.base.width));
 const bottom=Math.max(0,Math.ceil(bounds.y+bounds.h+padding-st.base.height));
 if(!left&&!right&&!top&&!bottom)return false;
 const ow=st.base.width,oh=st.base.height,w=ow+left+right,h=oh+top+bottom;
 if(w>12000||h>12000||w*h>50000000){toast('Canvas expansion would exceed the maximum image size.');return false}
 const out=document.createElement('canvas');out.width=w;out.height=h;
 out.getContext('2d').drawImage(st.base,left,top);st.base=out;
 if(left||top)st.objects.forEach(o=>transformGeometry(o,1,1,left,top));
 sizeCanvas();return true;
}
function applySizeDialog(){
 const dlg=$('#imageSizeDialog'),mode=dlg.dataset.mode;
 const w=Number($('#imageSizeWidth').value),h=Number($('#imageSizeHeight').value);
 if(changeCanvasGeometry(w,h,mode,mode==='canvas'?$('#canvasAnchor').value:'center'))dlg.close();
 else if(w===st.base.width&&h===st.base.height)dlg.close();
}
function cropToSelection(){if(st.marquee){const r=marqueeBounds();if(!r||r.w<2||r.h<2)return;st.crop={type:'crop',x1:r.x,y1:r.y,x2:r.x+r.w,y2:r.y+r.h};applyCrop()}else if(st.crop)applyCrop();else{setTool('crop');toast('Drag a rectangle and choose Apply crop.')}}
function safeFilename(){return st.name.replace(/\.[^.]+$/,'').replace(/[^\w\-. ]+/g,'').trim().slice(0,70)||'marked-image'}
async function exportImage(){if(!st.base){toast('Open or paste an image first.');return}finishText(true);let kind=$('#exportFormat').value,can=composite(),mime=kind==='jpeg'?'image/jpeg':'image/png';if(kind==='jpeg'){const c=document.createElement('canvas');c.width=can.width;c.height=can.height;const g=c.getContext('2d');g.fillStyle='#ffffff';g.fillRect(0,0,c.width,c.height);g.drawImage(can,0,0);can=c}can.toBlob(blob=>{if(!blob){toast('Could not export this image.');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safeFilename()+'-marked.'+(kind==='jpeg'?'jpg':'png');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Image saved to your downloads.')},mime,.92)}
async function shareImage(){
 if(!st.base)return;
 finishText(true);
 try{
  const canvas=composite();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error('PNG conversion failed')),'image/png'));
  const file=new File([blob],safeFilename()+'.png',{type:'image/png'});
  if(navigator.share&&(!navigator.canShare||navigator.canShare({files:[file]}))){
   await navigator.share({files:[file],title:st.name||'Paint image'});return;
  }
  // Desktop browsers with no native share target can still export the PNG.
  $('#exportFormat').value='png';await exportImage();
 }catch(error){
  if(error?.name==='AbortError')return;
  console.warn('Image share failed',error);
  toast('Sharing is unavailable. Export PNG or Copy Image instead.');
 }
}
async function copyImage(){if(!st.base){toast('Open or paste an image first.');return}finishText(true);try{if(!navigator.clipboard?.write||!window.ClipboardItem)throw new Error('Clipboard image write not available');let can=composite();const blob=await new Promise(resolve=>can.toBlob(resolve,'image/png'));await navigator.clipboard.write([new ClipboardItem({'image/png':blob})]);toast('Annotated image copied to clipboard.')}catch(e){toast('Copy requires HTTPS and clipboard permission. Use Save image instead.')}}
// Pasted screenshots are overlays, never replacement documents. Open Image still uses readBlob().
async function pasteImageObject(blob){
 if(!blob||!blob.type.startsWith('image/')){toast('Clipboard has no supported image.');return}
 if(!st.base)blank();
 try{
  const image=await decodeSavedImage(blob);
  if(image.width*image.height>50000000){image.close?.();toast('Image is too large (maximum 50 megapixels).');return}
  const asset=document.createElement('canvas');asset.width=image.width;asset.height=image.height;
  asset.getContext('2d').drawImage(image,0,0);image.close?.();
  const cr=el.canvas.getBoundingClientRect(),wr=el.work.getBoundingClientRect();
  const visibleW=Math.max(1,(Math.min(cr.right,wr.right)-Math.max(cr.left,wr.left))/st.zoom);
  const visibleH=Math.max(1,(Math.min(cr.bottom,wr.bottom)-Math.max(cr.top,wr.top))/st.zoom);
  const maxWidth=Math.min(st.base.width*.88,visibleW*.9);
  const maxHeight=Math.min(st.base.height*.88,visibleH*.9);
  const scale=Math.min(1,Math.max(1,maxWidth)/asset.width,Math.max(1,maxHeight)/asset.height);
  const width=Math.max(1,Math.round(asset.width*scale)),height=Math.max(1,Math.round(asset.height*scale));
  const visibleCenterX=(Math.max(cr.left,wr.left)+Math.min(cr.right,wr.right))/2;
  const visibleCenterY=(Math.max(cr.top,wr.top)+Math.min(cr.bottom,wr.bottom))/2;
  const visible=Number.isFinite(visibleCenterX)&&Number.isFinite(visibleCenterY)&&cr.right>wr.left&&cr.left<wr.right&&cr.bottom>wr.top&&cr.top<wr.bottom;
  const anchor=st.pastePointerInside&&st.pastePointer ? st.pastePointer : visible ? nearest({clientX:visibleCenterX,clientY:visibleCenterY}) : {x:st.base.width/2,y:st.base.height/2};
  const x=Math.round(Math.max(0,Math.min(st.base.width-width,anchor.x-width/2)));
  const y=Math.round(Math.max(0,Math.min(st.base.height-height,anchor.y-height/2)));
  const src=asset.toDataURL('image/png');patchImages.set(src,asset);
  finishText(true);setTool('select');st.selectionShape='smart';const shapePicker=$('#selectionShape');if(shapePicker)shapePicker.value='smart';
  ensureLayers();const below=Math.max(1,st.layers.findIndex(l=>l.id===st.activeLayerId));
  const screenshot={id:nextLayerId(),name:'Screenshot',kind:'objects',visible:true,locked:false,opacity:100};
  st.layers.splice(below,0,screenshot);st.activeLayerId=screenshot.id;
  st.objects.push({type:'patch',src,x1:x,y1:y,x2:x+width,y2:y+height,color:'#ffffff',width:1,rotation:0,layerId:screenshot.id});
  st.selected=st.objects.length-1;snapshot();updateContextOptions();paint();
  toast('Screenshot added on its own layer. Resize it, then lock the layer to annotate.');
 }catch(err){console.error('Paste image failed',err);toast('Could not paste this image. Try copying it again.')}
}
// Mouse position is used when pasting while the pointer is on the image.
el.canvas.addEventListener('pointerenter',e=>{st.pastePointerInside=true;st.pastePointer=nearest(e)});
el.canvas.addEventListener('pointermove',e=>{st.pastePointerInside=true;st.pastePointer=nearest(e)});
el.canvas.addEventListener('pointerleave',()=>{st.pastePointerInside=false});
async function pasteButton(){try{if(!navigator.clipboard?.read)throw new Error('no-read');const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(t=>t.startsWith('image/'));if(type){const blob=await item.getType(type);await pasteImageObject(blob);return}}toast('Clipboard contains no image.')}catch(e){toast('Use Ctrl / ⌘ + V to paste, or Open to choose a file.')}}
async function pasteSelection(){
 if(internalEditableObject&&st.base){
  if(!requireEditableLayer())return;
  const clones=(Array.isArray(internalEditableObject)?internalEditableObject:[internalEditableObject]).map(o=>{const clone=copyObj(o);moveObject(clone,20,20);clone.layerId=st.activeLayerId;return clone});
  const group='group-'+Date.now();let next=Math.max(0,...st.objects.filter(o=>o.noteStyle).map(o=>o.noteNumber||0));clones.forEach(o=>{if(o.groupId)o.groupId=group;if(o.noteStyle)o.noteNumber=++next});
  setTool('select');const start=st.objects.length;st.objects.push(...clones);
  st.multiSelection=clones.map((_,i)=>start+i);st.selected=start+clones.length-1;
  snapshot();updateContextOptions();paint();toast('Pasted '+clones.length+' editable object'+(clones.length>1?'s':'')+'.');return;
 }
 // Prefer the current OS clipboard; recover the last in-app copy if permission is denied.
 if(navigator.clipboard?.read){
  try{
   const items=await navigator.clipboard.read();
   for(const item of items){
    const type=item.types.find(t=>t.startsWith('image/'));
    if(type){await pasteImageObject(await item.getType(type));return}
   }
  }catch(err){console.warn('Clipboard read blocked; trying copied selection.',err)}
 }
 if(internalSelection){
  const blob=await new Promise(resolve=>internalSelection.toBlob(resolve,'image/png'));
  if(blob){await pasteImageObject(blob);return}
 }
 toast('No image to paste. Use Copy Selection or copy an image first.');
}
function handlePaste(e){if(document.activeElement?.matches('input,textarea,select,[contenteditable]'))return;const item=[...(e.clipboardData?.items||[])].find(x=>x.type.startsWith('image/'));if(item){e.preventDefault();const file=item.getAsFile();if(file)pasteImageObject(file)}}
function imageDropEnter(e){if(![...(e.dataTransfer?.types||[])].includes('Files'))return;e.preventDefault();el.work.classList.add('paint-drop-ready')}
el.work.addEventListener('dragenter',imageDropEnter);
el.work.addEventListener('dragover',e=>{if([...(e.dataTransfer?.types||[])].includes('Files')){e.preventDefault();e.dataTransfer.dropEffect='copy';el.work.classList.add('paint-drop-ready')}});
el.work.addEventListener('dragleave',e=>{if(!el.work.contains(e.relatedTarget))el.work.classList.remove('paint-drop-ready')});
el.work.addEventListener('drop',async e=>{
 // Do not also trigger the document-level drop handler, which opens a new tab.
 e.stopPropagation();e.preventDefault();el.work.classList.remove('paint-drop-ready');
 const file=[...(e.dataTransfer?.files||[])].find(f=>f.type.startsWith('image/'));
 if(!file){toast('Drop a PNG, JPG, GIF, or WebP screenshot to annotate it.');return}
 const rect=el.canvas.getBoundingClientRect();
 st.pastePointerInside=e.clientX>=rect.left&&e.clientX<=rect.right&&e.clientY>=rect.top&&e.clientY<=rect.bottom;
 st.pastePointer=st.pastePointerInside?nearest(e):null;
 await pasteImageObject(file);
});
function keyHandler(e){const tag=document.activeElement?.tagName,editing=el.text.style.display==='block';if(editing){if(e.isComposing||e.keyCode===229)return;if(e.key==='Escape'||(e.key==='Enter'&&(e.ctrlKey||e.metaKey))){e.preventDefault();finishText(true)}return}if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;const cmd=e.ctrlKey||e.metaKey;if(cmd){const k=e.key.toLowerCase();
 if(k==='l'&&e.shiftKey){e.preventDefault();togglePanel('panelLayers');return}
 if(k==='d'){e.preventDefault();duplicateObjects();return}
 if(k==='g'){e.preventDefault();if(e.shiftKey)ungroupObjects();else groupObjects();return}
 if(k==='a'){e.preventDefault();const ids=st.objects.map((o,i)=>['erase-region','eraser-stroke','fill-region'].includes(o.type)?-1:i).filter(i=>i>=0);selectObjects(ids);return}
 if(k==='tab'){e.preventDefault();cycleTab(e.shiftKey?-1:1);return}if(k==='w'){e.preventDefault();closeTab(activeTabId);return}if(k==='n'){e.preventDefault();createBlank()}if(k==='r'){e.preventDefault();showSizeDialog(e.shiftKey?'canvas':'resize')}if(k==='s'){e.preventDefault();saveProject()}if(k==='z'){e.preventDefault();restore(st.historyIdx+(e.shiftKey?1:-1))}if(k==='y'){e.preventDefault();restore(st.historyIdx+1)}if(k==='o'){e.preventDefault();el.file.click()}if(k==='c'){e.preventDefault();if(hasSelection())copySelectedPixels();else copyImage()}if(k==='x'&&hasSelection()){e.preventDefault();copySelectedPixels();deleteSelection()}if(k==='i'&&e.shiftKey){e.preventDefault();invertSelection()}return}if(e.key==='Delete'||e.key==='Backspace'){if(hasSelection()){e.preventDefault();deleteSelection()}return}if(st.selected>=0&&st.objects[st.selected]&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const n=e.shiftKey?10:1;const dx=e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0;const dy=e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0;selectedIndexes().forEach(i=>moveObject(st.objects[i],dx,dy));snapshot();paint();return}if(e.key==='Enter'&&st.polylineDraft){e.preventDefault();finishPolyline();return}if(e.key==='Enter'&&st.polygonDraft){e.preventDefault();finishPolygon();finishShapeEdit();return}
 if(e.key==='Enter'&&['shape','curve'].includes(st.tool)&&st.selected>=0){e.preventDefault();finishShapeEdit();return}
 if(st.tool==='shape'&&!cmd&&e.key.toLowerCase()==='a'){
  e.preventDefault();const kinds=shapeCatalog.flatMap(group=>group[1].map(x=>x[0])),i=kinds.indexOf(st.shapeKind);
  st.shapeKind=kinds[(i+(e.shiftKey?-1:1)+kinds.length)%kinds.length];
  $('#shapeType').value=st.shapeKind;rememberShapePreset(st.shapeKind);updateContextOptions();window.__paintShapePickerSync?.();return;
 }if(e.key==='Escape'){if(st.polygonDraft){e.preventDefault();st.polygonDraft=null;st.draft=null;st.freeformTracing=false;updateContextOptions();paint();return}if(['shape','curve'].includes(st.tool)&&st.selected>=0){e.preventDefault();finishShapeEdit();return}if(!popup.hidden){e.preventDefault();closeMenu();return}st.crop=null;st.draft=null;st.polygonDraft=null;st.polylineDraft=null;st.selected=-1;st.wand=null;st.marquee=null;updateContextOptions();paint();return}const tool={v:'select',w:'wand',f:'bucket',k:'picker',z:'zoom',u:'curve',n:'pencil',p:'pen',h:'pan',a:'arrow',l:'line',r:'rect',o:'ellipse',t:'text',j:'note',b:'redact',c:'crop',e:'erase',s:'shape'}[e.key.toLowerCase()];if(tool){e.preventDefault();setTool(tool)}}
// Contextual tool options. These are visible only when relevant.
['startHead','endHead'].forEach(id=>$('#'+id).addEventListener('change',e=>{if(st.headSettings[st.tool])st.headSettings[st.tool][id==='startHead'?'start':'end']=e.target.value;const o=st.objects[st.selected];if(o&&['line','arrow','curve'].includes(o.type)){o[id]=e.target.value;snapshot();paint()}}));
$('#lineCaption').addEventListener('input',e=>{
 st.lineCaption=e.target.value.slice(0,160);
 const o=st.objects[st.selected];if(o&&['line','arrow','curve'].includes(o.type)){o.label=st.lineCaption;paint()}
});
$('#lineCaption').addEventListener('change',e=>{
 const o=st.objects[st.selected];if(o&&['line','arrow','curve'].includes(o.type)){o.label=st.lineCaption;snapshot();paint()}
});
$('#lineStyle').addEventListener('change',e=>{st.lineStrokeStyle=e.target.value;const o=st.objects[st.selected];if(o&&['line','arrow','curve'].includes(o.type)){o.strokeStyle=e.target.value;snapshot();paint()}});
$('#borderStyle').addEventListener('change',e=>{st.shapeStrokeStyle=e.target.value;const o=st.objects[st.selected];if(o&&['rect','ellipse','shape','polygon'].includes(o.type)){o.strokeStyle=e.target.value;snapshot();paint()}});

$('#fillTolerance').addEventListener('input',e=>{st.fillTolerance=Number(e.target.value);$('#fillToleranceValue').textContent=st.fillTolerance+'%'});
 $('#fillMode').addEventListener('change',e=>{st.fillMode=e.target.value});
 $('#wandTolerance').addEventListener('input',e=>{st.wandTolerance=Number(e.target.value);$('#wandToleranceValue').textContent=st.wandTolerance+'%';if(st.wand?.source==='wand'){let {x,y}=st.wand;wandSelection(x,y)}});
$('#wandMode').addEventListener('change',e=>{st.wandMode=e.target.value;if(st.wand?.source==='wand'){let {x,y}=st.wand;wandSelection(x,y)}});
$('#deleteSelectionBtn').onclick=deleteSelection;$('#deselectBtn').onclick=deselect;$('#copySelectionBtn').onclick=copySelectedPixels;$('#cutSelectionBtn').onclick=()=>{if(hasSelection()){copySelectedPixels();deleteSelection()}};
for(const [id,key] of [['brushMode','brushMode'],['brushSmoothing','brushSmoothing'],['eraserMode','eraserMode'],['lineMode','lineMode'],['redactMode','redactMode'],['fillType','fillType'],['gradientMode','gradientMode'],['gradientEndColor','gradientEndColor']]){
 $('#'+id).addEventListener('change',e=>{
  if(key==='lineMode'&&st.polylineDraft)finishPolyline();
  st[key]=key==='brushSmoothing'?Number(e.target.value):e.target.value;
  if(key==='redactMode'&&st.redactMode!=='solid')toast('Blur and Pixelate are visual effects only. Use Solid + Export PNG for privacy.');
  updateContextOptions();paint();
 });
}
$('#brushPressure').addEventListener('change',e=>st.brushPressure=e.target.checked);$('#shapeAssist').addEventListener('change',e=>st.shapeAssist=e.target.checked);
$('#airbrushDensity').addEventListener('input',e=>{st.airbrushDensity=Number(e.target.value);$('#airbrushDensityValue').textContent=st.airbrushDensity+'%'});
$('#highlighterOpacity').addEventListener('input',e=>{
 st.highlighterOpacity=Number(e.target.value);
 $('#highlighterOpacityValue').textContent=st.highlighterOpacity+'%';
});
$('#redactStrength').addEventListener('input',e=>st.redactStrength=Number(e.target.value));
$('#noteMode').onchange=e=>{st.noteMode=e.target.value;const o=st.objects[st.selected];if(o?.noteStyle){o.noteStyle=st.noteMode;snapshot();paint()}};
 $('#finishPolylineBtn').onclick=finishPolyline;
 $('#finishShapeBtn').onclick=()=>{if(st.polygonDraft)finishPolygon();finishShapeEdit()};
 $('#shapeMethod').onchange=e=>{if(st.polygonDraft)finishPolygon();st.shapeMethod=e.target.value;updateContextOptions()};
 $('#curveMode').onchange=e=>{st.curveMode=e.target.value;const o=st.objects[st.selected];if(o?.type==='curve'){o.curveMode=st.curveMode;snapshot();paint()}};
$('#clonePickSource').onclick=()=>{st.clonePicking=true;setTool('clone');st.clonePicking=true;updateContextOptions();toast('Tap a point on the canvas to set your clone source.')};
for(const [id,step] of [['objectBackward',-1],['objectForward',1]])$('#'+id).onclick=()=>reorderSelectedObject(step);
function reorderSelectedObject(step){
 const index=st.selected,next=index+step;
 if(index<0||next<0||next>=st.objects.length)return;
 if(st.objects[index].layerId!==st.objects[next].layerId){toast('Use Layers to change the order between layers.');return}
 // Do not move a selected drawable below/above eraser or fill compositing actions.
 const a=st.objects[index],b=st.objects[next];
 if(['erase-region','eraser-stroke','fill-region'].includes(a.type)||['erase-region','eraser-stroke','fill-region'].includes(b.type)){
  toast('Flatten image first to reorder past pixel operations.');return;
 }
 st.objects[index]=b;st.objects[next]=a;st.selected=next;
 snapshot();updateContextOptions();paint();
}

$('#selectionShape').addEventListener('change',e=>{st.selectionShape=e.target.value;deselect();updateContextOptions()});
$('#objectRotation').addEventListener('change',e=>{let o=st.objects[st.selected];if(!o)return;o.rotation=Number(e.target.value)*Math.PI/180;snapshot();paint()});
for(const [id,delta] of [['rotateLeft',-15],['rotateRight',15]])$('#'+id).onclick=()=>{let o=st.objects[st.selected];if(!o)return;o.rotation=(o.rotation||0)+delta*Math.PI/180;$('#objectRotation').value=Math.round(o.rotation*180/Math.PI);snapshot();paint()};
$('#duplicateObject').onclick=duplicateObjects;$('#groupObjectsBtn').onclick=groupObjects;$('#ungroupObjectsBtn').onclick=ungroupObjects;$('#snapGuides').onchange=e=>{st.snapEnabled=e.target.checked;st.guides=[];paint()};$('#multiPickBtn').onclick=()=>{st.multiPick=!st.multiPick;$('#multiPickBtn').setAttribute('aria-pressed',String(st.multiPick));$('#multiPickBtn').classList.toggle('is-active',st.multiPick)};
// UI bindings
$('#palette').innerHTML=colors.map(c=>`<button class="swatch ${c===st.color?'selected':''}" data-color="${c}" style="background:${c}" title="${c}" aria-label="Select ${c}"></button>`).join('');
$('#palette').addEventListener('click',e=>{let b=e.target.closest('.swatch');if(b)setColor(b.dataset.color)});
$$('.toolbutton').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('#openBtn').onclick=$('#emptyOpen').onclick=()=>el.file.click();$('#newBtn').onclick=$('#emptyBlank').onclick=()=>createBlank();
async function openImageFiles(files){
 for(const file of files)if(file.type.startsWith('image/'))await readBlob(file,file.name);
}
el.file.addEventListener('change',e=>{const files=[...(e.target.files||[])];el.file.value='';if(files.length)openImageFiles(files)});
$('#pasteBtn').onclick=pasteButton;$('#saveBtn').onclick=saveProject;$('#copyBtn').onclick=copyImage;$('#shareBtn').onclick=shareImage;
$('#undoBtn').onclick=()=>restore(st.historyIdx-1);$('#redoBtn').onclick=()=>restore(st.historyIdx+1);
$('#topColor').addEventListener('input',e=>setColor(e.target.value));
for(const [id,property,output] of [['brushHardness','hardness','brushHardnessValue'],['brushOpacity','opacity','brushOpacityValue']])$('#'+id).addEventListener('input',e=>{
 const value=Number(e.target.value);st[property==='hardness'?'brushHardness':'brushOpacity']=value;$('#'+output).textContent=value+'%';
 const obj=st.objects[st.selected];if(obj?.type==='brush-stroke'){obj[property]=value;snapshot();paint()}
});
for(let id of ['topWidth','inspectorWidth','topWidthValue'])$('#'+id).addEventListener('input',e=>setWidth(e.target.value));
$('#fontSize').addEventListener('input',e=>{st.fontSize=Math.max(8,Math.min(240,Number(e.target.value)||28));syncTextEditorLayout();const o=st.objects[st.selected];if(o?.type==='text'&&!textIsEditing()){o.fontSize=st.fontSize;snapshot();paint()}});
$('#textMode').addEventListener('change',e=>{st.textMode=e.target.value;updateTextOptions();syncTextEditorLayout()});
$('#textBackground').addEventListener('input',e=>{st.labelBackground=e.target.value;if(textIsEditing())syncTextEditorLayout();const o=st.objects[st.selected];if(o?.type==='text'&&o.labelMode==='label'){o.backgroundColor=st.labelBackground;snapshot();paint()}});
$('#textBorder').addEventListener('change',e=>{st.labelBorder=e.target.checked;const o=st.objects[st.selected];if(o?.type==='text'&&o.labelMode==='label'){o.labelBorder=st.labelBorder;snapshot();paint()}});
$('#toolZoomOut').onclick=()=>zoomBy(1/1.25);$('#toolZoomIn').onclick=()=>zoomBy(1.25);$('#toolZoomFit').onclick=fitZoom;
$('#applyCrop').onclick=applyCrop;$('#cancelCrop').onclick=()=>{st.crop=null;paint()};
el.canvas.addEventListener('contextmenu',e=>{if(st.tool==='zoom')e.preventDefault()});el.work.addEventListener('wheel',e=>{if(!st.base)return;e.preventDefault();zoomAt(e.deltaY<0?1.17:1/1.17,e.clientX,e.clientY)},{passive:false});
let middlePan=null;
function finishMiddlePan(){if(!middlePan)return;middlePan=null;document.body.classList.remove('is-middle-panning');window.removeEventListener('pointermove',moveMiddlePan);window.removeEventListener('pointerup',endMiddlePan);window.removeEventListener('pointercancel',endMiddlePan)}
function moveMiddlePan(e){if(!middlePan)return;el.work.scrollLeft=middlePan.left+middlePan.x-e.clientX;el.work.scrollTop=middlePan.top+middlePan.y-e.clientY}
function endMiddlePan(e){if(e.button===1||e.type==='pointercancel')finishMiddlePan()}
el.work.addEventListener('pointerdown',e=>{if(e.button!==1)return;e.preventDefault();e.stopPropagation();middlePan={x:e.clientX,y:e.clientY,left:el.work.scrollLeft,top:el.work.scrollTop};document.body.classList.add('is-middle-panning');window.addEventListener('pointermove',moveMiddlePan);window.addEventListener('pointerup',endMiddlePan);window.addEventListener('pointercancel',endMiddlePan)},true);
el.work.addEventListener('auxclick',e=>{if(e.button===1)e.preventDefault()});
// Pan: single-finger drag, two-finger pinch/pan, with zoom anchored at the gesture midpoint.
const panTouches=new Map();let pinchState=null;
function touchMidpoint(){
 const [a,b]=[...panTouches.values()];
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2,distance:Math.max(1,Math.hypot(a.x-b.x,a.y-b.y))};
}
el.canvas.addEventListener('pointerdown',e=>{
 if(!st.base||e.pointerType!=='touch')return;
 panTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(panTouches.size>=2){
  // Starting a second finger cancels the first finger's unfinished edit.
  if(st.selected>=0&&st.transform?.original)st.objects[st.selected]=copyObj(st.transform.original);
  if(st.transform?.mode==='marquee')st.marquee=null;
  st.dragging=false;st.panning=null;st.draft=null;st.crop=null;st.transform=null;st.paintSelection=null;st.cloneBase=null;
  pinchState=touchMidpoint();paint();
  e.preventDefault();e.stopImmediatePropagation();
  try{el.canvas.setPointerCapture(e.pointerId)}catch(_){}
 }
},true);
el.canvas.addEventListener('pointermove',e=>{
 if(!panTouches.has(e.pointerId))return;
 panTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(panTouches.size>=2){
  e.preventDefault();e.stopImmediatePropagation();
  const next=touchMidpoint();
  if(pinchState){
   zoomAt(Math.max(.5,Math.min(2,next.distance/pinchState.distance)),next.x,next.y);
   el.work.scrollLeft-=next.x-pinchState.x;
   el.work.scrollTop-=next.y-pinchState.y;
  }
  pinchState=next;
 }
},true);
function endPanTouch(e){
 if(!panTouches.has(e.pointerId))return;
 const wasPinching=panTouches.size>=2||!!pinchState;
 panTouches.delete(e.pointerId);
 if(!wasPinching){pinchState=null;return} // Let normal single-finger drawing commit.
 if(panTouches.size===1&&st.tool==='pan'){
  const point=[...panTouches.values()][0];st.dragging=true;
  st.panning={x:point.x,y:point.y,left:el.work.scrollLeft,top:el.work.scrollTop};
 }else{st.panning=null;st.dragging=false}
 pinchState=null;
 if(wasPinching){e.preventDefault();e.stopImmediatePropagation();el.canvas.style.cursor='grab'}
}
el.canvas.addEventListener('pointerup',endPanTouch,true);
el.canvas.addEventListener('pointercancel',endPanTouch,true);
function cancelUnfinishedPointer(){
 if(!st.dragging)return;
 if(st.duplicating&&st.transform?.indices){st.transform.indices.slice().sort((a,b)=>b-a).forEach(i=>st.objects.splice(i,1));st.selected=-1;st.multiSelection=[]}
 else if(st.transform?.originals)Object.entries(st.transform.originals).forEach(([i,o])=>{st.objects[i]=copyObj(o)});
 else if(st.selected>=0&&st.transform?.original)st.objects[st.selected]=copyObj(st.transform.original);
 st.dragging=false;st.draft=null;st.objectMarquee=null;st.guides=[];st.transform=null;st.duplicating=false;st.panning=null;st.paintSelection=null;
 updateContextOptions();paint();
}
el.canvas.addEventListener('pointerdown',pointerDown);el.canvas.addEventListener('pointermove',pointerMove);el.canvas.addEventListener('pointerup',pointerUp);el.canvas.addEventListener('pointercancel',cancelUnfinishedPointer);
el.canvas.addEventListener('pointerleave',()=>{if(st.tool==='select'&&!st.dragging)el.canvas.style.cursor='crosshair'});
el.canvas.addEventListener('dblclick',e=>{if(st.tool==='line'&&st.lineMode==='polyline'){e.preventDefault();finishPolyline();return}if(st.tool==='shape'&&['custom','customSmooth'].includes(st.shapeKind)&&st.polygonDraft){e.preventDefault();finishPolygon();return}if(!st.base||st.tool!=='select')return;const p=nearest(e),i=findObject(p.x,p.y);if(i>=0&&st.objects[i].type==='text'){showText(p.x,p.y,i)}});
// Clicking outside commits text, but changing font or color keeps the editor open.
el.text.addEventListener('blur',e=>{
 const next=e.relatedTarget;
 if(next?.closest?.('#fontPack, #noteOptions, #panelColors, #topColor'))return;
 setTimeout(()=>{
   const active=document.activeElement;
   if(active===el.text||active?.closest?.('#fontPack, #noteOptions, #panelColors, #topColor'))return;
   finishText(true);
 },90);
});
document.addEventListener('paste',handlePaste);document.addEventListener('keydown',keyHandler);
let dragCounter=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragCounter++;$('#dropScreen').classList.add('show')}});document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault()});document.addEventListener('dragleave',e=>{if(e.dataTransfer?.types.includes('Files')){dragCounter=Math.max(0,dragCounter-1);if(!dragCounter)$('#dropScreen').classList.remove('show')}});document.addEventListener('drop',e=>{e.preventDefault();dragCounter=0;$('#dropScreen').classList.remove('show');const files=[...(e.dataTransfer?.files||[])].filter(x=>x.type.startsWith('image/'));if(files.length)openImageFiles(files)});
window.addEventListener('resize',()=>{if(st.base&&st.zoom<=1.25)fitZoom()});
updateUI();setHistoryButtons();

// --- Native-feeling floating panels: free movement, user resizing, persist layout.
const panelIds=['panelTools','panelColors','panelLibrary','panelHistory','panelLayers'];
let highestZ=25;
function raisePanel(panel){panel.style.zIndex=String(++highestZ)}
function clampPanel(panel,left,top){const area=$('#workArea');const maxLeft=Math.max(0,area.clientWidth-65),maxTop=Math.max(0,area.clientHeight-30);return {left:Math.max(0,Math.min(maxLeft,left)),top:Math.max(0,Math.min(maxTop,top))}}
function rememberLayout(){try{let data={};panelIds.forEach(id=>{let p=$('#'+id);data[id]={left:p.style.left,top:p.style.top,width:p.style.width,height:p.style.height,hidden:p.classList.contains('hidden')}});localStorage.setItem('paint-layout-v1',JSON.stringify(data))}catch(e){}}
function applyPositions(){const area=$('#workArea');panelIds.forEach(id=>{let p=$('#'+id);if(p.classList.contains('hidden'))return;let rect=p.getBoundingClientRect(),a=area.getBoundingClientRect();let v=clampPanel(p,rect.left-a.left,rect.top-a.top);p.style.left=v.left+'px';p.style.top=v.top+'px';p.style.right='auto';p.style.bottom='auto'})}
function loadPanelPositions(){let layouts;try{layouts=JSON.parse(localStorage.getItem('paint-layout-v1')||'null')}catch(e){};if(layouts){panelIds.forEach(id=>{let p=$('#'+id),s=layouts[id];if(!s)return;['left','top','width','height'].forEach(key=>{if(s[key])p.style[key]=s[key]});if(s.hidden)p.classList.add('hidden');p.style.right='auto';p.style.bottom='auto'})}else{applyPositions()}requestAnimationFrame(()=>{if(layouts)applyPositions()})}
function resetLayout(){try{localStorage.removeItem('paint-layout-v1')}catch(e){};panelIds.forEach(id=>{let p=$('#'+id);p.removeAttribute('style');if(id==='panelLayers')p.classList.add('hidden');else p.classList.remove('hidden')});requestAnimationFrame(()=>{applyPositions();rememberLayout();toast('Floating windows restored.')})}
panelIds.forEach(id=>{const p=$('#'+id),head=p.querySelector('.float-head');p.addEventListener('pointerdown',()=>raisePanel(p));head.addEventListener('pointerdown',e=>{if(e.button!==0||e.target.closest('button'))return;e.preventDefault();raisePanel(p);let r=p.getBoundingClientRect(),a=$('#workArea').getBoundingClientRect();let start={x:e.clientX,y:e.clientY,left:r.left-a.left,top:r.top-a.top};p.style.left=start.left+'px';p.style.top=start.top+'px';p.style.right='auto';p.style.bottom='auto';head.setPointerCapture(e.pointerId);
const move=ev=>{let v=clampPanel(p,start.left+ev.clientX-start.x,start.top+ev.clientY-start.y);p.style.left=v.left+'px';p.style.top=v.top+'px'};
const done=()=>{head.removeEventListener('pointermove',move);head.removeEventListener('pointerup',done);head.removeEventListener('pointercancel',done);rememberLayout()};head.addEventListener('pointermove',move);head.addEventListener('pointerup',done);head.addEventListener('pointercancel',done)})});
$$('[data-hide-panel]').forEach(b=>b.addEventListener('click',()=>{const p=$('#'+b.dataset.hidePanel);p.classList.add('hidden');rememberLayout()}));
function togglePanel(id){const p=$('#'+id);if(!p)return;p.classList.toggle('hidden');raisePanel(p);rememberLayout()}
function openToolsFromToolbar(){
 const p=$('#panelTools');if(!p)return;
 p.classList.remove('hidden');
 const area=$('#workArea');
 if(area){
  const bounds=area.getBoundingClientRect(),rect=p.getBoundingClientRect();
  if(rect.right<bounds.left+80||rect.left>bounds.right-80||rect.bottom<bounds.top+45||rect.top>bounds.bottom-45){
   p.style.left='12px';p.style.top='12px';p.style.right='auto';p.style.bottom='auto';
  }
 }
 raisePanel(p);rememberLayout();
}
const activeToolTrigger=$('#activeToolTrigger');
if(activeToolTrigger){
 activeToolTrigger.addEventListener('click',openToolsFromToolbar);
 // Native button handles Enter/Space automatically.
}
$('#windowsBtn').onclick=resetLayout;$('#libraryToggleBtn').onclick=()=>togglePanel('panelLibrary');connectLayerControls();
const popup=document.createElement('div');popup.className='menupopup';popup.hidden=true;document.body.appendChild(popup);
const menus={
 File:[['New blank canvas','Ctrl+N','new'],['Open image…','Ctrl+O','open'],['Paste screenshot','Ctrl+V','paste'],['Save project','Ctrl+S','save'],['Save a copy…','','savecopy'],['My saved images','','panelLibrary'],['Export PNG','','png'],['Export JPG','','jpg'],['Share image…','','share']],
 Edit:[['Undo','Ctrl+Z','undo'],['Redo','Ctrl+Y','redo'],['Erase Selection','Del','delete'],['Invert Selection','Ctrl+Shift+I','invertselection'],['Copy Selection','Ctrl+C','copyselected'],['Paste Selection','Ctrl+V','pasteselection'],['Deselect','Esc','deselect'],['Select / move','V','select'],['Magic Wand','W','wand'],['Copy entire image','','copy']],
 View:[['Fit canvas','','fit'],['Zoom in','+','zin'],['Zoom out','−','zout'],['Zoom tool','Z','zoom'],['Pan tool','H','pan'],['Restore floating windows','','layout']],
 Image:[['Crop to selection','C','cropselection'],['Resize…','Ctrl+R','resizeimage'],['Canvas Size…','Ctrl+Shift+R','canvassize'],['Flip Horizontal','','flipH'],['Flip Vertical','','flipV'],['Rotate 90° Clockwise','','cw'],['Rotate 90° Counter-Clockwise','','ccw'],['Rotate 180°','','180'],['Flatten','','flatten']],
 Extras:[
  ['SKETCHING','','#Sketching'],
  ['Prepare Sketch + Notes layers','','extras-setup'],
  ['Show / hide drawing grid','','extras-grid'],
  ['SCREENSHOT PIECES','','#Pieces'],
  ['Copy selected region into movable piece','','extras-piece-copy'],['Lift region + cover original','','extras-piece-cut'],['Replace region with editable text','','extras-piece-replace'],
  ['SMART CONNECTIONS','','#Connections'],
  ['Attach arrow / callout to shapes','','extras-attach'],['Detach selected connections','','extras-detach'],
  ['IDEA VERSIONS','','#Versions'],
  ['Create new version from current','','extras-variant-new'],['Rename current version','','extras-variant-rename'],['Compare related versions','','extras-variant-compare'],['Export versions comparison PNG','','extras-variant-export'],
  ['CANVAS','','#Canvas'],['Change canvas size (keep layers)','','extras-canvas'],['Resize artwork (keep objects)','','extras-resize'],
  ['ARRANGE SELECTED','','#Arrange'],
  ['Align left','','extras-align-left'],['Align horizontal centers','','extras-align-center'],['Align top','','extras-align-top'],
  ['Distribute horizontally','','extras-distribute-horizontal'],['Distribute vertically','','extras-distribute-vertical'],
  ['LAYERS','','#Layers'],
  ['Move selection to new layer','','extras-extract'],['Copy selection to new layer','','extras-copy-layer'],
  ['Move active layer to top','','extras-layer-top'],['Move active layer to bottom','','extras-layer-bottom'],
  ['Lock other drawing layers','','extras-lock-others'],['Unlock drawing layers','','extras-unlock'],['Show all layers','','extras-show-all'],['Remove empty layers','','extras-prune'],
  ['EXPORT','','#Export'],
  ['Export selected area / objects PNG','','extras-export-selection'],['Export annotations (transparent PNG)','','extras-export-transparent']
 ],
 Windows:[['Tools','','panelTools'],['Colors','','panelColors'],['Layers','','panelLayers'],['My images','','panelLibrary'],['History','','panelHistory'],['Reset layout','','layout']]
};
function closeMenu(){popup.hidden=true;document.querySelectorAll('.menu').forEach(button=>button.setAttribute('aria-expanded','false'))}
function runMenuAction(a){closeMenu();switch(a){case 'new':createBlank();break;case 'open':el.file.click();break;case 'paste':pasteButton();break;case 'save':saveProject();break;case 'savecopy':saveProject(true);break;case 'png':$('#exportFormat').value='png';exportImage();break;case 'jpg':$('#exportFormat').value='jpeg';exportImage();break;case 'undo':restore(st.historyIdx-1);break;case 'redo':restore(st.historyIdx+1);break;case 'copy':copyImage();break;case 'share':shareImage();break;case 'select':setTool('select');break;case 'wand':setTool('wand');break;case 'bucket':setTool('bucket');break;case 'picker':setTool('picker');break;case 'delete':deleteSelection();break;case 'copyselected':copySelectedPixels();break;case 'invertselection':invertSelection();break;case 'pasteselection':pasteSelection();break;case 'deselect':deselect();break;case 'pan':setTool('pan');break;case 'zoom':setTool('zoom');break;case 'fit':fitZoom();break;case 'zin':zoomBy(1.2);break;case 'zout':zoomBy(1/1.2);break;case 'crop':setTool('crop');break;case 'cropselection':cropToSelection();break;case 'resizeimage':showSizeDialog('resize');break;case 'canvassize':showSizeDialog('canvas');break;case 'flipH':case 'flipV':case 'cw':case 'ccw':case '180':transformImage(a);break;case 'flatten':flattenImage();break;case 'layout':resetLayout();break;
 case 'extras-setup':prepareAnnotationLayers();break;
 case 'extras-grid':toggleSketchGrid();break;
 case 'extras-piece-copy':screenshotPiece('copy');break;
 case 'extras-piece-cut':screenshotPiece('cut');break;
 case 'extras-piece-replace':screenshotPiece('replace');break;
 case 'extras-attach':attachSelection();break;
 case 'extras-detach':detachSelection();break;
 case 'extras-variant-new':createIdeaVersion();break;
 case 'extras-variant-rename':renameIdeaVersion();break;
 case 'extras-variant-compare':compareIdeaVersions();break;
 case 'extras-variant-export':exportIdeaVersions();break;
 case 'extras-canvas':showSizeDialog('canvas');break;
 case 'extras-resize':showSizeDialog('resize');break;
 case 'extras-align-left':alignSelection('left');break;
 case 'extras-align-center':alignSelection('center');break;
 case 'extras-align-top':alignSelection('top');break;
 case 'extras-distribute-horizontal':distributeSelection('horizontal');break;
 case 'extras-distribute-vertical':distributeSelection('vertical');break;
 case 'extras-extract':selectionToNewLayer(false);break;
 case 'extras-copy-layer':selectionToNewLayer(true);break;
 case 'extras-layer-top':layerToEdge('top');break;
 case 'extras-layer-bottom':layerToEdge('bottom');break;
 case 'extras-lock-others':lockOtherLayers();break;
 case 'extras-unlock':unlockDrawingLayers();break;
 case 'extras-show-all':showAllLayers();break;
 case 'extras-prune':removeEmptyLayers();break;
 case 'extras-export-selection':exportSelectionPNG();break;
 case 'extras-export-transparent':exportTransparentAnnotations();break;
 default:if(panelIds.includes(a))togglePanel(a)}}
function showMenu(name,anchor){
 if(!popup.hidden&&popup.dataset.name===name){closeMenu();return}
 closeMenu();
 popup.dataset.name=name;popup.replaceChildren();
 for(const [label,key,action] of menus[name]){
  if(action?.startsWith('#')){const heading=document.createElement('div');heading.className='extras-heading';heading.textContent=label;popup.appendChild(heading);continue}
  const button=document.createElement('button');button.type='button';
  const title=document.createElement('span'),shortcut=document.createElement('span');
  title.textContent=label;shortcut.textContent=key;shortcut.className='menu-shortcut';
  button.append(title,shortcut);
  if((action==='delete'||action==='deselect'||action==='copyselected')&&!hasSelection())button.disabled=true;
  if(action==='invertselection'&&!(st.wand||st.marquee))button.disabled=true;
  if(['extras-extract','extras-copy-layer','extras-export-selection'].includes(action)&&!hasSelection())button.disabled=true;
  if(['extras-align-left','extras-align-center','extras-align-top'].includes(action)&&selectedIndexes().length<2)button.disabled=true;
  if(['extras-distribute-horizontal','extras-distribute-vertical'].includes(action)&&selectedIndexes().length<3)button.disabled=true;
  if(['extras-layer-top','extras-layer-bottom'].includes(action)&&st.activeLayerId===BASE_LAYER)button.disabled=true;
  if(['extras-piece-copy','extras-piece-cut','extras-piece-replace'].includes(action)&&(!st.marquee||st.marquee.kind!=='rect'))button.disabled=true;
  if(['extras-attach'].includes(action)&&selectedIndexes().length<2)button.disabled=true;
  if(['extras-detach'].includes(action)&&!selectedIndexes().some(i=>['startAttachment','endAttachment','noteTargetId'].some(k=>st.objects[i]?.[k])))button.disabled=true;
  if(['extras-variant-rename','extras-variant-compare','extras-variant-export'].includes(action)&&!st.versionGroupId)button.disabled=true;
  button.onclick=()=>runMenuAction(action);popup.appendChild(button);
 }
 const rect=anchor.getBoundingClientRect(),menuWidth=Math.min(name==='Extras'?290:216,window.innerWidth-16);
 popup.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-menuWidth-8))+'px';
 popup.style.top=Math.min(rect.bottom,Math.max(8,window.innerHeight-Math.min(590,window.innerHeight-16)))+'px';
 anchor.setAttribute('aria-expanded','true');
 popup.hidden=false;
}
for(const name of Object.keys(menus)){const button=$('#menu'+name);button.setAttribute('aria-expanded','false');button.onclick=e=>{e.stopPropagation();showMenu(name,button)}}
document.addEventListener('pointerdown',e=>{if(!e.target.closest('.menupopup')&&!e.target.closest('.menu'))closeMenu()});
function askProjectName(title,initial){return new Promise(resolve=>{let dlg=$('#projectSaveDialog'),input=$('#projectNameInput');$('#saveDialogTitle').textContent=title;input.value=initial;let settled=false;const close=(value)=>{if(settled)return;settled=true;dlg.removeEventListener('close',cancel);dlg.close();resolve(value)};const cancel=()=>{if(!settled){settled=true;resolve(null)}};dlg.addEventListener('close',cancel);$('#confirmProjectSave').onclick=()=>close(input.value);$('#cancelProjectSave').onclick=()=>close(null);input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();close(input.value)}};dlg.showModal();input.focus();input.select()})}
const panelObserver=new ResizeObserver(()=>rememberLayout());panelIds.forEach(id=>panelObserver.observe($('#'+id)));

// --- Familiar color wheel (hue around edge, saturation by distance, brightness slider).
const wheel=$('#colorWheel'),wheelCtx=wheel.getContext('2d'),wSize=286,cx=wSize/2,cy=wSize/2,radius=136;
let hue=0,saturation=.75,brightness=.9;
function hsvToRgb(h,s,v){let f=n=>{let k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1))};return [f(5),f(3),f(1)].map(v=>Math.round(255*v))}
function rgbToHex(rgb){return '#'+rgb.map(x=>x.toString(16).padStart(2,'0')).join('')}
function hexToHsv(hex){const vals=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255);let [r,g,b]=vals,max=Math.max(...vals),min=Math.min(...vals),d=max-min,h=0;if(d!==0){switch(max){case r:h=((g-b)/d)%6;break;case g:h=(b-r)/d+2;break;default:h=(r-g)/d+4}h=(h*60+360)%360}return {h,s:max===0?0:d/max,v:max}}
function drawColorWheel(){const image=wheelCtx.createImageData(wSize,wSize);for(let y=0;y<wSize;y++)for(let x=0;x<wSize;x++){let dx=x-cx,dy=y-cy,d=Math.hypot(dx,dy),i=(y*wSize+x)*4;if(d>radius){image.data[i+3]=0;continue}let h=(Math.atan2(dy,dx)*180/Math.PI+360)%360,s=Math.min(1,d/radius),rgb=hsvToRgb(h,s,brightness);image.data[i]=rgb[0];image.data[i+1]=rgb[1];image.data[i+2]=rgb[2];image.data[i+3]=255}wheelCtx.putImageData(image,0,0);$('#wheelCross').style.left=(cx+radius*saturation*Math.cos(hue*Math.PI/180))/2-5+'px';$('#wheelCross').style.top=(cy+radius*saturation*Math.sin(hue*Math.PI/180))/2-5+'px'}
function syncColorWheel(hex){let c=hexToHsv(hex);if(!Number.isFinite(c.h))return;hue=c.h;saturation=c.s;brightness=c.v;$('#brightness').value=Math.round(brightness*100);$('#hexInput').value=hex;$('#primaryChip').style.background=hex;drawColorWheel()}
let selectingWheel=false;
function applyWheelPointer(e){let b=wheel.getBoundingClientRect(),x=(e.clientX-b.left)*2-cx,y=(e.clientY-b.top)*2-cy;hue=(Math.atan2(y,x)*180/Math.PI+360)%360;saturation=Math.min(1,Math.hypot(x,y)/radius);setColor(rgbToHex(hsvToRgb(hue,saturation,brightness)));syncColorWheel(st.color)}
wheel.addEventListener('pointerdown',e=>{selectingWheel=true;wheel.setPointerCapture(e.pointerId);applyWheelPointer(e)});wheel.addEventListener('pointermove',e=>{if(selectingWheel)applyWheelPointer(e)});wheel.addEventListener('pointerup',()=>selectingWheel=false);wheel.addEventListener('pointercancel',()=>selectingWheel=false);
$('#brightness').addEventListener('input',e=>{brightness=Number(e.target.value)/100;setColor(rgbToHex(hsvToRgb(hue,saturation,brightness)));$('#hexInput').value=st.color;$('#primaryChip').style.background=st.color;drawColorWheel()});
$('#hexInput').addEventListener('change',e=>{let val=e.target.value.trim();if(/^#[0-9a-f]{6}$/i.test(val)){setColor(val.toLowerCase());syncColorWheel(st.color)}else toast('Enter a valid six-digit hex color.')});
// The primary color field already updates the color wheel via setColor.
$('#palette').addEventListener('click',e=>{if(e.target.closest('.swatch'))syncColorWheel(st.color)});
function applyTextStyle(key,value){
 st[key]=value;syncTextEditorLayout();updateTextOptions();
 const obj=st.objects[st.selected];
 if(obj?.type==='text'&&!textIsEditing()){
  obj[{fontBold:'bold',fontItalic:'italic',fontUnderline:'underline',fontStrike:'strike',textAlign:'align',fontFamily:'fontFamily'}[key]]=value;
  snapshot();paint();
 }
}
$('#fontFamily').onchange=e=>applyTextStyle('fontFamily',e.target.value);
for(const [id,key] of [['boldBtn','fontBold'],['italicBtn','fontItalic'],['underlineBtn','fontUnderline'],['strikeBtn','fontStrike']]){
 $('#'+id).onclick=()=>applyTextStyle(key,!st[key]);
}
$$('.text-align-btn').forEach(btn=>btn.onclick=()=>applyTextStyle('textAlign',btn.dataset.align));
$('#finishTextBtn').onclick=()=>finishText(true);
$('#cancelTextBtn').onclick=()=>finishText(false);
el.text.addEventListener('input',syncTextEditorLayout);
const textMoveHandle=$('#textMoveHandle');
let textMovePointer=null;
textMoveHandle.addEventListener('pointerdown',e=>{
 if(!textIsEditing())return;
 e.preventDefault();e.stopPropagation();
 textMovePointer={id:e.pointerId,startX:e.clientX,startY:e.clientY,x:Number(el.text.dataset.x),y:Number(el.text.dataset.y)};
 textMoveHandle.setPointerCapture(e.pointerId);
});
textMoveHandle.addEventListener('pointermove',e=>{
 if(!textMovePointer||textMovePointer.id!==e.pointerId)return;
 el.text.dataset.x=Math.max(0,textMovePointer.x+(e.clientX-textMovePointer.startX)/st.zoom);
 el.text.dataset.y=Math.max(0,textMovePointer.y+(e.clientY-textMovePointer.startY)/st.zoom);
 syncTextEditorLayout();
});
const stopTextMove=e=>{if(textMovePointer?.id===e.pointerId)textMovePointer=null};
textMoveHandle.addEventListener('pointerup',stopTextMove);
textMoveHandle.addEventListener('pointercancel',stopTextMove);
document.addEventListener('pointerdown',e=>{
 if(!textIsEditing()||e.target===el.text||e.target===textMoveHandle||
 e.target.closest?.('#fontPack, #noteOptions, #panelColors, #topColor'))return;
 finishText(true);
},true);
$('#fillShape').onchange=e=>{
 st.fillModeShape=e.target.value;st.fillShapes=e.target.value!=='outline';
 const o=st.objects[st.selected];
 if(o&&['rect','ellipse','shape','polygon'].includes(o.type)){o.fillMode=e.target.value;o.fill=e.target.value!=='outline';if(e.target.value==='filledOutline')o.fillColor=st.secondaryColor;snapshot();paint()}
 updateContextOptions();
};
$('#shapeFillColor').onchange=e=>{st.secondaryColor=e.target.value;const o=st.objects[st.selected];if(o&&['shape','polygon'].includes(o.type)){o.fillColor=st.secondaryColor;snapshot();paint()}};
function rememberShapePreset(kind){try{localStorage.setItem('paint-last-shape-v1',kind)}catch(_){}}
$('#shapeType').onchange=e=>{const kind=e.target.value,selected=st.objects[st.selected];if(st.polygonDraft)finishPolygon();st.shapeKind=kind;rememberShapePreset(kind);if(selected?.type==='shape'&&!['custom','customSmooth'].includes(kind)){selected.shapeKind=kind;snapshot();paint()}updateContextOptions()};
$('#imageSizeApply').onclick=applySizeDialog;$('#imageSizeCancel').onclick=()=>$('#imageSizeDialog').close();
$('#keepRatio').onchange=()=>{};$('#imageSizeWidth').oninput=()=>{if($('#imageSizeDialog').dataset.mode==='resize'&&$('#keepRatio').checked)$('#imageSizeHeight').value=Math.max(1,Math.round(Number($('#imageSizeWidth').value)*st.base.height/st.base.width))};$('#imageSizeHeight').oninput=()=>{if($('#imageSizeDialog').dataset.mode==='resize'&&$('#keepRatio').checked)$('#imageSizeWidth').value=Math.max(1,Math.round(Number($('#imageSizeHeight').value)*st.base.width/st.base.height))};
$$('.toolbutton').forEach(b=>b.addEventListener('click',()=>{$('#selectedToolText').textContent=names[b.dataset.tool];$('#toolDescription').textContent=hints[b.dataset.tool]}));

const shapeCatalog=[["Basic",[["rectangle","Rectangle"],["rounded","Rounded rectangle"],["oval","Ellipse"],["diamond","Diamond"],["trapezoid","Trapezoid"],["parallelogram","Parallelogram"],["triangle","Triangle"],["rightTriangle","Right triangle"]]],["Polygons & stars",[["pentagon","Pentagon"],["hexagon","Hexagon"],["heptagon","Heptagon"],["octagon","Octagon"],["star4","4-point star"],["star5","5-point star"],["star6","6-point star"],["custom","Freeform polygon"],["customSmooth","Freeform curve"]]],["Arrows",[["arrowBlock","Arrow"],["arrowNotched","Notched arrow"],["arrowPentagon","Pentagon arrow"],["chevron","Chevron"]]],["Callouts",[["calloutRect","Speech bubble"],["calloutRound","Rounded callout"],["calloutOval","Oval callout"],["cloud","Cloud callout"]]],["Symbols",[["bolt","Lightning"],["check","Check mark"],["cross","Cross"],["gear","Gear"],["heart","Heart"]]]];
function installShapeGallery(){
 const sheet=document.querySelector('#shapeGallery');
 const trigger=document.querySelector('#shapePickerTrigger');
 const sections=document.querySelector('#shapeGallerySections');
 const select=document.querySelector('#shapeType');
 // Shapes defaults to Rectangle until the user explicitly picks a different preset.
 try{
  const saved=localStorage.getItem('paint-last-shape-v1');
  if(saved&&shapeCatalog.some(([,entries])=>entries.some(([kind])=>kind===saved))){
   st.shapeKind=saved;select.value=saved;
  }
 }catch(_){}
 const imageCache=new Map();
 let activeButton=null;
 function icon(kind){
  if(imageCache.has(kind))return imageCache.get(kind);
  const c=document.createElement('canvas');c.width=60;c.height=60;
  const g=c.getContext('2d');g.fillStyle='#c0ddfa';g.strokeStyle='#366eae';g.lineWidth=2.4;g.lineJoin='round';g.lineCap='round';
  drawShapePath(g,['custom','customSmooth'].includes(kind)?{type:'polygon',points:[{x:8,y:37},{x:17,y:10},{x:34,y:14},{x:52,y:31},{x:34,y:51},{x:10,y:47}],smooth:kind==='customSmooth'}:{type:'shape',shapeKind:kind,x1:7,y1:7,x2:53,y2:53});
  g.fill();g.stroke();
  const value=c.toDataURL('image/png');imageCache.set(kind,value);return value;
 }
 for(const [heading,entries] of shapeCatalog){
  const section=document.createElement('section');section.className='shape-gallery-section';
  const title=document.createElement('h3');title.textContent=heading;section.appendChild(title);
  const group=document.createElement('div');group.className='shape-gallery-grid';
  for(const [key,label] of entries){
   const b=document.createElement('button');b.type='button';b.className='shape-gallery-option';
   b.dataset.kind=key;b.setAttribute('aria-label',label);b.title=label;
   const img=document.createElement('img');img.src=icon(key);img.alt='';img.width=38;img.height=38;b.appendChild(img);
   b.addEventListener('click',()=>{
    const obj=st.objects[st.selected];
    if(st.tool!=='shape'&&!(obj&&obj.type==='shape'))setTool('shape');
    select.value=key;select.dispatchEvent(new Event('change',{bubbles:true}));
    syncShapePicker();close();trigger.focus({preventScroll:true});
   });
   group.appendChild(b);
  }
  section.appendChild(group);sections.appendChild(section);
 }
 function close(){sheet.hidden=true;trigger.setAttribute('aria-expanded','false')}
 window.__paintShapePickerClose=close;
 function place(){
  const rect=trigger.getBoundingClientRect();
  if(window.innerWidth<=680){
   sheet.style.left='10px';sheet.style.top='auto';sheet.style.bottom='max(12px, env(safe-area-inset-bottom))';
   sheet.style.width='calc(100vw - 20px)';
  }else{
   sheet.style.bottom='auto';sheet.style.width='min(470px, calc(100vw - 24px))';
   const width=sheet.getBoundingClientRect().width||470;
   const left=Math.max(12,Math.min(window.innerWidth-width-12,rect.left));
   const height=sheet.getBoundingClientRect().height||470;
   const top=rect.bottom+8+height>window.innerHeight?Math.max(12,rect.top-height-8):rect.bottom+8;
   sheet.style.left=left+'px';sheet.style.top=top+'px';
  }
 }
 function open(){
  sheet.hidden=false;trigger.setAttribute('aria-expanded','true');syncShapePicker();place();
 }
 trigger.addEventListener('click',()=>sheet.hidden?open():close());
 document.querySelector('#shapeGalleryClose').addEventListener('click',close);
 document.addEventListener('pointerdown',e=>{
  if(sheet.hidden||sheet.contains(e.target)||trigger.contains(e.target))return;close();
 },true);
 document.addEventListener('keydown',e=>{if(!sheet.hidden&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close();trigger.focus({preventScroll:true})}},true);
 window.addEventListener('resize',()=>{if(!sheet.hidden)place()});
 select.addEventListener('change',syncShapePicker);
 function syncShapePicker(){
  const key=select.value||st.shapeKind;
  const match=shapeCatalog.flatMap(x=>x[1]).find(x=>x[0]===key);
  document.querySelector('#selectedShapeName').textContent=match?match[1]:'Shape';
  document.querySelector('#selectedShapeIcon').style.backgroundImage='url("'+icon(key)+'")';
  if(activeButton)activeButton.classList.remove('is-selected');
  activeButton=sheet.querySelector('.shape-gallery-option[data-kind="'+key+'"]');
  if(activeButton)activeButton.classList.add('is-selected');
 }
 window.__paintShapePickerSync=syncShapePicker;
 syncShapePicker();
 // Select Shapes to draw immediately. Only the shape-picker trigger opens the gallery.
}
installShapeGallery();

function installIconPicker(){
 const sheet=$('#iconPicker'),search=$('#iconSearch'),list=$('#iconResults'),preview=$('#iconPreviewSample');
 const insertButton=$('#iconInsertButton'),title=$('#iconPickerTitle'),summary=$('#iconResultSummary');
 const preset=st.iconPreset;let family='emoji',choice=null,editingIndex=-1,requestId=0;
 let renderedIndex=-1;
 const allEmoji=emojiIconCatalog.map(([glyph,label])=>({family:'emoji',glyph,name:label}));
 const fallbackNames=Object.keys(builtinLucideIcons).sort();
 const setTabs=()=>{sheet.querySelectorAll('[data-family]').forEach(b=>b.classList.toggle('is-active',b.dataset.family===family));$('#iconColorRow').hidden=family==='emoji'};
 function selection(){return choice&&choice.family==='lucide'?choice.nodes||lucideIconMap?.get(choice.name)||builtinLucideIcons[choice.name]:null}
 function previewDraw(){
  preview.textContent='';
  if(!choice){preview.textContent='★';insertButton.disabled=true;return}
  if(family==='emoji'){const span=document.createElement('span');span.textContent=choice.glyph;span.className='icon-preview-emoji';preview.appendChild(span)}
  else{
   const c=document.createElement('canvas');c.width=60;c.height=60;preview.appendChild(c);
   const g=c.getContext('2d');drawIconObject(g,{type:'icon',iconFamily:'lucide',nodes:selection(),x1:6,y1:6,x2:54,y2:54,color:$('#iconNewColor').value,width:Number($('#iconNewStroke').value)})
  }
  insertButton.disabled=!(family==='emoji'||selection()?.length);
 }
 function highlight(){list.querySelectorAll('.icon-cell').forEach(b=>b.classList.toggle('is-selected',b.dataset.key===(choice?.name||choice?.glyph||'')))}
 function choose(item){
  choice=item;
  highlight();previewDraw();
  summary.textContent=(item.family==='emoji'?item.name:item.name.replaceAll('-',' '));
 }
 function formatName(k){return k.replaceAll('-',' ')}
 async function queryResult(){
  const now=++requestId,q=search.value.trim().toLowerCase();list.innerHTML='';
  if(family==='lucide'&&!lucideIconMap){
   summary.textContent='Loading Lucide…';
   ensureLucideCatalog().then(()=>{if(requestId===now&&family==='lucide')queryResult()});
  }
  let results;
  if(family==='emoji')results=allEmoji.filter(x=>!q||x.name.toLowerCase().includes(q)||x.glyph.includes(q));
  else results=lucideNames().filter(x=>!q||x.replaceAll('-',' ').includes(q)).sort((a,b)=>a.localeCompare(b)).map(x=>({family:'lucide',name:x,nodes:lucideIconMap?.get(x)||builtinLucideIcons[x]}));
  const limit=q?90:80;results=results.slice(0,limit);
  for(const item of results){
   const b=document.createElement('button');b.type='button';b.className='icon-cell';b.dataset.key=item.name||item.glyph;b.title=item.name;b.setAttribute('role','option');
   if(family==='emoji')b.textContent=item.glyph;
   else if(item.nodes){
    const c=document.createElement('canvas');c.width=34;c.height=34;c.className='icon-cell-canvas';
    drawIconObject(c.getContext('2d'),{type:'icon',iconFamily:'lucide',nodes:item.nodes,x1:2,y1:2,x2:32,y2:32,color:'#405b7c',width:2});
    b.appendChild(c);
   }else{b.textContent='◇'}
   b.addEventListener('click',()=>choose(item));list.appendChild(b);
  }
  highlight();
  if(!results.length)summary.textContent=lucideIconMap?'No matching icons':'No matching emoji';
  else if(!choice)summary.textContent=q?results.length+' matches':'Select an icon';
 }
 function switchFamily(next){family=next;choice=null;setTabs();queryResult();previewDraw()}
 sheet.querySelectorAll('[data-family]').forEach(b=>b.addEventListener('click',()=>switchFamily(b.dataset.family)));
 search.addEventListener('input',queryResult);
 $('#iconNewColor').addEventListener('input',previewDraw);
 $('#iconNewStroke').addEventListener('input',previewDraw);
 $('#iconNewSize').addEventListener('input',()=>{$('#iconSizeReadout').textContent=$('#iconNewSize').value+' px'});
 function close(){sheet.hidden=true;$('#iconOptionsOpen').setAttribute('aria-expanded','false');}
 function open(editExisting=false){
  editingIndex=editExisting&&st.selected>=0&&st.objects[st.selected]?.type==='icon'?st.selected:-1;
  const obj=editingIndex>=0?st.objects[editingIndex]:null;
  const current=obj?{family:obj.iconFamily,emoji:obj.emoji,name:obj.name,color:obj.color,size:Math.round(getBounds(obj).w),stroke:obj.width}:st.iconPreset;
  family=current.family||'emoji';choice=null;search.value='';
  $('#iconNewSize').value=Math.max(20,Math.min(220,current.size||72));
  $('#iconNewColor').value=current.color||st.color;$('#iconNewStroke').value=current.stroke||2;
  $('#iconSizeReadout').textContent=$('#iconNewSize').value+' px';
  title.textContent=editingIndex>=0?'Edit icon':'Insert icon';
  insertButton.textContent=editingIndex>=0?'Apply':'Insert';
  sheet.hidden=false;setTabs();queryResult();
  if(current.family==='emoji')choose({family:'emoji',glyph:current.emoji||'⭐',name:current.name||'Star'});
  else choose({family:'lucide',name:current.name||'heart',nodes:obj?.nodes||lucideIconMap?.get(current.name)||builtinLucideIcons[current.name]});
  const w=window.innerWidth,rect=$('#iconOptionsOpen').getBoundingClientRect();
  if(w<=650){sheet.style.left='10px';sheet.style.right='10px';sheet.style.top='auto';sheet.style.bottom='max(12px, env(safe-area-inset-bottom))'}
  else{sheet.style.right='auto';sheet.style.bottom='auto';sheet.style.left=Math.max(12,Math.min(w-390,rect.left))+'px';sheet.style.top=Math.max(12,Math.min(window.innerHeight-555,rect.bottom+8))+'px'}
  requestAnimationFrame(()=>search.focus({preventScroll:true}));
 }
 const centerOfVisibleCanvas=()=>{
  const a=el.canvas.getBoundingClientRect(),b=el.work.getBoundingClientRect();
  const x=(Math.max(a.left,b.left)+Math.min(a.right,b.right))/2;
  const y=(Math.max(a.top,b.top)+Math.min(a.bottom,b.bottom))/2;
  if(Number.isFinite(x)&&Number.isFinite(y)&&Math.min(a.right,b.right)>Math.max(a.left,b.left)&&Math.min(a.bottom,b.bottom)>Math.max(a.top,b.top))return nearest({clientX:x,clientY:y});
  return {x:st.base.width/2,y:st.base.height/2};
 };
 insertButton.addEventListener('click',()=>{
  if(!choice||insertButton.disabled)return;
  if(!st.base)blank();
  const size=Number($('#iconNewSize').value),color=$('#iconNewColor').value,stroke=Number($('#iconNewStroke').value);
  const old=editingIndex>=0?st.objects[editingIndex]:null;
  const c=old?objectCenter(old):centerOfVisibleCanvas();
  const width=old?getBounds(old).w:Math.min(size,st.base.width*.7),height=old?getBounds(old).h:Math.min(size,st.base.height*.7);
  const o={type:'icon',iconFamily:family,name:choice.name,emoji:family==='emoji'?choice.glyph:undefined,
   nodes:family==='lucide'?selection():undefined,color,width:stroke,
   x1:Math.max(0,c.x-width/2),y1:Math.max(0,c.y-height/2),x2:Math.max(0,c.x-width/2)+width,y2:Math.max(0,c.y-height/2)+height,
   rotation:old?.rotation||0};
  if(family==='lucide'&&!o.nodes?.length){summary.textContent='Choose a loaded Lucide icon';return}
  st.iconPreset={family,emoji:o.emoji,name:o.name,size,color,stroke};
  if(old){st.objects[editingIndex]=o}else st.objects.push(o);
  close();setTool('select');st.selected=old?editingIndex:st.objects.length-1;
  st.selectionShape='smart';const shapeSelector=$('#selectionShape');if(shapeSelector)shapeSelector.value='smart';
  snapshot();updateContextOptions();paint();toast('Icon inserted. Drag to move; handles resize and rotate.');
 });
 $('#iconPickerClose').addEventListener('click',close);
 $('#iconOptionsOpen').addEventListener('click',()=>open(st.selected>=0&&st.objects[st.selected]?.type==='icon'));
 const tool=$('.toolbutton[data-tool="icon"]');if(tool)tool.addEventListener('click',()=>open(false));
 document.addEventListener('pointerdown',e=>{if(sheet.hidden||sheet.contains(e.target)||$('#iconOptionsOpen').contains(e.target)||tool?.contains(e.target))return;close()},true);
 document.addEventListener('keydown',e=>{if(!sheet.hidden&&e.key==='Escape'){e.preventDefault();e.stopPropagation();close()}},true);
}
installIconPicker();

// --- Browser-only project library (IndexedDB stores image blobs + vectors; no server calls).
let dbPromise;
function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{if(!('indexedDB' in window)){reject(new Error('Browser storage not available'));return}const req=indexedDB.open('paint-browser-projects-v1',1);req.onupgradeneeded=()=>{let db=req.result;if(!db.objectStoreNames.contains('projects'))db.createObjectStore('projects',{keyPath:'id'})};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)}).catch(e=>{dbPromise=null;throw e});return dbPromise}
async function dbDo(mode,fn){let db=await openDB();return new Promise((resolve,reject)=>{let tx=db.transaction('projects',mode),request=fn(tx.objectStore('projects')),result;request.onsuccess=()=>result=request.result;request.onerror=()=>reject(request.error);tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error||new Error('Storage transaction cancelled'))})}
const dbAll=()=>dbDo('readonly',s=>s.getAll());
const dbGet=id=>dbDo('readonly',s=>s.get(id));
const dbPut=obj=>dbDo('readwrite',s=>s.put(obj));
const dbDelete=id=>dbDo('readwrite',s=>s.delete(id));
function toBlob(c,type='image/png',quality=.93){return new Promise((resolve,reject)=>c.toBlob(blob=>blob?resolve(blob):reject(new Error('Could not create image')),type,quality))}
function projectThumb(c){let t=document.createElement('canvas'),max=148,scale=Math.min(max/c.width,max/c.height,1);t.width=Math.max(1,Math.round(c.width*scale));t.height=Math.max(1,Math.round(c.height*scale));t.getContext('2d').drawImage(c,0,0,t.width,t.height);return t.toDataURL('image/jpeg',.72)}
function refreshDirtyStatus(){$('#dirtyIndicator').textContent=st.dirty?'●':'';$('#dirtyIndicator').style.color='#dd9241';$('#storageStatus').textContent=st.savedId?(st.dirty?'Unsaved changes · save project':'Saved locally in this browser'):'Not yet saved to browser library';renderTabs()}
function stepLabel(idx){if(idx===0)return 'Opened blank/image';let now=st.history[idx],prev=st.history[idx-1];if(now.base!==prev.base)return 'Pixel selection / image changed';let last=now.objects.at(-1),prior=prev.objects.at(-1);if(now.objects.length<prev.objects.length)return 'Removed annotation';if(now.objects.length>prev.objects.length){let tool={path:'Brush',pencilpath:'Pencil',highlight:'Highlighter',text:'Text',ellipse:'Ellipse',rect:'Rectangle',line:'Line',arrow:'Arrow',curve:'Curve',redact:'Redact box'};return 'Added '+(tool[last?.type]||'annotation')}return 'Moved or modified annotation'}
function refreshHistoryPanel(){let list=$('#historyList');if(!list)return;list.innerHTML='';st.history.forEach((step,i)=>{let b=document.createElement('button');b.className='history-step'+(i===st.historyIdx?' current':'');b.innerHTML='<span class="history-dot"></span><span>'+String(i+1).padStart(2,'0')+' · '+stepLabel(i)+'</span>';b.addEventListener('click',()=>restore(i));list.appendChild(b)});list.scrollTop=list.scrollHeight}
function createBlank(){blank();toast('New blank 1280 × 720 canvas.')}
$('#newBtn').onclick=createBlank;
$('#openBtn').onclick=()=>el.file.click();
$('#exportBtn').onclick=()=>{$('#exportFormat').value='png';exportImage()};$('#exportJpgBtn').onclick=()=>{$('#exportFormat').value='jpeg';exportImage()};
$('#saveCopyBtn').onclick=()=>saveProject(true);
$('#librarySave').onclick=saveProject;
async function saveProject(asCopy=false){
 if(!st.base)return;
 finishText(true);
 const targetId=activeTabId,old=st.name||'Untitled canvas';
 const value=await askProjectName(asCopy?'Save as new copy':'Save project in this browser',asCopy?old+' copy':old);
 if(value===null)return;
 // A save dialog belongs to the tab from which it was opened.
 if(activeTabId!==targetId){toast('Switch back to the original tab before saving.');return}
 const name=value.trim().slice(0,80)||'Untitled canvas';
 const revision=st.revision,base=st.base,objects=copyObj(st.objects),layers=copyObj(st.layers),activeLayerId=st.activeLayerId,preview=projectThumb(composite());
 const family=st.versionGroupId,versions=relatedVersions(family),versionRevisions=new Map(versions.map(({tab,data})=>[tab.id,data.revision]));
 const id=(!asCopy&&st.savedId)||('project-'+Date.now()+'-'+Math.random().toString(36).slice(2,8));
 try{
  const baseBlob=await toBlob(base);
  const savedVariants=family?await Promise.all(versions.map(async ({data})=>({name:data.name,label:data.versionLabel,baseBlob:await toBlob(data.base),objects:copyObj(data.objects),layers:copyObj(data.layers),activeLayerId:data.activeLayerId}))):null;
  await dbPut({id,name,width:base.width,height:base.height,updatedAt:Date.now(),baseBlob,objects,layers,activeLayerId,thumbnail:preview,variants:savedVariants});
  const tab=openTabs.find(entry=>entry.id===targetId);
  if(tab){
   const target=stateForTab(tab);
   target.name=family?target.name:name;target.savedId=id;
   if(family)for(const {tab:relatedTab} of versions){const v=stateForTab(relatedTab);v.savedId=id;v.versionProjectName=name;if(v.revision===versionRevisions.get(relatedTab.id))v.dirty=false}
   // A project rename should persist when stepping through Undo/Redo.
   if(!family)target.history.forEach(step=>{step.name=name});
   // Edits made while IndexedDB was writing must remain marked unsaved.
   if(target.revision===revision)target.dirty=false;
  }
  updateUI();refreshDirtyStatus();renderLibrary();
  toast('Saved '+name+' to this browser.');
 }catch(err){
  console.error(err);toast('Browser storage failed or is full. Export the image instead.');
 }
}
async function renderLibrary(){
 const list=$('#projectList');if(!list)return;
 try{
  const projects=(await dbAll()).sort((a,b)=>b.updatedAt-a.updatedAt);
  $('#libraryCount').textContent=projects.length+' saved';
  list.replaceChildren();
  if(!projects.length){
   list.innerHTML='<div class="no-projects">No saved images yet. Save a canvas to store your work in this browser.</div>';
   return;
  }
  for(const item of projects){
   const card=document.createElement('div');card.className='project';
   // The entire thumbnail and title are one tap target; Delete remains separate.
   const open=document.createElement('button');open.type='button';open.className='openproj';
   open.title='Open '+item.name+' in a tab';open.setAttribute('aria-label','Open '+item.name+' in a tab');
   const thumbnail=document.createElement('img');thumbnail.className='thumb';
   thumbnail.src=item.thumbnail;thumbnail.alt='';
   const details=document.createElement('span');details.className='project-details';
   const name=document.createElement('span');name.className='project-name';name.textContent=item.name;
   const metadata=document.createElement('span');metadata.className='project-time';
   metadata.textContent=new Date(item.updatedAt).toLocaleDateString()+' · '+item.width+' × '+item.height;
   details.append(name,metadata);open.append(thumbnail,details);
   open.addEventListener('click',async()=>{
    if(open.getAttribute('aria-busy')==='true')return;
    open.setAttribute('aria-busy','true');
    try{await openProject(item.id)}finally{open.removeAttribute('aria-busy')}
   });
   const del=document.createElement('button');del.type='button';del.className='delproj';
   del.textContent='×';del.title='Delete '+item.name;del.setAttribute('aria-label','Delete '+item.name);
   del.addEventListener('click',()=>deleteProject(item.id,item.name));
   card.append(open,del);list.appendChild(card);
  }
 }catch(error){
  console.error(error);
  list.innerHTML='<div class="no-projects">Browser storage is unavailable. Export important images as files instead.</div>';
  $('#libraryCount').textContent='Unavailable';
 }
}
const openingProjects=new Set();
function revealSavedProject(){
 if(window.innerWidth<=620){
  // The library overlays the canvas on small screens; reveal the activated image.
  $('#panelLibrary').classList.add('hidden');
  rememberLayout();
 }
}
async function decodeSavedImage(blob){
 if(!blob)throw new Error('Saved image data is missing');
 if(typeof createImageBitmap==='function'){
  try{return await createImageBitmap(blob)}
  catch(error){console.warn('ImageBitmap could not decode saved image; trying native image loader.',error)}
 }
 // Native <img> fallback improves compatibility with iOS Safari IndexedDB blobs.
 return new Promise((resolve,reject)=>{
  const url=URL.createObjectURL(blob),image=new Image();
  image.onload=()=>{URL.revokeObjectURL(url);resolve(image)};
  image.onerror=()=>{URL.revokeObjectURL(url);reject(new Error('Unable to decode saved image'))};
  image.src=url;
 });
}
async function openProject(id){
 if(openingProjects.has(id))return false;
 const existing=openTabs.find(tab=>stateForTab(tab)?.savedId===id);
 if(existing){activateTab(existing.id);revealSavedProject();toast('Switched to '+stateForTab(existing).name+'.');return true}
 openingProjects.add(id);
 try{
  const record=await dbGet(id);
  if(!record){toast('Saved project not found.');return false}
  // Check again after asynchronous loading, in case another action opened this project.
  const opened=openTabs.find(tab=>stateForTab(tab)?.savedId===id);
  if(opened){activateTab(opened.id);revealSavedProject();return true}
  const bitmap=await decodeSavedImage(record.baseBlob);
  const image=document.createElement('canvas');image.width=bitmap.width;image.height=bitmap.height;
  image.getContext('2d').drawImage(bitmap,0,0);
  bitmap.close?.();
  // Reopen related versions as editable sibling tabs within the same project.
  const versions=record.variants?.length?record.variants:[{name:record.name,baseBlob:record.baseBlob,objects:record.objects,layers:record.layers,activeLayerId:record.activeLayerId}];
  const group=record.variants?.length?'family-'+record.id:null;
  let first=null;
  for(const [i,item] of versions.entries()){
   let canvas=image;
   if(i>0||record.variants?.length){const bm=await decodeSavedImage(item.baseBlob);canvas=document.createElement('canvas');canvas.width=bm.width;canvas.height=bm.height;canvas.getContext('2d').drawImage(bm,0,0);bm.close?.()}
   initiate(canvas,item.name||record.name,false);
   st.objects=copyObj(item.objects||[]);st.layers=copyObj(item.layers||defaultLayers());st.activeLayerId=item.activeLayerId||'sketch';st.soloLayerId=null;ensureLayers();st.savedId=record.id;
   st.versionGroupId=group;st.versionLabel=item.label||null;st.versionProjectName=record.name;
   st.history=[];st.historyIdx=-1;snapshot();st.dirty=false;
   if(!first)first=activeTabId;
  }
  if(first&&first!==activeTabId)activateTab(first);
  updateContextOptions();refreshDirtyStatus();paint();
  revealSavedProject();
  toast('Opened '+record.name+' in a tab.');
  return true;
 }catch(error){
  console.error('Unable to open saved project',id,error);
  toast('Could not open this saved image. Try reloading the page.');
  return false;
 }finally{openingProjects.delete(id)}
}
async function deleteProject(id,name){
 if(!confirm('Delete "'+name+'" from this browser? This cannot be undone.'))return;
 try{
  await dbDelete(id);
  for(const tab of openTabs){
   const data=stateForTab(tab);
   if(data?.savedId===id){data.savedId=null;data.dirty=true}
  }
  refreshDirtyStatus();await renderLibrary();toast('Saved project deleted. Open tabs remain editable.');
 }catch(e){console.error(e);toast('Could not delete this project.')}
}
window.addEventListener('beforeunload',e=>{if(openTabs.some(tab=>stateForTab(tab)?.dirty)){e.preventDefault();e.returnValue=''}});
window.addEventListener('resize',()=>{requestAnimationFrame(()=>applyPositions())});
// Keep project status and sidebar history synchronized with snapshot events.
syncColorWheel(st.color);refreshHistoryPanel();refreshDirtyStatus();

updateUI();setHistoryButtons();blank();setTool("pen");st.dirty=false;refreshDirtyStatus();if(window.innerWidth<=620){let existingLayout=false;try{existingLayout=!!localStorage.getItem('paint-layout-v1')}catch(e){}if(!existingLayout)['panelColors','panelLibrary','panelHistory'].forEach(id=>$('#'+id).classList.add('hidden'))}loadPanelPositions();renderLibrary();
window.PaintDebug={state:st,changeCanvasGeometry,expandCanvasToObjects,transformGeometry,attachSelection,detachSelection,screenshotPiece,syncConnections,indexObjectIds,createIdeaVersion,renameIdeaVersion,relatedVersions,versionComparisonCanvas,exportIdeaVersions,compareIdeaVersions,selectionToNewLayer,layerToEdge,lockOtherLayers,unlockDrawingLayers,showAllLayers,removeEmptyLayers,prepareAnnotationLayers,alignSelection,distributeSelection,toggleSketchGrid,exportSelectionPNG,annotationsCanvas,exportTransparentAnnotations,ensureLayers,renderLayersPanel,orderedObjectEntries,addLayer,activateLayer,setLayerValue,reorderLayer,duplicateLayer,deleteLayer,clearLayer,moveSelectionToLayer,selectLayerObjects,soloLayer,mergeLayerDown,selectObjects,selectedIndexes,duplicateObjects,groupObjects,ungroupObjects,recognizeSketch,get tabs(){return openTabs},get activeTabId(){return activeTabId},activateTab,closeTab,createBlank,blank,save:saveProject,setTool,canvas:el.canvas,composite,openProject,deleteProject,renderLibrary,liftMarquee,insideMarquee,deleteSelection,deselect,wandSelection,zoomAt,pointerDown,pointerMove,pointerUp,fillBucket,sampleColor,transformImage,flattenImage,finishPolygon,showSizeDialog};
})();
