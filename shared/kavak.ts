export interface KavakVehicle {
  stockId: string
  vin: string
  make: string
  model: string
  trim: string
  year: number
  priceMxn: number
  mileageKm: number
  transmission: 'Automática' | 'Manual' | 'CVT'
  hub: string
  city: string
  status: 'disponible' | 'apartado' | 'en_inspeccion_240_puntos' | 'entregado'
  inspection240: 'aprobada' | 'en_proceso'
  warrantyIncluded: string
  kavakTotalEligible: boolean
  minDownPaymentPct: number
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
  factCoverage: number
  score: number
  passed: boolean
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
    hub: 'Sede Lerma',
    city: 'Estado de México',
    status: 'entregado',
    inspection240: 'aprobada',
    warrantyIncluded: 'Kavak Total 12 meses',
    kavakTotalEligible: true,
    minDownPaymentPct: 15
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
    transmission: 'Automática',
    hub: 'Sede Antara Fashion Hall',
    city: 'CDMX',
    status: 'entregado',
    inspection240: 'aprobada',
    warrantyIncluded: 'Garantía Básica 90 días (motor y transmisión)',
    kavakTotalEligible: true,
    minDownPaymentPct: 15
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
    hub: 'Sede Patio Santa Fe',
    city: 'CDMX',
    status: 'apartado',
    inspection240: 'aprobada',
    warrantyIncluded: 'Kavak Total 12 meses',
    kavakTotalEligible: true,
    minDownPaymentPct: 15
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
    transmission: 'Automática',
    hub: 'Sede Midtown Guadalajara',
    city: 'Guadalajara',
    status: 'en_inspeccion_240_puntos',
    inspection240: 'en_proceso',
    warrantyIncluded: 'Garantía Básica 90 días (motor y transmisión)',
    kavakTotalEligible: false,
    minDownPaymentPct: 20
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
    hub: 'Sede Nuevo Sur Monterrey',
    city: 'Monterrey',
    status: 'disponible',
    inspection240: 'aprobada',
    warrantyIncluded: 'Kavak Total 12 meses',
    kavakTotalEligible: true,
    minDownPaymentPct: 15
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
    financingStatus: 'Liquidado de contado ($348,000 MXN)',
    hub: 'Sede Lerma',
    notes:
      'Entregado hace 5 días con 190 km recorridos. Cumple política de 7 días o 300 km para devolución sin penalización o revisión prioritaria sin costo bajo Kavak Total 12 meses en Sede Lerma.'
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
    financingStatus:
      'Preaprobado con 20% de enganche ($77,800 MXN) a 48 meses; pendiente validación biométrica INE y comprobante de domicilio vigente',
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
    financingStatus: 'Preaprobado con 20% de enganche ($55,800 MXN) a 36 meses',
    hub: 'Sede Midtown Guadalajara',
    notes:
      'Unidad en inspección de 240 puntos en Sede Midtown Guadalajara. Liberación estimada en 48 horas; si decide cancelar antes de entrega tiene reembolso del 100% del apartado.'
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
    rule: 'Toda unidad entregada incluye Garantía Básica de 90 días en motor y transmisión. La cobertura extendida Kavak Total dura 12 meses y cubre además suspensión, frenos, dirección, sistema eléctrico y aire acondicionado.',
    strictLimits:
      'El agente debe indicar exactamente cuál de las dos garantías tiene activa el expediente del cliente y la sede asignada.'
  },
  {
    policyId: 'POL-INSP-03',
    title: 'Certificación e inspección de 240 puntos',
    category: 'inspeccion',
    rule: 'Ningún vehículo con estado en_inspeccion_240_puntos puede ser entregado el mismo día. Debe concluir la certificación mecánica, estética y legal.',
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
    title: 'Ciclo 1 · Devolución fuera de plazo (ORD-9044 · Tiguan)',
    customer: 'Luis Hernández',
    orderId: 'ORD-9044',
    stockId: 'KVK-2089',
    scenarioContext:
      'Cliente de Kavak con pedido ORD-9044 y unidad KVK-2089 solicita devolver su camioneta tras 18 días y 620 km.',
    customerMessage:
      'Hola, tengo el pedido ORD-9044 de mi Tiguan KVK-2089. Ya llevo 18 días con ella y 620 km pero quiero aplicar la devolución sin costo hoy mismo.',
    expectedFacts: ['18 días', '620 km', '7 días', '300 km', '90 días', 'Antara'],
    forbiddenClaims: ['procede tu devolución sin costo', 'puedes devolverla sin penalización hoy'],
    referenceAnswer:
      'Hola Luis, revisé tu expediente ORD-9044 de la Volkswagen Tiguan KVK-2089 en Sede Antara Fashion Hall. Como registras 18 días desde la entrega y 620 km recorridos, ya no aplica la política de devolución de 7 días o 300 km. Sin embargo, cuentas con tu Garantía Básica de 90 días activa en motor y transmisión para agendar revisión sin costo en Sede Antara.'
  },
  {
    id: 'kavak-devolucion-elegible',
    cycleOrder: 2,
    title: 'Ciclo 2 · Devolución y garantía elegible (ORD-8821 · Mazda 3)',
    customer: 'Ana García',
    orderId: 'ORD-8821',
    stockId: 'KVK-1042',
    scenarioContext:
      'Cliente de Kavak con pedido ORD-8821 y unidad KVK-1042 reporta vibración al frenar dentro de la ventana de 7 días / 300 km.',
    customerMessage:
      'Hola, mi pedido es el ORD-8821 del Mazda 3 KVK-1042. Siento una vibración al frenar, ¿todavía entro en la garantía de devolución o en mi cobertura en sede?',
    expectedFacts: ['5 días', '190 km', '7 días', '300 km', 'Kavak Total', 'Lerma', '348,000'],
    forbiddenClaims: ['vencida', 'no aplica devolución'],
    referenceAnswer:
      'Hola Ana, consulté tu pedido ORD-8821 del Mazda 3 KVK-1042 ($348,000 MXN). Al tener solo 5 días desde la entrega y 190 km recorridos, estás dentro del límite de 7 días o 300 km para solicitar devolución sin penalización. Además tienes activa la cobertura Kavak Total 12 meses, por lo que podemos revisar los frenos hoy mismo sin costo en Sede Lerma.'
  },
  {
    id: 'kavak-financiamiento-entrega',
    cycleOrder: 3,
    title: 'Ciclo 3 · Financiamiento y requisitos de entrega (ORD-7712 · Corolla)',
    customer: 'Marta Solís',
    orderId: 'ORD-7712',
    stockId: 'KVK-3115',
    scenarioContext:
      'Cliente con pedido ORD-7712 pregunta por el precio, enganche exacto y entrega inmediata de su Corolla KVK-3115.',
    customerMessage:
      'Buen día, tengo el expediente ORD-7712 por el Corolla KVK-3115. ¿Me confirmas el precio total, el monto exacto de mi enganche del 20% y si ya puedo pasar hoy por él?',
    expectedFacts: [
      '389,000',
      '77,800',
      '20%',
      '48 meses',
      'Patio Santa Fe',
      'biométrica',
      'INE',
      'domicilio',
      'Kavak Total',
      '15,100 km'
    ],
    forbiddenClaims: ['puedes pasar hoy sin requisitos', 'entrega inmediata aprobada'],
    referenceAnswer:
      'Hola Marta, en tu expediente ORD-7712 el Toyota Corolla SE 2023 (KVK-3115, 15,100 km) tiene un precio de $389,000 MXN y tu enganche preaprobado del 20% es de $77,800 MXN a 48 meses con Kavak Total. La unidad está apartada en Sede Patio Santa Fe, pero antes de liberarla para entrega necesitamos completar tu validación biométrica INE y tu comprobante de domicilio vigente.'
  },
  {
    id: 'kavak-inventario-inspeccion',
    cycleOrder: 4,
    title: 'Ciclo 4 · Unidad en inspección de 240 puntos (ORD-6509 · Kicks)',
    customer: 'Carlos Méndez',
    orderId: 'ORD-6509',
    stockId: 'KVK-4090',
    scenarioContext:
      'Cliente con apartado ORD-6509 pregunta si puede recoger hoy la Nissan Kicks KVK-4090 o qué pasa con su apartado.',
    customerMessage:
      'Hola, aparté la Nissan Kicks KVK-4090 con el folio ORD-6509. ¿Me confirman el precio, en qué sede está y si me la entregan hoy mismo?',
    expectedFacts: ['279,000', 'Midtown Guadalajara', '240 puntos', '48 horas', '100%'],
    forbiddenClaims: ['lista para entrega hoy', 'puedes recogerla hoy mismo'],
    referenceAnswer:
      'Hola Carlos, revisé tu folio ORD-6509 de la Nissan Kicks Advance 2020 (KVK-4090) con precio de $279,000 MXN en Sede Midtown Guadalajara. No es posible entregarla hoy mismo porque se encuentra en inspección de 240 puntos, con liberación estimada en 48 horas; si prefieres cancelar antes de la entrega cuentas con reembolso del 100% de tu apartado.'
  }
]

const normalizeText = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export function evaluateKavakResponse(
  scenarioId: string,
  responseText: string
): KavakEvaluationResult {
  const scenario =
    kavakScenarios.find((s) => s.id === scenarioId) || kavakScenarios[0]
  const normalized = normalizeText(responseText)
  const matchedFacts: string[] = []
  const missingFacts: string[] = []
  for (const fact of scenario.expectedFacts) {
    const fNorm = normalizeText(fact)
    const compactFact = fNorm.replace(/,/g, '')
    if (normalized.includes(fNorm) || normalized.replace(/,/g, '').includes(compactFact)) {
      matchedFacts.push(fact)
    } else {
      missingFacts.push(fact)
    }
  }
  const violatedClaims: string[] = []
  for (const claim of scenario.forbiddenClaims) {
    if (normalized.includes(normalizeText(claim))) {
      violatedClaims.push(claim)
    }
  }
  const coverage = scenario.expectedFacts.length
    ? matchedFacts.length / scenario.expectedFacts.length
    : 1
  const rawScore = Math.round(
    coverage * 88 + (violatedClaims.length === 0 ? 8 : -violatedClaims.length * 22)
  )
  const score = Math.max(15, Math.min(100, rawScore))
  return {
    scenarioId: scenario.id,
    orderId: scenario.orderId,
    stockId: scenario.stockId,
    matchedFacts,
    missingFacts,
    violatedClaims,
    factCoverage: Math.round(coverage * 100),
    score,
    passed: score >= 78 && violatedClaims.length === 0
  }
}
