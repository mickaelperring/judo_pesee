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
  victories?: number;
  has_fights?: boolean;
  hors_categorie?: boolean;
}

export interface PoolAssignment {
    id: number;
    category: string;
    pool_number: number;
    table_number: number;
    order: number;
    validated?: boolean;
}

export interface Fight {
  id: number;
  category: string;
  fighter1_id: number;
  fighter2_id: number;
  score1: number;
  score2: number;
  winner_id: number | null;
}

export type ParticipantCreate = Omit<Participant, 'id'>;
export type FightCreate = Omit<Fight, 'id'>;

export interface ClubStats {
  club: string;
  total_score: number;
  count: number;
}

export interface StatsResponse {
  by_club: ClubStats[];
  warnings: Participant[];
}
