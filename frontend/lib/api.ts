import axios from 'axios';
import { Participant, ParticipantCreate, StatsResponse, PoolAssignment } from '@/types';

// Force relative path for dev/prod consistency via Traefik/Next.js Proxy
const API_URL = '/api'; 

export const api = axios.create({
  baseURL: API_URL,
});

export const getCategories = () => api.get<string[]>('/categories').then(res => res.data);
export const getPreregistrations = () => api.get<ParticipantCreate[]>('/preregistrations').then(res => res.data);
export const getParticipants = (category?: string) => 
  api.get<Participant[]>(`/participants${category ? `?category=${category}` : ''}`).then(res => res.data);
export const createParticipant = (data: ParticipantCreate) => api.post<Participant>('/participants', data).then(res => res.data);
export const updateParticipant = (id: number, data: Partial<Participant>) => api.put<Participant>(`/participants/${id}`, data).then(res => res.data);
export const deleteParticipant = (id: number) => api.delete(`/participants/${id}`).then(res => res.data);
export const updatePools = (updates: { id: number; pool_number: number }[]) => 
  api.put('/participants/batch/update_pools', updates).then(res => res.data);
export const getClubs = () => api.get<string[]>('/clubs').then(res => res.data);
export const generatePools = (category: string) => api.post(`/generate_pools/${category}`).then(res => res.data);
export const getStats = () => api.get<StatsResponse>('/stats').then(res => res.data);
export const getScoreSheetUrl = (category: string, baseUrl?: string) => 
  `${API_URL}/score_sheet/${category}${baseUrl ? `?base_url=${encodeURIComponent(baseUrl)}` : ''}`;
export const getChronoConfig = () => api.get<Record<string, {match_time: number, osaekomi_time: number}>>('/chrono_config').then(res => res.data);

// Config & Tables
export const getConfig = (key: string) => api.get<{value: string | null}>(`/configuration/${key}`).then(res => res.data);
export const updateConfig = (key: string, value: string) => api.post('/configuration', { key, value }).then(res => res.data);
export const getPoolAssignments = () => api.get<PoolAssignment[]>(`/pool_assignments?_t=${Date.now()}`).then(res => res.data);
export const updatePoolAssignments = (assignments: Omit<PoolAssignment, 'id'>[]) => api.post('/pool_assignments/batch', assignments).then(res => res.data);
export const validatePool = (category: string, poolNumber: number, validated: boolean) => 
  api.post('/pool_assignments/validate', { category, pool_number: poolNumber, validated }).then(res => res.data);

// Fights
export const getFights = (category?: string, poolNumber?: number) => 
  api.get<any[]>(`/fights?${category ? `category=${encodeURIComponent(category)}` : ''}${poolNumber ? `&pool_number=${poolNumber}` : ''}`).then(res => res.data);
export const createFights = (fights: any[]) => api.post('/fights', fights).then(res => res.data);
export const updateFight = (id: number, data: any) => api.put(`/fights/${id}`, data).then(res => res.data);
export const deleteFight = (id: number) => api.delete(`/fights/${id}`).then(res => res.data);
