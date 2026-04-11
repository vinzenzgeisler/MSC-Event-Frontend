import type { VehicleType } from "@/types/common";

export function getVehicleTypeLabel(vehicleType: VehicleType): string {
  return vehicleType === "moto" ? "Motorrad" : "Automobil";
}
