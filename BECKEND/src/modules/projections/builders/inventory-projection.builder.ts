import { inventoryService } from '@modules/inventory';
import type { InventoryProjection, ProjectionBuildInput, ProjectionContext } from '../contracts/projection.contracts';

export class InventoryProjectionBuilder {
  build(input: ProjectionBuildInput, context: ProjectionContext = {}): InventoryProjection {
    const sources = context.partialSourceIds?.length
      ? input.inventorySources.filter((source) => {
          const id = source.placa._id ?? source.placa.id;
          return id !== undefined && context.partialSourceIds?.includes(String(id));
        })
      : input.inventorySources;

    const evaluationContext = {
      now: context.now,
      sources,
    };

    return {
      items: sources.map((source) => inventoryService.evaluateInventoryItem(source, evaluationContext).item),
      summary: inventoryService.buildInventorySummary(sources, evaluationContext),
    };
  }
}
