import { z } from 'zod';

export const CreateOrganizationSchema = z.object({
  name: z.string().min(2).max(200).trim(),
  slug: z
    .string()
    .min(2)
    .max(60)
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, 'Slug deve conter apenas letras minúsculas, números e hífens'),
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).default('FREE'),
  legacyEmpresaId: z.string().optional(),
});

export const UpdateOrganizationSchema = z.object({
  name: z.string().min(2).max(200).trim().optional(),
  plan: z.enum(['FREE', 'STARTER', 'PRO', 'ENTERPRISE']).optional(),
  onboardingStatus: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED']).optional(),
  settings: z
    .object({
      allowSelfServiceInvite: z.boolean().optional(),
      maxMembers: z.number().int().positive().optional(),
      timezone: z.string().optional(),
      locale: z.string().optional(),
    })
    .optional(),
});

export const UpdateMemberRoleSchema = z.object({
  role: z.enum(['OWNER', 'ADMIN', 'MANAGER', 'OPERATOR', 'FINANCIAL', 'VIEWER']),
});

export const UpdateMemberStatusSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'REMOVED']),
});

export type CreateOrganizationInput = z.infer<typeof CreateOrganizationSchema>;
export type UpdateOrganizationInput = z.infer<typeof UpdateOrganizationSchema>;
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>;
export type UpdateMemberStatusInput = z.infer<typeof UpdateMemberStatusSchema>;
