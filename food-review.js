// Frozen pre-review defaults identify untouched fields; never replace user edits or diary snapshots.
// Source baseline: docs/archive/2026-09-25-independent-food-audit/comparison/baseline-current.json.
export const REVIEW_BASELINE = {
  "foods": {
    "seed-hills-1": {
      "name": "Hill’s c/d Multicare + Metabolic · dry dog food (EU)",
      "source": "https://www.hillspet.co.il/dog-food/prescription-diet-cd-multicare-metabolicy-urinary-care-dry",
      "notes": "EU canine formula: manufacturer analytical declaration protein 25.6%, fat 10.8%, crude fibre 13.2%, ash 5.1%. Calories 310.2/100 g from the matching product label republished by NutriPetPlan and DocMorris (2026-09-25). Carbohydrate 37.3 g is an NFE estimate assuming 8% moisture: 100 − protein − fat − crude fibre − ash − moisture. Moisture and carbohydrate are estimates. Trace minerals are added amounts, not total analysis. Vitamin E form is not specified in the available declaration (mg); the IU estimate instead uses a published comparable diet. Unreported vitamins, amino/fatty acids and total trace minerals use separately labelled proxies; they are not Hill’s measurements.",
      "macros": {
        "energy": 310.2,
        "protein": 25.6,
        "fat": 10.8
      },
      "nutrients": {
        "water": 8,
        "carbs": 37.3,
        "magnesium": 70,
        "vitaminE": 54.9054,
        "sugars": 0.90120805
      }
    },
    "seed-chicken": {
      "name": "Chicken fillet · boiled, skinless",
      "source": "https://fdc.nal.usda.gov/food-details/171478/nutrients",
      "notes": "USDA SR Legacy FDC 171478: Chicken, broilers or fryers, breast, meat only, cooked, stewed. Per 100 g edible portion. Database averages; missing values are not zero. Carbohydrate is an estimated non-fibre amount: USDA total carbohydrate minus dietary fibre. Vitamin A uses canine FEDIAF activity conversions. Fatty-acid estimates use undifferentiated 18:2 / 18:3 where a specific isomer is unavailable. Additional chloride, iodine and biotin where available: UK CoFID 2021 18-307, Chicken, breast, casseroled, meat only. Comparable-food estimates; no cooking-retention correction. Trace and unavailable results remain unknown.",
      "macros": {
        "energy": 151,
        "protein": 28.98,
        "fat": 3.03
      },
      "nutrients": {
        "vitaminD": 4
      }
    },
    "seed-heart": {
      "name": "Chicken hearts · simmered",
      "source": "https://fdc.nal.usda.gov/food-details/171059/nutrients",
      "notes": "USDA SR Legacy FDC 171059: Chicken, heart, all classes, cooked, simmered. Per 100 g edible portion. Database averages; missing values are not zero. Carbohydrate is an estimated non-fibre amount: USDA total carbohydrate minus dietary fibre. Vitamin A uses canine FEDIAF activity conversions. Fatty-acid estimates use undifferentiated 18:2 / 18:3 where a specific isomer is unavailable.",
      "macros": {
        "energy": 185,
        "protein": 26.41,
        "fat": 7.92
      },
      "nutrients": {
        "vitaminA": 39.8827534
      }
    },
    "seed-zucchini": {
      "name": "Zucchini · boiled, drained, no salt",
      "source": "https://fdc.nal.usda.gov/food-details/169292/nutrients",
      "notes": "USDA SR Legacy FDC 169292: Squash, summer, zucchini, includes skin, cooked, boiled, drained, without salt. Per 100 g edible portion. Database averages; missing values are not zero. Carbohydrate is an estimated non-fibre amount: USDA total carbohydrate minus dietary fibre. Vitamin A uses canine FEDIAF activity conversions. Fatty-acid estimates use undifferentiated 18:2 / 18:3 where a specific isomer is unavailable. Additional chloride, iodine and biotin where available: UK CoFID 2021 13-628, Courgette, boiled in unsalted water. Comparable-food estimates; no cooking-retention correction. Trace and unavailable results remain unknown.",
      "macros": {
        "energy": 15,
        "protein": 1.14,
        "fat": 0.36
      },
      "nutrients": {
        "carbs": 1.69
      }
    },
    "seed-mango": {
      "name": "Mango · flesh, raw",
      "source": "https://fdc.nal.usda.gov/food-details/169910/nutrients",
      "notes": "USDA SR Legacy FDC 169910: Mangos, raw. Per 100 g edible portion. Database averages; missing values are not zero. Carbohydrate is an estimated non-fibre amount: USDA total carbohydrate minus dietary fibre. Vitamin A uses canine FEDIAF activity conversions. Fatty-acid estimates use undifferentiated 18:2 / 18:3 where a specific isomer is unavailable. Additional chloride, iodine and biotin where available: UK CoFID 2021 14-378, Mangoes, ripe, flesh only, raw. Comparable-food estimates; no cooking-retention correction. Trace and unavailable results remain unknown.",
      "macros": {
        "energy": 60,
        "protein": 0.82,
        "fat": 0.38
      },
      "nutrients": {
        "carbs": 13.38
      }
    },
    "seed-egg": {
      "name": "Chicken egg · hard-boiled, shell removed",
      "source": "https://fdc.nal.usda.gov/food-details/173424/nutrients",
      "notes": "USDA SR Legacy FDC 173424: Egg, whole, cooked, hard-boiled. Per 100 g edible portion. Database averages; missing values are not zero. Carbohydrate is an estimated non-fibre amount: USDA total carbohydrate minus dietary fibre. Vitamin A uses canine FEDIAF activity conversions. Fatty-acid estimates use undifferentiated 18:2 / 18:3 where a specific isomer is unavailable. Default 1 egg = 50 g edible weight; edit to match the actual item. Additional chloride, iodine and biotin where available: UK CoFID 2021 12-940, Eggs, chicken, whole, boiled. Comparable-food estimates; no cooking-retention correction. Trace and unavailable results remain unknown.",
      "macros": {
        "energy": 155,
        "protein": 12.58,
        "fat": 10.61
      },
      "nutrients": {
        "vitaminD": 88
      }
    },
    "seed-quail": {
      "name": "Quail egg · boiled, shell removed (raw-data estimate)",
      "source": "https://fdc.nal.usda.gov/food-details/172191/nutrients",
      "notes": "USDA SR Legacy FDC 172191: Egg, quail, whole, fresh, raw. Per 100 g edible portion. Database averages; missing values are not zero. Carbohydrate is an estimated non-fibre amount: USDA total carbohydrate minus dietary fibre. Vitamin A uses canine FEDIAF activity conversions. Fatty-acid estimates use undifferentiated 18:2 / 18:3 where a specific isomer is unavailable. Cooked quail data are not used: this is explicitly a raw-composition proxy for a boiled egg; cooking losses and water change are not quantified. Default 1 egg = 9 g edible weight; edit to match the actual item. Additional chloride, iodine and biotin where available: UK CoFID 2021 12-815, Eggs, quail, whole, raw. Comparable-food estimates; no cooking-retention correction. Trace and unavailable results remain unknown.",
      "macros": {
        "energy": 158,
        "protein": 13.05,
        "fat": 11.09
      },
      "nutrients": {
        "vitaminD": 56
      }
    },
    "seed-salmon": {
      "name": "Salmon · oven-baked, Atlantic farmed, plain",
      "source": "https://fdc.nal.usda.gov/food-details/175168/nutrients",
      "notes": "USDA SR Legacy FDC 175168: Fish, salmon, Atlantic, farmed, cooked, dry heat. Per 100 g edible portion. Database averages; missing values are not zero. Carbohydrate is an estimated non-fibre amount: USDA total carbohydrate minus dietary fibre. Vitamin A uses canine FEDIAF activity conversions. Fatty-acid estimates use undifferentiated 18:2 / 18:3 where a specific isomer is unavailable. Plain oven-baked edible flesh; bones and skin removed, no added oil or salt. Wild salmon, skin-on portions and added fats can differ. Additional chloride, iodine and biotin where available: UK CoFID 2021 16-359, Salmon, farmed, flesh only, baked. Comparable-food estimates; no cooking-retention correction. Trace and unavailable results remain unknown.",
      "macros": {
        "energy": 206,
        "protein": 22.1,
        "fat": 12.35
      },
      "nutrients": {
        "vitaminD": 524
      }
    },
    "seed-curd": {
      "name": "Vājpiena biezpiens 0.5% · Baltais reference",
      "source": "https://www.baltais.lv/catalog/pamata-piena-produkti/biezpiens/225/?lang=en",
      "notes": "Brand can vary. Initial macros use Baltais 0.5% 400 g (EAN 4750072062258): 96 kcal, protein 19 g, fat 0.5 g, saturates 0.3 g, carbohydrate/sugars 4 g, salt 0.20 g per 100 g. Sodium 80 mg inferred from salt / 2.5. Most remaining nutrients are unscaled generic USDA nonfat dry-curd estimates (FDC 172181), NOT measurements of Baltais or another Latvian brand. Update the label when the product changes. Micronutrients, fatty acids, amino acids and moisture may differ materially between brands. Additional chloride, iodine and biotin where available: UK CoFID 2021 12-174, Cheese, Quark. Comparable-food estimates; no cooking-retention correction. Trace and unavailable results remain unknown.",
      "macros": {
        "energy": 96,
        "protein": 19,
        "fat": 0.5
      },
      "nutrients": {
        "water": 81.01,
        "arginine": 0.462,
        "histidine": 0.303,
        "isoleucine": 0.549,
        "leucine": 1.037,
        "lysine": 0.868,
        "methionine": 0.25,
        "phenylalanine": 0.536,
        "threonine": 0.465,
        "tryptophan": 0.137,
        "valine": 0.695,
        "methionineCystine": 0.311,
        "phenylalanineTyrosine": 1.097
      }
    },
    "seed-optimix": {
      "name": "Vitamin Optimix Cani Cooking",
      "source": "https://www.futtermedicus.de/vitamin-optimix-cani-cooking-250g-1-1-02-00250",
      "notes": "Manufacturer declaration checked 2026-09-25. Minerals are analytical constituents; vitamins and trace minerals are declared added amounts, not a complete analysis. Undeclared nutrients and energy use separately documented estimates. Vitamin E uses 1 IU/mg for all-rac-alpha-tocopheryl acetate. B vitamins are used as the declared vitamin amounts. Recipe amount is 2 g/day; this library entry does not recommend a dose. Excluded from automatic portion suggestions.",
      "macros": {
        "energy": 80,
        "protein": 0,
        "fat": 0
      },
      "nutrients": {
        "b1": 17,
        "b5": 120,
        "b6": 17
      }
    },
    "seed-yogurt": {
      "name": "Greek yogurt · Baltais plain 2%",
      "source": "https://www.baltais.lv/catalog/jogurti/jogurti-bez-piedevam/1098/",
      "notes": "Owner’s 400 g label: milk and starter culture; 62 kcal, fat 2 g, saturates 1.1 g, carbohydrate/sugars 2.3 g, protein 8.7 g, salt 0.20 g per 100 g. Protein follows the supplied label rather than the manufacturer website’s rounded 9 g. Sodium = salt / 2.5. Remaining values use plain lowfat Greek yogurt USDA FDC170903 and CoFID 12-555 Greek-style yogurt, not Baltais measurements. Log grams as eaten.",
      "macros": {
        "energy": 62,
        "protein": 8.7,
        "fat": 2
      },
      "nutrients": {
        "water": 83.56
      }
    },
    "seed-specific-treat": {
      "name": "SPECIFIC Hypoallergenic Treats · UK / IE",
      "source": "https://www.specific-diets.co.uk/dog/everyday-diets/ct-hy-hypoallergenic-treats",
      "notes": "CT-HY complementary treat. Owner’s label: 337 kcal, protein 18.9 g, fat 8 g, crude fibre 4 g, ash 6.8 g, calcium 0.80 g, phosphorus 0.70 g per 100 g. Current UK manufacturer page adds NFE carbohydrate 53.8 g, moisture 8.5 g, sodium 0.60 g, total omega-3 0.12 g and n-3:n-6 ratio 1:8. Owner’s piece weight: 1.3 g (4.381 kcal). Manufacturer guidance: up to 10% of daily energy, reducing other food accordingly; other treats share this allowance. Remaining nutrients are documented estimates. The technical book may describe an older formulation: its vitamin D (61 IU/100 g) is lower than the supplied label’s added D3 (83.4 IU/100 g); the current label takes priority.",
      "macros": {
        "energy": 337,
        "protein": 18.9,
        "fat": 8
      },
      "nutrients": {
        "vitaminE": 26.82
      }
    }
  },
  "profiles": [
    {
      "name": "Nutritionist Plan 1",
      "author": "Nutritionist recipes · calculated estimates",
      "targets": {
        "b1": {
          "min": 0.412816,
          "max": 0.42676,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "b5": {
          "min": 3.816159,
          "max": 3.892252,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "b6": {
          "min": 0.71594,
          "max": 0.763022,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "carbs": {
          "min": 3.69872,
          "max": 6.456772,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "vitaminA": {
          "min": 1271.322399,
          "max": 1452.624515,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "vitaminD": {
          "min": 64.635097,
          "max": 64.635097,
          "basis": "day",
          "kind": "reference",
          "partial": false
        }
      }
    },
    {
      "name": "Nutritionist Plan 2",
      "author": "Nutritionist recipes · calculated estimates",
      "targets": {
        "b1": {
          "min": 0.422716,
          "max": 0.43846,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "b5": {
          "min": 3.974649,
          "max": 4.088052,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "b6": {
          "min": 0.72944,
          "max": 0.750622,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "carbs": {
          "min": 3.73562,
          "max": 6.053772,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "vitaminA": {
          "min": 1318.647069,
          "max": 1525.958115,
          "basis": "day",
          "kind": "reference",
          "partial": false
        },
        "vitaminD": {
          "min": 69.675097,
          "max": 77.835097,
          "basis": "day",
          "kind": "reference",
          "partial": false
        }
      }
    }
  ]
};
