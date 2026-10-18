// General adult food references, not a prescription for Teddy's diseases.
export const GUIDANCE_SOURCE='https://europeanpetfood.org/wp-content/uploads/2025/09/FEDIAF-Nutritional-Guidelines_2025-ONLINE.pdf';
export const MERCK_NUTRITION='https://www.merckvetmanual.com/management-and-nutrition/nutrition-small-animals/nutritional-requirements-of-small-animals';
export const DEFAULT_PRIORITIES=['protein','fat','calcium','phosphorus','linoleic'];
// FEDIAF 2025 VII-11, printed p58, per kg body weight^0.75.
// Fat instead uses III-3b: FEDIAF explicitly does not increase its density for low MER.
export const metabolicMin={
  protein:4.95,linoleic:.36,calcium:140,phosphorus:110,potassium:140,sodium:30,chloride:40,magnesium:20,
  copper:.20,iodine:.03,iron:1,manganese:.16,selenium:6.4,zinc:2,
  vitaminA:167,vitaminD:15.2,vitaminE:1,b1:.06,b2:.17,b5:.39,b6:.04,b12:.92,b3:.45,b9:7.10,choline:45,
  arginine:.14,histidine:.06,isoleucine:.13,leucine:.23,lysine:.12,methionine:.11,methionineCystine:.21,
  phenylalanine:.15,phenylalanineTyrosine:.24,threonine:.14,tryptophan:.05,valine:.16
};
// Adult nutritional maxima (N), III-3b p16, app units per 1,000 kcal.
export const nutritionalMax={calcium:6250,phosphorus:4000,vitaminA:100000,vitaminD:800};
// Product legal maxima (L), III-3a p15, per 100 g DRY MATTER.
// These are not daily safe intakes, not used as optimizer bounds, and must not
// be converted with an assumed 4 kcal/g for Teddy's mixed foods.
export const productMaxDM={copper:2.8,iodine:1.1,iron:68.18,manganese:17,selenium:56.8,zinc:22.7,vitaminD:227};
export const guidanceNotes={
  energy:'Nutritionist allowance: 240 kcal on a normal day. Activity presets are personal estimates.',
  protein:'Recommended allowance, not a narrow protein band. Digestibility and amino acids matter. No general adult upper in FEDIAF; urinary advice depends on stone type.',
  fat:'General minimum 13.75 g/1,000 kcal. No universal upper; gallbladder history makes total fat a priority for an individualized ceiling.',
  carbs:'No numerical adult carbohydrate requirement or upper in these standards; energy, tolerance and the whole formulation matter.',
  sugars:'No separate canine daily minimum or maximum in these standards. Included within carbohydrate and calories.',
  saturatedFat:'No separate canine daily target in these standards. Track as part of total fat, without applying human saturated-fat limits.',
  fiber:'No universal daily gram range. Type, stool response and diet purpose matter; crude fibre and total dietary fibre are not equivalent.',
  water:'Food moisture only; drinking is unmeasured. No hydration adequacy claim or water tracking.',
  linoleic:'Essential fatty acid minimum. FEDIAF early-growth upper does not apply to this adult dog.',
  ala:'FEDIAF gives no numerical adult omega-3 recommendation. Puppy values are not adult requirements.',
  epaDha:'No numerical adult FEDIAF range. Therapeutic fish-oil doses require separate review and also add fat; no automatic supplementation.',
  calcium:'General adult maximum, not a urinary treatment target. Check Ca:P together; neither blanket restriction nor extra calcium follows from unidentified sand.',
  phosphorus:'General adult maximum, not a renal prescription. Source matters: soluble inorganic phosphate differs from food-bound phosphorus.',
  potassium:'General allowance. No FEDIAF adult nutritional upper; kidney function and medicines can change the clinical assessment.',
  sodium:'No nutritional maximum set. FEDIAF discusses tested levels, not a universal upper. Do not independently salt-load or restrict a urinary diet.',
  chloride:'No nutritional maximum set. Product concentration and salt balance matter; no urine-acidification prescription is inferred.',
  magnesium:'General allowance; no adult nutritional upper set. A struvite-specific restriction is not inferred from unidentified prior sand.',
  copper:'General allowance. A product legal maximum is separate from a safe daily intake. Liver imaging alone does not diagnose copper accumulation.',
  iodine:'General allowance. Product legal maximum is shown separately; avoid using the absence of a nutritional upper to justify extra iodine.',
  iron:'General allowance. No FEDIAF nutritional upper; a low hematocrit alone does not establish dietary iron deficiency.',
  manganese:'General allowance. Product legal maximum is separate; exceeding the recipe amount is not itself an excess warning.',
  selenium:'Uses the wet/mixed-diet allowance. Dry-only VII-11 allowance is 5.2 µg/kg^0.75. Legal organic-selenium addition rules differ from total selenium.',
  zinc:'General allowance. Interacts with calcium/copper; the product legal maximum is not a personal daily prescription.',
  vitaminA:'General nutritional upper is very broad and is not a feeding goal. Track liver and supplement contributions; activity conversions include assumptions.',
  vitaminD:'General nutritional upper; the lower EU product legal concentration is listed separately. Avoid unreviewed vitamin D supplementation.',
  vitaminE:'Baseline allowance can rise with polyunsaturated fat/fish-oil intake; no fixed adult upper in FEDIAF. IU depends on vitamin form.',
  vitaminC:'Dogs synthesize vitamin C; no routine dietary requirement in these standards. No supplement dose is inferred.',
  vitaminK:'No numerical adult FEDIAF dietary requirement; clinical deficiency or malabsorption needs separate assessment.',
  b7:'No numerical adult FEDIAF biotin requirement. Antimicrobial or antivitamin factors can change needs.',
  b1:'General allowance; preparation and thiaminase can affect availability. No FEDIAF adult upper set.',
  b2:'General allowance; no FEDIAF adult upper set.',
  b5:'General allowance; no FEDIAF adult upper set.',
  b6:'General allowance; no FEDIAF adult upper set. This does not establish safety of high-dose supplements.',
  b12:'General allowance; absorption disorders need separate assessment. No FEDIAF adult upper set.',
  b3:'General allowance; no FEDIAF adult upper set.',
  b9:'General allowance; no FEDIAF adult upper set.',
  choline:'General allowance; no FEDIAF adult upper set.',
  arginine:'Base allowance rises by 0.01 g for each gram of protein above its reference. The audit adjusts this lower comparison using logged/projected protein.',
  histidine:'General adult amino-acid allowance; no numerical adult upper in FEDIAF.',
  isoleucine:'General adult amino-acid allowance; no numerical adult upper in FEDIAF.',
  leucine:'General adult amino-acid allowance; no numerical adult upper in FEDIAF.',
  lysine:'General adult allowance. FEDIAF puppy upper is not applied to Teddy.',
  methionine:'General adult allowance; formulation and taurine supply affect interpretation. Not an instruction to acidify urine.',
  methionineCystine:'Combined allowance, alongside methionine alone; not an additional amount to add. FEDIAF notes dependence on dietary taurine.',
  phenylalanine:'General adult amino-acid allowance; no numerical adult upper in FEDIAF.',
  phenylalanineTyrosine:'Combined allowance, alongside phenylalanine alone; not an additional amount to add.',
  threonine:'General adult amino-acid allowance; no numerical adult upper in FEDIAF.',
  tryptophan:'General adult allowance; kitten upper limits do not apply.',
  valine:'General adult amino-acid allowance; no numerical adult upper in FEDIAF.'
};
export function adultTargets(weight=4.8) {
  const targets=Object.fromEntries(Object.entries(metabolicMin).map(([id,value])=>[id,{min:Number((value*weight**.75).toFixed(6)),max:null,basis:'day',origin:'adult-guidance'}]));
  targets.fat={min:13.75,max:null,basis:'per1000',origin:'adult-guidance'};
  for(const [id,max] of Object.entries(nutritionalMax))Object.assign(targets[id],{max,maxBasis:'per1000'});
  return targets;
}
