import type { PythonImplementation } from '../domain/pipeline';

export const defaultPythonVersion = '3.12';
export const suggestedPythonVersions = ['3.12', '3.13', '3.14'];

// MVP subset: exact pins, optional extras and canonical Python package versions.
const identifier = '[A-Za-z0-9](?:[A-Za-z0-9._-]*[A-Za-z0-9])?';
const version =
  '(?:[0-9]+!)?[0-9]+(?:\\.[0-9]+)*(?:(?:a|b|rc)[0-9]+)?(?:\\.post[0-9]+)?(?:\\.dev[0-9]+)?(?:\\+[a-z0-9]+(?:[._-][a-z0-9]+)*)?';
const requirementPattern = new RegExp(
  `^(${identifier})(?:\\[${identifier}(?:,${identifier})*\\])?==${version}$`,
);

export function parseRequirementsText(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export function pythonEnvironmentIssues(
  implementation?: Pick<PythonImplementation, 'pythonVersion' | 'requirements'>,
) {
  const issues: { code: string; message: string }[] = [];
  if (
    implementation?.pythonVersion !== undefined &&
    (typeof implementation.pythonVersion !== 'string' ||
      !/^3\.[0-9]+(?:\.[0-9]+)?$/.test(implementation.pythonVersion))
  ) {
    issues.push({
      code: 'INVALID_PYTHON_VERSION',
      message: 'Версия Python должна иметь формат 3.x или 3.x.y',
    });
  }
  const requirements = implementation?.requirements;
  if (requirements === undefined) return issues;
  if (!Array.isArray(requirements)) {
    issues.push({
      code: 'INVALID_PYTHON_REQUIREMENTS',
      message: 'Зависимости Python должны быть массивом строк',
    });
    return issues;
  }
  const names = new Set<string>();
  for (const requirement of requirements) {
    const match =
      typeof requirement === 'string'
        ? requirementPattern.exec(requirement)
        : null;
    if (!match) {
      issues.push({
        code: 'INVALID_PYTHON_REQUIREMENTS',
        message: `Зависимость «${String(requirement)}»: используйте пакет==версия, например requests==2.32.5`,
      });
      continue;
    }
    const name = match[1]!.toLowerCase().replace(/[-_.]+/g, '-');
    if (names.has(name)) {
      issues.push({
        code: 'DUPLICATE_PYTHON_REQUIREMENT',
        message: `Пакет «${match[1]}» указан несколько раз`,
      });
    }
    names.add(name);
  }
  return issues;
}
