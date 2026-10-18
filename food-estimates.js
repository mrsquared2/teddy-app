// Best-effort composition models. These fill gaps; they are not product assays
// or nutrient requirements. Each modeled field carries its method and source.
const COFID = 'https://www.gov.uk/government/publications/composition-of-foods-integrated-dataset-cofid';
const IODINE = 'https://www.ars.usda.gov/ARSUserFiles/80400535/Data/Iodine/IODINE_DATABASE_RELEASE_4_DOCUMENTATION.pdf';
const RC = 'https://s7d2.scene7.com/is/content/RoyalCanin/Info/2017%20Vet%20Product%20Guide.pdf';
const LAB = 'https://www.labdiet.com/getmedia/8e8b90f4-7c73-4d65-9e64-87406222e89e/5006.pdf?ext=.pdf';
export const AMINO_ACIDS = ['arginine','histidine','isoleucine','leucine','lysine','methionine','methionineCystine','phenylalanine','phenylalanineTyrosine','threonine','tryptophan','valine'];
const round = value => Number(value.toFixed(8));
function estimate(food, id, value, method, source, confidence = 'low', replace = false) {
  if (!replace && food.nutrients[id] !== undefined) return;
  if (!Number.isFinite(value) || value < 0) throw new Error(`Invalid estimate: ${food.id}/${id}`);
  food.nutrients[id] = round(value);
  (food.estimates ||= {})[id] = { method, source, confidence };
  food.estimatedNutrients = [...new Set([...(food.estimatedNutrients || []), id])];
  food.quality = 'estimate';
}
function proxy(food, donor, ids, basis = 'water', confidence = 'low') {
  const scale = basis === 'water' ? (100-food.nutrients.water)/(100-donor.nutrients.water)
    : basis === 'none' ? 1 : food.nutrients[basis]/donor.nutrients[basis];
  for (const id of ids) estimate(food, id, donor.nutrients[id] * scale,
    `${donor.name}; ${basis === 'water' ? 'scaled by dry matter' : basis === 'none' ? 'per 100 g without scaling' : `scaled by ${basis}`}. Cooking/drainage retention assumed 100%; actual retention varies.`, donor.source, confidence);
}

// Royal Canin 2017 typical analysis, canine dry URINARY SO (p171) and
// URINARY SO MODERATE CALORIE (p175), per 1,000 kcal. B7/B9/B12 and Se
// converted from mg to the app's micrograms. Historical cross-brand proxies.
const urinary = {iron:54.6,copper:4,manganese:21.6,zinc:60.9,iodine:1.4,selenium:80,
  vitaminE:185,b1:1.2,b2:1.5,b5:10.8,b3:4,b6:7.41,b9:2300,b7:700,b12:20,choline:580,
  arginine:2.7,lysine:1.9,methionine:1,methionineCystine:1.4,linoleic:8.4,epaDha:.5};
const moderate = {iron:66.8,copper:4.4,manganese:23.7,zinc:64.7,iodine:1.5,selenium:80,
  vitaminE:177,b1:1.4,b2:1.6,b5:9.4,b3:5,b6:3,b9:200,b7:300,b12:20,choline:591.2,
  arginine:3,lysine:2.9,methionine:2.7,methionineCystine:3.6,linoleic:7.7,epaDha:.6};
// LabDiet 5006 chemical composition (2022), as fed per 100 g. Protein 25 g,
// ether-extract fat 9 g, NFE 44.7 g, ME 340 kcal. Not guaranteed minima.
const labAmino = {arginine:1.49,histidine:.68,isoleucine:.86,leucine:2.25,lysine:1.24,
  methionine:.42,methionineCystine:.81,phenylalanine:1.15,phenylalanineTyrosine:1.89,
  threonine:.87,tryptophan:.23,valine:1.23};

export function applyFoodEstimates(foods, hills) {
  const f = foods;
  // USDA/FDA/NIH iodine release 4 (2024), mean micrograms/100 g.
  // A reported 0.0 is a rounded/non-detect database result, not chemical absence.
  for (const [key, micrograms, description] of [
    ['rice',.2,'DB40 white enriched rice, cooked'], ['pasta',.3,'DB171 enriched spaghetti, boiled'],
    ['quinoa',0,'DB223 cooked quinoa; reported 0.0 µg/100 g'],
    ['carrot',.6,'DB175 baby carrot, raw'], ['carrotCooked',.5,'DB313 peeled carrot, boiled'],
    ['mango',.1,'DB453 mango, raw/frozen'], ['pumpkin',.8,'DB81 winter squash, boiled'],
    ['cauliflower',.6,'DB75 cauliflower, fresh/frozen, boiled'],
    ['liver',16,'DB335 beef/calf liver, pan-cooked; different species/preparation']
  ]) estimate(f[key], 'iodine', micrograms/1000, `USDA/FDA iodine database mean: ${description}; comparable-food estimate.`, IODINE);

  estimate(f.melon,'b7',2.6,
    'CoFID 14-328 Honeydew melon flesh biotin 2.6 µg/100 g, unscaled. Different melon variety used for unavailable cantaloupe biotin; variety and ripeness can differ.',COFID);
  estimate(f.peach,'chloride',0,
    'CoFID 14-299 raw peach flesh and skin reports trace chloride; modeled as negligible (0), not measured absent. Trace detection threshold is unspecified.',COFID);

  proxy(f.gizzard, f.chicken, AMINO_ACIDS, 'protein');
  proxy(f.gizzard, f.chicken, ['chloride','iodine','b7']);
  proxy(f.heart, f.chicken, ['iodine','choline']);
  for (const [id,value] of Object.entries({chloride:83,b7:5,sugars:0})) estimate(f.heart,id,value,
    'CoFID 18-399 ox heart, stewed; same cooked organ, different species, unscaled per 100 g.',COFID);
  estimate(f.heart,'vitaminA',8/.3,
    'USDA FDC171059 simmered chicken heart retinol 8 µg/100 g / 0.3 IU; unreported carotene assumed negligible in this organ. Uses the cooked record directly.',
    'https://fdc.nal.usda.gov/food-details/171059/nutrients');
  for (const [id,value] of Object.entries({vitaminD:16,vitaminE:1.49,vitaminK:51})) estimate(f.heart,id,value*f.heart.nutrients.fat/15.5,
    'MEXT 11231 raw chicken heart: D 0.4 µg, alpha-tocopherol 1 mg, K 51 µg; scaled by fat (raw 15.5 g), with no additional cooking-loss correction.',
    'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=11_11231_7');
  for (const [id,value] of Object.entries({chloride:130,b7:210})) estimate(f.liver,id,value*(100-f.liver.nutrients.water)/24.2,
    'CoFID 18-411 raw chicken liver; scaled by dry matter (raw water 75.8%), no additional cooking-loss correction.',COFID);
  proxy(f.quinoa, f.quinoaRawProxy, ['b5'], 'water', 'medium');
  proxy(f.quinoa, f.rice, ['chloride','b7']);
  proxy(f.raspberry, f.strawberry, AMINO_ACIDS, 'protein');
  proxy(f.watermelon, f.cucumber, ['chloride'], 'water');
  estimate(f.watermelon,'iodine',0,
    'CoFID 14-296 watermelon reports trace iodine; modeled as negligible (0), not a measured absence. Trace detection threshold is unspecified.',COFID);
  proxy(f.yogurt, f.yogurtProxy, AMINO_ACIDS, 'protein');
  proxy(f.yogurt, f.yogurtProxy, ['linoleic','ala','epaDha','vitaminA','vitaminD','vitaminE','vitaminK'], 'fat');
  estimate(f.yogurt,'water',86,
    'Mass balance: 100 − label protein 8.7 − fat 2 − carbohydrate 2.3 − assumed ash 1 = 86 g. Approximate moisture; ash is unpublished.',f.yogurt.source);
  // Retain the matched label; remaining generic Greek yogurt values are unscaled.
  for (const id of Object.keys(f.yogurtProxy.nutrients)) {
    const extra = ['chloride','iodine','b7'].includes(id);
    estimate(f.yogurt,id,f.yogurtProxy.nutrients[id],
      extra ? 'CoFID 12-555 plain Greek-style whole-milk yogurt, unscaled per 100 g. Different fat/protein content and brand; iodine varies with milk source and season.'
        : 'USDA FDC170903 plain lowfat Greek yogurt, unscaled per 100 g. Different brand; moisture and micronutrients are approximate.',extra ? COFID : f.yogurtProxy.source);
  }
  estimate(f.mango,'methionineCystine',f.mango.nutrients.methionine +
    (f.banana.nutrients.methionineCystine-f.banana.nutrients.methionine)*f.mango.nutrients.protein/f.banana.nutrients.protein,
    'Known mango methionine plus banana cystine scaled by protein. Different fruit; approximate amino-acid composition.', f.banana.source);
  proxy(f.quail, f.egg, ['chloride','iodine','b7']);
  for (const [id,value] of Object.entries({chloride:69,iodine:.002,b7:1})) estimate(f.beans,id,value*(100-f.beans.nutrients.water)/8.7,
    'CoFID 13-514 raw green beans; dry matter scaled from water 91.3%. Blanching, freezing and thawing losses are unquantified.',COFID);
  proxy(f.beans, f.beansCooked, ['choline'], 'water', 'medium');
  proxy(f.eggWhite, f.eggWhiteRawProxy, ['epaDha','iron','choline'], 'water', 'medium');
  estimate(f.eggWhite,'sugars',Math.min(f.eggWhite.nutrients.carbs,f.eggWhiteRawProxy.nutrients.sugars*(100-f.eggWhite.nutrients.water)/(100-f.eggWhiteRawProxy.nutrients.water)),
    'Raw egg-white sugar scaled by dry matter, capped at the known boiled carbohydrate total (0.4 g).',f.eggWhiteRawProxy.source);
  estimate(f.puree,'iodine',f.pumpkin.nutrients.iodine*.53+f.carrotCooked.nutrients.iodine*.47,
    '53:47 blend of winter-squash/boiled-carrot iodine means; added water and processing are unquantified.',IODINE);
  estimate(f.puree,'water',88.9,
    'Mass balance: 100 − protein 0.9 − fat 0.1 − carbohydrate 8 − fibre 1.6 − assumed vegetable ash 0.5 = 88.9 g. Approximate moisture only.',f.pumpkin.source);

  const s = f.optimix;
  for (const [id,value] of Object.entries({energy:80,carbs:20,sugars:20,water:2})) estimate(s,id,value,
    'Ingredient mass-balance model: approximately 20% dextrose, 2% moisture; 4 kcal/g dextrose. Declared mineral salts account for roughly 77% of the powder; remainder allows premix carriers. Manufacturer does not publish these values.',s.source);
  for (const id of ['protein','fat','fiber','saturatedFat','linoleic','ala','epaDha','selenium','vitaminC','vitaminK','choline',...AMINO_ACIDS]) estimate(s,id,0,
    'Assumed negligible in a mineral/vitamin powder with dextrose carrier and no declared source of this nutrient. Modeled zero, not an assay; trace impurities/carriers are unquantified.',s.source);
  s.declaredAdditions = Object.fromEntries(s.partialNutrients.map(id=>[id,s.nutrients[id]]));
  for (const id of s.partialNutrients) estimate(s,id,s.nutrients[id],
    'Total approximated by the declared added amount; native contribution from the mineral/dextrose base assumed negligible.',s.source,'low',true);
  for (const [id,mass,factor,compound] of [['b1',17,.81,'thiamine mononitrate'],['b5',120,.92,'calcium-D-pantothenate'],['b6',17,.82,'pyridoxine hydrochloride']]) estimate(s,id,mass*factor,
    `Declared ${compound} additive mass ${mass} mg/100 g × FEDIAF VII-14 factor ${factor}. EU additive declaration convention supports compound mass; manufacturer confirmation could change this interpretation. Raw mass retained in food notes.`,s.source,'low',true);
  s.partialNutrients = [];

  const t = f.specific, book = t.additionalSources[0];
  t.declaredAdditions = Object.fromEntries(t.partialNutrients.map(id=>[id,t.nutrients[id]]));
  const technical = {magnesium:50,potassium:680,iron:11.4,zinc:17,copper:.79,selenium:20,
    vitaminA:609,vitaminC:4,b1:1.6,b6:.9,b7:50,b12:5.5,vitaminK:90};
  for (const [id,value] of Object.entries(technical)) estimate(t,id,Math.max(t.declaredAdditions[id] || 0,value),
    'SPECIFIC technical book CT-HY per-100-g typical analysis; possible formulation/date difference from the current UK label, so used as an estimate. Declared additions are floors, not added again.',book,'medium',true);
  for (const id of ['vitaminD','iodine']) estimate(t,id,t.declaredAdditions[id],
    'Total approximated by the current supplied label’s added amount; native contribution assumed negligible. Vitamin D uses 834 IU/kg = 83.4 IU/100 g, overriding the older technical table’s lower 61 IU/100 g.',t.source,'low',true);
  estimate(t,'vitaminE',18,
    'Technical table gives 18 mg vitamin E/100 g without a chemical form. Assumes feed-grade all-rac-alpha-tocopheryl acetate at 1 IU/mg; natural alpha-tocopherol would give 26.82 IU. Conversion remains uncertain.',book);
  estimate(t,'manganese',t.declaredAdditions.manganese + f.rice.nutrients.manganese * (63.5*.9)/(100-f.rice.nutrients.water),
    'Added Mn 0.6 mg plus native rice estimate: rice ingredient 63.5 g assumed 90% dry matter, using cooked white-rice Mn per gram dry matter. Other native sources and processing retention are unquantified.',f.rice.source,'low',true);
  estimate(t,'chloride',600*35.45/22.9898,
    'Assume the declared sodium is predominantly sodium chloride: sodium × chloride/sodium atomic-mass ratio. Other salts and native sodium make this approximate.',t.source);
  for (const id of AMINO_ACIDS) estimate(t,id,18.9*(.8*f.rice.nutrients[id]/f.rice.nutrients.protein + .2*f.salmon.nutrients[id]/f.salmon.nutrients.protein),
    'Protein-weighted USDA rice/salmon amino-acid proxy: assume 80% rice and 20% salmon protein. Hydrolysed salmon is 5% of product, but actual protein contributions and hydrolysis retention are unpublished.',f.salmon.source);
  estimate(t,'saturatedFat',f.lardProxy.nutrients.saturatedFat*8/100,
    'USDA lard saturated-fat fraction scaled to 8 g product fat; assumes pork fat dominates. Rice/salmon fat contribution is unquantified.',f.lardProxy.source);
  estimate(t,'linoleic',.12*8,
    'Manufacturer total omega-3 0.12 g and n-3:n-6 ratio 1:8 imply total omega-6 0.96 g; modeled predominantly as linoleic acid, including unquantified other omega-6.',t.source);
  estimate(t,'ala',Math.min(.12,f.lardProxy.nutrients.ala*8/100),
    'USDA lard 18:3 fraction scaled to 8 g total fat approximates ALA; capped at the manufacturer’s total omega-3. Assumes pork fat dominates.',f.lardProxy.source);
  estimate(t,'epaDha',.12-t.nutrients.ala,
    'Manufacturer total omega-3 minus modeled ALA approximates marine EPA+DHA. Other omega-3 species and the actual pork/salmon fat mix are unquantified.',t.source);
  estimate(t,'sugars',f.rice.nutrients.sugars*53.8/f.rice.nutrients.carbs,
    'Cooked white-rice sugar/carbohydrate ratio scaled to the treat’s NFE. Hydrolysis and processing effects are unquantified.',f.rice.source);
  for (const [id,value] of Object.entries({b2:.46,b3:7.6,b5:2,b9:270,choline:185})) estimate(t,id,value*337/340,
    'LabDiet 5006 canine chemical composition per 100 g, scaled by energy (340 kcal donor). Different formula: low-confidence proxy for an unpublished B vitamin/choline value.',LAB);
  t.partialNutrients = [];

  // EU treat: preserve its label, never substitute the richer US treat formula.
  const rc = f.royalCaninTreat, flour = f.riceFlourProxy;
  proxy(flour,f.rice,['chloride','iodine','b7']);
  estimate(rc,'carbs',49.4,'NFE by difference: 100 − protein 18 − fat 5.4 − crude fibre 2.4 − ash 6.8 − moisture 18. Includes glycerol and unmeasured soluble fibre; not an assayed carbohydrate amount.',rc.source);
  const riceMass = 45; // Assumed ingredient proportions, not a manufacturer recipe.
  const chickenMass = (18-riceMass/100*flour.nutrients.protein)/f.chicken.nutrients.protein*100;
  const fatMass = 5.4-riceMass/100*flour.nutrients.fat-chickenMass/100*f.chicken.nutrients.fat;
  const rcModel = `Assumed native-nutrient model per 100 g: 45 g unenriched rice flour; ${round(chickenMass)} g cooked chicken equivalent to match 18 g protein; ${round(fatMass)} g lard equivalent to match 5.4 g fat. Flour also approximates barley/wheat; actual proportions, poultry organs/bones, mineral blend and processing losses are unknown. Remaining glycerol/cellulose assumed negligible for this field. No vitamin premix is declared; does not borrow fortified US-treat vitamins.`;
  for (const id of Object.keys(f.chicken.nutrients)) {
    const value = riceMass/100*flour.nutrients[id]+chickenMass/100*f.chicken.nutrients[id]+fatMass/100*(f.lardProxy.nutrients[id] ?? 0);
    // The lard-only gaps (chloride, iodine, biotin) are assumed negligible.
    estimate(rc,id,value,rcModel,flour.source);
  }
  // Only major minerals use the historical same-brand urinary-treat proxy.
  for (const [id,value] of Object.entries({calcium:1800,phosphorus:1800,potassium:2000,magnesium:130})) estimate(rc,id,value*299.5/1000,
    'Royal Canin 2017 guide p183, US Urinary Canine Treats typical mineral analysis per 1000 kcal, scaled to EU 299.5 kcal/100 g. Different region, formula and date: low-confidence mineral proxy, not an EU product analysis.',RC,'low',true);
  estimate(rc,'chloride',1100*35.45/22.9898,'Assume labeled sodium predominantly comes from sodium chloride; Na × 35.45 / 22.9898. Other mineral salts and native sodium are unknown.',rc.source,'low',true);
  rc.additionalSources.push(flour.source,f.chicken.source,f.lardProxy.source,RC,COFID);

  // Nutrafibre has ingredient amounts, not a complete nutrient declaration.
  const nf=f.nutrafibre, apple=f.driedAppleProxy, yeast=f.yeastProxy;
  proxy(apple,f.apple,['chloride','iodine','b7']);
  estimate(yeast,'chloride',20*(100-yeast.nutrients.water)/30,'CoFID 17-378 compressed yeast chloride 20 mg/100 g at 70% moisture; dry-matter scaled to active dry yeast. Different preparation.',COFID);
  estimate(yeast,'b7',200,'CoFID 17-379 dried yeast biotin 200 µg/100 g, unscaled; different yeast preparation.',COFID);
  estimate(yeast,'iodine',0,'Unfortified yeast has no declared iodine source; modeled negligible, not a measured zero. Product-specific iodine is unpublished.',COFID);
  const BEET='https://www.feedipedia.org/node/11838', PSYLLIUM='https://www.nowfoods.com/products/supplements/psyllium-husk-powder';
  // Feedipedia means, dry matter 88.8%. TDF assumed 70% DM (NDF + pectin),
  // distinct from its 19.4% crude fibre. Carbohydrate balances that assumption.
  const beet={water:11.2,protein:8.9*.888,fat:.9*.888,fiber:70*.888,carbs:13.1*.888,sugars:7.8*.888,
    calcium:14.5*88.8,phosphorus:88.8,magnesium:1.8*88.8,potassium:4.5*88.8,sodium:.6*88.8,
    manganese:80*.0888,zinc:22*.0888,copper:6*.0888,iron:677*.0888,
    saturatedFat:.9*.888*.22,linoleic:.9*.888*.578,ala:.9*.888*.105};
  for (const [id,v] of Object.entries({lysine:6.3,threonine:4.8,methionine:1.7,methionineCystine:3,tryptophan:1,isoleucine:4.4,valine:6.9,leucine:7.1,phenylalanine:4.5,phenylalanineTyrosine:9.7,histidine:3.8,arginine:4.5})) beet[id]=v/100*beet.protein;
  const psyllium={protein:0,fat:0,fiber:7/9*100,carbs:1/9*100,sugars:0,sodium:10/9*100,iron:1.5/9*100,potassium:90/9*100,water:7};
  const appleScale=90/(100-apple.nutrients.water),fishScale=80/f.salmon.nutrients.protein;
  const nfMethod='Ingredient-weighted estimate: 50% dried apple (USDA sulfured apple proxy, dried further to assumed 10% water); 27.5% Feedipedia beet pulp (88.8% dry matter, assumed total fibre 70% DM); 10% NOW psyllium proxy; 5% fish hydrolysate modeled as 80% protein using salmon ratios (fat separately assumed 2%); 5% active dry yeast as an unfortified yeast-extract proxy; 1.62% inulin as fibre; remaining 0.88% assumed moisture/carrier. Undeclared vitamins/trace elements in processed beet pulp and psyllium are assumed negligible, so estimates can understate them. Actual ingredient grades, drying and hydrolysis losses are unknown.';
  const lipidIds=['fat','saturatedFat','linoleic','ala','epaDha','vitaminA','vitaminD','vitaminE','vitaminK'];
  for (const id of Object.keys(f.apple.nutrients)) {
    if(id==='energy')continue;
    const appleValue=id==='water'?10:apple.nutrients[id]*appleScale;
    const fishValue=id==='water'?8:f.salmon.nutrients[id]*(lipidIds.includes(id)?2/f.salmon.nutrients.fat:fishScale);
    const value=.5*appleValue+.275*(beet[id]??0)+.1*(psyllium[id]??0)+.05*fishValue+.05*yeast.nutrients[id]+(id==='fiber'?1.62:0)+(id==='water'?.88:0);
    estimate(nf,id,value,nfMethod,nf.source);
  }
  estimate(nf,'energy',3.5*(nf.nutrients.protein+nf.nutrients.carbs)+8.5*nf.nutrients.fat+2*nf.nutrients.fiber,
    'Approximate energy from modeled protein/non-fibre carbs × 3.5, fat × 8.5, plus assumed fermentable-fibre energy 2 kcal/g across total fibre. This simplified hybrid is not measured canine ME; true fibre fermentation and digestibility vary substantially.',nf.source);
  nf.additionalSources.push(apple.source,yeast.source,f.salmon.source,BEET,'https://www.feedipedia.org/node/24378',PSYLLIUM,COFID);

  for (const [index,food] of hills.entries()) {
    const donor = index === 0 ? urinary : moderate;
    food.declaredAdditions = Object.fromEntries(food.partialNutrients.map(id=>[id,food.nutrients[id]]));
    for (const [id,value] of Object.entries(donor)) {
      const added = food.declaredAdditions[id];
      estimate(food,id,Math.max(added || 0,value*food.nutrients.energy/1000),
        `Royal Canin 2017 canine ${index===0?'Urinary SO dry, p171':'Urinary SO Moderate Calorie dry, p175'} typical analysis per 1,000 kcal, scaled to this Hill’s energy. Historical different-brand proxy, not Hill’s total analysis.${added===undefined?'':` Declared addition (${added} per 100 g in the displayed unit) retained as a floor, not added a second time.`}`,
        RC,'low',added !== undefined);
    }
    for (const [id,value] of Object.entries(labAmino)) estimate(food,id,value*food.nutrients.protein/25,
      'LabDiet 5006 (2022) canine chemical composition, amino acid scaled by protein (donor 25 g/100 g). Different formula; low-confidence proxy.',LAB);
    estimate(food,'saturatedFat',3*food.nutrients.fat/9,'LabDiet 5006 saturated fatty acids 3 g/100 g, scaled by ether-extract fat (donor 9 g/100 g).',LAB);
    estimate(food,'ala',.09*food.nutrients.fat/9,'LabDiet 5006 linolenic acid 0.09 g/100 g, scaled by fat (donor 9 g/100 g); used as an ALA proxy.',LAB);
    estimate(food,'sugars',1.08*food.nutrients.carbs/44.7,'LabDiet 5006 sucrose 1.08 g/100 g scaled by NFE 44.7 g/100 g; sucrose used as a total-sugar proxy. Other sugars unquantified, likely underestimate.',LAB);
    estimate(food,'vitaminK',70*food.nutrients.energy/340,'LabDiet 5006 vitamin K 0.7 ppm (70 µg/100 g), energy scaled from 340 kcal/100 g. Includes menadione; not a measured K1 concentration.',LAB);
    estimate(food,'vitaminC',0,'Hill’s c/d Multicare EU reports 0 mg vitamin C; same-brand urinary formula used as a proxy for the Metabolic variant.',hills[0].source);
    food.partialNutrients = [];
  }
}
