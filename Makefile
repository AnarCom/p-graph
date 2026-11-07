.PHONY: spec-gen api-gen api test

spec-gen:
	npm --prefix typespec install
	npx --prefix ./typespec --no-install tsp compile ./typespec

api-gen:
	go tool oapi-codegen --config api/oapi-codegen.yaml --include-tags apiserver -o internal/api/gen/apiserver/apiserver.gen.go api/openapi.yaml
	go tool oapi-codegen --config api/oapi-codegen.yaml --include-tags scheduler -o internal/api/gen/scheduler/scheduler.gen.go api/openapi.yaml

api: spec-gen api-gen

test:
	mkdir -p coverage
	go test -v -coverpkg=./... -coverprofile=coverage/cover.out -count=1 ./...
	grep -v '\.gen\.go:' coverage/cover.out > coverage/cover.filtered.out
	go tool cover -func coverage/cover.filtered.out | tail -1
