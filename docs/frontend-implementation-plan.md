# План реализации frontend на моках

Статус: increment 1 complete  
Архитектура: [frontend-architecture.md](frontend-architecture.md)  
Запуск: [frontend-runbook.md](frontend-runbook.md)

## Цель первого инкремента

Получить запускаемый frontend редактора pipeline, который не зависит от
готовности backend и уже работает с каноническим JSON-контрактом версии 0.1.

Критерий готовности: пользователь собирает граф из mock-каталога, соединяет и
настраивает узлы, локально сохраняет черновик и получает JSON для будущей
ручки сохранения draft.

## Инкремент 1. Рабочий mock-редактор

- [x] Создать React + TypeScript + Vite приложение в ui/.
- [x] Подключить Material UI и React Flow.
- [x] Описать типы PipelineDefinition, NodeCatalog и ValidationResult.
- [x] Добавить mock-каталог четырёх типов узлов MVP.
- [x] Реализовать LocalPipelineRepository поверх localStorage.
- [x] Собрать palette, canvas, custom node и inspector.
- [x] Добавить создание, перемещение, соединение и удаление узлов.
- [x] Добавить чистую сериализацию в backend JSON.
- [x] Добавить mock-валидацию и подсветку проблем.
- [x] Добавить JSON preview, копирование и скачивание.
- [x] Добавить unit-тесты сериализации и валидации.
- [x] Добавить production Docker image.
- [x] Проверить typecheck, tests, build и Docker image.

## Инкремент 2. Полировка редактора

- [ ] Undo/redo для доменных команд.
- [ ] Редактирование pipeline inputs.
- [ ] Импорт JSON с безопасной структурной проверкой.
- [ ] Auto-layout для документов без координат.
- [ ] Несколько mock pipeline и экран каталога.
- [ ] Улучшенная keyboard accessibility.
- [ ] E2E-сценарий Playwright.

## Инкремент 3. Подключение backend

- [ ] Сгенерировать frontend types из OpenAPI.
- [ ] Реализовать HttpPipelineRepository.
- [ ] Заменить mock catalog на node-catalog endpoints.
- [ ] Подключить GET/PUT draft.
- [ ] Подключить backend validation.
- [ ] Подключить публикацию revision.
- [ ] Добавить optimistic concurrency для draft.
- [ ] Оставить LocalPipelineRepository для Storybook/demo/tests.

## Правило интеграции

UI и editor store работают только через PipelineRepository. Mock и HTTP
реализации возвращают одинаковые доменные модели, поэтому появление backend не
требует переписывать canvas, inspector или сериализацию.

