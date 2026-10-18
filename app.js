import {planningEntries,plannedEntries,planRecipe,eatPlanned,usesFixedRecipe,addPlannedMeal} from './meal-plans.js';
import { NUTRIENTS, byId, uid, clone, dateKey, number, format, makeProfile, researchProfile, freshState,
  newDay, caloriesFor, targetFor, totals, audit, suggestions, validateFood, validateProfile, validateState, migrateState, portionGrams, activityFor, portionDefaults, portionBounds, portionSettingsFor, nutrientProgress, DEFAULT_WATCH, adultTargets, DEFAULT_PRIORITIES, projectOption, validateRecipe } from './core.js';

const SOURCE_URL = 'https://europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025-ONLINE.pdf';
import {load,commit,markExport,legacyChanged,LEGACY_KEY,StorageConflict} from './storage.js';
import {RELEASE} from './release.js';
import {guidanceNotes,productMaxDM,GUIDANCE_SOURCE,MERCK_NUTRITION} from './nutrient-guidance.js';
let revision=0,saving=false,externalChange=false,legacyConflict=false,storageInfo={},undoEntry=null,updateReady=false;
const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('teddy-diary'):null;
const app = document.querySelector('#app'), modal = document.querySelector('#modal');
let state, rawBackup = null, tab = 'today', selectedDate = dateKey(), followToday = true;
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const attr = value => esc(value == null ? '' : value);
// A plan's version only matters once it has been edited (saving creates a new version).
const versionNote = p => p.revision>1 ? ` · version ${p.revision}` : '';
// Each plan appears once; a day whose plan was deleted from the library keeps it as its own entry.
const planOptions = d => [...(state.profiles.some(p=>p.id===d.profile.id)?[]:[[d.profile.id,`${d.profile.name} (removed from plans)`]]),...state.profiles.map(p=>[p.id,`${p.name}${versionNote(p)}`])];
// Entries keep a timestamp for ordering only: now for today, midday for another date.
const entryTime = () => selectedDate===dateKey() ? new Date().toISOString() : new Date(`${selectedDate}T12:00:00`).toISOString();
const button = (text, action, id = '', cls = '') => `<button type="button" class="${attr(cls)}" data-action="${attr(action)}" data-id="${attr(id)}">${text}</button>`;
const options = (values, selected) => values.map(([value, label]) => `<option value="${attr(value)}" ${value === selected ? 'selected' : ''}>${esc(label)}</option>`).join('');
const sourceLink = source => /^https:\/\//.test(source) ? `<a href="${attr(source)}" target="_blank" rel="noopener noreferrer">Open source ↗</a>` : '';
const groups = [...new Set(NUTRIENTS.map(n => n.group))];
const active = () => state.profiles.find(p => p.id === state.activeProfileId);
const getDay = () => state.days[selectedDate] || newDay(active());
const ensureDay = s => s.days[selectedDate] ||= newDay(s.profiles.find(p => p.id === s.activeProfileId));

function syncDate() {
  if (!state || !followToday || selectedDate === dateKey()) return true;
  if (modal.open) return false;
  selectedDate = dateKey(); render(); return true;
}
window.addEventListener('focus', syncDate);
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncDate(); });
modal.addEventListener('close', syncDate);

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message; toast.classList.add('visible');
  clearTimeout(notify.timer); notify.timer = setTimeout(() => toast.classList.remove('visible'), 2800);
}
async function save(next,options={}) {
  if(saving)throw new Error('A save is still in progress. Try again when it finishes.');
  if(externalChange)throw new StorageConflict();
  saving=true;
  try {
    const nextRevision=await commit(next,revision,options);
    state=next;revision=nextRevision;channel?.postMessage({revision});
    if(options.checkpoint)storageInfo.recovery={...storageInfo.recovery,[options.checkpoint]:new Date().toISOString()};
  } catch(error) {
    if(error instanceof StorageConflict){externalChange=true;render();}
    if(error.name==='QuotaExceededError')throw new Error('The device could not store this change. The previous diary is intact. Export it, free device space, and retry.');
    throw error;
  } finally {saving=false;}
}
async function change(fn,message) {
  const next=clone(state);fn(next);await save(next);render();if(message)notify(message);
}
async function checkExternal() {
  if(!state || saving)return;
  try {
    const latest=await load();
    legacyConflict=await legacyChanged(latest.legacyDigest);
    if(latest.revision!==revision || legacyConflict){externalChange=true;render();}
  }catch{notify('Could not check the saved diary. A save will retry the database connection.');}
}
if(channel)channel.onmessage=checkExternal;
window.addEventListener('focus',checkExternal);
window.addEventListener('storage',event=>{if(event.key===LEGACY_KEY)checkExternal();});
function openDialog(title, content) {
  modal.innerHTML = `<header class="dialog-header"><h2>${esc(title)}</h2>${button('×', 'close', '', 'icon-button')}</header>${content}`;
  modal.showModal();
}
function field(label, name, value = '', type = 'text', extra = '') {
  return `<label>${esc(label)}<input name="${attr(name)}" type="${attr(type)}" value="${attr(value)}" ${extra}></label>`;
}
function numeric(label, name, value = '', extra = '') {
  return field(label, name, value, 'text', `inputmode="decimal" ${extra}`);
}
function formFooter(label) { return `<p class="form-error" role="alert"></p><footer class="form-footer">${button('Cancel', 'close', '', 'secondary')}<button class="primary" type="submit">${esc(label)}</button></footer>`; }
// Display precision only: about three significant digits, never hiding tiny amounts.
function amountText(v) {
  const size = Math.abs(v);
  return format(v, size >= 100 ? 0 : size >= 1 ? 1 : size > 0 && size < .01 ? 5 : 2);
}
function rangeText(target, calories) {
  if (!target) return 'Not set';
  const t = targetFor(target, calories);
  const f = amountText;
  const text = t.min != null && t.max != null ? t.min === t.max ? f(t.min) : `${f(t.min)}–${f(t.max)}`
    : t.min != null ? `≥ ${f(t.min)}` : t.max != null ? `≤ ${f(t.max)}` : 'Not set';
  return `${target.kind === 'reference' ? '≈ ' : ''}${text}${target.partial ? ' *' : ''}`;
}
let proposalCache = null, optimizerWorker = null;
function proposalFor(day) {
  const key=JSON.stringify([selectedDate,day,state.foods]);
  if(proposalCache?.key===key)return proposalCache.result;
  const pending={options:[],reason:'Optimizing portions…',pending:true};
  proposalCache={key,result:pending};
  if((day.availableFoods || []).length<1) return proposalCache.result=suggestions(day,state.foods);
  try {
    if(!optimizerWorker) {
      optimizerWorker=new Worker('./optimizer-worker.js',{type:'module'});
      optimizerWorker.onmessage=({data})=>{
        if(proposalCache?.key!==data.key)return;
        proposalCache.result=data.result || {options:[],reason:`Could not calculate: ${data.error}`};
        if(tab==='today')render();
      };
      optimizerWorker.onerror=()=>{
        optimizerWorker.terminate();optimizerWorker=null;
        if(proposalCache) {proposalCache.result={options:[],reason:'The optimizer could not load. Reload the app to try again.'};if(tab==='today')render();}
      };
    }
    optimizerWorker.postMessage({key,day,foods:state.foods});
  } catch {proposalCache.result=suggestions(day,state.foods);}
  return proposalCache.result;
}
function nutrientBar(day, report, id, before) {
  const n=byId[id], total=report.total[id], p=nutrientProgress(day,report,id);
  const amount=amountText;
  const target=day.profile.targets[id], watched=(day.profile.watchNutrients || DEFAULT_WATCH).includes(id);
  const limit=p.max==null?'No upper limit configured':p.reference?'Planning preference · not a safety limit':`${target?.origin==='adult-guidance'?'General adult upper reference':'Configured maximum'} ${amount(p.max)} ${n.unit}`;
  const limitNote=p.max==null||p.reference?limit:target?.origin==='adult-guidance'?'Upper value is a general adult reference':'Upper value is a configured maximum';
  // Excesses are measured against the upper value they exceed, not the lower target.
  const above=p.max>0 && total.value>p.max;
  const share=above?` · ${format(total.value/p.max*100,0)}% of ${p.reference?'upper preference':'maximum'}`:p.percent==null?'':` · ${format(p.percent,0)}% of ${p.min>0?'lower target':'maximum'}`;
  const reference=id==='energy'?`Daily allowance ${report.calories} kcal`:target?`${p.reference?'Planning range':'Reference'}: ${rangeText(target,report.calories)} ${n.unit} · ${limitNote}`:limit;
  return `<div class="nutrient-progress ${p.tone}" data-nutrient="${id}">
    <div class="nutrient-bar-heading"><strong>${esc(n.name)}${watched?'<small class="watch-label">Watching</small>':''}</strong><span>${before?`${amount(before.total[id].value)} → `:''}${amount(total.value)} ${n.unit}</span></div>
    <div class="nutrient-track" ${p.min!=null || p.max!=null ? `role="meter" aria-label="${attr(n.name)}${before?' projected':''}" aria-valuemin="0" aria-valuemax="${p.scale}" aria-valuenow="${total.value}" aria-valuetext="${attr(`${amount(total.value)} ${n.unit}; ${p.label}`)}"` : ''}>
      <span class="nutrient-fill" style="width:${p.min==null&&p.max==null?0:p.fill}%"></span>
      ${p.minMarker==null?'':`<i class="target-marker" style="left:${p.minMarker}%" title="Minimum / lower reference"></i>`}
      ${p.maxMarker==null?'':`<i class="target-marker upper" style="left:${p.maxMarker}%" title="${attr(limit)}"></i>`}</div>
    <div class="nutrient-bar-caption"><span>${esc(p.label)}${share}</span><span>${total.missing.length?'Known subtotal':total.uncertain?'Estimated':''}</span></div>
    ${id==='energy'?`<small class="muted">${esc(reference)}</small>`:`<details class="estimate-details"><summary><span class="muted">${esc(reference)}</span><span class="info-mark" aria-label="How to interpret this nutrient">ⓘ</span></summary><p>${esc(guidanceNotes[id])}</p>${day.profile.recipeTargets?.[id]?`<p>Original recipe composition: ${rangeText(day.profile.recipeTargets[id],report.calories)} ${n.unit}. Descriptive only.</p>`:''}</details>`}
  </div>`;
}
function nutrientRows(day, report=audit(day), before=null, openMacros=true) {
  const watch=day.profile.watchNutrients || DEFAULT_WATCH;
  const excess=report.checks.filter(c=>c.state==='over');
  const alerts=excess.length?`<section class="nutrient-alert" role="status"><strong>Above configured maxima</strong><ul>${excess.map(c=>`<li>${esc(byId[c.id].name)}: ${amountText(c.value)} / ${amountText(c.max)} ${byId[c.id].unit}${c.max>0?` · ${format((c.value/c.max-1)*100,0)}% above`:''}</li>`).join('')}</ul></section>`:'';
  const watched=watch.length?`<section class="watch-nutrients"><h3>Watching closely</h3><details class="watch-reason"><summary>Why these are watched</summary><p class="muted">Total fat: gallbladder diet review. Calcium / phosphorus and their ratio: diet balance and urinary review. A/D: food and supplement contributions. These general references do not establish Teddy’s therapeutic limits.</p></details>${watch.map(id=>nutrientBar(day,report,id,before)).join('')}</section>`:'';
  return alerts+watched+groups.map(group=>`<details class="nutrient-group" ${group==='Macros'&&openMacros?'open':''}><summary>${esc(group)}</summary>${NUTRIENTS.filter(n=>n.group===group && n.id!=='water' && !watch.includes(n.id)).map(n=>nutrientBar(day,report,n.id,before)).join('')}</details>`).join('');
}
function issueText(c) {
  if(c.state==='unknown' || c.partial)return `${c.name}: comparison is incomplete`;
  const direction=c.state==='below'?'below':c.state==='over'?'above maximum':'above planning range';
  return `${c.name}${c.near?' (near reference)':''}: ${amountText(c.difference)} ${c.unit} ${direction}${Number.isFinite(c.relative)?` (${format(c.relative*100,0)}%)`:''}`;
}
function findingsView(findings) {
  const mandatory=findings.filter(f=>f.kind==='limit' || f.kind==='compatibility'),ordinary=findings.filter(f=>!mandatory.includes(f));
  const row=f=>f.kind==='limit'?`<li class="over"><strong>${esc(f.title)}</strong><p>${esc(f.text)}</p></li>`
    :`<li><details class="finding"><summary><strong>${esc(f.title)}</strong></summary><p>${esc(f.text)}</p></details></li>`;
  return `<ul class="feeding-findings">${mandatory.map(row).join('')}${ordinary.slice(0,Math.max(1,3-mandatory.length)).map(row).join('')}</ul>${ordinary.length>Math.max(1,3-mandatory.length)?`<details><summary>Other findings</summary><ul class="feeding-findings">${ordinary.slice(Math.max(1,3-mandatory.length)).map(row).join('')}</ul></details>`:''}`;
}
function evidenceSummary(option,detail=false) {
  const e=option.evidence;
  return `<section class="composition-evidence"><small>${esc(e.status)} · not clinical approval.</small>${e.hardLimitUncertainty.length?`<p><small>Limit checks materially relying on estimates: ${e.hardLimitUncertainty.map(r=>esc(r.name)).join(', ')}.</small></p>`:''}${detail?`<details><summary>Composition evidence and contribution shares</summary><p>Prominence uses a 10% low-confidence or 25% total modeled contribution threshold; these are display heuristics, not measured uncertainty intervals. Missing values remain unknown. Modeled zeros do not establish absence. Hard limits remain unchanged.</p><ul>${e.rows.map(r=>`<li><strong>${esc(r.name)}</strong>: ${format(r.lowShare*100,0)}% low-confidence proxy; ${format(r.estimatedShare*100,0)}% modeled overall${r.zeroAssumptions?'; includes assumed zeros':''}${r.hard&&r.materialUncertainty?'; configured limit depends materially on estimates':''}. ${r.sources.map(s=>`${esc(s.food)} (${esc(s.kind.replaceAll('-',' '))}, ${format(s.value)} ${byId[r.id].unit})`).join('; ')}</li>`).join('')}</ul></details>`:''}</section>`;
}
// "Green beans · frozen, thawed" → name first, preparation on a quieter line.
function foodName(name) {
  const [head,...rest]=String(name).split(' · ');
  return `${esc(head)}${rest.length?`<small class="prep">${esc(rest.join(' · '))}</small>`:''}`;
}
function additionRow(e) {
  const note=e.dosed?'<small class="muted">Dosed for the home-cooked food in this day · add fresh to the cooled portion</small>':'';
  return `<li data-food-id="${attr(e.food.id)}"><b>${format(e.grams,1)} g</b><span>${foodName(e.food.name)}${note}</span></li>`;
}
// Alternatives repeat only new findings; shared ones stay visible by title.
function alternativeFindings(o,first) {
  const key=f=>`${f.kind}|${f.title}|${f.text}`,seen=new Set(first.findings.map(key));
  const shared=o.findings.filter(f=>seen.has(key(f))),fresh=o.findings.filter(f=>!seen.has(key(f)));
  return `${fresh.length?findingsView(fresh):''}${shared.length?`<p class="shared-findings">Same review notes as the first option: ${shared.map(f=>`<span class="${f.kind==='limit'?'over':''}">${esc(f.title)}</span>`).join('; ')}.</p>`:''}`;
}
const mealName=additions=>additions.filter(e=>!e.dosed).map(e=>String(e.food.name).split(' · ')[0]).join(', ');
function suggestionCard(o,index,first=null) {
  return `<article class="suggestion"><strong>${index===0?'Suggested':`Option ${index+1}`} · ${esc(o.label.toLowerCase())}${!o.coverage.complete?' · less assessable':''}</strong><ul class="portion-ingredients">${o.additions.map(additionRow).join('')}</ul><p><strong>${format(o.projected.total.energy.value,0)} / ${format(o.projected.calories)} kcal projected</strong> · ${o.filled?'fills the allowance':`${format(o.energyGap,0)} kcal unused`}</p>${first?alternativeFindings(o,first):findingsView(o.findings)}${evidenceSummary(o)}${o.approximate?'<small>Best fit found within the calculation time limit.</small>':''}<div class="card-actions">${button('See projected day','view-projection',String(index),'secondary')}${button('Plan these portions','plan-option',String(index),'secondary')}</div></article>`;
}
function feedingReview(day,projection) {
  const plans=day.planned || [],hasFood=day.entries.length || plans.length;
  return `<section class="card feeding-review"><h2>Today’s feeding review</h2>${hasFood?`<p><strong>${format(projection.projected.total.energy.value,0)}${projection.projected.total.energy.missing.length?' + unknown':''} / ${format(projection.projected.calories)} kcal ${plans.length?'eaten + planned':'eaten'}</strong></p><p class="muted">${plans.length?`${plans.length} planned ${plans.length===1?'portion remains':'portions remain'} to feed.`:'No portions remain planned. This review uses the food recorded as eaten.'}</p>${projection.projected.total.energy.value>projection.projected.calories?'<p class="notice">The day exceeds its calorie allowance. Review the portions.</p>':''}${findingsView(projection.findings)}${evidenceSummary(projection)}${button('See day nutrient details','view-planned','','secondary')}`:'<p class="empty-inline">Log food to see how the day is going.</p>'}</section>`;
}
function plannedView(day) {
  const plans=day.planned || [];
  if(!plans.length)return '';
  return `<section class="card planned-meals"><h2>Still to give today</h2>${plans.map(p=>`<article class="planned-meal"><h3>${esc(p.name)}</h3><p>${p.portionGrams!=null?`${format(p.portionGrams)} g prepared mixture · `:''}${format(totals(p.items).energy.value,0)} kcal</p><ul>${p.items.map(c=>`<li>${format(c.grams,1)} g ${foodName(c.food.name)}${c.fresh?' · add fresh':''}</li>`).join('')}</ul><div class="card-actions">${button('Log eaten portion','eat-planned',p.id,'primary')}${button('Remove plan','remove-planned',p.id,'text-button')}</div></article>`).join('')}</section>`;
}
function viewProjection(index) {
  const day=getDay(), o=proposalFor(day).options[index];if(!o)return;
  const current=audit(day), a=o.projected;
  openDialog('Projected day', `<p class="notice">Food already eaten + fixed planned portions + this additional proposal. This preview does not add food to the diary.</p>
    <ul class="portion-ingredients">${o.additions.map(additionRow).join('')}</ul>
    <p><strong>${format(a.total.energy.value,0)} / ${format(a.calories,0)} kcal projected</strong> · ${o.filled?'fills the allowance':`${format(o.energyGap,0)} kcal ${day.profile.calorieIntent==='ceiling'?'unused allowance':'remaining'}`}</p>
    ${evidenceSummary(o,true)}<section class="projection-issues"><h3>Background nutrition checks</h3>${!o.filled && day.profile.calorieIntent!=='ceiling'?`<p class="notice">${format(o.energyGap,1)} kcal remain: the current food choices and portion limits cannot fill the day.</p>`:''}
    ${findingsView(o.findings)}<details><summary>All numeric differences, including near-reference values</summary>${o.issues.length?`<ul>${o.issues.map(c=>`<li class="${c.state==='over'?'over':''}">${esc(issueText(c))}</li>`).join('')}</ul>`:'<p>All numeric references met.</p>'}</details>
    <p class="muted">Ranked by proportional gap; this is not a ranking of medical risk. Below reference is not a diagnosis of deficiency.</p></section>${o.unreachable.length?`<details class="unreachable-targets"><summary>Targets these ingredients cannot reach</summary><p class="muted">Each target was checked separately across all permitted combinations. Bounds use estimated composition and today’s calorie/portion limits.</p><ul>${o.unreachable.map(c=>`<li><strong>${esc(byId[c.id].name)}</strong>: ${c.side==='min'?'at most':'at least'} ${amountText(c.attainable)} ${byId[c.id].unit} for the day; ${c.side==='min'?'lower reference':'planning upper reference'} ${amountText(c.required)} ${byId[c.id].unit}.</li>`).join('')}</ul><p class="muted">Reaching these targets requires different ingredients or reviewed limits; extra search time cannot resolve this combination.</p></details>`:''}
    <p class="ratio">Calcium : phosphorus · ${a.ratio==null?(a.total.phosphorus.value>0?format(a.total.calcium.value/a.total.phosphorus.value):'Unknown'):format(a.ratio)} : 1 · ${a.ratioState==='unset'?'No ratio limit set':a.ratioState==='within'?'Within configured bounds':a.ratioState}</p>
    <h3>Logged → projected totals</h3>${nutrientRows(day,a,current,false)}${button('Close','close','','secondary')}`);
}
function todayView() {
  const day = getDay(), a = audit(day), energy = a.total.energy, remaining = a.calories - energy.value, futureEnergy=totals(plannedEntries(day)).energy, review=projectOption(day);
  const percent = Math.min(100, Math.max(0, energy.value / a.calories * 100));
  const currentVersion = state.profiles.find(p => p.id === day.profile.id);
  const proposal = proposalFor(day);
  return `<div class="page-title"><div><span class="eyebrow">A little care, every day</span><h1>Teddy’s day<span class="title-dot">.</span></h1></div><label class="date-label"><span class="sr-only">Diary date</span><input id="diary-date" type="date" value="${selectedDate}"></label></div>
  <div class="dashboard-grid"><div class="main-column">
  <section class="card energy-card"><div class="section-heading"><span class="eyebrow">Daily allowance</span>${button(`${esc(day.profile.name)}${currentVersion && currentVersion.revision!==day.profile.revision?' · earlier version':''} ⌄`, "choose-plan", "", "pill plan-switch")}</div>
    <div class="energy-display"><div><strong>${format(energy.value, 0)}</strong><span> / ${format(a.calories, 0)} kcal</span></div><img src="./icon.svg" alt="" width="62" height="62"></div>
    <div class="progress" role="progressbar" aria-label="Calories logged" aria-valuenow="${Math.round(percent)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>
    <p class="remaining">${energy.missing.length ? 'Calorie total is incomplete — add missing food values.' : remaining >= 0 ? `${format(remaining, 0)} kcal ${day.profile.calorieIntent==='ceiling'?'unused allowance':'remaining'}` : `${format(-remaining, 0)} kcal above today’s target`}</p>
    ${(day.planned || []).length?`<p class="planned-allowance">${futureEnergy.missing.length?'Planned calories are incomplete':`${format(futureEnergy.value,0)} kcal still to give${remaining-futureEnergy.value<-.5?` · ${format(futureEnergy.value-remaining,0)} kcal over the allowance`:''}`}</p>`:''}
    <div class="macro-grid">${['protein', 'fat', 'carbs'].map(id => `<div><span>${byId[id].name}</span><strong>${format(a.total[id].value, 1)}<small> g</small></strong><small>${a.total[id].missing.length ? 'Incomplete data' : rangeText(day.profile.targets[id], a.calories) === 'Not set' ? 'No target set' : `${rangeText(day.profile.targets[id], a.calories)} g target`}</small></div>`).join('')}</div>
    <div class="activity-bar"><span>Today’s activity</span><div class="segmented" role="group" aria-label="Activity">${[['quiet','Quiet'],['normal','Normal'],['active','Active']].map(([key, label]) => button(label, 'activity', key, day.activity === key ? 'selected' : '')).join('')}</div></div>
    <small class="muted">Quiet ${format(day.profile.calories + activityFor(day).quiet,0)} · Normal ${format(day.profile.calories + activityFor(day).normal,0)} · Active ${format(day.profile.calories + activityFor(day).active,0)} kcal. Edit presets in Plans.</small>
  </section>
  <section class="card"><div class="section-heading"><h2>Food diary</h2>${undoEntry?button('Undo last deletion','undo-entry','','secondary'):''}${button('+ Log food', 'log', '', 'primary')}</div>
    ${day.entries.length ? `<div class="entry-list">${day.entries.map(e => {
      const kcal = e.food.nutrients.energy;
      return `<article class="entry"><div class="food-mark">${e.food.complete ? '◒' : '◌'}</div><div class="entry-info"><strong>${esc(String(e.food.name).split(' · ')[0])}</strong><span>${e.portion && e.portion.unit !== 'g' ? `${format(e.portion.amount)} × ${esc(e.portion.unit)} · ` : ''}${format(e.grams, 2)} g</span></div><div class="entry-energy">${kcal == null ? 'Unknown' : `${format(kcal * e.grams / 100, 0)} kcal`}${button('Edit', 'edit-entry', e.id, 'text-button')}</div></article>`;
    }).join('')}</div>` : `<div class="empty"><svg class="empty-symbol" viewBox="0 0 48 48" width="46" height="46" aria-hidden="true"><path d="M6 22h36a18 14 0 0 1-36 0Z" fill="currentColor" opacity=".35"/><path d="M6 22h36a18 14 0 0 1-36 0Zm8 14h20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg><h3>A fresh bowl, a fresh day</h3><p>Choose a food and enter grams or a piece count.</p></div>`}
  </section>
  ${plannedView(day)}
  ${feedingReview(day,review)}
  <section class="card portion-options"><div class="section-heading"><h2>Portion options</h2>${button(day.availableFoods?.length ? 'Change ingredients' : 'Choose ingredients', 'available-foods', '', 'secondary')}</div>
    ${(()=>{const intro=`<p class="muted">${day.profile.planningNutrients?`Planning focus: ${day.profile.planningNutrients.map(id=>esc(byId[id].name)).join(', ') || 'calories only'}. All nutrient references are evaluated; these preferences receive extra weight. `:''}</p><p class="muted">Pick 1–5 foods you have. You get gram amounts for the rest of the day, after everything eaten and planned.</p>${day.profile.calorieIntent==='ceiling'?'<p class="muted">Ceiling mode seeks nutrient improvements with the smallest addition; unused calories are not a target.</p>':''}`;
      // Once ingredients are chosen, the explanation folds away so the proposal leads.
      return day.availableFoods?.length ? `<div class="ingredient-chips" aria-label="Available ingredients">${day.availableFoods.map(id=>`<span class="pill neutral">${esc(String(state.foods.find(f=>f.id===id)?.name || 'Unavailable food').split(' · ')[0])}</span>`).join('')}</div><details class="portion-notes"><summary>How portions are calculated</summary>${intro}<p class="muted">Amounts are optimized within editable portion limits. Compare nutrient fit, more ingredient variety and smaller nutrient gaps; a food may be omitted when the limits conflict.</p></details>` : intro;})()}
    ${day.profile.clinicalNotes ? `<details class="portion-notes"><summary>Plan notes</summary><p class="notice">${esc(day.profile.clinicalNotes)}</p></details>` : ''}
    ${usesFixedRecipe(day)?`<label class="checkbox"><input id="allow-recipe-additions" type="checkbox" ${day.allowRecipeAdditions?'checked':''}>Allow extra foods beyond my fixed recipe portions (including meals already eaten)</label>`:''}
    ${proposal.limited?'<p class="notice">These choices cannot fill the remaining calories within the current portion limits. Add a suitable main food or adjust the limits.</p>':''}
    ${proposal.options.length?suggestionCard(proposal.options[0],0)+(proposal.options.length>1?`<details class="alternative-portions"><summary>Alternative portions</summary>${proposal.options.slice(1).map((o,i)=>suggestionCard(o,i+1,proposal.options[0])).join('')}</details>`:''):`<p class="empty-inline${proposal.pending?' pending':''}" role="status">${esc(proposal.reason)}</p>`}
    <div class="card-actions plan-ahead">${button('Saved recipes','recipes','','secondary')}${button('+ Plan food for later','plan-food','','secondary')}</div>

  </section>
  </div><aside class="side-column">
  <section class="card plan-card"><span class="eyebrow">Your feeding plan</span><h2>${esc(day.profile.name)}</h2><span class="pill neutral">${esc(day.profile.status)}</span>
    ${day.profile.recipe ? `<div class="card-actions">${button('How these targets were calculated', 'view-day-recipe', '', 'secondary')}</div>` : ''}
    <label>Plan for this day<select id="day-profile">${options(planOptions(day), day.profile.id)}</select></label>
    <p class="muted">Switching recalculates this day’s targets. Logged portions stay the same.</p>
    ${currentVersion?.revision !== day.profile.revision ? `<div class="notice"><p>This day uses an earlier version of this plan.</p>${button('Use the latest version','update-day-plan','','secondary')}</div>` : ''}
    ${button('Compare plans ↗', 'tab', 'plans', 'text-button')}
  </section>
  <section class="card"><div class="section-heading"><h2>Day notes</h2>${button('Edit', 'day-details', '', 'text-button')}</div>
    ${day.note ? `<p class="note-text">${esc(day.note)}</p>` : '<p class="muted">Add meal notes or a daily calorie adjustment.</p>'}
  </section>
  <section class="card"><details><summary>Nutrient detail · eaten totals</summary><p class="muted">Totals include best-effort estimates where exact composition is unavailable. Sources and methods are in each food’s Nutrients & sources. ≈ denotes a soft planning range; * denotes an older partial reference. “Below” is not a diagnosed deficiency.</p>
    ${day.profile.calciumPhosphorus.min != null || day.profile.calciumPhosphorus.max != null ? `<div class="ratio"><span>Calcium to phosphorus ratio</span><strong>${!day.entries.length ? 'Nothing eaten yet' : a.ratio == null ? 'Unknown · some foods lack calcium or phosphorus values' : `${format(a.ratio,1)} : 1 · ${a.ratioState==='within'?'within range':a.ratioState==='below'?'too little calcium':'too much calcium'}`}</strong><small>Plan range: ${format(day.profile.calciumPhosphorus.min)}–${format(day.profile.calciumPhosphorus.max)} parts calcium for each part phosphorus.</small></div>` : ''}
    ${nutrientRows(day)}</details>
  </section></aside></div>`;
}
function foodsView() {
  return `<div class="page-title"><div><span class="eyebrow">The familiar favourites</span><h1>Food library<span class="title-dot">.</span></h1></div>${button('+ Add food', 'edit-food', '', 'primary')}</div>
  <p class="page-description">Researched food composition and product labels, per 100 g as eaten. View each food’s sources and estimates. Piece weights and product details are editable.</p>
  <input id="food-search" class="search" type="search" placeholder="Find a food…" aria-label="Find a food">
  <div class="food-grid">${state.foods.map(f => `<article class="card food-card" data-food-name="${attr(f.name.toLowerCase())}"><span class="pill neutral">${f.role === 'supplement' ? 'Supplement' : f.complete ? 'Complete food' : 'Ingredient / treat'}</span><h2>${esc(f.name)}</h2><strong class="food-calories">${f.nutrients.energy == null ? 'Energy not published' : `${format(f.nutrients.energy)} kcal / 100 g`}</strong><p class="muted">${Object.keys(f.nutrients).length} of ${NUTRIENTS.length} values entered · ${f.quality === 'typical' ? 'Typical analysis' : f.quality === 'bounds' ? 'Label bounds' : 'Estimated'}</p><div class="card-actions">${button('Nutrients & sources', 'view-food', f.id, 'secondary')}${button('Edit', 'edit-food', f.id, 'text-button')}${button('+ Log', 'log', f.id, 'text-button')}</div></article>`).join('')}</div>`;
}
function plansView() {
  const day = getDay(), a = audit(day);
  const included = NUTRIENTS.filter(n => n.id !== 'energy' && state.profiles.some(p => p.targets[n.id]));
  return `<div class="page-title"><div><span class="eyebrow">Different plans. One diary.</span><h1>Nutrition plans<span class="title-dot">.</span></h1></div>${button('+ New plan', 'edit-plan', '', 'primary')}</div>
  <p class="page-description">Research reference plus Nutritionist Plan 1 and Plan 2, each with a 240 kcal normal-day allowance. General adult references allow flexible food choices. The nutritionist recipes remain available as composition comparisons; their narrow bands are not daily requirements. Each plan has editable priorities and limits. Saved past days retain their targets.</p>
  <div class="plan-grid">${state.profiles.map(p => `<article class="card profile-card ${p.id === state.activeProfileId ? 'default-plan' : ''}"><div class="section-heading"><span class="pill ${p.id === state.activeProfileId ? '' : 'neutral'}">${p.id === state.activeProfileId ? 'Default for new days' : esc(p.status)}</span>${p.revision>1?`<small>Version ${p.revision}</small>`:''}</div><h2>${esc(p.name)}</h2><p class="muted">${esc(p.author)}</p><div class="plan-kcal"><strong>${format(p.calories, 0)}</strong> kcal / day</div><p>${p.planningNutrients?p.planningNutrients.length:Object.keys(p.targets).length} planning priorities · ${Object.keys(p.targets).length} nutrient references · ${p.allowedFoods.length} foods for suggestions</p><div class="card-actions">${p.referenceInfo ? button('Calculation & sources', 'view-recipe', p.id, 'secondary') : ''}${button('Edit plan', 'edit-plan', p.id, 'secondary')}${button('Duplicate', 'duplicate-plan', p.id, 'text-button')}${p.id !== state.activeProfileId ? button('Make default', 'default-plan', p.id, 'text-button') : ''}</div><details><summary>Notes & sources</summary><p class="note-text">${esc(p.notes || 'No notes yet.')}</p><p class="note-text">${esc(p.clinicalNotes)}</p>${sourceLink(p.source)}${button('Export this plan', 'export-plan', p.id, 'text-button')}</details></article>`).join('')}</div>
  ${button('Research for all 49 nutrients','view-guidance','','secondary')}<section class="card comparison"><div class="section-heading"><h2>Compare daily targets</h2><span class="pill neutral">${selectedDate}</span></div><p class="muted">Same logged food, viewed against each plan’s normal-day target. This does not change the diary.</p><div class="table-wrap"><table><thead><tr><th>Nutrient</th><th>Logged</th>${state.profiles.map(p => `<th>${esc(p.name)}</th>`).join('')}</tr></thead><tbody><tr><td>Energy · kcal</td><td>${format(a.total.energy.value)}${a.total.energy.missing.length ? ' + unknown' : ''}</td>${state.profiles.map(p => `<td>${format(p.calories + p.activity.normal)}</td>`).join('')}</tr>${included.map(n => `<tr><td>${esc(n.name)} · ${n.unit}</td><td>${format(a.total[n.id].value)}${a.total[n.id].missing.length ? ' + unknown' : ''}</td>${state.profiles.map(p => `<td>${rangeText(p.targets[n.id], p.calories + p.activity.normal)}</td>`).join('')}</tr>`).join('')}</tbody></table></div></section>`;
}
// Averages over logged days only; days without food are not counted as zero intake.
function trendSummary(days,span) {
  const since=dateKey(new Date(Date.now()-(span-1)*864e5)),logged=days.filter(([date,d])=>date>=since && date<=dateKey() && d.entries.length);
  if(!logged.length)return `<div class="trend"><h3>Last ${span} days</h3><p class="muted">No food logged yet.</p></div>`;
  const audits=logged.map(([,d])=>audit(d)),avg=f=>audits.reduce((s,a)=>s+f(a),0)/audits.length;
  const macro=id=>`<li><span>${esc(byId[id].name)}</span><strong>${format(avg(a=>a.total[id].value),1)} g</strong></li>`;
  const low=new Map();audits.forEach(a=>a.checks.forEach(c=>{if(c.state==='below')low.set(c.id,(low.get(c.id)||0)+1);}));
  const often=[...low].filter(([,n])=>n>logged.length/2).sort((a,b)=>b[1]-a[1]);
  return `<div class="trend"><h3>Last ${span} days</h3><p class="muted">${logged.length} ${logged.length===1?'day':'days'} logged · averages per logged day</p>
    <ul class="trend-list"><li><span>Calories</span><strong>${format(avg(a=>a.total.energy.value),0)} / ${format(avg(a=>a.calories),0)} kcal</strong></li>${['protein','fat','carbs'].map(macro).join('')}</ul>
    <p class="trend-low">${often.length?`Below reference on most days: ${often.map(([id,n])=>`${esc(byId[id].name)} (${n}/${logged.length})`).join(', ')}`:'No nutrient below its reference on most days.'}</p></div>`;
}
function historyView() {
  const days = Object.entries(state.days).sort(([a], [b]) => b.localeCompare(a));
  return `<div class="page-title"><div><span class="eyebrow">The bigger picture</span><h1>History & backup<span class="title-dot">.</span></h1></div></div>
  <section class="card trends"><h2>Averages</h2><div class="trend-grid">${trendSummary(days,7)}${days.some(([date,d])=>d.entries.length && date<dateKey(new Date(Date.now()-6*864e5)) && date>=dateKey(new Date(Date.now()-29*864e5)))?trendSummary(days,30):''}</div><p class="muted">Eaten food only. Micronutrient adequacy is judged over time, not from a single day.</p></section>
  <section class="card"><h2>Daily totals</h2>${days.length ? `<div class="table-wrap"><table class="daily-totals"><thead><tr><th>Day</th><th>kcal</th><th>Protein g</th><th>Fat g</th><th>Carbs g</th></tr></thead><tbody>${days.map(([date, d]) => {const t=totals(d.entries),label=new Date(`${date}T12:00:00`).toLocaleDateString([], {weekday:'short',day:'numeric',month:'short'});return `<tr><td>${button(esc(label), 'open-day', date, 'text-button')}</td><td>${format(t.energy.value,0)}${t.energy.missing.length ? '+?' : ''}<small>of ${format(caloriesFor(d),0)}</small></td>${['protein','fat','carbs'].map(id=>`<td>${format(t[id].value,1)}</td>`).join('')}</tr>`;}).join('')}</tbody></table></div>` : '<p class="empty-inline">Days appear here once you log food.</p>'}</section>
  <div class="two-columns"><section class="card"><h2>Keep a copy</h2><p class="backup-status">${storageInfo.lastExportAt?`Last export started: ${esc(new Date(storageInfo.lastExportAt).toLocaleString())}. Confirm the downloaded file is saved.`:'No backup exported yet. Keep a copy outside this browser.'}</p>${Object.entries(storageInfo.recovery || {}).filter(([,at])=>at).map(([kind,at])=>`<p>${button(`Download before ${kind}`, 'export-recovery',kind,'secondary')}<small> ${esc(new Date(at).toLocaleString())}</small></p>`).join('')}<p>Your diary stays in this browser on this device. Export a backup regularly and before clearing website data or changing devices.</p><div class="card-actions">${button('Export backup', 'export', '', 'primary')}${button('Import backup or plan', 'import', '', 'secondary')}</div><p class="muted">A full backup restores the complete library, plans and diary. A plan export adds a new plan. Imported data is checked before anything is replaced.</p></section>
  <section class="card"><div class="section-heading"><h2>Weight diary</h2>${button('+ Add weight', 'weight', '', 'secondary')}</div><p class="muted">Starting context: 4.8 kg; provisional goal around 4.5 kg.</p>${state.weights.length ? `<ul class="weights">${[...state.weights].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,12).map(w=>`<li><span>${w.date}</span><strong>${format(w.kg)} kg</strong></li>`).join('')}</ul>` : '<p class="empty-inline">No weigh-ins logged yet.</p>'}</section></div>
  <section class="card"><h2>On your iPhone</h2><p>Open mrsquared2.github.io/teddy-app in Safari, tap Share → Add to Home Screen and keep Open as Web App on. Open it once online; after that it also works offline.</p><p class="muted">Each device keeps its own diary. There is no account, analytics, AI service or automatic cloud backup.</p></section>`;
}
function render() {
  app.innerHTML = `<div class="app-shell"><header class="topbar"><a class="brand" href="#" data-action="tab" data-id="today"><img src="./icon.svg" alt="" width="34" height="34"><span>teddy<span class="brand-sub">nutrition diary</span></span></a><span class="private-label"><span class="status-dot"></span> Personal & private</span></header><main>${externalChange?`<section class="notice" role="alert"><strong>The diary changed in another tab.</strong><p>Your unsaved form is still open; no stale changes will be saved. Loading the latest diary closes the form. If an older app tab is open, export its diary and close it first.</p>${button('Load latest diary','reload-diary','','secondary')}${legacyConflict?`<p>An older app also changed its copy. After exporting and closing that older tab, keep the current database diary and retain the older copy as a recovery download.</p>${button('Keep current diary and preserve older copy','resolve-legacy','','secondary')}`:''}</section>`:''}${({today:todayView,foods:foodsView,plans:plansView,history:historyView})[tab]()}${updateReady?`<section class="notice update-notice" role="status"><p>A new version of Teddy is ready.</p>${button('Update now','apply-update','','primary')}</section>`:''}</main><nav class="navigation" aria-label="Main navigation">${[['today','◷','Today'],['foods','◒','Foods'],['log','+','Log'],['plans','☷','Plans'],['history','↺','History']].map(([id,icon,label])=>id==='log'?`<button type="button" data-action="log-nav" data-id="" class="nav-log"><span aria-hidden="true">${icon}</span>${label}</button>`:`<button data-action="tab" data-id="${id}" class="${tab===id?'selected':''}" ${tab===id?'aria-current="page"':''}><span aria-hidden="true">${icon}</span>${label}</button>`).join('')}</nav><footer class="site-footer">Teddy ${esc(RELEASE)} · ${navigator.onLine?'Online':'Offline'} · Stored on this device.</footer></div>`;
}
function editFood(id) {
  const f = state.foods.find(f=>f.id===id) || {id:uid(),name:'',nutrients:{},source:'',notes:'',quality:'estimate',complete:false};
  openDialog(id ? 'Edit food' : 'Add a food', `<form id="food-form" data-id="${attr(f.id)}">${field('Food name and preparation','name',f.name,'text','required maxlength="180"')}
  <div class="form-grid"><label>Data type<select name="quality">${options([['typical','Typical analysis / database average'],['estimate','Estimate'],['bounds','Label minimums / maximums only']],f.quality)}</select></label><label>Food type<select name="complete">${options([['false','Ingredient, treat or supplement'],['true','Complete diet (per manufacturer)']],String(f.complete))}</select></label></div>
  <p class="notice">All values are per 100 g as eaten, including moisture. Leave unknown values blank; enter 0 only for a known zero. Added vitamins/minerals on a label are not necessarily total nutrient content.</p>
  ${groups.map(group=>`<details class="editor-group" ${group==='Macros'?'open':''}><summary>${group}</summary><div class="form-grid">${NUTRIENTS.filter(n=>n.group===group).map(n=>numeric(`${n.name} (${n.unit})`,n.id,f.nutrients[n.id])).join('')}</div></details>`).join('')}
  <label>Count units · one label = grams per line<textarea name="units" rows="3" placeholder="egg = 50">${esc((f.units||[]).map(u=>`${u.label} = ${u.grams}`).join('\n'))}</textarea></label><label>Portion suggestions<select name="role">${options([['food','Food — eligible when selected'],['supplement','Supplement — never suggest automatically']],f.role||'food')}</select></label><label>Portion group<select name="portionGroup">${options([['main','Main ingredient'],['fruit','Fruit'],['vegetable','Vegetable / purée'],['treat','Treat']],portionDefaults(f).group)}</select></label>${numeric('Usual grams per day when selected · optional','suggestionDailyMinGrams',portionDefaults(f).dailyMinGrams)}${numeric('Default maximum grams per day for suggestions · optional','suggestionMaxGrams',portionDefaults(f).maxGrams)}${numeric('Maximum daily calorie share for suggestions (%) · optional','maxEnergyPercent',f.maxDailyEnergyFraction == null ? '' : f.maxDailyEnergyFraction*100)}${field('Source / product URL','source',f.source)}<label>Notes<textarea name="notes" rows="3">${esc(f.notes)}</textarea></label>${formFooter('Save food')}</form>`);
}
function editPlan(id) {
  const p = state.profiles.find(p=>p.id===id) || makeProfile();
  openDialog(id ? 'Edit nutrition plan' : 'Create nutrition plan', `<form id="plan-form" data-id="${attr(p.id)}">
  ${field('Plan name','name',p.name,'text','required maxlength="180"')}<div class="form-grid">${field('Author / origin','author',p.author)}${field('Status','status',p.status)}</div>
  <div class="form-grid">${numeric('Baseline kcal / day','calories',p.calories,'required')}${numeric('Reference weight (kg; descriptive)','referenceWeight',p.referenceWeight,'required')}</div>
  ${numeric('Optimix for a fully home-cooked day (g; 0 turns dosing off)','optimixDailyGrams',p.optimixDailyGrams ?? 2,'required')}
  <p class="muted">Portion proposals add Optimix in proportion to calories from home-cooked main foods. Complete diets, fruit, vegetables and treats need none.</p>
  <label>Calorie allowance meaning<select name="calorieIntent">${options([['target','Aim for this amount (approximate target)'],['ceiling','Ceiling — unused calories do not require more food']],p.calorieIntent || 'target')}</select></label>
  <details class="editor-group"><summary>Reviewed mixed feeding combination</summary><p>Only record a review actually given by Teddy’s clinician or nutritionist. Select the exact foods covered, including any supplement. This records your information; the app does not verify clinical approval.</p><label>Reviewer and conditions<textarea name="mixedReviewNote">${esc(p.mixedReview?.note || '')}</textarea></label>${state.foods.map(f=>`<label class="checkbox"><input type="checkbox" name="reviewedFoods" value="${attr(f.id)}" ${p.mixedReview?.foodIds.includes(f.id)?'checked':''}>${esc(f.name)}</label>`).join('')}</details>
  <details class="editor-group" open><summary>Activity adjustments · kcal</summary><p class="muted">Added to the baseline. Defaults are −24 / 0 / +24 kcal: 216 / 240 / 264 kcal. Edit these personal presets as needed.</p><div class="form-grid three">${['quiet','normal','active'].map(k=>numeric(`${k[0].toUpperCase()+k.slice(1)} day`,k,p.activity[k],'required')).join('')}</div></details>
  <details class="editor-group" open><summary>Daily planning priorities</summary><p class="muted">Give these nutrients extra weight in meal selection. All configured lower references remain part of the evaluation; every hard upper limit remains enforced. Only material findings are highlighted.</p><div class="food-checks">${NUTRIENTS.filter(n=>!['energy','water'].includes(n.id)).map(n=>`<label class="checkbox"><input type="checkbox" name="planningNutrients" value="${n.id}" ${(p.planningNutrients || Object.keys(p.targets)).includes(n.id)?'checked':''}>${esc(n.name)}</label>`).join('')}</div></details>
  ${p.recipeTargets?`<p class="notice">The original recipe composition is retained separately. Its fat upper estimate is ${format(p.recipeTargets.fat.max)} g/day. A 25% wider starting preference is ${format(p.recipeTargets.fat.max*1.25)} g/day; this is an app tolerance, not a researched safe ceiling. Edit the fat upper and its meaning below.</p>`:''}
  <p class="notice">Daily targets stay fixed when activity changes. Per-1,000-kcal targets scale with that day’s calorie allowance. Reference ranges guide comparison and ranking; limits impose bounds on suggestions. Blank means no target. Recipe ranges do not establish clinical safe limits.</p>
  ${groups.map(group=>`<details class="editor-group" ${group==='Macros'?'open':''}><summary>${group}</summary><div class="target-head"><span>Nutrient</span><span>Lower</span><span>Upper</span><span>Meaning</span></div>${NUTRIENTS.filter(n=>n.group===group&&!['energy','water'].includes(n.id)).map(n=>{const t=p.targets[n.id];return `<div class="target-row"><span>${esc(n.name)}<small>${n.unit}</small></span><input aria-label="${esc(n.name)} minimum" name="${n.id}-min" inputmode="decimal" value="${attr(t?.min)}"><input aria-label="${esc(n.name)} maximum" name="${n.id}-max" inputmode="decimal" value="${attr(t?.max)}"><select aria-label="${esc(n.name)} target basis" name="${n.id}-basis">${options([['day:limit','Daily limits'],['per1000:limit','Limits / 1,000 kcal'],['day:reference','Daily reference'],['per1000:reference','Ref. / 1,000 kcal']],`${t?.basis||'day'}:${t?.kind||'limit'}`)}</select><label class="upper-basis">Upper basis<select aria-label="${esc(n.name)} upper basis" name="${n.id}-maxBasis">${options([['same','Same as lower'],['day','Per day'],['per1000','Per 1,000 kcal']],t?.maxBasis||'same')}</select></label></div>`;}).join('')}</details>`).join('')}
  <div class="form-grid">${numeric('Ca:P ratio minimum','ratio-min',p.calciumPhosphorus.min)}${numeric('Ca:P ratio maximum','ratio-max',p.calciumPhosphorus.max)}</div>
  <details class="editor-group" open><summary>Foods eligible for portion suggestions</summary><p class="muted">Select foods suitable for this plan. This is your selection, not an automatic veterinary approval.</p>${state.foods.map(f=>`<label class="checkbox"><input type="checkbox" name="allowedFoods" value="${attr(f.id)}" ${p.allowedFoods.includes(f.id)?'checked':''}>${esc(f.name)}</label>`).join('')}</details>
  <details class="editor-group"><summary>Nutrients to watch closely</summary><div class="food-checks">${NUTRIENTS.filter(n=>!['energy','water'].includes(n.id)).map(n=>`<label class="checkbox"><input type="checkbox" name="watchNutrients" value="${n.id}" ${(p.watchNutrients || DEFAULT_WATCH).includes(n.id)?'checked':''}>${esc(n.name)}</label>`).join('')}</div></details><label>Daily recipe reference<textarea name="recipe" rows="12">${esc(p.recipe || '')}</textarea></label><p class="muted">Recipe quantities are a reference. They are not automatically logged or converted into nutrient targets.</p>
  <label>Calculation notes<textarea name="referenceInfo" rows="5">${esc(p.referenceInfo || '')}</textarea></label>${field('Source / reference URL','source',p.source)}<label>Plan notes / paste nutritionist recommendations<textarea name="notes" rows="5">${esc(p.notes)}</textarea></label>
  <label>Clinical limits, assumptions or unresolved questions<textarea name="clinicalNotes" rows="4">${esc(p.clinicalNotes)}</textarea></label><p class="muted">Pasted text is saved as notes. Enter its numeric targets above. Saving creates a new version; existing diary days keep their current version.</p>${formFooter('Save plan version')}</form>`);
}
function viewFood(id) {
  const f = state.foods.find(f=>f.id===id);
  openDialog(f.name, `<p class="muted">Per 100 g as eaten. Estimates supplement published composition. Expand “Estimate details” for the source, assumptions and confidence. A modeled zero means assumed negligible, not a measured absence. Original source notes may describe gaps now filled by these estimates.</p>
    ${groups.map(group=>`<details class="nutrient-group" ${group==='Macros'?'open':''}><summary>${esc(group)}</summary><table>${NUTRIENTS.filter(n=>n.group===group).map(n=>`<tr><td>${esc(n.name)}</td><td>${f.nutrients[n.id] == null ? 'Unknown' : format(f.nutrients[n.id],f.nutrients[n.id] && f.nutrients[n.id]<.01?5:2)} ${n.unit}${f.estimatedNutrients?.includes(n.id)?'<small>estimated</small>':''}${f.estimates?.[n.id]?`<details class="estimate-details"><summary>Estimate details</summary><p>${esc(f.estimates[n.id].confidence)} confidence · ${esc(f.estimates[n.id].method)}</p>${sourceLink(f.estimates[n.id].source)}</details>`:''}${f.partialNutrients?.includes(n.id)?'<small>added amount only · incomplete total</small>':''}</td></tr>`).join('')}</table></details>`).join('')}
    <p class="note-text">${esc(f.notes)}</p>${sourceLink(f.source)}${(f.additionalSources||[]).map(source=>`<p>${sourceLink(source)}</p>`).join('')}<div class="card-actions">${button('Close','close','','secondary')}</div>`);
}
function viewGuidance() {
  const day=getDay(),calories=caloriesFor(day),weight=day.profile.referenceWeight,targets=adultTargets(weight);
  openDialog('Research for all 49 nutrients',`<p>General adult comparison for <strong>${format(weight)} kg / ${format(calories)} kcal</strong>. Recommended lower levels are not daily deficiency cutoffs. No established upper does not mean unlimited intake is safe.</p>
  <p class="muted">FEDIAF 2025: body-weight allowances (table VII-11), energy-based fat minimum and nutritional maxima (III-3b). These are general diet references, not Teddy’s therapeutic prescription. The nutritionist’s 240 kcal baseline is retained. Micronutrient adequacy concerns the habitual diet; a single day does not diagnose deficiency.</p>
  ${sourceLink(GUIDANCE_SOURCE)} · ${sourceLink(MERCK_NUTRITION)}
  <div class="table-wrap"><table><thead><tr><th>Nutrient</th><th>Recommended lower / day</th><th>General upper / day</th><th>Interpretation</th></tr></thead><tbody>${NUTRIENTS.map(n=>{const t=targets[n.id]?targetFor(targets[n.id],calories):{};return `<tr><th>${esc(n.name)} · ${n.unit}</th><td>${n.id==='energy'?`${format(calories)} allowance`:t.min==null?'Not specified':format(t.min,t.min<.1?3:2)}</td><td>${t.max==null?'Not established in FEDIAF':format(t.max)}</td><td>${esc(guidanceNotes[n.id])}${productMaxDM[n.id]!=null?`<p>2025 FEDIAF product legal reference: ${format(productMaxDM[n.id])} ${n.unit}/100 g dry matter. This is not a safe daily intake or an instruction to feed up to it.</p>`:''}</td></tr>`;}).join('')}</tbody></table></div>
  <p>Adult calcium : phosphorus reference: 1:1–2:1. Food moisture excludes drinking water. Changing weight here does not rewrite saved plans; these calculations show the selected plan’s reference weight.</p>${button('Close','close','','secondary')}`);
}
function viewReference(p) {
  openDialog(p.name, `<p class="note-text">${esc(p.referenceInfo || p.clinicalNotes)}</p>${sourceLink(p.source)}
    <p><a href="https://fdc.nal.usda.gov/download-datasets/" target="_blank" rel="noopener noreferrer">USDA food composition</a> · <a href="${SOURCE_URL}" target="_blank" rel="noopener noreferrer">FEDIAF unit conversions</a></p>
    ${p.recipeTargets?`<details><summary>Original recipe nutrient composition</summary><p>These narrow bands describe recipe alternatives, not requirements or safe ranges.</p><table>${Object.entries(p.recipeTargets).map(([id,t])=>`<tr><td>${esc(byId[id].name)}</td><td>${rangeText(t,p.calories)} ${byId[id].unit}</td></tr>`).join('')}</table></details>`:''}<details><summary>Original recipe basis</summary><p class="note-text">${esc(p.recipe)}</p><p class="note-text">${esc(p.notes)}</p></details>${button('Close','close','','secondary')}`);
}
function recipesView() {
  openDialog('Saved recipes',`<p>Optional prepared meals. These do not change your nutrition profile or log any food.</p>${(state.recipes || []).map(r=>`<article class="saved-recipe"><h3>${esc(r.name)}</h3><p>${r.components.length} fixed components · ${r.yieldGrams==null?'Final cooked yield not measured':`${format(r.yieldGrams)} g cooked mixture, excluding fresh additions`}</p><div class="card-actions">${button('Plan a portion','plan-recipe',r.id,'primary')}${button('Edit batch','edit-recipe',r.id,'secondary')}</div></article>`).join('')}${button('+ Save a recipe','edit-recipe','','secondary')}`);
}
function editRecipe(id) {
  const r=state.recipes?.find(r=>r.id===id) || {id:uid(),revision:0,name:'',yieldGrams:null,notes:'',components:[]};
  const foods=[...state.foods,...r.components.map(c=>c.food).filter(f=>!state.foods.some(x=>x.id===f.id))];
  openDialog('Recipe and prepared batch',`<form id="recipe-form" data-id="${attr(r.id)}">${field('Recipe / batch name','name',r.name,'text','required')}${numeric('Final cooked mixture yield (g) · excludes fresh additions','yieldGrams',r.yieldGrams)}<p class="muted">Enter the total cooked ingredient amounts for this batch. Yield is the weighed finished mixture, including added water if present. Leave yield blank to use recipe fractions. Each fresh addition is the amount for the entire batch; it will scale with a portion. Do not heat Optimix.</p><div class="recipe-components">${foods.map(f=>{const c=r.components.find(c=>c.food.id===f.id);return `<div class="recipe-component"><label>${esc(c?.food.name || f.name)}<input name="grams-${attr(f.id)}" aria-label="Batch grams for ${attr(c?.food.name || f.name)}" inputmode="decimal" value="${attr(c?.grams)}" placeholder="Not included"></label><label class="checkbox"><input type="checkbox" name="fresh-${attr(f.id)}" ${(c?c.fresh:f.role==='supplement') || f.id==='seed-optimix'?'checked':''} ${f.id==='seed-optimix'?'disabled':''}>Add fresh to cooled portion</label></div>`;}).join('')}</div><label>Recipe notes<textarea name="notes">${esc(r.notes)}</textarea></label><p class="muted">Saved components retain their composition snapshots. Editing batch amounts is an explicit recipe change; existing plans and eaten portions stay unchanged.</p>${formFooter('Save recipe / batch')}</form>`);
}
function planRecipeDialog(id) {
  const r=state.recipes.find(r=>r.id===id);
  openDialog(`Plan ${r.name}`,`<form id="recipe-portion-form" data-id="${attr(id)}"><label>Portion measure<select name="measure">${options([['fraction','Fraction of recipe / batch'],...(r.yieldGrams?[['grams','Grams of prepared mixture']]:[])],'fraction')}</select></label>${numeric('Amount to plan','amount',1,'required')}<p class="muted">1 fraction means the entire recipe or batch; 0.5 means half. Gram portions require a measured final yield. Fresh additions scale with the same fraction.</p><details><summary>Fixed recipe components</summary><p>Deselect only to show an intentionally incomplete plan. The forecast will flag the missing component.</p>${r.components.map(c=>`<label class="checkbox"><input type="checkbox" name="include" value="${attr(c.id)}" checked>${format(c.grams)} g ${esc(c.food.name)}${c.fresh?' · add fresh':''}</label>`).join('')}</details>${formFooter('Add to planned meals')}</form>`);
}
function eatPlannedDialog(id) {
  const p=getDay().planned.find(p=>p.id===id);
  openDialog('Log eaten portion',`<form id="eat-planned-form" data-id="${attr(id)}"><p>${esc(p.name)}${p.portionGrams!=null?` · ${format(p.portionGrams)} g mixture still planned`:''}</p><label>Measure<select name="measure">${options([['percent','Percent of the planned portion'],...(p.portionGrams?[['grams','Grams of planned mixture']]:[])],'percent')}</select></label>${numeric('Amount eaten','amount',100,'required')}<p class="muted">All fixed components, including fresh additions, move proportionally from planned to eaten. Record only the fraction actually fed with those components.</p>${formFooter('Log eaten portion')}</form>`);
}
function viewPlanned() {
  const day=getDay(),o=projectOption(day);
  openDialog((day.planned || []).length?'Eaten + planned day':'Eaten food review',`<p>${format(o.projected.total.energy.value,1)} / ${format(o.projected.calories)} kcal. Planned food has not been logged as eaten.</p>${findingsView(o.findings)}${evidenceSummary(o,true)}${nutrientRows(day,o.projected,audit(day))}`);
}
function logFood(foodId = '', entryId = '', planned=false) {
  const entry = getDay().entries.find(e=>e.id===entryId);
  if (!state.foods.length && !entry) { notify('Add a food first.'); return; }
  const f = entry?.food || state.foods.find(f=>f.id===foodId) || state.foods[0];
  const latest = entry && state.foods.find(f=>f.id===entry.food.id);
  const updated = latest && JSON.stringify(latest) !== JSON.stringify(entry.food);
  openDialog(entry ? 'Edit logged portion' : planned?'Plan a portion':'Log a portion', `<form id="log-form" data-planned="${planned}" data-entry="${attr(entryId)}">${entry ? `<p><strong>${esc(entry.food.name)}</strong></p><p class="muted">Uses this entry’s saved nutrition and piece weights.</p>` : `<label>Food<select name="foodId">${options(state.foods.map(f=>[f.id,f.name]),f.id)}</select></label>`}
  <div id="portion-controls"></div><p class="muted">Use edible weight: remove shells, fruit stones and cores. A decimal comma is accepted.</p>
  ${updated ? `<p class="notice">The library has updated information for this food. You can apply it to this entry while keeping the saved gram weight.</p>${button('Use current library nutrition','refresh-entry',entry.id,'secondary')}` : ''}
  ${entry?button('Delete this entry','delete-entry',entry.id,'danger text-button'):''}${formFooter(entry?'Save portion':planned?'Plan food':'Log food')}</form>`);
  updatePortionControls(f, entry);
}
function logFormFood() {
  const form = document.querySelector('#log-form');
  return getDay().entries.find(e=>e.id===form.dataset.entry)?.food || state.foods.find(f=>f.id===form.elements.foodId.value);
}
function updatePortionControls(food, entry) {
  const selected = entry?.portion?.unit || (entry || food.role==='supplement' ? 'g' : food.units?.[0]?.label || 'g');
  document.querySelector('#portion-controls').innerHTML = `<div class="form-grid"><label>Measure<select name="unit">${options([['g','Grams (g)'],...(food.units||[]).map(u=>[u.label,`${u.label} (≈ ${format(u.grams)} g)`])],selected)}</select></label><label><span id="amount-label">${selected==='g'?'Grams actually eaten':'Amount eaten'}</span><input name="amount" inputmode="decimal" required value="${attr(entry?.portion?.amount ?? entry?.grams ?? '')}"></label></div><p class="muted" id="portion-preview"></p>${food.maxDailyEnergyFraction == null ? '' : `<p class="notice">Portion suggestions limit this food to ${format(food.maxDailyEnergyFraction*100)}% of today’s calories (${format(caloriesFor(getDay())*food.maxDailyEnergyFraction,1)} kcal), including what is already logged. Foods marked as fruit, vegetables or treats also share the daily extras allowance in Portion options. Logging records what was actually eaten.</p>`}`;
  updatePortionPreview();
}
function updatePortionPreview() {
  const form = document.querySelector('#log-form'); if (!form) return;
  const food = logFormFood(), unit = form.elements.unit.value;
  document.querySelector('#amount-label').textContent = form.dataset.planned==='true'?(unit==='g'?'Grams planned':'Amount planned'):(unit==='g'?'Grams actually eaten':'Amount eaten');
  const conversion = unit==='g' ? '' : `1 ${unit} ≈ ${format(food.units.find(u=>u.label===unit).grams)} g. Piece weights are editable in Foods. `;
  let portion = '';
  try { const grams = portionGrams(food, number(form.elements.amount.value), unit); portion = `${format(grams,2)} g will be ${form.dataset.planned==='true'?'planned':'logged'}.${food.nutrients.energy == null ? '' : ` ≈ ${format(grams*food.nutrients.energy/100,2)} kcal.`}`; } catch {}
  document.querySelector('#portion-preview').textContent = conversion + portion;
}
function dayDetails() {
  const d = getDay();
  openDialog('Daily details', `<form id="day-form">${numeric('Additional calorie adjustment for this day','adjustment',d.adjustment)}<label>Notes<textarea name="note" rows="4">${esc(d.note)}</textarea></label>${formFooter('Save day')}</form>`);
}
function availableFoods() {
  const day=getDay(), selected=day.availableFoods || [], settings=portionSettingsFor(day);
  const usable=state.foods.filter(f=>day.profile.allowedFoods.includes(f.id) && f.role!=='supplement' && f.nutrients.energy>0 && f.quality!=='bounds');
  // Foods fed or chosen on recent days come first, so a usual day needs no scrolling.
  const since=dateKey(new Date(Date.now()-30*864e5)),uses=new Map();
  for(const [date,d] of Object.entries(state.days))if(date>=since && date!==selectedDate)
    new Set([...d.entries,...(d.planned||[]).flatMap(p=>p.items)].map(e=>e.food.id).concat(d.availableFoods||[])).forEach(id=>uses.set(id,(uses.get(id)||0)+1));
  const rank=f=>selected.includes(f.id)?2:uses.has(f.id)?1:0;
  const eligible=[...usable].sort((a,b)=>rank(b)-rank(a) || (uses.get(b.id)||0)-(uses.get(a.id)||0));
  const heading=(f,i)=>{const r=rank(f);if(i>0 && rank(eligible[i-1])===r)return '';return r===2?'':`<p class="list-label">${r===1?'Recently used':'All foods'}</p>`;};
  openDialog('Available ingredients', `<form id="available-form"><p class="muted">Pick 1–5 foods you have. Gram limits count food already eaten or planned today.</p><p id="selection-count" role="status"></p><input id="available-search" type="search" placeholder="Find a food…" aria-label="Find a food" autocomplete="off">
    <div class="available-list" role="group" aria-label="Choose available ingredients"><details class="portion-settings"><summary>Mix preference & shared limits</summary>
    <label>Mix preference<select name="preferAll">${options([['true','Prefer more ingredient variety of selected foods'],['false','Prioritize closest nutrient fit']],String(settings.preferAll))}</select></label>
    ${numeric('All fruit · maximum grams today','fruitMaxGrams',settings.fruitMaxGrams)}${numeric('Fruit, vegetables & treats · maximum % of daily calories','extrasPercent',settings.extrasPercent)}
    <p class="muted">Editable planning preferences, not medical ceilings. Defaults: fruit 20 g/day; fruit, vegetables and treats share 10% of calories. Home-prepared main ingredients are not in this extras group.</p></details>
    ${eligible.map((f,i)=>{const bounds=portionBounds(day,f), logged=planningEntries(day).filter(e=>e.food.id===f.id).reduce((s,e)=>s+e.grams,0);return `${heading(f,i)}<div class="available-food" data-name="${attr(f.name.toLowerCase())}"><label class="checkbox"><input type="checkbox" name="availableFoods" value="${attr(f.id)}" ${selected.includes(f.id)?'checked':''}>${esc(f.name)}</label><div class="available-bounds" ${selected.includes(f.id)?'':'hidden'}><small>${format(logged,1)} g eaten + planned today</small><div class="form-grid">
    <label>Minimum to give (g)<input name="min-${attr(f.id)}" aria-label="Minimum grams for ${attr(f.name)}" inputmode="decimal" placeholder="${bounds.dailyMinGrams?`Usual ${attr(format(bounds.dailyMinGrams,1))} g/day in total`:'None'}" value="${attr(bounds.minGrams||'')}"></label>
    <label>Maximum today (g)<input name="max-${attr(f.id)}" aria-label="Maximum daily grams for ${attr(f.name)}" inputmode="decimal" placeholder="No gram limit" value="${attr(bounds.maxGrams)}"></label></div></div></div>`;}).join('')}</div>
    ${eligible.length<1?'<p class="notice">Enable at least one food with calorie data in this plan first.</p>':''}${formFooter('Calculate portions')}</form>`);
  updateAvailableCount();
}
function updateAvailableCount() {
  const form = document.querySelector('#available-form'); if (!form) return;
  const boxes = [...form.querySelectorAll('[name=availableFoods]')], count = boxes.filter(b=>b.checked).length;
  form.querySelector('#selection-count').textContent = `${count} of 5 selected${count < 1 ? ' · choose at least 1' : ''}`;
  boxes.forEach(b=>{b.disabled=!b.checked && count>=5;b.closest('.available-food').querySelector('.available-bounds').hidden=!b.checked;});
  form.querySelector('[type=submit]').disabled = count < 1 || count > 5;
}
function download(data, filename) {
  const blob = new Blob([typeof data === 'string' ? data : JSON.stringify(data,null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href=url; a.download=filename; a.click(); setTimeout(()=>URL.revokeObjectURL(url),1000);
}
async function importFile() {
  const picker = document.createElement('input'); picker.type='file'; picker.accept='.json,application/json';
  picker.addEventListener('change', async () => {
    try {
      const file = picker.files[0]; if (!file) return;
      if (file.size > 15_000_000) throw new Error('Backup is too large (15 MB maximum).');
      const data = JSON.parse(await file.text());
      if (data.type === 'teddy-profile') {
        validateProfile(data.profile);
        const p=clone(data.profile); p.id=uid(); p.revision=1;
        p.allowedFoods=p.allowedFoods.filter(id=>state.foods.some(f=>f.id===id));
        await change(s=>s.profiles.push(p),'Plan imported. Review its selected foods.');
      } else {
        const restored = migrateState(data);
        openDialog('Restore this backup?',`<p>${restored.profiles.length} plans · ${restored.foods.length} foods · ${Object.keys(restored.days).length} diary days</p><p>This replaces the data on this device. A recovery copy of the current diary is kept before replacement. Export a separate backup for safekeeping.</p><div class="card-actions">${button('Export current data','export','','secondary')}${button('Restore backup','restore-confirm','','primary')}</div>`);
        modal.pendingRestore=restored;
      }
    } catch(error) { notify(`Import failed: ${error.message}`); }
  }); picker.click();
}
document.addEventListener('click', async event => {
  const el=event.target.closest('[data-action]'); if(!el)return;
  event.preventDefault();if(saving){notify('Saving the diary…');return;}const {action,id}=el.dataset;
  if (!modal.open) syncDate();
  try {
    if(action==='close') modal.close();
    else if(action==='tab') {tab=id;document.querySelector('#toast').classList.remove('visible');if(id==='today'){selectedDate=dateKey();followToday=true;}render();window.scrollTo(0,0);}
    else if(action==='activity') await change(s=>{ensureDay(s).activity=id;});
    else if(action==='view-food') viewFood(id);
    else if(action==='view-projection') viewProjection(Number(id));
    else if(action==='view-recipe') viewReference(state.profiles.find(p=>p.id===id));
    else if(action==='view-day-recipe') viewReference(getDay().profile);
    else if(action==='edit-food') editFood(id);
    else if(action==='edit-plan') editPlan(id);
    else if(action==='recipes')recipesView();
    else if(action==='edit-recipe')editRecipe(id);
    else if(action==='plan-recipe')planRecipeDialog(id);
    else if(action==='eat-planned')eatPlannedDialog(id);
    else if(action==='view-planned')viewPlanned();
    else if(action==='remove-planned')await change(s=>{const d=ensureDay(s);d.planned=d.planned.filter(p=>p.id!==id);},'Future portion removed; eaten food is unchanged.');
    else if(action==='plan-food')logFood('','',true);
    else if(action==='plan-option'){
      const o=proposalFor(getDay()).options[Number(id)];if(!o)return;
      await change(s=>{(ensureDay(s).planned ||= []).push({id:uid(),name:mealName(o.additions),items:o.additions.map(e=>({id:uid(),food:clone(state.foods.find(f=>f.id===e.food.id)),grams:e.grams,...(e.fresh?{fresh:true}:{})}))});},'Portions planned, not logged as eaten.');
    }
    else if(action==='log-nav') {if(tab!=='today'){tab='today';render();window.scrollTo(0,0);}logFood();}
    else if(action==='log') logFood(id);
    else if(action==='edit-entry') logFood('',id);
    else if(action==='refresh-entry') {
      await change(s=>{const e=ensureDay(s).entries.find(e=>e.id===id), f=s.foods.find(f=>f.id===e.food.id);e.food=clone(f);
        if(e.portion){try{if(portionGrams(f,e.portion.amount,e.portion.unit)!==e.grams)delete e.portion;}catch{delete e.portion;}}
      },'This entry now uses the library nutrition. Its gram weight is unchanged.');modal.close();
    }
    else if(action==='delete-entry') {const deleted={date:selectedDate,entry:clone(getDay().entries.find(e=>e.id===id))};await change(s=>{const d=ensureDay(s);d.entries=d.entries.filter(e=>e.id!==id);},'Entry removed. Undo is available in the diary.');undoEntry=deleted;modal.close();render();}
    else if(action==='undo-entry') {const deleted=undoEntry;if(!deleted)return;await change(s=>{const d=s.days[deleted.date];if(!d || d.entries.some(e=>e.id===deleted.entry.id))throw new Error('Cannot restore this entry. Reload the diary.');d.entries.push(deleted.entry);},'Entry restored.');undoEntry=null;render();}
    else if(action==='day-details') dayDetails();
    else if(action==='available-foods') availableFoods();
    else if(action==='update-day-plan')await change(s=>{const d=ensureDay(s);d.profile=clone(s.profiles.find(p=>p.id===d.profile.id));delete d.activityOffsets;},'This day now uses the latest version of its plan.');
    else if(action==='apply-update') {
      if(document.querySelector('#modal[open]'))return notify('Finish or cancel the open form first.');
      navigator.serviceWorker.addEventListener('controllerchange',()=>location.reload(),{once:true});
      const r=await navigator.serviceWorker.getRegistration();r?.waiting?.postMessage('activate-if-alone');
    }
    else if(action==='choose-plan') {
      const d=getDay();
      openDialog('Choose this day’s plan',`<form id="choose-plan-form"><p>Logged food stays the same. This changes the targets for ${selectedDate}.</p><label>Nutrition plan<select name="profileId">${options(planOptions(d),d.profile.id)}</select></label>${formFooter('Use this plan')}</form>`);
    }
    else if(action==='duplicate-plan') await change(s=>{const p=clone(s.profiles.find(p=>p.id===id));p.id=uid();p.revision=1;p.name=`${p.name} · copy`;s.profiles.push(p);},'Independent copy created.');
    else if(action==='default-plan') await change(s=>{s.activeProfileId=id;},'Default set for new days. Saved days retain their plan.');
    else if(action==='open-day') {selectedDate=id;followToday=false;tab='today';render();}
    else if(action==='export') {const latest=state?await load():null;download(latest?.state || rawBackup,`teddy-backup-${dateKey()}.json`);storageInfo.lastExportAt=await markExport();if(state)render();}
    else if(action==='export-recovery') {const previous=await load(id);download(previous.raw || previous.state,`teddy-before-${id}.json`);}
    else if(action==='resolve-legacy') {
      const latest=await load(),raw=localStorage.getItem(LEGACY_KEY);
      const nextRevision=await commit(latest.state,latest.revision,{legacyRaw:raw});
      state=latest.state;revision=nextRevision;externalChange=false;legacyConflict=false;storageInfo=await load();
      channel?.postMessage({revision});modal.close();render();notify('Current diary retained. The older copy is downloadable in History & backup.');
    }
    else if(action==='view-guidance')viewGuidance();
    else if(action==='reload-diary') {modal.close();location.reload();}
    else if(action==='export-plan') download({type:'teddy-profile',version:1,profile:state.profiles.find(p=>p.id===id)},'teddy-plan.json');
    else if(action==='import') importFile();
    else if(action==='restore-confirm') {await save(modal.pendingRestore,{checkpoint:'restore'});modal.pendingRestore=null;modal.close();render();notify('Backup restored.');}
    else if(action==='weight') openDialog('Log weight',`<form id="weight-form">${field('Date','date',selectedDate,'date','required')}${numeric('Weight (kg)','kg','','required')}${formFooter('Save weight')}</form>`);
  } catch(error) {notify(error.message);}
});
document.addEventListener('input', event=>{if(event.target.matches('#log-form [name=amount]'))updatePortionPreview();});
document.addEventListener('keydown', event=>{if(event.key==='Enter' && event.target.matches('#available-search'))event.preventDefault();});
// Search hides unmatched foods but never a selected one; group labels hide while searching.
document.addEventListener('input', event=>{
  if(!event.target.matches('#available-search'))return;
  const q=event.target.value.trim().toLowerCase(),form=event.target.form;
  form.querySelectorAll('.available-food').forEach(el=>{el.hidden=Boolean(q) && !el.dataset.name.includes(q) && !el.querySelector('[name=availableFoods]').checked;});
  form.querySelectorAll('.list-label').forEach(el=>{el.hidden=Boolean(q);});
});
document.addEventListener('change', async event=>{
  try {
    if(event.target.matches('#available-form [name=availableFoods]')) updateAvailableCount();
    if(event.target.matches('#log-form [name=foodId]')) updatePortionControls(logFormFood());
    if(event.target.matches('#log-form [name=unit]')) updatePortionPreview();
    if(event.target.id==='allow-recipe-additions')await change(s=>{ensureDay(s).allowRecipeAdditions=event.target.checked;});
    if(event.target.id==='diary-date') {if(event.target.value){selectedDate=event.target.value;followToday=selectedDate===dateKey();render();}}
    if(event.target.id==='day-profile'&&event.target.value!==getDay().profile.id) await change(s=>{const d=ensureDay(s);d.profile=clone(s.profiles.find(p=>p.id===event.target.value));delete d.activityOffsets;},'This day now uses the selected plan.');
  }catch(error){notify(error.message);render();}
});
document.addEventListener('input',event=>{
  if(event.target.id==='food-search') document.querySelectorAll('[data-food-name]').forEach(el=>{el.hidden=!el.dataset.foodName.includes(event.target.value.toLowerCase());});
});
document.addEventListener('submit',async event=>{
  const form=event.target;if(!form.closest('#modal'))return;event.preventDefault();
  const fd=new FormData(form), get=name=>String(fd.get(name)??'').trim(), num=name=>number(fd.get(name));
  try {
    if (followToday && selectedDate !== dateKey() && ['log-form','day-form','choose-plan-form','available-form','recipe-portion-form','eat-planned-form'].includes(form.id)) throw new Error('A new day has started. Close this form and choose the diary date before saving.');
    if(form.id==='food-form') {
      const f={...clone(state.foods.find(f=>f.id===form.dataset.id)||{}),id:form.dataset.id,name:get('name'),quality:get('quality'),complete:get('complete')==='true',source:get('source'),notes:get('notes'),nutrients:{}};
      for(const n of NUTRIENTS){const value=num(n.id);if(value!=null)f.nutrients[n.id]=value;}
      const previous = state.foods.find(f=>f.id===form.dataset.id);
      for(const n of NUTRIENTS) if(f.nutrients[n.id] !== previous?.nutrients[n.id]) {
        if(f.estimates)delete f.estimates[n.id];
        if(f.declaredAdditions)delete f.declaredAdditions[n.id];
        for(const key of ['estimatedNutrients','partialNutrients']) if(f[key]) f[key]=f[key].filter(id=>id!==n.id);
      }
      f.units = get('units').split('\n').filter(line=>line.trim()).map(line=>{const parts=line.split('=');if(parts.length!==2)throw new Error('Units use one label = grams per line.');return {label:parts[0].trim(),grams:number(parts[1])};});
      if(get('role')==='supplement')f.role='supplement';else delete f.role;
      f.portionGroup=get('portionGroup');f.suggestionMaxGrams=num('suggestionMaxGrams');f.suggestionDailyMinGrams=num('suggestionDailyMinGrams');
      if(num('maxEnergyPercent') == null)delete f.maxDailyEnergyFraction;else f.maxDailyEnergyFraction=num('maxEnergyPercent')/100;
      validateFood(f);await change(s=>{const i=s.foods.findIndex(f=>f.id===form.dataset.id);if(i<0)s.foods.push(f);else s.foods[i]=f;},'Food saved. Previous entries retain their saved nutrition values.');
    } else if(form.id==='plan-form') {
      const old=state.profiles.find(p=>p.id===form.dataset.id);
      const p={...clone(old||{}),id:form.dataset.id,revision:old?old.revision+1:1,name:get('name'),author:get('author'),status:get('status'),calories:num('calories'),referenceWeight:num('referenceWeight'),
        activity:Object.fromEntries(['quiet','normal','active'].map(k=>[k,num(k)])),targets:{},calciumPhosphorus:{min:num('ratio-min'),max:num('ratio-max')},
        notes:get('notes'),recipe:get('recipe'),referenceInfo:get('referenceInfo'),clinicalNotes:get('clinicalNotes'),source:get('source'),allowedFoods:fd.getAll('allowedFoods'),watchNutrients:fd.getAll('watchNutrients'),planningNutrients:fd.getAll('planningNutrients'),calorieIntent:get('calorieIntent'),optimixDailyGrams:num('optimixDailyGrams'),mixedReview:{note:get('mixedReviewNote'),foodIds:fd.getAll('reviewedFoods')}};
      for(const n of NUTRIENTS.filter(n=>!['energy','water'].includes(n.id))){const min=num(`${n.id}-min`),max=num(`${n.id}-max`);if(min!=null||max!=null){const [basis,kind]=get(`${n.id}-basis`).split(':');p.targets[n.id]={min,max,basis,kind,partial:kind==='reference' && Boolean(old?.targets[n.id]?.partial)};const maxBasis=get(`${n.id}-maxBasis`);if(maxBasis!=='same')p.targets[n.id].maxBasis=maxBasis;const prev=old?.targets[n.id];if(prev && prev.min===min && prev.max===max && prev.basis===basis && (prev.maxBasis||'same')===maxBasis && (prev.kind||'limit')===kind && prev.origin)p.targets[n.id].origin=prev.origin;}}
      validateProfile(p);await change(s=>{const i=s.profiles.findIndex(p=>p.id===form.dataset.id);if(i<0)s.profiles.push(p);else s.profiles[i]=p;},'Plan version saved. Select it on a diary day to apply the new targets.');
    } else if(form.id==='choose-plan-form') {
      // Choosing the day's own plan again applies its latest version, if it was edited since.
      const chosen=state.profiles.find(p=>p.id===get('profileId')),d=getDay();
      if(chosen && (chosen.id!==d.profile.id || chosen.revision!==d.profile.revision))await change(s=>{const d=ensureDay(s);d.profile=clone(s.profiles.find(p=>p.id===get('profileId')));delete d.activityOffsets;},'This day now uses the selected plan.');
    } else if(form.id==='log-form') {
      const food=logFormFood(), time=form.dataset.planned==='true'?null:entryTime(), amount=num('amount'), unit=get('unit'), grams=portionGrams(food,amount,unit), portion={amount,unit};
      await change(s=>{const d=ensureDay(s);if(form.dataset.planned==='true'){(d.planned ||= []).push({id:uid(),name:food.name,items:[{id:uid(),food:clone(food),grams}]});return;}const entry=d.entries.find(e=>e.id===form.dataset.entry);if(entry){entry.grams=grams;entry.portion=portion;}else d.entries.push({id:uid(),grams,portion,time,food:clone(food)});},form.dataset.planned==='true'?'Portion planned, not eaten.':'Portion logged.');
    } else if(form.id==='recipe-form') {
      const old=state.recipes?.find(r=>r.id===form.dataset.id),foods=[...state.foods,...(old?.components || []).map(c=>c.food).filter(f=>!state.foods.some(x=>x.id===f.id))];
      const r={id:form.dataset.id,revision:(old?.revision || 0)+1,name:get('name'),yieldGrams:num('yieldGrams'),notes:get('notes'),components:[]};
      for(const f of foods){const grams=num(`grams-${f.id}`);if(grams==null || grams===0)continue;const previous=old?.components.find(c=>c.food.id===f.id);r.components.push({id:previous?.id || uid(),food:clone(previous?.food || f),grams,fresh:f.id==='seed-optimix' || fd.has(`fresh-${f.id}`)});}
      validateRecipe(r);await change(s=>{s.recipes ||= [];const i=s.recipes.findIndex(x=>x.id===r.id);if(i<0)s.recipes.push(r);else s.recipes[i]=r;},'Recipe saved; existing portions retain their snapshots.');
    } else if(form.id==='recipe-portion-form') {
      const r=state.recipes.find(r=>r.id===form.dataset.id),fraction=get('measure')==='grams'?num('amount')/r.yieldGrams:num('amount'),included=fd.getAll('include');
      const omitted=r.components.filter(c=>!included.includes(c.id));
      if(get('measure')==='grams' && omitted.some(c=>!c.fresh))throw new Error('Omitting a mixed ingredient changes the yield. Use a recipe fraction or save the changed recipe with its measured yield.');
      const planned=planRecipe(r,fraction,omitted.map(c=>c.id));
      await change(s=>{addPlannedMeal(ensureDay(s),planned);},'Recipe portion planned; nothing recorded as eaten.');
    } else if(form.id==='eat-planned-form') {
      const p=getDay().planned.find(p=>p.id===form.dataset.id),fraction=get('measure')==='grams'?num('amount')/p.portionGrams:num('amount')/100;
      const time=entryTime();
      await change(s=>eatPlanned(ensureDay(s),p.id,fraction,time),'Eaten portion logged; the remainder stays planned.');
    } else if(form.id==='available-form') {
      const selected=fd.getAll('availableFoods');
      if(selected.length<1 || selected.length>5)throw new Error('Select 1–5 available ingredients.');
      const bounds={...portionSettingsFor(getDay()).bounds};
      for(const id of selected)bounds[id]={minGrams:num(`min-${id}`)??0,maxGrams:num(`max-${id}`)};
      const portionSettings={preferAll:get('preferAll')==='true',fruitMaxGrams:num('fruitMaxGrams'),extrasPercent:num('extrasPercent'),bounds};
      await change(s=>{const d=ensureDay(s);d.availableFoods=selected;d.portionSettings=portionSettings;});
    } else if(form.id==='day-form') await change(s=>{Object.assign(ensureDay(s),{adjustment:num('adjustment')??0,note:get('note')});},'Daily details saved.');
    else if(form.id==='weight-form') await change(s=>{const w={date:get('date'),kg:num('kg')};s.weights=s.weights.filter(x=>x.date!==w.date);s.weights.push(w);},'Weight saved.');
    modal.close();
    // Results replace the inline pending status; take the user straight to them.
    if(form.id==='available-form')document.querySelector('.portion-options')?.scrollIntoView({block:'start',behavior:'smooth'});
  }catch(error){form.querySelector('.form-error').textContent=error.message;}
});
async function start() {
  try {
    rawBackup=localStorage.getItem(LEGACY_KEY);
    const stored=await load();revision=stored.revision;storageInfo=stored;
    rawBackup=stored.state?JSON.stringify(stored.state):localStorage.getItem(LEGACY_KEY);
    state=stored.state || (rawBackup?JSON.parse(rawBackup):freshState());
    const updated=migrateState(state);
    if(!stored.state || JSON.stringify(updated)!==JSON.stringify(state)) {
      await save(updated,stored.state?{checkpoint:'migration'}:rawBackup?{legacyRaw:rawBackup}:{});
      storageInfo=await load();
      if(rawBackup)notify('Diary updated. The original is available under History & backup. Saved food snapshots are preserved.');
    } else state=updated;
    legacyConflict=await legacyChanged(storageInfo.legacyDigest);externalChange=legacyConflict;render();
  }catch(error){
    state=null;
    app.innerHTML=`<main class="recovery card"><h1>Your diary needs attention</h1><p>Saved data could not be loaded. It has not been overwritten.</p><p>${esc(error.message)}</p><div class="card-actions">${button('Download saved data','export','','primary')}${button('Restore a backup','import','','secondary')}</div></main>`;
  }
}
window.addEventListener('beforeunload',event=>{if(saving){event.preventDefault();event.returnValue='';}});
await start();
window.addEventListener('online',()=>{if(state)render();});window.addEventListener('offline',()=>{if(state)render();});
if('serviceWorker' in navigator)navigator.serviceWorker.register('./sw.js').then(registration=>{
  const check=()=>{updateReady=Boolean(registration.waiting);if(state)render();};check();
  registration.addEventListener('updatefound',()=>registration.installing?.addEventListener('statechange',check));
  navigator.serviceWorker.addEventListener('message',event=>{
    if(event.data?.update==='other-windows')notify(`Close Teddy in the ${event.data.count===1?'other tab or window':`other ${event.data.count} tabs or windows`} first, then tap Update now again.`);
  });
}).catch(()=>notify('Offline setup is unavailable. The app still works while connected.'));
