# News Archive

URL을 붙여넣으면 본문을 자동으로 크롤링해 저장하는 개인 뉴스 아카이브입니다.

## 주요 기능

- **URL 크롤링** — URL 입력 시 제목·본문·작성자·날짜 자동 추출 (trafilatura + BeautifulSoup 이중 파싱)
- **폴더 관리** — 계층형 폴더로 아티클 분류, 폴더 간 이동
- **태그** — 아티클에 태그 부착, 태그별 필터링 (사용 중인 태그만 표시)
- **즐겨찾기** — 별표로 중요 아티클 마킹, 즐겨찾기 모아 보기
- **검색 / 필터** — 제목·본문 키워드 검색, 날짜 범위 필터
- **형광펜 + 메모** — 본문 텍스트 드래그 선택 후 4가지 색상으로 하이라이트, 우측 패널에 메모 작성
- **번역** — DeepL 기본, 한도 초과 시 Google Translate 자동 폴백 (한/영/일/중 등)
- **마크다운 렌더링** — 크롤링된 본문을 마크다운으로 변환해 렌더링

## 기술 스택

| 영역 | 사용 기술 |
|---|---|
| Backend | FastAPI, SQLAlchemy, SQLite |
| Frontend | React 18, Vite, ReactMarkdown |
| 크롤링 | trafilatura, BeautifulSoup4, requests |
| 번역 | deepl, deep-translator (Google) |
| 배포 | Docker Compose, Nginx |

## 시작하기

### 요구사항

- Docker, Docker Compose

### 실행

```bash
# 저장소 클론
git clone https://github.com/Changha-0902/News-Archieve.git
cd News-Archieve

# (선택) DeepL API 키 설정 — 없으면 Google Translate로만 동작
echo "DEEPL_API_KEY=your-deepl-api-key" > .env

# 빌드 및 실행
docker compose up --build -d
```

브라우저에서 `http://localhost:3000` 접속

### 종료

```bash
docker compose down
```

## 환경변수

| 변수 | 설명 | 기본값 |
|---|---|---|
| `DEEPL_API_KEY` | DeepL API 키 (free/pro 모두 가능) | 없음 (Google Translate 폴백) |
| `DATABASE_URL` | SQLite DB 경로 | `sqlite:////app/data/archive.db` |

데이터는 `./data/` 디렉토리에 볼륨 마운트되어 컨테이너 재시작 후에도 유지됩니다.

## 프로젝트 구조

```
News-Archieve/
├── backend/
│   ├── main.py          # FastAPI 앱, API 엔드포인트
│   ├── models.py        # SQLAlchemy 모델
│   ├── schemas.py       # Pydantic 스키마
│   ├── crawler.py       # URL 크롤러
│   ├── database.py      # DB 연결
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx      # 메인 React 컴포넌트
│       ├── App.css      # 스타일
│       └── api.js       # API 클라이언트
├── docker-compose.yml
└── .env                 # API 키 (gitignore)
```

## API 엔드포인트

| Method | Path | 설명 |
|---|---|---|
| `POST` | `/api/crawl` | URL 크롤링 |
| `GET/POST` | `/api/articles` | 아티클 목록 조회 / 생성 |
| `GET/PATCH/DELETE` | `/api/articles/{id}` | 아티클 상세 / 수정 / 삭제 |
| `POST` | `/api/articles/{id}/translate` | 번역 |
| `GET/POST` | `/api/articles/{id}/highlights` | 하이라이트 목록 / 생성 |
| `PATCH/DELETE` | `/api/highlights/{id}` | 하이라이트 수정 / 삭제 |
| `GET/POST` | `/api/folders` | 폴더 목록 / 생성 |
| `DELETE` | `/api/folders/{id}` | 폴더 삭제 |
| `GET/POST` | `/api/tags` | 태그 목록 / 생성 |
| `DELETE` | `/api/tags/{id}` | 태그 삭제 |
