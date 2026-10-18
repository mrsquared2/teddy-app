import {starterRecipes,planningEntries,usesFixedRecipe,restoreRecipeInstructions} from './meal-plans.js';
import {evidenceFor,feedingFindings} from './feeding-review.js';
import { seedFoods, deriveRecipe, OPTIMIX_SOURCE, portionDefaults } from './food-reference.js';
import { optimize, stepTenths } from './optimizer.js';
import { REVIEW_BASELINE } from './food-review.js';
import {adultTargets,DEFAULT_PRIORITIES} from './nutrient-guidance.js';
export {adultTargets,DEFAULT_PRIORITIES};
export { portionDefaults };

export const SOURCE = 'https://europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025-ONLINE.pdf';
export const NUTRIENTS = [
  ['energy', 'Energy', 'kcal', 'Macros'], ['protein', 'Protein', 'g', 'Macros'],
  ['fat', 'Fat', 'g', 'Macros'], ['carbs', 'Carbohydrate', 'g', 'Macros'],
  ['sugars', 'Sugars', 'g', 'Macros'], ['saturatedFat', 'Saturated fat', 'g', 'Macros'],
  ['fiber', 'Fibre', 'g', 'Macros'], ['water', 'Moisture', 'g', 'Macros'],
  ['linoleic', 'Linoleic acid', 'g', 'Fatty acids'], ['ala', 'Alpha-linolenic acid', 'g', 'Fatty acids'],
  ['epaDha', 'EPA + DHA', 'g', 'Fatty acids'],
  ['calcium', 'Calcium', 'mg', 'Minerals'], ['phosphorus', 'Phosphorus', 'mg', 'Minerals'],
  ['potassium', 'Potassium', 'mg', 'Minerals'], ['sodium', 'Sodium', 'mg', 'Minerals'],
  ['chloride', 'Chloride', 'mg', 'Minerals'], ['magnesium', 'Magnesium', 'mg', 'Minerals'],
  ['copper', 'Copper', 'mg', 'Trace minerals'], ['iodine', 'Iodine', 'mg', 'Trace minerals'],
  ['iron', 'Iron', 'mg', 'Trace minerals'], ['manganese', 'Manganese', 'mg', 'Trace minerals'],
  ['selenium', 'Selenium', 'µg', 'Trace minerals'], ['zinc', 'Zinc', 'mg', 'Trace minerals'],
  ['vitaminA', 'Vitamin A', 'IU', 'Vitamins'], ['vitaminD', 'Vitamin D', 'IU', 'Vitamins'],
  ['vitaminE', 'Vitamin E', 'IU', 'Vitamins'], ['vitaminC', 'Vitamin C', 'mg', 'Vitamins'],
  ['vitaminK', 'Vitamin K', 'µg', 'Vitamins'], ['b7', 'B7 · biotin', 'µg', 'Vitamins'], ['b1', 'B1 · thiamine', 'mg', 'Vitamins'],
  ['b2', 'B2 · riboflavin', 'mg', 'Vitamins'], ['b5', 'B5 · pantothenic acid', 'mg', 'Vitamins'],
  ['b6', 'B6 · pyridoxine', 'mg', 'Vitamins'], ['b12', 'B12 · cobalamin', 'µg', 'Vitamins'],
  ['b3', 'B3 · niacin', 'mg', 'Vitamins'], ['b9', 'B9 · folate', 'µg', 'Vitamins'],
  ['choline', 'Choline', 'mg', 'Vitamins'],
  ['arginine', 'Arginine', 'g', 'Amino acids'], ['histidine', 'Histidine', 'g', 'Amino acids'],
  ['isoleucine', 'Isoleucine', 'g', 'Amino acids'], ['leucine', 'Leucine', 'g', 'Amino acids'],
  ['lysine', 'Lysine', 'g', 'Amino acids'], ['methionine', 'Methionine', 'g', 'Amino acids'],
  ['methionineCystine', 'Methionine + cystine', 'g', 'Amino acids'],
  ['phenylalanine', 'Phenylalanine', 'g', 'Amino acids'],
  ['phenylalanineTyrosine', 'Phenylalanine + tyrosine', 'g', 'Amino acids'],
  ['threonine', 'Threonine', 'g', 'Amino acids'], ['tryptophan', 'Tryptophan', 'g', 'Amino acids'],
  ['valine', 'Valine', 'g', 'Amino acids']
].map(([id, name, unit, group]) => ({ id, name, unit, group }));
export const byId = Object.fromEntries(NUTRIENTS.map(n => [n.id, n]));
export const DEFAULT_WATCH = ['fat','calcium','phosphorus','magnesium','sodium','vitaminA','vitaminD'];
export function nutrientProgress(day, report, id) {
  const value=report.checks.find(c=>c.id===id) || report.total[id], target=id==='energy'?{min:report.calories,max:report.calories}:day.profile.targets[id];
  const {min=null,max=null}=report.checks.find(c=>c.id===id) || (target?targetFor(target,report.calories):{});
  const reference=target?.kind==='reference';
  let tone='neutral', label='Informational · no reference set';
  if(max!=null && value.value>max+1e-8) {tone=reference?'reference-high':'over';label=reference?'Above planning range':'Above maximum';}
  else if(value.missing.length) {tone='unknown';label='Incomplete data';}
  else if(min!=null && value.value<min-1e-8) {tone='below';label=reference?'Below planning range':'Below recommended minimum';}
  else if(min!=null || max!=null) {tone='within';label=reference?'Within planning range':min!=null?'Lower reference met':'Within maximum';}
  if((tone==='below' && min>0 && value.value>=min*.95) || (tone==='reference-high' && max>0 && value.value<=max*1.05)){tone='near';label='Near reference · within 5%';}
  const base=min>0?min:max>0?max:null, percent=base?value.value/base*100:null;
  const scale=Math.max(value.value,min||0,max||0,1e-9)*1.1;
  return {tone,label,percent,min,max,reference,scale,fill:value.value/scale*100,
    minMarker:min==null?null:min/scale*100,maxMarker:max==null?null:max/scale*100};
}
export const uid = () => crypto.randomUUID();
export const clone = value => structuredClone(value);
export function dateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function number(value) {
  if (typeof value === 'number') return value;
  if (!String(value ?? '').trim()) return null;
  return Number(String(value).trim().replace(',', '.'));
}
export function format(value, decimals = 2) {
  return Number.isFinite(value) ? new Intl.NumberFormat('en', { maximumFractionDigits: decimals }).format(value) : '—';
}

// Frozen previous defaults for matching untouched migrated targets only.
// FEDIAF 2025, table VII-11 (printed p58): per kg BW^0.75.
// Mineral g converted to mg. Selenium uses the wet/mixed-diet reference.
const legacyMetabolicMin = {
  protein: 4.95, fat: 1.51, linoleic: .36,
  calcium: 140, phosphorus: 110, potassium: 140, sodium: 30, chloride: 40, magnesium: 20,
  copper: .20, iodine: .03, iron: 1, manganese: .16, selenium: 6.4, zinc: 2,
  vitaminA: 167, vitaminD: 15.2, vitaminE: 1, b1: .06, b2: .17, b5: .39,
  b6: .04, b12: .92, b3: .45, b9: 7.10, choline: 45,
  arginine: .14, histidine: .06, isoleucine: .13, leucine: .23, lysine: .12,
  methionine: .11, methionineCystine: .21, phenylalanine: .15, phenylalanineTyrosine: .24,
  threonine: .14, tryptophan: .05, valine: .16
};
export function makeProfile(name = 'New plan') {
  return { id: uid(), revision: 1, name, author: 'Personal', status: 'Draft', calories: 240,
    activity: { quiet: -24, normal: 0, active: 24 }, targets: {}, calciumPhosphorus: { min: null, max: null },
    referenceWeight: 4.8, notes: '', recipe: '', source: '', clinicalNotes: '', allowedFoods: [] };
}
export function researchProfile(weight = 4.8) {
  const p = makeProfile('Research reference');
  p.author = 'FEDIAF reference · assistant proposal';
  p.referenceWeight = weight;
  p.targets=adultTargets(weight);
  p.planningNutrients=[...DEFAULT_PRIORITIES];
  p.guidanceVersion=1;
  p.calciumPhosphorus = { min: 1, max: 2 };
  p.source = SOURCE;
  p.notes = '240 kcal/day supplied by your nutritionist. General adult-maintenance nutrient reference: FEDIAF 2025 table VII-11, each minimum × 4.8 kg^0.75. Daily amounts stay fixed when calories change. This extrapolation is a comparison draft for a dog eating below standard maintenance energy, not a validated therapeutic or weight-loss formulation. Selenium uses the wet/mixed-diet column; dry-only reference is 5.2 µg/kg^0.75. Fat is a general reference minimum, not a gallbladder limit. No carbohydrate, fibre or EPA+DHA goal is invented. FEDIAF adult nutritional maxima for calcium, phosphorus, A and D are encoded by energy density; product legal concentrations are separate reference information. Fat uses 13.75 g/1,000 kcal. Other minima use metabolic body weight. Recipe composition is not a requirement. Changing reference weight here is descriptive; edit amounts or create a fresh reference to recalculate.';
  return p;
}
export function recipeProfile(recipeNumber, estimated = true) {
  if (![1, 2].includes(recipeNumber)) throw new Error('Unknown nutritionist recipe.');
  const withEgg = recipeNumber === 2;
  const p = makeProfile(`Nutritionist Plan ${recipeNumber}`);
  p.author = 'Nutritionist recipes · calculated estimates'; p.status = 'Estimated reference';
  p.recipe = `Daily quantities — mix all ingredients together and divide between Teddy’s usual meals.

• Boiled chicken fillet: 75 g
• Boiled chicken hearts: 20 g
• Boiled chicken gizzards: 15 g
• Boiled chicken liver: 5 g
${withEgg ? '• Boiled chicken egg: 15 g OR 1 boiled quail egg\n' : ''}• Cooked rice OR wheat pasta OR quinoa: 15 g
${withEgg ? '' : '  Optional substitution: reduce the grain portion by 5 g (to 10 g) and add 10 g banana.\n'}• Boiled, blended zucchini OR pumpkin: 15 g
• 3 blueberries OR 2 raspberries
• Vitamin Optimix Cani Cooking supplement: 2 g
• Warm water: 2 tablespoons`;
  p.notes = `Izmantojiet šīs receptes – tās ir liesākas un saudzīgākas žultspūslim.

${recipeNumber}. recepte – Dienas deva - visas sastāvdaļas drīkst sajukt kopā un sadalīt tik ēdienreizēs, cik reizes Tedijs dienā ēd:
• Vārīta vistas fileja: 75 g
• Vārītas vistas sirdis: 20 g
• Vārīti vistas kuņģi: 15 g
• Vārītas vistas aknas: 5 g
${withEgg ? '• Vārīta vistas ola: 15 g (vai 1 vārīta paipalas ola)\n' : ''}• Vārīti rīsi vai kviešu ${withEgg ? 'macaroni' : 'makaroni'} vai kvinoja: 15 g${withEgg ? '' : ' (garaudaugu daudzumu drīkst samazināt par 5g un pievienot klāt 10g banānu).'}
• Vārīts, sablendēts cukini vai ķirbis: 15 g
• ${withEgg ? 'Ogas pēc izvēles: ' : ''}3 mellenes vai 2 avenes
• Piedeva Vitamin Optimix Cani Cooking: 2 g
• Silts ūdens: 2 ēdamkarotes`;
  const derived = deriveRecipe(recipeNumber, estimated);
  for (const [id, range] of Object.entries(derived.ranges)) {
    if (['energy', 'water'].includes(id) || range.max === 0) continue;
    p.targets[id] = { min: Number(range.min.toFixed(6)), max: Number(range.max.toFixed(6)), basis: 'day', kind: 'reference', partial: range.missing.length > 0 };
  }
  p.source = OPTIMIX_SOURCE;
  p.referenceInfo = `Calculated from ${derived.variants} combinations of the supplied alternatives, using USDA cooked-food averages and the manufacturer's 2 g Optimix declaration. Known recipe energy: ${format(derived.ranges.energy.min, 1)}–${format(derived.ranges.energy.max, 1)} kcal, plus undeclared supplement energy. The daily allowance remains 240 kcal; nutrients have not been inflated to force a match. Counts use 1 blueberry = 1.36 g, 1 raspberry = 1.9 g, 1 quail egg = 9 g edible weight. Quail egg uses a disclosed raw-composition proxy for boiled. Recipe variation is not a clinical safe range. Rows marked partial are known subtotals: missing food/supplement contributions are not assumed zero. Vitamin A/E activity follows FEDIAF canine conversions. Log any foods; these recipes define comparison targets only.`;
  p.clinicalNotes = 'Estimated daily nutrient references from your nutritionist’s recipes. These are comparison ranges, not prescribed deficiency thresholds or safe upper limits. Partial references omit unknown contributions. No fixed ingredient list is required.';
  if (estimated) {
    p.referenceInfo = `Calculated from ${derived.variants} combinations of the supplied alternatives. Best-effort recipe energy: ${format(derived.ranges.energy.min,1)}–${format(derived.ranges.energy.max,1)} kcal, including estimated supplement energy. The daily allowance remains 240 kcal; nutrients are not inflated to force a match. Published USDA, CoFID, MEXT and Optimix values are supplemented by documented comparable-food estimates. Counts: blueberry 1.36 g, raspberry 1.9 g, quail egg 9 g edible weight. Optimix undeclared protein/fat and native trace contributions are assumed negligible; dextrose is estimated at 20% of the powder. Recipe variation is not a confidence interval or clinical safe range. View each food’s Nutrients & sources for methods. Log any foods; these recipes define comparison targets only.`;
    p.clinicalNotes = 'Estimated daily nutrient references from your nutritionist’s recipes. These are comparison ranges, not prescribed deficiency thresholds or safe upper limits. Matching estimated numbers does not establish therapeutic suitability. No fixed ingredient list is required.';
  }
  return p;
}
export function nutritionistProfile(recipeNumber,estimated=true) {
  const p=recipeProfile(recipeNumber,estimated);
  p.recipeTargets=clone(p.targets);p.targets=adultTargets(p.referenceWeight);
  p.recipeFatTolerance=25;
  p.targets.fat={...p.targets.fat,max:p.recipeTargets.fat.max*1.25,maxBasis:'day',kind:'reference',origin:'recipe-preference'};
  p.planningNutrients=[...DEFAULT_PRIORITIES];p.guidanceVersion=1;
  p.calciumPhosphorus={min:1,max:2};
  p.clinicalNotes='Adult nutrient guidance is separate from the original recipe composition. Fat has an editable 25% allowance above the recipe upper estimate as a planning preference, not a clinical safe ceiling. All explicit maxima remain enforced. Review the fat ceiling and urinary-diet suitability with the treating nutritionist.';
  return p;
}
export function freshState() {
  const profiles = [researchProfile(), nutritionistProfile(1), nutritionistProfile(2)], foods = seedFoods();
  for (const p of profiles) p.allowedFoods = foods.filter(f => f.nutrients.energy > 0 && f.role !== 'supplement').map(f => f.id);
  return { schemaVersion: 1, recipeInstructionsVersion: 1, referenceRecipesVersion: 2, foodCatalogVersion: 5, foodEstimatesVersion: 1, foodReviewVersion: 1, nutrientGuidanceVersion: 1, planNotesVersion: 1, activityDefaultsVersion: 1,
    activeProfileId: profiles[0].id, profiles, foods, recipes:starterRecipes(foods), days: {}, weights: [] };
}
// Keep saved measured values, portions and edited targets. At the user's request,
// library migrations fill known-food gaps; saved food compositions remain immutable.
export function migrateState(input, today = dateKey()) {
  validateState(input);
  const state = clone(input);
  const matches = (p, template) => Object.entries(template).every(([key, value]) =>
    key === 'id' || (key === 'recipe' && !p.recipe) || JSON.stringify(p[key]) === JSON.stringify(value));
  if (state.referenceRecipesVersion !== 2) {
    const oldNutritionist = makeProfile('Nutritionist plan');
    oldNutritionist.activity = {quiet:0,normal:0,active:0};
    oldNutritionist.author = 'Nutritionist'; oldNutritionist.status = 'Awaiting details';
    oldNutritionist.notes = '240 kcal/day supplied. Paste the remaining recommendations here when available, then enter their targets. No macro or micronutrient values have been assumed.';
    const oldCustom = makeProfile('Custom plan'); oldCustom.activity = {quiet:0,normal:0,active:0};
    const placeholder = state.profiles.find(p => matches(p, oldNutritionist));
    const custom = state.profiles.find(p => matches(p, oldCustom));
    if (custom) state.profiles.splice(state.profiles.indexOf(custom), 1);
    for (const index of [1,2]) {
      const p = nutritionistProfile(index);
      const old = (index === 1 && placeholder) || state.profiles.find(x => x.name === p.name && x.status === 'Recipe reference' && !Object.keys(x.targets).length);
      if (old) { p.id = old.id; p.revision = old.revision + 1; state.profiles[state.profiles.indexOf(old)] = p; }
      else if (state.profiles.length < 100) state.profiles.push(p);
    }
    if (!state.profiles.some(p => p.id === state.activeProfileId)) state.activeProfileId = state.profiles[0].id;
    state.referenceRecipesVersion = 2;
  }
  if ((state.foodCatalogVersion || 0) < 2) {
    const replaceNames = {'Hill’s c/d · exact dry formula needed':'seed-hills-0','Hill’s c/d + Metabolic · exact formula needed':'seed-hills-1','Chicken fillet · boiled, skinless':'seed-chicken','Carrot · specify preparation':'seed-carrot','Quail egg · boiled, shell removed':'seed-quail'};
    for (const food of seedFoods()) {
      const old = state.foods.find(f => f.id === food.id || replaceNames[f.name] === food.id || f.name === food.name);
      if (old) {
        food.id = old.id;
        if (Object.keys(old.nutrients).length) {
          const added = Object.keys(food.nutrients).filter(id => old.nutrients[id] === undefined);
          if (!added.length) continue;
          state.foods[state.foods.indexOf(old)] = { ...food, ...old,
            nutrients: { ...food.nutrients, ...old.nutrients }, quality: 'estimate',
            units: old.units ?? food.units, source: old.source || food.source,
            estimatedNutrients: [...new Set([...(old.estimatedNutrients || []), ...added])],
            partialNutrients: [...new Set([...(old.partialNutrients || []), ...(food.partialNutrients || []).filter(id => added.includes(id))])],
            notes: `${old.notes}\nMissing nutrient fields filled from ${food.source || 'the supplied product label'}; existing values retained. ${food.notes}`.slice(0,20000) };
        } else state.foods[state.foods.indexOf(old)] = food;
      }
      else if (state.foods.length < 100) state.foods.push(food);
    }
    for (const p of state.profiles) if (!p.allowedFoods.length) p.allowedFoods = state.foods.filter(f => f.nutrients.energy > 0 && f.role !== 'supplement').map(f => f.id);
    state.foodCatalogVersion = 2;
  }
  if (!state.activityDefaultsVersion) {
    const allZero = p => Object.values(p.activity).every(n => n === 0);
    const offsets = p => ({quiet:-Math.round(p.calories * .1),normal:0,active:Math.round(p.calories * .1)});
    for (const p of state.profiles) if (allZero(p)) { p.activity = offsets(p); p.revision++; }
    // Today's allowance is explicitly being changed by the user. Past days stay intact.
    const day = state.days[today];
    if (day && allZero(day.profile)) day.activityOffsets = offsets(day.profile);
    state.activityDefaultsVersion = 1;
  }
  if (!state.foodEstimatesVersion) {
    const seeds = seedFoods();
    function fill(food) {
      const template = seeds.find(f=>f.id===food.id || f.name===food.name);
      if (!template || food.quality === 'bounds') return;
      for (const [id,value] of Object.entries(template.nutrients)) {
        const declaredOnly = food.partialNutrients?.includes(id) && food.nutrients[id] === template.declaredAdditions?.[id];
        if (food.nutrients[id] !== undefined && !declaredOnly) continue;
        if (declaredOnly) {
          (food.declaredAdditions ||= {})[id] = food.nutrients[id];
          food.partialNutrients = food.partialNutrients.filter(n=>n!==id);
        }
        food.nutrients[id] = value;
        (food.estimates ||= {})[id] = clone(template.estimates?.[id] || {method:`Reference composition from ${template.name}; saved measurements retained. ${template.notes}`.slice(0,4000),source:template.source,confidence:'medium'});
        food.estimatedNutrients = [...new Set([...(food.estimatedNutrients || []),id])];
        food.quality = 'estimate';
      }
    }
    state.foods.forEach(fill);
    const oldPlans = [recipeProfile(1,false),recipeProfile(2,false)];
    const newPlans = [recipeProfile(1),recipeProfile(2)];
    function upgradeTargets(p) {
      const index = oldPlans.findIndex(old=>old.name===p.name && old.author===p.author);
      if (index < 0) return;
      let changed = false;
      for (const [id,old] of Object.entries(oldPlans[index].targets)) {
        if (JSON.stringify(p.targets[id]) !== JSON.stringify(old)) continue;
        if (JSON.stringify(p.targets[id]) !== JSON.stringify(newPlans[index].targets[id])) {
          p.targets[id] = clone(newPlans[index].targets[id]); changed = true;
        }
      }
      if (changed) {
        p.revision++;
        if (p.referenceInfo === oldPlans[index].referenceInfo) p.referenceInfo = newPlans[index].referenceInfo;
        if (p.clinicalNotes === oldPlans[index].clinicalNotes) p.clinicalNotes = newPlans[index].clinicalNotes;
      }
    }
    state.profiles.forEach(upgradeTargets);
    if (state.days[today]) upgradeTargets(state.days[today].profile);
    state.foodEstimatesVersion = 1;
  }
  const catalogAdditions = {
    3:['cucumber','strawberry','pear','salmon','potato','watermelon','yogurt','specific-treat'],
    4:['cauliflower','broccoli','melon','peach','nectarine'],
    5:['tomato','royal-canin-urinary-treat','nutrafibre']
  };
  for (const version of [3,4,5]) {
    if ((state.foodCatalogVersion || 0) >= version) continue;
    const addedIds = new Set(catalogAdditions[version].map(id=>`seed-${id}`));
    const laterIds = new Set(Object.entries(catalogAdditions).filter(([v])=>Number(v)>=version).flatMap(([,ids])=>ids.map(id=>`seed-${id}`)));
    const seeds = seedFoods(), previous = seeds.filter(f=>!laterIds.has(f.id) && f.role !== 'supplement').map(f=>f.id);
    const newIds = [];
    for (const food of seeds.filter(f=>addedIds.has(f.id))) {
      const old = state.foods.find(f=>f.id===food.id || f.name===food.name);
      if (old) newIds.push(old.id);
      else if (state.foods.length < 100) { state.foods.push(food); newIds.push(food.id); }
    }
    function extendDefault(p) {
      if (p.allowedFoods.length === previous.length && previous.every(id=>p.allowedFoods.includes(id))) {
        p.allowedFoods = [...new Set([...p.allowedFoods,...newIds.filter(id=>state.foods.find(f=>f.id===id)?.role !== 'supplement')])]; p.revision++;
      }
    }
    // Retry this version before later additions if the custom library is full.
    // Keep default eligibility intact until the complete addition fits.
    if (newIds.length !== addedIds.size) break;
    state.profiles.forEach(extendDefault);
    if (state.days[today]) extendDefault(state.days[today].profile);
    state.foodCatalogVersion = version;
  }
  if (!state.foodReviewVersion) {
    const seeds=seedFoods();
    for(const food of state.foods) {
      const previous=REVIEW_BASELINE.foods[food.id], template=seeds.find(f=>f.id===food.id);
      if(!previous || !template || food.quality==='bounds' || food.name!==previous.name || food.source!==previous.source ||
        Object.entries(previous.macros).some(([id,value])=>food.nutrients[id]!==value))continue;
      let changed=false;
      for(const [id,value] of Object.entries(previous.nutrients)) {
        if(food.nutrients[id]!==value)continue;
        food.nutrients[id]=template.nutrients[id];changed=true;
        if(template.declaredAdditions?.[id]!==undefined && (food.declaredAdditions?.[id]===value || food.partialNutrients?.includes(id)))
          (food.declaredAdditions ||= {})[id]=template.declaredAdditions[id];
        if(food.partialNutrients?.includes(id) && !template.partialNutrients?.includes(id))food.partialNutrients=food.partialNutrients.filter(n=>n!==id);
        (food.estimates ||= {})[id]=clone(template.estimates?.[id] || {method:`Reviewed source composition: ${template.notes}`.slice(0,4000),source:template.source,confidence:'medium'});
        food.estimatedNutrients=[...new Set([...(food.estimatedNutrients || []),id])];
      }
      if(changed) {
        if(food.notes===previous.notes)food.notes=template.notes;
        else food.notes=(food.notes+' Reviewed nutrient details supersede earlier estimates for corrected fields.').slice(0,20000);
        food.source=template.source;
        food.additionalSources=[...new Set([...(food.additionalSources || []),...(template.additionalSources || [])])].slice(0,10);
      }
    }
    const templates=[recipeProfile(1),recipeProfile(2)];
    function reviewTargets(profile) {
      const index=REVIEW_BASELINE.profiles.findIndex(p=>p.name===profile.name && p.author===profile.author);
      if(index<0)return;
      let changed=false;
      for(const [id,previous] of Object.entries(REVIEW_BASELINE.profiles[index].targets)) {
        if(JSON.stringify(profile.targets[id])!==JSON.stringify(previous))continue;
        profile.targets[id]=clone(templates[index].targets[id]);changed=true;
      }
      if(changed)profile.revision++;
    }
    state.profiles.forEach(reviewTargets);
    if(state.days[today])reviewTargets(state.days[today].profile);
    state.foodReviewVersion=1;
  }
  if(state.nutrientGuidanceVersion!==1) {
    function upgradeGuidance(p) {
      if(p.guidanceVersion===1)return;
      const index=[1,2].find(i=>p.name===`Nutritionist Plan ${i}` && p.author==='Nutritionist recipes · calculated estimates');
      const research=p.name==='Research reference' && p.author==='FEDIAF reference · assistant proposal';
      if(!index && !research)return;
      const previous=index?recipeProfile(index).targets:Object.fromEntries(Object.entries(legacyMetabolicMin).map(([id,v])=>[id,{min:Number((v*p.referenceWeight**.75).toFixed(4)),max:null,basis:'day'}]));
      const next=index?nutritionistProfile(index):researchProfile(p.referenceWeight);
      // Preserve user edits, including explicit limits and intentionally cleared fields.
      for(const [id,t] of Object.entries(previous))if(JSON.stringify(p.targets[id])===JSON.stringify(t)) {
        if(next.targets[id])p.targets[id]=clone(next.targets[id]);else delete p.targets[id];
      }
      if(index){p.recipeTargets=clone(previous);p.recipeFatTolerance=25;}
      p.planningNutrients=[...DEFAULT_PRIORITIES];p.guidanceVersion=1;p.revision++;
      p.clinicalNotes=next.clinicalNotes;
      if(research)p.notes=next.notes;
      // Existing recipe days did not have ratio limits: do not invent a hard bound
      // in an already selected day. Fresh plans include the general adult ratio.
    }
    state.profiles.forEach(upgradeGuidance);
    if(state.days[today])upgradeGuidance(state.days[today].profile);
    state.nutrientGuidanceVersion=1;
  }
  if(state.planNotesVersion!==1) {
    // The owner removed the starter Research note; edited notes stay.
    const removed='Gallbladder fat ceiling and urinary-specific limits are not established in this draft. Prefer a complete diet compatible with both conditions; do not add supplements to chase the reference values. Meeting these numbers does not establish clinical suitability, bioavailability or a complete safe formulation.';
    for(const p of [...state.profiles,state.days[today]?.profile].filter(Boolean))if(p.clinicalNotes===removed)p.clinicalNotes='';
    state.planNotesVersion=1;
  }
  if(state.recipes===undefined)state.recipes=starterRecipes(state.foods);
  if(state.recipeInstructionsVersion!==1){restoreRecipeInstructions(state);state.recipeInstructionsVersion=1;}
  return validateState(state);
}
export function newDay(profile) {
  return { profile: clone(profile), activity: 'normal', adjustment: 0, note: '', entries: [], planned:[], availableFoods: [] };
}
export function activityFor(day) { return day.activityOffsets || day.profile.activity; }
export function caloriesFor(day) { return day.profile.calories + activityFor(day)[day.activity] + day.adjustment; }
export function portionGrams(food, amount, unit = 'g') {
  if (!(Number.isFinite(amount) && amount > 0)) throw new Error('Enter a positive amount.');
  const grams = unit === 'g' ? amount : amount * food.units?.find(u => u.label === unit)?.grams;
  if (!(grams >= .01 && grams <= 10000)) throw new Error('Invalid unit or portion weight.');
  return Number(grams.toFixed(6));
}
export function targetFor(target, calories) {
  const multiplier = target.basis === 'per1000' ? calories / 1000 : 1;
  return { min: target.min == null ? null : target.min * multiplier, max: target.max == null ? null : target.max * ((target.maxBasis || target.basis) === 'per1000' ? calories / 1000 : 1) };
}
export function totals(entries) {
  const result = Object.fromEntries(NUTRIENTS.map(n => [n.id, { value: 0, missing: [], uncertain: false }]));
  for (const entry of entries) {
    for (const n of NUTRIENTS) {
      const value = entry.food.nutrients[n.id];
      if (value == null) result[n.id].missing.push(entry.food.name);
      else { result[n.id].value += value * entry.grams / 100; if (entry.food.partialNutrients?.includes(n.id)) result[n.id].missing.push(`${entry.food.name} (declared additions only)`); }
      if (value != null && (entry.food.quality !== 'typical' || entry.food.estimatedNutrients?.includes(n.id))) result[n.id].uncertain = true;
    }
  }
  return result;
}
export function audit(day, entries = day.entries) {
  return auditTotals(day, totals(entries));
}
function auditTotals(day, total) {
  const calories = caloriesFor(day);
  const checks = Object.entries(day.profile.targets).map(([id, target]) => {
    const bounds = targetFor(target, calories), amount = {...total[id],missing:[...total[id].missing]};
    if(id==='arginine' && target.origin==='adult-guidance' && bounds.min!=null){
      bounds.min+=.01*Math.max(0,total.protein.value-adultTargets(day.profile.referenceWeight).protein.min);
      if(total.protein.missing.length)amount.missing.push('Protein needed for the arginine reference');
    }
    let state = 'within';
    // A known subtotal exceeding a maximum is still an excess even with missing values.
    if (bounds.max != null && amount.value > bounds.max + 1e-8) state = target.kind === 'reference' ? 'above-reference' : 'over';
    else if (amount.missing.length) state = 'unknown';
    else if (bounds.min != null && amount.value < bounds.min - 1e-8) state = 'below';
    return { id, ...bounds, ...amount, state, origin:target.origin, priority:!day.profile.planningNutrients || day.profile.planningNutrients.includes(id), kind: target.kind || 'limit', partial: Boolean(target.partial) };
  });
  const ca = total.calcium, ph = total.phosphorus, limits = day.profile.calciumPhosphorus;
  let ratio = null, ratioState = 'unset';
  if (limits.min != null || limits.max != null) {
    ratioState = 'unknown';
    if (!ca.missing.length && !ph.missing.length && ph.value > 0) {
      ratio = ca.value / ph.value;
      ratioState = limits.min != null && ratio < limits.min - 1e-8 ? 'below'
        : limits.max != null && ratio > limits.max + 1e-8 ? 'over' : 'within';
    }
  }
  return { total, checks, ratio, ratioState, calories };
}

export function portionSettingsFor(day) {
  return {preferAll:true,fruitMaxGrams:20,extrasPercent:10,bounds:{},...day.portionSettings};
}
export function portionBounds(day, food) {
  const settings=portionSettingsFor(day), own=settings.bounds[food.id] || {}, defaults=portionDefaults(food);
  return {minGrams:own.minGrams || 0,maxGrams:Object.hasOwn(own,'maxGrams') ? own.maxGrams : defaults.maxGrams,dailyMinGrams:defaults.dailyMinGrams};
}
export function compositionEvidence(day,entries) {
  const ids=new Set(['energy',...Object.keys(day.profile.targets)]),ratio=day.profile.calciumPhosphorus;
  if(ratio.min!=null || ratio.max!=null){ids.add('calcium');ids.add('phosphorus');}
  const rows=[...ids].map(id=>{
    const e=evidenceFor(entries,id),hard=(day.profile.targets[id]?.max!=null && day.profile.targets[id]?.kind!=='reference') || (['calcium','phosphorus'].includes(id) && (ratio.min!=null || ratio.max!=null));
    const cap=day.profile.targets[id]?targetFor(day.profile.targets[id],caloriesFor(day)).max:null;
    const closeToCap=hard && cap!=null && e.estimatedShare>0 && Math.abs(cap-e.total)<=e.total*e.estimatedShare;
    const materialUncertainty=e.missing || e.lowShare>=.1 || e.estimatedShare>=.25 || closeToCap || (e.total===0 && e.zeroAssumptions);
    return {id,name:byId[id].name,hard,...e,materialUncertainty};
  });
  return {rows,lowConfidence:rows.filter(r=>r.lowShare>=.1 || (r.total===0 && r.zeroAssumptions)),hardLimitUncertainty:rows.filter(r=>r.hard && r.materialUncertainty),
    status:rows.some(r=>r.missing)?'Incomplete composition':rows.some(r=>r.materialUncertainty)?'Comparison materially relies on estimates':'Comparison mainly uses published values / food averages'};
}
export function projectOption(day, additions=[]) {
  const entries=[...planningEntries(day),...additions],projected=audit(day,entries),evidence=compositionEvidence(day,entries);
  const issues=projected.checks.filter(c=>c.state!=='within' || c.partial).map(c=>{
    const difference=c.state==='below'?c.min-c.value:['over','above-reference'].includes(c.state)?c.value-c.max:0;
    const reference=c.state==='below'?c.min:c.max,relative=reference>0?difference/reference:difference>0?Infinity:0;
    return {...c,difference,relative,near:['below','above-reference'].includes(c.state) && relative<=.05,
      name:byId[c.id].name,unit:byId[c.id].unit};
  }).sort((a,b)=>(b.state==='over')-(a.state==='over') || (b.state==='unknown')-(a.state==='unknown') || b.relative-a.relative);
  const findings=feedingFindings(day,entries,projected,issues,evidence,byId);
  // Full background assessment; point estimates with large proxy shares carry less weight.
  const families={'Macros':4,'Minerals':2},counts={};for(const c of projected.checks)counts[byId[c.id].group]=(counts[byId[c.id].group]||0)+1;
  // Coverage is separate from fit. Missing contributions remain unknown to the
  // audit; known-subtotal gaps still guide the solver and tie-break incomplete fits.
  const extraMissing=evidence.rows.filter(r=>r.missing && !projected.checks.some(c=>c.id===r.id));
  const missingComparisons=projected.checks.filter(c=>c.missing.length || c.partial).map(c=>c.id).concat(extraMissing.map(r=>r.id));
  const loss=projected.checks.reduce((sum,c)=>sum+c.missing.length+Number(c.partial)+entries.filter(e=>e.grams>0 && e.food.nutrients[c.id]==null).length,0)+extraMissing.reduce((sum,r)=>sum+r.sources.filter(s=>s.kind==='missing').length+entries.filter(e=>e.grams>0 && e.food.nutrients[r.id]==null).length,0);
  const coverage={complete:loss===0,missingComparisons,loss};
  const knownSubtotalScore=projected.checks.reduce((sum,c)=>{
    const gap=Math.max(0,(c.min??0)-c.value)+Math.max(0,c.value-(c.max??Infinity));
    const e=evidence.rows.find(r=>r.id===c.id),group=byId[c.id].group;
    return sum+Math.min(gap/Math.max(c.min||c.max||1,.000001),10)*(c.priority?2:1)*(families[group]||1)/counts[group]*(1-.8*(e?.lowShare||0)-.3*Math.max(0,(e?.estimatedShare||0)-(e?.lowShare||0)));
  },0);
  return {projected,issues,evidence,findings,coverage,knownSubtotalScore,score:coverage.complete?knownSubtotalScore:null,energyGap:Math.max(0,projected.calories-projected.total.energy.value)};
}
export function comparePortionOptions(a,b,preferAll=false) {
  return a.findings.filter(f=>f.kind==='compatibility').length-b.findings.filter(f=>f.kind==='compatibility').length
    || a.coverage.loss-b.coverage.loss
    || (Math.abs(a.knownSubtotalScore-b.knownSubtotalScore)>.001?a.knownSubtotalScore-b.knownSubtotalScore:preferAll?(b.additions?.length||0)-(a.additions?.length||0):a.knownSubtotalScore-b.knownSubtotalScore);
}
// Optimix is dosed for home-cooked main food only. Complete diets and supplements need none; fruit,
// vegetables and treats sit inside the shared extras budget. A fully home-cooked day receives the
// plan's full dose; partial days receive the same share.
export const OPTIMIX_ID = 'seed-optimix';
export const optimixDose = profile => profile.optimixDailyGrams ?? 2;
// Smaller doses cannot be weighed reliably on a 0.1 g scale and are left out.
export const OPTIMIX_MIN_GRAMS = .3;
export const needsOptimix = food => !food.complete && food.role !== 'supplement' && portionDefaults(food).group === 'main';
// Constrained goal programming; amounts use the scale's 0.1 g grid.
export function suggestions(day, foods) {
  const committed=planningEntries(day),result=audit(day,committed), remaining=result.calories-result.total.energy.value;
  const empty=reason=>({reason,options:[]});
  if(usesFixedRecipe(day) && !day.allowRecipeAdditions)return empty('This is a fixed recipe day, including portions already eaten. Enable additional foods explicitly if they belong in this feeding plan. Unused calories do not automatically require a top-up.');
  const ceiling=day.profile.calorieIntent==='ceiling';
  const requiredPortion=(day.availableFoods || []).some(id=>portionSettingsFor(day).bounds[id]?.minGrams>0);
  if(ceiling && !committed.length && !Object.values(day.profile.targets).some(t=>t.min>0) && !requiredPortion)return empty('A calorie ceiling does not specify how much to feed. Plan the intended meals; no calorie top-up is proposed.');
  if(ceiling && committed.length && !requiredPortion && !committed.some(e=>e.food.quality==='bounds') && !result.total.energy.missing.length && remaining>=0 && result.checks.every(c=>c.state==='within' && !c.partial) && ['unset','within'].includes(result.ratioState))return {...empty('No additional portion needed for the configured references. Keep the intended meals; unused calories are an allowance, not a feeding requirement.'),noAdditional:true};
  if(!day.profile.allowedFoods.length)return empty('Choose foods for suggestions in this plan.');
  const selected=day.availableFoods || [];
  if(selected.length<1 || selected.length>5 || new Set(selected).size!==selected.length)return empty('Select 1–5 available ingredients to calculate portions.');
  if(selected.some(id=>!day.profile.allowedFoods.includes(id) || !foods.some(f=>f.id===id && f.role!=='supplement')))return empty('Update your available ingredients: some are no longer eligible for this plan.');
  if(result.total.energy.missing.length)return empty('Add calorie values for all eaten and planned foods before calculating portions.');
  if(committed.some(e=>e.food.quality==='bounds'))return empty('Label minimum/maximum values cannot verify portions. Use typical analysis values.');
  // Within 1% after whole-gram rounding, a planned day is complete; a lone berry is not a useful top-up.
  if(remaining<1 || (committed.length && remaining<result.calories*.01))return empty('Today’s calorie allowance is already reached.');
  const caps=result.checks.filter(c=>c.max!=null && c.kind!=='reference');
  if(caps.some(c=>c.state==='over'))return empty('A configured maximum is already exceeded. Adding food cannot undo it.');
  if(caps.some(c=>c.missing.length))return empty('Some eaten or planned foods lack values needed to check this plan’s maximum limits.');
  const ratio=day.profile.calciumPhosphorus, hasRatio=ratio.min!=null || ratio.max!=null;
  if(hasRatio && (result.total.calcium.missing.length || result.total.phosphorus.missing.length))return empty('Eaten or planned calcium or phosphorus is unknown; the configured ratio cannot be verified.');
  const settings=portionSettingsFor(day);
  const pool=foods.filter(f=>selected.includes(f.id) && f.nutrients.energy>0 && f.quality!=='bounds'
    && caps.every(c=>f.nutrients[c.id]!=null && !f.partialNutrients?.includes(c.id))
    && (!hasRatio || ['calcium','phosphorus'].every(id=>f.nutrients[id]!=null && !f.partialNutrients?.includes(id)))).map(f=>{
      const previous=committed.filter(e=>e.food.id===f.id), bounds=portionBounds(day,f);
      const grams=previous.reduce((s,e)=>s+e.grams,0), kcal=previous.reduce((s,e)=>s+e.grams*e.food.nutrients.energy/100,0);
      const maximum=Math.max(0,Math.min(10000,remaining/f.nutrients.energy*100,
        bounds.maxGrams==null?Infinity:bounds.maxGrams-grams,
        f.maxDailyEnergyFraction==null?Infinity:(result.calories*f.maxDailyEnergyFraction-kcal)/f.nutrients.energy*100));
      const exactBounds=[bounds.minGrams,bounds.maxGrams,bounds.dailyMinGrams].some(v=>v!=null && Math.abs(v-Math.round(v))>1e-9);
      // A day's entered minimum applies to the proposed portion. Otherwise the food's usual daily
      // amount counts eaten and planned grams, and yields to the calorie allowance and maxima.
      const minimum=bounds.minGrams>0?bounds.minGrams:Math.min(maximum,Math.max(0,(bounds.dailyMinGrams||0)-grams));
      return {...f,portionGroup:portionDefaults(f).group,minimum,maximum,exactBounds};
    });
  // Optimix follows home-cooked calories instead of being chosen for nutrient fit. Each home-cooked
  // food is solved with its share folded into its composition; Optimix still owed for food already
  // eaten/planned is treated as given. Earlier extra Optimix offsets later need.
  const optimix=foods.find(f=>f.id===OPTIMIX_ID), fullDose=optimixDose(day.profile), perKcal=fullDose/result.calories;
  const given=committed.reduce((s,e)=>s+(e.food.id===OPTIMIX_ID?e.grams:0),0);
  const owed=perKcal*committed.reduce((s,e)=>s+(needsOptimix(e.food)?e.grams*e.food.nutrients.energy/100:0),0)-given;
  const dosing=Boolean(optimix && fullDose>0 && caps.every(c=>optimix.nutrients[c.id]!=null) && ['calcium','phosphorus'].every(id=>optimix.nutrients[id]!=null));
  const optimixFor=additions=>dosing?Math.max(0,Math.round((perKcal*additions.reduce((s,e)=>s+(needsOptimix(e.food)?e.grams*e.food.nutrients.energy/100:0),0)+owed)*10)/10):0;
  const fold=f=>{
    if(!dosing || owed<0 || !needsOptimix(f))return f;
    const share=perKcal*f.nutrients.energy/100;
    return {...f,nutrients:Object.fromEntries(Object.entries(f.nutrients).map(([k,v])=>[k,v==null || optimix.nutrients[k]==null?v:v+share*optimix.nutrients[k]]))};
  };
  const base=dosing && owed>=.05?audit(day,[...committed,{food:optimix,grams:owed}]):result;
  if(!pool.length)return empty('Selected foods need calories and values for every configured maximum.');
  if(selected.some(id=>!pool.some(f=>f.id===id) && settings.bounds[id]?.minGrams>0))return empty('A required ingredient lacks the composition needed to verify the limits. Complete its data or remove its minimum portion.');
  const fruitLogged=committed.reduce((s,e)=>s+(portionDefaults(e.food).group==='fruit'?e.grams:0),0);
  const extrasLogged=committed.reduce((s,e)=>s+(['fruit','vegetable','treat'].includes(portionDefaults(e.food).group)?e.grams*e.food.nutrients.energy/100:0),0);
  const solved=optimize({pool:pool.map(fold),current:base.total,checks:base.checks.map(c=>({...c,reliability:(()=>{const e=evidenceFor([...committed,...pool.map(food=>({food,grams:food.maximum/Math.max(1,pool.length)}))],c.id);return 1-.8*e.lowShare-.3*(e.estimatedShare-e.lowShare);})(),group:byId[c.id].group,...(c.id==='arginine' && c.origin==='adult-guidance'?{arginineProteinMin:adultTargets(day.profile.referenceWeight).protein.min,arginineBase:day.profile.targets.arginine.min}:{})})),
    // Rounding Optimix to 0.1 g may add up to 0.04 kcal; keep that margin inside the allowance.
    remaining:base.calories-base.total.energy.value-(dosing?.05:0),
    calories:result.calories,calorieIntent:day.profile.calorieIntent || 'target',ratio,settings,fruitLogged,extrasLogged});
  if(solved.noAdditional) {
    const incomplete=result.checks.some(c=>c.missing.length || c.partial) || pool.some(f=>result.checks.some(c=>f.nutrients[c.id]==null || f.partialNutrients?.includes(c.id)));
    const complete=committed.length>0 && !incomplete && result.checks.every(c=>c.state==='within') && ['unset','within'].includes(result.ratioState);
    return {...empty(incomplete?'No additional portion proposed. Incomplete nutrient comparisons need review; preserve the intended meals rather than using the unused allowance.':'No additional portion improves the configured comparisons within these limits. Preserve the intended meals and review any remaining findings.'),noAdditional:complete};
  }
  const options=[];
  // Whole-gram steps can leave a few kcal unused; one or two steps of the most energy-dense food is not a shortfall.
  const stepGap=Math.max(1,...pool.map(f=>2*f.nutrients.energy/100*stepTenths(f)/10));
  // Check the closest fit first so a duplicate alternative never displaces it; the sort below sets display order.
  for(const candidate of [...solved.options].sort((a,b)=>(b.label==='Closest nutrient fit')-(a.label==='Closest nutrient fit'))) {
    const additions=pool.map((food,i)=>({food,grams:candidate.grams[i]})).filter(e=>e.grams>0);
    if(!additions.length)continue;
    const supplement=optimixFor(additions);
    if(supplement>=OPTIMIX_MIN_GRAMS)additions.push({food:{...optimix,portionGroup:'supplement'},grams:supplement,fresh:true,dosed:true});
    const projection=projectOption(day,additions), next=projection.projected;
    // Independently verify the rounded, displayed solution before presenting it.
    if(next.total.energy.value>result.calories+1e-8 || next.checks.some(c=>c.state==='over') || (hasRatio && next.ratioState!=='within'))continue;
    if(pool.some((f,i)=>candidate.grams[i]<f.minimum-1e-8 || candidate.grams[i]>f.maximum+1e-8))continue;
    const fruit=additions.filter(e=>e.food.portionGroup==='fruit').reduce((s,e)=>s+e.grams,0);
    const extras=additions.filter(e=>['fruit','vegetable','treat'].includes(e.food.portionGroup)).reduce((s,e)=>s+e.grams*e.food.nutrients.energy/100,0);
    if(fruit>Math.max(0,settings.fruitMaxGrams-fruitLogged)+1e-8 || extras>Math.max(0,result.calories*settings.extrasPercent/100-extrasLogged)+1e-8)continue;
    // Do not manufacture near-identical options: same foods, each within 2 g, 10% or 3 kcal.
    if(options.some(o=>pool.every((f,i)=>{const shown=o.additions.find(e=>e.food.id===f.id)?.grams||0,next=candidate.grams[i],gap=Math.abs(shown-next);
      return (shown>0)===(next>0) && (gap<Math.max(2,.1*Math.max(shown,next)) || gap*f.nutrients.energy/100<3);})))continue;
    const below=next.checks.filter(c=>c.state==='below').length, above=next.checks.filter(c=>c.state==='above-reference').length;
    const unknown=next.checks.filter(c=>(c.state==='unknown' || c.partial)).length;
    options.push({...candidate,...projection,unreachable:solved.unreachable || [],additions,below,above,unknown,calories:totals(additions).energy.value,filled:ceiling || projection.energyGap<stepGap,
      allConfiguredMet:next.checks.length>0 && !below && !above && !unknown && (ceiling || projection.energyGap<stepGap)});
  }
  options.sort((a,b)=>comparePortionOptions(a,b,settings.preferAll));
  return {reason:options.length?'':solved.reason || 'No portions on the weighing scale satisfy the current limits. Adjust the portion bounds or foods.',options,
    settings,limited:!ceiling && options.length>0 && options.every(o=>o.energyGap>stepGap)};
}

const fail = message => { throw new Error(message); };
function textField(value, name, length = 20000) {
  if (typeof value !== 'string' || value.length > length) fail(`Invalid ${name}.`);
}
function finite(value, name, min = 0, max = 1e9) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) fail(`Invalid ${name}.`);
}
function bounds(value, name) {
  if (!value || typeof value !== 'object') fail(`Invalid ${name}.`);
  for (const key of ['min', 'max']) if (value[key] !== null) finite(value[key], `${name} ${key}`);
  if (value.min != null && value.max != null && value.min > value.max) fail(`${name}: minimum is above maximum.`);
}
export function validateFood(food) {
  if (!food) fail('Missing food.');
  textField(food.id, 'food id', 100); textField(food.name, 'food name', 180);
  if (!food.name.trim()) fail('Food needs a name.');
  if (!['typical', 'estimate', 'bounds'].includes(food.quality)) fail('Invalid food data quality.');
  if (typeof food.complete !== 'boolean') fail('Invalid food type.');
  textField(food.source, 'food source'); textField(food.notes, 'food notes');
  if (!food.nutrients || typeof food.nutrients !== 'object' || Array.isArray(food.nutrients)) fail('Invalid nutrients.');
  for (const [id, value] of Object.entries(food.nutrients)) {
    if (!Object.hasOwn(byId, id)) fail(`Unknown nutrient ${id}.`);
    finite(value, byId[id].name, 0, byId[id].unit === 'g' ? 100 : id === 'energy' ? 1000 : 1e9);
  }
  if (food.role !== undefined && food.role !== 'supplement') fail('Invalid food role.');
  if (food.maxDailyEnergyFraction !== undefined) finite(food.maxDailyEnergyFraction,'food daily energy fraction',.001,1);
  if (food.portionGroup !== undefined && !['main','fruit','vegetable','treat'].includes(food.portionGroup)) fail('Invalid portion group.');
  if (food.suggestionMaxGrams !== undefined && food.suggestionMaxGrams !== null) finite(food.suggestionMaxGrams,'suggestion maximum grams',0,10000);
  if (food.suggestionDailyMinGrams !== undefined && food.suggestionDailyMinGrams !== null) finite(food.suggestionDailyMinGrams,'usual daily grams',0,10000);
  if (food.units !== undefined) {
    if (!Array.isArray(food.units) || food.units.length > 10) fail('Invalid food units.');
    const labels = new Set();
    for (const unit of food.units) {
      textField(unit.label, 'unit label', 40); finite(unit.grams, 'unit weight', .01, 10000);
      if (!unit.label.trim() || unit.label === 'g' || labels.has(unit.label)) fail('Duplicate or invalid unit label.');
      labels.add(unit.label);
    }
  }
  for (const key of ['estimatedNutrients','partialNutrients']) if (food[key] !== undefined && (!Array.isArray(food[key]) || food[key].some(id => !Object.hasOwn(byId, id)))) fail('Invalid nutrient provenance.');
  if (food.estimates !== undefined) {
    if (!food.estimates || typeof food.estimates !== 'object' || Array.isArray(food.estimates)) fail('Invalid estimates.');
    for (const [id,estimate] of Object.entries(food.estimates)) {
      if (!Object.hasOwn(byId,id) || !estimate || !['low','medium'].includes(estimate.confidence)) fail('Invalid nutrient estimate.');
      textField(estimate.method,'estimate method',4000); textField(estimate.source,'estimate source',2000);
    }
  }
  if (food.declaredAdditions !== undefined) {
    if (!food.declaredAdditions || typeof food.declaredAdditions !== 'object' || Array.isArray(food.declaredAdditions)) fail('Invalid declared additions.');
    for (const [id,value] of Object.entries(food.declaredAdditions)) { if (!Object.hasOwn(byId,id)) fail('Invalid declared nutrient.'); finite(value,'declared addition'); }
  }
  if (food.additionalSources !== undefined) {
    if (!Array.isArray(food.additionalSources) || food.additionalSources.length > 10) fail('Invalid additional food sources.');
    food.additionalSources.forEach(source => textField(source, 'food source', 2000));
  }
  return food;
}
export function validateProfile(profile) {
  if (!profile) fail('Missing profile.');
  textField(profile.id, 'plan id', 100); textField(profile.name, 'plan name', 180);
  if (!profile.name.trim()) fail('Plan needs a name.');
  finite(profile.revision, 'revision', 1, 1e6);
  finite(profile.calories, 'calorie target', 1, 10000);
  finite(profile.referenceWeight, 'reference weight', .1, 200);
  if (profile.optimixDailyGrams !== undefined) finite(profile.optimixDailyGrams, 'Optimix daily dose', 0, 20);
  for (const k of ['author', 'status', 'notes', 'source', 'clinicalNotes']) textField(profile[k], k);
  if (profile.referenceInfo !== undefined) textField(profile.referenceInfo, 'reference calculation');
  if (profile.recipe !== undefined) textField(profile.recipe, 'daily recipe');
  if (!profile.activity || typeof profile.activity !== 'object') fail('Invalid activity settings.');
  for (const k of ['quiet', 'normal', 'active']) {
    finite(profile.activity[k], 'activity adjustment', -10000, 10000);
    finite(profile.calories + profile.activity[k], 'adjusted calorie target', 1, 10000);
  }
  if (!profile.targets || typeof profile.targets !== 'object' || Array.isArray(profile.targets)) fail('Invalid targets.');
  for (const [id, target] of Object.entries(profile.targets)) {
    if (!Object.hasOwn(byId, id) || id === 'energy' || id === 'water') fail(`Invalid target ${id}.`);
    if(target.maxBasis && !['day','per1000'].includes(target.maxBasis))fail('Invalid maximum basis.');
    // A mixed-basis target is compared after conversion, not by its raw numbers.
    if(target.maxBasis && target.maxBasis!==target.basis) {for(const key of ['min','max'])if(target[key]!==null)finite(target[key],byId[id].name);}
    else bounds(target, byId[id].name);
    if (target.kind !== undefined && !['reference','limit'].includes(target.kind)) fail('Invalid target kind.');
    if (target.partial !== undefined && typeof target.partial !== 'boolean') fail('Invalid target coverage.');
    if (!['day', 'per1000'].includes(target.basis)) fail('Invalid target basis.');
  }
  if(profile.planningNutrients!==undefined && (!Array.isArray(profile.planningNutrients) || profile.planningNutrients.length>47 || new Set(profile.planningNutrients).size!==profile.planningNutrients.length || profile.planningNutrients.some(id=>!Object.hasOwn(byId,id) || ['energy','water'].includes(id))))fail('Invalid planning priorities.');
  if(profile.recipeFatTolerance!==undefined)finite(profile.recipeFatTolerance,'recipe fat tolerance',0,200);
  if(profile.recipeTargets!==undefined){const copy={...profile,targets:profile.recipeTargets};delete copy.recipeTargets;validateProfile(copy);}
  if(profile.calorieIntent!==undefined && !['target','ceiling'].includes(profile.calorieIntent))fail('Invalid calorie intent.');
  if(profile.mixedReview!==undefined){
    textField(profile.mixedReview.note,'mixed feeding review',2000);
    if(!Array.isArray(profile.mixedReview.foodIds) || profile.mixedReview.foodIds.length>100)fail('Invalid reviewed foods.');
    profile.mixedReview.foodIds.forEach(id=>textField(id,'reviewed food',100));
    if(profile.mixedReview.foodIds.length && !profile.mixedReview.note.trim())fail('Record who reviewed this combination and its conditions.');
  }
  bounds(profile.calciumPhosphorus, 'calcium/phosphorus ratio');
  if (!Array.isArray(profile.allowedFoods) || profile.allowedFoods.length > 100) fail('Choose up to 100 eligible foods in each plan.');
  profile.allowedFoods.forEach(id => textField(id, 'selected food', 100));
  if (profile.watchNutrients !== undefined && (!Array.isArray(profile.watchNutrients) || profile.watchNutrients.length>49 || new Set(profile.watchNutrients).size!==profile.watchNutrients.length || profile.watchNutrients.some(id=>!Object.hasOwn(byId,id) || ['energy','water'].includes(id)))) fail('Invalid nutrient watch list.');
  return profile;
}
export function validateComponents(items) {
  if(!Array.isArray(items) || items.length>100)fail('A meal supports up to 100 components.');
  const ids=new Set();
  for(const c of items){textField(c.id,'component id',100);if(ids.has(c.id))fail('Duplicate component ids.');ids.add(c.id);validateFood(c.food);finite(c.grams,'component grams',1e-9,10000);if(c.fresh!==undefined && typeof c.fresh!=='boolean')fail('Invalid fresh addition.');}
}
export function validateRecipe(r) {
  if(!r)fail('Invalid saved recipe.');textField(r.id,'recipe id',100);textField(r.name,'recipe name',180);if(!r.name.trim())fail('Recipe needs a name.');
  finite(r.revision,'recipe revision',1,1e6);textField(r.notes,'recipe notes');validateComponents(r.components);if(!r.components.length)fail('Recipe needs ingredients.');
  if(new Set(r.components.map(c=>c.food.id)).size!==r.components.length)fail('Combine repeated recipe ingredients into one amount.');
  if(r.components.some(c=>c.food.id==='seed-optimix' && c.fresh!==true))fail('Optimix must be a fresh addition to the cooled portion.');
  if(r.yieldGrams!==null)finite(r.yieldGrams,'cooked batch yield',.01,10000);
  return r;
}
export function validateState(state) {
  if (!state || state.schemaVersion !== 1) fail('Unsupported backup version.');
  if(state.recipeInstructionsVersion!==undefined && state.recipeInstructionsVersion!==1)fail('Unsupported recipe instruction version.');
  if (state.referenceRecipesVersion !== undefined && ![1,2].includes(state.referenceRecipesVersion)) fail('Unsupported recipe reference version.');
  if (state.foodCatalogVersion !== undefined && ![1,2,3,4,5].includes(state.foodCatalogVersion)) fail('Unsupported food catalog version.');
  if (state.foodEstimatesVersion !== undefined && state.foodEstimatesVersion !== 1) fail('Unsupported food estimate version.');
  if(state.nutrientGuidanceVersion!==undefined && state.nutrientGuidanceVersion!==1)fail('Unsupported nutrient guidance version.');
  if(state.planNotesVersion!==undefined && state.planNotesVersion!==1)fail('Unsupported plan notes version.');
  if (state.foodReviewVersion !== undefined && state.foodReviewVersion !== 1) fail('Unsupported food review version.');
  if (state.activityDefaultsVersion !== undefined && state.activityDefaultsVersion !== 1) fail('Unsupported activity defaults version.');
  if (!Array.isArray(state.profiles) || !state.profiles.length || state.profiles.length > 100) fail('Backup needs 1–100 plans.');
  state.profiles.forEach(validateProfile);
  if (new Set(state.profiles.map(p => p.id)).size !== state.profiles.length) fail('Duplicate plan ids.');
  if (!state.profiles.some(p => p.id === state.activeProfileId)) fail('Default plan is missing.');
  if (!Array.isArray(state.foods) || state.foods.length > 100) fail('Food library supports up to 100 foods.');
  state.foods.forEach(validateFood);
  if (new Set(state.foods.map(f => f.id)).size !== state.foods.length) fail('Duplicate food ids.');
  if(state.recipes!==undefined){if(!Array.isArray(state.recipes) || state.recipes.length>100 || new Set(state.recipes.map(r=>r.id)).size!==state.recipes.length)fail('Invalid saved recipes.');state.recipes.forEach(validateRecipe);}
  const foodIds = new Set(state.foods.map(f => f.id));
  for (const p of state.profiles) if (p.allowedFoods.some(id => !foodIds.has(id))) fail('A plan refers to a missing food.');
  if (!state.days || typeof state.days !== 'object' || Array.isArray(state.days) || Object.keys(state.days).length > 20000) fail('Invalid diary.');
  for (const [date, day] of Object.entries(state.days)) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dateKey(new Date(`${date}T12:00:00`)) !== date) fail('Invalid diary date.');
    validateProfile(day.profile);
    if (!['quiet', 'normal', 'active'].includes(day.activity)) fail('Invalid activity.');
    if (day.activityOffsets !== undefined) {
      for (const k of ['quiet','normal','active']) { finite(day.activityOffsets[k], 'activity offset', -10000, 10000); finite(day.profile.calories + day.activityOffsets[k], 'activity allowance', 1, 10000); }
    }
    finite(day.adjustment, 'daily adjustment', -10000, 10000);
    finite(caloriesFor(day), 'daily calorie target', 1, 10000);
    if (day.waterMl !== undefined) finite(day.waterMl, 'water', 0, 10000); textField(day.note, 'day note');
    if (!Array.isArray(day.entries) || day.entries.length > 1000) fail('Invalid diary entries.');
    if (day.availableFoods !== undefined) {
      if (!Array.isArray(day.availableFoods) || day.availableFoods.length > 5 || new Set(day.availableFoods).size !== day.availableFoods.length) fail('Select 1–5 available ingredients.');
      day.availableFoods.forEach(id => textField(id, 'available ingredient', 100));
    }
    if(day.portionSettings !== undefined) {
      const p=day.portionSettings;
      if(!p || typeof p.preferAll!=='boolean')fail('Invalid portion preference.');
      finite(p.fruitMaxGrams,'fruit gram limit',0,10000);finite(p.extrasPercent,'extras percentage',0,100);
      if(!p.bounds || typeof p.bounds!=='object' || Array.isArray(p.bounds) || Object.keys(p.bounds).length>100)fail('Invalid portion bounds.');
      for(const [id,b] of Object.entries(p.bounds)) {
        textField(id,'portion food',100);if(!b)fail('Invalid portion bounds.');
        finite(b.minGrams,'minimum grams',0,10000);if(b.maxGrams!==null)finite(b.maxGrams,'maximum grams',0,10000);
        if(b.maxGrams!==null && b.minGrams>b.maxGrams)fail('Minimum portion exceeds the daily maximum.');
      }
    }
    if(day.fixedRecipeDay!==undefined && typeof day.fixedRecipeDay!=='boolean')fail('Invalid fixed recipe instruction.');
    if(day.allowRecipeAdditions!==undefined && typeof day.allowRecipeAdditions!=='boolean')fail('Invalid recipe additions choice.');
    if(day.planned!==undefined){
      if(!Array.isArray(day.planned) || day.planned.length>100 || new Set(day.planned.map(p=>p.id)).size!==day.planned.length)fail('Invalid planned meals.');
      for(const p of day.planned){textField(p.id,'planned id',100);textField(p.name,'planned name',180);validateComponents(p.items);if(!p.items.length)fail('Planned meal is empty.');
        if(p.recipeId!==undefined){textField(p.recipeId,'recipe reference',100);finite(p.recipeRevision,'recipe version',1,1e6);}
        if(p.expected!==undefined){validateComponents(p.expected);if(p.items.some(c=>!p.expected.some(e=>e.id===c.id && e.grams===c.grams && JSON.stringify(e.food)===JSON.stringify(c.food))))fail('Planned items do not match their fixed recipe snapshot.');}
        if(p.portionGrams!=null)finite(p.portionGrams,'planned mixture grams',1e-9,1e6);
      }
    }
    const ids = new Set();
    for (const e of day.entries) {
      textField(e.id, 'entry id', 100); if (ids.has(e.id)) fail('Duplicate entry ids.'); ids.add(e.id);
      finite(e.grams, 'portion grams', e.mealId?1e-9:.01, 10000);
      if(e.mealId!==undefined){textField(e.mealId,'meal id',100);textField(e.mealName,'meal name',180);}
      if(e.recipeId!==undefined){textField(e.recipeId,'eaten recipe id',100);finite(e.recipeRevision,'eaten recipe revision',1,1e6);if(!e.mealId)fail('Eaten recipe needs its meal linkage.');} validateFood(e.food);
      if (e.portion !== undefined && Math.abs(portionGrams(e.food, e.portion.amount, e.portion.unit) - e.grams) > .00001) fail('Portion count does not match grams.');
      if (typeof e.time !== 'string' || !Number.isFinite(Date.parse(e.time))) fail('Invalid entry time.');
    }
  }
  if (!Array.isArray(state.weights) || state.weights.length > 20000) fail('Invalid weight history.');
  for (const w of state.weights) {
    finite(w.kg, 'weight', .1, 200);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(w.date) || dateKey(new Date(`${w.date}T12:00:00`)) !== w.date) fail('Invalid weight date.');
  }
  return state;
}
