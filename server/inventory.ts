import { z } from 'zod'
import type { WorkflowPolicy } from '../shared/evolution'

export const inventory = [
  {
    id: 'A-101',
    brand: 'Toyota',
    model: 'Corolla',
    type: 'sedan',
    fuel: 'gasolina',
    price: 279000,
    seats: 5,
    available: true
  },
  {
    id: 'A-102',
    brand: 'Mazda',
    model: 'CX-5',
    type: 'suv',
    fuel: 'gasolina',
    price: 350000,
    seats: 5,
    available: true
  },
  {
    id: 'A-103',
    brand: 'Honda',
    model: 'CR-V',
    type: 'suv',
    fuel: 'hibrido',
    price: 420000,
    seats: 5,
    available: true
  },
  {
    id: 'A-104',
    brand: 'Nissan',
    model: 'Versa',
    type: 'sedan',
    fuel: 'gasolina',
    price: 225000,
    seats: 5,
    available: true
  },
  {
    id: 'A-105',
    brand: 'Kia',
    model: 'Sorento',
    type: 'suv',
    fuel: 'gasolina',
    price: 480000,
    seats: 7,
    available: true
  },
  {
    id: 'A-106',
    brand: 'Toyota',
    model: 'Prius',
    type: 'sedan',
    fuel: 'hibrido',
    price: 350000,
    seats: 5,
    available: true
  },
  {
    id: 'A-107',
    brand: 'BYD',
    model: 'Dolphin',
    type: 'hatchback',
    fuel: 'electrico',
    price: 390000,
    seats: 5,
    available: true
  },
  {
    id: 'A-108',
    brand: 'Suzuki',
    model: 'Swift',
    type: 'hatchback',
    fuel: 'gasolina',
    price: 249000,
    seats: 5,
    available: true
  },
  {
    id: 'A-109',
    brand: 'Toyota',
    model: 'Avanza',
    type: 'suv',
    fuel: 'gasolina',
    price: 319000,
    seats: 7,
    available: true
  },
  {
    id: 'A-110',
    brand: 'Mazda',
    model: 'MX-5',
    type: 'convertible',
    fuel: 'gasolina',
    price: 440000,
    seats: 2,
    available: true
  },
  {
    id: 'A-111',
    brand: 'Nissan',
    model: 'Kicks',
    type: 'suv',
    fuel: 'gasolina',
    price: 350000,
    seats: 5,
    available: false
  },
  {
    id: 'A-112',
    brand: 'Kia',
    model: 'Rio',
    type: 'sedan',
    fuel: 'gasolina',
    price: 210000,
    seats: 5,
    available: false
  }
]

export const inventoryFilters = z
  .object({
    maxPrice: z.number().finite().min(0).max(10_000_000).optional(),
    type: z.enum(['sedan', 'suv', 'hatchback', 'convertible']).optional(),
    fuel: z.string().max(40).optional(),
    seats: z.number().int().min(1).max(12).optional()
  })
  .strict()
export type InventoryFilters = z.infer<typeof inventoryFilters>
const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

export function searchInventory(filters: InventoryFilters, policy: WorkflowPolicy) {
  const f = inventoryFilters.parse(filters)
  return inventory.filter(
    (v) =>
      v.available &&
      (f.maxPrice === undefined ||
        (policy.budgetInclusive ? v.price <= f.maxPrice : v.price < f.maxPrice)) &&
      (!f.type || v.type === f.type) &&
      (!f.fuel ||
        (policy.normalizeFuel ? normalize(v.fuel) === normalize(f.fuel) : v.fuel === f.fuel)) &&
      (f.seats === undefined || (policy.minimumSeats ? v.seats >= f.seats : v.seats === f.seats))
  )
}

export function estimatePayment(
  id: string,
  downPayment: number,
  months: number,
  annualRate = 0.15
) {
  const vehicle = inventory.find((v) => v.id === id && v.available)
  if (!vehicle) throw new Error('Vehículo de demostración no disponible.')
  z.number().finite().min(0).max(vehicle.price).parse(downPayment)
  z.number().int().min(1).max(84).parse(months)
  z.number().finite().min(0).max(1).parse(annualRate)
  const principal = vehicle.price - downPayment
  const rate = annualRate / 12
  const monthly =
    rate === 0 ? principal / months : (principal * rate) / (1 - Math.pow(1 + rate, -months))
  return {
    synthetic: true,
    currency: 'MXN',
    vehicleId: id,
    principal,
    months,
    annualRate,
    monthlyPayment: Math.round(monthly * 100) / 100,
    assumptions:
      'Simulador matemático. Tasa fija hipotética, sin comisiones, seguros ni impuestos. No es una oferta de crédito.'
  }
}
