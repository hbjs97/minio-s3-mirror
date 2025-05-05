# minio-s3-mirror

## environment

| 환경변수         | 설명                             | 예시                                           | 필수 |
| ---------------- | -------------------------------- | ---------------------------------------------- | ---- |
| SERVICE          | 서비스 명                        | myservice                                      | X    |
| MINIO_URL        | source minio url                 | http://minio.minio.svc.cluster.local:9000      | O    |
| MINIO_ACCESS_KEY | source minio access_key          | < ACCESS >                                     | O    |
| MINIO_SECRET_KEY | source minio secret_key          | < SECRET >                                     | O    |
| AWS_URL          | source aws s3 url                | https://s3.ap-northeast-2.amazonaws.com        | O    |
| AWS_ACCESS_KEY   | source aws s3 access_key         | < ACCESS >                                     | O    |
| AWS_SECRET_KEY   | source aws s3 secret_key         | < SECRET >                                     | O    |
| BUCKET_PAIR      | 미러링 버킷 목록 소스/대상은 ':' | minio/source_bucket_1:aws/destination_bucket_1 | O    |
| SLACK_BOT_TOKEN  | 슬랙 bot token                   | < BOT_TOKEN >                                  | X    |
| SLACK_CHANNEL_ID | 슬랙 채널 ID                     | < CHANNEL_ID >                                 | X    |

### 주의사항

> 슬랙 설정은 선택사항이며, 설정하지 않으면 알림을 받지 않습니다.
> SLACK_CHANNEL_ID, SLACK_BOT_TOKEN
> 두 환경변수를 모두 설정해야 Slack 알림을 받을 수 있습니다.

> 워크스페이스에서 app 을 만들고, Slack Bot Token 을 발급받아야 합니다.
> `OAuth & Permissions` 메뉴의 scope 에서 `chat:write` 권한을 추가해야 합니다.

### 메시지가 오지 않는경우

Slack 채널에서 ChatBot 을 초대해야 합니다.

> /invite @YourBotName
