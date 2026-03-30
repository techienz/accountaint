import { getStats, type GuideStats } from "./store";
import { IRD_GUIDES } from "./fetcher";

export type GuideStatus = {
  code: string;
  title: string;
  url: string;
  loaded: boolean;
  chunkCount: number;
  lastFetched: string | null;
};

export type KnowledgeStatus = {
  chunkCount: number;
  guideCount: number;
  loadedCount: number;
  totalRequired: number;
  guides: string[];
  lastFetched: string | null;
  freshnessState: "fresh" | "aging" | "stale";
  daysSinceUpdate: number | null;
  guideDetails: GuideStatus[];
};

export async function getKnowledgeStatus(): Promise<KnowledgeStatus> {
  const stats = await getStats();

  let daysSinceUpdate: number | null = null;
  let freshnessState: KnowledgeStatus["freshnessState"] = "stale";

  if (stats.lastFetched) {
    const lastDate = new Date(stats.lastFetched);
    daysSinceUpdate = Math.floor(
      (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (daysSinceUpdate < 14) {
      freshnessState = "fresh";
    } else if (daysSinceUpdate < 30) {
      freshnessState = "aging";
    } else {
      freshnessState = "stale";
    }
  }

  // Build per-guide status with loaded/missing info
  const loadedMap = new Map<string, GuideStats>(
    stats.perGuide.map((g) => [g.code, g])
  );

  const guideDetails: GuideStatus[] = IRD_GUIDES.map((guide) => {
    const loaded = loadedMap.get(guide.code);
    return {
      code: guide.code,
      title: guide.title,
      url: guide.url,
      loaded: !!loaded,
      chunkCount: loaded?.chunkCount ?? 0,
      lastFetched: loaded?.lastFetched ?? null,
    };
  });

  // Also include any loaded guides not in the IRD_GUIDES list (e.g. manually uploaded)
  for (const [code, stat] of loadedMap) {
    if (!IRD_GUIDES.find((g) => g.code === code)) {
      guideDetails.push({
        code,
        title: "Manual upload",
        url: "",
        loaded: true,
        chunkCount: stat.chunkCount,
        lastFetched: stat.lastFetched,
      });
    }
  }

  const loadedCount = guideDetails.filter((g) => g.loaded).length;

  return {
    chunkCount: stats.chunkCount,
    guideCount: stats.guides.length,
    loadedCount,
    totalRequired: IRD_GUIDES.length,
    guides: stats.guides,
    lastFetched: stats.lastFetched,
    freshnessState,
    daysSinceUpdate,
    guideDetails,
  };
}
