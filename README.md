# minio-s3-mirror

## environment

### 기본 설정

| 환경변수         | 설명                             | 예시                                           | 필수 |
| ---------------- | -------------------------------- | ---------------------------------------------- | ---- |
| SERVICE          | 서비스 명                        | myservice                                      | X    |
| MINIO_URL        | source minio url                 | http://minio.minio.svc.cluster.local:9000      | O    |
| MINIO_ACCESS_KEY | source minio access_key          | < ACCESS >                                     | O    |
| MINIO_SECRET_KEY | source minio secret_key          | < SECRET >                                     | O    |
| AWS_URL          | source aws s3 url                | https://s3.ap-northeast-2.amazonaws.com        | O    |
| AWS_ACCESS_KEY   | source aws s3 access_key         | < ACCESS >                                     | O    |
| AWS_SECRET_KEY   | source aws s3 secret_key         | < SECRET >                                     | O    |
| BUCKET_PAIR      | 미러링 버킷 목록 소스/대상은 ':' | minio/source_bucket_1:aws/destination_bucket_1 | O*   |
| BUCKET_PAIRS     | 다중 버킷 페어 (';'로 구분)       | minio/src1:aws/dst1;minio/src2:aws/dst2       | O*   |
| SLACK_BOT_TOKEN  | 슬랙 bot token                   | < BOT_TOKEN >                                  | X    |
| SLACK_CHANNEL_ID | 슬랙 채널 ID                     | < CHANNEL_ID >                                 | X    |

### 미러링 옵션 (증분 동기화)

| 환경변수            | 설명                                | 예시                    | 기본값 |
| ------------------- | ----------------------------------- | ----------------------- | ------ |
| MIRROR_EXCLUDE      | 제외할 파일 패턴 (콤마 구분)        | *.tmp,*.log,.DS_Store  | -      |
| MIRROR_MAX_WORKERS  | 동시 전송 워커 수                   | 10                     | auto   |
| MIRROR_DRY_RUN      | 실제 전송 없이 시뮬레이션           | true/false             | false  |
| MIRROR_SKIP_ERRORS  | 오류 발생 시 계속 진행              | true/false             | true   |
| MIRROR_DEBUG        | 디버그 모드 (상세 로그 출력)        | true/false             | false  |

### 비용 최적화 옵션

| 환경변수      | 설명                               | 예시                    | 기본값 |
| ------------- | ---------------------------------- | ----------------------- | ------ |
| MIRROR_PREFIX | 특정 프리픽스만 동기화 (비용 절감) | 2025/01/22, data/batch1 | -      |

### 주의사항

> **버킷 설정**: `BUCKET_PAIR` 또는 `BUCKET_PAIRS` 중 하나는 반드시 설정해야 합니다.
> - `BUCKET_PAIR`: 단일 버킷 페어 (기존 방식)
> - `BUCKET_PAIRS`: 다중 버킷 페어를 세미콜론(;)으로 구분하여 설정
> - 다중 버킷 페어는 최대 3개씩 동시에 실행됩니다.

> **슬랙 설정**: 선택사항이며, 설정하지 않으면 알림을 받지 않습니다.
> SLACK_CHANNEL_ID, SLACK_BOT_TOKEN
> 두 환경변수를 모두 설정해야 Slack 알림을 받을 수 있습니다.

> 워크스페이스에서 app 을 만들고, Slack Bot Token 을 발급받아야 합니다.
> `OAuth & Permissions` 메뉴의 scope 에서 `chat:write` 권한을 추가해야 합니다.

### 메시지가 오지 않는경우

Slack 채널에서 ChatBot 을 초대해야 합니다.

> /invite @YourBotName

## 증분 동기화 기능

이 서비스는 MinIO의 `mc mirror` 명령어를 사용하여 효율적인 증분 동기화를 수행합니다. 
Cronjob으로 주기적 실행에 최적화되어 있으며, 불필요한 재전송을 방지합니다.

### 주요 특징

1. **증분 동기화**: 기본적으로 변경된 파일만 동기화 (overwrite 없음)
2. **효율적인 동기화**: 변경된 파일만 자동 감지하여 동기화
3. **안전한 동작**: 소스에 없는 파일 삭제 없음, 오류 시 계속 진행
4. **효율적인 전송**: 병렬 처리 지원, 자동 워커 수 조정

### Cronjob 설정 예시

```bash
# 첫 실행 - 전체 파일 증분 동기화
docker run --rm \
  -e MINIO_URL=http://minio:9000 \
  -e MINIO_ACCESS_KEY=minioadmin \
  -e MINIO_SECRET_KEY=minioadmin \
  -e AWS_URL=https://s3.ap-northeast-2.amazonaws.com \
  -e AWS_ACCESS_KEY=AKIAXXXXXXXX \
  -e AWS_SECRET_KEY=XXXXXXXX \
  -e BUCKET_PAIR="minio/source:aws/destination" \
  minio-s3-mirror:latest

# 매일 새벽 2시에 실행
0 2 * * * docker run --rm \
  -e BUCKET_PAIR="minio/source:aws/destination" \
  # ... 기타 환경변수 \
  minio-s3-mirror:latest

# 특정 날짜 프리픽스만 동기화 (비용 절감)
0 2 * * * docker run --rm \
  -e MIRROR_PREFIX="$(date +%Y/%m/%d)" \
  -e BUCKET_PAIR="minio/source:aws/destination" \
  # ... 기타 환경변수 \
  minio-s3-mirror:latest

# 테스트 실행 (실제 전송 없이 확인)
docker run --rm \
  -e MIRROR_DRY_RUN=true \
  -e BUCKET_PAIR="minio/source:aws/destination" \
  # ... 기타 환경변수 \
  minio-s3-mirror:latest
```

### 동기화 전략

1. **초기 전체 동기화**: 프리픽스 없이 실행하여 모든 파일 동기화
2. **정기 증분 동기화**: 날짜 기반 프리픽스 사용으로 비용 효율적 동기화
3. **효율성 vs 완전성**: 
   - 효율성 중시: `MIRROR_PREFIX` 설정으로 특정 경로만 동기화 (99% 비용 절감)
   - 완전성 중시: 프리픽스 미설정으로 전체 파일 검사 (높은 비용)

## 문제 해결 (Troubleshooting)

### 일반적인 오류 및 해결 방법

#### 1. Mirror process closed with code: 1
**원인**: mc 명령어 실행 실패
**해결 방법**:
- 환경변수 확인 (특히 MINIO_URL, AWS_URL, ACCESS_KEY, SECRET_KEY)
- 버킷 이름 형식 확인 (예: `minio/bucket-name:aws/bucket-name`)
- 네트워크 연결 확인
- 자격 증명 권한 확인

#### 2. Unable to stat source
**원인**: 소스 버킷을 찾을 수 없음
**해결 방법**:
- 버킷 이름이 정확한지 확인
- 버킷이 실제로 존재하는지 확인  
- 액세스 권한이 있는지 확인
- MinIO UI나 mc ls 명령으로 버킷 목록 확인

#### 3. Failed to set alias
**원인**: MinIO/S3 연결 실패
**해결 방법**:
- URL 형식 확인 (http:// 또는 https:// 포함)
- 방화벽/보안 그룹 설정 확인
- Access Key/Secret Key 유효성 확인

#### 4. Failed to access alias
**원인**: 별칭은 설정되었으나 접근 불가
**해결 방법**:
- 버킷 권한 확인
- IAM 정책 확인 (ListBucket, GetObject 권한 필요)
- 버킷이 실제로 존재하는지 확인

#### 5. Object does not exist
**원인**: 소스 객체를 찾을 수 없음
**해결 방법**:
- 소스 버킷 경로 확인
- 객체가 삭제되었거나 이동되었는지 확인

### 디버깅 방법

1. **상세 로그 확인**
   ```bash
   docker logs -f <container-id>
   ```

2. **디버그 모드 실행**
   ```bash
   docker run --rm \
     -e MIRROR_DEBUG=true \
     -e BUCKET_PAIR="minio/source:aws/destination" \
     # ... 기타 환경변수 \
     minio-s3-mirror:latest
   ```

3. **테스트 실행 (DRY RUN)**
   ```bash
   docker run --rm \
     -e MIRROR_DRY_RUN=true \
     -e MIRROR_DEBUG=true \
     -e BUCKET_PAIR="minio/source:aws/destination" \
     # ... 기타 환경변수 \
     minio-s3-mirror:latest
   ```

4. **단일 파일 테스트**
   ```bash
   # 작은 테스트 버킷으로 먼저 테스트
   docker run --rm \
     -e BUCKET_PAIR="minio/test-bucket:aws/test-bucket" \
     -e MIRROR_DEBUG=true \
     # ... 기타 환경변수 \
     minio-s3-mirror:latest
   ```

5. **mc 명령어 직접 테스트**
   ```bash
   # 컨테이너 내부에서
   docker exec -it <container-id> sh
   mc alias set minio http://minio:9000 ACCESS SECRET
   mc alias set aws https://s3.amazonaws.com ACCESS SECRET
   mc ls minio/bucket-name
   mc ls aws/bucket-name
   
   # 미러링 테스트 (JSON 출력 확인)
   mc mirror --json --dry-run minio/bucket aws/bucket
   ```

### 성능 최적화

1. **병렬 처리 조정**
   - `MIRROR_MAX_WORKERS`: CPU 코어 수에 맞춰 조정 (기본: auto)
   - 네트워크 대역폭에 따라 조정

2. **프리픽스 최적화**
   - 자주 실행: 날짜별 프리픽스 사용 (예: 2025/01/22)
   - 배치별 실행: 작업별 프리픽스 사용 (예: batch/batch-001)

3. **제외 패턴 활용**
   - 불필요한 파일 제외로 성능 향상
   - 예: `MIRROR_EXCLUDE="*.tmp,*.log,.DS_Store"`

## AWS S3 비용 고려사항 💰

### ⚠️ 중요: S3 API 비용 발생

`mc mirror` 명령어는 **Source(MinIO)와 Target(S3) 모두를 스캔**하여 동기화를 수행합니다:

- **Source MinIO (on-premise)**: 무료 - 비용 발생 안함
- **Target S3**: LIST/HEAD 요청으로 모든 객체를 스캔하여 **과금 발생**

S3 API는 시간이나 변경 상태 기반 필터를 네이티브하게 지원하지 않기 때문에, 대용량 S3 버킷에서는 API 호출 비용이 발생합니다.

### 💡 비용 절감 전략

#### 1. 프리픽스 기반 미러링 (권장) ✅
날짜나 카테고리 기반 프리픽스를 사용하여 스캔 범위를 제한:

```bash
# 오늘 날짜의 데이터만 동기화
docker run --rm \
  -e MIRROR_PREFIX="2025/01/22" \
  -e BUCKET_PAIR="minio/data:aws/data" \
  # ... 기타 환경변수 \
  minio-s3-mirror:latest

# 특정 배치만 동기화
docker run --rm \
  -e MIRROR_PREFIX="batch/batch-20250122" \
  -e BUCKET_PAIR="minio/processing:aws/archive" \
  # ... 기타 환경변수 \
  minio-s3-mirror:latest
```

#### 2. S3 Inventory 활용 (대용량 버킷)
- S3 Inventory를 설정하여 일일 객체 목록 생성
- CSV/ORC 파일을 파싱하여 변경된 파일만 식별
- LIST/HEAD API 호출을 크게 줄일 수 있음

#### 3. 이벤트 기반 동기화 아키텍처
- S3 Event Notifications + SQS/SNS
- 파일 업로드 시 실시간 동기화
- LIST 작업을 완전히 제거 가능

### 권장 사용 패턴

1. **날짜 기반 디렉토리 구조 채택**
   ```
   /2025/01/22/file1.dat
   /2025/01/22/file2.dat
   ```

2. **Cronjob 설정 시 프리픽스 활용**
   ```bash
   # 매일 새벽 2시에 어제 데이터만 동기화
   0 2 * * * docker run --rm \
     -e MIRROR_PREFIX="$(date -d 'yesterday' +%Y/%m/%d)" \
     -e BUCKET_PAIR="minio/data:aws/archive" \
     # ... 기타 환경변수 \
     minio-s3-mirror:latest
   ```

3. **초기 전체 동기화 후 프리픽스 사용**
   - 첫 실행: 프리픽스 없이 전체 동기화
   - 이후: 날짜별 프리픽스로 증분 동기화

### 📢 권장 사항

**대용량 S3 버킷을 사용하는 경우:**

1. **MIRROR_PREFIX 사용 권장**: S3 스캔 범위 제한
2. **날짜 기반 디렉토리 구조 채택**: `/2025/01/22/` 형태
3. **정확한 비용은 AWS 청구서 확인**: `mc mirror`로는 정확한 API 호출 수 측정 불가
4. **AWS CloudTrail로 실제 비용 모니터링**: LIST, HEAD, PUT 요청 수 추적
