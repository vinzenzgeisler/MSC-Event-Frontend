import { getAdminClassOptions, getAdminCurrentEvent } from "@/services/api/event-context";
import type { VehicleType } from "@/types/common";

export type AdminClassOption = {
  id: string;
  name: string;
  vehicleType: VehicleType;
  allowsCodriver: boolean;
};

export const adminMetaService = {
  async getCurrentEvent() {
    const response = await getAdminCurrentEvent();
    return response.event;
  },

  async listClassOptions(): Promise<AdminClassOption[]> {
    const collator = new Intl.Collator("de", {
      numeric: true,
      sensitivity: "base"
    });
    return [...(await getAdminClassOptions())].sort((left, right) => collator.compare(left.name, right.name));
  }
};
