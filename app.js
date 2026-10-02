'use strict';
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = s => s ? new Date(s).toLocaleString('en-IE',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC' : 'Not recorded';
const tag = (text,cls) => '<span class="tag '+cls+'">'+esc(text)+'</span>';
let data, model, evaluation, page=0, selected=null, patternIds=null;
const analyses=new Map(),reviews=new Map();
const PAGE_SIZE=10;
const active = t => !['Resolved','Closed'].includes(t.status);
const index = (rows,key) => Object.fromEntries(rows.map(x=>[x[key],x]));
let agents,users,teams,systems,articles;
function filtered(){
 const q=$('search').value.trim().toLowerCase(),status=$('status').value;
 let rows=data.tickets.filter(t=>
  (!patternIds||patternIds.has(t.ticket_id))&&
  (!q||[t.ticket_id,t.title,t.description,systems[t.system_id].name,agents[t.assigned_agent_id].name].join(' ').toLowerCase().includes(q))&&
  (!status||(status==='active'?active(t):t.status===status))&&
  (!$('category').value||t.category===$('category').value)&&
  (!$('priority').value||t.priority===$('priority').value)&&
  (!$('sla').value||t.sla_status===$('sla').value));
 const sort=$('sort').value;
 rows.sort((a,b)=>sort==='priority'?a.priority.localeCompare(b.priority)||b.created_at.localeCompare(a.created_at):sort==='sla'?b.sla_consumption_percent-a.sla_consumption_percent:b.created_at.localeCompare(a.created_at));
 return rows;
}
function draw(){
 const rows=filtered();page=Math.min(page,Math.max(0,Math.ceil(rows.length/PAGE_SIZE)-1));
 const slice=rows.slice(page*PAGE_SIZE,(page+1)*PAGE_SIZE);
 $('rows').innerHTML=slice.map(t=>'<tr class="'+(selected===t.ticket_id?'selected':'')+'"><td><div class="ticket">'+esc(t.ticket_id)+'</div><div>'+esc(t.title.split(' · ')[0])+'</div><small class="muted">'+esc(systems[t.system_id].name)+' · '+esc(t.category)+'</small></td><td>'+tag(t.priority,['P1','P2'].includes(t.priority)?'high':t.priority==='P3'?'medium':'low')+'</td><td>'+esc(t.status)+'</td><td>'+tag(t.sla_status,t.sla_status.toLowerCase().replaceAll(' ',''))+'<div>'+t.sla_consumption_percent+'% consumed</div><div class="bar"><i style="width:'+Math.min(100,t.sla_consumption_percent)+'%;background:'+(t.sla_breached?'var(--red)':t.sla_status==='At Risk'?'var(--amber)':'var(--teal)')+'"></i></div></td><td>'+esc(agents[t.assigned_agent_id].name)+'</td><td><button class="action" data-ticket="'+esc(t.ticket_id)+'" aria-label="View '+esc(t.ticket_id)+'">View</button></td></tr>').join('')||'<tr><td colspan="6">No incidents match these filters.</td></tr>';
 $('results').textContent=rows.length?(page*PAGE_SIZE+1)+'–'+Math.min(rows.length,(page+1)*PAGE_SIZE)+' of '+rows.length+' incidents'+(patternIds?' · Repeated symptom group':''):'0 incidents';
 $('prev').disabled=page===0;$('next').disabled=(page+1)*PAGE_SIZE>=rows.length;
 $('rows').querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>showTicket(b.dataset.ticket));
}
function kv(label,value){return '<div><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>';}
function list(title,items,ordered=false){return '<h3>'+esc(title)+'</h3><'+(ordered?'ol':'ul')+'>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</'+(ordered?'ol':'ul')+'>';}
function showTicket(id){
 selected=id;const t=data.tickets.find(x=>x.ticket_id===id);const a=t.kb_article_id?articles[t.kb_article_id]:null;
 const history=data.ticket_events.filter(e=>e.ticket_id===id).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 $('detail').innerHTML='<h2>'+esc(t.ticket_id)+'</h2><h3>'+esc(t.title.split(' · ')[0])+'</h3><p>'+esc(t.description)+'</p><div class="kv">'+
 kv('System',systems[t.system_id].name)+kv('Reporter',users[t.reporter_id].name)+kv('Department',users[t.reporter_id].department)+kv('Location',users[t.reporter_id].location)+kv('Owner',agents[t.assigned_agent_id].name)+kv('Support team',teams[t.assigned_team_id].name)+kv('Impact / urgency',t.impact+' / '+t.urgency)+kv('Affected users',t.affected_users)+kv('Priority',t.priority)+kv('Status',t.status)+kv('Created',date(t.created_at))+kv('Resolution deadline',date(t.sla_deadline))+kv('Response SLA',t.response_sla_breached?'Breached':'Met')+kv('Resolution SLA',t.sla_status+' · '+t.sla_consumption_percent+'%')+'</div>'+
 '<h3>Recorded outcome</h3>'+(t.resolved_at?'<p><b>Root cause:</b> '+esc(t.root_cause)+'</p><p><b>Resolution:</b> '+esc(t.resolution)+'</p><p>Resolved '+esc(date(t.resolved_at))+'</p>':'<p>Investigation is ongoing. No confirmed root cause or resolution has been recorded.</p>')+
 (a?'<button class="button" id="open-ticket-kb">'+esc(a.article_id)+' · Read recorded SOP</button>':'')+
 '<div class="analysis-block"><h3>Experimental analysis</h3><p>Category prediction, matched procedures and historical evidence. This does not change the ticket.</p><button class="button" id="analyze-ticket">Analyze incident</button><div id="ticket-analysis" aria-live="polite"></div></div>'+
 '<h3>Event history</h3><ol class="history">'+history.map(e=>'<li><time>'+esc(date(e.timestamp))+'</time><b>'+esc(e.event_type.replaceAll('_',' '))+'</b> · '+esc(agents[e.actor]?.name||users[e.actor]?.name||e.actor)+(e.new_value?'<div>'+esc(e.old_value?e.old_value+' → ':'')+esc(agents[e.new_value]?.name||e.new_value)+'</div>':'')+(e.notes?'<p>'+esc(e.notes)+'</p>':'')+'</li>').join('')+'</ol>';
 if(a)$('open-ticket-kb').onclick=()=>{location.hash='knowledge';route();showArticle(a.article_id);};
 $('analyze-ticket').onclick=()=>{analyses.set(id,OpsEngine.analyze(t,data,model));renderAnalysis('ticket-analysis',analyses.get(id),id,t);};
 if(analyses.has(id))renderAnalysis('ticket-analysis',analyses.get(id),id,t);
 draw();$('detail').focus({preventScroll:true});if(innerWidth<1100)$('detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function drawKnowledge(){
 const q=$('kb-search').value.trim().toLowerCase(),cat=$('kb-category').value;
 const rows=data.knowledge_articles.filter(a=>(!cat||a.category===cat)&&(!q||[a.article_id,a.title,...a.symptoms,...a.keywords].join(' ').toLowerCase().includes(q)));
 $('kb-count').textContent=rows.length+' of 26 articles';
 $('kb-list').innerHTML=rows.map(a=>'<button class="kb-item" data-article="'+esc(a.article_id)+'"><small>'+esc(a.article_id)+' · '+esc(a.category)+'</small><strong>'+esc(a.title)+'</strong><p>'+esc(a.symptoms[0])+'</p></button>').join('')||'<p>No articles match this search.</p>';
 $('kb-list').querySelectorAll('[data-article]').forEach(b=>b.onclick=()=>showArticle(b.dataset.article));
}
function showArticle(id){
 const a=articles[id];if(!a)return;
 $('kb-detail').innerHTML='<h2>'+esc(a.article_id)+'</h2><h3>'+esc(a.title)+'</h3><p class="muted">'+esc(a.category)+' · '+esc(a.status)+' · v'+esc(a.version)+'</p><p><b>Systems:</b> '+a.system_ids.map(i=>esc(systems[i].name)).join(', ')+'</p>'+list('Symptoms',a.symptoms)+list('Possible causes',a.possible_causes)+list('Diagnostic steps',a.diagnostic_steps,true)+list('Resolution steps',a.resolution_steps,true)+list('Escalate when',a.escalation_conditions)+list('Evidence required',a.evidence_required)+'<h3>Related articles</h3>'+a.related_articles.map(i=>'<p><button class="action" data-related="'+esc(i)+'">'+esc(i)+' · '+esc(articles[i]?.title)+'</button></p>').join('')+'<p class="footer">Fictional procedure · Updated '+esc(date(a.updated_at))+'</p>';
 $('kb-detail').querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>showArticle(b.dataset.related));
 $('kb-detail').focus({preventScroll:true});if(innerWidth<1100)$('kb-detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function count(rows,key){return rows.reduce((m,x)=>(m[x[key]]=(m[x[key]]||0)+1,m),{});}
function chart(id,values){const max=Math.max(...Object.values(values));$(id).innerHTML=Object.entries(values).map(([k,n])=>'<div class="chart-row"><span>'+esc(k)+'</span><div class="bar" aria-hidden="true"><i style="width:'+n/max*100+'%"></i></div><b>'+n+'</b></div>').join('');}
function insights(){
 chart('category-chart',count(data.tickets,'category'));chart('sla-chart',count(data.tickets,'sla_status'));
 const groups=new Map();
 for(const t of data.tickets){
  let symptom=t.description.split('. Reference')[0].toLowerCase().replace(/^please investigate: |^i am unable to complete my task because |^observed /,'').replace(/ during routine processing$/,'').replace(/\.$/,'');
  const name=systems[t.system_id].name.toLowerCase();if(symptom.endsWith(' in '+name))symptom=symptom.slice(0,-(' in '+name).length);
  const key=t.system_id+'|'+symptom;if(!groups.has(key))groups.set(key,{symptom,system:t.system_id,rows:[]});groups.get(key).rows.push(t);
 }
 const ranked=[...groups.values()].filter(g=>g.rows.length>=3).sort((a,b)=>b.rows.length-a.rows.length).slice(0,8);
 $('patterns').innerHTML=ranked.map((g,i)=>'<div class="pattern"><b>'+esc(g.symptom)+'</b><p>'+esc(systems[g.system].name)+' · '+g.rows.length+' incidents · '+g.rows.filter(active).length+' active</p><button class="button" data-group="'+i+'">View incidents</button></div>').join('');
 $('patterns').querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{reset();patternIds=new Set(ranked[Number(b.dataset.group)].rows.map(t=>t.ticket_id));location.hash='tickets';route();draw();});
}
function reset(){patternIds=null;['search','status','category','priority','sla'].forEach(id=>$(id).value='');$('sort').value='created';page=0;draw();}
function route(){
 if(!data)return;const view=location.hash.slice(1)||'dashboard';const queue=['dashboard','tickets'].includes(view);
 $('queue-view').hidden=!queue;$('stats').hidden=view!=='dashboard';
 ['insights','knowledge','triage','about'].forEach(v=>$(v+'-view').hidden=v!==view);
 if(!['dashboard','tickets','insights','knowledge','triage','about'].includes(view)){location.hash='dashboard';return;}
 $('page-title').textContent={dashboard:'Support overview',tickets:'Incident queue',insights:'Recurring issues',knowledge:'Knowledge base',triage:'Triage lab',about:'About this demo'}[view];
 document.querySelectorAll('.nav a,.mobile-nav a').forEach(a=>{const on=a.hash==='#'+view;a.classList.toggle('active',on);if(on)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current');});
}
async function init(){
 try{
  const responses=await Promise.all(['workspace','model','evaluation-summary'].map(name=>fetch('data/'+name+'.json')));
  if(responses.some(r=>!r.ok))throw Error('Dataset unavailable');[data,model,evaluation]=await Promise.all(responses.map(r=>r.json()));
  if(data.tickets.length!==200||data.knowledge_articles.length!==26)throw Error('Dataset is incomplete');
  agents=index(data.agents,'agent_id');users=index(data.users,'user_id');teams=index(data.teams,'team_id');systems=index(data.systems,'system_id');articles=index(data.knowledge_articles,'article_id');
  const live=data.tickets.filter(active),resolved=data.tickets.filter(t=>t.resolved_at);
  const hours=resolved.map(t=>(new Date(t.resolved_at)-new Date(t.created_at))/3600000).sort((a,b)=>a-b);
  const median=(hours[Math.floor((hours.length-1)/2)]+hours[Math.floor(hours.length/2)])/2;
  const risk=live.filter(t=>t.sla_status==='At Risk').length,breach=live.filter(t=>t.sla_breached).length;
  const stats=[['Total incidents',data.tickets.length,'All six support categories'],['Active incidents',live.length,live.filter(t=>t.status==='Pending').length+' pending evidence'],['Active SLA risk',risk+' / '+breach,'At risk / breached'],['Median resolution',median.toFixed(1)+'h',resolved.length+' resolved incidents']];
  $('stats').innerHTML=stats.map(([label,value,caption])=>'<div class="stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><em>'+esc(caption)+'</em></div>').join('');
  const categories=[...new Set(data.tickets.map(t=>t.category))].sort();for(const id of ['category','kb-category'])for(const c of categories){const o=document.createElement('option');o.value=c;o.textContent=c;$(id).appendChild(o);}
  ['search','status','category','priority','sla','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;draw();}));
  $('prev').onclick=()=>{page--;draw();};$('next').onclick=()=>{page++;draw();};$('reset').onclick=reset;
  $('kb-search').oninput=drawKnowledge;$('kb-category').onchange=drawKnowledge;
  for(const s of data.systems){const o=document.createElement('option');o.value=s.system_id;o.textContent=s.name;$('triage-system').appendChild(o);}
  $('triage-form').onsubmit=e=>{e.preventDefault();const description=$('triage-description').value.trim();if(description.length<15)return;const q={description,system_id:$('triage-system').value||null,impact:$('triage-impact').value,urgency:$('triage-urgency').value,created_at:data.snapshot_at};reviews.delete('new-report');renderAnalysis('triage-result',OpsEngine.analyze(q,data,model),'new-report',q);$('triage-result').focus({preventScroll:true});if(innerWidth<1100)$('triage-result').scrollIntoView({block:'start'});};
  renderModelResults();
  draw();drawKnowledge();insights();route();$('loading').hidden=true;$('workspace').hidden=false;
 }catch(e){$('loading').hidden=true;$('error').hidden=false;$('error').textContent='The support dataset could not be loaded. Reload the page to try again.';}
}
function setupTheme(){
 const root=document.documentElement,top=document.querySelector('.top'),title=$('page-title'),pill=top.querySelector('.pill');
 const eyebrow=document.createElement('span');eyebrow.className='eyebrow';eyebrow.textContent='Operations intelligence workspace';title.before(eyebrow);
 const actions=document.createElement('div');actions.className='header-actions';
 const toggle=document.createElement('button');toggle.className='theme-toggle';toggle.type='button';toggle.id='theme-toggle';
 const apply=theme=>{root.dataset.theme=theme;toggle.textContent=theme==='dark'?'☀':'◐';toggle.setAttribute('aria-label','Switch to '+(theme==='dark'?'light':'dark')+' mode');try{localStorage.setItem('opsresolve-theme',theme);}catch(_){}};
 let saved='';try{saved=localStorage.getItem('opsresolve-theme')||'';}catch(_){}apply(saved||'light');
 toggle.onclick=()=>apply(root.dataset.theme==='dark'?'light':'dark');
 pill.before(actions);actions.append(toggle,pill);
}
setupTheme();window.addEventListener('hashchange',route);init();

function renderAnalysis(target,a,key,q){
 const accepted=a.action==='recommend',status=reviews.get(key)||a.review_status;
 const recommendation=a.recommended_kb?articles[a.recommended_kb]:null;
 const training=q.ticket_id?model.training_ids.includes(q.ticket_id):false;
 $(target).innerHTML='<div class="callout '+(a.critical_review?'critical':accepted?'':'warning')+'"><b>'+esc(a.critical_review?'Critical impact: escalate for human review':accepted?'Suggested triage':a.action==='out_of_scope'?'Outside current support scope':'More evidence needed')+'</b><p>'+esc(a.reason||'Validate the procedure against the actual error before applying any change.')+'</p></div>'+
 '<div class="kv">'+kv('Category',a.predicted_category||'Unconfirmed')+kv('Suggested priority',a.suggested_priority||'Confirm impact / urgency')+kv('Priority basis','Impact × urgency rule')+kv('Human review',status)+'</div>'+
 '<p class="footer">'+(q.ticket_id?(training?'This incident was in the training sample.':'Held-out September case.'):'New report analyzed against the historical demo.')+' Analysis is a retrospective demonstration using the current model.</p>'+
 (a.likely_cause?'<h3>Historical hypothesis</h3><p>'+esc(a.likely_cause.text)+'</p><p class="footer">Supported by '+a.likely_cause.ticket_ids.map(esc).join(', ')+'. This is not a confirmed cause for the current report.</p>':a.possible_causes.length?list('Possible causes from matched SOP',a.possible_causes):'<p>No root-cause hypothesis is supported by the current evidence.</p>')+
 list(accepted?'Recommended diagnostic checks':'Evidence to gather',a.recommended_steps,true)+
 (a.escalation_conditions.length?list('Escalate when',a.escalation_conditions):'')+
 '<h3>Procedure evidence</h3>'+a.sop_candidates.map(s=>'<div class="evidence"><button class="action" data-analysis-kb="'+esc(s.article_id)+'">'+esc(s.article_id)+' · '+esc(articles[s.article_id].title)+'</button><p class="footer">Text similarity '+s.score.toFixed(2)+(recommendation?.article_id===s.article_id?' · Suggested procedure':' · Candidate only')+'</p></div>').join('')+
 '<h3>Similar resolved incidents</h3>'+(a.similar_tickets.length?a.similar_tickets.map(h=>'<div class="evidence"><button class="action" data-analysis-ticket="'+esc(h.ticket_id)+'">'+esc(h.ticket_id)+'</button><p>'+esc(h.root_cause)+'</p><p class="footer">Resolved '+esc(date(h.resolved_at))+' · Similarity '+h.score.toFixed(2)+'</p></div>').join(''):'<p>No sufficiently similar training incident was resolved before this report.</p>')+
 '<p class="footer">Classifier score '+a.category_score.toFixed(2)+'. Scores measure model preference or text similarity. They are not calibrated confidence.</p>'+
 '<div class="review-actions">'+(accepted?'<button class="button" data-review="Reviewed: accepted">Accept suggestion</button>':'')+'<button class="button" data-review="Reviewed: more evidence requested">Request evidence</button><button class="button" data-review="Reviewed: rejected">Reject suggestion</button></div><p role="status" id="'+target+'-review">'+esc(status)+'</p><p class="footer">Review decisions last for this page session. Ticket priority, ownership and resolution remain unchanged.</p>';
 $(target).querySelectorAll('[data-analysis-kb]').forEach(b=>b.onclick=()=>{location.hash='knowledge';route();showArticle(b.dataset.analysisKb);});
 $(target).querySelectorAll('[data-analysis-ticket]').forEach(b=>b.onclick=()=>{location.hash='tickets';route();showTicket(b.dataset.analysisTicket);});
 $(target).querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{reviews.set(key,b.dataset.review);renderAnalysis(target,a,key,q);});
}
function renderModelResults(){
 const pct=n=>(n*100).toFixed(1)+'%';
 $('model-results').innerHTML='<h3>Model evaluation</h3><p>Trained category classifier: '+model.trained_on+' July/August incidents. Held-out evaluation: '+evaluation.test_cases+' September incidents.</p><div class="kv">'+kv('Raw category accuracy',pct(evaluation.raw_category_accuracy))+kv('Category macro-F1',evaluation.raw_category_macro_f1.toFixed(3))+kv('SOP top-1 match',pct(evaluation.sop_top1_accuracy))+kv('Requested evidence',evaluation.abstained_cases+' / '+evaluation.test_cases)+'</div><p>'+evaluation.challenge_cases+' independently worded challenge cases: '+Math.round(evaluation.challenge_action_agreement*evaluation.challenge_cases)+' matched the expected recommend / request-evidence / out-of-scope action. These are development diagnostics, not a final benchmark.</p><div class="table-wrap"><table class="model-table"><thead><tr><th>Category</th><th>Test cases</th><th>Recall</th><th>F1</th></tr></thead><tbody>'+evaluation.per_class.map(c=>'<tr><td>'+esc(c.category)+'</td><td>'+c.sample_count+'</td><td>'+pct(c.recall)+'</td><td>'+c.f1.toFixed(3)+'</td></tr>').join('')+'</tbody></table></div><p class="scope">The sample wording is templated, and the classifier struggles with some paraphrases. SOP retrieval scores reflect an easy synthetic test. Rule-based priority agreement is not learned-model accuracy. No production accuracy or calibrated confidence is established.</p><p class="footer">'+esc(model.method)+' · '+esc(model.version)+'. Model weights and thresholds were not tuned to held-out labels. Review guards changed after the initial challenge run.</p>';
}
