{{- define "pgraph.waitForPostgres" -}}
- name: wait-postgres
  image: postgres:16-alpine
  env:
    - name: PGHOST
      value: postgres
    - name: PGPORT
      value: "5432"
    - name: PGUSER
      valueFrom:
        configMapKeyRef:
          name: postgres-config
          key: POSTGRES_USER
  command: ["sh", "-c", "until pg_isready; do sleep 2; done"]
{{- end }}
