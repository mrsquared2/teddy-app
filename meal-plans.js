// Optional saved recipes and fixed future portions. This module never optimizes doses.
const copy=value=>structuredClone(value);
const id=()=>crypto.randomUUID();
export function starterRecipes(foods) {
  return [1,2].flatMap(n=>{
    const parts=[['chicken',75],['heart',20],['gizzard',15],['liver',5],['rice',15],['zucchini',15],['blueberry',4.08],['optimix',2],...(n===2?[['egg',15]]:[])];
    if(parts.some(([key])=>!foods.some(f=>f.id===`seed-${key}`)))return [];
    return [{id:`recipe-nutritionist-${n}`,revision:1,name:`Nutritionist recipe ${n} · rice & zucchini`,yieldGrams:null,
      notes:'One supplied variant: rice, zucchini and 3 blueberries; Recipe 2 uses 15 g boiled chicken egg. Ingredients are weighed cooked. Edit explicitly for the supplied alternatives. The 2 g Optimix is fixed for this entire recipe; add freshly to cooled portions, not during cooking. Final batch yield excludes fresh additions.',
      components:parts.map(([key,grams])=>({id:id(),food:copy(foods.find(f=>f.id===`seed-${key}`)),grams,fresh:key==='optimix'}))}];
  });
}
export const plannedEntries=day=>(day.planned || []).flatMap(p=>p.items);
export const planningEntries=day=>[...day.entries,...plannedEntries(day)];
// Day-level intent outlives the uneaten remainder and library edits.
export const usesFixedRecipe=day=>day.fixedRecipeDay===true || (day.planned || []).some(p=>p.recipeId) || day.entries.some(e=>e.recipeId);
export function addPlannedMeal(day,meal) {
  (day.planned ||= []).push(meal);
  if(meal.recipeId)day.fixedRecipeDay=true;
}
export function restoreRecipeInstructions(state) {
  const names=new Map();for(const r of state.recipes || [])names.set(r.name,(names.get(r.name)||0)+1);
  for(const day of Object.values(state.days)) {
    // v0.6.0 retained only meal names/IDs after full consumption. A unique saved
    // name can restore the instruction, but cannot establish a historical revision.
    if(usesFixedRecipe(day) || day.entries.some(e=>e.mealId && names.get(e.mealName)===1))day.fixedRecipeDay=true;
  }
}
export function planRecipe(recipe,fraction=1,omitted=[]) {
  if(!Number.isFinite(fraction) || fraction<=0 || fraction>100)throw new Error('Enter a recipe fraction above zero and at most 100.');
  const items=recipe.components.map(c=>({...copy(c),grams:c.grams*fraction}));
  return {id:id(),name:recipe.name,recipeId:recipe.id,recipeRevision:recipe.revision,
    portionGrams:recipe.yieldGrams==null || items.some(c=>omitted.includes(c.id) && !c.fresh)?null:recipe.yieldGrams*fraction,
    expected:copy(items),items:items.filter(c=>!omitted.includes(c.id))};
}
export function eatPlanned(day,planId,fraction,time) {
  const plan=day.planned?.find(p=>p.id===planId);
  if(!plan || !Number.isFinite(fraction) || fraction<=0 || fraction>1)throw new Error('Choose a portion above zero and at most the planned amount.');
  if(!Number.isFinite(Date.parse(time)))throw new Error('Enter a valid feeding time.');
  if(plan.recipeId)day.fixedRecipeDay=true;
  const entries=plan.items.map(c=>({id:id(),food:copy(c.food),grams:c.grams*fraction,time,mealName:plan.name,mealId:plan.id,...(plan.recipeId?{recipeId:plan.recipeId,recipeRevision:plan.recipeRevision}:{})}));
  day.entries.push(...entries);
  if(fraction===1)day.planned=day.planned.filter(p=>p.id!==planId);
  else {for(const c of [...plan.items,...(plan.expected || [])])c.grams*=1-fraction;if(plan.portionGrams!=null)plan.portionGrams*=1-fraction;}
  return entries;
}
export function omittedComponents(day) {
  return (day.planned || []).flatMap(p=>(p.expected || []).filter(c=>!p.items.some(i=>i.id===c.id)).map(c=>({...c,meal:p.name})));
}
