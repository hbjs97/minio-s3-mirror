# Build stage
FROM node:20.12.1 as builder
ENV TZ="Asia/Seoul"

WORKDIR /app

COPY . .

RUN npm install

RUN npm run build

# ---

# Final stage
FROM node:20.12.1-slim
ENV TZ="Asia/Seoul"

# 작업 디렉토리 설정
WORKDIR /app

# 필요한 패키지 설치 (예: wget)
RUN apt-get update && apt-get install -y wget && rm -rf /var/lib/apt/lists/*

# 아키텍처에 맞는 mc 클라이언트 설치
ARG TARGETARCH
RUN if [ "${TARGETARCH}" = "amd64" ]; then \
        wget https://dl.min.io/client/mc/release/linux-amd64/mc -O /usr/local/bin/mc; \
    elif [ "${TARGETARCH}" = "arm64" ]; then \
        wget https://dl.min.io/client/mc/release/linux-arm64/mc -O /usr/local/bin/mc; \
    else \
        echo "unsupported architecture: ${TARGETARCH}"; exit 1; \
    fi && \
    chmod +x /usr/local/bin/mc

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

# 애플리케이션 실행
ENTRYPOINT ["node", "dist/index.js"]

CMD ["node", "dist/index.js"]
