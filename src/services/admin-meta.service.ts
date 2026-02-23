import { getAdminClassOptions, getAdminCurrentEvent } from "@/services/api/event-context";
import type { VehicleType } from "@/types/common";

export type AdminClassOption = {
  id: string;
  name: string;
  vehicleType: VehicleType;
};

export const adminMetaService = {
  async getCurrentEvent() {
    const response = await getAdminCurrentEvent();
    return response.event;
  },

  async listClassOptions(): Promise<AdminClassOption[]> {
    return getAdminClassOptions();
  }
};
