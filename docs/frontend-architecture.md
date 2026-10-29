# Архитектура frontend для редактора pipeline

Статус: proposed  
Целевой контракт графа: schemaVersion 0.1  
Основание: [pipeline-backend-json-format.md](pipeline-backend-json-format.md)

## 1. Контекст и текущее состояние

p-graph — платформа для описания и выполнения DAG в Kubernetes. В репозитории
уже есть:

- каркас API Server и orchestrator на Go;
- TypeSpec как планируемый источник API-контракта;
- PostgreSQL-схема для каталогов, pipeline, черновиков, ревизий, запусков и
  каталога типов узлов;
- Kubernetes-манифесты для API Server, PostgreSQL, MinIO и Argo Workflows;
- JSON-контракт графа версии 0.1;
- четыре типа узлов MVP: file-input, read-file, console-print, end.

Frontend пока отсутствует. TypeSpec в текущем состоянии описывает только
GET /health, поэтому перед полноценной интеграцией в него необходимо добавить
модели и операции из JSON-контракта.

В репозитории есть две одинаковые копии JSON-контракта:

- docs/pipeline-backend-json-format.md — отслеживается Git;
- pipeline-backend-json-format.md в корне — локальный неотслеживаемый файл.

Каноническим документом следует оставить версию в docs, чтобы контракт не
расходился между копиями.

## 2. Цели и границы первого этапа

Первый этап должен позволить пользователю:

1. открыть существующий pipeline или создать новый;
2. добавить узлы из каталога типов;
3. перемещать, настраивать и соединять узлы;
4. сохранить даже незавершённый граф как черновик;
5. увидеть структурные и семантические ошибки на самом графе;
6. проверить готовность графа к запуску;
7. зафиксировать валидный черновик как неизменяемую ревизию;
8. закрыть страницу, открыть её снова и получить тот же граф и viewport.

Не входят в первый этап:

- визуализация выполнения, логов и артефактов;
- редактор самого каталога типов;
- совместное редактирование в реальном времени;
- автоматическая миграция старых schemaVersion, nodeCatalogVersion или
  typeVersion;
- выполнение графа непосредственно из незавершённого черновика.

## 3. Главные архитектурные решения

| Задача | Решение | Причина |
| --- | --- | --- |
| Сборка приложения | React + TypeScript + Vite | SPA без необходимости в SSR, быстрый локальный цикл и статический production build |
| UI-kit | Material UI | заданное требование, единая тема и готовые формы/диалоги |
| Canvas графа | @xyflow/react (React Flow) | controlled flow, custom nodes и несколько именованных handles |
| Server state | TanStack Query | кэширование, загрузка и мутации удалённых сущностей отдельно от состояния редактора |
| Editor state | Zustand | единое управляемое состояние графа, dirty-state и история команд |
| API-клиент | openapi-typescript + openapi-fetch | типы генерируются из OpenAPI, который генерируется из TypeSpec |
| Проверка configSchema | Ajv в режиме Draft 2020-12 | каталог типов уже использует JSON Schema Draft 2020-12 |
| Unit/component tests | Vitest + React Testing Library + MSW | проверка чистых преобразований, компонентов и HTTP-сценариев |
| E2E | Playwright | проверка полного сценария редактор → JSON → перезагрузка |
| Production runtime | статические файлы в Nginx-контейнере | Vite dev/preview server не используется в production |

Версии зависимостей фиксируются lock-файлом. Их конкретные major-версии нужно
выбрать при создании ui/package.json и обновлять осознанно, а не оставлять
плавающие диапазоны.

## 4. Контейнерная схема

~~~mermaid
flowchart LR
    Browser[Browser]
    Frontend[Frontend container<br/>Nginx + React SPA]
    API[Go API Server]
    DB[(PostgreSQL)]
    Orchestrator[Orchestrator]
    Catalog[Node type catalog]

    Browser -->|/| Frontend
    Frontend -->|/api/v1/*| API
    API --> DB
    API --> Orchestrator
    API --> Catalog
~~~

Frontend обращается только к относительному пути /api/v1. Nginx проксирует
его в API Server, а все остальные пути обслуживает как SPA с fallback на
index.html. Это даёт одинаковую модель локально и в Kubernetes и не требует
CORS между браузером и API.

## 5. Слои frontend

Предлагаемая структура:

~~~text
ui/
├── Dockerfile
├── nginx.conf.template
├── package.json
├── package-lock.json
├── vite.config.ts
├── tsconfig.json
├── index.html
└── src/
    ├── app/
    │   ├── App.tsx
    │   ├── router.tsx
    │   ├── providers.tsx
    │   └── theme.ts
    ├── pages/
    │   ├── catalog/
    │   ├── pipeline-editor/
    │   └── pipeline-revision/
    ├── features/
    │   └── graph-editor/
    │       ├── model/
    │       │   ├── editor-store.ts
    │       │   ├── commands.ts
    │       │   └── history.ts
    │       ├── domain/
    │       │   ├── types.ts
    │       │   ├── catalog.ts
    │       │   └── graph-rules.ts
    │       ├── serialization/
    │       │   ├── deserialize.ts
    │       │   ├── serialize.ts
    │       │   └── handles.ts
    │       ├── validation/
    │       │   ├── structural.ts
    │       │   ├── config-schema.ts
    │       │   └── issue-index.ts
    │       └── ui/
    │           ├── GraphCanvas.tsx
    │           ├── PipelineNode.tsx
    │           ├── NodePalette.tsx
    │           ├── NodeInspector.tsx
    │           ├── ValidationPanel.tsx
    │           └── EditorToolbar.tsx
    ├── entities/
    │   ├── folder/
    │   ├── pipeline/
    │   ├── revision/
    │   └── node-catalog/
    └── shared/
        ├── api/
        │   ├── generated.d.ts
        │   ├── client.ts
        │   └── queries.ts
        ├── config/
        ├── lib/
        └── ui/
~~~

Границы слоёв:

- shared/api/generated.d.ts генерируется из api/openapi.yaml и не правится
  вручную;
- entities содержит модели удалённых сущностей и их query keys;
- features/graph-editor/domain не импортирует React Flow;
- serialization — единственное место, где editor model преобразуется в
  backend JSON и обратно;
- React Flow используется только в canvas и адаптерах представления;
- страницы компонуют features и определяют маршруты, но не содержат правил
  графа.

## 6. Модель состояния

Нужно разнести три разных вида состояния.

### 6.1. Server state

TanStack Query хранит:

- дерево каталогов и список pipeline;
- metadata pipeline;
- черновик или выбранную ревизию;
- каталог типов конкретной версии;
- результаты сохранения, валидации и публикации.

Server state не копируется целиком в глобальный Zustand store.

### 6.2. Editor document

После загрузки definition преобразуется в независимую от UI-библиотеки модель:

~~~ts
interface GraphEditorDocument {
  schemaVersion: string;
  nodeCatalogVersion: string;
  inputs: Record<string, PipelineInput>;
  nodes: EditorNode[];
  edges: EditorEdge[];
  ui?: GraphUi;
}

interface EditorNode {
  id: string;
  type: string;
  typeVersion: number;
  title?: string;
  config: Record<string, unknown>;
  ui?: NodeUi;
}

interface EditorEdge {
  id: string;
  source: { nodeId: string; port: string };
  target: { nodeId: string; port: string };
}

interface NodeUi extends Record<string, unknown> {
  position?: { x: number; y: number };
}

interface GraphUi extends Record<string, unknown> {
  viewport?: Viewport;
}
~~~

Это единственный источник правды для редактируемого документа. React Flow
получает производные Node[] и Edge[]; его служебные поля selected, dragging,
width, measured, sourceHandle и targetHandle в backend JSON никогда не попадают.

### 6.3. Ephemeral UI state

Отдельно хранятся:

- выбранные узлы и связи;
- открытая панель и фильтр палитры;
- undo/redo history;
- dirty-state и состояние autosave;
- индекс ошибок для подсветки;
- временное соединение, drag state и контекстное меню.

Эти данные не сериализуются в definition. Отдельное доменное поле ui хранит
viewport, позиции и неизвестные frontend расширения, уже присутствовавшие в
документе. Оно не содержит runtime-состояние React Flow.

Перемещение и масштабирование камеры обновляет `ui.viewport` в памяти, но само
по себе не переводит документ в dirty-state: пользователь не менял структуру
или настройки графа. Актуальный viewport попадёт в definition при ближайшем
сохранении содержательных изменений.

## 7. Каталог типов как источник поведения редактора

Палитра, порты и форма конфигурации строятся из каталога, а не из списка,
зашитого во frontend.

При открытии графа frontend обязан запросить именно
definition.nodeCatalogVersion. Новый пустой граф использует версию каталога,
которую backend объявил текущей. Автоматически заменять версию открытого графа
на последнюю запрещено.

Правила статусов:

- active — можно добавлять новый экземпляр;
- deprecated — существующие узлы работают, в палитре скрыты по умолчанию или
  показаны с предупреждением;
- disabled — новый узел добавить нельзя, существующий сохраняется и
  отображается с блокирующей ошибкой запуска.

Если тип или его версия неизвестны, редактор показывает UnknownNode, сохраняет
исходные type, typeVersion, config, порты в связях и позволяет сохранить
черновик. Удалять неизвестные данные при загрузке или сохранении нельзя: это
прямое следствие разрешённого контрактом незавершённого черновика.

## 8. Порты и связи

Для React Flow каждому handle задаётся UI-only идентификатор:

~~~text
input:<port-name>
output:<port-name>
~~~

При сериализации направление отбрасывается, а имя порта записывается в
source.port или target.port.

Создание связи проверяется в два этапа:

1. мгновенная клиентская проверка для UX:
   - источник является output, цель является input;
   - dataType совпадает либо вход объявлен как универсальный `any`;
   - не превышен maxConnections;
   - связь не дублирует существующую;
   - добавление не создаёт очевидный цикл;
2. авторитетная серверная проверка всего документа.

Клиентская проверка не заменяет backend validation: состояние каталога и
правила конкретной версии должны контролироваться сервером.

## 9. Сериализация и десериализация

Преобразования реализуются чистыми функциями и тестируются отдельно от React.

~~~mermaid
flowchart LR
    DTO[Backend definition]
    Deserialize[deserializeDefinition]
    Store[GraphEditorDocument]
    View[React Flow projection]
    Serialize[serializeDefinition]
    Draft[Save draft request]

    DTO --> Deserialize --> Store --> View
    Store --> Serialize --> Draft
~~~

### 9.1. Десериализация

deserializeDefinition:

1. сохраняет версии документа без подмены;
2. копирует inputs, nodes, edges без потери неизвестных полей внутри config;
3. копирует node.ui и definition.ui целиком в доменные ui-поля;
4. использует ui.position и ui.viewport для проекции React Flow;
5. строит React Flow handles по каталогу типов;
6. не применяет defaults к уже существующему config неявно.

Если ui.position отсутствует, frontend может вычислить временную раскладку,
но координаты попадают в документ только после пользовательского изменения или
явного применения auto-layout.

### 9.2. Создание нового узла

Новый узел получает:

- стабильный id, созданный через crypto.randomUUID();
- выбранные type и typeVersion;
- title из каталога как начальное значение;
- новый объект config с defaults из поддерживаемого подмножества configSchema;
- ui.position в координатах canvas.

ID не меняется при перемещении, переименовании или настройке узла.

### 9.3. Сериализация

serializeDefinition создаёт новый объект и явно перечисляет разрешённые поля:

~~~ts
const definition = {
  schemaVersion: document.schemaVersion,
  nodeCatalogVersion: document.nodeCatalogVersion,
  inputs: document.inputs,
  nodes: document.nodes.map(node => ({
    id: node.id,
    type: node.type,
    typeVersion: node.typeVersion,
    ...(node.title === undefined ? {} : { title: node.title }),
    config: node.config,
    ...(node.ui === undefined ? {} : { ui: node.ui }),
  })),
  edges: document.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
  })),
  ...(document.ui === undefined ? {} : { ui: document.ui }),
};
~~~

Запрещено сериализовать React Flow node/edge через spread: так в контракт
утекут внутренние поля библиотеки.

Порядок элементов массива не должен определять семантику выполнения. Для
стабильных snapshot и payload можно сортировать nodes и edges по id, но
backend-контракт должен явно подтвердить, что массивы являются множествами по
уникальному идентификатору.

### 9.4. Инварианты round-trip

Обязательные тестовые свойства:

~~~text
serialize(deserialize(definition)) == canonicalize(definition)
deserialize(serialize(editorDocument)) сохраняет всю доменную информацию
~~~

Фикстура из JSON-контракта должна быть первым contract test.

## 10. Формы конфигурации

NodeInspector строит MUI-поля по ограниченному подмножеству JSON Schema:

- string → TextField, при enum → Select;
- number / integer → числовой TextField;
- boolean → Switch;
- title, description, default, required используются как metadata.

Ajv должен использовать отдельный экземпляр для Draft 2020-12. Валидация не
должна мутировать пользовательский объект: useDefaults, coercion и удаление
additional properties при обычной проверке отключены. Иначе допустимый
незавершённый черновик может быть незаметно переписан frontend.

## 11. Два уровня валидации

### 11.1. Сохранение черновика

Допускает семантически незавершённый граф. Проверяются только:

- корректная JSON-структура и типы полей;
- уникальность node.id;
- уникальность edge.id.

Нельзя блокировать сохранение из-за отсутствующего end, неподключённого порта,
неизвестного типа или незаполненного config.

### 11.2. Готовность к запуску и публикация ревизии

Backend проверяет все правила раздела 11 JSON-контракта и возвращает полный
массив issues. Frontend индексирует их по location:

- graph → общая панель;
- node → узел;
- port → конкретный handle;
- edge → связь;
- config → поле формы по JSON Pointer.

Нажатие на issue фокусирует соответствующий объект на canvas.

Публикация должна повторно выполнять серверную проверку внутри одной backend
операции. Успешный ответ означает, что создана новая неизменяемая ревизия;
отдельная клиентская проверка перед публикацией не является гарантией.

## 12. Минимальный API для frontend

Имена путей предварительные; окончательный контракт должен быть описан в
typespec/main.tsp.

| Метод | Путь | Назначение |
| --- | --- | --- |
| GET | /api/v1/folders | дерево или дочерние каталоги |
| POST | /api/v1/folders | создать каталог |
| GET | /api/v1/pipelines | список pipeline с фильтром по каталогу |
| POST | /api/v1/pipelines | создать pipeline без ревизии |
| GET | /api/v1/pipelines/{id} | metadata и currentRevision |
| GET | /api/v1/pipelines/{id}/draft | получить черновик |
| PUT | /api/v1/pipelines/{id}/draft | сохранить структурно корректный черновик |
| POST | /api/v1/pipelines/{id}/validate | проверить definition или текущий draft к запуску |
| POST | /api/v1/pipelines/{id}/revisions | атомарно проверить draft и создать ревизию |
| GET | /api/v1/pipelines/{id}/revisions | список ревизий |
| GET | /api/v1/pipelines/{id}/revisions/{revision} | неизменяемая ревизия |
| GET | /api/v1/node-catalogs/current | текущая версия каталога для нового графа |
| GET | /api/v1/node-catalogs/{version} | точная версия каталога для существующего графа |

TypeSpec должен описывать все модели JSON-контракта, включая опциональные поля
ValidationIssueLocation. После генерации одна OpenAPI-схема используется и Go
backend, и frontend.

### Конкурентное сохранение

baseRevision обнаруживает появление новой опубликованной ревизии, но не
защищает от двух одновременно открытых вкладок, сохраняющих один draft.
Backend должен добавить optimistic concurrency, например:

- ETag + If-Match; или
- монотонный draftVersion в запросе и ответе.

При конфликте frontend не перезаписывает сервер автоматически, а предлагает
перезагрузить версию сервера или скачать локальный JSON.

## 13. Экран редактора

Базовая компоновка desktop-first:

~~~text
┌──────────────────────────────────────────────────────────────┐
│ Breadcrumbs / pipeline name     Saved · Validate · Publish  │
├──────────────┬─────────────────────────────┬─────────────────┤
│ Node palette │                             │ Node inspector  │
│ search       │        Graph canvas         │ config form     │
│ categories   │                             │ validation      │
├──────────────┴─────────────────────────────┴─────────────────┤
│ Validation issues / save error / connection status          │
└──────────────────────────────────────────────────────────────┘
~~~

Поведение:

- сохранение по Ctrl/Cmd+S и debounced autosave после изменения;
- явные состояния Saving, Saved, Conflict, Offline/Error;
- undo/redo охватывает доменные команды, но не успешную публикацию;
- удаление узла удаляет связанные edges одной командой;
- readonly revision использует тот же canvas, но без мутаций;
- end визуально отличается, но остаётся обычным catalog-driven типом;
- проблемы доступности canvas компенсируются списком узлов/связей и
  управлением с клавиатуры там, где это поддерживается библиотекой.

## 14. Docker и Kubernetes

Frontend Dockerfile — multi-stage:

1. builder на закреплённом Node LTS образе;
2. npm ci, typecheck и npm run build;
3. runtime на unprivileged Nginx;
4. только ui/dist попадает в финальный image.

Nginx:

- слушает непривилегированный порт 8080;
- /healthz возвращает 200 без обращения к backend;
- /api/v1/ проксируется в API_UPSTREAM;
- неизвестные frontend routes возвращают /index.html;
- index.html отдаётся с no-cache;
- hashed assets получают долгий immutable cache;
- включаются базовые security headers и gzip.

Нужно добавить:

~~~text
ui/Dockerfile
ui/nginx.conf.template
deploy/k8s/frontend/deployment.yaml
deploy/k8s/frontend/service.yaml
deploy/k8s/frontend/configmap.yaml
~~~

Deployment и Service frontend добавляются в deploy/k8s/kustomization.yaml.
В production наружу публикуется frontend; API доступен браузеру через его
same-origin proxy.

## 15. Тестовая стратегия

### Unit

- serialize/deserialize и round-trip;
- построение handles;
- defaults нового узла;
- сопоставление backend issues элементам canvas;
- проверка maxConnections, dataType и цикла;
- reducer/commands и undo/redo.

### Component

- custom node с динамическими портами;
- schema-driven MUI form для всех типов полей MVP;
- неизвестный, deprecated и disabled тип;
- отображение ошибок node, port, edge, config.

### Integration

- загрузка pipeline, draft и правильной версии каталога;
- сохранение незавершённого draft;
- обработка validation result;
- optimistic concurrency conflict;
- публикация новой revision и переход в readonly view.

### E2E

Главный сценарий MVP:

1. создать pipeline;
2. добавить четыре узла;
3. настроить и соединить их;
4. сохранить draft;
5. перезагрузить страницу и сравнить граф;
6. получить ошибку валидации на намеренно испорченной связи;
7. исправить ошибку и опубликовать revision;
8. открыть revision в readonly режиме.

Отдельный smoke test запускает production Docker image, проверяет /healthz,
SPA fallback и proxy до API.

## 16. Этапы реализации

### Этап 0. Стабилизировать контракт

- оставить одну каноническую копию JSON-документа;
- перенести модели и минимальные endpoints в TypeSpec;
- решить optimistic concurrency для draft;
- зафиксировать семантику порядка nodes/edges;
- согласовать разделение save draft, validate, publish.

### Этап 1. Каркас frontend

- создать ui/ на React + TypeScript + Vite;
- подключить MUI theme, router, query client и generated API client;
- добавить Docker image и /healthz;
- добавить frontend Deployment/Service.

### Этап 2. Редактор без backend mutations

- загрузка catalog + definition;
- canvas, palette, custom node, inspector;
- добавление, перемещение, соединение и удаление;
- serializer/deserializer и contract fixtures.

### Этап 3. Жизненный цикл draft

- dirty state, autosave, ручное сохранение;
- backend validation и подсветка issues;
- обработка conflict;
- публикация revision и readonly view.

### Этап 4. Выполнение

- ввод runtime inputs;
- запуск revision;
- статусы, логи и артефакты;
- WebSocket/SSE интеграция.

## 17. Вопросы и расхождения до кодирования API

1. README говорит, что api/openapi.yaml коммитится, но .gitignore его
   исключает. Нужно выбрать одну политику; для воспроизводимого общего контракта
   предпочтительно коммитить generated OpenAPI и проверять diff в CI.
2. Pipeline.currentRevision есть в JSON-контракте, но отдельного поля нет в
   таблице pipelines. Backend должен либо вычислять его по ревизиям, либо
   хранить согласованно.
3. README формулирует валидацию DAG «при сохранении», а JSON-контракт разрешает
   сохранять невалидный к запуску draft. API должен различать структурное
   сохранение и readiness validation.
4. Для builtin.end текст требует хотя бы одну входящую связь, а его универсальный
   порт `any` объявлен с minConnections: 1, maxConnections: 1. Фактическое
   правило MVP получается «ровно одна»; это стоит сформулировать одинаково.
5. file-input.config.inputName должен ссылаться на ключ definition.inputs.
   Это межобъектное правило не выражается текущей configSchema и должно быть
   отдельной backend validation.
6. Не определён механизм конкурентного обновления одного draft.
7. Не определён стабильный перечень ValidationIssue.code; frontend может
   показывать message, но коды нужны для тестов и специальных UX.
8. Нужно формально определить поведение при недоступной версии каталога:
   ошибка API, readonly recovery mode или архивное хранение всех выпущенных
   catalog versions. Контракт предполагает последний вариант.

## 18. Ссылки на выбранные технологии

- [React Flow: controlled flow](https://reactflow.dev/learn/concepts/adding-interactivity)
- [React Flow: custom handles](https://reactflow.dev/learn/customization/handles)
- [Material UI](https://mui.com/material-ui/getting-started/)
- [TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview)
- [Ajv и JSON Schema Draft 2020-12](https://ajv.js.org/json-schema)
- [openapi-fetch](https://openapi-ts.dev/openapi-fetch/)
- [Vite production build](https://vite.dev/guide/build)

