import { requestJson } from '@/services/api/http-client';

export type AuctionStatus = 'draft' | 'open' | 'closed';
export type AdminAuction = {
  eventId: string; status: AuctionStatus; titleI18n: Record<string, string>; descriptionI18n: Record<string, string>;
  termsI18n: Record<string, string>; imageUrl: string | null; videoUrl: string | null; startingBidCents: number;
  minIncrementCents: number; currentHighestCents: number | null; nextMinimumCents: number; closedAt: string | null;
};
export type AdminAuctionBid = {
  id: string; bidderName: string; contactType: 'email' | 'phone'; contactValue: string; amountCents: number;
  status: 'valid' | 'invalid'; adminNote: string | null; createdAt: string;
};

export const adminAuctionService = {
  async get(eventId: string) {
    return (await requestJson<{ auction: AdminAuction }>(`/admin/events/${eventId}/auction`)).auction;
  },
  async patch(eventId: string, patch: Partial<AdminAuction>) {
    return (await requestJson<{ auction: AdminAuction }>(`/admin/events/${eventId}/auction`, { method: 'PATCH', body: patch })).auction;
  },
  async bids(eventId: string) {
    return (await requestJson<{ bids: AdminAuctionBid[] }>(`/admin/events/${eventId}/auction/bids`)).bids;
  },
  async patchBid(eventId: string, bidId: string, patch: { status?: 'valid' | 'invalid'; adminNote?: string | null }) {
    return (await requestJson<{ bids: AdminAuctionBid[] }>(`/admin/events/${eventId}/auction/bids/${bidId}`, { method: 'PATCH', body: patch })).bids;
  }
};
