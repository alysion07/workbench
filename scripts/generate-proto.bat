@echo off
REM Proto 파일 생성 스크립트 (Windows)

echo Generating gRPC-Web proto files...

REM Proto 파일 경로
set PROTO_DIR=proto
set PROTO_FILE=task_manager.proto

REM 출력 디렉토리
set OUT_DIR=proto

REM protoc 실행
protoc -I=%PROTO_DIR% %PROTO_DIR%/%PROTO_FILE% ^
  --js_out=import_style=commonjs,binary:%OUT_DIR% ^
  --grpc-web_out=import_style=typescript,mode=grpcwebtext:%OUT_DIR%

if %ERRORLEVEL% NEQ 0 (
  echo Error: Proto generation failed!
  echo.
  echo Make sure you have protoc and protoc-gen-grpc-web installed:
  echo   - Download protoc: https://github.com/protocolbuffers/protobuf/releases
  echo   - Install protoc-gen-grpc-web: npm install -g protoc-gen-grpc-web
  exit /b 1
)

echo Proto files generated successfully!
