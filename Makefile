.PHONY: spec-gen api-gen api

spec-gen:
	npm --prefix typespec install
	npx --prefix ./typespec --no-install tsp compile ./typespec

api-gen:
	go tool oapi-codegen --config api/oapi-codegen.yaml api/openapi.yaml

api: spec-gen api-gen
