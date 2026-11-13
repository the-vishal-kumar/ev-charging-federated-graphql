# Every target runs in containers; only Docker (with the compose plugin) is needed on the host.
NODE_IMAGE := node:22.23.5-bookworm-slim
TRIVY_IMAGE := aquasec/trivy:0.70.0
DOCKER_NODE := docker run --rm -u $$(id -u):$$(id -g) -e HOME=/tmp -v "$$PWD":/src -w /src $(NODE_IMAGE)
IMAGES := ev-charging-gateway:local ev-charging-socket:local
export UID := $(shell id -u)
export GID := $(shell id -g)

.PHONY: help install lint typecheck build test up seed logs down image scan

help: ## List targets
	@grep -E '^[a-z-]+:.*##' $(MAKEFILE_LIST) | awk -F':.*## ' '{printf "  %-10s %s\n", $$1, $$2}'

install: ## npm ci (all workspaces)
	$(DOCKER_NODE) npm ci --no-audit --no-fund --ignore-scripts

lint: install ## Prettier check and ESLint
	$(DOCKER_NODE) sh -c 'npm run pretty:check && npm run lint'

typecheck: install ## tsc --noEmit over both services and the tests
	$(DOCKER_NODE) npm run typecheck

build: install ## Compile both services (src/gateway/build, src/subgraphs/socket/build)
	$(DOCKER_NODE) npm run build

test: ## Unit and e2e tests with coverage against a throwaway MongoDB
	docker compose -f compose.test.yaml run --rm tests; status=$$?; \
	docker compose -f compose.test.yaml down -v --remove-orphans; exit $$status

up: ## Start gateway, socket subgraph and MongoDB; GraphQL on http://localhost:4000
	test -f .env || cp .env.sample .env
	docker compose up --build -d --wait

seed: ## Load the sample stations into the running stack (no API key needed)
	docker compose exec -T mongo mongoimport --quiet --db ev_charging --collection sockets --drop < test/fixtures/sockets.jsonl

logs: ## Follow the stack's logs
	docker compose logs -f

down: ## Stop the stack (data volume kept; `docker compose down -v` drops it)
	docker compose down --remove-orphans

image: ## Build both production images
	docker build --target gateway -t ev-charging-gateway:local .
	docker build --target socket -t ev-charging-socket:local .

scan: image ## Fail on fixable HIGH/CRITICAL CVEs in either image (Trivy)
	for image in $(IMAGES); do \
	  docker run --rm -v /var/run/docker.sock:/var/run/docker.sock $(TRIVY_IMAGE) \
	    image --severity HIGH,CRITICAL --ignore-unfixed --exit-code 1 --no-progress $$image || exit 1; \
	done
