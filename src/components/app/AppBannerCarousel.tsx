"use client";

import { BannerCarousel, type BannerSlide } from "@/components/marketing/BannerCarousel";

type Props = {
  banners: BannerSlide[];
};

export function AppBannerCarousel({ banners }: Props) {
  if (!banners.length) return null;
  return (
    <div className="mb-6 overflow-hidden rounded-2xl border border-black/5 shadow-sm">
      <BannerCarousel banners={banners} compact />
    </div>
  );
}
