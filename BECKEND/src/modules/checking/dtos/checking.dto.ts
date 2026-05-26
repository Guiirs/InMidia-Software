/**
 * Checking DTOs
 * Schemas de validação para o módulo de checking (instalação/vistoria)
 */

import { z } from 'zod';
import { Types } from 'mongoose';
import { ValidationMessages } from '@shared/validators/validation-messages';
import { GeoPointInputSchema } from '@modules/spatial';

// ============================================
// SCHEMAS DE VALIDAÇÃO
// ============================================

/**
 * Schema para coordenadas GPS
 */
const GPSCoordinatesSchema = GeoPointInputSchema; // Aceita objeto, string, tuple e aliases lat/lng.

/**
 * Schema para criação de checking
 */
export const CreateCheckingSchema = z.object({
  aluguelId: z.string().min(1, ValidationMessages.required('Aluguel ID')),
  placaId: z.string().min(1, ValidationMessages.required('Placa ID')),
  installerId: z.string().min(1, ValidationMessages.required('Installer ID')),
  photoUrl: z.string().url(ValidationMessages.invalidUrl),
  gpsCoordinates: GPSCoordinatesSchema,
});

/**
 * Schema para atualização de checking
 */
export const UpdateCheckingSchema = z.object({
  photoUrl: z.string().url(ValidationMessages.invalidUrl).optional(),
  gpsCoordinates: GPSCoordinatesSchema.optional(),
});

/**
 * Schema para filtros de busca
 */
export const ListCheckingsQuerySchema = z.object({
  aluguelId: z.string().optional(),
  placaId: z.string().optional(),
  installerId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

// ============================================
// TIPOS
// ============================================

export type CreateCheckingInput = z.infer<typeof CreateCheckingSchema>;
export type UpdateCheckingInput = z.infer<typeof UpdateCheckingSchema>;
export type ListCheckingsQuery = z.infer<typeof ListCheckingsQuerySchema>;

/**
 * Entidade de Checking para retorno
 */
export interface CheckingEntity {
  _id: Types.ObjectId;
  aluguelId: Types.ObjectId | { _id: Types.ObjectId; numero_contrato?: string };
  placaId: Types.ObjectId | { _id: Types.ObjectId; numero_placa: string };
  installerId: Types.ObjectId | { _id: Types.ObjectId; nome: string; email: string };
  photoUrl: string;
  gpsCoordinates: {
    latitude: number;
    longitude: number;
  } | string;
  installedAt: Date;
}
