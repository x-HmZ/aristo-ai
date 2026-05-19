export interface Concept {
  id:                     string;
  name:                   string;
  domain:                 string;
  description?:           string | null;
  difficulty:             number;
  bloom_level:            string;
  estimated_minutes:      number;
  key_terms?:             string[];
  learning_objectives?:   string[];
  common_misconceptions?: string[];
  tags?:                  string[];
  prerequisites:          string[];
}
