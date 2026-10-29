# p-graph UI

Mock-first редактор pipeline на React, Material UI и React Flow.

Полная инструкция по запуску и troubleshooting:
[docs/frontend-runbook.md](../docs/frontend-runbook.md).

## Локальный запуск

Требуется Node.js 22 или новее. Для nvm версия закреплена в .nvmrc.

~~~bash
nvm use
npm ci
npm run dev
~~~

Открыть http://localhost:5173.

Черновик хранится в localStorage браузера. Кнопка «Сбросить» удаляет локальный
черновик и возвращает демонстрационный граф из JSON-контракта.

## Проверки

~~~bash
npm run typecheck
npm test
npm run build
~~~

## Docker

~~~bash
docker build -t pgraph-ui:local .
docker run --rm -p 8080:8080 pgraph-ui:local
~~~

Приложение будет доступно на http://localhost:8080, health-check —
http://localhost:8080/healthz.

## Текущие mock-возможности

- каталог четырёх типов узлов версии 0.1;
- добавление кликом или drag-and-drop, перемещение, настройка и удаление узлов;
- соединение совместимых портов;
- сохранение черновика в localStorage;
- mock-валидация правил запуска;
- просмотр, копирование и скачивание backend JSON.

При появлении API LocalPipelineRepository заменяется на HttpPipelineRepository;
canvas и доменная модель от транспорта не зависят.

