#!/bin/bash
if command -v k6 &> /dev/null; then
  k6 run "$@"
else
  docker run --rm -i --net=host -v "$(pwd):/app" -w /app grafana/k6 run "$@"
fi

