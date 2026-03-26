export type NicheId =
  | 'psychology'
  | 'finance'
  | 'history'
  | 'science'
  | 'philosophy'
  | 'technology'
  | 'health'
  | 'mystery'
  | 'motivation';

export interface Niche {
  id: NicheId;
  label: string;
  icon: string;
  cpm: number; // USD
}

export interface GeneratedContent {
  id: string;
  topic: string;
  niche: NicheId;
  nicheLabel: string;
  createdAt: string; // ISO string
  title: string;
  hook: string;
  script: string;
  image_prompts: string[];
  tags: string[];
  wordCount: number;
  estimatedCpm: number;
}

export const NICHES: Niche[] = [
  { id: 'psychology',  label: 'Psychology',   icon: '🧠', cpm: 8.50  },
  { id: 'finance',     label: 'Finance',       icon: '💰', cpm: 12.00 },
  { id: 'history',     label: 'History',       icon: '📜', cpm: 6.00  },
  { id: 'science',     label: 'Science',       icon: '🔬', cpm: 7.50  },
  { id: 'philosophy',  label: 'Philosophy',    icon: '🪐', cpm: 5.50  },
  { id: 'technology',  label: 'Technology',    icon: '⚡', cpm: 9.00  },
  { id: 'health',      label: 'Health',        icon: '🌿', cpm: 10.00 },
  { id: 'mystery',     label: 'Mystery',       icon: '🕵️', cpm: 7.00  },
  { id: 'motivation',  label: 'Motivation',    icon: '🔥', cpm: 6.50  },
];
