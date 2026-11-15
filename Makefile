.PHONY: spec-gen api-gen api docker-build minikube-start minikube-images-load helm-install test

spec-gen:
	npm --prefix typespec install
	npx --prefix ./typespec --no-install tsp compile ./typespec

api-gen:
	go tool oapi-codegen --config api/oapi-codegen.yaml --include-tags apiserver -o internal/api/gen/apiserver/apiserver.gen.go api/openapi.yaml
	go tool oapi-codegen --config api/oapi-codegen.yaml --include-tags scheduler -o internal/api/gen/scheduler/scheduler.gen.go api/openapi.yaml

api: spec-gen api-gen

docker-build:
	docker build -f deploy/docker/go/Dockerfile --build-arg SERVICE=apiserver -t pgraph-apiserver .
	docker build -f deploy/docker/go/Dockerfile --build-arg SERVICE=scheduler -t pgraph-scheduler .

minikube-start:
	minikube start --driver=docker
	minikube addons enable ingress

minikube-images-load: docker-build
	minikube image load pgraph-apiserver
	minikube image load pgraph-scheduler

helm-install: minikube-start minikube-images-load
	sleep 10
	helm upgrade --install pgraph deploy/helm/pgraph -n pgraph --create-namespace

test:
	mkdir -p coverage
	go test -v -coverpkg=./... -coverprofile=coverage/cover.out -count=1 ./...
	grep -v '\.gen\.go:' coverage/cover.out > coverage/cover.filtered.out
	go tool cover -func coverage/cover.filtered.out | tail -1
