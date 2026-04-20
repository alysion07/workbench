#!/usr/bin/env bash
# Proto 파일 생성 스크립트 (Linux/Mac)

echo "Generating gRPC-Web proto files..."

# Proto 파일 경로
PROTO_DIR="proto"
PROTO_FILE="task_manager.proto"

# 출력 디렉토리
OUT_DIR="proto"

# protoc 실행
protoc -I=${PROTO_DIR} ${PROTO_DIR}/${PROTO_FILE} \
  --js_out=import_style=commonjs,binary:${OUT_DIR} \
  --grpc-web_out=import_style=typescript,mode=grpcwebtext:${OUT_DIR}

if [ $? -ne 0 ]; then
  echo "Error: Proto generation failed!"
  echo ""
  echo "Make sure you have protoc and protoc-gen-grpc-web installed:"
  echo "  - Download protoc: https://github.com/protocolbuffers/protobuf/releases"
  echo "  - Install protoc-gen-grpc-web: npm install -g protoc-gen-grpc-web"
  exit 1
fi

echo "Proto files generated successfully!"
