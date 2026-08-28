export interface SavedVehicle {
  vehiclePlate: string;
  vehicleType: string;
  vehicleName: string;
  vehicleColor: string;
  /** 0 = belum diisi (tahun bersifat opsional di form). */
  vehicleYear: number;
  vehicleRole: string;
  polisNumber: string;
  polisEnd: string;
  plateImage: string;
  /** Opsional. Kosong berarti kartu kendaraan jatuh ke ikon mobil. */
  vehicleImage: string;
  createdAt: string;
  updatedAt: string;
}

const s = (v: unknown, f = ''): string => (typeof v === 'string' ? v : f);

export function parseSavedVehicle(json: Record<string, unknown>): SavedVehicle {
  return {
    vehiclePlate: s(json.vehicle_plate),
    vehicleType: s(json.vehicle_type),
    vehicleName: s(json.vehicle_name),
    vehicleColor: s(json.vehicle_color),
    vehicleYear: typeof json.vehicle_year === 'number' ? json.vehicle_year : 0,
    vehicleRole: s(json.vehicle_role),
    polisNumber: s(json.polis_number),
    polisEnd: s(json.polis_end),
    plateImage: s(json.plate_image),
    vehicleImage: s(json.vehicle_image),
    createdAt: s(json.created_at),
    updatedAt: s(json.updated_at),
  };
}

/** Kendaraan berpolis tidak boleh diedit/dihapus (aturan backend). */
export function hasPolis(v: SavedVehicle): boolean {
  return v.polisNumber.length > 0 && v.polisNumber !== '-';
}

export interface VehicleFormInput {
  vehiclePlate: string;
  vehicleName: string;
  vehicleType: string;
  vehicleColor: string;
  /** Kosong = tidak diisi; dikirim 0 ke backend. */
  vehicleYear?: string;
  vehicleRole: string;
  polisNumber?: string;
  polisEnd?: string;
  plateImage?: string;
  vehicleImage?: string;
}

export function toCreatePayload(input: VehicleFormInput): Record<string, unknown> {
  return {
    vehicle_plate: input.vehiclePlate,
    vehicle_type: input.vehicleType,
    vehicle_name: input.vehicleName,
    vehicle_color: input.vehicleColor,
    vehicle_year: Number(input.vehicleYear) || 0,
    vehicle_role: input.vehicleRole || 'private',
    polis_number: input.polisNumber || '-',
    polis_end: input.polisEnd || '-',
    plate_image: input.plateImage ?? '',
    vehicle_image: input.vehicleImage ?? '',
  };
}

export function toUpdatePayload(input: VehicleFormInput): Record<string, unknown> {
  return {
    vehicle_type: input.vehicleType,
    vehicle_name: input.vehicleName,
    vehicle_color: input.vehicleColor,
    vehicle_year: Number(input.vehicleYear) || 0,
    plate_image: input.plateImage ?? '',
    vehicle_image: input.vehicleImage ?? '',
  };
}

export const VEHICLE_TYPES = ['Mobil', 'Motor', 'SUV', 'Pikap', 'Truk'] as const;
