export function createSyncGraphVisualizer({ registry, getDependencyGraph }) {
  return {
    nodes() {
      return Object.values(registry).map((resource) => ({
        id: resource.key,
        label: resource.debugLabel ?? resource.key,
        domain: resource.domain,
        ttlMs: resource.ttlMs,
      }));
    },

    edges() {
      const graph = getDependencyGraph();
      return Object.entries(graph).flatMap(([key, node]) => (
        node.dependents.map((dependentKey) => ({
          from: key,
          to: dependentKey,
          type: 'dependent',
        }))
      ));
    },

    snapshot() {
      return {
        nodes: this.nodes(),
        edges: this.edges(),
      };
    },

    toDot() {
      const lines = ['digraph SyncCore {'];
      this.nodes().forEach((node) => {
        lines.push(`  "${node.id}" [label="${node.label}", domain="${node.domain}"];`);
      });
      this.edges().forEach((edge) => {
        lines.push(`  "${edge.from}" -> "${edge.to}" [label="${edge.type}"];`);
      });
      lines.push('}');
      return lines.join('\n');
    },
  };
}
