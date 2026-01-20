export interface Participant {
  id: number;
  category: string;
  firstname: string;
  lastname: string;
  sex: string;
  birth_year: number;
  club: string;
  weight: number;
  pool_number?: number | null;
  score?: number | null;
  hors_categorie?: boolean;
}

export interface PoolAssignment {
  id?: number;
  category: string;
  pool_number: number;
  table_number: number;
  order: number;
}

export type ParticipantCreate = Omit<Participant, 'id'>;

export interface ClubStats {
  club: string;
  total_score: number;
  count: number;
}

export interface StatsResponse {
  by_club: ClubStats[];
  warnings: Participant[];
}
