import { pythonEnvironmentIssues } from './pythonEnvironment';
import type {
  ConfigPropertySchema,
  NodeCatalog,
  NodeTypeDefinition,
  PipelineDefinition,
  PipelineNode,
  ValidationIssue,
  ValidationResult,
} from '../domain/pipeline';
import { resolveNodeType, validPortDefinitions } from './nodePorts';
import { arePortTypesCompatible } from './portCompatibility';

function issue(
  code: string,
  message: string,
  location: ValidationIssue['location'],
): ValidationIssue {
  return { code, message, location };
}

function valueMatches(value: unknown, property: ConfigPropertySchema): boolean {
  if (property.type === 'integer') {
    return typeof value === 'number' && Number.isInteger(value);
  }

  return typeof value === property.type;
}

function validateConfig(
  node: PipelineNode,
  nodeType: NodeTypeDefinition,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const schema = nodeType.configSchema;

  for (const required of schema.required ?? []) {
    const value = node.config[required];

    if (value === undefined || value === '') {
      issues.push(
        issue(
          'MISSING_CONFIG',
          `Заполните поле «${schema.properties[required]?.title ?? required}»`,
          {
            kind: 'config',
            nodeId: node.id,
            configPath: `/${required}`,
          },
        ),
      );
    }
  }

  for (const [name, value] of Object.entries(node.config)) {
    const property = schema.properties[name];

    if (!property) {
      if (schema.additionalProperties === false) {
        issues.push(
          issue('UNKNOWN_CONFIG_PROPERTY', `Неизвестное поле config: ${name}`, {
            kind: 'config',
            nodeId: node.id,
            configPath: `/${name}`,
          }),
        );
      }
      continue;
    }

    if (!valueMatches(value, property)) {
      issues.push(
        issue(
          'INVALID_CONFIG_TYPE',
          `Неверный тип поля «${property.title ?? name}»`,
          {
            kind: 'config',
            nodeId: node.id,
            configPath: `/${name}`,
          },
        ),
      );
      continue;
    }

    if (property.enum && !property.enum.includes(value as never)) {
      issues.push(
        issue(
          'INVALID_CONFIG_VALUE',
          `Недопустимое значение поля «${property.title ?? name}»`,
          {
            kind: 'config',
            nodeId: node.id,
            configPath: `/${name}`,
          },
        ),
      );
    }
  }

  return issues;
}

function hasCycle(definition: PipelineDefinition): boolean {
  const adjacency = new Map<string, string[]>();
  const state = new Map<string, 0 | 1 | 2>();

  for (const node of definition.nodes) {
    adjacency.set(node.id, []);
    state.set(node.id, 0);
  }

  for (const edge of definition.edges) {
    adjacency.get(edge.source.nodeId)?.push(edge.target.nodeId);
  }

  const visit = (nodeId: string): boolean => {
    const current = state.get(nodeId);

    if (current === 1) return true;
    if (current === 2) return false;

    state.set(nodeId, 1);
    for (const target of adjacency.get(nodeId) ?? []) {
      if (visit(target)) return true;
    }
    state.set(nodeId, 2);
    return false;
  };

  return definition.nodes.some((node) => visit(node.id));
}

function nodesWithoutPathToReturn(definition: PipelineDefinition): string[] {
  const endIds = new Set(
    definition.nodes
      .filter((node) => node.type === 'builtin.return')
      .map((node) => node.id),
  );
  const adjacency = new Map<string, string[]>();

  for (const node of definition.nodes) adjacency.set(node.id, []);
  for (const edge of definition.edges) {
    adjacency.get(edge.source.nodeId)?.push(edge.target.nodeId);
  }

  const reachesEnd = (start: string): boolean => {
    const seen = new Set<string>();
    const stack = [start];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current || seen.has(current)) continue;
      if (endIds.has(current)) return true;
      seen.add(current);
      stack.push(...(adjacency.get(current) ?? []));
    }

    return false;
  };

  return definition.nodes
    .filter((node) => !reachesEnd(node.id))
    .map((node) => node.id);
}

export function validateDefinition(
  definition: PipelineDefinition,
  catalog: NodeCatalog,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  if (
    definition.schemaVersion !== '0.2' ||
    definition.nodeCatalogVersion !== catalog.catalogVersion
  ) {
    issues.push(
      issue(
        'UNSUPPORTED_VERSION',
        'Обновите формат черновика до 0.2 перед проверкой запуска',
        { kind: 'graph' },
      ),
    );
  }
  const nodeById = new Map(definition.nodes.map((node) => [node.id, node]));
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();
  const endpoints = new Set<string>();

  for (const node of definition.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push(
        issue('DUPLICATE_NODE_ID', `Повторяется id узла: ${node.id}`, {
          kind: 'node',
          nodeId: node.id,
        }),
      );
    }
    nodeIds.add(node.id);

    const nodeType = resolveNodeType(catalog, node);
    if (!nodeType) {
      issues.push(
        issue(
          'UNKNOWN_NODE_TYPE',
          `Неизвестный тип узла ${node.type}@${node.typeVersion}`,
          { kind: 'node', nodeId: node.id },
        ),
      );
      continue;
    }

    if (nodeType.status === 'disabled') {
      issues.push(
        issue('DISABLED_NODE_TYPE', 'Тип узла отключён', {
          kind: 'node',
          nodeId: node.id,
        }),
      );
    }

    issues.push(...validateConfig(node, nodeType));
    if (
      !validPortDefinitions(nodeType.inputs, true) ||
      !validPortDefinitions(nodeType.outputs, false)
    ) {
      issues.push(
        issue(
          'INVALID_PORT_DEFINITION',
          'Проверьте имена, типы и ограничения портов',
          { kind: 'node', nodeId: node.id },
        ),
      );
    }
    if (
      !nodeType.editablePorts &&
      (node.inputs !== undefined || node.outputs !== undefined)
    ) {
      issues.push(
        issue('FIXED_PORT_OVERRIDE', 'Порты этого типа фиксированы каталогом', {
          kind: 'node',
          nodeId: node.id,
        }),
      );
    }
    if (node.type === 'builtin.python') {
      issues.push(
        ...pythonEnvironmentIssues(node.implementation).map((current) =>
          issue(current.code, current.message, {
            kind: 'node',
            nodeId: node.id,
          }),
        ),
      );
      if (
        node.implementation?.language !== 'python' ||
        node.implementation.entrypoint !== 'run' ||
        !node.implementation.code.trim()
      ) {
        issues.push(
          issue(
            'MISSING_PYTHON_CODE',
            'Добавьте Python-код с функцией run(inputs)',
            { kind: 'node', nodeId: node.id },
          ),
        );
      }
    } else if (node.implementation) {
      issues.push(
        issue(
          'UNEXPECTED_IMPLEMENTATION',
          'Python-код доступен только Python-кубикам',
          { kind: 'node', nodeId: node.id },
        ),
      );
    }
    if (
      node.type !== 'builtin.return' &&
      nodeType.outputs.some((port) => port.dataType === 'any')
    ) {
      issues.push(
        issue(
          'INVALID_OUTPUT_TYPE',
          'Укажите конкретный тип выхода Python-кубика',
          { kind: 'node', nodeId: node.id },
        ),
      );
    }
    if (node.type === 'builtin.return') {
      for (const port of nodeType.outputs) {
        const input = nodeType.inputs.find(
          (input) => input.name === port.sourcePort,
        );
        if (!input || input.dataType !== port.dataType) {
          issues.push(
            issue(
              'INVALID_RETURN_OUTPUT',
              `Для результата «${port.title}» выберите вход-источник с тем же типом`,
              { kind: 'port', nodeId: node.id, port: port.name },
            ),
          );
        }
      }
      if (!definition.edges.some((edge) => edge.target.nodeId === node.id)) {
        issues.push(
          issue(
            'MISSING_RETURN_CONNECTION',
            'Подключите хотя бы один вход return',
            { kind: 'node', nodeId: node.id },
          ),
        );
      }
      if (definition.edges.some((edge) => edge.source.nodeId === node.id)) {
        issues.push(
          issue(
            'RETURN_OUTGOING_EDGE',
            'Выходы return являются результатами pipeline и не соединяются с другими кубиками',
            { kind: 'node', nodeId: node.id },
          ),
        );
      }
    }
  }

  for (const edge of definition.edges) {
    if (edgeIds.has(edge.id)) {
      issues.push(
        issue('DUPLICATE_EDGE_ID', `Повторяется id связи: ${edge.id}`, {
          kind: 'edge',
          edgeId: edge.id,
        }),
      );
    }
    edgeIds.add(edge.id);
    const endpointKey = JSON.stringify([
      edge.source.nodeId,
      edge.source.port,
      edge.target.nodeId,
      edge.target.port,
    ]);
    if (endpoints.has(endpointKey))
      issues.push(
        issue(
          'DUPLICATE_CONNECTION',
          'Связь между этими портами уже существует',
          { kind: 'edge', edgeId: edge.id },
        ),
      );
    endpoints.add(endpointKey);

    const sourceNode = nodeById.get(edge.source.nodeId);
    const targetNode = nodeById.get(edge.target.nodeId);

    if (!sourceNode || !targetNode) {
      issues.push(
        issue('MISSING_EDGE_NODE', 'Связь ссылается на отсутствующий узел', {
          kind: 'edge',
          edgeId: edge.id,
        }),
      );
      continue;
    }

    const sourceType = resolveNodeType(catalog, sourceNode);
    const targetType = resolveNodeType(catalog, targetNode);
    const sourcePort = sourceType?.outputs.find(
      (port) => port.name === edge.source.port,
    );
    const targetPort = targetType?.inputs.find(
      (port) => port.name === edge.target.port,
    );

    if (!sourcePort || !targetPort) {
      issues.push(
        issue('UNKNOWN_PORT', 'Связь ссылается на отсутствующий порт', {
          kind: 'edge',
          edgeId: edge.id,
        }),
      );
      continue;
    }

    if (!arePortTypesCompatible(sourcePort.dataType, targetPort.dataType)) {
      issues.push(
        issue(
          'INCOMPATIBLE_PORT_TYPES',
          `Несовместимые типы: ${sourcePort.dataType} → ${targetPort.dataType}`,
          { kind: 'edge', edgeId: edge.id },
        ),
      );
    }
  }

  for (const node of definition.nodes) {
    const nodeType = resolveNodeType(catalog, node);
    if (!nodeType) continue;

    for (const port of nodeType.inputs) {
      const connections = definition.edges.filter(
        (edge) =>
          edge.target.nodeId === node.id && edge.target.port === port.name,
      ).length;

      if (connections < (port.minConnections ?? 0)) {
        issues.push(
          issue(
            'MISSING_CONNECTION',
            `Вход «${port.title}» требует связей: ${port.minConnections}`,
            { kind: 'port', nodeId: node.id, port: port.name },
          ),
        );
      }

      if (
        port.maxConnections !== undefined &&
        port.maxConnections !== null &&
        connections > port.maxConnections
      ) {
        issues.push(
          issue(
            'TOO_MANY_CONNECTIONS',
            `У входа «${port.title}» слишком много связей`,
            { kind: 'port', nodeId: node.id, port: port.name },
          ),
        );
      }
    }
  }

  const endNodes = definition.nodes.filter(
    (node) => node.type === 'builtin.return',
  );

  if (endNodes.length !== 1) {
    issues.push(
      issue(
        'INVALID_RETURN_COUNT',
        'В графе должен быть ровно один узел return',
        {
          kind: 'graph',
        },
      ),
    );
  }

  if (hasCycle(definition)) {
    issues.push(
      issue('CYCLE_DETECTED', 'Граф содержит цикл', { kind: 'graph' }),
    );
  } else if (endNodes.length === 1) {
    for (const nodeId of nodesWithoutPathToReturn(definition)) {
      issues.push(
        issue('NO_PATH_TO_RETURN', 'Узел не входит в путь, ведущий к return', {
          kind: 'node',
          nodeId,
        }),
      );
    }
  }

  const fileInputNodes = definition.nodes.filter(
    (node) => node.type === 'builtin.file-input',
  );
  for (const node of fileInputNodes) {
    const inputName = node.config.inputName;
    if (
      typeof inputName === 'string' &&
      definition.inputs[inputName] === undefined
    ) {
      issues.push(
        issue(
          'UNKNOWN_PIPELINE_INPUT',
          `Вход pipeline «${inputName}» не объявлен`,
          { kind: 'config', nodeId: node.id, configPath: '/inputName' },
        ),
      );
    }
  }

  return { valid: issues.length === 0, issues };
}
