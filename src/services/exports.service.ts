import { mockExportJobs } from "@/mock/exports.mock";
import type { ExportCreateForm, ExportJob, ExportJobDto } from "@/types/admin";

function fromExportDto(dto: ExportJobDto): ExportJob {
  return {
    id: dto.id,
    type: dto.type,
    status: dto.status,
    createdAt: new Date(dto.createdAt).toLocaleString("de-DE")
  };
}

export const exportsService = {
  async createExport(_form: ExportCreateForm) {
    return { ok: true, exportJobId: `exp-${Date.now()}` };
  },

  async listExports() {
    return mockExportJobs.map(fromExportDto);
  }
};
