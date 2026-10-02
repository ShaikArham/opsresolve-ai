'use strict';
const $ = id => document.getElementById(id);
const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const date = s => s ? new Date(s).toLocaleString('en-IE',{timeZone:'UTC',dateStyle:'medium',timeStyle:'short'})+' UTC' : 'Not recorded';
const tag = (text,cls) => '<span class="tag '+cls+'">'+esc(text)+'</span>';
let data, model, evaluation, page=0, selected=null, patternIds=null, queueMode='', patternGroups=[], scopeLabel='';
const analyses=new Map(),reviews=new Map();
const PAGE_SIZE=10;
const active = t => !['Resolved','Closed'].includes(t.status);
const index = (rows,key) => Object.fromEntries(rows.map(x=>[x[key],x]));
let agents,users,teams,systems,articles;
function filtered(){
 const q=$('search').value.trim().toLowerCase(),status=$('status').value;
 let rows=data.tickets.filter(t=>
  (!patternIds||patternIds.has(t.ticket_id))&&
  (!queueMode||(queueMode==='critical'?active(t)&&['P1','P2'].includes(t.priority):queueMode==='risk'?active(t)&&['At Risk','Breached'].includes(t.sla_status):true))&&
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
 $('results').textContent=rows.length?(page*PAGE_SIZE+1)+'–'+Math.min(rows.length,(page+1)*PAGE_SIZE)+' of '+rows.length+' incidents'+(patternIds?' · '+scopeLabel:''):'0 incidents';
 const summary=$('queue-summary');if(summary){const labels={active:'Active queue',critical:'P1 / P2 priority',risk:'At-risk or breached SLA'};summary.innerHTML='<span><b>'+rows.length+'</b> incidents shown'+(queueMode?' · '+esc(labels[queueMode]):'')+'</span>'+(queueMode||$('search').value||$('status').value||$('category').value||$('priority').value||$('sla').value?'<button class="action" id="clear-queue-view">Clear view</button>':'');const clear=$('clear-queue-view');if(clear)clear.onclick=reset;}
 $('prev').disabled=page===0;$('next').disabled=(page+1)*PAGE_SIZE>=rows.length;
 $('rows').querySelectorAll('[data-ticket]').forEach(b=>b.onclick=()=>showTicket(b.dataset.ticket));
}
function kv(label,value){return '<div><small>'+esc(label)+'</small><b>'+esc(value)+'</b></div>';}
function list(title,items,ordered=false){return '<h3>'+esc(title)+'</h3><'+(ordered?'ol':'ul')+'>'+items.map(x=>'<li>'+esc(x)+'</li>').join('')+'</'+(ordered?'ol':'ul')+'>';}
function showTicket(id){
 selected=id;const t=data.tickets.find(x=>x.ticket_id===id);const a=t.kb_article_id?articles[t.kb_article_id]:null;
 const history=data.ticket_events.filter(e=>e.ticket_id===id).sort((a,b)=>a.timestamp.localeCompare(b.timestamp));
 $('detail').innerHTML='<div class="detail-top"><div><span class="section-kicker">Incident command centre</span><h2>'+esc(t.ticket_id)+'</h2></div><div class="detail-badges">'+tag(t.priority,['P1','P2'].includes(t.priority)?'high':t.priority==='P3'?'medium':'low')+tag(t.sla_status,t.sla_status.toLowerCase().replaceAll(' ',''))+'</div></div><h3>'+esc(t.title.split(' · ')[0])+'</h3><p>'+esc(t.description)+'</p><div class="kv">'+
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
 $('kb-list').innerHTML=rows.map(a=>{const linked=data.tickets.filter(t=>t.kb_article_id===a.article_id),open=linked.filter(active).length;return '<button class="kb-item" data-article="'+esc(a.article_id)+'"><small>'+esc(a.article_id)+' · '+esc(a.category)+'</small><strong>'+esc(a.title)+'</strong><p>'+esc(a.symptoms[0])+'</p><span class="kb-evidence">'+linked.length+' linked incidents · '+open+' active</span></button>';}).join('')||'<p>No articles match this search.</p>';
 $('kb-list').querySelectorAll('[data-article]').forEach(b=>b.onclick=()=>showArticle(b.dataset.article));
}
function showArticle(id){
 const a=articles[id];if(!a)return;
 const linked=data.tickets.filter(t=>t.kb_article_id===a.article_id),open=linked.filter(active).length,breached=linked.filter(t=>t.sla_breached).length;
 $('kb-detail').innerHTML='<span class="section-kicker">Knowledge procedure</span><h2>'+esc(a.article_id)+'</h2><h3>'+esc(a.title)+'</h3><p class="muted">'+esc(a.category)+' · '+esc(a.status)+' · v'+esc(a.version)+'</p><div class="kb-insight"><div><b>'+linked.length+'</b><span>linked incidents</span></div><div><b>'+open+'</b><span>active now</span></div><div><b>'+breached+'</b><span>SLA breaches</span></div></div><button class="button" id="open-article-incidents">View linked incidents</button><p><b>Systems:</b> '+a.system_ids.map(i=>esc(systems[i].name)).join(', ')+'</p>'+list('Symptoms',a.symptoms)+list('Possible causes',a.possible_causes)+list('Diagnostic steps',a.diagnostic_steps,true)+list('Resolution steps',a.resolution_steps,true)+list('Escalate when',a.escalation_conditions)+list('Evidence required',a.evidence_required)+'<h3>Related articles</h3>'+a.related_articles.map(i=>'<p><button class="action" data-related="'+esc(i)+'">'+esc(i)+' · '+esc(articles[i]?.title)+'</button></p>').join('')+'<p class="footer">Fictional procedure · Updated '+esc(date(a.updated_at))+'</p>';
 $('kb-detail').querySelectorAll('[data-related]').forEach(b=>b.onclick=()=>showArticle(b.dataset.related));
 $('open-article-incidents').onclick=()=>{patternIds=new Set(linked.map(t=>t.ticket_id));scopeLabel='Linked to '+a.article_id;location.hash='tickets';route();draw();};
 $('kb-detail').focus({preventScroll:true});if(innerWidth<1100)$('kb-detail').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function count(rows,key){return rows.reduce((m,x)=>(m[x[key]]=(m[x[key]]||0)+1,m),{});}
function chart(id,values){const max=Math.max(...Object.values(values));$(id).innerHTML=Object.entries(values).map(([k,n])=>'<div class="chart-row"><span>'+esc(k)+'</span><div class="bar" aria-hidden="true"><i style="width:'+n/max*100+'%"></i></div><b>'+n+'</b></div>').join('');}
function renderOverview(){
 const live=data.tickets.filter(active), resolved=data.tickets.filter(t=>t.resolved_at);
 const onTrack=live.filter(t=>t.sla_status==='On Track').length, risk=live.filter(t=>t.sla_status==='At Risk').length, breached=live.filter(t=>t.sla_breached).length;
 const critical=live.filter(t=>['P1','P2'].includes(t.priority)).length;
 const resolvedWithin=resolved.filter(t=>!t.sla_breached).length;
 const byCategory=count(live,'category'), maxCategory=Math.max(...Object.values(byCategory));
 const attention=[...live].sort((a,b)=>b.sla_consumption_percent-a.sla_consumption_percent).slice(0,3);
 const pct=(n,d)=>d?Math.round(n/d*100):0;
 $('overview-insights').innerHTML='<div class="overview-grid">'+
 '<section class="card pulse-card"><div class="section-kicker">Operations pulse</div><h2>Today’s support position</h2><p class="sub">A quick read of the current fictional support queue.</p><div class="pulse-metrics">'+
 '<div><span class="pulse-value '+(risk+breached?'attention':'')+'">'+(risk+breached)+'</span><small>Active SLA exposure</small><em>'+pct(risk+breached,live.length)+'% of active queue</em></div>'+
 '<div><span class="pulse-value">'+critical+'</span><small>P1 / P2 incidents</small><em>Needs senior attention</em></div>'+
 '<div><span class="pulse-value positive">'+pct(onTrack,live.length)+'%</span><small>Active work on track</small><em>'+onTrack+' of '+live.length+' incidents</em></div></div></section>'+
 '<section class="card health-card"><div class="section-kicker">SLA health</div><h2>Resolution performance</h2><p class="sub">Snapshot-based status for active work and recorded outcomes.</p><div class="health-row"><span>On track</span><div class="health-track"><i style="width:'+pct(onTrack,live.length)+'%"></i></div><b>'+onTrack+'</b></div>'+
 '<div class="health-row warn"><span>At risk</span><div class="health-track"><i style="width:'+pct(risk,live.length)+'%"></i></div><b>'+risk+'</b></div>'+
 '<div class="health-row breach"><span>Breached</span><div class="health-track"><i style="width:'+pct(breached,live.length)+'%"></i></div><b>'+breached+'</b></div>'+
 '<div class="health-footer"><b>'+pct(resolvedWithin,resolved.length)+'%</b><span>of resolved incidents met the recorded resolution SLA</span></div></section>'+
 '<section class="card mix-card"><div class="section-kicker">Live workload</div><h2>Active incidents by category</h2><div class="mini-bars">'+Object.entries(byCategory).sort((a,b)=>b[1]-a[1]).map(([category,n])=>'<div><span>'+esc(category)+'</span><div><i style="width:'+n/maxCategory*100+'%"></i></div><b>'+n+'</b></div>').join('')+'</div></section>'+
 '<section class="card attention-card"><div class="section-kicker">Needs attention</div><h2>Highest SLA consumption</h2><div class="attention-list">'+attention.map(t=>'<button class="attention-item" data-overview-ticket="'+esc(t.ticket_id)+'"><span>'+tag(t.priority,['P1','P2'].includes(t.priority)?'high':'medium')+'</span><span><b>'+esc(t.ticket_id)+'</b><small>'+esc(t.title.split(' · ')[0])+'</small></span><strong>'+esc(t.sla_consumption_percent)+'%</strong></button>').join('')+'</div></section></div>';
 $('overview-insights').querySelectorAll('[data-overview-ticket]').forEach(b=>b.onclick=()=>showTicket(b.dataset.overviewTicket));
}
function insights(){
 chart('category-chart',count(data.tickets,'category'));chart('sla-chart',count(data.tickets,'sla_status'));
 const groups=new Map();
 for(const t of data.tickets){
  let symptom=t.description.split('. Reference')[0].toLowerCase().replace(/^please investigate: |^i am unable to complete my task because |^observed /,'').replace(/ during routine processing$/,'').replace(/\.$/,'');
  const name=systems[t.system_id].name.toLowerCase();if(symptom.endsWith(' in '+name))symptom=symptom.slice(0,-(' in '+name).length);
  const key=t.system_id+'|'+symptom;if(!groups.has(key))groups.set(key,{symptom,system:t.system_id,rows:[]});groups.get(key).rows.push(t);
 }
 const ranked=[...groups.values()].filter(g=>g.rows.length>=3).sort((a,b)=>b.rows.length-a.rows.length).slice(0,8);patternGroups=ranked;
 $('patterns').innerHTML=ranked.map((g,i)=>'<div class="pattern"><b>'+esc(g.symptom)+'</b><p>'+esc(systems[g.system].name)+' · '+g.rows.length+' incidents · '+g.rows.filter(active).length+' active</p><div class="pattern-actions"><button class="button" data-investigate="'+i+'">Investigate</button><button class="action" data-group="'+i+'">View incidents</button></div></div>').join('');
 $('patterns').querySelectorAll('[data-group]').forEach(b=>b.onclick=()=>{reset();patternIds=new Set(ranked[Number(b.dataset.group)].rows.map(t=>t.ticket_id));scopeLabel='Repeated symptom group';location.hash='tickets';route();draw();});
 $('patterns').querySelectorAll('[data-investigate]').forEach(b=>b.onclick=()=>renderPatternInvestigation(ranked[Number(b.dataset.investigate)]));
 renderAnalytics();
}
function renderPatternInvestigation(group){
 let host=$('pattern-workbench');if(!host){host=document.createElement('section');host.id='pattern-workbench';host.className='pattern-workbench';$('patterns').closest('.card').after(host);}
 const rows=group.rows,activeRows=rows.filter(active),affected=rows.reduce((n,t)=>n+t.affected_users,0),breached=rows.filter(t=>t.sla_breached).length;
 const articleId=rows.map(t=>t.kb_article_id).find(Boolean),article=articleId?articles[articleId]:null;
 const highest=[...rows].sort((a,b)=>b.sla_consumption_percent-a.sla_consumption_percent)[0];
 host.innerHTML='<div class="card investigation-card"><div class="investigation-head"><div><span class="section-kicker">Investigation brief</span><h2>'+esc(group.symptom)+'</h2><p>'+esc(systems[group.system].name)+' · Pattern-based review signal, not a confirmed shared root cause.</p></div><button class="action" id="close-investigation">Close</button></div><div class="investigation-metrics"><div><b>'+rows.length+'</b><span>linked incidents</span></div><div><b>'+activeRows.length+'</b><span>active now</span></div><div><b>'+affected+'</b><span>reported users affected</span></div><div><b>'+breached+'</b><span>recorded SLA breaches</span></div></div><div class="investigation-body"><div><h3>Where to start</h3><p>Review the highest-exposure incident, then compare timestamps, exact symptoms and recent changes before treating these reports as one root cause.</p><button class="button" id="open-pattern-ticket">Open '+esc(highest.ticket_id)+'</button></div><div><h3>Relevant procedure</h3>'+(article?'<p><button class="action" id="open-pattern-kb">'+esc(article.article_id)+' · '+esc(article.title)+'</button></p><p class="muted">Use the published diagnostic steps to structure the review.</p>':'<p class="muted">No linked procedure is recorded for this pattern.</p>')+'</div></div></div>';
 $('close-investigation').onclick=()=>host.remove();$('open-pattern-ticket').onclick=()=>{location.hash='tickets';route();showTicket(highest.ticket_id);};if(article)$('open-pattern-kb').onclick=()=>{location.hash='knowledge';route();showArticle(article.article_id);};
 host.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});
}
function renderAnalytics(){
 let extra=$('analytics-extra');
 if(!extra){extra=document.createElement('section');extra.id='analytics-extra';extra.className='analytics-extra';$('insights-view').appendChild(extra);}
 const months=new Map();for(const t of data.tickets){const key=t.created_at.slice(0,7);months.set(key,(months.get(key)||0)+1);}
 const monthly=[...months.entries()].sort((a,b)=>a[0].localeCompare(b[0]));const maxMonth=Math.max(...monthly.map(x=>x[1]));
 const teamRows=data.teams.map(team=>{const rows=data.tickets.filter(t=>t.assigned_team_id===team.team_id),activeRows=rows.filter(active),resolvedRows=rows.filter(t=>t.resolved_at);const met=resolvedRows.filter(t=>!t.sla_breached).length;return {team,rows,activeRows,resolvedRows,met};}).sort((a,b)=>b.activeRows.length-a.activeRows.length);
 extra.innerHTML='<div class="analytics-heading"><div><span class="section-kicker">Operational analytics</span><h2>Volume, workload and ownership</h2><p>Derived from the fixed 200-incident demonstration dataset.</p></div></div><div class="analytics-grid">'+
 '<section class="card trend-card"><h2>Incident volume over time</h2><p class="sub">New incidents by creation month.</p><div class="trend-bars">'+monthly.map(([month,n])=>'<div><div class="trend-bar-wrap"><i style="height:'+Math.max(12,n/maxMonth*100)+'%"></i></div><b>'+n+'</b><span>'+new Date(month+'-01T00:00:00Z').toLocaleDateString('en-IE',{month:'short'})+'</span></div>').join('')+'</div></section>'+
 '<section class="card team-card"><h2>Support-team workload</h2><p class="sub">Open work is separated from the full historical queue.</p><div class="team-list">'+teamRows.map(x=>'<div><span class="team-dot"></span><span><b>'+esc(x.team.name)+'</b><small>'+x.rows.length+' total incidents</small></span><strong>'+x.activeRows.length+' active</strong></div>').join('')+'</div></section></div>'+
 '<section class="card team-table-card"><h2>Resolution SLA by support team</h2><p class="sub">Recorded outcomes only. Active cases are excluded from this rate.</p><div class="table-wrap"><table><thead><tr><th>Support team</th><th>Resolved</th><th>SLA met</th><th>Rate</th><th>Current active</th></tr></thead><tbody>'+teamRows.map(x=>{const rate=x.resolvedRows.length?Math.round(x.met/x.resolvedRows.length*100):0;return '<tr><td><b>'+esc(x.team.name)+'</b></td><td>'+x.resolvedRows.length+'</td><td>'+x.met+'</td><td><div class="rate-cell"><div class="bar"><i style="width:'+rate+'%"></i></div><span>'+rate+'%</span></div></td><td>'+x.activeRows.length+'</td></tr>';}).join('')+'</tbody></table></div></section>';
}
function setupQueueEnhancements(){
 const filters=$('queue-view').querySelector('.filters');
 const quick=document.createElement('div');quick.className='quick-views';quick.setAttribute('aria-label','Quick incident views');
 quick.innerHTML='<span>Quick views</span><button data-queue-mode="active">Active queue</button><button data-queue-mode="critical">P1 / P2 priority</button><button data-queue-mode="risk">SLA attention</button><button data-queue-mode="">All incidents</button>';
 filters.before(quick);
 const summary=document.createElement('div');summary.className='queue-summary';summary.id='queue-summary';filters.after(summary);
 quick.querySelectorAll('[data-queue-mode]').forEach(b=>b.onclick=()=>{queueMode=b.dataset.queueMode;patternIds=null;page=0;quick.querySelectorAll('button').forEach(x=>x.classList.toggle('active',x===b));draw();});
}
function reset(){patternIds=null;scopeLabel='';queueMode='';['search','status','category','priority','sla'].forEach(id=>$(id).value='');$('sort').value='created';page=0;draw();}
function route(){
 if(!data)return;const view=location.hash.slice(1)||'dashboard';const queue=['dashboard','tickets'].includes(view);
 $('queue-view').hidden=!queue;$('stats').hidden=view!=='dashboard';$('overview-insights').hidden=view!=='dashboard';
 ['insights','knowledge','triage','about'].forEach(v=>$(v+'-view').hidden=v!==view);
 if(!['dashboard','tickets','insights','knowledge','triage','about'].includes(view)){location.hash='dashboard';return;}
 $('page-title').textContent={dashboard:'Support overview',tickets:'Incident queue',insights:'Recurring issues',knowledge:'Knowledge base',triage:'Triage lab',about:'About this demo'}[view];
 document.title='OpsResolve AI | '+$('page-title').textContent;
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
  $('stats').innerHTML=stats.map(([label,value,caption])=>'<div class="stat"><small>'+esc(label)+'</small><strong>'+esc(value)+'</strong><em>'+esc(caption)+'</em></div>').join('');renderOverview();
  const categories=[...new Set(data.tickets.map(t=>t.category))].sort();for(const id of ['category','kb-category'])for(const c of categories){const o=document.createElement('option');o.value=c;o.textContent=c;$(id).appendChild(o);}
  ['search','status','category','priority','sla','sort'].forEach(id=>$(id).addEventListener(id==='search'?'input':'change',()=>{page=0;draw();}));
  setupQueueEnhancements();
  $('prev').onclick=()=>{page--;draw();};$('next').onclick=()=>{page++;draw();};$('reset').onclick=reset;
  $('kb-search').oninput=drawKnowledge;$('kb-category').onchange=drawKnowledge;
  for(const s of data.systems){const o=document.createElement('option');o.value=s.system_id;o.textContent=s.name;$('triage-system').appendChild(o);}
  $('triage-form').onsubmit=e=>{e.preventDefault();const description=$('triage-description').value.trim();if(description.length<15)return;const q={description,system_id:$('triage-system').value||null,impact:$('triage-impact').value,urgency:$('triage-urgency').value,created_at:data.snapshot_at};reviews.delete('new-report');renderAnalysis('triage-result',OpsEngine.analyze(q,data,model),'new-report',q);$('triage-result').focus({preventScroll:true});if(innerWidth<1100)$('triage-result').scrollIntoView({block:'start'});};
  setupTriageGuidance();
  renderModelResults();
  setupProjectStory();
  draw();drawKnowledge();insights();route();$('loading').hidden=true;$('workspace').hidden=false;
 }catch(e){$('loading').hidden=true;$('error').hidden=false;$('error').textContent='The support dataset could not be loaded. Reload the page to try again.';}
}
function addDashboardStyles(){
 const style=document.createElement('style');style.textContent=`
 .overview-insights{margin:0 0 22px}.overview-grid{display:grid;grid-template-columns:1.08fr .92fr;gap:18px}.overview-grid .card{min-height:250px}.section-kicker{color:var(--blue);font-size:11px;font-weight:800;letter-spacing:.11em;text-transform:uppercase;margin-bottom:9px}.pulse-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:11px;margin-top:22px}.pulse-metrics>div{padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--card)}.pulse-value{display:block;font-size:27px;font-weight:800;line-height:1;color:var(--ink);margin-bottom:7px}.pulse-value.attention{color:var(--red)}.pulse-value.positive{color:var(--teal)}.pulse-metrics small{display:block;font-size:12px;font-weight:800;color:var(--ink)}.pulse-metrics em{display:block;margin-top:5px;color:var(--muted);font-size:12px;font-style:normal}.health-row{display:grid;grid-template-columns:80px 1fr 28px;gap:10px;align-items:center;margin:16px 0;font-size:13px}.health-track{height:9px;overflow:hidden;border-radius:99px;background:#e8eff4}.health-track i{display:block;height:100%;border-radius:inherit;background:var(--teal)}.health-row.warn .health-track i{background:var(--amber)}.health-row.breach .health-track i{background:var(--red)}.health-footer{display:flex;gap:10px;align-items:center;margin-top:24px;padding-top:14px;border-top:1px solid var(--line);font-size:12px;color:var(--muted)}.health-footer b{font-size:22px;color:var(--teal)}.mini-bars{margin-top:20px}.mini-bars>div{display:grid;grid-template-columns:90px 1fr 24px;gap:10px;align-items:center;margin:12px 0;font-size:13px}.mini-bars>div>div{height:9px;background:#e8eff4;border-radius:99px;overflow:hidden}.mini-bars i{display:block;height:100%;border-radius:99px;background:linear-gradient(90deg,var(--blue),var(--teal))}.attention-list{display:grid;gap:8px;margin-top:18px}.attention-item{display:grid;grid-template-columns:auto 1fr auto;gap:10px;align-items:center;width:100%;text-align:left;border:1px solid var(--line);border-radius:10px;padding:10px;background:var(--card);color:var(--ink)}.attention-item:hover{border-color:var(--teal);background:var(--soft-teal)}.attention-item b,.attention-item small{display:block}.attention-item small{font-size:12px;color:var(--muted);margin-top:2px}.attention-item strong{color:var(--red);font-size:13px}@media(max-width:1100px){.overview-grid{grid-template-columns:1fr 1fr}.pulse-metrics{grid-template-columns:1fr}.overview-grid .card{min-height:0}}@media(max-width:650px){.overview-grid{grid-template-columns:1fr}.pulse-metrics{grid-template-columns:repeat(3,1fr)}.pulse-metrics>div{padding:11px}.pulse-value{font-size:23px}.pulse-metrics small,.pulse-metrics em{font-size:11px}}html[data-theme="dark"] .pulse-metrics>div,html[data-theme="dark"] .attention-item{background:#10253c}html[data-theme="dark"] .health-track,html[data-theme="dark"] .mini-bars>div>div{background:#263f57}`;document.head.appendChild(style);
}
function addAnalyticsStyles(){
 const style=document.createElement('style');style.textContent=`
 .analytics-extra{margin-top:22px}.analytics-heading{margin:0 0 14px}.analytics-heading h2{margin:3px 0;font-size:22px}.analytics-heading p{margin:0;color:var(--muted);font-size:13px}.analytics-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;margin-bottom:18px}.trend-bars{height:178px;display:flex;align-items:end;gap:18px;padding:18px 12px 0;border-bottom:1px solid var(--line)}.trend-bars>div{height:100%;display:grid;grid-template-rows:1fr auto auto;align-items:end;justify-items:center;gap:6px;min-width:45px}.trend-bar-wrap{width:100%;height:100%;display:flex;align-items:end;background:linear-gradient(to top,rgba(45,111,226,.05),transparent);border-radius:8px 8px 0 0}.trend-bar-wrap i{display:block;width:100%;border-radius:8px 8px 0 0;background:linear-gradient(to top,var(--blue),var(--teal))}.trend-bars b{font-size:13px}.trend-bars span{font-size:12px;color:var(--muted)}.team-list{display:grid;gap:8px;margin-top:16px}.team-list>div{display:grid;grid-template-columns:10px 1fr auto;gap:10px;align-items:center;padding:9px 0;border-bottom:1px solid var(--line)}.team-dot{width:8px;height:8px;border-radius:50%;background:var(--teal)}.team-list>div:nth-child(2n) .team-dot{background:var(--blue)}.team-list b,.team-list small{display:block}.team-list b{font-size:13px}.team-list small{font-size:12px;color:var(--muted);margin-top:2px}.team-list strong{font-size:13px}.team-table-card{margin-bottom:20px}.rate-cell{display:flex;align-items:center;gap:9px;min-width:125px}.rate-cell .bar{flex:1}.rate-cell span{font-size:12px;font-weight:700}@media(max-width:700px){.analytics-grid{grid-template-columns:1fr}.trend-bars{gap:9px}.team-table-card{overflow:hidden}}html[data-theme="dark"] .trend-bar-wrap{background:linear-gradient(to top,rgba(87,139,255,.12),transparent)}`;document.head.appendChild(style);
}
function addQueueStyles(){
 const style=document.createElement('style');style.textContent=`
 .quick-views{display:flex;align-items:center;flex-wrap:wrap;gap:8px;margin:15px 0 10px}.quick-views>span{font-size:12px;font-weight:800;color:var(--muted);text-transform:uppercase;letter-spacing:.07em;margin-right:3px}.quick-views button{border:1px solid var(--line);border-radius:99px;padding:7px 10px;background:var(--card);color:var(--ink);font-size:12px;font-weight:700}.quick-views button:hover,.quick-views button.active{background:var(--soft-teal);border-color:#9fdfcb;color:#126f57}.queue-summary{display:flex;justify-content:space-between;align-items:center;gap:10px;margin:-2px 0 13px;padding:9px 11px;border:1px solid var(--line);border-radius:9px;background:var(--soft-blue);font-size:13px;color:var(--muted)}.queue-summary b{color:var(--ink)}.detail-top{display:flex;justify-content:space-between;gap:12px;align-items:flex-start}.detail-top h2{margin:0}.detail-badges{display:flex;gap:6px;flex-wrap:wrap;justify-content:flex-end}.detail .section-kicker{margin-bottom:5px}@media(max-width:650px){.quick-views{align-items:flex-start}.quick-views>span{width:100%}.queue-summary{align-items:flex-start;flex-direction:column}.detail-top{flex-direction:column}.detail-badges{justify-content:flex-start}}html[data-theme="dark"] .quick-views button{background:#10253c;color:var(--ink)}html[data-theme="dark"] .queue-summary{background:#15375f}`;document.head.appendChild(style);
}
function addInvestigationStyles(){
 const style=document.createElement('style');style.textContent=`
 .pattern-actions{display:flex;gap:10px;align-items:center;margin-top:8px}.pattern-workbench{margin:18px 0}.investigation-card{border-top:3px solid var(--blue)}.investigation-head{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.investigation-head h2{margin:3px 0;font-size:20px}.investigation-head p{margin:0;color:var(--muted);font-size:13px}.investigation-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:20px 0}.investigation-metrics>div{border:1px solid var(--line);border-radius:10px;padding:12px;background:var(--card)}.investigation-metrics b,.investigation-metrics span{display:block}.investigation-metrics b{font-size:24px;color:var(--blue)}.investigation-metrics span{margin-top:4px;font-size:12px;color:var(--muted)}.investigation-body{display:grid;grid-template-columns:1fr 1fr;gap:18px;border-top:1px solid var(--line);padding-top:16px}.investigation-body h3{font-size:14px;margin:0 0 7px}.investigation-body p{font-size:13px;margin:0 0 10px}@media(max-width:650px){.investigation-metrics{grid-template-columns:1fr 1fr}.investigation-body{grid-template-columns:1fr}.investigation-head{flex-direction:column}}html[data-theme="dark"] .investigation-metrics>div{background:#10253c}`;document.head.appendChild(style);
}
function addKnowledgeStyles(){
 const style=document.createElement('style');style.textContent=`
 .kb-item{position:relative;min-height:166px}.kb-evidence{display:block;margin-top:14px;padding-top:10px;border-top:1px solid var(--line);font-size:12px;font-weight:700;color:var(--blue)}.kb-insight{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0}.kb-insight>div{padding:10px;border:1px solid var(--line);border-radius:9px;background:var(--soft-blue)}.kb-insight b,.kb-insight span{display:block}.kb-insight b{font-size:21px;color:var(--blue)}.kb-insight span{font-size:11px;color:var(--muted);margin-top:3px}@media(max-width:650px){.kb-insight{grid-template-columns:1fr 1fr}}html[data-theme="dark"] .kb-insight>div{background:#15375f}`;document.head.appendChild(style);
}
function addTriageStyles(){
 const style=document.createElement('style');style.textContent=`
 .triage-guidance{display:grid;gap:9px;margin-top:20px;padding-top:16px;border-top:1px solid var(--line)}.triage-guidance>div{display:grid;grid-template-columns:25px 1fr;gap:9px;align-items:start}.triage-guidance>div>span{display:grid;place-items:center;width:23px;height:23px;border-radius:50%;background:var(--soft-blue);color:var(--blue);font-weight:800;font-size:12px}.triage-guidance p{margin:2px 0;font-size:13px;color:var(--muted)}.triage-guidance b{color:var(--ink)}.analysis-safety{display:flex;justify-content:space-between;gap:16px;padding:14px;border:1px solid var(--line);border-radius:12px;background:var(--soft-blue);margin-top:18px}.analysis-safety b{display:block;font-size:16px}.analysis-safety p{margin:4px 0 0;font-size:12px;color:var(--muted);max-width:350px}.analysis-inputs{display:flex;flex-wrap:wrap;justify-content:flex-end;align-content:flex-start;gap:6px;max-width:260px}.analysis-inputs span{border:1px solid var(--line);border-radius:99px;padding:5px 7px;background:var(--card);font-size:11px;font-weight:700;color:var(--muted)}.analysis-inputs span:first-child{color:var(--blue)}.review-record{padding:9px 11px;border-left:3px solid var(--teal);background:var(--soft-teal);font-size:13px}@media(max-width:650px){.analysis-safety{flex-direction:column}.analysis-inputs{justify-content:flex-start;max-width:none}}html[data-theme="dark"] .analysis-safety{background:#15375f}html[data-theme="dark"] .analysis-inputs span{background:#10253c}`;document.head.appendChild(style);
}
function addStoryStyles(){
 const style=document.createElement('style');style.textContent=`
 .project-story{margin-top:30px;padding-top:26px;border-top:1px solid var(--line)}.story-heading{max-width:760px}.story-heading h2{font-size:24px;margin:4px 0 8px}.story-heading p{color:var(--muted);margin:0}.story-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin:20px 0}.story-grid article{padding:16px;border:1px solid var(--line);border-radius:12px;background:var(--card)}.story-grid article>span{display:inline-grid;place-items:center;width:27px;height:27px;border-radius:8px;background:var(--soft-blue);color:var(--blue);font-size:12px;font-weight:800}.story-grid h3{font-size:15px;margin:12px 0 5px}.story-grid p{font-size:13px;line-height:1.5;color:var(--muted);margin:0}.architecture-card{padding:20px;border:1px solid var(--line);border-radius:14px;background:linear-gradient(135deg,var(--card),var(--soft-blue));margin:20px 0}.architecture-card h2{font-size:19px;margin:4px 0 16px}.architecture-flow{display:flex;align-items:stretch;gap:8px}.architecture-flow>div{flex:1;padding:12px;border:1px solid var(--line);border-radius:10px;background:var(--card)}.architecture-flow b,.architecture-flow span,.architecture-flow small{display:block}.architecture-flow b{color:var(--blue);font-size:13px}.architecture-flow span{font-weight:800;font-size:13px;margin-top:5px}.architecture-flow small{font-size:11px;color:var(--muted);margin-top:4px}.architecture-flow>i{align-self:center;font-style:normal;color:var(--blue);font-size:19px}.case-guardrails{display:grid;grid-template-columns:1fr 1fr;gap:18px}.case-guardrails>div{padding:16px;border-left:3px solid var(--teal);background:var(--soft-teal);border-radius:0 10px 10px 0}.case-guardrails>div+div{border-color:var(--amber);background:#fff7e7}.case-guardrails h3{margin:0 0 8px;font-size:15px}.case-guardrails ul{margin:0;padding-left:18px}.case-guardrails li{padding:3px 0;font-size:13px;color:var(--muted)}@media(max-width:800px){.story-grid{grid-template-columns:1fr}.architecture-flow{display:grid;grid-template-columns:1fr 1fr}.architecture-flow>i{display:none}.case-guardrails{grid-template-columns:1fr}}@media(max-width:500px){.architecture-flow{grid-template-columns:1fr}}html[data-theme="dark"] .architecture-card{background:linear-gradient(135deg,#112840,#15375f)}html[data-theme="dark"] .story-grid article,html[data-theme="dark"] .architecture-flow>div{background:#10253c}html[data-theme="dark"] .case-guardrails>div+div{background:#4b3519}`;document.head.appendChild(style);
}
function addPolishStyles(){
 const style=document.createElement('style');style.textContent=`
 .skip-link{position:fixed;left:14px;top:-50px;z-index:20;padding:10px 13px;border-radius:8px;background:var(--navy);color:#fff;font-weight:800;text-decoration:none;transition:top .18s ease}.skip-link:focus{top:14px}.back-to-top{position:fixed;right:18px;bottom:18px;z-index:8;width:42px;height:42px;border:1px solid var(--line);border-radius:50%;background:var(--card);color:var(--ink);box-shadow:var(--shadow);opacity:0;pointer-events:none;transform:translateY(8px);transition:opacity .18s ease,transform .18s ease}.back-to-top.visible{opacity:1;pointer-events:auto;transform:translateY(0)}@media(max-width:900px){.mobile-nav{position:sticky;top:0;z-index:6;flex-wrap:nowrap;overflow-x:auto;padding:8px 0;background:var(--paper);scrollbar-width:none}.mobile-nav::-webkit-scrollbar{display:none}.mobile-nav a{white-space:nowrap}.stats{gap:10px}.card{padding:17px}.table-wrap{margin:0 -4px}.trend-bars{min-width:330px}.back-to-top{right:12px;bottom:12px}}@media(prefers-reduced-motion:reduce){*,*:before,*:after{scroll-behavior:auto!important;transition-duration:.01ms!important;animation-duration:.01ms!important;animation-iteration-count:1!important}}`;
 document.head.appendChild(style);
}
function setupAccessibility(){
 const main=document.querySelector('main');main.id='main-content';main.setAttribute('tabindex','-1');
 const skip=document.createElement('a');skip.className='skip-link';skip.href='#main-content';skip.textContent='Skip to workspace';document.body.prepend(skip);
 const back=document.createElement('button');back.className='back-to-top';back.type='button';back.setAttribute('aria-label','Back to top');back.title='Back to top';back.textContent='↑';document.body.appendChild(back);
 const update=()=>back.classList.toggle('visible',window.scrollY>500);window.addEventListener('scroll',update,{passive:true});update();
 back.onclick=()=>window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
}
function setupBrand(){
 const brandMark=document.querySelector('.brand i');
 brandMark.innerHTML='<svg viewBox="0 0 64 64" aria-hidden="true" focusable="false"><path d="M16 22h14l8 10h10" fill="none" stroke="#63dfc3" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="16" cy="22" r="5" fill="#63dfc3"/><circle cx="30" cy="22" r="5" fill="#2d6fe2"/><circle cx="38" cy="32" r="5" fill="#63dfc3"/><path d="m43 42 5 5 10-12" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>';
 brandMark.setAttribute('aria-label','OpsResolve AI');
 const favicon=document.querySelector('link[rel="icon"]');if(favicon)favicon.href='opsresolve-mark.svg';
 const style=document.createElement('style');style.textContent='.brand i{background:#0b1f35!important;padding:4px}.brand i svg{width:100%;height:100%;display:block}';document.head.appendChild(style);
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
addDashboardStyles();addAnalyticsStyles();addQueueStyles();addInvestigationStyles();addKnowledgeStyles();addTriageStyles();addStoryStyles();addPolishStyles();setupAccessibility();setupBrand();setupTheme();window.addEventListener('hashchange',route);init();

function renderAnalysis(target,a,key,q){
 const accepted=a.action==='recommend',status=reviews.get(key)||a.review_status;
 const recommendation=a.recommended_kb?articles[a.recommended_kb]:null;
 const training=q.ticket_id?model.training_ids.includes(q.ticket_id):false;
 const topSop=a.sop_candidates[0]?.score||0;
 const alignment=a.action==='out_of_scope'?'Out of scope':topSop>=.6&&a.category_score>=.7?'Strong evidence alignment':topSop>=.3?'Partial evidence alignment':'Limited evidence alignment';
 const alignmentNote=a.action==='out_of_scope'?'The report does not match the current fictional support scope.':topSop>=.6?'Category and procedure evidence point in a similar direction. Validate before acting.':'The text has limited or mixed procedure evidence. Gather more details before a change.';
 $(target).innerHTML='<section class="analysis-safety"><div><span class="section-kicker">AI recommendation review</span><b>'+esc(alignment)+'</b><p>'+esc(alignmentNote)+'</p></div><div class="analysis-inputs"><span>Description</span><span>'+esc(q.system_id?systems[q.system_id]?.name||'Selected system':'System not specified')+'</span><span>'+esc(q.impact||'Impact not supplied')+' impact</span><span>'+esc(q.urgency||'Urgency not supplied')+' urgency</span></div></section>'+
 '<div class="callout '+(a.critical_review?'critical':accepted?'':'warning')+'"><b>'+esc(a.critical_review?'Critical impact: escalate for human review':accepted?'Suggested triage':a.action==='out_of_scope'?'Outside current support scope':'More evidence needed')+'</b><p>'+esc(a.reason||'Validate the procedure against the actual error before applying any change.')+'</p></div>'+
 '<div class="kv">'+kv('Category',a.predicted_category||'Unconfirmed')+kv('Suggested priority',a.suggested_priority||'Confirm impact / urgency')+kv('Priority basis','Impact × urgency rule')+kv('Human review',status)+'</div>'+
 '<p class="footer">'+(q.ticket_id?(training?'This incident was in the training sample.':'Held-out September case.'):'New report analyzed against the historical demo.')+' Analysis is a retrospective demonstration using the current model.</p>'+
 (a.likely_cause?'<h3>Historical hypothesis</h3><p>'+esc(a.likely_cause.text)+'</p><p class="footer">Supported by '+a.likely_cause.ticket_ids.map(esc).join(', ')+'. This is not a confirmed cause for the current report.</p>':a.possible_causes.length?list('Possible causes from matched SOP',a.possible_causes):'<p>No root-cause hypothesis is supported by the current evidence.</p>')+
 list(accepted?'Recommended diagnostic checks':'Evidence to gather',a.recommended_steps,true)+
 (a.escalation_conditions.length?list('Escalate when',a.escalation_conditions):'')+
 '<h3>Procedure evidence</h3>'+a.sop_candidates.map(s=>'<div class="evidence"><button class="action" data-analysis-kb="'+esc(s.article_id)+'">'+esc(s.article_id)+' · '+esc(articles[s.article_id].title)+'</button><p class="footer">Text similarity '+s.score.toFixed(2)+(recommendation?.article_id===s.article_id?' · Suggested procedure':' · Candidate only')+'</p></div>').join('')+
 '<h3>Similar resolved incidents</h3>'+(a.similar_tickets.length?a.similar_tickets.map(h=>'<div class="evidence"><button class="action" data-analysis-ticket="'+esc(h.ticket_id)+'">'+esc(h.ticket_id)+'</button><p>'+esc(h.root_cause)+'</p><p class="footer">Resolved '+esc(date(h.resolved_at))+' · Similarity '+h.score.toFixed(2)+'</p></div>').join(''):'<p>No sufficiently similar training incident was resolved before this report.</p>')+
 '<p class="footer">Classifier score '+a.category_score.toFixed(2)+'. Scores measure model preference or text similarity. They are not calibrated confidence.</p>'+
 '<div class="review-actions">'+(accepted?'<button class="button" data-review="Reviewed: accepted">Accept suggestion</button>':'')+'<button class="button" data-review="Reviewed: more evidence requested">Request evidence</button><button class="button" data-review="Reviewed: rejected">Reject suggestion</button></div><p role="status" class="review-record" id="'+target+'-review">Decision record: '+esc(status)+'</p><p class="footer">Review decisions last for this page session. Ticket priority, ownership and resolution remain unchanged.</p>';
 $(target).querySelectorAll('[data-analysis-kb]').forEach(b=>b.onclick=()=>{location.hash='knowledge';route();showArticle(b.dataset.analysisKb);});
 $(target).querySelectorAll('[data-analysis-ticket]').forEach(b=>b.onclick=()=>{location.hash='tickets';route();showTicket(b.dataset.analysisTicket);});
 $(target).querySelectorAll('[data-review]').forEach(b=>b.onclick=()=>{reviews.set(key,b.dataset.review);renderAnalysis(target,a,key,q);});
}
function setupTriageGuidance(){
 const form=$('triage-form'),guide=document.createElement('section');guide.className='triage-guidance';
 guide.innerHTML='<span class="section-kicker">How this demo handles a report</span><div><span>1</span><p><b>Interpret</b> the description and selected system.</p></div><div><span>2</span><p><b>Match</b> procedures and resolved historical cases.</p></div><div><span>3</span><p><b>Escalate or request evidence</b> when the signals are weak or impact is critical.</p></div>';
 form.after(guide);
}
function setupProjectStory(){
 const about=$('about-view'),story=document.createElement('section');story.className='project-story';
 story.innerHTML='<div class="story-heading"><span class="section-kicker">Portfolio case study</span><h2>From support noise to a structured decision workspace</h2><p>OpsResolve demonstrates how incident data, operational analytics and constrained AI assistance can be brought into one reviewable support workflow.</p></div><div class="story-grid"><article><span>01</span><h3>The problem</h3><p>Support teams need to locate recurring problems, assess SLA exposure and find the right procedure without treating pattern matches as confirmed causes.</p></article><article><span>02</span><h3>The approach</h3><p>Build a connected fictional workspace that links incidents, histories, support procedures, operational views and triage recommendations.</p></article><article><span>03</span><h3>The outcome</h3><p>Visitors can investigate '+data.tickets.length+' fictional incidents, compare workloads and review suggested actions with cited procedure and historical evidence.</p></article></div><section class="architecture-card"><div><span class="section-kicker">Workflow architecture</span><h2>How information moves through the demo</h2></div><div class="architecture-flow"><div><b>1</b><span>Structured dataset</span><small>Tickets, events and SOPs</small></div><i>→</i><div><b>2</b><span>Operational views</span><small>SLA, queue and pattern analysis</small></div><i>→</i><div><b>3</b><span>Experimental triage</span><small>Category, procedure and similar cases</small></div><i>→</i><div><b>4</b><span>Human review</span><small>Accept, request evidence or reject</small></div></div></section><section class="case-guardrails"><div><h3>What this project demonstrates</h3><ul><li>Data modelling and linked operational records</li><li>Business-focused dashboard design</li><li>Search, filtering and investigation workflows</li><li>Transparent AI-assistance boundaries</li></ul></div><div><h3>What it does not claim</h3><ul><li>Production integrations or live incident data</li><li>Automatic root-cause confirmation</li><li>Calibrated AI confidence or production accuracy</li><li>Automated changes to support tickets</li></ul></div></section>';
 about.appendChild(story);
}
function renderModelResults(){
 const pct=n=>(n*100).toFixed(1)+'%';
 $('model-results').innerHTML='<h3>Model evaluation</h3><p>Trained category classifier: '+model.trained_on+' July/August incidents. Held-out evaluation: '+evaluation.test_cases+' September incidents.</p><div class="kv">'+kv('Raw category accuracy',pct(evaluation.raw_category_accuracy))+kv('Category macro-F1',evaluation.raw_category_macro_f1.toFixed(3))+kv('SOP top-1 match',pct(evaluation.sop_top1_accuracy))+kv('Requested evidence',evaluation.abstained_cases+' / '+evaluation.test_cases)+'</div><p>'+evaluation.challenge_cases+' independently worded challenge cases: '+Math.round(evaluation.challenge_action_agreement*evaluation.challenge_cases)+' matched the expected recommend / request-evidence / out-of-scope action. These are development diagnostics, not a final benchmark.</p><div class="table-wrap"><table class="model-table"><thead><tr><th>Category</th><th>Test cases</th><th>Recall</th><th>F1</th></tr></thead><tbody>'+evaluation.per_class.map(c=>'<tr><td>'+esc(c.category)+'</td><td>'+c.sample_count+'</td><td>'+pct(c.recall)+'</td><td>'+c.f1.toFixed(3)+'</td></tr>').join('')+'</tbody></table></div><p class="scope">The sample wording is templated, and the classifier struggles with some paraphrases. SOP retrieval scores reflect an easy synthetic test. Rule-based priority agreement is not learned-model accuracy. No production accuracy or calibrated confidence is established.</p><p class="footer">'+esc(model.method)+' · '+esc(model.version)+'. Model weights and thresholds were not tuned to held-out labels. Review guards changed after the initial challenge run.</p>';
}
