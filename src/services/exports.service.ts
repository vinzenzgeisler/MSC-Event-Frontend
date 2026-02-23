import { mockExportJobs } from "@/mock/exports.mock";
import { getAdminEventId } from "@/services/api/event-context";
import { isMockApiEnabled, requestJson } from "@/services/api/http-client";
import type { ExportCreateForm, ExportJob, ExportJobDto } from "@/types/admin";

function fromExportDto(dto: ExportJobDto): ExportJob {
  return {
    id: dto.id,
    type: dto.type,
    status: dto.status,
    createdAt: new Date(dto.createdAt).toLocaleString("de-DE")
  };
}

type AdminExportCreateResponse = {
  ok: boolean;
  exportJobId: string;
};

type AdminExportsListResponse = {
  ok: boolean;
  exports: ExportJobDto[];
};

type AdminExportDownloadResponse = {
  ok: boolean;
  url: string;
};

export const exportsService = {
  async createExport(form: ExportCreateForm) {
    if (isMockApiEnabled()) {
      return { ok: true, exportJobId: `exp-${Date.now()}` };
    }

    const eventId = await getAdminEventId();
    return requestJson<AdminExportCreateResponse>("/admin/exports/entries", {
      method: "POST",
      body: {
        eventId,
        type: form.type,
        classId: form.classId !== "all" ? form.classId : undefined,
        acceptanceStatus: form.acceptanceStatus !== "all" ? form.acceptanceStatus : undefined,
        format: form.format
      }
    });
  },

  async listExports() {
    if (isMockApiEnabled()) {
      return mockExportJobs.map(fromExportDto);
    }

    const eventId = await getAdminEventId();
    const response = await requestJson<AdminExportsListResponse>("/admin/exports", {
      query: {
        eventId,
        limit: 100,
        sortBy: "createdAt",
        sortDir: "desc"
      }
    });

    return response.exports.map(fromExportDto);
  },

  async getExportDownloadUrl(exportJobId: string) {
    if (isMockApiEnabled()) {
      return null;
    }

    const response = await requestJson<AdminExportDownloadResponse>(`/admin/exports/${exportJobId}/download`);
    return response.url;
  }
};
