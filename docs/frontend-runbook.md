# Запуск p-graph frontend

Инструкция относится к текущему mock-first frontend. Backend для работы
редактора не требуется: каталог узлов, pipeline и сохранение черновика
реализованы локально в браузере.

## Требования

- Node.js 22 или новее;
- npm;
- для контейнерного запуска — Docker или Colima.

Версия Node для проекта закреплена в ui/.nvmrc.

## Первый локальный запуск

Из корня репозитория:

~~~bash
cd ui
nvm use
npm ci
npm run dev
~~~

После строки Vite ready открыть:

- http://localhost:5173/

Команда npm run dev должна продолжать работать в терминале. Если закрыть
терминал или остановить процесс через Ctrl+C, адрес перестанет открываться.

## Последующие запуски

Зависимости повторно устанавливать не нужно, пока не изменился package-lock.json:

~~~bash
cd ui
nvm use
npm run dev
~~~

## Проверка версии Node

~~~bash
node --version
~~~

Ожидается версия 22 или новее. Если используется Node 16, выполнить:

~~~bash
cd ui
nvm use
~~~

Текущие версии Vite и TypeScript не поддерживают используемый в системе
Node.js 16.

## Локальные данные

Mock-черновик сохраняется в localStorage браузера для localhost:5173.

- кнопка «Сохранить» записывает текущее определение графа;
- кнопка «Сбросить» удаляет локальный черновик и возвращает исходный пример;
- очистка site data в браузере также удаляет сохранённый черновик;
- другой порт или hostname имеют отдельное localStorage.

## Проверки перед изменениями

~~~bash
cd ui
nvm use
npm ci
npm run typecheck
npm test
npm run build
~~~

Production bundle создаётся в ui/dist и не коммитится.

## Сборка и preview production bundle

Сначала собрать приложение:

~~~bash
cd ui
nvm use
npm ci
npm run build
~~~

Для проверки собранного production bundle:

~~~bash
cd ui
nvm use
npm run build
npx vite preview --host 0.0.0.0 --port 4173
~~~

Открыть http://localhost:4173/.

## Docker

Из корня репозитория:

~~~bash
docker build -t pgraph-ui:local ./ui
docker run --rm --name pgraph-ui -p 8080:8080 pgraph-ui:local
~~~

Открыть:

- приложение — http://localhost:8080/;
- health-check — http://localhost:8080/healthz.

Проверка health-check:

~~~bash
curl --fail http://localhost:8080/healthz
~~~

Остановить foreground-контейнер можно через Ctrl+C.

### Docker через Colima

Если Docker CLI сообщает, что daemon недоступен:

~~~bash
colima start
docker build -t pgraph-ui:local ./ui
docker run --rm --name pgraph-ui -p 8080:8080 pgraph-ui:local
~~~

После работы:

~~~bash
colima stop
~~~

## Частые проблемы

### localhost:5173 не открывается

Проверить, слушается ли порт:

~~~bash
lsof -nP -iTCP:5173 -sTCP:LISTEN
~~~

Если вывода нет, dev-сервер не запущен:

~~~bash
cd ui
nvm use
npm run dev
~~~

### Порт 5173 занят

Запустить на другом порту:

~~~bash
cd ui
nvm use
npm run dev -- --port 5174
~~~

Открыть http://localhost:5174/. Данные localStorage на новом порту будут
отдельными.

### Vite завершается с ошибкой Node.js

Проверить node --version и выполнить nvm use в каталоге ui. Файл .nvmrc
выбирает Node 22.15.0.

### Изменения не видны

1. Убедиться, что dev-сервер продолжает работать.
2. Перезагрузить страницу.
3. При необходимости выполнить hard reload в браузере.
4. Для сброса mock-данных нажать «Сбросить».

### Docker-контейнер не стартует

Проверить daemon и занятость порта:

~~~bash
docker info
lsof -nP -iTCP:8080 -sTCP:LISTEN
~~~

При занятом 8080 можно использовать другой внешний порт:

~~~bash
docker run --rm --name pgraph-ui -p 18080:8080 pgraph-ui:local
~~~

Тогда приложение откроется на http://localhost:18080/.

## Backend

Текущий mock-frontend не обращается к API Server. Для разработки редактора
достаточно запустить только ui.

Инструкция по существующей backend-инфраструктуре и minikube находится в
корневом README.md. После появления HTTP API локальный и Docker-запуск frontend
сохранятся, а LocalPipelineRepository будет заменён на HTTP-адаптер.

