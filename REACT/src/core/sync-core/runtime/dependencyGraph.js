export function buildDependencyGraph(registry) {
  const graph = {};

  Object.values(registry).forEach((resource) => {
    graph[resource.key] = {
      key: resource.key,
      dependencies: new Set(resource.dependencies ?? []),
      dependents: new Set(resource.dependents ?? []),
    };
  });

  Object.values(graph).forEach((node) => {
    node.dependencies.forEach((dependencyKey) => {
      if (!graph[dependencyKey]) {
        graph[dependencyKey] = { key: dependencyKey, dependencies: new Set(), dependents: new Set() };
      }
      graph[dependencyKey].dependents.add(node.key);
    });
  });

  return graph;
}

export function getDependents(resourceKey, graph, options = {}) {
  const maxDepth = options.maxDepth ?? 4;
  const visited = new Set();
  const queue = [{ key: resourceKey, depth: 0 }];

  while (queue.length) {
    const item = queue.shift();
    const node = graph[item.key];
    if (!node || item.depth >= maxDepth) continue;

    node.dependents.forEach((dependentKey) => {
      if (visited.has(dependentKey)) return;
      visited.add(dependentKey);
      queue.push({ key: dependentKey, depth: item.depth + 1 });
    });
  }

  return Array.from(visited);
}

export function getDependencies(resourceKey, graph, options = {}) {
  const maxDepth = options.maxDepth ?? 4;
  const visited = new Set();
  const queue = [{ key: resourceKey, depth: 0 }];

  while (queue.length) {
    const item = queue.shift();
    const node = graph[item.key];
    if (!node || item.depth >= maxDepth) continue;

    node.dependencies.forEach((dependencyKey) => {
      if (visited.has(dependencyKey)) return;
      visited.add(dependencyKey);
      queue.push({ key: dependencyKey, depth: item.depth + 1 });
    });
  }

  return Array.from(visited);
}

export function hasDependencyCycle(resourceKey, graph) {
  const visiting = new Set();
  const visited = new Set();

  const visit = (key) => {
    if (visiting.has(key)) return true;
    if (visited.has(key)) return false;
    visited.add(key);
    visiting.add(key);

    const node = graph[key];
    const hasCycle = Array.from(node?.dependencies ?? []).some((dependencyKey) => visit(dependencyKey));
    visiting.delete(key);
    return hasCycle;
  };

  return visit(resourceKey);
}

export function graphSnapshot(graph) {
  return Object.fromEntries(Object.entries(graph).map(([key, node]) => [
    key,
    {
      dependencies: Array.from(node.dependencies),
      dependents: Array.from(node.dependents),
    },
  ]));
}
