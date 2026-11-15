import type { NodeLogs } from '../domain/pipeline';

export const demoRunId = 'demo-run-001';
export const mockNodeLogs: Record<string, NodeLogs> = Object.fromEntries(
  (
    [
      ['input-file', 'Вход sourceFile: demo.txt'],
      ['python-read', 'Прочитано символов: 18'],
      ['print-text', 'Hello from p-graph!'],
      ['return', 'Результаты pipeline возвращены успешно'],
      ['control-prepare', 'Подготовлен текст'],
      ['control-print', '[control] Пример сигнала control'],
      ['control-after', 'Вывод в консоль завершён, выполняю следующий шаг'],
      ['control-return', 'Результат: Готово после печати'],
    ] as [string, string][]
  ).map(([nodeId, message], index) => [
    nodeId,
    {
      runId: demoRunId,
      nodeId,
      attempt: 1,
      status: 'Succeeded',
      entries: [
        { timestamp: `2026-11-15T09:00:0${index}Z`, stream: 'stdout', message },
      ],
    } satisfies NodeLogs,
  ]),
);
