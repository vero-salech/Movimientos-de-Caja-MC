export const seedMatrix = {
    Egreso: {
        "SEDE - Gastos Fijos": [1577666, 1888340, 986513, 1815000, 1815000, 1815000, 1935471, 1935471, 1935471, 2049888, 2049888, 2049888],
        "SEDE - Servicios": [799844, 475622, 4823848, 932071, 2805113, 1209385, 2357515, 4155143, 4035129, 2985993, 9404795, 10739299],
        "RRHH": [3045004, 2681245, 3382081, 3980672, 4559879, 3879415, 3657101, 4082980, 2906761, 4053573, 3033474, 5203891]
    },
    Ingreso: {
        "INGRESOS POR TALLERES": [0, 0, 0, 0, 10000, 75000, 0, 105000, 0, 0, 0, 180000],
        "INGRESOS POR ECOs": [0, 90000, 90000, 123000, 50000, 200000, 0, 0, 0, 0, 180000, 0],
        "INGRESOS POR CUOTA CLUB": [770800, 676400, 874970, 835870, 926620, 858500, 898420, 1003670, 825240, 866240, 738440, 1189145],
        "INGRESOS POR U.V": [1485000, 1203000, 1400000, 3350400, 2020000, 1714160, 2149000, 1417000, 1986000, 2288000, 2486000, 2007000],
        "DISPENSARIO": [2180000, 5300000, 4545000, 3567000, 2211500, 2320000, 3403000, 3246000, 4045000, 4795000, 5730000, 13325000],
        "DONACIONES": [202800, 195840, 215390, 189740, 236950, 238790, 237800, 267450, 767580, 818920, 216970, 326170],
        "CAPACITA/UNPAZ": [156834, 0, 1786100, 484000, 571500, 208500, 1419500, 1352500, 667500, 1293000, 672000, 406500],
        "INGRESOS POR VENTAS": [383500, 117600, 950100, 518900, 305800, 232390, 16000, 123500, 169000, 16628341, 442777, 0],
        "SEMAS": [37200, 49000, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]
    }
};

export const generateSeedRecords = (categoriesObj) => {
    const records = [];
    let idCounter = 1;
    const generateId = () => `seed-2025-${Date.now()}-${idCounter++}`;

    ["Egreso", "Ingreso"].forEach(tipo => {
        Object.keys(seedMatrix[tipo]).forEach(cat => {
            const vals = seedMatrix[tipo][cat];
            const defaultSub = categoriesObj[tipo][cat] ? categoriesObj[tipo][cat][0] : "Otros";
            vals.forEach((amt, idx) => {
                if (amt > 0) {
                    const monthStr = String(idx + 1).padStart(2, '0');
                    records.push({
                        id: generateId(),
                        date: `2025-${monthStr}-01`,
                        type: tipo,
                        category: cat,
                        subcategory: defaultSub,
                        concept: 'Importación 2025',
                        amount: amt
                    });
                }
            });
        });
    });
    return records;
};
