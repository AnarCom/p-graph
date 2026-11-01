.PHONY: spec-gen api-gen api test

spec-gen:
	npm --prefix typespec install
	npx --prefix ./typespec --no-install tsp compile ./typespec

api-gen:
	go tool oapi-codegen --config api/oapi-codegen.yaml api/openapi.yaml

api: spec-gen api-gen

test:
	mkdir -p coverage
	go test -v -coverpkg=./... -coverprofile=coverage/cover.out -count=1 ./...
	grep -v '\.gen\.go:' coverage/cover.out > coverage/cover.filtered.out
	go tool cover -func coverage/cover.filtered.out | tail -1
