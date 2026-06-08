import { Types } from 'mongoose';
import AppError from '@shared/container/AppError';
import { Organization, IOrganization } from './organization.schema';
import type { CreateOrganizationInput } from './dtos/organization.dto';

export class OrganizationRepository {
  async findById(id: string): Promise<IOrganization> {
    if (!Types.ObjectId.isValid(id)) throw new AppError('ID de organização inválido', 400);
    const org = await Organization.findById(id).lean();
    if (!org) throw new AppError('Organização não encontrada', 404);
    return org as unknown as IOrganization;
  }

  async findByLegacyEmpresaId(empresaId: string): Promise<IOrganization | null> {
    if (!Types.ObjectId.isValid(empresaId)) return null;
    return Organization.findOne({ legacyEmpresaId: new Types.ObjectId(empresaId) })
      .lean() as unknown as Promise<IOrganization | null>;
  }

  async findBySlug(slug: string): Promise<IOrganization | null> {
    return Organization.findOne({ slug }).lean() as unknown as Promise<IOrganization | null>;
  }

  async create(data: CreateOrganizationInput, ownerUserId: string): Promise<IOrganization> {
    const existing = await Organization.findOne({ slug: data.slug });
    if (existing) throw new AppError('Slug já está em uso', 409);

    const org = new Organization({
      name: data.name,
      slug: data.slug,
      plan: data.plan,
      ownerUserId: new Types.ObjectId(ownerUserId),
      legacyEmpresaId: data.legacyEmpresaId ? new Types.ObjectId(data.legacyEmpresaId) : undefined,
      status: 'ACTIVE',
      onboardingStatus: 'PENDING',
    });

    await org.save();
    return org.toObject<IOrganization>();
  }

  async updateStatus(id: string, status: IOrganization['status']): Promise<IOrganization> {
    const org = await Organization.findByIdAndUpdate(
      id,
      { status },
      { new: true, runValidators: true }
    ).lean();
    if (!org) throw new AppError('Organização não encontrada', 404);
    return org as unknown as IOrganization;
  }
}

export const organizationRepository = new OrganizationRepository();
