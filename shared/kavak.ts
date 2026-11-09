export interface KavakVehicle {
  stockId: string
  vin: string
  make: string
  model: string
  trim: string
  year: number
  priceMxn: number
  mileageKm: number
  transmission: 'Automática' | 'Manual' | 'CVT' | 'DCT'
  fuelType: 'Gasolina' | 'Híbrido' | 'Eléctrico'
  horsepower: number
  hub: string
  city: string
  status: 'disponible' | 'apartado' | 'en_inspeccion_240_puntos' | 'entregado'
  inspection240: 'aprobada' | 'en_proceso'
  inspectionPointsPassed: number
  warrantyIncluded: string
  warrantyDays: number
  kavakTotalEligible: boolean
  minDownPaymentPct: number
  minDownPaymentMxn: number
  annualRatePct: number
  monthlyPayment48Mxn: number
}

export interface KavakOrder {
  orderId: string
  customer: string
  stockId: string
  vehicleSummary: string
  status:
    | 'entregado'
    | 'financiamiento_en_validacion'
    | 'apartado_en_acondicionamiento'
  daysSinceDelivery: number
  kmSinceDelivery: number
  returnPolicyStatus:
    | 'elegible_7_dias_o_300_km'
    | 'vencida_excede_7_dias_y_300_km'
    | 'pendiente_entrega'
    | 'reembolso_100_de_apartado'
  activeWarranty: string
  warrantyDays: number
  priceMxn: number
  downPaymentPct: number
  downPaymentMxn: number
  monthlyPaymentMxn: number
  termMonths: number
  financingStatus: string
  hub: string
  notes: string
}

export interface KavakPolicy {
  policyId: string
  title: string
  category: 'devolucion' | 'garantia' | 'inspeccion' | 'financiamiento'
  rule: string
  strictLimits: string
}

export interface KavakNumericTarget {
  field: string
  label: string
  exactValue: number
  unit: string
}

export interface KavakNumericResidual {
  field: string
  label: string
  expected: number
  observed: number | null
  absoluteError: number
  relativeError: number
  unit: string
}

export interface KavakScenario {
  id: string
  cycleOrder: number
  title: string
  customer: string
  orderId: string
  stockId: string
  scenarioContext: string
  customerMessage: string
  expectedFacts: string[]
  numericTargets: KavakNumericTarget[]
  forbiddenClaims: string[]
  referenceAnswer: string
}

export interface KavakEvaluationResult {
  scenarioId: string
  orderId: string
  stockId: string
  matchedFacts: string[]
  missingFacts: string[]
  violatedClaims: string[]
  numericResiduals: KavakNumericResidual[]
  mape: number
  rmse: number
  stdError: number
  precision: number
  recall: number
  f1: number
  factCoverage: number
  score: number
  passed: boolean
  statisticalFeedback: string
}

export const kavakVehicles: KavakVehicle[] = [
  {
    stockId: 'KVK-1042',
    vin: '3MZBPACL8NM104201',
    make: 'Mazda',
    model: 'Mazda 3',
    trim: 'i Grand Touring Sedán',
    year: 2022,
    priceMxn: 348000,
    mileageKm: 28400,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 186,
    hub: 'Sede Lerma',
    city: 'Estado de México',
    status: 'entregado',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 52200,
    annualRatePct: 14.9,
    monthlyPayment48Mxn: 8240
  },
  {
    stockId: 'KVK-2089',
    vin: '3VV2B7AX9MM208914',
    make: 'Volkswagen',
    model: 'Tiguan',
    trim: 'Comfortline',
    year: 2021,
    priceMxn: 415000,
    mileageKm: 41200,
    transmission: 'DCT',
    fuelType: 'Gasolina',
    horsepower: 150,
    hub: 'Sede Antara Fashion Hall',
    city: 'CDMX',
    status: 'entregado',
    inspection240: 'aprobada',
    inspectionPointsPassed: 239,
    warrantyIncluded: 'Garantía Básica 90 días (motor y transmisión)',
    warrantyDays: 90,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 62250,
    annualRatePct: 15.2,
    monthlyPayment48Mxn: 8420
  },
  {
    stockId: 'KVK-3115',
    vin: '5YFB4MDE6PP311509',
    make: 'Toyota',
    model: 'Corolla',
    trim: 'SE',
    year: 2023,
    priceMxn: 389000,
    mileageKm: 15100,
    transmission: 'CVT',
    fuelType: 'Gasolina',
    horsepower: 169,
    hub: 'Sede Patio Santa Fe',
    city: 'CDMX',
    status: 'apartado',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 77800,
    annualRatePct: 13.9,
    monthlyPayment48Mxn: 8490
  },
  {
    stockId: 'KVK-4090',
    vin: '3N1CP5BV1LL409022',
    make: 'Nissan',
    model: 'Kicks',
    trim: 'Advance',
    year: 2020,
    priceMxn: 279000,
    mileageKm: 54000,
    transmission: 'CVT',
    fuelType: 'Gasolina',
    horsepower: 118,
    hub: 'Sede Midtown Guadalajara',
    city: 'Guadalajara',
    status: 'en_inspeccion_240_puntos',
    inspection240: 'en_proceso',
    inspectionPointsPassed: 212,
    warrantyIncluded: 'Garantía Básica 90 días (motor y transmisión)',
    warrantyDays: 90,
    kavakTotalEligible: false,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 55800,
    annualRatePct: 16.4,
    monthlyPayment48Mxn: 6410
  },
  {
    stockId: 'KVK-5120',
    vin: '7FARW2H89NE512088',
    make: 'Honda',
    model: 'CR-V',
    trim: 'Turbo Plus',
    year: 2022,
    priceMxn: 512000,
    mileageKm: 22900,
    transmission: 'CVT',
    fuelType: 'Gasolina',
    horsepower: 188,
    hub: 'Sede Nuevo Sur Monterrey',
    city: 'Monterrey',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 76800,
    annualRatePct: 14.5,
    monthlyPayment48Mxn: 11980
  },
  {
    stockId: 'KVK-5410',
    vin: '3KPF24AD2NE541011',
    make: 'KIA',
    model: 'Forte',
    trim: 'GT Line HB',
    year: 2023,
    priceMxn: 364000,
    mileageKm: 19800,
    transmission: 'CVT',
    fuelType: 'Gasolina',
    horsepower: 147,
    hub: 'Sede Portal San Ángel',
    city: 'CDMX',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 54600,
    annualRatePct: 14.8,
    monthlyPayment48Mxn: 8610
  },
  {
    stockId: 'KVK-5820',
    vin: 'KM8J3CA46NU582019',
    make: 'Hyundai',
    model: 'Tucson',
    trim: 'Limited Tech',
    year: 2022,
    priceMxn: 468000,
    mileageKm: 31500,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 187,
    hub: 'Sede Punta Norte',
    city: 'Estado de México',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 238,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 70200,
    annualRatePct: 14.9,
    monthlyPayment48Mxn: 11080
  },
  {
    stockId: 'KVK-6104',
    vin: '3GNCJPSB8NL610433',
    make: 'Chevrolet',
    model: 'Tracker',
    trim: 'Premier Turbo',
    year: 2023,
    priceMxn: 356000,
    mileageKm: 16400,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 130,
    hub: 'Sede Explanada Puebla',
    city: 'Puebla',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 53400,
    annualRatePct: 15.1,
    monthlyPayment48Mxn: 8460
  },
  {
    stockId: 'KVK-6390',
    vin: '3FMCR9B65NR639077',
    make: 'Ford',
    model: 'Bronco Sport',
    trim: 'Big Bend 4x4',
    year: 2022,
    priceMxn: 549000,
    mileageKm: 27300,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 181,
    hub: 'Sede Fashion Drive Monterrey',
    city: 'Monterrey',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 109800,
    annualRatePct: 14.2,
    monthlyPayment48Mxn: 12050
  },
  {
    stockId: 'KVK-6712',
    vin: '3MW5R1J07N8671245',
    make: 'BMW',
    model: 'Serie 3',
    trim: '320i Sport Line',
    year: 2021,
    priceMxn: 585000,
    mileageKm: 34800,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 184,
    hub: 'Sede Antara Fashion Hall',
    city: 'CDMX',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 117000,
    annualRatePct: 14.6,
    monthlyPayment48Mxn: 12940
  },
  {
    stockId: 'KVK-7025',
    vin: 'WAUB8GFF9MA702512',
    make: 'Audi',
    model: 'A3',
    trim: 'Dynamic 35 TFSI',
    year: 2022,
    priceMxn: 528000,
    mileageKm: 24100,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 150,
    hub: 'Sede Patio Santa Fe',
    city: 'CDMX',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 239,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 105600,
    annualRatePct: 14.6,
    monthlyPayment48Mxn: 11680
  },
  {
    stockId: 'KVK-7318',
    vin: 'VSSZZZ5F1NR731890',
    make: 'SEAT',
    model: 'Ateca',
    trim: 'FR 1.4 TSI',
    year: 2022,
    priceMxn: 432000,
    mileageKm: 29600,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 150,
    hub: 'Sede Puerta la Victoria',
    city: 'Querétaro',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 64800,
    annualRatePct: 15.0,
    monthlyPayment48Mxn: 10240
  },
  {
    stockId: 'KVK-7640',
    vin: 'VSSZZZKM4PR764008',
    make: 'Cupra',
    model: 'Formentor',
    trim: 'VZ 2.0 TSI',
    year: 2023,
    priceMxn: 642000,
    mileageKm: 14200,
    transmission: 'DCT',
    fuelType: 'Gasolina',
    horsepower: 310,
    hub: 'Sede Antara Fashion Hall',
    city: 'CDMX',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 128400,
    annualRatePct: 14.1,
    monthlyPayment48Mxn: 14060
  },
  {
    stockId: 'KVK-7915',
    vin: 'JS2ZC63S8P6791534',
    make: 'Suzuki',
    model: 'Swift',
    trim: 'Boosterjet Sport',
    year: 2023,
    priceMxn: 334000,
    mileageKm: 18500,
    transmission: 'Manual',
    fuelType: 'Gasolina',
    horsepower: 138,
    hub: 'Sede Midtown Guadalajara',
    city: 'Guadalajara',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 50100,
    annualRatePct: 14.9,
    monthlyPayment48Mxn: 7910
  },
  {
    stockId: 'KVK-8190',
    vin: 'LSJW74U91NZ819044',
    make: 'MG',
    model: 'HS',
    trim: 'Trophy Pack',
    year: 2023,
    priceMxn: 372000,
    mileageKm: 21400,
    transmission: 'DCT',
    fuelType: 'Gasolina',
    horsepower: 160,
    hub: 'Sede Lerma',
    city: 'Estado de México',
    status: 'en_inspeccion_240_puntos',
    inspection240: 'en_proceso',
    inspectionPointsPassed: 198,
    warrantyIncluded: 'Garantía Básica 90 días (motor y transmisión)',
    warrantyDays: 90,
    kavakTotalEligible: false,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 74400,
    annualRatePct: 16.2,
    monthlyPayment48Mxn: 8510
  },
  {
    stockId: 'KVK-8450',
    vin: 'VF3MRHNS8NL845091',
    make: 'Peugeot',
    model: '3008',
    trim: 'GT Line THP',
    year: 2022,
    priceMxn: 486000,
    mileageKm: 26800,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 165,
    hub: 'Sede Portal San Ángel',
    city: 'CDMX',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 72900,
    annualRatePct: 14.8,
    monthlyPayment48Mxn: 11490
  },
  {
    stockId: 'KVK-8710',
    vin: 'LVVDB21B9PD871063',
    make: 'Chirey',
    model: 'Tiggo 7 Pro',
    trim: 'Luxury CVT',
    year: 2023,
    priceMxn: 369000,
    mileageKm: 17900,
    transmission: 'CVT',
    fuelType: 'Gasolina',
    horsepower: 154,
    hub: 'Sede Explanada Puebla',
    city: 'Puebla',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 238,
    warrantyIncluded: 'Garantía Básica 90 días (motor y transmisión)',
    warrantyDays: 90,
    kavakTotalEligible: true,
    minDownPaymentPct: 20,
    minDownPaymentMxn: 73800,
    annualRatePct: 15.8,
    monthlyPayment48Mxn: 8360
  },
  {
    stockId: 'KVK-9030',
    vin: 'LC0CE4DC5R0903017',
    make: 'BYD',
    model: 'Dolphin Mini',
    trim: 'Plus Eléctrico',
    year: 2024,
    priceMxn: 358000,
    mileageKm: 6800,
    transmission: 'Automática',
    fuelType: 'Eléctrico',
    horsepower: 74,
    hub: 'Sede Patio Santa Fe',
    city: 'CDMX',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 53700,
    annualRatePct: 13.5,
    monthlyPayment48Mxn: 8220
  },
  {
    stockId: 'KVK-9312',
    vin: 'JF2SKADC4NH931205',
    make: 'Subaru',
    model: 'Forester',
    trim: 'Touring EyeSight AWD',
    year: 2022,
    priceMxn: 495000,
    mileageKm: 30200,
    transmission: 'CVT',
    fuelType: 'Gasolina',
    horsepower: 182,
    hub: 'Sede Puerta la Victoria',
    city: 'Querétaro',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 74250,
    annualRatePct: 14.7,
    monthlyPayment48Mxn: 11680
  },
  {
    stockId: 'KVK-9680',
    vin: '3C4NJCCB7NT968052',
    make: 'Jeep',
    model: 'Compass',
    trim: 'Limited Premium',
    year: 2022,
    priceMxn: 474000,
    mileageKm: 33400,
    transmission: 'Automática',
    fuelType: 'Gasolina',
    horsepower: 173,
    hub: 'Sede Nuevo Sur Monterrey',
    city: 'Monterrey',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 239,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 71100,
    annualRatePct: 15.0,
    monthlyPayment48Mxn: 11230
  },
  {
    stockId: 'KVK-9850',
    vin: 'JTDKAMFU5P3985011',
    make: 'Toyota',
    model: 'Prius',
    trim: 'Premium Híbrido',
    year: 2023,
    priceMxn: 446000,
    mileageKm: 12900,
    transmission: 'CVT',
    fuelType: 'Híbrido',
    horsepower: 138,
    hub: 'Sede Portal San Ángel',
    city: 'CDMX',
    status: 'disponible',
    inspection240: 'aprobada',
    inspectionPointsPassed: 240,
    warrantyIncluded: 'Kavak Total 12 meses',
    warrantyDays: 365,
    kavakTotalEligible: true,
    minDownPaymentPct: 15,
    minDownPaymentMxn: 66900,
    annualRatePct: 13.8,
    monthlyPayment48Mxn: 10310
  }
]

export const kavakOrders: KavakOrder[] = [
  {
    orderId: 'ORD-9044',
    customer: 'Luis Hernández',
    stockId: 'KVK-2089',
    vehicleSummary: 'Volkswagen Tiguan Comfortline 2021 ($415,000 MXN)',
    status: 'entregado',
    daysSinceDelivery: 18,
    kmSinceDelivery: 620,
    returnPolicyStatus: 'vencida_excede_7_dias_y_300_km',
    activeWarranty: 'Garantía Básica 90 días (motor y transmisión)',
    warrantyDays: 90,
    priceMxn: 415000,
    downPaymentPct: 15,
    downPaymentMxn: 62250,
    monthlyPaymentMxn: 8420,
    termMonths: 48,
    financingStatus: 'Kavak Crédito 48 meses ($8,420 MXN/mes)',
    hub: 'Sede Antara Fashion Hall',
    notes:
      'El cliente lleva 18 días y 620 km desde la entrega. No aplica devolución de 7 días o 300 km porque excede ambos límites. Sí aplica revisión por Garantía Básica de 90 días en motor y transmisión.'
  },
  {
    orderId: 'ORD-8821',
    customer: 'Ana García',
    stockId: 'KVK-1042',
    vehicleSummary: 'Mazda 3 i Grand Touring Sedán 2022 ($348,000 MXN)',
    status: 'entregado',
    daysSinceDelivery: 5,
    kmSinceDelivery: 190,
    returnPolicyStatus: 'elegible_7_dias_o_300_km',
    activeWarranty: 'Kavak Total 12 meses',
    warrantyDays: 365,
    priceMxn: 348000,
    downPaymentPct: 100,
    downPaymentMxn: 348000,
    monthlyPaymentMxn: 0,
    termMonths: 0,
    financingStatus: 'Liquidado de contado ($348,000 MXN)',
    hub: 'Sede Lerma',
    notes:
      'Entregado hace 5 días con 190 km recorridos. Cumple política de 7 días o 300 km para devolución sin penalización o revisión prioritaria sin costo bajo Kavak Total 12 meses (365 días) en Sede Lerma.'
  },
  {
    orderId: 'ORD-7712',
    customer: 'Marta Solís',
    stockId: 'KVK-3115',
    vehicleSummary: 'Toyota Corolla SE 2023 ($389,000 MXN)',
    status: 'financiamiento_en_validacion',
    daysSinceDelivery: 0,
    kmSinceDelivery: 0,
    returnPolicyStatus: 'pendiente_entrega',
    activeWarranty: 'Kavak Total 12 meses contratada',
    warrantyDays: 365,
    priceMxn: 389000,
    downPaymentPct: 20,
    downPaymentMxn: 77800,
    monthlyPaymentMxn: 8490,
    termMonths: 48,
    financingStatus:
      'Preaprobado con 20% de enganche ($77,800 MXN) y mensualidad de $8,490 MXN a 48 meses; pendiente validación biométrica INE y comprobante de domicilio vigente',
    hub: 'Sede Patio Santa Fe',
    notes:
      'No puede entregarse hoy sin completar validación biométrica INE y comprobante de domicilio no mayor a 3 meses para liberar contrato en Sede Patio Santa Fe.'
  },
  {
    orderId: 'ORD-6509',
    customer: 'Carlos Méndez',
    stockId: 'KVK-4090',
    vehicleSummary: 'Nissan Kicks Advance 2020 ($279,000 MXN)',
    status: 'apartado_en_acondicionamiento',
    daysSinceDelivery: 0,
    kmSinceDelivery: 0,
    returnPolicyStatus: 'reembolso_100_de_apartado',
    activeWarranty: 'Garantía Básica 90 días (motor y transmisión)',
    warrantyDays: 90,
    priceMxn: 279000,
    downPaymentPct: 20,
    downPaymentMxn: 55800,
    monthlyPaymentMxn: 6410,
    termMonths: 36,
    financingStatus: 'Preaprobado con 20% de enganche ($55,800 MXN) y mensualidad de $6,410 MXN a 36 meses',
    hub: 'Sede Midtown Guadalajara',
    notes:
      'Unidad en inspección de 240 puntos (212/240 completados) en Sede Midtown Guadalajara. Liberación estimada en 48 horas; si decide cancelar antes de entrega tiene reembolso del 100% del apartado.'
  },
  {
    orderId: 'ORD-5410',
    customer: 'Sofía Ramírez',
    stockId: 'KVK-7640',
    vehicleSummary: 'Cupra Formentor VZ 2.0 TSI 2023 ($642,000 MXN)',
    status: 'entregado',
    daysSinceDelivery: 6,
    kmSinceDelivery: 340,
    returnPolicyStatus: 'vencida_excede_7_dias_y_300_km',
    activeWarranty: 'Kavak Total 12 meses',
    warrantyDays: 365,
    priceMxn: 642000,
    downPaymentPct: 20,
    downPaymentMxn: 128400,
    monthlyPaymentMxn: 14060,
    termMonths: 48,
    financingStatus: 'Kavak Crédito 48 meses ($14,060 MXN/mes)',
    hub: 'Sede Antara Fashion Hall',
    notes:
      'Aunque lleva 6 días (<= 7 días), ya recorrió 340 km (> 300 km). Por la regla de lo que ocurra primero en POL-DEV-01, la devolución por satisfacción está vencida, pero cuenta con Kavak Total 12 meses (365 días).'
  },
  {
    orderId: 'ORD-4328',
    customer: 'Diego Torres',
    stockId: 'KVK-8190',
    vehicleSummary: 'MG HS Trophy Pack 2023 ($372,000 MXN)',
    status: 'apartado_en_acondicionamiento',
    daysSinceDelivery: 0,
    kmSinceDelivery: 0,
    returnPolicyStatus: 'reembolso_100_de_apartado',
    activeWarranty: 'Garantía Básica 90 días (motor y transmisión)',
    warrantyDays: 90,
    priceMxn: 372000,
    downPaymentPct: 20,
    downPaymentMxn: 74400,
    monthlyPaymentMxn: 8510,
    termMonths: 48,
    financingStatus: 'Preaprobado con 20% de enganche ($74,400 MXN) y mensualidad de $8,510 MXN a 48 meses',
    hub: 'Sede Lerma',
    notes:
      'En inspección de 240 puntos (198/240 puntos evaluados) en Sede Lerma. No disponible para entrega el mismo día.'
  }
]

export const kavakPolicies: KavakPolicy[] = [
  {
    policyId: 'POL-DEV-01',
    title: 'Política de devolución 7 días o 300 km',
    category: 'devolucion',
    rule: 'Todo cliente cuenta con 7 días naturales o 300 km recorridos desde la entrega (lo que ocurra primero) para solicitar devolución o cambio de unidad sin penalización.',
    strictLimits:
      'Si el expediente registra más de 7 días o más de 300 km recorridos, la devolución queda cerrada y solo procede atención por garantía mecánica.'
  },
  {
    policyId: 'POL-GAR-02',
    title: 'Garantía Básica 90 días y Kavak Total 12 meses',
    category: 'garantia',
    rule: 'Toda unidad entregada incluye Garantía Básica de 90 días en motor y transmisión. La cobertura extendida Kavak Total dura 12 meses (365 días) y cubre además suspensión, frenos, dirección, sistema eléctrico y aire acondicionado.',
    strictLimits:
      'El agente debe indicar exactamente cuál de las dos garantías tiene activa el expediente del cliente y la sede asignada.'
  },
  {
    policyId: 'POL-INSP-03',
    title: 'Certificación e inspección de 240 puntos',
    category: 'inspeccion',
    rule: 'Ningún vehículo con estado en_inspeccion_240_puntos puede ser entregado el mismo día. Debe concluir los 240 puntos de certificación mecánica, estética y legal.',
    strictLimits:
      'Si el cliente cancela mientras el vehículo sigue en acondicionamiento o inspección, recibe reembolso del 100% de su apartado.'
  },
  {
    policyId: 'POL-FIN-04',
    title: 'Financiamiento Kavak Crédito y liberación de entrega',
    category: 'financiamiento',
    rule: 'Los planes requieren entre 15% y 20% de enganche según unidad y perfil, en plazos de 12 a 72 meses.',
    strictLimits:
      'Para liberar la entrega en sede es obligatorio haber completado validación biométrica (INE o pasaporte) y comprobante de domicilio vigente.'
  }
]

export const kavakScenarios: KavakScenario[] = [
  {
    id: 'kavak-devolucion-vencida',
    cycleOrder: 1,
    title: 'Caso 1 · Devolución fuera de plazo (ORD-9044 · Tiguan KVK-2089)',
    customer: 'Luis Hernández',
    orderId: 'ORD-9044',
    stockId: 'KVK-2089',
    scenarioContext:
      'Cliente de Kavak con pedido ORD-9044 y unidad KVK-2089 solicita devolver su camioneta y verificar sus datos financieros y de garantía.',
    customerMessage:
      'Hola, tengo el pedido ORD-9044 de mi Tiguan KVK-2089. Quiero devolverla hoy mismo sin costo, ¿procede mi devolución?',
    expectedFacts: ['415,000', '8,420', '18', '620', '7', '300', '90', 'Antara'],
    numericTargets: [
      { field: 'priceMxn', label: 'Precio vehículo (MXN)', exactValue: 415000, unit: 'MXN' },
      { field: 'monthlyPaymentMxn', label: 'Mensualidad (MXN)', exactValue: 8420, unit: 'MXN' },
      { field: 'daysSinceDelivery', label: 'Días desde entrega', exactValue: 18, unit: 'días' },
      { field: 'kmSinceDelivery', label: 'Km desde entrega', exactValue: 620, unit: 'km' },
      { field: 'maxReturnDays', label: 'Límite devolución días', exactValue: 7, unit: 'días' },
      { field: 'maxReturnKm', label: 'Límite devolución km', exactValue: 300, unit: 'km' },
      { field: 'warrantyDays', label: 'Días de garantía activa', exactValue: 90, unit: 'días' }
    ],
    forbiddenClaims: ['procede tu devolución sin costo', 'puedes devolverla sin penalización hoy'],
    referenceAnswer:
      'Hola Luis, en tu expediente ORD-9044 la Volkswagen Tiguan KVK-2089 tiene un precio de $415,000 MXN con mensualidad de $8,420 MXN a 48 meses en Sede Antara Fashion Hall. Como registras 18 días desde la entrega y 620 km recorridos, excedes el límite de 7 días o 300 km y ya no procede la devolución, pero tienes activa tu Garantía Básica de 90 días en motor y transmisión.'
  },
  {
    id: 'kavak-devolucion-elegible',
    cycleOrder: 2,
    title: 'Caso 2 · Devolución y garantía elegible (ORD-8821 · Mazda 3 KVK-1042)',
    customer: 'Ana García',
    orderId: 'ORD-8821',
    stockId: 'KVK-1042',
    scenarioContext:
      'Cliente de Kavak con pedido ORD-8821 y unidad KVK-1042 reporta vibración al frenar dentro de la ventana de 7 días / 300 km.',
    customerMessage:
      'Hola, mi pedido es el ORD-8821 del Mazda 3 KVK-1042. Siento una vibración al frenar, ¿todavía entro en devolución o en mi garantía?',
    expectedFacts: ['348,000', '28,400', '5', '190', '7', '300', '365', 'Lerma'],
    numericTargets: [
      { field: 'priceMxn', label: 'Precio vehículo (MXN)', exactValue: 348000, unit: 'MXN' },
      { field: 'mileageKm', label: 'Kilometraje unidad (km)', exactValue: 28400, unit: 'km' },
      { field: 'daysSinceDelivery', label: 'Días desde entrega', exactValue: 5, unit: 'días' },
      { field: 'kmSinceDelivery', label: 'Km desde entrega', exactValue: 190, unit: 'km' },
      { field: 'maxReturnDays', label: 'Límite devolución días', exactValue: 7, unit: 'días' },
      { field: 'maxReturnKm', label: 'Límite devolución km', exactValue: 300, unit: 'km' },
      { field: 'warrantyDays', label: 'Días de garantía Kavak Total', exactValue: 365, unit: 'días' }
    ],
    forbiddenClaims: ['vencida', 'no aplica devolución'],
    referenceAnswer:
      'Hola Ana, en tu pedido ORD-8821 del Mazda 3 KVK-1042 ($348,000 MXN, 28,400 km) llevas 5 días desde la entrega y 190 km recorridos, por lo que estás dentro del límite de 7 días o 300 km para devolución sin penalización. Además cuentas con Kavak Total por 12 meses (365 días) para revisión sin costo en Sede Lerma.'
  },
  {
    id: 'kavak-financiamiento-entrega',
    cycleOrder: 3,
    title: 'Caso 3 · Financiamiento y requisitos de entrega (ORD-7712 · Corolla KVK-3115)',
    customer: 'Marta Solís',
    orderId: 'ORD-7712',
    stockId: 'KVK-3115',
    scenarioContext:
      'Cliente con pedido ORD-7712 pregunta por el precio, enganche exacto, mensualidad, plazo y requisitos de entrega de su Corolla KVK-3115.',
    customerMessage:
      'Buen día, tengo el expediente ORD-7712 por el Corolla KVK-3115. ¿Ya puedo pasar hoy por él a la sede?',
    expectedFacts: [
      '389,000',
      '15,100',
      '20',
      '77,800',
      '8,490',
      '48',
      'Patio Santa Fe',
      'biométrica',
      'domicilio'
    ],
    numericTargets: [
      { field: 'priceMxn', label: 'Precio vehículo (MXN)', exactValue: 389000, unit: 'MXN' },
      { field: 'mileageKm', label: 'Kilometraje unidad (km)', exactValue: 15100, unit: 'km' },
      { field: 'downPaymentPct', label: 'Porcentaje enganche (%)', exactValue: 20, unit: '%' },
      { field: 'downPaymentMxn', label: 'Monto enganche (MXN)', exactValue: 77800, unit: 'MXN' },
      { field: 'monthlyPaymentMxn', label: 'Mensualidad (MXN)', exactValue: 8490, unit: 'MXN' },
      { field: 'termMonths', label: 'Plazo financiamiento (meses)', exactValue: 48, unit: 'meses' }
    ],
    forbiddenClaims: ['puedes pasar hoy sin requisitos', 'entrega inmediata aprobada'],
    referenceAnswer:
      'Hola Marta, en tu expediente ORD-7712 el Toyota Corolla SE 2023 (KVK-3115, 15,100 km) tiene un precio de $389,000 MXN, con enganche del 20% por $77,800 MXN y mensualidad de $8,490 MXN a 48 meses. Está asignado a Sede Patio Santa Fe y para liberar la entrega falta completar tu validación biométrica INE y comprobante de domicilio vigente.'
  },
  {
    id: 'kavak-inventario-inspeccion',
    cycleOrder: 4,
    title: 'Caso 4 · Unidad en inspección de 240 puntos (ORD-6509 · Kicks KVK-4090)',
    customer: 'Carlos Méndez',
    orderId: 'ORD-6509',
    stockId: 'KVK-4090',
    scenarioContext:
      'Cliente con apartado ORD-6509 pregunta por el avance exacto de inspección, precio, enganche, mensualidad y reembolso de su Nissan Kicks KVK-4090.',
    customerMessage:
      'Hola, aparté la Nissan Kicks KVK-4090 con el folio ORD-6509. ¿Me la entregan hoy mismo o cuál es el estatus completo de mi apartado?',
    expectedFacts: [
      '279,000',
      '55,800',
      '6,410',
      '36',
      '212',
      '240',
      'Midtown Guadalajara',
      '100'
    ],
    numericTargets: [
      { field: 'priceMxn', label: 'Precio vehículo (MXN)', exactValue: 279000, unit: 'MXN' },
      { field: 'downPaymentMxn', label: 'Monto enganche (MXN)', exactValue: 55800, unit: 'MXN' },
      { field: 'monthlyPaymentMxn', label: 'Mensualidad (MXN)', exactValue: 6410, unit: 'MXN' },
      { field: 'termMonths', label: 'Plazo (meses)', exactValue: 36, unit: 'meses' },
      { field: 'inspectionPointsPassed', label: 'Puntos aprobados', exactValue: 212, unit: 'puntos' },
      { field: 'totalInspectionPoints', label: 'Total puntos inspección', exactValue: 240, unit: 'puntos' },
      { field: 'refundPct', label: 'Reembolso de apartado (%)', exactValue: 100, unit: '%' }
    ],
    forbiddenClaims: ['lista para entrega hoy', 'puedes recogerla hoy mismo'],
    referenceAnswer:
      'Hola Carlos, en tu folio ORD-6509 la Nissan Kicks Advance 2020 (KVK-4090) tiene un precio de $279,000 MXN, enganche de $55,800 MXN y mensualidad de $6,410 MXN a 36 meses en Sede Midtown Guadalajara. Lleva 212 de 240 puntos aprobados en inspección (liberación estimada en 48 horas), y si cancelas antes de la entrega tienes 100% de reembolso de tu apartado.'
  }
]

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

function extractNumbers(text: string): number[] {
  const cleaned = text.replace(/KVK-\d+/gi, ' ').replace(/ORD-\d+/gi, ' ').replace(/POL-[A-Z]+-\d+/gi, ' ')
  const matches = cleaned.match(/\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?/g) || []
  return matches
    .map((m) => Number(m.replace(/,/g, '')))
    .filter((n) => Number.isFinite(n))
}

export function detectKavakScenario(text: string): KavakScenario | undefined {
  const norm = normalizeText(text)
  for (const sc of kavakScenarios) {
    if (
      norm.includes(normalizeText(sc.orderId)) ||
      norm.includes(normalizeText(sc.stockId)) ||
      norm.includes(normalizeText(sc.id))
    ) {
      return sc
    }
  }
  return undefined
}

export function evaluateKavakResponse(
  scenarioId: string,
  responseText: string
): KavakEvaluationResult {
  const scenario =
    kavakScenarios.find((s) => s.id === scenarioId) ||
    detectKavakScenario(scenarioId) ||
    kavakScenarios[0]
  const normalized = normalizeText(responseText)
  const compactNormalized = normalized.replace(/,/g, '')
  const matchedFacts: string[] = []
  const missingFacts: string[] = []
  for (const fact of scenario.expectedFacts) {
    const fNorm = normalizeText(fact)
    const compactFact = fNorm.replace(/,/g, '')
    if (normalized.includes(fNorm) || compactNormalized.includes(compactFact)) {
      matchedFacts.push(fact)
    } else {
      missingFacts.push(fact)
    }
  }

  const candidateNumbers = extractNumbers(responseText)
  const numericResiduals: KavakNumericResidual[] = scenario.numericTargets.map((target) => {
    const exactMatch = candidateNumbers.find((n) => Math.abs(n - target.exactValue) < 1e-6)
    if (exactMatch !== undefined) {
      return {
        field: target.field,
        label: target.label,
        expected: target.exactValue,
        observed: exactMatch,
        absoluteError: 0,
        relativeError: 0,
        unit: target.unit
      }
    }
    const scaleCandidates = candidateNumbers.filter((n) => {
      if (target.exactValue >= 1000) return n >= 500
      return n > 0 && n < 1000
    })
    let closest: number | null = null
    let minDiff = Infinity
    for (const n of scaleCandidates) {
      const diff = Math.abs(n - target.exactValue)
      if (diff < minDiff) {
        minDiff = diff
        closest = n
      }
    }
    if (closest !== null && minDiff / Math.max(1, target.exactValue) <= 0.45) {
      const rel = Math.min(1, minDiff / Math.max(1, target.exactValue))
      return {
        field: target.field,
        label: target.label,
        expected: target.exactValue,
        observed: closest,
        absoluteError: Number(minDiff.toFixed(2)),
        relativeError: Number(rel.toFixed(4)),
        unit: target.unit
      }
    }
    return {
      field: target.field,
      label: target.label,
      expected: target.exactValue,
      observed: null,
      absoluteError: target.exactValue,
      relativeError: 1,
      unit: target.unit
    }
  })

  const violatedClaims: string[] = []
  for (const claim of scenario.forbiddenClaims) {
    if (normalized.includes(normalizeText(claim))) {
      violatedClaims.push(claim)
    }
  }

  const allErrors = [
    ...numericResiduals.map((r) => r.relativeError),
    ...scenario.expectedFacts.map((fact) => (matchedFacts.includes(fact) ? 0 : 1))
  ]
  const totalTerms = Math.max(1, allErrors.length)
  const meanError = allErrors.reduce((a, b) => a + b, 0) / totalTerms
  const rmse = Number(
    Math.sqrt(allErrors.reduce((acc, e) => acc + e * e, 0) / totalTerms).toFixed(4)
  )
  const variance =
    allErrors.reduce((acc, e) => acc + Math.pow(e - meanError, 2), 0) / totalTerms
  const stdError = Number(Math.sqrt(variance).toFixed(4))
  const mape = Number(
    (
      (numericResiduals.reduce((acc, r) => acc + r.relativeError, 0) /
        Math.max(1, numericResiduals.length)) *
      100
    ).toFixed(2)
  )

  const truePositives =
    matchedFacts.length + numericResiduals.filter((r) => r.relativeError === 0).length
  const falseNegatives =
    missingFacts.length + numericResiduals.filter((r) => r.relativeError > 0).length
  const falsePositives =
    violatedClaims.length +
    numericResiduals.filter((r) => r.observed !== null && r.relativeError > 0).length
  const precision = Number(
    (truePositives / Math.max(1, truePositives + falsePositives)).toFixed(4)
  )
  const recall = Number(
    (truePositives / Math.max(1, truePositives + falseNegatives)).toFixed(4)
  )
  const f1 =
    precision + recall > 0
      ? Number(((2 * precision * recall) / (precision + recall)).toFixed(4))
      : 0

  const coverage = scenario.expectedFacts.length
    ? matchedFacts.length / scenario.expectedFacts.length
    : 1
  const rawScore = Math.round(
    (1 - rmse) * 92 + (violatedClaims.length === 0 ? 8 : -violatedClaims.length * 24)
  )
  const score = Math.max(10, Math.min(100, rawScore))

  const missingNumericDescriptions = numericResiduals
    .filter((r) => r.relativeError > 0)
    .map((r) =>
      r.observed === null
        ? `${r.label}=${r.expected.toLocaleString('en-US')} ${r.unit} (omitido, e=1.00)`
        : `${r.label}: esperado=${r.expected.toLocaleString('en-US')} vs observado=${r.observed.toLocaleString('en-US')} (error rel=${(r.relativeError * 100).toFixed(1)}%)`
    )

  const statisticalFeedback =
    score >= 92 && violatedClaims.length === 0 && missingNumericDescriptions.length === 0
      ? `Verificación estadística exacta contra BD Kavak (${scenario.orderId} / ${scenario.stockId}): RMSE=${rmse.toFixed(3)}, MAPE=${mape.toFixed(1)}%, F1=${f1.toFixed(2)}. Todos los parámetros numéricos y de política coinciden exactamente.`
      : [
          `Diagnóstico estadístico contra BD Kavak (${scenario.orderId} / ${scenario.stockId}): Puntaje=${score}/100, RMSE=${rmse.toFixed(3)}, MAPE=${mape.toFixed(1)}%, desv.est=${stdError.toFixed(3)}, F1=${f1.toFixed(2)}.`,
          missingNumericDescriptions.length
            ? `Variables numéricas con residual > 0 que debes consultar con query_kavak_db e incluir con valor exacto: ${missingNumericDescriptions.join('; ')}.`
            : '',
          missingFacts.length
            ? `Términos exactos faltantes de la BD: ${missingFacts.join(', ')}.`
            : '',
          violatedClaims.length
            ? `Contradicciones de política detectadas (eliminar): ${violatedClaims.join(', ')}.`
            : ''
        ]
          .filter(Boolean)
          .join(' ')

  return {
    scenarioId: scenario.id,
    orderId: scenario.orderId,
    stockId: scenario.stockId,
    matchedFacts,
    missingFacts,
    violatedClaims,
    numericResiduals,
    mape,
    rmse,
    stdError,
    precision,
    recall,
    f1,
    factCoverage: Math.round(coverage * 100),
    score,
    passed: score >= 80 && violatedClaims.length === 0,
    statisticalFeedback
  }
}
