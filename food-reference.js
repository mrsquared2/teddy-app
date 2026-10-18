import { USDA_FOODS, COFID_ADDITIONS } from './food-data.js';
import { applyFoodEstimates, AMINO_ACIDS } from './food-estimates.js';

export const OPTIMIX_SOURCE = 'https://www.futtermedicus.de/vitamin-optimix-cani-cooking-250g-1-1-02-00250';
const copy = value => structuredClone(value);
// Editable planning preferences for this small dog's portions, not safety limits.
const portionGroups = {
  // Nutritionist Plan 2 amounts: 15 g hen egg or one 9 g quail egg.
  main: {egg:15,quail:9},
  fruit: {blueberry:5,raspberry:4,banana:10,apple:10,mango:10,strawberry:10,pear:10,watermelon:15,melon:15,peach:10,nectarine:10},
  vegetable: {carrot:25,beans:30,cucumber:30,zucchini:30,pumpkin:30,puree:30,cauliflower:15,broccoli:10,tomato:10},
  treat: {'specific-treat':null,'royal-canin-urinary-treat':6.68}
};
// Owner's usual daily kibble amount when selected; the rest of the day is filled with other foods.
const dailyMinimums = {'hills-1':50};
export function portionDefaults(food) {
  const key=food.id.replace(/^seed-/,'');
  const group=food.portionGroup || Object.keys(portionGroups).find(g=>Object.hasOwn(portionGroups[g],key)) || 'main';
  return {group,maxGrams:food.suggestionMaxGrams !== undefined ? food.suggestionMaxGrams : portionGroups[group]?.[key] ?? null,
    dailyMinGrams:food.suggestionDailyMinGrams !== undefined ? food.suggestionDailyMinGrams : dailyMinimums[key] ?? null};
}
const blank = (id, name, source, notes) => ({ id: `seed-${id}`, name, source, notes, nutrients: {}, quality: 'estimate', complete: false, units: [] });

// Manufacturer's declaration per 100 g, converted from % and additives/kg.
// Vitamin E: all-rac-alpha-tocopheryl acetate, 1 mg = 1 IU (FEDIAF VII-14).
const optimix = blank('optimix', 'Vitamin Optimix Cani Cooking', OPTIMIX_SOURCE,
  'Manufacturer declaration checked 2026-09-25. Minerals are analytical constituents; vitamins and trace minerals are declared added amounts, not a complete analysis. Undeclared nutrients and energy use separately documented estimates. Vitamin E uses 1 IU/mg for all-rac-alpha-tocopheryl acetate. Declared additive masses per 100 g are thiamine mononitrate 17 mg, calcium-D-pantothenate 120 mg and pyridoxine hydrochloride 17 mg. Active-vitamin estimates use FEDIAF factors 0.81, 0.92 and 0.82: B1 13.77 mg, B5 110.4 mg and B6 13.94 mg. This follows the EU named-additive declaration convention; manufacturer confirmation of an active-vitamin basis would supersede it. Recipe amount is 2 g/day; this library entry does not recommend a dose. Excluded from automatic portion suggestions.');
optimix.role = 'supplement';
optimix.nutrients = { calcium: 19000, chloride: 6600, phosphorus: 5000, potassium: 5000, magnesium: 2900, sodium: 1000,
  vitaminA: 25000, vitaminD: 3000, vitaminE: 170, b1: 13.77, b2: 25, b3: 85, b5: 110.4, b6: 13.94, b7: 100, b9: 1500, b12: 170,
  copper: 35, zinc: 250, iron: 85, manganese: 18, iodine: 5 };
optimix.partialNutrients = Object.keys(optimix.nutrients).filter(id => !['calcium','chloride','phosphorus','potassium','magnesium','sodium'].includes(id));

const eggWhite = blank('eggWhite', 'Egg white · boiled', 'https://fooddb.mext.go.jp/details/details.pl?ITEM_NO=12_12015_7',
  'Japan MEXT Standard Tables 2023, item 12015, boiled egg white; per 100 g edible portion. Amino acids from MODE=1 converted mg to g; fatty acids from MODE=4. The MEXT table reports trace iron/DHA and omits choline/chloride; supplementary estimates are documented separately. Database averages.');
eggWhite.nutrients = { energy: 46, water: 87.9, protein: 10.5, fat: .1, carbs: .4, fiber: 0, saturatedFat: .01,
  sodium: 170, potassium: 140, calcium: 6, magnesium: 11, phosphorus: 12, zinc: 0, copper: .02, manganese: 0, iodine: .004, selenium: 15,
  vitaminA: 0, vitaminD: 0, vitaminE: 0, vitaminK: 1, vitaminC: 0, b1: .02, b2: .26, b3: .1, b6: 0, b12: .1, b9: 0, b5: .33, b7: 11,
  isoleucine: .59, leucine: .94, lysine: .76, methionine: .43, methionineCystine: .70, phenylalanine: .66, phenylalanineTyrosine: 1.15,
  threonine: .53, tryptophan: .17, valine: .77, histidine: .30, arginine: .64, linoleic: .005, ala: 0 };

const curd = blank('curd', 'Vājpiena biezpiens 0.5% · Baltais reference', 'https://www.baltais.lv/catalog/pamata-piena-produkti/biezpiens/225/?lang=en',
  'Brand can vary. Initial macros use Baltais 0.5% 400 g (EAN 4750072062258): 96 kcal, protein 19 g, fat 0.5 g, saturates 0.3 g, carbohydrate/sugars 4 g, salt 0.20 g per 100 g. Sodium 80 mg inferred from salt / 2.5. Amino acids use USDA nonfat dry curd FDC172181 scaled from 10.34 g to 19 g protein; moisture is estimated by mass balance. Remaining USDA dry-curd micronutrients are unscaled comparable-food estimates, NOT Baltais measurements. Update the label when the product changes. Brands and whey drainage can differ materially.');
curd.nutrients = { ...copy(USDA_FOODS.curdProxy.nutrients), energy: 96, protein: 19, fat: .5, saturatedFat: .3, carbs: 4, sugars: 4, sodium: 80 };
curd.estimatedNutrients = Object.keys(USDA_FOODS.curdProxy.nutrients).filter(id => !['energy','protein','fat','saturatedFat','carbs','sugars','sodium'].includes(id));
curd.estimates = {};
for (const id of AMINO_ACIDS) {
  curd.nutrients[id] = Number((USDA_FOODS.curdProxy.nutrients[id] * 19 / USDA_FOODS.curdProxy.nutrients.protein).toFixed(8));
  curd.estimates[id] = {method:'USDA FDC172181 nonfat dry-curd amino-acid profile scaled by label protein: 19 / 10.34. Assumes comparable milk-protein composition; whey drainage varies.',source:USDA_FOODS.curdProxy.source,confidence:'low'};
}
curd.nutrients.water = 75.5;
curd.estimates.water = {method:'Mass balance: 100 − protein 19 − fat 0.5 − carbohydrate 4 − assumed ash 1 = 75.5 g. Approximate moisture; ash is unpublished.',source:curd.source,confidence:'low'};
for (const [key, food] of [['curd',curd],['eggWhite',eggWhite]]) {
  const extra = COFID_ADDITIONS[key];
  for (const [id,value] of Object.entries(extra.nutrients)) if (food.nutrients[id] === undefined) {
    food.nutrients[id] = value;
    (food.estimatedNutrients ||= []).push(id);
  }
  food.additionalSources = [extra.source]; food.notes += ' ' + extra.note;
}

const puree = blank('puree', 'Organic pumpkin & carrot purée · 53% / 47%', '',
  'Product label supplied by owner: pumpkin 53%, carrot 47%, water; sterilized. Per 100 g: 40 kcal, fat 0.1 g, saturates 0 g, carbohydrate 8 g, sugars 3.5 g, fibre 1.6 g, protein 0.9 g, salt 0 g (rounded declaration, not analytical zero). Sodium entered as the label-equivalent rounded 0 mg. Other values are a proxy blend of USDA boiled pumpkin and boiled carrot at 53:47. Added-water quantity and sterilization losses are unknown, so these micronutrients are estimates, not product measurements. Moisture uses a separate mass-balance estimate.');
for (const [id, value] of Object.entries(USDA_FOODS.pumpkin.nutrients)) {
  const carrot = USDA_FOODS.carrotCooked.nutrients[id];
  if (carrot !== undefined && id !== 'water') puree.nutrients[id] = Number((value * .53 + carrot * .47).toFixed(6));
}
Object.assign(puree.nutrients, { energy: 40, fat: .1, saturatedFat: 0, carbs: 8, sugars: 3.5, fiber: 1.6, protein: .9, sodium: 0 });
puree.estimatedNutrients = Object.keys(puree.nutrients).filter(id => !['energy','fat','saturatedFat','carbs','sugars','fiber','protein','sodium'].includes(id));
puree.additionalSources = [USDA_FOODS.pumpkin.source,USDA_FOODS.carrotCooked.source,COFID_ADDITIONS.pumpkin.source];
puree.notes += ' Chloride and biotin in the proxy vegetables use UK CoFID 2021 unsalted boiled pumpkin and carrot records.';
curd.additionalSources.push(USDA_FOODS.curdProxy.source);

const yogurt = blank('yogurt', 'Greek yogurt · Baltais plain 2%', 'https://www.baltais.lv/catalog/jogurti/jogurti-bez-piedevam/1098/',
  'Owner’s 400 g label: milk and starter culture; 62 kcal, fat 2 g, saturates 1.1 g, carbohydrate/sugars 2.3 g, protein 8.7 g, salt 0.20 g per 100 g. Protein follows the supplied label rather than the manufacturer website’s rounded 9 g. Sodium = salt / 2.5. Remaining values use plain lowfat Greek yogurt USDA FDC170903 and CoFID 12-555 Greek-style yogurt, not Baltais measurements. Log grams as eaten.');
yogurt.nutrients = { energy:62, fat:2, saturatedFat:1.1, carbs:2.3, sugars:2.3, protein:8.7, sodium:80 };
yogurt.additionalSources = [USDA_FOODS.yogurtProxy.source,COFID_ADDITIONS.yogurtProxy.source];

const specific = blank('specific-treat', 'SPECIFIC Hypoallergenic Treats · UK / IE',
  'https://www.specific-diets.co.uk/dog/everyday-diets/ct-hy-hypoallergenic-treats',
  'CT-HY complementary treat. Owner’s label: 337 kcal, protein 18.9 g, fat 8 g, crude fibre 4 g, ash 6.8 g, calcium 0.80 g, phosphorus 0.70 g per 100 g. Current UK manufacturer page adds NFE carbohydrate 53.8 g, moisture 8.5 g, sodium 0.60 g, total omega-3 0.12 g and n-3:n-6 ratio 1:8. Owner’s piece weight: 1.3 g (4.381 kcal). Manufacturer guidance: up to 10% of daily energy, reducing other food accordingly; other treats share this allowance. Remaining nutrients are documented estimates. The technical book may describe an older formulation: its vitamin D (61 IU/100 g) is lower than the supplied label’s added D3 (83.4 IU/100 g); the current label takes priority.');
specific.units = [{label:'piece',grams:1.3}];
specific.maxDailyEnergyFraction = .1;
specific.nutrients = {energy:337,protein:18.9,fat:8,fiber:4,calcium:800,phosphorus:700,carbs:53.8,water:8.5,sodium:600,
  vitaminD:83.4,copper:.6,iron:10.2,zinc:15.8,manganese:.6,selenium:15,iodine:.28};
specific.partialNutrients = ['vitaminD','copper','iron','zinc','manganese','selenium','iodine'];
specific.additionalSources = ['https://dechra.cld.bz/all-pages-english-v2-pdf/254-255'];

const royalCaninTreat = blank('royal-canin-urinary-treat', 'Royal Canin Urinary S/O Treats · EU 230 g',
  'https://www.royalcanin.com/uk/dogs/products/vet-products/treats-compatible-with-urinary-so-diets-8048',
  'EU complementary treat, not the different North American Urinary Canine Treats formula. Manufacturer: 2995 kcal/kg, protein 18%, fat 5.4%, crude fibre 2.4%, ash 6.8%, sodium 1.1%, moisture 18%. Owner measured 1 piece = 1.67 g, giving 5.00165 kcal; this takes priority over the nominal manufacturer 4 kcal/piece. For 2–5 kg dogs the manufacturer lists at most 4 pieces/day: the default suggestion cap is 6.68 g for Teddy, editable if his weight or piece size changes. Its stated compatibility covers Royal Canin Urinary S/O diets; compatibility with Hill’s is not established by this label. Other minerals/vitamins are unpublished and modeled with low confidence.');
royalCaninTreat.units = [{label:'piece',grams:1.67}];
royalCaninTreat.nutrients = {energy:299.5,protein:18,fat:5.4,fiber:2.4,sodium:1100,water:18};
royalCaninTreat.additionalSources = ['https://www.zoocentrs.lv/royal-canin-vhn-dog-urinary-treats-230g-gardumi-suniem-urincelu-dietai'];

const nutrafibre = blank('nutrafibre', 'Nutrafibre · Nutravet fibre supplement',
  'https://nutravet.com/wp-content/uploads/2023/09/Nutrafibre-A5datasheets-2023.pdf',
  'Manufacturer composition per 10 g: dried apple 5 g, sugar beet pulp 2.75 g, psyllium husk 1 g, hydrolysed fish protein 0.5 g, yeast extract 0.5 g, inulin 0.162 g, Bacillus velezensis C-3102 2 × 10^8 CFU. One rounded scoop = 10 g; half scoop = 5 g. These are measurement conversions, not a dose recommendation. No full analytical or calorie declaration was found: every nutritional value is a low-confidence ingredient-model estimate, not a Nutrafibre assay. Fibre estimates describe total dietary fibre, which differs from crude fibre on pet-food labels. Log the amount actually given; excluded from automatic portion suggestions.');
nutrafibre.role = 'supplement';
nutrafibre.units = [{label:'scoop',grams:10},{label:'half scoop',grams:5}];
nutrafibre.additionalSources = ['https://mbhveikals.lv/lv/produkts/460857/Nutrafibre-400g'];

export const REFERENCE_FOODS = { ...copy(USDA_FOODS), eggWhite, curd, puree, optimix, yogurt, specific, royalCaninTreat, nutrafibre };
const hillsCd = blank('hills-0', 'Hill’s c/d Multicare · dry dog food, chicken (EU)',
  'https://www.hillspet.lv/dog-food/prescription-diet-cd-multicare-urinary-care-dry',
  'Hill’s Latvia average as-fed table checked 2026-09-25: 377 kcal/100 g. EU canine chicken formula; check against your bag if the formula changes. Fibre is crude fibre, not total dietary fibre. The corresponding Hill’s UK label supplies added trace-mineral amounts, not total analysis. Estimated totals use comparable-food data with those declarations as floors. Unreported vitamins and amino/fatty acids use separately labelled proxies; they are not Hill’s measurements.');
hillsCd.complete = true;
hillsCd.nutrients = {energy:377,water:8,protein:20,fat:15.2,carbs:50.6,fiber:1.8,calcium:610,phosphorus:480,potassium:690,sodium:220,magnesium:91,chloride:570,
  vitaminA:1089.2,vitaminD:82.9,vitaminE:59.9,vitaminC:0,iron:7.64,iodine:.12,copper:.75,manganese:.79,zinc:15.8,selenium:20};
hillsCd.partialNutrients = ['iron','iodine','copper','manganese','zinc','selenium'];
hillsCd.additionalSources = ['https://www.hillspet.co.uk/dog-food/prescription-diet-cd-multicare-urinary-care-dry'];
const hillsMetabolic = blank('hills-1', 'Hill’s c/d Multicare + Metabolic · dry dog food (EU)',
  'https://www.hillspet.lv/dog-food/prescription-diet-cd-multicare-metabolicy-urinary-care-dry',
  'EU canine Original formula, current manufacturer data checked 2026-09-25: 3102 kcal/kg, protein 25.6%, fat 10.8%, crude fibre 13.2%, ash 5.1%, NFE 36.8%, average magnesium 0.069%. Moisture 8.5% is inferred by mass balance, not directly declared. NFE excludes crude fibre and is not a strict dietary-fibre-excluded carbohydrate assay. Vitamin A follows the declared 9566 IU/kg without adding separate carotene (2 mg/kg) again. Vitamin E 675 mg/kg uses an explicitly uncertain 1 IU/mg feed-grade acetate assumption. Trace minerals are added amounts, not total analysis. Unreported nutrients use separately labelled proxies, not Hill’s measurements.');
hillsMetabolic.complete = true;
hillsMetabolic.nutrients = {energy:310.2,water:8.5,protein:25.6,fat:10.8,carbs:36.8,fiber:13.2,calcium:740,phosphorus:530,sodium:230,potassium:750,magnesium:69,chloride:590,
  vitaminA:956.6,vitaminD:71.5,vitaminE:67.5,iron:8.24,iodine:.13,copper:.81,manganese:.85,zinc:17.1,selenium:20};
hillsMetabolic.partialNutrients = ['iron','iodine','copper','manganese','zinc','selenium'];
hillsMetabolic.estimatedNutrients = ['water','carbs','vitaminE'];
hillsMetabolic.estimates = {
  water:{method:'Residual from rounded manufacturer as-fed values: 100 − protein 25.6 − fat 10.8 − NFE 36.8 − crude fibre 13.2 − ash 5.1 = 8.5 g; moisture is not directly declared.',source:hillsMetabolic.source,confidence:'low'},
  vitaminE:{method:'Manufacturer declares 67.5 mg/100 g, with no form. Assumes feed-grade all-rac-alpha-tocopheryl acetate at 1 IU/mg. If natural alpha-tocopherol, activity would be 100.575 IU instead. Modeled conversion, not a published IU total.',source:hillsMetabolic.source,confidence:'low'}
};
hillsMetabolic.additionalSources = ['https://www.hillspet.co.uk/dog-food/prescription-diet-cd-multicare-metabolicy-urinary-care-dry'];
const originalReferences = copy(REFERENCE_FOODS), originalHills = copy([hillsCd,hillsMetabolic]);
applyFoodEstimates(REFERENCE_FOODS, [hillsCd,hillsMetabolic]);
export function seedFoods(estimated = true) {
  return [...copy(estimated ? [hillsCd,hillsMetabolic] : originalHills), ...Object.entries(estimated ? REFERENCE_FOODS : originalReferences).filter(([key]) => !key.endsWith('Proxy') && !['carrotCooked','beansCooked'].includes(key)).map(([, f]) => copy(f))];
}

// The ranges describe the submitted recipes' alternatives. They are not clinical
// minimums/maximums and are never scaled to force recipe energy to 240 kcal.
export function deriveRecipe(recipeNumber, estimated = true) {
  const foods = estimated ? REFERENCE_FOODS : originalReferences;
  const variants = [];
  const eggs = recipeNumber === 2 ? [['egg', 15], ['quail', 9]] : [null];
  for (const grain of ['rice','pasta','quinoa']) for (const vegetable of ['zucchini','pumpkin'])
    for (const berry of [['blueberry', 4.08], ['raspberry', 3.8]]) for (const egg of eggs)
      for (const banana of recipeNumber === 1 ? [false,true] : [false]) {
        const parts = [['chicken',75],['heart',20],['gizzard',15],['liver',5],
          [grain,banana ? 10 : 15],[vegetable,15],berry,['optimix',2]];
        if (banana) parts.push(['banana',10]);
        if (egg) parts.push(egg);
        variants.push(parts);
      }
  const ids = new Set(variants.flatMap(parts => parts.flatMap(([key]) => Object.keys(foods[key].nutrients))));
  const ranges = {};
  for (const id of ids) {
    const missing = new Set();
    const amounts = variants.map(parts => parts.reduce((sum, [key, grams]) => {
      const value = foods[key].nutrients[id];
      if (value === undefined) { missing.add(foods[key].name); return sum; }
      if (foods[key].partialNutrients?.includes(id)) missing.add(`${foods[key].name} (declared additions only)`);
      return sum + value * grams / 100;
    }, 0));
    ranges[id] = { min: Math.min(...amounts), max: Math.max(...amounts), missing: [...missing] };
  }
  return { ranges, variants: variants.length };
}
