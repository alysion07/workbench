# Simple helpers for building and running the web UI container
# Default URLs are defined in config/defaults.js and .env
TAG ?= etri-vsmr/vsmr-sim-web:latest
PORT ?= 3000
VITE_GRPC_URL ?=
VITE_MINIO_ENDPOINT ?=
.PHONY: build run

build:
 	./3-build-vsmr-sim-web-container-image.sh

run:
	TAG=$(TAG) \
	PORT=$(PORT) \
	VITE_GRPC_URL=$(VITE_GRPC_URL) \
	VITE_MINIO_ENDPOINT=$(VITE_MINIO_ENDPOINT) \
	./scripts/docker-run.sh
