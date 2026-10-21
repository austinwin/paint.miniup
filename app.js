(()=>{
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const el={canvas:$('#canvas'),stage:$('#canvasStage'),work:$('#workspace'),center:$('#canvasCenter'),empty:$('#emptyState'),file:$('#fileInput'),text:$('#textEntry'),toast:$('#toast')};
const ctx=el.canvas.getContext('2d');
const colors=['#e23535','#f28b27','#f3c335','#1eae73','#2176e3','#7a4edb','#222d3d','#ffffff','#63758b','#a5afbc','#f59db8','#171717','#000000','#10b981'];
const patchImages=new Map();
const icons={select:'select',wand:'wand',bucket:'bucket',picker:'picker',pencil:'pencil',pen:'pen',highlight:'highlight',arrow:'arrow',curve:'curve',line:'line',rect:'rectangle',ellipse:'circle',text:'text',redact:'redact',crop:'crop',erase:'eraser',shape:'shapes',zoom:'zoom',pan:'hand',icon:'sticker',clone:'clone'};
const names={select:'Select / move',wand:'Magic Wand',bucket:'Fill Bucket',picker:'Color Picker',pencil:'Pencil',pen:'Paintbrush',highlight:'Highlighter',arrow:'Arrow',curve:'Curve',line:'Line',rect:'Rectangle',ellipse:'Circle',text:'Text',redact:'Redact',crop:'Crop',erase:'Eraser',shape:'Shapes',zoom:'Zoom',pan:'Pan',icon:'Icon',clone:'Clone Stamp'};
const hints={select:'Tap an object to move it, or drag to select an area · Delete removes the selection',wand:'Tap matching pixels to select, then choose Delete',bucket:'Click an area to fill with the primary color. Shift reverses flood mode.',picker:'Click a pixel to sample its color into the color wheel.',pencil:'Draw a fine line with the selected thickness',pen:'Paint naturally with mouse, touch, or pen',highlight:'Drag to mark an area with transparency',arrow:'Drag to draw an arrow; start/end heads are configurable',curve:'Drag to draw a curve, then select and move its purple bend handle',line:'Drag to draw a straight line',rect:'Drag to outline a rectangle',ellipse:'Drag to outline a circle or ellipse',text:'Click to insert editable text',redact:'Drag to cover sensitive content on export',crop:'Drag to choose the crop area, then Apply crop',erase:'Drag to erase pixels to transparency',shape:'Drag to draw a shape. Select Custom polygon to click vertices; double-click or Enter to finish.',zoom:'Click to zoom in, Alt-click or right-click to zoom out',pan:'Drag to pan the image without changing it',clone:'Select source with the button or Alt-click, then paint its pixels elsewhere.',icon:'Pick an emoji or Lucide icon, then insert it on the canvas'};
const st={base:null,objects:[],tool:'select',color:'#e23535',width:4,fontSize:28,zoom:1,history:[],historyIdx:-1,selected:-1,draft:null,crop:null,pointer:null,dragging:false,moving:false,originalObject:null,modified:false,name:'untitled',firstDraw:true,savedId:null,dirty:false,fillShapes:false,fontFamily:'Arial',fontBold:false,headSettings:{line:{start:'none',end:'none'},arrow:{start:'none',end:'arrow'},curve:{start:'none',end:'none'}},wandTolerance:24,wandMode:'contiguous',fillTolerance:20,fillMode:'contiguous',wand:null,transform:null,panning:null,marquee:null,selectionShape:'smart',shapeKind:'rectangle',polygonDraft:null,iconPreset:{family:'emoji',emoji:'⭐',name:'Star',size:72,color:'#e23535',stroke:2},lineStrokeStyle:'solid',shapeStrokeStyle:'solid',fillModeShape:'outline',brushSize:12,brushHardness:80,brushOpacity:100,nonBrushWidth:4,brushMode:'normal',brushSmoothing:35,brushPressure:false,airbrushDensity:50,eraserMode:'hard',highlighterOpacity:28,fillType:'solid',gradientMode:'linear',gradientEndColor:'#ffffff',lineMode:'straight',redactMode:'solid',redactStrength:12,cloneSource:null,clonePicking:false,polylineDraft:null};
let toastTimer;

// Multiple open images share drawing controls, but every tab owns its canvas,
// objects, undo/redo history, selection, viewport and save/dirty state.
const documentStateKeys=['base','objects','history','historyIdx','name','savedId','dirty','revision','zoom',
 'selected','draft','crop','pointer','dragging','moving','originalObject','modified','wand',
 'transform','panning','marquee','polygonDraft','polylineDraft','cloneSource','clonePicking','firstDraw'];
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
 g.drawImage(source,0,0);
 for(const object of data.objects||[]){try{drawObject(g,object)}catch(error){console.warn('Preview object skipped',error)}}
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
 updateContextOptions();updateUI();paint();setHistoryButtons();refreshHistoryPanel();refreshDirtyStatus();
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
function snapshot(){if(!st.base)return;st.revision=(st.revision||0)+1;st.history=st.history.slice(0,st.historyIdx+1);st.history.push({base:st.base,objects:copyObj(st.objects),name:st.name});if(st.history.length>50)st.history.shift();st.historyIdx=st.history.length-1;setHistoryButtons();refreshHistoryPanel();st.dirty=true;refreshDirtyStatus()}
function restore(index){if(index<0||index>=st.history.length)return;finishText(true);st.historyIdx=index;let s=st.history[index];st.base=s.base;st.objects=copyObj(s.objects);st.name=s.name;st.selected=-1;st.crop=null;st.draft=null;st.dragging=false;st.wand=null;st.transform=null;st.marquee=null;st.polygonDraft=null;st.revision=(st.revision||0)+1;sizeCanvas();updateUI();paint();setHistoryButtons();updateContextOptions();renderTabs()}
function setHistoryButtons(){$('#undoBtn').disabled=st.historyIdx<=0;$('#redoBtn').disabled=st.historyIdx>=st.history.length-1}
function toast(msg){clearTimeout(toastTimer);el.toast.textContent=msg;el.toast.classList.add('show');toastTimer=setTimeout(()=>el.toast.classList.remove('show'),2900)}
function updateUI(){const loaded=!!st.base;el.empty.style.display=loaded?'none':'flex';el.stage.style.display=loaded?'block':'none';$('#docTitle').textContent=loaded?st.name:'Untitled canvas';document.title=loaded?st.name+' — Paint':'Paint — Image editor';$('#statusDimensions').textContent=loaded?`${st.base.width} × ${st.base.height} px`:'No image loaded';$('#statusTool').textContent=loaded?`${names[st.tool]} tool`:'Ready';$('#statusObjects').textContent=`${st.objects.filter(o=>!['erase-region','eraser-stroke','fill-region'].includes(o.type)).length} annotations`;$('#statusZoom').textContent=`${Math.round(st.zoom*100)}%`;$('#toolZoomValue').textContent=`${Math.round(st.zoom*100)}%`;$('#cropbar').style.display=st.crop?'flex':'none';if(st.crop)$('#cropReadout').textContent=`${Math.round(Math.abs(st.crop.x2-st.crop.x1))} × ${Math.round(Math.abs(st.crop.y2-st.crop.y1))} px`}
function sizeCanvas(){if(!st.base)return;el.canvas.width=st.base.width;el.canvas.height=st.base.height;el.canvas.style.width=Math.round(st.base.width*st.zoom)+'px';el.canvas.style.height=Math.round(st.base.height*st.zoom)+'px';el.stage.style.width=Math.round(st.base.width*st.zoom)+'px';el.stage.style.height=Math.round(st.base.height*st.zoom)+'px'}
function fitZoom(){
 if(!st.base)return;
 // Floating panels overlay the image; don't reserve their width twice.
 const availW=Math.max(64,el.work.clientWidth-24),availH=Math.max(64,el.work.clientHeight-24);
 st.zoom=Math.max(.02,Math.min(2,availW/st.base.width,availH/st.base.height));
 sizeCanvas();updateUI();paint();
}
function zoomBy(factor){if(!st.base)return;st.zoom=Math.max(.02,Math.min(8,st.zoom*factor));sizeCanvas();updateUI();paint()}
function zoomAt(factor,clientX,clientY){if(!st.base)return;const r=el.canvas.getBoundingClientRect(),x=(clientX-r.left)/st.zoom,y=(clientY-r.top)/st.zoom;const next=Math.max(.02,Math.min(8,st.zoom*factor));if(next===st.zoom)return;st.zoom=next;sizeCanvas();updateUI();paint();const after=el.canvas.getBoundingClientRect();el.work.scrollLeft+=after.left+x*next-clientX;el.work.scrollTop+=after.top+y*next-clientY}
function updateContextOptions(){const obj=st.objects[st.selected];const lineObj=obj&&['line','arrow','curve'].includes(obj.type);const shapeObj=obj&&['rect','ellipse','shape','polygon'].includes(obj.type);const opts=['line','arrow','curve'].includes(st.tool)||lineObj;$('#lineOptions').hidden=!opts;$('#wandOptions').hidden=st.tool!=='wand';$('#eraserOptions').hidden=st.tool!=='erase';$('#highlighterOptions').hidden=st.tool!=='highlight';$('#redactOptions').hidden=st.tool!=='redact';$('#cloneOptions').hidden=st.tool!=='clone';$('#lineModeWrap').hidden=st.tool!=='line';$('#finishPolylineBtn').hidden=!(st.tool==='line'&&st.lineMode==='polyline'&&!!st.polylineDraft);$('#gradientSettings').hidden=!(st.tool==='bucket'&&st.fillType==='gradient');$('#redactStrengthWrap').hidden=st.redactMode==='solid';$('#cloneSourceStatus').textContent=st.clonePicking?'Tap source on image':st.cloneSource?'Source set · draw to clone':'Select a source first';$('#zoomOptions').hidden=st.tool!=='zoom';$('#selectionShapeOptions').hidden=st.tool!=='select';$('#iconOptions').hidden=!(st.tool==='icon'||obj?.type==='icon');$('#fillOptions').hidden=st.tool!=='bucket';const selectedBrush=obj?.type==='brush-stroke';$('#strokeOptions').hidden=!(st.tool==='pen'||(['highlight','line','curve','arrow','rect','ellipse','shape','erase','redact'].includes(st.tool))||(obj&&obj.type!=='patch'&&obj.type!=='pencilpath'));$('#brushOptions').hidden=!(st.tool==='pen'||selectedBrush);$('#brushMode').value=st.brushMode;$('#pencilInfo').hidden=st.tool!=='pencil';if(st.tool==='pen'||selectedBrush){const hard=selectedBrush?obj.hardness??80:st.brushHardness,opacity=selectedBrush?obj.opacity??100:st.brushOpacity;$('#brushHardness').value=hard;$('#brushHardnessValue').textContent=hard+'%';$('#brushOpacity').value=opacity;$('#brushOpacityValue').textContent=opacity+'%';$('#brushMode').value=st.brushMode;$('#brushSmoothing').value=String(st.brushSmoothing);$('#brushPressure').checked=st.brushPressure;$('#airbrushDensityWrap').hidden=st.brushMode!=='airbrush';$('#airbrushDensity').value=String(st.airbrushDensity);$('#airbrushDensityValue').textContent=st.airbrushDensity+'%'}$('#fontPack').hidden=!(st.tool==='text'||obj?.type==='text');const showFill=['rect','ellipse','shape'].includes(st.tool)||!!shapeObj;$('#fillShape').hidden=!showFill;document.querySelector('label[for=fillShape]').hidden=!showFill;$('#borderStyle').hidden=!showFill;$('#borderStyleLabel').hidden=!showFill;$('#shapeOptions').hidden=st.tool!=='shape'&&!(obj&&['shape','polygon'].includes(obj.type));if(obj?.type==='shape')$('#shapeType').value=obj.shapeKind||'rectangle';else $('#shapeType').value=st.shapeKind;if(window.__paintShapePickerSync)window.__paintShapePickerSync();$('#objectOptions').hidden=!(obj&&st.tool==='select');if(opts){$('#lineStyle').value=lineObj?(obj.strokeStyle||'solid'):st.lineStrokeStyle;$('#startHead').value=lineObj?(obj.startHead||'none'):st.headSettings[st.tool]?.start||'none';$('#endHead').value=lineObj?(obj.endHead||(obj.type==='arrow'?'arrow':'none')):(st.headSettings[st.tool]?.end||'none')}if(showFill){$('#borderStyle').value=shapeObj?(obj.strokeStyle||'solid'):st.shapeStrokeStyle;$('#fillShape').value=shapeObj?(obj.fillMode||(obj.fill?'filled':'outline')):st.fillModeShape}if(obj){$('#objectRotation').value=Math.round((obj.rotation||0)*180/Math.PI)}const has=!!st.wand||!!st.marquee||st.selected>=0;$('#selectionActions').hidden=!has}

function setTool(t){finishText(true);if(!names[t])return;st.tool=t;if(t==='pen')st.width=st.brushSize;else if(t==='pencil')st.width=1;else if(t!=='select')st.width=st.nonBrushWidth;$('#topWidth').value=st.width;$('#topWidthValue').value=st.width;$('#inspectorWidth').value=Math.min(40,st.width);$('#widthBadge').textContent=st.width+' px';if(t==='erase'&&st.width<10&&!st.hasSetEraserWidth){st.width=20;st.hasSetEraserWidth=true;$('#topWidth').value=20;$('#topWidthValue').value=20;$('#inspectorWidth').value=20;$('#widthBadge').textContent='20 px'}st.selected=-1;st.crop=null;st.draft=null;st.transform=null;st.polygonDraft=null;st.polylineDraft=null;$$('.toolbutton').forEach(b=>b.classList.toggle('active',b.dataset.tool===t));$('#activeToolIcon').setAttribute('href','#i-'+icons[t]);$('#activeToolLabel').textContent=names[t];$('#activeToolTrigger').setAttribute('aria-label',names[t]+' — Open Tools window');$('#toolHint').textContent=hints[t];$('#selectedToolText').textContent=names[t];$('#toolDescription').textContent=hints[t];el.canvas.style.cursor=t==='select'?'crosshair':t==='erase'?'crosshair':t==='pan'?'grab':t==='zoom'?'zoom-in':'crosshair';updateContextOptions();updateUI();paint()}
function setColor(color){st.color=color;$('#topColor').value=color;if(el.text.style.display==='block')el.text.style.color=color;if($('#hexInput'))syncColorWheel(color);$$('.swatch').forEach(x=>x.classList.toggle('selected',x.dataset.color.toLowerCase()===color.toLowerCase()));if(st.selected>=0&&st.objects[st.selected]){st.objects[st.selected].color=color;snapshot();paint()}}
function setWidth(value){if(st.tool==='pencil')return;st.width=Math.max(1,Math.min(48,Number(value)||1));if(st.tool==='pen')st.brushSize=st.width;else st.nonBrushWidth=st.width;$('#topWidth').value=st.width;$('#topWidthValue').value=st.width;$('#inspectorWidth').value=Math.min(40,st.width);$('#widthBadge').textContent=st.width+' px';if(st.selected>=0&&st.objects[st.selected]){st.objects[st.selected].width=st.width;snapshot();paint()}}
function initiate(c,name,dirty=false){
 if(activeTabId!==null){finishText(true);stashActiveTab()}
 const id=++tabSerial;openTabs.push({id,document:null,scrollLeft:0,scrollTop:0});activeTabId=id;
 st.base=c;st.objects=[];st.selected=-1;st.draft=null;st.crop=null;st.wand=null;
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
function nearest(p){let rect=el.canvas.getBoundingClientRect();return{x:Math.max(0,Math.min(st.base.width,(p.clientX-rect.left)/st.zoom)),y:Math.max(0,Math.min(st.base.height,(p.clientY-rect.top)/st.zoom))}}
function rectFor(o){return{x:Math.min(o.x1,o.x2),y:Math.min(o.y1,o.y2),w:Math.abs(o.x2-o.x1),h:Math.abs(o.y2-o.y1)}}
function getBounds(o){if(o.type==='path'||o.type==='pencilpath'||o.type==='highlight'||o.type==='brush-stroke'||o.type==='polygon'||o.type==='polyline'||o.type==='airbrush-stroke'||o.type==='clone-preview'||o.type==='eraser-stroke'){let xs=o.points.map(p=>p.x),ys=o.points.map(p=>p.y);return{x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}}if(o.type==='text'){let lines=o.text.split('\n');let max=Math.max(...lines.map(l=>l.length),1);return{x:o.x,y:o.y-3,w:Math.max(10,max*o.fontSize*.6),h:Math.max(o.fontSize*1.25,lines.length*o.fontSize*1.3)}}if(o.type==='curve'&&o.control){const b=rectFor(o);return{x:Math.min(b.x,o.control.x),y:Math.min(b.y,o.control.y),w:Math.max(b.x+b.w,o.control.x)-Math.min(b.x,o.control.x),h:Math.max(b.y+b.h,o.control.y)-Math.min(b.y,o.control.y)}}return rectFor(o)}
function objectCenter(o){const b=getBounds(o);return{x:b.x+b.w/2,y:b.y+b.h/2}}
function spin(p,c,a){return{x:c.x+(p.x-c.x)*Math.cos(a)-(p.y-c.y)*Math.sin(a),y:c.y+(p.x-c.x)*Math.sin(a)+(p.y-c.y)*Math.cos(a)}}
function unspin(p,o){return spin(p,objectCenter(o),-(o.rotation||0))}
function distanceToSegment(p,a,b){const dx=b.x-a.x,dy=b.y-a.y,len=dx*dx+dy*dy,t=len?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/len)):0;return Math.hypot(p.x-(a.x+t*dx),p.y-(a.y+t*dy))}
function findObject(x,y){for(let i=st.objects.length-1;i>=0;i--){const o=st.objects[i];if(o.type==='erase-region'||o.type==='eraser-stroke'||o.type==='fill-region')continue;const p=unspin({x,y},o),b=getBounds(o),margin=Math.max(7/st.zoom,(o.width||3)+2);if(p.x<b.x-margin||p.x>b.x+b.w+margin||p.y<b.y-margin||p.y>b.y+b.h+margin)continue;
 if(o.points){if(o.points.length===1&&Math.hypot(p.x-o.points[0].x,p.y-o.points[0].y)<margin)return i;for(let j=1;j<o.points.length;j++)if(distanceToSegment(p,o.points[j-1],o.points[j])<=margin+(o.type==='highlight'?o.width*2:0))return i;continue}
 if(['line','arrow','curve'].includes(o.type)){if(o.type==='curve'&&o.control){let prev={x:o.x1,y:o.y1};for(let t=.05;t<=1.001;t+=.05){let a=1-t,pt={x:a*a*o.x1+2*a*t*o.control.x+t*t*o.x2,y:a*a*o.y1+2*a*t*o.control.y+t*t*o.y2};if(distanceToSegment(p,prev,pt)<margin)return i;prev=pt}}else if(distanceToSegment(p,{x:o.x1,y:o.y1},{x:o.x2,y:o.y2})<margin)return i;continue}
 if(['rect','ellipse','shape','polygon'].includes(o.type)&&!o.fill){const edge=Math.min(Math.abs(p.x-b.x),Math.abs(p.x-(b.x+b.w)),Math.abs(p.y-b.y),Math.abs(p.y-(b.y+b.h)));if(edge>margin&&p.x>b.x+margin&&p.y>b.y+margin&&p.x<b.x+b.w-margin&&p.y<b.y+b.h-margin)continue}
 return i}return-1}
function handleLocations(o){let b=getBounds(o),midX=b.x+b.w/2,midY=b.y+b.h/2,c=objectCenter(o),ang=o.rotation||0;const raw=[['nw',b.x,b.y],['n',midX,b.y],['ne',b.x+b.w,b.y],['e',b.x+b.w,midY],['se',b.x+b.w,b.y+b.h],['s',midX,b.y+b.h],['sw',b.x,b.y+b.h],['w',b.x,midY],['rotate',midX,b.y-30/st.zoom]];if(o.type==='curve'&&o.control)raw.push(['control',o.control.x,o.control.y]);return raw.map(([kind,x,y])=>({kind,...spin({x,y},c,ang)}))}
function selectedHandle(p){if(st.selected<0)return null;const o=st.objects[st.selected],hs=handleLocations(o);for(let i=hs.length-1;i>=0;i--){if(Math.hypot(p.x-hs[i].x,p.y-hs[i].y)<=Math.max(8,9/st.zoom))return hs[i].kind}return null}
function resizeGeometry(o,original,b,scaleX,scaleY){let mid={x:b.x+b.w/2,y:b.y+b.h/2};const map=p=>({x:mid.x+(p.x-mid.x)*scaleX,y:mid.y+(p.y-mid.y)*scaleY});if(original.points){o.points=original.points.map(map)}else if(original.type==='text'){let q=map({x:original.x,y:original.y});o.x=q.x;o.y=q.y;o.fontSize=Math.max(6,Math.round(original.fontSize*Math.max(.15,Math.abs(scaleY))))}else{let a=map({x:original.x1,y:original.y1}),d=map({x:original.x2,y:original.y2});o.x1=a.x;o.y1=a.y;o.x2=d.x;o.y2=d.y;if(original.control)o.control=map(original.control)}}

function moveObject(o,dx,dy){if(o.points){o.points.forEach(p=>{p.x+=dx;p.y+=dy})}else if(o.type==='text'){o.x+=dx;o.y+=dy}else{o.x1+=dx;o.x2+=dx;o.y1+=dy;o.y2+=dy;if(o.control){o.control.x+=dx;o.control.y+=dy}}}

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
function fillShapePattern(g,o,b){const mode=o.fillMode||(o.fill?'filled':'outline');if(mode==='outline'||mode==='none')return;if(mode==='filled'){g.fill();return}g.save();g.clip();g.setLineDash([]);g.strokeStyle=o.color||'#e23535';g.lineWidth=Math.max(1,Math.min(3,(o.width||4)*.55));hatchFill(g,b,mode,o.width||4);g.restore()}

function drawShapePath(g,o){
 const b=getBounds(o);g.beginPath();
 if(o.type==='polygon'){
  const pts=o.points||[];if(!pts.length)return;
  g.moveTo(pts[0].x,pts[0].y);for(const p of pts.slice(1))g.lineTo(p.x,p.y);
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
function drawObject(g,o){g.save();if(o.cutouts?.length){g.beginPath();g.rect(0,0,st.base.width,st.base.height);for(const area of o.cutouts)g.rect(area.x,area.y,area.w,area.h);g.clip('evenodd')}if(o.rotation){let ctr=objectCenter(o);g.translate(ctr.x,ctr.y);g.rotate(o.rotation);g.translate(-ctr.x,-ctr.y)}let c=o.color||'#e23535';g.lineWidth=o.width||4;g.strokeStyle=c;g.fillStyle=c;g.lineCap='round';g.lineJoin='round';if(o.type==='patch'||o.type==='erase-region'||o.type==='fill-region'){const image=patchImage(o.src);if(o.type==='erase-region')g.globalCompositeOperation='destination-out';if(image&&(image instanceof HTMLCanvasElement||(image.complete&&image.naturalWidth)))g.drawImage(image,Math.min(o.x1,o.x2),Math.min(o.y1,o.y2),Math.abs(o.x2-o.x1),Math.abs(o.y2-o.y1));else if(o.type==='erase-region'&&!o.src){let b=rectFor(o);g.fillRect(b.x,b.y,b.w,b.h)}}else if(o.type==='eraser-stroke'&&o.mode==='soft'){drawSoftEraser(g,o)}else if(o.type==='eraser-stroke'){g.globalCompositeOperation='destination-out';g.strokeStyle='#000';g.fillStyle='#000';g.lineWidth=o.width||20;g.beginPath();const pts=o.points||[];if(pts.length){g.moveTo(pts[0].x,pts[0].y);for(const pt of pts.slice(1))g.lineTo(pt.x,pt.y);if(pts.length===1){g.arc(pts[0].x,pts[0].y,g.lineWidth/2,0,Math.PI*2);g.fill()}else g.stroke()}}else if(o.type==='brush-stroke'){drawPaintbrush(g,o)}else if(o.type==='airbrush-stroke'){drawAirbrush(g,o)}else if(o.type==='gradient'){drawGradient(g,o)}else if(o.type==='clone-preview'){g.save();g.globalAlpha=.3;g.strokeStyle='#358ad2';g.lineWidth=o.width||12;g.beginPath();g.moveTo(o.points[0].x,o.points[0].y);for(const p of o.points.slice(1))g.lineTo(p.x,p.y);g.stroke();g.restore()}else if(o.type==='pencilpath'&&o.pixelMode){drawPencilPixels(g,o.points)}else if(o.type==='path'||o.type==='pencilpath'||o.type==='highlight'||o.type==='polyline'){if(o.points.length){if(o.type==='highlight'){g.globalAlpha=Math.max(.01,Math.min(1,(o.opacity??28)/100));g.lineWidth=Math.max(12,o.width*5)}g.beginPath();g.moveTo(o.points[0].x,o.points[0].y);for(const p of o.points.slice(1))g.lineTo(p.x,p.y);if(o.points.length===1){g.lineTo(o.points[0].x+.01,o.points[0].y+.01)}g.stroke()}}else if(o.type==='text'){g.font=`${o.bold?'bold ':''}${o.fontSize}px ${o.fontFamily||'Arial'}, sans-serif`;g.textBaseline='top';g.fillStyle=c;o.text.split('\n').forEach((line,i)=>g.fillText(line,o.x,o.y+i*o.fontSize*1.3))}else{let b=o.type==='polygon'?getBounds(o):rectFor(o);if(o.type==='icon'){drawIconObject(g,o)}else if(o.type==='redact'){g.fillStyle='#131313';g.fillRect(b.x,b.y,b.w,b.h)}else if(o.type==='rect'){applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);g.beginPath();g.rect(b.x,b.y,b.w,b.h);fillShapePattern(g,o,b);g.stroke()}else if(o.type==='shape'||o.type==='polygon'){applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);drawShapePath(g,o);fillShapePattern(g,o,b);g.stroke()}else if(o.type==='ellipse'){applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);g.beginPath();g.ellipse(b.x+b.w/2,b.y+b.h/2,Math.max(.1,b.w/2),Math.max(.1,b.h/2),0,0,Math.PI*2);fillShapePattern(g,o,b);g.stroke()}else if(['arrow','line','curve'].includes(o.type)){const cp=o.control||{x:(o.x1+o.x2)/2,y:(o.y1+o.y2)/2};applyStrokePreset(g,o.strokeStyle||'solid',o.width||4);g.beginPath();g.moveTo(o.x1,o.y1);if(o.type==='curve')g.quadraticCurveTo(cp.x,cp.y,o.x2,o.y2);else g.lineTo(o.x2,o.y2);g.stroke();g.setLineDash([]);const h1=o.startHead||'none',h2=o.endHead||(o.type==='arrow'?'arrow':'none');drawLineHead(g,o.x1,o.y1,o.type==='curve'?Math.atan2(o.y1-cp.y,o.x1-cp.x):Math.atan2(o.y1-o.y2,o.x1-o.x2),h1,o.width);drawLineHead(g,o.x2,o.y2,o.type==='curve'?Math.atan2(o.y2-cp.y,o.x2-cp.x):Math.atan2(o.y2-o.y1,o.x2-o.x1),h2,o.width)}}g.restore()}
function drawLineHead(g,x,y,a,mode,width){if(!mode||mode==='none')return;const len=Math.max(13,width*4),spread=.55;g.beginPath();if(mode==='circle'){g.arc(x,y,Math.max(4,width*1.7),0,Math.PI*2);g.fill();return}g.moveTo(x-len*Math.cos(a-spread),y-len*Math.sin(a-spread));g.lineTo(x,y);g.lineTo(x-len*Math.cos(a+spread),y-len*Math.sin(a+spread));if(mode==='filled'){g.closePath();g.fill()}else g.stroke()}
function renderSelection(){if(st.selected<0||!st.objects[st.selected])return;const o=st.objects[st.selected],b=getBounds(o),c=objectCenter(o),a=o.rotation||0;ctx.save();ctx.translate(c.x,c.y);ctx.rotate(a);ctx.translate(-c.x,-c.y);ctx.strokeStyle='#2375dc';ctx.lineWidth=1.25/st.zoom;ctx.setLineDash([5/st.zoom,4/st.zoom]);ctx.strokeRect(b.x-3/st.zoom,b.y-3/st.zoom,b.w+6/st.zoom,b.h+6/st.zoom);ctx.setLineDash([]);ctx.restore();const hs=handleLocations(o);ctx.save();hs.forEach(v=>{let sz=7/st.zoom;ctx.fillStyle=v.kind==='rotate'?'#0c9d85':v.kind==='control'?'#9457d7':'#ffffff';ctx.strokeStyle=v.kind==='control'?'#7036ad':'#2375dc';ctx.lineWidth=1.5/st.zoom;if(v.kind==='rotate'||v.kind==='control'){ctx.beginPath();ctx.arc(v.x,v.y,5.5/st.zoom,0,Math.PI*2);ctx.fill();ctx.stroke()}else{ctx.fillRect(v.x-sz/2,v.y-sz/2,sz,sz);ctx.strokeRect(v.x-sz/2,v.y-sz/2,sz,sz)}});ctx.restore()}

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
 st.objects.push({type:'patch',src,x1:r.x,y1:r.y,x2:r.x+r.w,y2:r.y+r.h,color:'#fff',width:1});
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
 st.objects.push({type:'fill-region',src,x1:minX,y1:minY,x2:maxX+1,y2:maxY+1});snapshot();paint();
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
 st.objects.push({type:'erase-region',src,x1:minX,y1:minY,x2:maxX+1,y2:maxY+1});
 st.wand=null;st.selected=-1;st.marquee=null;snapshot();updateContextOptions();paint();toast(`Cleared ${count.toLocaleString()} pixels to transparency · Undo to restore`);return true;
}
function hasSelection(){return !!(st.wand||st.marquee||st.selected>=0)}
function deselect(){st.marquee=null;st.wand=null;st.selected=-1;st.transform=null;updateContextOptions();paint()}
function deleteSelection(){
 if(!st.base||!hasSelection()){toast('Select an object or area first.');return false}
 if(st.wand)return clearWandPixels();
 if(st.marquee){
   const r=marqueeBounds();if(!r||r.w<2||r.h<2)return false;
   st.objects.push(eraseSelectionRecord(st.marquee,r));st.marquee=null;st.selected=-1;
   snapshot();updateContextOptions();paint();toast('Area cleared to transparency · Undo to restore');return true;
 }
 if(st.selected>=0){
   st.objects.splice(st.selected,1);st.selected=-1;
   snapshot();updateContextOptions();paint();toast('Object deleted · Undo to restore');return true;
 }
 return false;
}
// Render only the selected object or pixels into a transparent PNG.
let internalSelection=null; // In-app fallback if the browser clipboard is unavailable.
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
  const b=getBounds(object),center=objectCenter(object),angle=object.rotation||0;
  const corners=[[b.x,b.y],[b.x+b.w,b.y],[b.x+b.w,b.y+b.h],[b.x,b.y+b.h]].map(([px,py])=>spin({x:px,y:py},center,angle));
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
 if(object)drawObject(g,object);
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
 internalSelection=selected;
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
function composite(){let output=document.createElement('canvas');output.width=st.base.width;output.height=st.base.height;const g=output.getContext('2d');g.drawImage(st.base,0,0);st.objects.forEach(o=>drawObject(g,o));return output}
function paint(){if(!st.base)return;ctx.clearRect(0,0,st.base.width,st.base.height);ctx.drawImage(st.base,0,0);st.objects.forEach(o=>drawObject(ctx,o));if(st.draft)drawObject(ctx,st.draft);if(st.wand)ctx.drawImage(st.wand.overlay,0,0);renderSelection();paintMarquee();$('#selectionActions').hidden=!(st.wand||st.marquee||st.selected>=0);if(st.crop){let b=rectFor(st.crop);ctx.save();ctx.fillStyle='#10223d55';ctx.fillRect(0,0,st.base.width,st.base.height);ctx.clearRect(b.x,b.y,b.w,b.h);ctx.drawImage(st.base,b.x,b.y,b.w,b.h,b.x,b.y,b.w,b.h);ctx.save();ctx.beginPath();ctx.rect(b.x,b.y,b.w,b.h);ctx.clip();st.objects.forEach(o=>drawObject(ctx,o));ctx.restore();ctx.strokeStyle='#fff';ctx.lineWidth=2/st.zoom;ctx.setLineDash([8/st.zoom,5/st.zoom]);ctx.strokeRect(b.x,b.y,b.w,b.h);ctx.restore()}updateUI()}
function finishText(commit){
 const field=el.text;if(field.style.display==='none'||!field.style.display)return;
 const val=field.value.trimEnd(),x=Number(field.dataset.x),y=Number(field.dataset.y);
 field.style.display='none';field.value='';
 let editing=st.editingOriginal;st.editingOriginal=null;
 if(commit&&val){const newObj={type:'text',x,y,text:val,fontSize:st.fontSize,color:st.color,width:st.width,fontFamily:st.fontFamily,bold:st.fontBold};
 if(editing)st.objects.splice(editing.index,0,newObj);else st.objects.push(newObj);snapshot();paint();return}
 if(editing){st.objects.splice(editing.index,0,editing.object);paint()}
}
function showText(x,y,existing){
 if(!st.base)return;finishText(true);const field=el.text;let value='';
 if(existing>=0){let o=st.objects[existing];value=o.text;x=o.x;y=o.y;
 st.editingOriginal={object:copyObj(o),index:existing};
 st.fontSize=o.fontSize;st.fontFamily=o.fontFamily||'Arial';st.fontBold=!!o.bold;setColor(o.color);
 $('#fontSize').value=st.fontSize;$('#fontFamily').value=st.fontFamily;$('#boldBtn').style.background=st.fontBold?'#d9eafb':'';
 st.objects.splice(existing,1);st.selected=-1;updateContextOptions()}
 field.dataset.x=x;field.dataset.y=y;
 field.style.left=x*st.zoom+'px';field.style.top=y*st.zoom+'px';field.style.fontSize=st.fontSize*st.zoom+'px';
 field.style.fontFamily=st.fontFamily;field.style.fontWeight=st.fontBold?'bold':'normal';field.style.color=st.color;
 field.style.width=Math.max(190,300*st.zoom)+'px';field.style.height=Math.max(52,90*st.zoom)+'px';
 field.value=value;field.style.display='block';
 // Keep text readable even when the canvas is zoomed out; avoid iOS focus zoom.
 field.style.fontSize=Math.max(16,st.fontSize*st.zoom)+'px';
 field.focus({preventScroll:true});paint()
}
function updateDraft(p,shift){if(!st.draft)return;if(st.draft.points){st.draft.points.push(p)}else{let a=st.draft,b={...p};if(shift&&(a.type==='rect'||a.type==='ellipse'||a.type==='shape')){let s=Math.max(Math.abs(b.x-a.x1),Math.abs(b.y-a.y1));b.x=a.x1+Math.sign(b.x-a.x1||1)*s;b.y=a.y1+Math.sign(b.y-a.y1||1)*s}if(shift&&(a.type==='arrow'||a.type==='line')){let ang=Math.atan2(b.y-a.y1,b.x-a.x1),snap=Math.round(ang/(Math.PI/4))*(Math.PI/4),length=Math.hypot(b.x-a.x1,b.y-a.y1);b.x=a.x1+length*Math.cos(snap);b.y=a.y1+length*Math.sin(snap)}a.x2=b.x;a.y2=b.y}}
// Cursor feedback is specific to the transform handle, including object rotation.
const rotateCursor='url("data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 28 28"><path d="M22 13a9 9 0 1 0-3 7" fill="none" stroke="#143c72" stroke-width="2.8" stroke-linecap="round"/><path d="m18 6 5 7 3-7" fill="#fff" stroke="#143c72" stroke-width="2" stroke-linejoin="round"/></svg>')+'") 14 14, crosshair';
function cursorForHandle(handle,object){
 if(handle==='rotate')return rotateCursor;
 if(handle==='control')return 'move';
 const angles={e:0,ne:-45,n:-90,nw:-135,w:180,sw:135,s:90,se:45};
 const deg=(angles[handle]+(object?.rotation||0)*180/Math.PI+1800)%180;
 return ['ew-resize','nwse-resize','ns-resize','nesw-resize'][Math.round(deg/45)%4];
}
function updateSelectCursor(e){
 if(!st.base||st.tool!=='select'||st.dragging||e.pointerType==='touch')return;
 const p=nearest(e),handle=selectedHandle(p);
 if(handle){el.canvas.style.cursor=cursorForHandle(handle,st.objects[st.selected]);return}
 if(st.marquee&&insideMarquee(p)){el.canvas.style.cursor='grab';return}
 const hit=findObject(p.x,p.y);
 el.canvas.style.cursor=hit>=0&&(st.selectionShape==='smart'||(hit===st.selected&&st.objects[hit]?.type==='patch'))?'grab':'crosshair';
}
function pointerDown(e){
 if(!st.base||e.button!==0)return;
 if(el.text.style.display!=='none')finishText(true);
 const p=nearest(e);
 if(st.tool==='zoom'){zoomAt(e.altKey?1/1.35:1.35,e.clientX,e.clientY);return}
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
 if(st.tool==='shape'&&st.shapeKind==='custom'){if(!st.polygonDraft)st.polygonDraft={type:'polygon',points:[],fill:st.fillModeShape!=='outline',fillMode:st.fillModeShape,strokeStyle:st.shapeStrokeStyle,color:st.color,width:st.width};st.polygonDraft.points.push(p);st.draft={...st.polygonDraft,points:[...st.polygonDraft.points,p]};paint();return}
 st.pointer=p;st.dragging=true;st.moving=false;
 st.paintSelection=(st.wand||st.marquee)?pixelSelectionMask():null;
 if(st.tool==='pan'){st.panning={x:e.clientX,y:e.clientY,left:el.work.scrollLeft,top:el.work.scrollTop};el.canvas.style.cursor='grabbing'}
 else if(st.tool==='select'){
   // A new selection gesture replaces any inverted or Magic Wand pixel mask.
   st.wand=null;
   if(st.marquee&&insideMarquee(p)){
     if(liftMarquee()){st.transform={mode:'move',original:copyObj(st.objects[st.selected]),origin:p,center:objectCenter(st.objects[st.selected])};st.originalObject=copyObj(st.objects[st.selected]);st.moving=false}
   }else{
     st.marquee=null;
     const h=selectedHandle(p);
     if(h&&st.selected>=0){st.transform={mode:h,original:copyObj(st.objects[st.selected]),origin:p,center:objectCenter(st.objects[st.selected]),bounds:getBounds(st.objects[st.selected])};st.originalObject=copyObj(st.objects[st.selected])}
     else{
       const hit=findObject(p.x,p.y);
       st.selected=(st.selectionShape==='smart'||(hit===st.selected&&st.objects[hit]?.type==='patch'))?hit:-1;
       st.originalObject=st.selected>=0?copyObj(st.objects[st.selected]):null;
       if(st.selected>=0)st.transform={mode:'move',original:copyObj(st.objects[st.selected]),origin:p,center:objectCenter(st.objects[st.selected])};
       else{
        const kind=st.selectionShape==='smart'?'rect':st.selectionShape;
        st.marquee={kind,x1:p.x,y1:p.y,x2:p.x,y2:p.y,...(kind==='lasso'?{points:[p]}:{})};
        st.transform={mode:'marquee',origin:p}
       }
     }
   }
   updateContextOptions();
   if(st.transform?.mode==='move')el.canvas.style.cursor='grabbing';else if(st.selected>=0&&st.transform?.mode!=='marquee')el.canvas.style.cursor=cursorForHandle(st.transform.mode,st.objects[st.selected]);
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
 else{st.selected=-1;st.draft=['pen','pencil','highlight'].includes(st.tool)?{type:st.tool==='pen'?(st.brushMode==='airbrush'?'airbrush-stroke':'brush-stroke'):st.tool==='pencil'?'pencilpath':'highlight',points:[{...p,pressure:st.brushPressure&&e.pointerType==='pen'?Math.max(.1,e.pressure||.5):1}],color:st.color,width:st.tool==='pen'?st.brushSize:st.tool==='pencil'?1:st.width,...(st.tool==='pen'?{hardness:st.brushHardness,opacity:st.brushOpacity,pressureEnabled:st.brushPressure,smoothing:st.brushSmoothing,density:st.airbrushDensity}:st.tool==='pencil'?{pixelMode:true}:{opacity:st.highlighterOpacity})}:{type:st.tool,x1:p.x,y1:p.y,x2:p.x,y2:p.y,color:st.color,width:st.width,fill:st.fillModeShape!=='outline',fillMode:['rect','ellipse','shape'].includes(st.tool)?st.fillModeShape:'outline',strokeStyle:['line','arrow','curve'].includes(st.tool)?st.lineStrokeStyle:st.shapeStrokeStyle,shapeKind:st.shapeKind,startHead:st.headSettings[st.tool]?.start||'none',endHead:st.headSettings[st.tool]?.end||'none',...(st.tool==='redact'?{mode:st.redactMode,strength:st.redactStrength}:{})}}
 try{el.canvas.setPointerCapture(e.pointerId)}catch(_){}paint();
}
function pointerMove(e){
 if(!st.dragging||!st.base){
  if(st.tool==='line'&&st.lineMode==='polyline'&&st.polylineDraft?.points.length){
   st.draft={...st.polylineDraft,points:[...st.polylineDraft.points,nearest(e)]};paint();
  }
  updateSelectCursor(e);return;
 }
 const p=nearest(e),dx=p.x-st.pointer.x,dy=p.y-st.pointer.y;
 if(st.tool==='pan'&&st.panning){el.work.scrollLeft=st.panning.left+st.panning.x-e.clientX;el.work.scrollTop=st.panning.top+st.panning.y-e.clientY;return}
 if(st.tool==='select'&&st.transform?.mode==='marquee'&&st.marquee){st.marquee.x2=p.x;st.marquee.y2=p.y;if(st.marquee.kind==='lasso'){const points=st.marquee.points,last=points[points.length-1];if(!last||Math.hypot(p.x-last.x,p.y-last.y)>=1.5)points.push(p)}}
 else if(st.tool==='select'&&st.selected>=0&&st.transform){
  const tr=st.transform,o=copyObj(tr.original);
  if(tr.mode==='move'){moveObject(o,dx,dy);st.moving=Math.hypot(dx,dy)>2}
  else if(tr.mode==='rotate'){const a=Math.atan2(p.y-tr.center.y,p.x-tr.center.x),b=Math.atan2(tr.origin.y-tr.center.y,tr.origin.x-tr.center.x);o.rotation=(o.rotation||0)+a-b;if(e.shiftKey)o.rotation=Math.round(o.rotation/(Math.PI/12))*(Math.PI/12);st.moving=true}
  else if(tr.mode==='control'&&o.type==='curve'){const prev=unspin(p,tr.original),orig=unspin(tr.origin,tr.original);o.control={x:tr.original.control.x+prev.x-orig.x,y:tr.original.control.y+prev.y-orig.y};st.moving=true}
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
 if(st.tool==='select'){
  if(st.transform?.mode==='marquee'){const r=marqueeBounds();if(!r||r.w<4||r.h<4||(st.marquee?.kind==='lasso'&&st.marquee.points.length<3))st.marquee=null;else toast('Area selected. Drag to move or tap Delete.');updateContextOptions()}
  else if(st.moving)snapshot();
  else if(st.transform?.mode==='move'&&st.objects[st.selected]?.type==='patch'){snapshot()}
  st.transform=null;updateSelectCursor(e);
 }
 if(st.draft&&!(st.tool==='shape'&&st.shapeKind==='custom')){
  const o=st.draft;st.draft=null;
  const valid=o.type==='gradient'||o.points?.length>=1||Math.hypot((o.x2||0)-(o.x1||0),(o.y2||0)-(o.y1||0))>=2;
  if(valid){
   if(o.type==='curve')o.control={x:(o.x1+o.x2)/2,y:(o.y1+o.y2)/2};
   let finished=o;
   if(o.type==='clone-preview')finished=makeClonePatch(o,st.cloneBase,st.cloneSource);
   else if(o.type==='gradient'&&!st.paintSelection)finished=makeGradientPatch(o);
   else if(o.type==='redact'&&o.mode!=='solid')finished=makePrivacyPatch(o);
   else if(st.paintSelection)finished=clipStrokeToSelection(o,st.paintSelection);
   if(finished){st.objects.push(finished);snapshot()}
   if(o.type==='curve'&&finished===o){setTool('select');st.selected=st.objects.length-1;updateContextOptions();toast('Drag the purple handle to bend the curve')}
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
 const o=st.polygonDraft;st.polygonDraft=null;st.draft=null;
 if(o.points.length<3){toast('Click at least three corners to draw a polygon.');paint();return}
 st.objects.push(copyObj(o));snapshot();paint();toast('Polygon drawn · use Select to move or rotate');
}
function applyCrop(){if(!st.base||!st.crop)return;let b=rectFor(st.crop),x=Math.max(0,Math.floor(b.x)),y=Math.max(0,Math.floor(b.y)),w=Math.min(st.base.width-x,Math.ceil(b.w)),h=Math.min(st.base.height-y,Math.ceil(b.h));if(w<5||h<5)return;let c=composite(),out=document.createElement('canvas');out.width=w;out.height=h;out.getContext('2d').drawImage(c,x,y,w,h,0,0,w,h);st.base=out;st.objects=[];st.crop=null;st.selected=-1;sizeCanvas();snapshot();fitZoom();setTool('select');toast('Image cropped. Undo will restore the original.')}
function commitRaster(canvas,message){
 finishText(true);st.base=canvas;st.objects=[];st.selected=-1;st.wand=null;st.marquee=null;st.crop=null;st.polygonDraft=null;st.draft=null;
 sizeCanvas();snapshot();fitZoom();updateContextOptions();paint();toast(message+' · Undo restores the previous edit');
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
function applySizeDialog(){
 const dlg=$('#imageSizeDialog'),mode=dlg.dataset.mode,ow=st.base.width,oh=st.base.height;
 const w=Math.floor(Number($('#imageSizeWidth').value)),h=Math.floor(Number($('#imageSizeHeight').value));
 if(!Number.isFinite(w)||!Number.isFinite(h)||w<1||h<1||w>12000||h>12000||w*h>50000000){toast('Use image sizes up to 12,000 px and 50 megapixels.');return}
 const old=composite(),out=document.createElement('canvas');out.width=w;out.height=h;const g=out.getContext('2d');
 if(mode==='resize'){g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';g.drawImage(old,0,0,w,h)}
 else{const anchor=$('#canvasAnchor').value;let x=anchor==='left'?0:anchor==='right'?w-ow:Math.round((w-ow)/2);let y=anchor==='top'?0:anchor==='bottom'?h-oh:Math.round((h-oh)/2);g.drawImage(old,x,y)}
 dlg.close();commitRaster(out,mode==='resize'?'Image resized':'Canvas dimensions changed');
}
function cropToSelection(){if(st.marquee){const r=marqueeBounds();if(!r||r.w<2||r.h<2)return;st.crop={type:'crop',x1:r.x,y1:r.y,x2:r.x+r.w,y2:r.y+r.h};applyCrop()}else if(st.crop)applyCrop();else{setTool('crop');toast('Drag a rectangle and choose Apply crop.')}}
function safeFilename(){return st.name.replace(/\.[^.]+$/,'').replace(/[^\w\-. ]+/g,'').trim().slice(0,70)||'marked-image'}
async function exportImage(){if(!st.base){toast('Open or paste an image first.');return}finishText(true);let kind=$('#exportFormat').value,can=composite(),mime=kind==='jpeg'?'image/jpeg':'image/png';if(kind==='jpeg'){const c=document.createElement('canvas');c.width=can.width;c.height=can.height;const g=c.getContext('2d');g.fillStyle='#ffffff';g.fillRect(0,0,c.width,c.height);g.drawImage(can,0,0);can=c}can.toBlob(blob=>{if(!blob){toast('Could not export this image.');return}const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=safeFilename()+'-marked.'+(kind==='jpeg'?'jpg':'png');document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000);toast('Image saved to your downloads.')},mime,.92)}
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
  st.objects.push({type:'patch',src,x1:x,y1:y,x2:x+width,y2:y+height,color:'#ffffff',width:1,rotation:0});
  st.selected=st.objects.length-1;snapshot();updateContextOptions();paint();
  toast('Pasted onto this canvas. Drag to move; use handles to resize or rotate.');
 }catch(err){console.error('Paste image failed',err);toast('Could not paste this image. Try copying it again.')}
}
// Mouse position is used when pasting while the pointer is on the image.
el.canvas.addEventListener('pointerenter',e=>{st.pastePointerInside=true;st.pastePointer=nearest(e)});
el.canvas.addEventListener('pointermove',e=>{st.pastePointerInside=true;st.pastePointer=nearest(e)});
el.canvas.addEventListener('pointerleave',()=>{st.pastePointerInside=false});
async function pasteButton(){try{if(!navigator.clipboard?.read)throw new Error('no-read');const items=await navigator.clipboard.read();for(const item of items){const type=item.types.find(t=>t.startsWith('image/'));if(type){const blob=await item.getType(type);await pasteImageObject(blob);return}}toast('Clipboard contains no image.')}catch(e){toast('Use Ctrl / ⌘ + V to paste, or Open to choose a file.')}}
async function pasteSelection(){
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
function keyHandler(e){const tag=document.activeElement?.tagName,editing=el.text.style.display==='block';if(editing){if(e.isComposing||e.keyCode===229)return;if(e.key==='Escape'){e.preventDefault();finishText(false);paint()}else if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();finishText(true)}return}if(['INPUT','TEXTAREA','SELECT'].includes(tag))return;const cmd=e.ctrlKey||e.metaKey;if(cmd){const k=e.key.toLowerCase();if(k==='tab'){e.preventDefault();cycleTab(e.shiftKey?-1:1);return}if(k==='w'){e.preventDefault();closeTab(activeTabId);return}if(k==='n'){e.preventDefault();createBlank()}if(k==='r'){e.preventDefault();showSizeDialog(e.shiftKey?'canvas':'resize')}if(k==='s'){e.preventDefault();saveProject()}if(k==='z'){e.preventDefault();restore(st.historyIdx+(e.shiftKey?1:-1))}if(k==='y'){e.preventDefault();restore(st.historyIdx+1)}if(k==='o'){e.preventDefault();el.file.click()}if(k==='c'){e.preventDefault();if(hasSelection())copySelectedPixels();else copyImage()}if(k==='i'&&e.shiftKey){e.preventDefault();invertSelection()}return}if(e.key==='Delete'||e.key==='Backspace'){if(hasSelection()){e.preventDefault();deleteSelection()}return}if(st.selected>=0&&st.objects[st.selected]&&['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(e.key)){e.preventDefault();const n=e.shiftKey?10:1;const dx=e.key==='ArrowLeft'?-n:e.key==='ArrowRight'?n:0;const dy=e.key==='ArrowUp'?-n:e.key==='ArrowDown'?n:0;moveObject(st.objects[st.selected],dx,dy);snapshot();paint();return}if(e.key==='Enter'&&st.polylineDraft){e.preventDefault();finishPolyline();return}if(e.key==='Enter'&&st.polygonDraft){e.preventDefault();finishPolygon();return}if(e.key==='Escape'){if(!popup.hidden){e.preventDefault();closeMenu();return}st.crop=null;st.draft=null;st.polygonDraft=null;st.polylineDraft=null;st.selected=-1;st.wand=null;st.marquee=null;updateContextOptions();paint();return}const tool={v:'select',w:'wand',f:'bucket',k:'picker',z:'zoom',u:'curve',n:'pencil',p:'pen',h:'pan',a:'arrow',l:'line',r:'rect',o:'ellipse',t:'text',b:'redact',c:'crop',e:'erase',s:'shape'}[e.key.toLowerCase()];if(tool){e.preventDefault();setTool(tool)}}
// Contextual tool options. These are visible only when relevant.
['startHead','endHead'].forEach(id=>$('#'+id).addEventListener('change',e=>{if(st.headSettings[st.tool])st.headSettings[st.tool][id==='startHead'?'start':'end']=e.target.value;const o=st.objects[st.selected];if(o&&['line','arrow','curve'].includes(o.type)){o[id]=e.target.value;snapshot();paint()}}));
$('#lineStyle').addEventListener('change',e=>{st.lineStrokeStyle=e.target.value;const o=st.objects[st.selected];if(o&&['line','arrow','curve'].includes(o.type)){o.strokeStyle=e.target.value;snapshot();paint()}});
$('#borderStyle').addEventListener('change',e=>{st.shapeStrokeStyle=e.target.value;const o=st.objects[st.selected];if(o&&['rect','ellipse','shape','polygon'].includes(o.type)){o.strokeStyle=e.target.value;snapshot();paint()}});

$('#fillTolerance').addEventListener('input',e=>{st.fillTolerance=Number(e.target.value);$('#fillToleranceValue').textContent=st.fillTolerance+'%'});
 $('#fillMode').addEventListener('change',e=>{st.fillMode=e.target.value});
 $('#wandTolerance').addEventListener('input',e=>{st.wandTolerance=Number(e.target.value);$('#wandToleranceValue').textContent=st.wandTolerance+'%';if(st.wand?.source==='wand'){let {x,y}=st.wand;wandSelection(x,y)}});
$('#wandMode').addEventListener('change',e=>{st.wandMode=e.target.value;if(st.wand?.source==='wand'){let {x,y}=st.wand;wandSelection(x,y)}});
$('#deleteSelectionBtn').onclick=deleteSelection;$('#deselectBtn').onclick=deselect;
for(const [id,key] of [['brushMode','brushMode'],['brushSmoothing','brushSmoothing'],['eraserMode','eraserMode'],['lineMode','lineMode'],['redactMode','redactMode'],['fillType','fillType'],['gradientMode','gradientMode'],['gradientEndColor','gradientEndColor']]){
 $('#'+id).addEventListener('change',e=>{
  if(key==='lineMode'&&st.polylineDraft)finishPolyline();
  st[key]=key==='brushSmoothing'?Number(e.target.value):e.target.value;
  if(key==='redactMode'&&st.redactMode!=='solid')toast('Blur and Pixelate are visual effects only. Use Solid + Export PNG for privacy.');
  updateContextOptions();paint();
 });
}
$('#brushPressure').addEventListener('change',e=>st.brushPressure=e.target.checked);
$('#airbrushDensity').addEventListener('input',e=>{st.airbrushDensity=Number(e.target.value);$('#airbrushDensityValue').textContent=st.airbrushDensity+'%'});
$('#highlighterOpacity').addEventListener('input',e=>{
 st.highlighterOpacity=Number(e.target.value);
 $('#highlighterOpacityValue').textContent=st.highlighterOpacity+'%';
});
$('#redactStrength').addEventListener('input',e=>st.redactStrength=Number(e.target.value));
$('#finishPolylineBtn').onclick=finishPolyline;
$('#clonePickSource').onclick=()=>{st.clonePicking=true;setTool('clone');st.clonePicking=true;updateContextOptions();toast('Tap a point on the canvas to set your clone source.')};
for(const [id,step] of [['objectBackward',-1],['objectForward',1]])$('#'+id).onclick=()=>reorderSelectedObject(step);
function reorderSelectedObject(step){
 const index=st.selected,next=index+step;
 if(index<0||next<0||next>=st.objects.length)return;
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
$('#duplicateObject').onclick=()=>{const o=st.objects[st.selected];if(!o)return;let clone=copyObj(o);moveObject(clone,25,25);st.objects.push(clone);st.selected=st.objects.length-1;snapshot();paint()};
// UI bindings
$('#palette').innerHTML=colors.map(c=>`<button class="swatch ${c===st.color?'selected':''}" data-color="${c}" style="background:${c}" title="${c}" aria-label="Select ${c}"></button>`).join('');
$('#palette').addEventListener('click',e=>{let b=e.target.closest('.swatch');if(b)setColor(b.dataset.color)});
$$('.toolbutton').forEach(b=>b.addEventListener('click',()=>setTool(b.dataset.tool)));
$('#openBtn').onclick=$('#emptyOpen').onclick=()=>el.file.click();$('#newBtn').onclick=$('#emptyBlank').onclick=()=>createBlank();
async function openImageFiles(files){
 for(const file of files)if(file.type.startsWith('image/'))await readBlob(file,file.name);
}
el.file.addEventListener('change',e=>{const files=[...(e.target.files||[])];el.file.value='';if(files.length)openImageFiles(files)});
$('#pasteBtn').onclick=pasteButton;$('#saveBtn').onclick=saveProject;$('#copyBtn').onclick=copyImage;
$('#undoBtn').onclick=()=>restore(st.historyIdx-1);$('#redoBtn').onclick=()=>restore(st.historyIdx+1);
$('#topColor').addEventListener('input',e=>setColor(e.target.value));
for(const [id,property,output] of [['brushHardness','hardness','brushHardnessValue'],['brushOpacity','opacity','brushOpacityValue']])$('#'+id).addEventListener('input',e=>{
 const value=Number(e.target.value);st[property==='hardness'?'brushHardness':'brushOpacity']=value;$('#'+output).textContent=value+'%';
 const obj=st.objects[st.selected];if(obj?.type==='brush-stroke'){obj[property]=value;snapshot();paint()}
});
for(let id of ['topWidth','inspectorWidth','topWidthValue'])$('#'+id).addEventListener('input',e=>setWidth(e.target.value));
$('#fontSize').addEventListener('input',e=>{st.fontSize=Math.max(10,Math.min(200,Number(e.target.value)||28));if(el.text.style.display==='block')el.text.style.fontSize=Math.max(16,st.fontSize*st.zoom)+'px'});
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
 if(!st.base||st.tool!=='pan'||e.pointerType!=='touch')return;
 panTouches.set(e.pointerId,{x:e.clientX,y:e.clientY});
 if(panTouches.size>=2){
  st.dragging=false;st.panning=null;pinchState=touchMidpoint();
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
 if(panTouches.size===1){
  const point=[...panTouches.values()][0];
  st.dragging=true;
  st.panning={x:point.x,y:point.y,left:el.work.scrollLeft,top:el.work.scrollTop};
 }else if(!panTouches.size){st.panning=null;st.dragging=false}
 pinchState=null;
 if(wasPinching){e.preventDefault();e.stopImmediatePropagation();el.canvas.style.cursor='grab'}
}
el.canvas.addEventListener('pointerup',endPanTouch,true);
el.canvas.addEventListener('pointercancel',endPanTouch,true);
el.canvas.addEventListener('pointerdown',pointerDown);el.canvas.addEventListener('pointermove',pointerMove);el.canvas.addEventListener('pointerup',pointerUp);el.canvas.addEventListener('pointercancel',pointerUp);
el.canvas.addEventListener('pointerleave',()=>{if(st.tool==='select'&&!st.dragging)el.canvas.style.cursor='crosshair'});
el.canvas.addEventListener('dblclick',e=>{if(st.tool==='line'&&st.lineMode==='polyline'){e.preventDefault();finishPolyline();return}if(st.tool==='shape'&&st.shapeKind==='custom'){e.preventDefault();if(st.polygonDraft?.points.length>3)st.polygonDraft.points.pop();finishPolygon();return}if(!st.base||st.tool!=='select')return;const p=nearest(e),i=findObject(p.x,p.y);if(i>=0&&st.objects[i].type==='text'){st.fontSize=st.objects[i].fontSize;$('#fontSize').value=st.fontSize;setColor(st.objects[i].color);showText(p.x,p.y,i)}});
// Clicking outside commits text, but changing font or color keeps the editor open.
el.text.addEventListener('blur',e=>{
 const next=e.relatedTarget;
 if(next?.closest?.('#fontPack, #panelColors, #topColor'))return;
 setTimeout(()=>{
   const active=document.activeElement;
   if(active===el.text||active?.closest?.('#fontPack, #panelColors, #topColor'))return;
   finishText(true);
 },90);
});
document.addEventListener('paste',handlePaste);document.addEventListener('keydown',keyHandler);
let dragCounter=0;document.addEventListener('dragenter',e=>{if(e.dataTransfer?.types.includes('Files')){e.preventDefault();dragCounter++;$('#dropScreen').classList.add('show')}});document.addEventListener('dragover',e=>{if(e.dataTransfer?.types.includes('Files'))e.preventDefault()});document.addEventListener('dragleave',e=>{if(e.dataTransfer?.types.includes('Files')){dragCounter=Math.max(0,dragCounter-1);if(!dragCounter)$('#dropScreen').classList.remove('show')}});document.addEventListener('drop',e=>{e.preventDefault();dragCounter=0;$('#dropScreen').classList.remove('show');const files=[...(e.dataTransfer?.files||[])].filter(x=>x.type.startsWith('image/'));if(files.length)openImageFiles(files)});
window.addEventListener('resize',()=>{if(st.base&&st.zoom<=1.25)fitZoom()});
updateUI();setHistoryButtons();

// --- Native-feeling floating panels: free movement, user resizing, persist layout.
const panelIds=['panelTools','panelColors','panelLibrary','panelHistory'];
let highestZ=25;
function raisePanel(panel){panel.style.zIndex=String(++highestZ)}
function clampPanel(panel,left,top){const area=$('#workArea');const maxLeft=Math.max(0,area.clientWidth-65),maxTop=Math.max(0,area.clientHeight-30);return {left:Math.max(0,Math.min(maxLeft,left)),top:Math.max(0,Math.min(maxTop,top))}}
function rememberLayout(){try{let data={};panelIds.forEach(id=>{let p=$('#'+id);data[id]={left:p.style.left,top:p.style.top,width:p.style.width,height:p.style.height,hidden:p.classList.contains('hidden')}});localStorage.setItem('paint-layout-v1',JSON.stringify(data))}catch(e){}}
function applyPositions(){const area=$('#workArea');panelIds.forEach(id=>{let p=$('#'+id);if(p.classList.contains('hidden'))return;let rect=p.getBoundingClientRect(),a=area.getBoundingClientRect();let v=clampPanel(p,rect.left-a.left,rect.top-a.top);p.style.left=v.left+'px';p.style.top=v.top+'px';p.style.right='auto';p.style.bottom='auto'})}
function loadPanelPositions(){let layouts;try{layouts=JSON.parse(localStorage.getItem('paint-layout-v1')||'null')}catch(e){};if(layouts){panelIds.forEach(id=>{let p=$('#'+id),s=layouts[id];if(!s)return;['left','top','width','height'].forEach(key=>{if(s[key])p.style[key]=s[key]});if(s.hidden)p.classList.add('hidden');p.style.right='auto';p.style.bottom='auto'})}else{applyPositions()}requestAnimationFrame(()=>{if(layouts)applyPositions()})}
function resetLayout(){try{localStorage.removeItem('paint-layout-v1')}catch(e){};panelIds.forEach(id=>{let p=$('#'+id);p.removeAttribute('style');p.classList.remove('hidden')});requestAnimationFrame(()=>{applyPositions();rememberLayout();toast('Floating windows restored.')})}
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
$('#windowsBtn').onclick=resetLayout;$('#libraryToggleBtn').onclick=()=>togglePanel('panelLibrary');
const popup=document.createElement('div');popup.className='menupopup';popup.hidden=true;document.body.appendChild(popup);
const menus={
 File:[['New blank canvas','Ctrl+N','new'],['Open image…','Ctrl+O','open'],['Paste screenshot','Ctrl+V','paste'],['Save project','Ctrl+S','save'],['Save a copy…','','savecopy'],['My saved images','','panelLibrary'],['Export PNG','','png'],['Export JPG','','jpg']],
 Edit:[['Undo','Ctrl+Z','undo'],['Redo','Ctrl+Y','redo'],['Erase Selection','Del','delete'],['Invert Selection','Ctrl+Shift+I','invertselection'],['Copy Selection','Ctrl+C','copyselected'],['Paste Selection','Ctrl+V','pasteselection'],['Deselect','Esc','deselect'],['Select / move','V','select'],['Magic Wand','W','wand'],['Copy entire image','','copy']],
 View:[['Fit canvas','','fit'],['Zoom in','+','zin'],['Zoom out','−','zout'],['Zoom tool','Z','zoom'],['Pan tool','H','pan'],['Restore floating windows','','layout']],
 Image:[['Crop to selection','C','cropselection'],['Resize…','Ctrl+R','resizeimage'],['Canvas Size…','Ctrl+Shift+R','canvassize'],['Flip Horizontal','','flipH'],['Flip Vertical','','flipV'],['Rotate 90° Clockwise','','cw'],['Rotate 90° Counter-Clockwise','','ccw'],['Rotate 180°','','180'],['Flatten','','flatten']],
 Windows:[['Tools','','panelTools'],['Colors','','panelColors'],['My images','','panelLibrary'],['History','','panelHistory'],['Reset layout','','layout']]
};
function closeMenu(){popup.hidden=true;document.querySelectorAll('.menu').forEach(button=>button.setAttribute('aria-expanded','false'))}
function runMenuAction(a){closeMenu();switch(a){case 'new':createBlank();break;case 'open':el.file.click();break;case 'paste':pasteButton();break;case 'save':saveProject();break;case 'savecopy':saveProject(true);break;case 'png':$('#exportFormat').value='png';exportImage();break;case 'jpg':$('#exportFormat').value='jpeg';exportImage();break;case 'undo':restore(st.historyIdx-1);break;case 'redo':restore(st.historyIdx+1);break;case 'copy':copyImage();break;case 'select':setTool('select');break;case 'wand':setTool('wand');break;case 'bucket':setTool('bucket');break;case 'picker':setTool('picker');break;case 'delete':deleteSelection();break;case 'copyselected':copySelectedPixels();break;case 'invertselection':invertSelection();break;case 'pasteselection':pasteSelection();break;case 'deselect':deselect();break;case 'pan':setTool('pan');break;case 'zoom':setTool('zoom');break;case 'fit':fitZoom();break;case 'zin':zoomBy(1.2);break;case 'zout':zoomBy(1/1.2);break;case 'crop':setTool('crop');break;case 'cropselection':cropToSelection();break;case 'resizeimage':showSizeDialog('resize');break;case 'canvassize':showSizeDialog('canvas');break;case 'flipH':case 'flipV':case 'cw':case 'ccw':case '180':transformImage(a);break;case 'flatten':flattenImage();break;case 'layout':resetLayout();break;default:if(panelIds.includes(a))togglePanel(a)}}
function showMenu(name,anchor){
 if(!popup.hidden&&popup.dataset.name===name){closeMenu();return}
 closeMenu();
 popup.dataset.name=name;popup.replaceChildren();
 for(const [label,key,action] of menus[name]){
  const button=document.createElement('button');button.type='button';
  const title=document.createElement('span'),shortcut=document.createElement('span');
  title.textContent=label;shortcut.textContent=key;shortcut.className='menu-shortcut';
  button.append(title,shortcut);
  if((action==='delete'||action==='deselect'||action==='copyselected')&&!hasSelection())button.disabled=true;
  if(action==='invertselection'&&!(st.wand||st.marquee))button.disabled=true;
  button.onclick=()=>runMenuAction(action);popup.appendChild(button);
 }
 const rect=anchor.getBoundingClientRect(),menuWidth=Math.min(216,window.innerWidth-16);
 popup.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-menuWidth-8))+'px';
 popup.style.top=rect.bottom+'px';
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
$('#fontFamily').onchange=e=>{st.fontFamily=e.target.value;if(el.text.style.display==='block')el.text.style.fontFamily=st.fontFamily;const obj=st.objects[st.selected];if(obj?.type==='text'){obj.fontFamily=st.fontFamily;snapshot();paint()}};
$('#boldBtn').onclick=()=>{st.fontBold=!st.fontBold;if(el.text.style.display==='block')el.text.style.fontWeight=st.fontBold?'bold':'normal';$('#boldBtn').style.background=st.fontBold?'#d9eafb':'';let o=st.objects[st.selected];if(o?.type==='text'){o.bold=st.fontBold;snapshot();paint()}};
$('#fontSize').addEventListener('input',e=>{const o=st.objects[st.selected];if(o?.type==='text'){o.fontSize=st.fontSize;snapshot();paint()}});
$('#fillShape').onchange=e=>{st.fillModeShape=e.target.value;st.fillShapes=e.target.value!=='outline';const o=st.objects[st.selected];if(o&&['rect','ellipse','shape','polygon'].includes(o.type)){o.fillMode=e.target.value;o.fill=e.target.value!=='outline';snapshot();paint()}};
$('#shapeType').onchange=e=>{const kind=e.target.value,selected=st.objects[st.selected];st.shapeKind=kind;if(selected?.type==='shape'&&kind!=='custom'){selected.shapeKind=kind;snapshot();paint()}};
$('#imageSizeApply').onclick=applySizeDialog;$('#imageSizeCancel').onclick=()=>$('#imageSizeDialog').close();
$('#keepRatio').onchange=()=>{};$('#imageSizeWidth').oninput=()=>{if($('#imageSizeDialog').dataset.mode==='resize'&&$('#keepRatio').checked)$('#imageSizeHeight').value=Math.max(1,Math.round(Number($('#imageSizeWidth').value)*st.base.height/st.base.width))};$('#imageSizeHeight').oninput=()=>{if($('#imageSizeDialog').dataset.mode==='resize'&&$('#keepRatio').checked)$('#imageSizeWidth').value=Math.max(1,Math.round(Number($('#imageSizeHeight').value)*st.base.width/st.base.height))};
$$('.toolbutton').forEach(b=>b.addEventListener('click',()=>{$('#selectedToolText').textContent=names[b.dataset.tool];$('#toolDescription').textContent=hints[b.dataset.tool]}));

const shapeCatalog=[["Basic",[["rectangle","Rectangle"],["rounded","Rounded rectangle"],["oval","Ellipse"],["diamond","Diamond"],["trapezoid","Trapezoid"],["parallelogram","Parallelogram"],["triangle","Triangle"],["rightTriangle","Right triangle"]]],["Polygons & stars",[["pentagon","Pentagon"],["hexagon","Hexagon"],["heptagon","Heptagon"],["octagon","Octagon"],["star4","4-point star"],["star5","5-point star"],["star6","6-point star"],["custom","Custom polygon"]]],["Arrows",[["arrowBlock","Arrow"],["arrowNotched","Notched arrow"],["arrowPentagon","Pentagon arrow"],["chevron","Chevron"]]],["Callouts",[["calloutRect","Speech bubble"],["calloutRound","Rounded callout"],["calloutOval","Oval callout"],["cloud","Cloud callout"]]],["Symbols",[["bolt","Lightning"],["check","Check mark"],["cross","Cross"],["gear","Gear"],["heart","Heart"]]]];
function installShapeGallery(){
 const sheet=document.querySelector('#shapeGallery');
 const trigger=document.querySelector('#shapePickerTrigger');
 const sections=document.querySelector('#shapeGallerySections');
 const select=document.querySelector('#shapeType');
 const imageCache=new Map();
 let activeButton=null;
 function icon(kind){
  if(imageCache.has(kind))return imageCache.get(kind);
  const c=document.createElement('canvas');c.width=60;c.height=60;
  const g=c.getContext('2d');g.fillStyle='#c0ddfa';g.strokeStyle='#366eae';g.lineWidth=2.4;g.lineJoin='round';g.lineCap='round';
  drawShapePath(g,{type:'shape',shapeKind:kind,x1:7,y1:7,x2:53,y2:53});
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
 // The first Shapes click reveals the visual choices, rather than another dense toolbar.
 const toolButton=document.querySelector('.toolbutton[data-tool="shape"]');
 if(toolButton)toolButton.addEventListener('click',()=>{if(sheet.hidden)open()});
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
 const revision=st.revision,base=st.base,objects=copyObj(st.objects),preview=projectThumb(composite());
 const id=(!asCopy&&st.savedId)||('project-'+Date.now()+'-'+Math.random().toString(36).slice(2,8));
 try{
  const baseBlob=await toBlob(base);
  await dbPut({id,name,width:base.width,height:base.height,updatedAt:Date.now(),baseBlob,objects,thumbnail:preview});
  const tab=openTabs.find(entry=>entry.id===targetId);
  if(tab){
   const target=stateForTab(tab);
   target.name=name;target.savedId=id;
   // A project rename should persist when stepping through Undo/Redo.
   target.history.forEach(step=>{step.name=name});
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
  // Saved projects join the tabs without replacing or losing the current document.
  initiate(image,record.name,false);
  st.objects=copyObj(record.objects||[]);st.savedId=record.id;
  st.history=[];st.historyIdx=-1;snapshot();st.dirty=false;
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
window.PaintDebug={state:st,get tabs(){return openTabs},get activeTabId(){return activeTabId},activateTab,closeTab,createBlank,blank,save:saveProject,setTool,canvas:el.canvas,composite,openProject,deleteProject,renderLibrary,liftMarquee,insideMarquee,deleteSelection,deselect,wandSelection,zoomAt,pointerDown,pointerMove,pointerUp,fillBucket,sampleColor,transformImage,flattenImage,finishPolygon,showSizeDialog};
})();
