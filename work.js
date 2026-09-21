// State 2 uses a deterministic local scenario; progress follows actual scene updates.
let room3d=null, workActive=false, running=false, step=-1, timer=null, due=0, remaining=0, runConfig=null;
const stageNames=['安排空间','搭配家具','检查草案'];
const phaseFor=s=>s<4?0:s<6?1:2;
const durations=[4500,6500,6500,6500,6500,7500,6000];
const sceneReady=import('./scene.js?v=7').then(m=>{room3d=m.createRoom();$('#scene-loading')?.remove();return room3d}).catch(err=>{$('#scene-error').hidden=false;$('#scene-loading')?.remove();$('#start').disabled=true;$('#start').textContent='三维场景不可用';console.error(err);return null});
function configFromBrief(){const text=rows.map(r=>r.text).join('，');const any=/床|收纳|柜|办公|书桌/.test(text);return {bed:!any||(/床/.test(text)&&!/不要.{0,3}床/.test(text)),storage:!any||(/收纳|柜/.test(text)&&!/不要.{0,3}(收纳|柜)/.test(text)),desk:!any||(/办公|书桌/.test(text)&&!/不要.{0,3}(办公|书桌)/.test(text)),single:/单人床/.test(text),corner:/两面靠墙|两侧靠墙|床.{0,4}靠角落|更多活动|太挤|拥挤/.test(text),moreStorage:/更多收纳|增加收纳|高柜/.test(text)}}
function summary(){const el=$('#brief-summary-list');el.replaceChildren();rows.forEach(r=>{const p=document.createElement('p');p.textContent=groups.find(g=>g[0]===r.type)[1]+' · '+r.text;el.append(p)})}
function showWork(){ $('#products').hidden=true;$('#agent').hidden=false;$('#conversation').hidden=true;$('#work-panel').hidden=false;$('#work-controls').hidden=false;$('#chips').hidden=true;$('.agent-top>span').textContent='规划与执行 · 02';prompt.placeholder='随时补充，例如：换成单人床…';$('.composer-note').textContent='三维布局演示 · 家具与尺寸为示例';}
function startWork(){if(!rows.length||rows.some(r=>!r.text.trim())){toast('请填写或删除空白约束');return}if(!room3d){toast('三维房间正在准备，请稍后再试');return}clearTimeout(timer);previousPhase=-1;$('#plan').replaceChildren();$('.brief-summary').open=false;runConfig=configFromBrief();room3d.configure(runConfig);room3d.stage(0);step=0;running=true;workActive=true;remaining=0;$('#steering-message').hidden=true;summary();showWork();$('#work-panel').scrollTop=0;$('#scene-status').hidden=false;$('.header-actions>span').textContent='金额待核算';updateWork();schedule();}
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
 const body=document.createElement('div');body.className='node-body';const list=document.createElement('ol');list.className='node-log';const current=document.createElement('p');current.className='node-current';current.setAttribute('aria-live','polite');body.append(list,current);d.append(h,body);$('#plan').append(d);
 });
 [...$('#plan').children].forEach((d,i)=>{
 const complete=i<phase,active=i===phase;
 d.dataset.state=complete?'done':active?'current':'pending';
 d.querySelector('.node-icon').textContent=complete?'✓':i+1;
 d.querySelector('.node-status').textContent=complete?'已完成':active?(running?'进行中':'已暂停'):'待开始';
 if(changed)d.open=active;
 const list=d.querySelector('.node-log');const entries=past[i].filter(Boolean);
 // Keep existing history nodes stable while users read them.
 if(list.children.length!==entries.length){list.replaceChildren();entries.forEach(([title,text])=>{const li=document.createElement('li');const b=document.createElement('b');b.textContent=title;const p=document.createElement('p');p.textContent=text;li.append(b,p);list.append(li)})}
 const current=d.querySelector('.node-current');current.hidden=complete;
 current.textContent=active?(running?actions[step]:'已暂停 · '+actions[step].replace('正在','待继续')):'此阶段尚未开始。';
 });
 previousPhase=phase;
}
function updateWork(){
 const done=step>=7,phase=phaseFor(step);
 updatePlan();$('#live-feedback').hidden=!done;$('#browse').hidden=!running||step<4||done;
 $('#pause').textContent=running?'Ⅱ 暂停':'▶ 继续执行';$('#pause').hidden=done;
 $('#scene-status-text').textContent=done?'草案已就绪':running?'正在'+stageNames[phase]:'已暂停 · 草案已保留';
 $('#scene-status').classList.toggle('paused',!running);$('.canvas-label>span').textContent=done?'空间草案':step<4?'布局草案':'家具草案';
}
function schedule(){clearTimeout(timer);if(!running||step>=7)return;const ms=remaining||durations[step];remaining=0;due=Date.now()+ms;timer=setTimeout(advance,ms)}
function advance(){clearTimeout(timer);if(step>=7)return;step++;room3d.stage(step);remaining=0;if(step>=7){running=false;toast('空间草案已就绪，可以查看了');}updateWork();schedule()}
function pause(){if(!running)return;remaining=Math.max(100,due-Date.now());clearTimeout(timer);running=false;updateWork()}
$('#start').onclick=startWork;$('#pause').onclick=()=>{if(running)pause();else{running=true;updateWork();schedule()}};

function editBrief(){pause();$('#work-panel').hidden=true;$('#work-controls').hidden=true;$('#conversation').hidden=false;$('#brief').hidden=false;$('#welcome').hidden=true;$('#chips').hidden=false;$('.agent-top>span').textContent='需求设定 · 01';$('#handoff').hidden=true;$('#start').hidden=false;$('#start').innerHTML='按新需求重新设计 <span>→</span>';prompt.placeholder='补充或修改你的需求…';workActive=false;render();$('#conversation').scrollTop=0;}
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
 progressCueTimer=setTimeout(()=>latest.classList.remove('progress-cue'),1250);
 },reduced?0:350);
 });
};$('#browse').onclick=()=>{$('#agent').hidden=true;$('#products').hidden=false;toast('可以继续浏览，画布上会保留执行进度')};
const originalSubmit=$('#input-form').onsubmit;$('#input-form').onsubmit=e=>{if(!workActive)return originalSubmit(e);e.preventDefault();const text=prompt.value.trim();if(!text)return;const supported=/单人床|双人床|更多收纳|增加收纳|高柜|书桌.{0,5}靠窗|两面靠墙|两侧靠墙/.test(text);const note=$('#steering-message');note.hidden=false;if(/暂停|停一下/.test(text)){pause();note.textContent='已暂停。当前草案已保留。'}else if(supported){pause();if(/单人床|双人床/.test(text))rows=rows.filter(r=>r.type==='lock'||!/床/.test(r.text));parse(text);render();summary();note.textContent='已记录：'+text+'。请检查更新后的需求，再重新设计。';const btn=document.createElement('button');btn.textContent='查看并确认需求';btn.onclick=editBrief;note.append(btn);}else{pause();note.textContent='已暂停并记录补充：'+text+'。本原型仅支持预设床、收纳与窗边办公区，暂不能自动执行这项调整。';add('prefer',text);render();summary();const btn=document.createElement('button');btn.textContent='查看需求';btn.onclick=editBrief;note.append(btn)}prompt.value='';sync();note.scrollIntoView({behavior:'smooth',block:'nearest'})};
$('#zoom-in').onclick=()=>room3d?.zoom(.9);$('#zoom-out').onclick=()=>room3d?.zoom(1.1);$('#reset-view').onclick=()=>{$('#view-3d').click()};$('#view-3d').onclick=()=>{room3d?.reset();$('#view-3d').classList.add('selected');$('#view-top').classList.remove('selected')};$('#view-top').onclick=()=>{room3d?.top();$('#view-top').classList.add('selected');$('#view-3d').classList.remove('selected')};$('#reasons-toggle').onclick=()=>{const v=$('#reasons-toggle').getAttribute('aria-pressed')!=='true';$('#reasons-toggle').setAttribute('aria-pressed',String(v));room3d?.toggleReasons(v)};
$('#help').onclick=()=>toast('可旋转的真实三维原型；布局、进度和设计原因使用预设规则，未接入真实 Agent 与 IKEA 商品库。');
