import { solve } from './vendor/yalps.js';

// Up to five food amounts on integer weighing steps. Nutrient deviations are continuous.
// Targets seek the allowance. Ceilings seek nutrient fit, then the smallest addition.
const solverOptions = { precision:1e-9, maxPivots:2048, maxIterations:2000, timeout:200, tolerance:.0001 };
const usable = result => ['optimal','timedout'].includes(result.status) && Number.isFinite(result.result);
// Foods are weighed in whole grams. Foods counted in small pieces (berries, treats under 5 g),
// and any food with a fractional entered bound, keep 0.1 g so piece weights and exact limits remain reachable.
export const stepTenths = f => f.exactBounds || f.units?.some(u=>u.grams<5) ? 1 : 10;
// Branch and bound can stall or time out without any answer. Retry with more time, then fix the
// food selection from the continuous relaxation and solve that LP. Amounts are later rounded down
// onto the weighing grid, so rounding never adds food beyond a maximum; callers verify the result.
function robustSolve(model, pool) {
  const first=solve(model,solverOptions);
  if(usable(first))return first;
  if(first.status==='infeasible')return first;
  const longer=solve(model,{...solverOptions,timeout:800});
  if(usable(longer))return longer;
  const relaxed=structuredClone(model);delete relaxed.integers;delete relaxed.binaries;
  pool.forEach((_,i)=>{relaxed.variables[`used${i}`][`used${i}`]=1;relaxed.constraints[`used${i}`]={max:1};});
  const guide=solve(relaxed,solverOptions);
  if(!usable(guide))return longer;
  const amount=new Map(guide.variables);
  pool.forEach((f,i)=>{
    // Keep a food the relaxation clearly wants; drop token amounts.
    const keep=(amount.get(`food${i}`)||0)>=-relaxed.variables[`used${i}`][`serving-min${i}`]*.5;
    relaxed.constraints[`used${i}`]=keep?{equal:1}:{equal:0};
  });
  const fixed=solve(relaxed,solverOptions);
  return usable(fixed)?{...fixed,status:'timedout'}:longer;
}
export function optimize({pool, current, checks, remaining, calories, calorieIntent='target', ratio, settings, fruitLogged, extrasLogged}) {
  const ceiling=calorieIntent==='ceiling';
  const model = {direction:'maximize',objective:'energy',constraints:{energy:{max:remaining}},variables:{}};
  const variables = model.variables, constraints = model.constraints;
  const steps=pool.map(stepTenths);
  pool.forEach((f,i)=>{
    const k=`food${i}`, step=steps[i];
    constraints[k]={min:Math.ceil(f.minimum*10/step-1e-8),max:Math.floor(f.maximum*10/step+1e-8)};
    variables[k]={[k]:1,energy:f.nutrients.energy/1000*step,compact:.1*step};
    // Omit a food or propose a serving worth weighing; avoid token 1 g extras.
    // A lower food maximum still allows that smaller amount.
    const serving=f.minimum || Math.min(f.maximum, f.units?.[0]?.grams && ['fruit','treat'].includes(f.portionGroup)?f.units[0].grams:5);
    const used=`used${i}`, minKey=`serving-min${i}`, maxKey=`serving-max${i}`;
    constraints[minKey]={min:0};constraints[maxKey]={max:0};
    variables[k][minKey]=1;variables[k][maxKey]=1;
    variables[used]={[minKey]:-Math.ceil(serving*10/step-1e-8),[maxKey]:-Math.floor(f.maximum*10/step+1e-8)};
  });
  model.binaries=pool.map((_,i)=>`used${i}`);
  // Coefficients are per 0.1 g; each variable counts weighing steps.
  function row(key, bounds, coefficients) {
    constraints[key]=bounds;
    pool.forEach((f,i)=>variables[`food${i}`][key]=coefficients(f)/1000*steps[i]);
  }
  row('fruit',{max:Math.max(0,settings.fruitMaxGrams-fruitLogged)},f=>f.portionGroup==='fruit'?100:0);
  row('extras',{max:Math.max(0,calories*settings.extrasPercent/100-extrasLogged)},f=>['fruit','vegetable','treat'].includes(f.portionGroup)?f.nutrients.energy:0);
  for(const c of checks) if(c.max != null && c.kind !== 'reference') row(`cap-${c.id}`,{max:Math.max(0,c.max-c.value)},f=>f.nutrients[c.id]);
  for(const side of ['min','max']) if(ratio[side] != null) {
    row(`ratio-${side}`,{[side]:ratio[side]*current.phosphorus.value-current.calcium.value},f=>f.nutrients.calcium-ratio[side]*f.nutrients.phosphorus);
  }
  let energy,stageApproximate=false;
  if(!ceiling) {
    energy=robustSolve(model,pool);
    if(!usable(energy) || energy.result<.1) {
      // Every selected food moving the ratio the wrong way means the ratio, not portions, blocks the day.
      const wrongWay=side=>ratio[side]!=null && pool.every(f=>(f.nutrients.calcium-ratio[side]*f.nutrients.phosphorus)*(side==='min'?1:-1)<0);
      if(wrongWay('min') || wrongWay('max'))return {options:[],reason:`The calcium : phosphorus limit (${[ratio.min,ratio.max].map(v=>v??'–').join('–')} : 1) blocks these foods: every selected ingredient has ${wrongWay('min')?'less':'more'} calcium per unit of phosphorus than the limit allows. Add an ingredient that balances the ratio, log the supplement planned for today first, or review the ratio in Plans.`};
      return {options:[],reason:energy.status==='infeasible'?'Portion minimums, maximums or nutrient limits conflict. Adjust the portions or choose different foods.':'These foods cannot add a usable portion within the current limits.'};
    }
    stageApproximate ||= energy.status!=='optimal';
    constraints.energy.min=Math.max(0,energy.result-Math.max(.5,...pool.map((f,i)=>f.nutrients.energy/1000*steps[i])));
  }
  model.integers=pool.map((_,i)=>`food${i}`);
  const feasibleModel=structuredClone(model);
  // Rank assessability before numerical fit. Losing a nutrient value must not
  // make a food more attractive through an apparently cost-free unknown amount.
  let hasMissing=false;
  pool.forEach((f,i)=>{
    const loss=checks.reduce((sum,c)=>sum+(f.nutrients[c.id]==null?2:f.partialNutrients?.includes(c.id)?1:0)+(c.arginineBase!=null && f.nutrients.protein==null?1:0),0);
    variables[`used${i}`].compositionLoss=loss;hasMissing ||= loss>0;
  });
  if(hasMissing) {
    model.objective='compositionLoss';model.direction='minimize';
    const assessable=robustSolve(model,pool);
    if(!usable(assessable))return {options:[],reason:'No assessable combination satisfies these portion limits.'};
    stageApproximate ||= assessable.status!=='optimal';
    constraints.compositionLoss={max:assessable.result+1e-8};
  }
  const weights={'Macros':4,'Fatty acids':1,'Minerals':2,'Trace minerals':1,'Vitamins':1,'Amino acids':1};
  const counts={};for(const c of checks)counts[c.group]=(counts[c.group]||0)+1;
  for(const c of checks) {
    const weight=(weights[c.group]||1)/counts[c.group]*(c.priority?2:1)*(c.reliability??1);
    for(const side of ['min','max']) {
      if(c[side] == null || (side==='max' && c.kind !== 'reference') || (side==='min' && c.min===0))continue;
      const key=`goal-${side}-${c.id}`, scale=Math.max(c.min||c.max||1,.000001);
      row(key,{[side]:((side==='min' && c.arginineBase!=null?c.arginineBase:c[side])-c.value)/scale},f=>(f.nutrients[c.id]||0)/scale);
      const slack=variables[`slack-${key}`]={[key]:side==='min'?1:-1,score:weight};
      // Piecewise arginine lower reference: base AND base + 0.01*(protein - reference).
      if(side==='min' && c.arginineBase!=null){
        const linked=key+'-protein';
        row(linked,{min:(c.arginineBase-.01*c.arginineProteinMin-c.value+.01*current.protein.value)/scale},f=>((f.nutrients.arginine||0)-.01*(f.nutrients.protein||0))/scale);
        slack[linked]=1;
      }
    }
  }
  // Only target mode rewards remaining energy; ceiling mode never spends it for its own sake.
  for(const f of Object.values(variables))f.score ||= 0;
  if(!ceiling)pool.forEach((f,i)=>variables[`food${i}`].score+=f.nutrients.energy/1000*steps[i]*-1e-7);
  model.objective='score';model.direction='minimize';
  const fit=robustSolve(model,pool);
  if(!usable(fit))return {options:[],reason:'No portion on the weighing scale meets these limits. Adjust portion bounds or ingredient selection.'};
  stageApproximate ||= fit.status!=='optimal';
  const options=[];
  if(ceiling) {
    // Preserve the best known fit, then minimize only food to be added. Existing
    // eaten/planned portions are constants and are never reduced by this solve.
    constraints.score={max:fit.result+1e-8};model.objective='energy';
    const least=robustSolve(model,pool);
    if(!usable(least))return {options:[],reason:'Could not verify a smallest additional portion. Keep the intended meals and review the selected foods.'};
    if(least.result<1e-8)return {options:[],noAdditional:true};
    options.push({label:'Smallest addition for nutrient fit',solution:least});
  } else {
    options.push({label:'Closest nutrient fit',solution:fit});
    // Alternatives can lose at most 10% of the best found gap score (floor 0.03).
    constraints.score={max:fit.result+Math.max(.03,Math.abs(fit.result)*.1)};
    const mix=structuredClone(model);
    pool.forEach((f,i)=>{
      const desired=Math.min(f.maximum, f.portionGroup==='fruit'?(f.units?.[0]?.grams||2):f.portionGroup==='vegetable'?5:f.portionGroup==='treat'?(f.units?.[0]?.grams||1):Math.max(1,remaining/pool.length/f.nutrients.energy*10));
      if(desired<=0)return;
      mix.constraints[`include${i}`]={min:0};mix.variables[`food${i}`][`include${i}`]=.1*steps[i];
      (mix.variables.coverage ||= {coverage:1,mix:1})[`include${i}`]=-desired;
    });
    if(mix.variables.coverage) {
      mix.constraints.coverage={max:1};mix.objective='mix';mix.direction='maximize';
      const result=robustSolve(mix,pool);
      if(usable(result))options[settings.preferAll?'unshift':'push']({label:'More ingredient variety',solution:result});
    }
    // Minimax alternative: improve the worst normalized nutrient deviation,
    // within the same total gap budget used for the balanced mixture.
    variables.worst={worst:1};
    for(const [name,coefficients] of Object.entries(variables)) if(name.startsWith('slack-')) {
      const key=`worst-${name}`;constraints[key]={max:0};coefficients[key]=coefficients.score;variables.worst[key]=-1;
    }
    model.objective='worst';
    const even=robustSolve(model,pool);
    if(usable(even))options.push({label:'Smaller nutrient gaps',solution:even});
  }
  const amounts=options.map(({label,solution})=>({label,approximate:stageApproximate || solution.status!=='optimal',
    grams:pool.map((_,i)=>Math.floor((new Map(solution.variables).get(`food${i}`)||0)+1e-6)*steps[i]/10)}));
  // Continuous relaxation provides optimistic bounds. If even that bound
  // misses a target, no allowed weighed combination can reach it. Unknown data
  // never becomes an impossibility claim. At most two LPs per configured row.
  delete feasibleModel.integers;delete feasibleModel.binaries;
  pool.forEach((_,i)=>{feasibleModel.variables[`used${i}`][`used${i}`]=1;feasibleModel.constraints[`used${i}`]={max:1};});
  feasibleModel.objective='bound';
  const unreachable=[];
  for(const c of checks) {
    if(c.missing.length || c.partial || pool.some(f=>f.nutrients[c.id]==null || f.partialNutrients?.includes(c.id)))continue;
    const values=amounts.map(o=>c.value+pool.reduce((sum,f,i)=>sum+o.grams[i]*f.nutrients[c.id]/100,0));
    for(const side of ['min','max']) {
      if(c[side]==null || (side==='max' && c.kind!=='reference'))continue;
      if(!values.some(v=>side==='min'?v<c.min-1e-8:v>c.max+1e-8))continue;
      pool.forEach((f,i)=>feasibleModel.variables[`food${i}`].bound=f.nutrients[c.id]/1000*steps[i]);
      feasibleModel.direction=side==='min'?'maximize':'minimize';
      const result=solve(feasibleModel,solverOptions);
      if(result.status!=='optimal')continue;
      const attainable=c.value+result.result;
      if(side==='min'?attainable<c.min-1e-7:attainable>c.max+1e-7)unreachable.push({id:c.id,side,attainable,required:c[side]});
    }
  }
  return {options:amounts,unreachable,reason:'',maxEnergy:energy?.result};
}
