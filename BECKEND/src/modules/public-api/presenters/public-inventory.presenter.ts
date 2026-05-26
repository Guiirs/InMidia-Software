import type { InventoryItem } from '@modules/inventory';
import type { PublicInventoryItem } from '../contracts/public-api.contracts';
import { PublicMediaPresenter } from './public-media.presenter';

export interface PublicInventorySourceView {
  item: InventoryItem;
  source?: {
    nomeDaRua?: string;
    tamanho?: string;
    imagem?: unknown;
    regiaoNome?: string;
  };
}

export class PublicInventoryPresenter {
  static item(view: PublicInventorySourceView): PublicInventoryItem {
    const item = view.item;
    return {
      id: item.numeroPlaca ?? item.numeroOperacional?.toString() ?? item.placaId,
      boardNumber: item.numeroPlaca,
      operationalNumber: item.numeroOperacional,
      region: {
        id: item.regiaoId,
        name: view.source?.regiaoNome,
      },
      location: {
        street: view.source?.nomeDaRua,
        geo: item.coordinates
          ? {
              latitude: item.coordinates.latitude,
              longitude: item.coordinates.longitude,
              precision: 'exact',
            }
          : undefined,
      },
      size: view.source?.tamanho,
      availability: {
        status: item.availability.status,
        available: item.availability.available,
        reason: item.availability.reason,
      },
      status: {
        physical: item.status.physical,
        commercial: item.status.commercial,
        operational: item.status.operational,
      },
      media: PublicMediaPresenter.fromSource(
        view.source?.imagem,
        item.numeroPlaca ? `media-${item.numeroPlaca}` : `media-${item.placaId}`,
      ),
    };
  }

  static list(views: PublicInventorySourceView[]): PublicInventoryItem[] {
    return views.map((view) => this.item(view));
  }
}
