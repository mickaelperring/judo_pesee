export interface Club {
    id: number;
    name: string;
}

export interface Category {
    id: number;
    name: string;
    include_in_stats: boolean;
    birth_year_min?: number;
    birth_year_max?: number;
}

export interface Participant {
    id: number;
    firstname: string;
    lastname: string;
    sex: string;
    birth_year: number;
    weight: number;
    club_id: number;
    category_id: number;
    pool_number: number | null;
    hors_categorie: boolean;
    // Computed fields from backend
    category_name?: string;
    club_name?: string;
    score?: number;
    victories?: number;
    has_fights?: boolean;
}

export interface ParticipantCreate {
    firstname: string;
    lastname: string;
    sex: string;
    birth_year: number;
    weight: number;
    club_id: number;
    category_id: number;
    pool_number?: number | null;
    hors_categorie?: boolean;
}

export interface Fight {
    id: number;
    fighter1_id: number;
    fighter2_id: number;
    score1: number;
    score2: number;
    winner_id: number | null;
}

export interface PoolAssignment {
    id: number;
    pool_number: number;
    table_number: number;
    order: number;
    validated: boolean;
    category_id: number;
    category_name?: string;
}

export interface StatsResponse {
    by_club: Array<{
        club: string;
        count: number;
        total_score: number;
        total_victories: number;
    }>;
    warnings: Participant[];
}