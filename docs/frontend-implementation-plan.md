# План реализации frontend на моках

Статус: increment 1 + custom nodes complete
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
- [x] Сохранить HttpPipelineRepository из main и явный выбор локального режима.
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


## Выполнено: пользовательские кубики и контракт 0.2

- [x] end заменён на return с редактируемыми входами и результатами.
- [x] Несколько стрелок в один пин, общая проверка лимитов и циклов.
- [x] Пользовательский Python-кубик с CodeMirror, настройкой портов и кодом в JSON.
- [x] Логи выбранного кубика через PipelineRepository, пока demo-run-001.
- [x] read-file удалён из палитры и заменён Python-кодом в примере.
- [x] Автоматическое обновление черновика 0.1 → 0.2 при загрузке с резервной копией и сохранением id и связей.
- [x] Модели TypeSpec и генерация OpenAPI для нового контракта.
- [x] Тесты портов, соединений, сохранения кода, логов и обновления формата.

Следующий этап: HTTP-интеграция, изолированное выполнение Python на backend,
выбор реального запуска и получение его логов.

## Выполнено: декларация Python-окружения (совместимое расширение 0.2)

- [x] Необязательные pythonVersion и requirements в TypeSpec и модели frontend.
- [x] Обновлён OpenAPI, без изменений Go-кода или сервисов backend.
- [x] Поля версии и зависимостей Python в inspector; хранение в localStorage/JSON.
- [x] Проверка точных версий пакетов, extras и дубликатов.
- [x] Сохранение окружения при редактировании кода, совместимость старых документов.
- [x] Документирована граница между frontend-декларацией и будущим runner.

Установка библиотек, resolver/lockfile, контейнеры и реальные логи установки
остаются вне frontend-этапа.
