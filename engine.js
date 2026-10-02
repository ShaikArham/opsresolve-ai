(function(root){
 'use strict';
 const STOP=new Set('the and a in is of to for or with from at an not user users reference observed please during routine processing because task complete unable my i it this that has have was are by be all no as'.split(' '));
 const tokens=text=>(String(text||'').toLowerCase().match(/[a-z]+/g)||[]).filter(w=>!STOP.has(w));
 const features=x=>tokens(x.description||x.title||'');
 function counts(words){const c={};for(const w of words)c[w]=(c[w]||0)+1;return c;}
 function vector(words,idf){const c=counts(words),v={};let norm=0;for(const w in c){v[w]=c[w]*(idf[w]||0);norm+=v[w]**2;}norm=Math.sqrt(norm);for(const w in v)v[w]=norm?v[w]/norm:0;return v;}
 const cosine=(a,b)=>Object.keys(a).reduce((s,w)=>s+a[w]*(b[w]||0),0);
 function classify(query,model){
  const bag=counts(features(query)),known=Object.keys(bag).filter(w=>model.vocabulary.includes(w));
  const scores=model.classes.map(c=>({category:c,log:Math.log(model.priors[c])+known.reduce((s,w)=>s+bag[w]*model.log_likelihood[c][w],0)}));
  const max=Math.max(...scores.map(x=>x.log)),den=scores.reduce((s,x)=>s+Math.exp(x.log-max),0);
  scores.forEach(s=>s.score=Math.exp(s.log-max)/den);scores.sort((a,b)=>b.score-a.score);
  return {category:scores[0].category,score:scores[0].score,known_terms:known.length,scores:scores.map(({category,score})=>({category,score}))};
 }
 function rankSops(query,model){
  const v=vector(features(query),model.idf);
  return model.article_vectors.map(a=>({article_id:a.article_id,score:cosine(v,a.vector)})).sort((a,b)=>b.score-a.score||a.article_id.localeCompare(b.article_id));
 }
 function suggestPriority(query){
  const levels=['Low','Medium','High','Critical'];const i=levels.indexOf(query.impact),j=levels.indexOf(query.urgency);
  if(i<0||j<0)return null;const matrix=[[4,3,3,2],[3,3,2,2],[3,2,2,1],[2,2,1,1]];return 'P'+matrix[i][j];
 }
 function historical(query,data,model){
  const cutoff=query.created_at||data.snapshot_at,ids=new Set(model.training_ids);
  const docs=data.tickets.filter(t=>ids.has(t.ticket_id)&&t.ticket_id!==query.ticket_id&&t.resolved_at&&t.resolved_at<cutoff);
  const v=vector(features(query),model.idf);
  return docs.map(t=>({ticket_id:t.ticket_id,score:cosine(v,vector(features(t),model.idf)),root_cause:t.root_cause,kb_article_id:t.kb_article_id,resolved_at:t.resolved_at})).filter(t=>t.score>=model.thresholds.history_similarity).sort((a,b)=>b.score-a.score||a.ticket_id.localeCompare(b.ticket_id)).slice(0,3);
 }
 function analyze(query,data,model){
  // Deliberate whitelist: category, actual priority, outcomes and labels never enter the predictor.
  const input={ticket_id:query.ticket_id,title:query.title,description:query.description,system_id:query.system_id,impact:query.impact,urgency:query.urgency,created_at:query.created_at};
  const category=classify(input,model),ranked=rankSops(input,model),best=ranked[0],margin=best.score-(ranked[1]?.score||0);
  const technical=tokens(input.description).filter(w=>model.vocabulary.includes(w)).length;
  let action='recommend',reason=null;
  if(category.known_terms<model.thresholds.minimum_known_terms||best.score<model.thresholds.sop_min_similarity){
   const supportedSystem=data.systems.some(s=>s.system_id===input.system_id);
   action=technical<2&&!supportedSystem?'out_of_scope':'request_evidence';reason=action==='out_of_scope'?'No useful match to the supported technical procedures.':'Insufficient technical detail for a reliable procedure match.';
  }else if(!input.system_id||margin<model.thresholds.sop_min_margin||category.score<model.thresholds.category_min_score){
   action='request_evidence';reason=!input.system_id?'Confirm the affected system and exact error before selecting a procedure.':'Several procedures are plausible. Gather the exact error and diagnostic evidence.';
  }
  const candidates=ranked.slice(0,3),similar=historical(input,data,model);
  const bestArticle=data.knowledge_articles.find(a=>a.article_id===best.article_id);
  if(action==='recommend'&&bestArticle.category!==category.category){
   action='request_evidence';reason='The text classifier and matched procedure suggest different categories. Review the diagnostic evidence before routing.';
  }
  const supportedHistory=similar.filter(t=>t.kb_article_id===best.article_id);
  const causeCounts={};for(const t of supportedHistory)causeCounts[t.root_cause]=(causeCounts[t.root_cause]||0)+1;
  const causes=Object.entries(causeCounts).sort((a,b)=>b[1]-a[1]);
  const likely=action==='recommend'&&causes.length?{text:causes[0][0],source:'historical incidents',ticket_ids:supportedHistory.filter(t=>t.root_cause===causes[0][0]).map(t=>t.ticket_id)}:null;
  return {model_version:model.version,action,reason,predicted_category:action==='recommend'?category.category:null,category_score:category.score,category_candidates:category.scores.slice(0,3),suggested_priority:suggestPriority(input),priority_method:'Impact × urgency rule',recommended_kb:action==='recommend'?best.article_id:null,sop_candidates:candidates,similar_tickets:similar,likely_cause:likely,possible_causes:action==='recommend'&&!likely?bestArticle.possible_causes:[],recommended_steps:action==='recommend'?bestArticle.diagnostic_steps:['Confirm the affected system','Capture the exact error and UTC timestamp','Confirm affected users, business deadline and available workaround'],escalation_conditions:action==='recommend'?bestArticle.escalation_conditions:[],critical_review:suggestPriority(input)==='P1',review_status:'Pending human review',score_note:'Model and similarity scores are uncalibrated and are not probabilities of correctness.'};
 }
 const api={tokens,features,counts,vector,cosine,classify,rankSops,suggestPriority,historical,analyze};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.OpsEngine=api;
})(typeof globalThis!=='undefined'?globalThis:this);
