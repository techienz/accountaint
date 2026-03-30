export type KnowledgeRecord = {
  id: string;           // guide_code + "-" + chunk_index
  guide_code: string;
  section: string;
  content: string;
  source_url: string;
  last_fetched: string; // ISO date
  vector: number[];     // 768-dim from Nomic Embed V2
};

export type RetrievalResult = {
  guideCode: string;
  section: string;
  content: string;
  sourceUrl: string;
  score: number;
};
