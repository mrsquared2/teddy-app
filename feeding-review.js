// Evidence shares and presentation thresholds are heuristics, not clinical tolerances.
import {omittedComponents} from './meal-plans.js';
export function evidenceFor(entries,id) {
  const sources=entries.filter(e=>e.grams>0).map(e=>{
    const f=e.food,kind=f.nutrients[id]==null || f.partialNutrients?.includes(id)?'missing':f.estimates?.[id]?.confidence==='low'?'low-confidence':f.estimatedNutrients?.includes(id)||f.estimates?.[id]?'estimated':f.quality==='typical'?'reported':'source-average';
    return {food:f.name,kind,value:(f.nutrients[id] || 0)*e.grams/100};
  });
  const total=sources.reduce((s,c)=>s+c.value,0),share=kind=>total>0?sources.filter(s=>kind.includes(s.kind)).reduce((s,c)=>s+c.value,0)/total:0;
  return {sources,total,lowShare:share(['low-confidence']),estimatedShare:share(['low-confidence','estimated']),missing:sources.some(s=>s.kind==='missing'),zeroAssumptions:sources.some(s=>['low-confidence','estimated'].includes(s.kind)&&s.value===0)};
}
export function compatibilityFindings(profile,entries) {
  const foods=[...new Map(entries.filter(e=>e.grams>0).map(e=>[e.food.id,e.food])).values()];
  const reviewed=profile.mixedReview?.note?.trim() && foods.every(f=>profile.mixedReview.foodIds.includes(f.id));
  if(reviewed)return [];
  const findings=[];
  if(foods.some(f=>f.id==='seed-optimix') && foods.some(f=>f.complete || (f.role==='supplement' && !['seed-optimix','seed-nutrafibre'].includes(f.id))))findings.push({kind:'compatibility',title:'Review the supplement and complete-food combination',text:'Optimix is not intended to supplement complete or already mineralized meals. Record a review of this exact combination in the plan before treating it as an agreed feeding pattern.'});
  if(foods.some(f=>f.id==='seed-hills-1') && foods.some(f=>!['seed-hills-0','seed-hills-1'].includes(f.id)))findings.push({kind:'compatibility',title:'Review additions to the prescription diet',text:'Hill’s c/d + Metabolic instructions recommend exclusively feeding the recommended Prescription Diet foods. A nutrient score cannot confirm that substitutions preserve its dietary purpose.'});
  return findings;
}
export function feedingFindings(day,entries,report,issues,evidence,names) {
  const findings=compatibilityFindings(day.profile,entries);
  const hard=issues.filter(c=>c.state==='over');
  if(hard.length)findings.unshift({kind:'limit',title:'Configured maximum exceeded',text:hard.map(c=>`${c.name}: ${c.value.toPrecision(4)} / ${c.max.toPrecision(4)} ${c.unit}`).join('; ')});
  if(['below','over'].includes(report.ratioState))findings.unshift({kind:'limit',title:'Calcium-to-phosphorus ratio outside configured bounds',text:`Projected ratio ${report.ratio.toFixed(2)} : 1. Review the main ingredients and specified mineral component; fruit portions are unlikely to resolve this.`});
  const missing=omittedComponents(day),covered=new Set();
  if(missing.length){
    findings.push({kind:'recipe',title:'A saved recipe component is not planned',text:missing.map(c=>`${c.food.name}: ${Number(c.grams.toFixed(3))} g in ${c.meal}`).join('; ')+'. Check whether it was supplied separately before including it. Review an incomplete recipe; do not record future food as eaten.'});
    for(const c of issues)if(c.state==='below' && c.difference>0 && missing.reduce((s,e)=>s+(e.food.nutrients[c.id]||0)*e.grams/100,0)>=c.difference*.8)covered.add(c.id);
  }
  const material=issues.filter(c=>!covered.has(c.id) && c.state!=='over' && !c.near && (c.priority || c.relative>=.2 || c.state==='unknown'));
  const reliable=material.filter(c=>!evidence.rows.find(r=>r.id===c.id)?.materialUncertainty && c.state!=='unknown');
  const uncertain=material.filter(c=>!reliable.includes(c));
  const listed=rows=>rows.slice(0,5).map(c=>names[c.id].name).join(', ')+(rows.length>5?` and ${rows.length-5} more`:'');
  if(reliable.length)findings.push({kind:'reference',title:entries.some(e=>e.food.complete)?'Review the ration and reference together':'Review the meal formulation',text:`${listed(reliable)} ${reliable.length===1?'is':'are'} outside the selected references. ${entries.some(e=>e.food.complete)?'A reduced complete-food ration may not match body-weight references; do not automatically add food to turn bars green.':'These are diet-comparison findings, not diagnosed deficiencies or an instruction to add supplements.'}`});
  if(uncertain.length)findings.push({kind:'evidence',title:'Check the data before changing the meal',text:`${listed(uncertain)}: the comparison relies materially on proxy values or missing composition. Small modeled differences should not determine feeding.`});
  if(!findings.length)findings.push({kind:'summary',title:'No material numeric issue highlighted',text:'All configured references were checked. Near-reference differences remain in details; this is not clinical approval or proof of a complete diet.'});
  return findings;
}
