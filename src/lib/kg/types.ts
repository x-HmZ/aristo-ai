// ============================================================
// Knowledge Graph — shared types
// ============================================================

export interface Concept {
  id: string;
  domain: string;
  name: string;
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  bloom_level: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create";
  estimated_minutes: number;
  key_terms: string[];
  learning_objectives: string[];
  common_misconceptions: string[];
  tags: string[];
  created_at?: string;
}

export interface ConceptWithPrereqs extends Concept {
  prerequisites: string[];   // prerequisite concept IDs
  dependents: string[];      // concept IDs that require this one
}

export interface GraphValidationError {
  type: "cycle" | "orphan" | "missing_prerequisite" | "no_root";
  message: string;
  involved?: string[];
}
