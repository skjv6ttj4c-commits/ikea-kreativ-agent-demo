// State 2 uses a deterministic local scenario; progress follows actual scene updates.
let room3d=null,sceneModule=null,workActive=false,running=false,step=-1,timer=null,due=0,remaining=0,runConfig=null,steeringEvents=[],steeringSerial=0,designVersions=[],compareRooms=null,compareSyncing=false,activeVersion=1;
const stageNames=['安排空间','搭配家具','检查草案'];
const phaseFor=s=>s<4?0:s<6?1:2;
const durations=[4500,6500,6500,6500,6500,7500,6000];
const sceneReady=import('./scene.js?v=15').then(m=>{sceneModule=m;room3d=m.createRoom();$('#scene-loading')?.remove();return room3d}).catch(err=>{$('#scene-error').hidden=false;$('#scene-loading')?.remove();$('#start').disabled=true;$('#start').textContent='三维场景不可用';console.error(err);return null});
function configFromBrief(){const text=rows.map(r=>r.text).join('，');const any=/床|收纳|柜|办公|书桌/.test(text);return {bed:!any||(/床/.test(text)&&!/不要.{0,3}床/.test(text)),storage:!any||(/收纳|柜/.test(text)&&!/不要.{0,3}(收纳|柜)/.test(text)),desk:!any||(/办公|书桌/.test(text)&&!/不要.{0,3}(办公|书桌)/.test(text)),single:/单人床/.test(text),corner:/两面靠墙|两侧靠墙|床.{0,4}靠角落|更多活动|太挤|拥挤/.test(text),moreStorage:/更多收纳|增加收纳|高柜/.test(text)}}
function summary(){const el=$('#brief-summary-list');el.replaceChildren();rows.forEach(r=>{const p=document.createElement('p');p.textContent=groups.find(g=>g[0]===r.type)[1]+' · '+r.text;el.append(p)})}
function syncWorkComposer(){const paused=workActive&&!running&&step<7;$('#pause-suggestions').hidden=!paused;prompt.placeholder=paused?'您暂停了当前方案，随时告诉我如何调整，直接说就好':'随时补充，例如：换成单人床…';$('.input-foot span').textContent=paused?'可以修改建议后再发送':'也可以只说一句话'}
function showWork(){ $('#products').hidden=true;$('#agent').hidden=false;$('#conversation').hidden=true;$('#work-panel').hidden=false;$('#work-controls').hidden=false;$('#chips').hidden=true;$('.agent-top>span').textContent='规划与执行 · 02';$('.composer-note').textContent='三维布局演示 · 家具与尺寸为示例';syncWorkComposer();}
function startWork(){if(!rows.length||rows.some(r=>!r.text.trim())){toast('请填写或删除空白约束');return}if(!room3d){toast('三维房间正在准备，请稍后再试');return}clearTimeout(timer);previousPhase=-1;steeringEvents=[];designVersions=[];activeVersion=1;$('#version-controls').hidden=true;$('#compare-layer').hidden=true;$('#plan').replaceChildren();$('.brief-summary').open=false;runConfig=configFromBrief();room3d.configure(runConfig);room3d.stage(0);step=0;running=true;workActive=true;remaining=0;$('#steering-message').hidden=true;summary();showWork();$('#work-panel').scrollTop=0;$('#scene-status').hidden=false;$('.header-actions>span').textContent='金额待核算';updateWork();schedule();}
let previousPhase=-1;
function updatePlan(){
 const done=step>=7,phase=done?3:phaseFor(step),changed=phase!==previousPhase;
 const past=[
 [step>=1?[runConfig.bed?'休息区位置已确定':'已跳过休息区',runConfig.bed?(runConfig.corner?'床头和一侧临墙，另一侧留作上下床通道。':'床头靠墙，面向房间留出通道。'):'本轮未要求放置床。']:null,step>=2?[runConfig.storage?'收纳位置已确定':'已跳过收纳区',runConfig.storage?'柜体沿墙集中布置。':'本轮未要求放置收纳柜。']:null,step>=3?[runConfig.desk?'办公区位置已确定':'已跳过办公区',runConfig.desk?'书桌放在窗边，与休息区分开。':'本轮未要求设置办公区。']:null],
 [step>=4?['已载入示例家具','占位已替换为床、柜体或桌椅的示例模型。']:null,step>=6?['设计说明已整理','可点击画布中的圆点回看布局原因。']:null],
 [done?['示例草案已整理完成','房间布局与设计说明已展示。']:null,done?['保留待核验事项','商品价格、实际尺寸与开合条件尚未核验。']:null]
 ];
 const actions=['正在安排休息、收纳与办公区域','正在安排收纳位置','正在安排窗边办公区','正在整理空间布局','正在补充家具细节','正在整理设计说明','正在整理草案与待核验事项'];
 if(!$('#plan').children.length)stageNames.forEach((name,i)=>{
 const d=document.createElement('details');d.className='task-node';const h=document.createElement('summary');h.innerHTML='<span class="node-icon"></span><b></b><span class="node-status"></span><span class="node-chevron">⌄</span>';h.querySelector('b').textContent=name;
 const body=document.createElement('div');body.className='node-body';const list=document.createElement('ol');list.className='node-log';const adjustments=document.createElement('div');adjustments.className='node-adjustments';const current=document.createElement('p');current.className='node-current';current.setAttribute('aria-live','polite');body.append(list,adjustments,current);d.append(h,body);$('#plan').append(d);
 });
 [...$('#plan').children].forEach((d,i)=>{
 const complete=i<phase,active=i===phase,adjusting=steeringEvents.some(e=>e.phase===i&&e.state==='active');
 d.dataset.state=complete?'done':active?'current':'pending';
 d.querySelector('.node-icon').textContent=complete?'✓':i+1;
 d.querySelector('.node-status').textContent=complete?'已完成':active?(running?(adjusting?'正在调整':'进行中'):'已暂停'):'待开始';
 if(changed)d.open=active;
 const list=d.querySelector('.node-log');const entries=past[i].filter(Boolean);
 // Keep existing history nodes stable while users read them.
 if(list.children.length!==entries.length){list.replaceChildren();entries.forEach(([title,text])=>{const li=document.createElement('li');const b=document.createElement('b');b.textContent=title;const p=document.createElement('p');p.textContent=text;li.append(b,p);list.append(li)})}
 const adjustments=d.querySelector('.node-adjustments');adjustments.replaceChildren();const latestSteering=[...steeringEvents].reverse().find(e=>e.state!=='undone');steeringEvents.filter(e=>e.phase===i&&e.state!=='undone').forEach(e=>{
 const box=document.createElement('section');box.className='steer-event '+e.state;const head=document.createElement('div');head.className='steer-head';head.innerHTML='<span class="steer-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 7h5m4 0h7M9 4v6m6 4h5M4 14h7m4-3v6M4 20h11m4 0h1m-5-3v6"/></svg></span><b>方向调整</b><span></span>';head.lastElementChild.textContent=e.state==='active'?'已接收':'已更新';const quote=document.createElement('p');quote.className='steer-quote';quote.textContent='“'+e.text+'”';const intro=document.createElement('p');intro.className='steer-intro';intro.textContent='Agent 已更新本轮目标';const ul=document.createElement('ul');e.bullets.forEach(t=>{const li=document.createElement('li');li.textContent=t;ul.append(li)});box.append(head,quote,intro,ul);if(e.id===latestSteering?.id){const undo=document.createElement('button');undo.className='steer-undo';undo.textContent='撤销本次调整';undo.onclick=()=>undoSteering(e.id);box.append(undo)}adjustments.append(box)
 });
 const current=d.querySelector('.node-current');current.hidden=complete;current.classList.toggle('is-running',active&&running);
 current.replaceChildren();
 if(active&&running){
 const loader=document.createElement('span');loader.className='kreativ-builder';loader.setAttribute('aria-hidden','true');loader.innerHTML='<svg viewBox="0 0 32 32"><path class="builder-home" d="M4.5 13 16 4.5 27.5 13v14.5h-23V23"/><path class="builder-wall" d="M4.5 17v2.5M4.5 21.5V24"/><g class="builder-pencil"><path d="m9 22 2.2-5.2 9.7-7.2 3.2 4.3-9.7 7.2L9 22Z"/><path d="m20.9 9.6 3.2 4.3"/></g><rect class="builder-block" x="4.5" y="25" width="5" height="2.5" rx=".8"/></svg>';
 const label=document.createElement('span');const activeAdjustment=steeringEvents.find(e=>e.phase===i&&e.state==='active');label.textContent=activeAdjustment?.action||actions[step];current.append(loader,label);
 }else current.textContent=active?'已暂停 · '+actions[step].replace('正在','待继续'):'此阶段尚未开始。';
 });
 previousPhase=phase;
}
function updateWork(){
 const done=step>=7,phase=phaseFor(step),adjusting=steeringEvents.some(e=>e.phase===phase&&e.state==='active');
 updatePlan();$('#live-feedback').hidden=!done;$('#browse').hidden=!running||step<4||done;
 $('#pause').textContent=running?'Ⅱ 暂停':'▶ 继续执行';$('#pause').hidden=done;
 $('#scene-status-text').textContent=done?'草案已就绪':running?(adjusting?'正在按新方向调整':'正在'+stageNames[phase]):'已暂停 · 草案已保留';
 $('#scene-status').classList.toggle('paused',!running);$('.canvas-label>span').textContent=done?'空间草案':step<4?'布局草案':'家具草案';syncWorkComposer();
}
function schedule(){clearTimeout(timer);if(!running||step>=7)return;const ms=remaining||durations[step];remaining=0;due=Date.now()+ms;timer=setTimeout(advance,ms)}
function advance(){clearTimeout(timer);if(step>=7)return;step++;room3d.stage(step);remaining=0;const phase=step>=7?3:phaseFor(step);steeringEvents.forEach(e=>{if(e.state==='active'&&e.phase<phase)e.state='done'});if(step>=7){running=false;saveCompletedVersion();toast('空间草案已就绪，可以查看了');}updateWork();schedule()}
function pause(){if(!running)return;remaining=Math.max(100,due-Date.now());clearTimeout(timer);running=false;updateWork()}
$('#start').onclick=startWork;$('#pause').onclick=()=>{if(running)pause();else{running=true;updateWork();schedule()}};

function editBrief(){pause();$('#work-panel').hidden=true;$('#work-controls').hidden=true;$('#conversation').hidden=false;$('#brief').hidden=false;$('#welcome').hidden=true;$('#chips').hidden=false;$('#pause-suggestions').hidden=true;$('.agent-top>span').textContent='需求设定 · 01';$('#handoff').hidden=true;$('#start').hidden=false;$('#start').innerHTML='按新需求重新设计 <span>→</span>';prompt.placeholder='补充或修改你的需求…';workActive=false;render();$('#conversation').scrollTop=0;}
$('#edit-brief').onclick=editBrief;$('#edit-work').onclick=editBrief;
const originalEnter=$('#enter').onclick;$('#enter').onclick=()=>{if(workActive)showWork();else originalEnter()};let progressCueTimer=null,progressFocusTimer=null;
$('#return-work').onclick=()=>{
 if(!workActive){$('#enter').click();return}
 showWork();
 let target;
 if(step>=7){target=$('#live-feedback')}
 else{const node=$('#plan').children[phaseFor(step)];node.open=true;target=node.querySelector('.node-current')}
 clearTimeout(progressCueTimer);clearTimeout(progressFocusTimer);
 document.querySelectorAll('.progress-cue').forEach(el=>el.classList.remove('progress-cue'));
 const panel=$('#work-panel'),reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
 requestAnimationFrame(()=>{
 const offset=target.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop;
 panel.scrollTo({top:Math.max(0,offset-panel.clientHeight*.35),behavior:reduced?'instant':'smooth'});
 progressFocusTimer=setTimeout(()=>{
 if(!workActive||$('#agent').hidden)return;
 // Progress may advance during scrolling: cue the newest action, never an obsolete one.
 let latest=step>=7?$('#live-feedback'):$('#plan').children[phaseFor(step)].querySelector('.node-current');
 if(latest!==target){if(step<7)$('#plan').children[phaseFor(step)].open=true;const y=latest.getBoundingClientRect().top-panel.getBoundingClientRect().top+panel.scrollTop;panel.scrollTo({top:Math.max(0,y-panel.clientHeight*.35),behavior:'instant'})}
 latest.classList.remove('progress-cue');void latest.offsetWidth;latest.classList.add('progress-cue');
 progressCueTimer=setTimeout(()=>latest.classList.remove('progress-cue'),reduced?1250:3250);
 },reduced?0:350);
 });
};$('#browse').onclick=()=>{$('#agent').hidden=true;$('#products').hidden=false;toast('可以继续浏览，画布上会保留执行进度')};
document.querySelectorAll('[data-steer]').forEach(b=>b.onclick=()=>{const t=b.dataset.steer;if(!prompt.value.includes(t))prompt.value+=(prompt.value.trim()?'，':'')+t;sync();prompt.focus()});
function steeringPlan(text,currentPhase){
 if(/预算/.test(text))return {impact:1,action:currentPhase<1?'正在保留布局，并更新后续选品范围':'正在重新筛选预算范围内的家具',bullets:[text.match(/预算[^，。]*/)?.[0]||'更新家具预算','空间布局保持不变','重新筛选预算范围内的家具']};
 if(/单人床|双人床/.test(text))return {impact:0,action:'正在重新计算床与主要动线',bullets:[/单人床/.test(text)?'双人床改为单人床':'更新床的尺寸需求','收纳和办公区需求保持不变','重新计算床与主要动线']};
 if(/动线/.test(text))return {impact:0,action:'正在重新检查家具间距与通行空间',bullets:['主要动线不放置家具','现有功能区需求保持不变','重新检查家具间距与通行空间']};
 if(/办公|书桌/.test(text))return {impact:0,action:'正在重新安排办公区与周边空间',bullets:['更新办公区要求','床与收纳需求保持不变','重新检查窗边区域和通行空间']};
 return {impact:0,action:'正在按新方向更新空间布局',bullets:['已记录新的空间要求','未提及的需求保持不变','重新检查受影响的家具位置']};
}
function applySteering(text){
 const snapshot={rows:rows.map(r=>({...r})),config:{...runConfig},step,running};const oldPhase=phaseFor(step),plan=steeringPlan(text,oldPhase);clearTimeout(timer);
 steeringEvents.forEach(e=>{if(e.state==='active')e.state='done'});
 if(/单人床|双人床/.test(text))rows=rows.filter(r=>r.type==='lock'||!/床/.test(r.text));
 if(/预算/.test(text))rows=rows.filter(r=>!/预算/.test(r.text));
 if(/不要.{0,4}(办公区|书桌)/.test(text))rows=rows.filter(r=>!/办公|书桌/.test(r.text));
 parse(text);render();summary();runConfig=configFromBrief();room3d.configure(runConfig);
 if(plan.impact<oldPhase)step=plan.impact===0?3:4;
 room3d.stage(step);const event={id:++steeringSerial,phase:phaseFor(step),text,action:plan.action,bullets:plan.bullets,state:'active',snapshot};steeringEvents.push(event);
 running=true;remaining=0;previousPhase=-1;activeVersion=1;if(designVersions.length)$('#version-controls').hidden=true;$('#compare-layer').hidden=true;$('#steering-message').hidden=true;prompt.value='';sync();updateWork();schedule();
 requestAnimationFrame(()=>{const box=document.querySelector('.steer-event.active');box?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'center'})});toast('已按新方向继续设计');
}
function undoSteering(id){
 const event=steeringEvents.find(e=>e.id===id);if(!event||event.state==='undone')return;clearTimeout(timer);rows=event.snapshot.rows.map(r=>({...r}));runConfig={...event.snapshot.config};step=event.snapshot.step;running=event.snapshot.running&&step<7;remaining=0;event.state='undone';room3d.configure(runConfig);room3d.stage(step);render();summary();previousPhase=-1;updateWork();if(running)schedule();toast('已撤销本次方向调整');
}
function completedVersionName(){const text=steeringEvents.map(e=>e.text).join('，');if(/单人床/.test(text)&&/预算/.test(text))return '单人床 · 低预算';if(/单人床/.test(text))return '单人床调整';if(/预算/.test(text))return '低预算调整';if(/动线/.test(text))return '动线优化';return '调整版'}
function saveCompletedVersion(){
 const version={config:{...runConfig},rows:rows.map(r=>({...r})),label:designVersions.length?'调整版':'初版'};if(!designVersions.length)designVersions=[version];else{version.label=completedVersionName();designVersions=[designVersions[0],version];activeVersion=1}
 const ready=designVersions.length===2;$('#version-controls').hidden=!ready;if(ready){$('#version-label').textContent='方案 2 / 2';$('#compare-version-name').textContent=designVersions[1].label}
}
function ensureCompareRooms(){
 if(compareRooms)return;const a=sceneModule.createRoom({host:$('#compare-view-a'),layer:$('#compare-notes-a'),notes:false,reasonsToggle:false}),b=sceneModule.createRoom({host:$('#compare-view-b'),layer:$('#compare-notes-b'),notes:false,reasonsToggle:false});compareRooms={a,b};a.onViewChange(v=>{if(compareSyncing)return;compareSyncing=true;b.setView(v);compareSyncing=false});b.onViewChange(v=>{if(compareSyncing)return;compareSyncing=true;a.setView(v);compareSyncing=false})
}
function openCompare(){if(designVersions.length<2)return;$('#compare-layer').hidden=false;requestAnimationFrame(()=>{ensureCompareRooms();compareRooms.a.configure(designVersions[0].config);compareRooms.a.stage(7);compareRooms.b.configure(designVersions[1].config);compareRooms.b.stage(7);const view=room3d.getView();compareRooms.a.setView(view);compareRooms.b.setView(view);$('#compare-version-name').textContent=designVersions[1].label})}
function closeCompare(){if(compareRooms&&!$('#compare-layer').hidden)room3d.setView(compareRooms.b.getView());$('#compare-layer').hidden=true}
$('#compare-versions').onclick=openCompare;$('#close-compare').onclick=closeCompare;$('#use-version-one').onclick=()=>{if(!designVersions[0])return;const v=designVersions[0];rows=v.rows.map(r=>({...r}));runConfig={...v.config};step=7;running=false;activeVersion=0;room3d.configure(runConfig);room3d.stage(7);render();summary();previousPhase=-1;updateWork();$('.canvas-label>span').textContent='方案 1 · 仅查看';$('#version-label').textContent='方案 1 / 2';closeCompare();toast('已回到方案 1，可继续提出调整')};
const originalSubmit=$('#input-form').onsubmit;$('#input-form').onsubmit=e=>{if(!workActive)return originalSubmit(e);e.preventDefault();const text=prompt.value.trim();if(!text)return;const supported=/单人床|双人床|更多收纳|增加收纳|高柜|书桌|办公区|两面靠墙|两侧靠墙|预算|动线.{0,6}(不要|不放).{0,4}家具/.test(text);const note=$('#steering-message');if(/暂停|停一下/.test(text)){pause();note.hidden=false;note.textContent='已暂停。当前草案已保留。';prompt.value='';sync()}else if(supported)applySteering(text);else{pause();note.hidden=false;note.textContent='这项调整可能影响多个条件，请先检查需求。';add('prefer',text);render();summary();const btn=document.createElement('button');btn.textContent='查看并确认需求';btn.onclick=editBrief;note.append(btn);prompt.value='';sync();note.scrollIntoView({behavior:'smooth',block:'nearest'})}};
$('#zoom-in').onclick=()=>room3d?.zoom(.9);$('#zoom-out').onclick=()=>room3d?.zoom(1.1);$('#reset-view').onclick=()=>{$('#view-3d').click()};$('#view-3d').onclick=()=>{room3d?.reset();$('#view-3d').classList.add('selected');$('#view-top').classList.remove('selected')};$('#view-top').onclick=()=>{room3d?.top();$('#view-top').classList.add('selected');$('#view-3d').classList.remove('selected')};$('#reasons-toggle').onclick=()=>{const v=$('#reasons-toggle').getAttribute('aria-pressed')!=='true';$('#reasons-toggle').setAttribute('aria-pressed',String(v));room3d?.toggleReasons(v)};
$('#help').onclick=()=>toast('可旋转的真实三维原型；布局、进度和设计原因使用预设规则，未接入真实 Agent 与 IKEA 商品库。');
