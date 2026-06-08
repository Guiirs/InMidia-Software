import AppError from '@shared/container/AppError';
import { IOrganization } from './organization.schema';
import { organizationRepository } from './organization.repository';
import { membershipRepository } from './membership/membership.repository';
import type { CreateOrganizationInput } from './dtos/organization.dto';

export class OrganizationService {
  async getCurrentOrganization(empresaId: string): Promise<IOrganization> {
    const org = await organizationRepository.findByLegacyEmpresaId(empresaId);
    if (!org) throw new AppError('Organização não encontrada para este tenant', 404);
    return org;
  }

  async createOrganization(data: CreateOrganizationInput, ownerUserId: string): Promise<IOrganization> {
    const org = await organizationRepository.create(data, ownerUserId);

    await membershipRepository.create(org._id.toString(), ownerUserId, 'OWNER');

    return org;
  }

  async getOrganizationById(id: string): Promise<IOrganization> {
    return organizationRepository.findById(id);
  }
}

export const organizationService = new OrganizationService();
