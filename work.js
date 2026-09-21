// State 2 uses a deterministic local scenario; progress follows actual scene updates.
let room3d=null, workActive=false, running=false, step=-1, timer=null, due=0, remaining=0, runConfig=null;
const stageNames=['安排空间','搭配家具','检查草案'];
const phaseFor=s=>s<4?0:s<6?1:2;
const durations=[4500,6500,6500,6500,6500,7500,6000];
const sceneReady=import('./scene.js').then(m=>{room3d=m.createRoom();$('#scene-loading')?.remove();return room3d}).catch(err=>{$('#scene-error').hidden=false;$('#scene-loading')?.remove();$('#start').disabled=true;$('#start').textContent='三维场景不可用';console.error(err);return null});
function configFromBrief(){const text=rows.map(r=>r.text).join('，');const any=/床|收纳|柜|办公|书桌/.test(text);return {bed:!any||(/床/.test(text)&&!/不要.{0,3}床/.test(text)),storage:!any||(/收纳|柜/.test(text)&&!/不要.{0,3}(收纳|柜)/.test(text)),desk:!any||(/办公|书桌/.test(text)&&!/不要.{0,3}(办公|书桌)/.test(text)),single:/单人床/.test(text),corner:/两面靠墙|两侧靠墙|床.{0,4}靠角落|更多活动|太挤|拥挤/.test(text),moreStorage:/更多收纳|增加收纳|高柜/.test(text)}}
function summary(){const el=$('#brief-summary-list');el.replaceChildren();rows.forEach(r=>{const p=document.createElement('p');p.textContent=groups.find(g=>g[0]===r.type)[1]+' · '+r.text;el.append(p)})}
function showWork(){ $('#products').hidden=true;$('#agent').hidden=false;$('#conversation').hidden=true;$('#work-panel').hidden=false;$('#work-controls').hidden=false;$('#chips').hidden=true;$('.agent-top>span').textContent='规划与执行 · 02';prompt.placeholder='随时补充，例如：换成单人床…';$('.composer-note').textContent='三维布局演示 · 家具与尺寸为示例';}
function startWork(){if(!rows.length||rows.some(r=>!r.text.trim())){toast('请填写或删除空白约束');return}if(!room3d){toast('三维房间正在准备，请稍后再试');return}clearTimeout(timer);$('#history-list').replaceChildren();$('#work-history').hidden=true;$('#work-history').open=false;$('.brief-summary').open=false;runConfig=configFromBrief();room3d.configure(runConfig);room3d.stage(0);step=0;running=true;workActive=true;remaining=0;$('#steering-message').hidden=true;summary();showWork();$('#work-panel').scrollTop=0;$('#scene-status').hidden=false;$('.header-actions>span').textContent='金额待核算';updateWork();schedule();}
function finding(){const c=runConfig;return [ '正在为休息、收纳与办公安排位置，先看布局，再看细节。',c.bed?(c.corner?'床头和一侧临墙，中央区域更完整；会保留另一侧上下床的空间。':'床头靠墙，朝向房间的一侧留作上下床的通道。'):'本轮没有床的需求，跳过休息区。',c.storage?'收纳沿墙集中布置，避免将柜体散放在房间中间。':'本轮没有收纳需求，跳过柜体布置。',c.desk?'书桌安排在窗边，利用自然光，并与休息区域分开。':'本轮没有办公需求，跳过书桌布置。','占位布局已确定，正在补上床垫、柜门和桌椅等示例细节。','布局草案已经可以查看。正在整理家具比例与设计说明。','正在核对这份示例草案中的家具位置；商品价格与真实开合条件暂未接入。','第一轮草案已就绪。可以回看设计原因，再决定下一步怎么调整。'][step]}
function feedbackTitle(){return ['正在安排空间',runConfig.bed?'休息区位置已确定':'已跳过休息区',runConfig.storage?'收纳位置已确定':'已跳过收纳区',runConfig.desk?'办公区位置已确定':'空间布局已确定','布局已确定，正在搭配家具','草案已可查看，正在整理细节','正在检查空间草案','第一轮空间草案已就绪'][step]}
function rememberNode(){
 if(step<1||step>6)return;
 const li=document.createElement('li');const title=document.createElement('b');title.textContent=feedbackTitle();const body=document.createElement('p');body.textContent=finding();li.append(title,body);$('#history-list').append(li);$('#work-history').hidden=false;$('#history-count').textContent=$('#history-list').children.length+' 条';
}
function updateWork(){
 const done=step>=7,phase=phaseFor(step),paused=!running&&!done;
 $('#work-title').textContent=paused?'已暂停，草案为你保留':feedbackTitle();
 $('#feedback-state').textContent=done?'本轮已完成':paused?'已暂停':step>=1&&step<=3?'阶段进展':'正在执行';
 $('#live-feedback').dataset.state=done?'complete':paused?'paused':'running';
 $('#finding-text').textContent=done?'可以旋转查看空间，也可以点击家具上的圆点，回看每个布局决定的原因。':finding();
 const next=['接下来：依次安排家具的位置。','接下来：安排收纳位置。','接下来：安排办公区。','接下来：为布局补充家具细节。','你可以先旋转房间，看看这个布局是否适合你。','正在整理比例和设计说明，已有草案会保留在画布中。','完成后会在这里更新结果。','觉得哪里不合适？可以在下方补充想法。'];
 $('#feedback-next').textContent=paused?'当前内容已保留，你可以继续查看，或在下方继续执行。':next[step];
 $('#completion-note').hidden=!done;
 $('#browse').hidden=!running||step<4||step>=7;
 const plan=$('#plan');plan.replaceChildren();stageNames.forEach((name,i)=>{
 const el=document.createElement('div');el.className='plan-step '+(done||i<phase?'done':i===phase?'current':'');
 if(!done&&i===phase)el.setAttribute('aria-current','step');
 el.setAttribute('aria-label',name+'：'+(done||i<phase?'已完成':i===phase?(paused?'已暂停':'进行中'):'待开始'));
 const dot=document.createElement('span');dot.className='step-dot';dot.textContent=done||i<phase?'✓':i+1;
 const label=document.createElement('b');label.textContent=name;el.append(dot,label);plan.append(el);
 });
 $('#pause').textContent=running?'Ⅱ 暂停':'▶ 继续执行';$('#pause').hidden=done;
 $('#scene-status-text').textContent=done?'草案已就绪':running?'正在'+stageNames[phase]:'已暂停 · 草案已保留';
 $('#scene-status').classList.toggle('paused',!running);$('.canvas-label>span').textContent=done?'空间草案':step<4?'布局草案':'家具草案';$('#next-step').disabled=done;
}
function schedule(){clearTimeout(timer);if(!running||step>=7)return;const ms=remaining||durations[step]*($('#slow-mode').checked?2.5:1);remaining=0;due=Date.now()+ms;timer=setTimeout(advance,ms)}
function advance(){clearTimeout(timer);if(step>=7)return;rememberNode();step++;room3d.stage(Math.min(step,4));remaining=0;if(step>=7){running=false;toast('空间草案已就绪，可以查看了');}updateWork();schedule()}
function pause(){if(!running)return;remaining=Math.max(100,due-Date.now());clearTimeout(timer);running=false;updateWork()}
$('#start').onclick=startWork;$('#pause').onclick=()=>{if(running)pause();else{running=true;updateWork();schedule()}};
$('#next-step').onclick=()=>{advance()};$('#slow-mode').onchange=()=>{remaining=0;schedule()};$('#replay').onclick=startWork;
function editBrief(){pause();$('#work-panel').hidden=true;$('#work-controls').hidden=true;$('#conversation').hidden=false;$('#brief').hidden=false;$('#welcome').hidden=true;$('#chips').hidden=false;$('.agent-top>span').textContent='需求设定 · 01';$('#handoff').hidden=true;$('#start').hidden=false;$('#start').innerHTML='按新需求重新设计 <span>→</span>';prompt.placeholder='补充或修改你的需求…';workActive=false;render();$('#conversation').scrollTop=0;}
$('#edit-brief').onclick=editBrief;$('#edit-work').onclick=editBrief;
const originalEnter=$('#enter').onclick;$('#enter').onclick=()=>{if(workActive)showWork();else originalEnter()};$('#return-work').onclick=()=>{if(workActive)showWork();else $('#enter').click()};$('#browse').onclick=()=>{$('#agent').hidden=true;$('#products').hidden=false;toast('可以继续浏览，画布上会保留执行进度')};
const originalSubmit=$('#input-form').onsubmit;$('#input-form').onsubmit=e=>{if(!workActive)return originalSubmit(e);e.preventDefault();const text=prompt.value.trim();if(!text)return;const supported=/单人床|双人床|更多收纳|增加收纳|高柜|书桌.{0,5}靠窗|两面靠墙|两侧靠墙/.test(text);const note=$('#steering-message');note.hidden=false;if(/暂停|停一下/.test(text)){pause();note.textContent='已暂停。当前草案已保留。'}else if(supported){pause();if(/单人床|双人床/.test(text))rows=rows.filter(r=>r.type==='lock'||!/床/.test(r.text));parse(text);render();summary();note.textContent='已记录：'+text+'。请检查更新后的需求，再重新设计。';const btn=document.createElement('button');btn.textContent='查看并确认需求';btn.onclick=editBrief;note.append(btn);}else{pause();note.textContent='已暂停并记录补充：'+text+'。本原型仅支持预设床、收纳与窗边办公区，暂不能自动执行这项调整。';add('prefer',text);render();summary();const btn=document.createElement('button');btn.textContent='查看需求';btn.onclick=editBrief;note.append(btn)}prompt.value='';sync();note.scrollIntoView({behavior:'smooth',block:'nearest'})};
$('#zoom-in').onclick=()=>room3d?.zoom(.9);$('#zoom-out').onclick=()=>room3d?.zoom(1.1);$('#reset-view').onclick=()=>{$('#view-3d').click()};$('#view-3d').onclick=()=>{room3d?.reset();$('#view-3d').classList.add('selected');$('#view-top').classList.remove('selected')};$('#view-top').onclick=()=>{room3d?.top();$('#view-top').classList.add('selected');$('#view-3d').classList.remove('selected')};$('#reasons-toggle').onclick=()=>{const v=$('#reasons-toggle').getAttribute('aria-pressed')!=='true';$('#reasons-toggle').setAttribute('aria-pressed',String(v));room3d?.toggleReasons(v)};
$('#help').onclick=()=>toast('可旋转的真实三维原型；布局、进度和设计原因使用预设规则，未接入真实 Agent 与 IKEA 商品库。');
