export type BuildStepKey =
  | "ingest"
  | "research"
  | "media_discovery"
  | "video_analysis"
  | "strategy"
  | "conversion_scan"
  | "creative"
  | "shopify_product"
  | "theme"
  | "ugc"
  | "qa";

export type StepStatus = "waiting" | "running" | "done" | "blocked" | "failed";

export type BuildStep = {
  key: BuildStepKey;
  label: string;
  status: StepStatus;
  detail?: string;
  startedAt?: string;
  finishedAt?: string;
};

export type AssetKind = "video" | "external_video" | "image" | "theme" | "generated_image" | "clip" | "qa_screenshot";

export type AssetRef = {
  id: string;
  kind: AssetKind;
  name: string;
  mimeType: string;
  size: number;
  localPath?: string;
  publicUrl?: string;
  shopifyFileId?: string;
  shopifyUrl?: string;
  createdAt: string;
  sourceProvider?: "upload" | "tiktok" | "product_page" | "web" | "generated";
  sourceUrl?: string;
  embedUrl?: string;
  posterUrl?: string;
  discovered?: boolean;
  publishable?: boolean;
  originPage?: string;
  error?: string;
};

export type ProductResearch = {
  productName: string;
  category: string;
  summary: string;
  audience: string[];
  benefits: string[];
  features: string[];
  objections: string[];
  proofPoints: string[];
  claimsToAvoid: string[];
  variants: string[];
  variantOptionName?: string;
  recommendedPrice?: number;
  sourcePrice?: number;
  sourceCompareAtPrice?: number;
  sourceCurrency?: string;
  sourceNotes: string[];
};

export type VideoAnalysis = {
  assetId: string;
  filename: string;
  durationSeconds: number;
  transcript: string;
  hook: string;
  angle: string;
  audience: string;
  visualBeats: string[];
  proof: string[];
  objections: string[];
  claimRisks: string[];
  bestStoreUse: string;
  suggestedClip: { start: number; end: number; label: string };
  posterPath?: string;
  sourceProvider?: "upload" | "tiktok";
  sourceUrl?: string;
  embedUrl?: string;
  posterUrl?: string;
  discovered?: boolean;
};

export type MarketingStrategy = {
  positioning: string;
  heroKicker: string;
  heroHeading: string;
  heroSubheading: string;
  benefitBullets: string[];
  proofHeadline: string;
  storyHeadline: string;
  comparisonTitle: string;
  comparisonRows: { attribute: string; product: string; alternative: string }[];
  faq: { question: string; answer: string }[];
  socialProof: { quote: string; source: string }[];
  ctaLabel: string;
  offerStrategy: string;
  mobilePriorities: string[];
  imageShotList: { title: string; prompt: string; role: string }[];
  safeClaims: string[];
  bannedClaims: string[];
  presentation?: {
    density: "compact" | "balanced" | "spacious";
    heroScale: "smaller" | "default";
    mediaFit: "cover" | "contain";
    mobileVideoWidth: 72 | 78 | 84;
  };
};


export type ConversionModule = {
  id: string;
  type: "mechanism" | "how_to" | "specs" | "ingredients" | "shade_size_fit" | "whats_included" | "use_cases" | "compatibility" | "care" | "safety" | "guarantee" | "shipping_returns" | "trust" | "results_expectations" | "before_after" | "creator_gallery" | "press_authority" | "offer" | "bundle" | "subscription" | "product_details" | "other";
  title: string;
  reason: string;
  priority: number;
  placement: "after_ugc" | "mid_page" | "before_faq";
  status: "include" | "needs_input" | "skip";
  evidenceState: "supported" | "merchant_input" | "missing" | "unsafe";
  impactPotential: number;
  confidence: number;
  kicker: string;
  heading: string;
  body: string;
  bullets: string[];
  sourceNotes: string[];
  merchantQuestion: string;
};

export type ConversionOpportunityPlan = {
  category: string;
  coverageScore: number;
  scannedSources: string[];
  evaluatedPatterns: string[];
  modules: ConversionModule[];
  gaps: string[];
  researchedAt: string;
};

export type VisualQaIssue = {
  severity: "critical" | "major" | "minor" | "nit";
  page: "home_desktop" | "home_mobile" | "product_desktop" | "product_mobile" | "global";
  category: "broken" | "hierarchy" | "copy" | "trust" | "proof" | "cta" | "mobile" | "media" | "spacing" | "accessibility" | "performance" | "consistency" | "other";
  problem: string;
  evidence: string;
  suggestedFix: string;
  autoFixable: boolean;
};

export type VisualQaReport = {
  pass: number;
  score: number;
  satisfied: boolean;
  summary: string;
  strengths: string[];
  issues: VisualQaIssue[];
  nextActions: string[];
  screenshotAssetIds: string[];
  createdAt: string;
};


export type MediaDiscoveryVideo = {
  url: string;
  embedUrl: string;
  postId: string;
  title: string;
  author: string;
  angle: string;
  reason: string;
  query: string;
  thumbnailUrl?: string;
  downloaded: boolean;
  localAssetId?: string;
  error?: string;
};

export type MediaDiscoveryImage = {
  url: string;
  pageUrl: string;
  localAssetId?: string;
  downloaded: boolean;
  error?: string;
};

export type MediaDiscoveryReport = {
  searchTerms: string[];
  videoCandidates: MediaDiscoveryVideo[];
  imageCandidates: MediaDiscoveryImage[];
  discoveredAt: string;
  notes: string[];
};

export type ReferenceAnalysis = {
  category: string;
  productTypes: string[];
  archetype: string;
  qualityScore: number;
  pageSequence: string[];
  hookPatterns: string[];
  offerPatterns: string[];
  proofPatterns: string[];
  objectionPatterns: string[];
  visualPatterns: string[];
  mobilePatterns: string[];
  ctaPatterns: string[];
  trustPatterns: string[];
  strengths: string[];
  weaknesses: string[];
  transferableLessons: string[];
  distinctiveElementsToAvoidCopying: string[];
};

export type ReferenceStore = {
  id: string;
  ownerId: string;
  url: string;
  domain: string;
  title: string;
  source: "manual" | "discovered";
  status: "learning" | "ready" | "failed";
  categoryHint?: string;
  notes?: string;
  reason?: string;
  analysis?: ReferenceAnalysis;
  error?: string;
  createdAt: string;
  updatedAt: string;
  learnedAt?: string;
};

export type ReferenceMemoryUse = {
  category: string;
  selected: {
    id: string;
    url: string;
    title: string;
    source: "manual" | "discovered";
    qualityScore: number;
    archetype: string;
  }[];
  autoDiscovered: number;
  usedAt: string;
};

export type StoreConnection = {
  id: string;
  ownerId: string;
  shop: string;
  displayName: string;
  encryptedAccessToken: string;
  scopes: string[];
  createdAt: string;
  updatedAt: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  role: "owner" | "member" | "admin";
  createdAt: string;
};

export type ThemeProfile = {
  id: string;
  ownerId: string;
  name: string;
  storeId?: string;
  shopifyThemeId?: string;
  sourceAssetId?: string;
  notes?: string;
  createdAt: string;
};

export type BuildDefaults = {
  defaultCurrency: string;
  defaultMarkupMultiplier: number;
  defaultCompareAtMultiplier: number;
  enableBundleRecommendations: boolean;
  publishProductDuringBuild: boolean;
  shippingPromise: string;
  returnPolicySummary: string;
  supportEmail: string;
  claimGuardrails: string;
  useReferenceBrain: boolean;
  autoDiscoverReferences: boolean;
  referenceCountPerBuild: number;
  enableConversionOpportunityScan: boolean;
  enableVisualQa: boolean;
  autoApplyVisualQaFixes: boolean;
  visualQaTargetScore: number;
  visualQaMaxPasses: number;
  autoDiscoverTikTokVideos: boolean;
  autoTikTokVideoCount: number;
  autoDiscoverProductImages: boolean;
  autoProductImageCount: number;
  allowRehostDiscoveredVideos: boolean;
};

export type Project = {
  id: string;
  ownerId: string;
  name: string;
  productUrl: string;
  referenceUrl?: string;
  notes: string;
  mediaSourceMode?: "auto" | "uploads" | "auto_plus_uploads";
  videoSearchTerms?: string[];
  cost?: number;
  sellingPrice?: number;
  compareAtPrice?: number;
  currency: string;
  storeId?: string;
  baseThemeId?: string;
  status: "draft" | "ready" | "building" | "blocked" | "complete" | "failed";
  assets: AssetRef[];
  research?: ProductResearch;
  videos?: VideoAnalysis[];
  strategy?: MarketingStrategy;
  referenceMemory?: ReferenceMemoryUse;
  conversionPlan?: ConversionOpportunityPlan;
  mediaDiscovery?: MediaDiscoveryReport;
  steps: BuildStep[];
  build?: {
    productId?: string;
    productHandle?: string;
    themeId?: string;
    themeName?: string;
    previewUrl?: string;
    shopifyVideoUrls?: string[];
    warnings?: string[];
    visualQa?: {
      status: "waiting" | "running" | "satisfied" | "needs_review" | "blocked";
      targetScore: number;
      maxPasses: number;
      finalScore?: number;
      passes: VisualQaReport[];
      lastRunAt?: string;
      message?: string;
    };
  };
  createdAt: string;
  updatedAt: string;
};

export type DatabaseShape = {
  users: User[];
  stores: StoreConnection[];
  themeProfiles: ThemeProfile[];
  projects: Project[];
  referenceStores: ReferenceStore[];
  buildDefaults?: BuildDefaults;
};

export const defaultSteps = (): BuildStep[] => [
  { key: "ingest", label: "Inputs", status: "waiting" },
  { key: "research", label: "Product research", status: "waiting" },
  { key: "media_discovery", label: "Creative sourcing", status: "waiting" },
  { key: "video_analysis", label: "Video analysis", status: "waiting" },
  { key: "strategy", label: "Marketing strategy", status: "waiting" },
  { key: "conversion_scan", label: "Conversion opportunity scan", status: "waiting" },
  { key: "creative", label: "Creative assets", status: "waiting" },
  { key: "shopify_product", label: "Shopify product", status: "waiting" },
  { key: "theme", label: "Shrine build", status: "waiting" },
  { key: "ugc", label: "UGC integration", status: "waiting" },
  { key: "qa", label: "Mobile QA", status: "waiting" },
];
