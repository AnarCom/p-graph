import { describe, expect, it } from 'vitest';
import {
  pythonEnvironmentIssues,
  parseRequirementsText,
} from './pythonEnvironment';
import { sampleDraft } from '../mocks/sampleDraft';
import { mockNodeCatalog } from '../mocks/nodeCatalog';
import { validateDefinition } from './validation';
import { serializeDefinition } from './serialization';
import { useEditorStore } from './store';

describe('Python environment contract', () => {
  it('normalizes line endings and ignores blank dependency lines', () => {
    expect(
      parseRequirementsText('  requests==2.32.5\r\n\r\nnumpy==2.2.0\n'),
    ).toEqual(['requests==2.32.5', 'numpy==2.2.0']);
  });

  it.each([
    'requests==2.32.5',
    'requests[socks]==2.32.5',
    'package[one,two]==1.0',
    'pkg==2!1.0rc1.post2.dev3+local.1',
  ])('accepts an exact pin: %s', (requirement) => {
    expect(
      pythonEnvironmentIssues({
        pythonVersion: '3.12.1',
        requirements: [requirement],
      }),
    ).toEqual([]);
  });

  it.each([
    'requests',
    'requests>=2',
    'requests==2.*',
    'requests==1..0',
    '--index-url https://example.com',
    'pkg @ https://example.com/a.whl',
    '-r deps.txt',
    'pkg==1.0; python_version>"3.10"',
    '',
  ])('rejects unsupported dependency syntax: %s', (requirement) => {
    expect(
      pythonEnvironmentIssues({ requirements: [requirement] }).map(
        (issue) => issue.code,
      ),
    ).toContain('INVALID_PYTHON_REQUIREMENTS');
  });

  it('reports duplicate normalized package names and invalid environment types', () => {
    expect(
      pythonEnvironmentIssues({
        requirements: ['My_Package==1.0', 'my-package[extra]==2.0'],
      }).map((issue) => issue.code),
    ).toContain('DUPLICATE_PYTHON_REQUIREMENT');
    expect(
      pythonEnvironmentIssues({
        pythonVersion: 'python:latest',
        requirements: 'requests==2.32.5' as unknown as string[],
      }).map((issue) => issue.code),
    ).toEqual(['INVALID_PYTHON_VERSION', 'INVALID_PYTHON_REQUIREMENTS']);
  });

  it('keeps older 0.2 documents valid and serializes absent environment fields unchanged', () => {
    const definition = structuredClone(sampleDraft.definition);
    for (const node of definition.nodes) {
      if (node.implementation) {
        delete node.implementation.pythonVersion;
        delete node.implementation.requirements;
      }
    }
    expect(pythonEnvironmentIssues(undefined)).toEqual([]);
    expect(validateDefinition(definition, mockNodeCatalog).valid).toBe(true);
    expect(serializeDefinition(definition)).toEqual(definition);
  });

  it('preserves code, environment and independent nodes across edits and serialization', () => {
    useEditorStore.getState().hydrate(sampleDraft.definition, mockNodeCatalog);
    const requirements = ['requests==2.32.5'];
    useEditorStore
      .getState()
      .updateNodeEnvironment('python-read', {
        pythonVersion: '3.13',
        requirements,
      });
    requirements.push('unexpected==1.0');
    useEditorStore
      .getState()
      .updateNodeCode(
        'python-read',
        'import requests\n\ndef run(inputs):\n    return {"text": requests.__version__}\n',
      );
    const definition = serializeDefinition(
      useEditorStore.getState().definition!,
    );
    const implementation = definition.nodes.find(
      (node) => node.id === 'python-read',
    )!.implementation!;
    expect(implementation.pythonVersion).toBe('3.13');
    expect(implementation.requirements).toEqual(['requests==2.32.5']);
    expect(implementation.code).toContain('import requests');
    expect(definition.nodes.find((node) => node.id === 'input-file')).toEqual(
      sampleDraft.definition.nodes.find((node) => node.id === 'input-file'),
    );
    expect(useEditorStore.getState().dirty).toBe(true);
    expect(validateDefinition(definition, mockNodeCatalog).valid).toBe(true);
  });

  it('surfaces invalid requirements in graph validation without blocking draft serialization', () => {
    const definition = structuredClone(sampleDraft.definition);
    definition.nodes.find(
      (node) => node.id === 'python-read',
    )!.implementation!.requirements = ['requests'];
    expect(
      validateDefinition(definition, mockNodeCatalog).issues,
    ).toContainEqual(
      expect.objectContaining({
        code: 'INVALID_PYTHON_REQUIREMENTS',
        location: { kind: 'node', nodeId: 'python-read' },
      }),
    );
    expect(serializeDefinition(definition)).toEqual(definition);
  });
});
