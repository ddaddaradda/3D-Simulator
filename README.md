# 3D 휠체어 방향 시뮬레이터

Parquet 파일의 휠체어 방향 데이터를 시각화하고 분석하기 위한 웹 기반 3D 시뮬레이션 도구입니다. 로컬 파일 또는 AWS S3 버킷에서 데이터를 선택할 수 있는 사용자 인터페이스를 제공하며, Three.js를 사용하여 3D 환경에서 방향(pitch, roll, yaw)을 렌더링합니다.

## 주요 기능

- **3D 시각화**: 휠체어 또는 오토바이 모델을 3D 장면에서 렌더링합니다.
- **데이터 소스**: 로컬 Parquet 파일과 AWS S3 버킷 모두에서 데이터 로드를 지원합니다.
- **재생 컨트롤**: 재생, 일시정지, 속도 제어, 타임라인 슬라이더를 포함하여 시뮬레이션 데이터를 탐색할 수 있습니다.
- **인터랙티브 카메라**: 오빗 컨트롤과 자유 카메라 모드를 모두 제공하여 모든 각도에서 3D 모델을 검사할 수 있습니다.
- **데이터 처리**: 백엔드에서 Parquet 파일을 처리하여 원시 센서 값으로부터 방향 데이터를 계산합니다.

## 기술 스택

### 백엔드
- **프레임워크**: Flask
- **라이브러리**:
  - Pandas (데이터 처리)
  - PyArrow (Parquet 파일 처리)
  - Boto3 (AWS S3 연동)

### 프론트엔드
- **라이브러리**: Three.js (3D 렌더링)
- **언어**: HTML, CSS, JavaScript (ESM)

### 의존성 관리
- `uv` 패키지 매니저 사용 (`pyproject.toml` 참조)

## 프로젝트 구조

```
.
├── api/                  # Flask Blueprint API 라우트
│   ├── local_api.py      # 로컬 파일 작업 라우트
│   └── s3_api.py         # S3 작업 라우트
├── data/                 # 로컬 Parquet 파일 기본 디렉토리
├── services/             # 비즈니스 로직 서비스
│   ├── s3_service.py     # AWS S3 상호작용 처리
│   └── simulation_processor.py # Parquet 데이터 처리 로직
├── static/               # 프론트엔드 리소스
│   ├── js/               # 모듈화된 JavaScript 파일
│   │   ├── api.js
│   │   ├── simulation.js
│   │   └── ui.js
│   ├── main.js           # 프론트엔드 JS 메인 진입점
│   └── style.css         # 스타일시트
├── temp_data/            # S3에서 다운로드한 파일 임시 저장소
├── tests/                # 테스트 파일
├── api_server.py         # 메인 Flask 애플리케이션 파일
├── config.py             # 애플리케이션 설정
├── index.html            # 메인 HTML 파일
└── pyproject.toml        # 프로젝트 의존성
```

## 설치 및 실행

### 사전 요구사항

- Python 3.10 이상
- `uv` 패키지 매니저

### 설치 방법

1. **저장소 클론:**
   ```bash
   git clone <repository-url>
   cd wheelchair_analysis
   ```

2. **가상 환경 생성 및 의존성 설치:**
   ```bash
   uv venv
   uv pip install -r pyproject.toml
   ```

   또는 uv가 전역으로 설치된 경우:
   ```bash
   uv pip install -r pyproject.toml
   ```

3. **환경 변수 설정:**

   `.env.example` 파일을 복사하여 `.env` 파일을 생성합니다:
   ```bash
   cp .env.example .env
   ```

   S3 기능을 사용하려면 `.env` 파일에 AWS 자격 증명을 설정해야 합니다:
   ```
   AWS_ACCESS_KEY_ID=your_access_key
   AWS_SECRET_ACCESS_KEY=your_secret_key
   S3_BUCKET_BLE=your_ble_bucket_name
   S3_BUCKET_LTE=your_lte_bucket_name
   ```

### 서버 실행

Flask 개발 서버를 시작하려면 다음 명령어를 실행하세요:

```bash
python api_server.py
```

애플리케이션은 `http://localhost:7003`에서 실행됩니다.

## 사용 방법

### 로컬 파일 사용

1. Parquet 파일을 `data/` 디렉토리에 복사합니다.
2. 브라우저에서 애플리케이션을 엽니다.
3. "Local" 탭을 선택합니다.
4. 파일을 선택하고 "Import" 버튼을 클릭합니다.

### S3 파일 사용

1. AWS 자격 증명이 `.env` 파일에 설정되어 있는지 확인합니다.
2. "S3" 탭을 선택합니다.
3. 센서 타입(BLE 또는 LTE)을 선택합니다.
4. 날짜를 선택하면 해당 날짜의 센서 ID 목록이 표시됩니다.
5. 센서 ID를 선택하고 "Download" → "Convert" 버튼을 순서대로 클릭합니다.

### 컨트롤

- **재생/일시정지**: Play 버튼 클릭
- **재생 속도**: Speed 드롭다운에서 선택 (0.5x ~ 4x)
- **타임라인**: 슬라이더를 드래그하여 특정 시점으로 이동
- **카메라 모드**:
  - "Free Camera" 버튼 클릭 후 화면 클릭으로 자유 카메라 활성화
  - W/A/S/D: 이동
  - Space/Shift: 상승/하강
  - ESC: 자유 카메라 종료
- **카메라 리셋**: "Reset View" 버튼으로 기본 뷰로 복귀

## 테스트

pytest를 사용하여 테스트를 실행할 수 있습니다:

```bash
uv run pytest tests/ -v
```

## 라이선스

이 프로젝트는 교육 및 연구 목적으로 사용됩니다.

## 기여

버그 리포트나 기능 제안은 이슈로 등록해주세요.
