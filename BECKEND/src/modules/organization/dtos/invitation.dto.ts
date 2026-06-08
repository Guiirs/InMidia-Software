import { z } from 'zod';

export const CreateInvitationSchema = z.object({
  email: z.string().email('Email inválido').toLowerCase().trim(),
  role: z.enum(['ADMIN', 'MANAGER', 'OPERATOR', 'FINANCIAL', 'VIEWER']),
});

export const AcceptInvitationSchema = z.object({
  token: z.string().min(1, 'Token é obrigatório'),
});

export type CreateInvitationInput = z.infer<typeof CreateInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof AcceptInvitationSchema>;
