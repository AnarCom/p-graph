# p-graph

> Платформа для описания и выполнения вычислительных pipeline в виде ориентированного графа (DAG) с запуском операций на Kubernetes.

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Go](https://img.shields.io/badge/Go-1.25-00ADD8?logo=go&logoColor=white)](https://go.dev)
[![React](https://img.shields.io/badge/React-TypeScript-61DAFB?logo=react&logoColor=white)](https://react.dev)
[![Kubernetes](https://img.shields.io/badge/Kubernetes-minikube-326CE5?logo=kubernetes&logoColor=white)](https://minikube.sigs.k8s.io)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org)
[![MinIO](https://img.shields.io/badge/MinIO-S3%20артефакты-C72E49?logo=minio&logoColor=white)](https://min.io)

## Общая карта компонентов

```mermaid
flowchart LR
    Client["Client"]
    
    subgraph K8s["Kubernetes"]
        UI["Frontend"]
    
        API["API Server<br/>• CRUD pipelines<br/>• валидация DAG (при сохранении)<br/>"]
        
        Sched["Scheduler<br/>• Распределение подов на ноды<br/>• Формирование workflows"]
        
        Oper["Argo Workflows<br/>• топологическая сортировка<br/>• параллельный запуск операций<br/>• создание K8s Job, watch<br/>• сбор логов Pod'ов"]

        subgraph Jobs["Jobs"]
            JOB1["Job → Pod<br/>операция A"]
            JOB2["Job → Pod<br/>операция B"]
            JOBN["Job → Pod<br/>операция N"]
        end
        
        subgraph Data["Хранилища"]
            PG[("PostgreSQL<br/>графы, runs, статусы,<br/>метаданные логов")]
            S3[("S3 / MinIO<br/>артефакты данных<br/>+ логи операций")]
        end
    end
    
    Client --> UI
    UI -- "REST<br/>(CRUD)" --> API
    UI <-. "WebSocket<br/>(статусы)" .-> API
    API -- "REST<br/>(start / cancel / restart)" --> Sched
    API -- "получение путей файлов" --> PG
    API <-. "мониторинг статусов job" .-> PG
    API -- "получение логов и артефактов" --> S3
    Sched -- "готовый workflow" --> Oper
    Oper -- запись путей файлов --> PG
    Oper -- "создание" --> Jobs
    Oper -- "сбор логов" --> Jobs
    Oper -- "сохранение логов и артефактов" --> S3
```

## Структура репозитория

Монорепозиторий: Go-модуль в корне, инфраструктура — `deploy/`. Пустые каталоги каркаса содержат `.gitkeep` (git не трекает пустые директории) — файлы удаляются по мере появления кода.

```
p-graph/
├── cmd/                        # точки входа (по сервису на каталог)
│   ├── apiserver/              #   API Server: REST + WebSocket/SSE
│   └── orchestrator/           #   Orchestrator: планировщик, K8s watch
├── internal/
│   ├── model/                  # доменные типы: Pipeline, Run, Operation, статусы
│   ├── api/                    # HTTP-хендлеры API Server
│   │   └── gen/                #   код, сгенерированный oapi-codegen (не править руками)
│   ├── orchestrator/           # ядро исполнения: планирование run'ов
│   ├── storage/                # PostgreSQL: доступ к данным
│   ├── migrator/               # применение миграций БД
│   ├── artifacts/              # S3/MinIO клиент: artifacts/{run_id}/{node_id}, логи
│   └── k8s/                    # создание Job, watch, сбор логов Pod'ов
├── typespec/                   # TypeSpec-описание API (источник контракта)
├── api/                        # сгенерированный OpenAPI + конфиг oapi-codegen
├── migrations/                 # SQL-миграции, схема БД меняется только через них
├── deploy/
│   ├── docker/                 # Dockerfiles сервисов
│   └── k8s/                    # манифесты кластера: каталог = приложение
│       ├── postgres/           #   БД (deployment, service, pvc)
│       ├── minio/              #   S3-хранилище (deployment, service, ingress)
│       ├── apiserver/          #   API Server (deployment, service, ingress)
│       ├── orchestrator/       #   Orchestrator (deployment, service, rbac)
│       └── argo/               #   Argo (ingress, configmap)
├── go.mod                      # module github.com/AnarCom/p-graph
├── CLAUDE.md                   # соглашения проекта
├── LICENSE                     # Apache License 2.0
└── README.md
```

## Локальный запуск (minikube)

Требуется: [minikube](https://minikube.sigs.k8s.io/docs/start/), `kubectl`, драйвер docker.

```bash
# 1. Поднять кластер с ingress-контроллером (один раз)
minikube start --driver=docker
minikube addons enable ingress

# 2. Собрать образ apiserver и загрузить его в minikube
docker build -f deploy/docker/apiserver/Dockerfile -t pgraph-apiserver:v1 .
minikube image load pgraph-apiserver:v1

# 3. Применить все манифесты (namespace pgraph)
kubectl apply -k deploy/k8s

# 4. Проверить, что всё поднялось
kubectl get pods -n pgraph

# 5. Подключиться к PostgreSQL (порт кластера напрямую недоступен на macOS)
kubectl port-forward svc/postgres 5432:5432 -n pgraph
psql -h 127.0.0.1 -U pgraph -d pgraph

# 6. Для доступа к консоли minio
echo "127.0.0.1 minio.local" | sudo tee -a /etc/hosts > /dev/null # добавляем локальную DNS запись
sudo minikube tunnel
curl http://minio.local

# 7. Для доступа к argo
echo "127.0.0.1 minio.local" | sudo tee -a /etc/hosts > /dev/null
curl http://argo.local

# 8. Чтобы запустить workflow
создать argo-bucket
в argo интерфейсе запустить workflow
```

## Генерация API-контракта (TypeSpec → OpenAPI → Go)

Контракт между frontend и backend описывается в **TypeSpec** (`typespec/main.tsp`) и меняется только там — это единственный источник правды для API. Цепочка генерации:

```
typespec/main.tsp  ──(tsp compile)──▶  api/openapi.yaml  ──(oapi-codegen)──▶  internal/api/gen/api.gen.go
```

- `api/openapi.yaml` — OpenAPI 3.0, генерируется из TypeSpec; коммитится в репозиторий (по нему работает и фронтенд);
- `internal/api/gen/api.gen.go` — Go-типы и серверные интерфейсы (`strict-server`, стандартный `net/http`); **не редактируется руками** — только перегенерацией.

### Как добавить новый эндпоинт

1. Убедиться, что зависимости установлены (см. выше; достаточно один раз).
2. Описать модель и операцию в `typespec/main.tsp` (см. тестовый метод `GET /health`).
3. `make api` — перегенерировать OpenAPI и Go-код.
4. Реализовать сгенерированный интерфейс `StrictServerInterface` в хендлере `internal/api/`.

Коммитить вместе три файла: `typespec/main.tsp`, `api/openapi.yaml`, `internal/api/gen/api.gen.go`.

## Жизненный цикл запуска pipeline

```mermaid
sequenceDiagram
    participant UI as Frontend
    participant API as API Server
    participant DB as PostgreSQL
    participant Sched as Scheduler
    participant ARGO as Argo Workflows
    participant K8s as Kubernetes (Jobs)
    participant S3 as MinIO

    UI->>API: POST /pipelines (граф)
    API->>API: валидация DAG (циклы — при сохранении)
    API->>DB: сохранить pipeline

    UI->>API: POST /runs (запуск)
    API->>DB: создать run (Pending)
    API->>Sched: REST: start run

    Sched->>DB: загрузить граф
    Sched->>Sched: сформировать Argo Workflow (DAG-шаблон)
    Sched->>DB: операции → Scheduled
    Sched->>ARGO: отправить готовый workflow

    ARGO->>ARGO: топологическая сортировка
    ARGO->>K8s: создать Job'ы (готовые операции, параллельно)
    ARGO->>DB: операции → Running

    loop пока есть незавершённые операции
        K8s-->>ARGO: статус Job (watch)
        alt успех
            ARGO->>DB: операция → Succeeded
            ARGO->>K8s: забрать полный лог пода
            ARGO->>S3: записать logs/attempt-{N}.log
            ARGO->>DB: manifest артефактов + ссылка на лог
            ARGO->>K8s: создать Job'ы следующих операций
        else ошибка (exit code ≠ 0)
            ARGO->>K8s: забрать полный лог пода
            ARGO->>S3: записать logs/attempt-{N}.log
            ARGO->>DB: операция → Failed (exit code, ссылка на лог)
            ARGO->>DB: незапущенные операции → Cancelled
            ARGO->>DB: run → Failed
            API-->>UI: уведомление: операция упала, граф остановлен
        end
    end

    ARGO->>DB: run → Succeeded | Failed

    loop статусы → UI
        DB-->>API: обновления (LISTEN/NOTIFY / polling)
        API-->>UI: WebSocket/SSE
    end

    UI->>API: GET логи (после завершения операции)
    API->>S3: GET logs/attempt-{N}.log
    S3-->>API: лог
    API-->>UI: логи
```

## Машина состояний операции

```mermaid
stateDiagram-v2
    [*] --> Pending: run создан
    Pending --> Scheduled: Scheduler сформировал workflow
    Scheduled --> Running: Argo создал K8s Job
    Running --> Succeeded: exit code = 0
    Running --> Failed: exit code ≠ 0
    Running --> Cancelled: отмена run
    Failed --> Scheduled: ручной re-run (новая попытка)
    Succeeded --> [*]
    Failed --> [*]
    Cancelled --> [*]
```

Единая модель статусов для БД, Kubernetes и UI.

Семантика ошибок:

- **Автоматических retry нет.** Ошибка пользовательского кода (exit code ≠ 0) → операция сразу `Failed`, исполнение графа останавливается.
- При этом незапущенные операции графа переводятся в `Cancelled`, run — в `Failed`; пользователь получает статус (WebSocket/SSE) и логи упавшей операции — этого достаточно, чтобы понять причину.
- **Единственный способ повторить — ручной re-run** узла (после исправления): операция возвращается в `Scheduled`, начинается новая попытка.
- Инфраструктурные сбои платформы (рестарт API/Scheduler) статусов не меняют — состояние восстанавливается из БД (reconcile). Состояние самих workflow живёт в Argo (etcd) и также восстанавливается reconcile-циклом Argo.
- K8s Job создаётся с `backoffLimit: 0` и `restartPolicy: Never` — один под на попытку, чтобы Kubernetes не делал скрытых ретраитов за нашей спиной.

## License

Проект распространяется под лицензией [Apache License 2.0](LICENSE).
