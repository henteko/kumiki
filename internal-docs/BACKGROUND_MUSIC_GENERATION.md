# Kumiki Background Music自動生成機能仕様

## 概要

プロトタイプ動画制作時に、背景音楽(BGM)を用意せずともGemini API（Lyria音楽生成モデル）を利用してBGMを自動生成する機能を提供します。生成されたBGMはキャッシュされ、後から実際の音楽ファイルに簡単に置き換えることができます。

## 背景と目的

### 課題
- プロトタイプ制作時に適切なBGMを用意するのが面倒
- 著作権フリーの音楽を探す時間がもったいない
- 動画の雰囲気に合うBGMを見つけるのが困難

### 解決策
- テキストプロンプトから音楽を自動生成
- 生成した音楽をキャッシュして再利用
- 簡単に実音楽ファイルに置き換え可能なインターフェース

## 機能仕様

### 1. BGM生成機能

#### 1.1 プロンプト定義方式

シンプルな指定方法（generate:// URL形式）:
```json
{
  "audio": {
    "backgroundMusic": {
      "src": "generate://ambient piano music for presentation",
      "volume": 0.7,
      "fadeIn": 2,
      "fadeOut": 3
    }
  }
}
```

詳細な設定（オブジェクト形式）:
```json
{
  "audio": {
    "backgroundMusic": {
      "src": {
        "type": "generate",
        "prompts": [
          { "text": "ambient piano", "weight": 1.0 },
          { "text": "calm", "weight": 0.8 },
          { "text": "presentation background", "weight": 0.6 }
        ],
        "config": {
          "bpm": 80,
          "temperature": 1.0,
          "density": 0.5,
          "brightness": 0.4,
          "scale": "C_MAJOR_A_MINOR"
        },
        "duration": 60,
        "seed": 12345
      },
      "volume": 0.7,
      "fadeIn": 2,
      "fadeOut": 3
    }
  }
}
```

#### 1.2 生成パラメータ

**基本パラメータ（generate:// URL形式）:**
- **prompt**: 生成したい音楽の説明（必須）

**詳細パラメータ（オブジェクト形式）:**
- **prompts**: 重み付きプロンプトの配列（必須）
  - `text`: プロンプトテキスト
  - `weight`: 重み（0.0-1.0）
- **config**: 音楽生成設定（optional）
  - `bpm`: テンポ（60-200、デフォルト: 120）
  - `temperature`: ランダム性（0.0-3.0、デフォルト: 1.0）
  - `guidance`: プロンプトへの忠実度（0.0-6.0、デフォルト: 4.0）
  - `density`: 音の密度（0.0-1.0、デフォルト: 0.7）
  - `brightness`: 音の明るさ（0.0-1.0、デフォルト: 0.6）
  - `scale`: 音階（例: "C_MAJOR_A_MINOR"、デフォルト: "C_MAJOR_A_MINOR"）
  - `mute_bass`: ベースをミュート（boolean、デフォルト: false）
  - `mute_drums`: ドラムをミュート（boolean、デフォルト: false）
  - `only_bass_and_drums`: ベースとドラムのみ（boolean、デフォルト: false）
- **duration**: 生成する音楽の長さ（秒、デフォルト: プロジェクトの総時間）
- **seed**: 再現性のためのシード値（optional）

### 2. キャッシュシステム

#### 2.1 キャッシュ構造
```
.kumiki-cache/
├── generated-music/
│   ├── manifest.json
│   ├── a1b2c3d4e5f6.wav
│   ├── b2c3d4e5f6g7.wav
│   └── ...
├── generated-images/
│   └── ...
└── cache-info.json
```

#### 2.2 キャッシュキー生成
```typescript
interface MusicCacheKey {
  prompt?: string;  // シンプル形式
  prompts?: WeightedPrompt[];  // 詳細形式
  config?: MusicGenerationConfig;
  duration?: number;
  seed?: number;
  model?: string;  // Geminiモデルバージョン
}

// SHA256ハッシュでキーを生成
function generateCacheKey(params: MusicCacheKey): string {
  const normalized = JSON.stringify(params, Object.keys(params).sort());
  return crypto.createHash('sha256').update(normalized).digest('hex');
}
```

#### 2.3 キャッシュmanifest
```json
{
  "version": "1.0",
  "entries": [
    {
      "key": "a1b2c3d4e5f6",
      "params": {
        "prompts": [
          { "text": "ambient piano", "weight": 1.0 }
        ],
        "config": {
          "bpm": 80,
          "temperature": 1.0
        },
        "duration": 60
      },
      "metadata": {
        "generatedAt": "2024-01-20T10:00:00Z",
        "model": "models/lyria-realtime-exp",
        "fileSize": 5760000,
        "mimeType": "audio/wav",
        "sampleRate": 48000,
        "channels": 2,
        "actualDuration": 60.5
      },
      "usage": {
        "lastUsed": "2024-01-20T15:00:00Z",
        "useCount": 3,
        "projects": ["project1.json", "project2.json"]
      }
    }
  ]
}
```

### 3. BGMの置き換え方法

#### 3.1 JSONの直接編集
生成されたBGMから実際の音楽ファイルへの置き換えは、JSONファイルを直接編集するだけで完了します。

**置き換え前（プロトタイプ）:**
```json
{
  "audio": {
    "backgroundMusic": {
      "src": "generate://epic orchestral music",
      "volume": 0.8
    }
  }
}
```

**置き換え後（本番用）:**
```json
{
  "audio": {
    "backgroundMusic": {
      "src": "./assets/bgm/epic-theme.mp3",
      "volume": 0.8
    }
  }
}
```

#### 3.2 生成BGMの確認方法
生成時のログ出力で、どのプロンプトがどのキャッシュファイルに対応しているかを確認できます：

```
[INFO] Generating background music
[INFO] Prompts: "epic orchestral music"
[INFO] Duration: 60 seconds
[INFO] Cached at: .kumiki-cache/generated-music/a1b2c3d4e5f6.wav
[INFO] To replace: Change src to your actual music file path in the JSON file
```

### 4. Gemini API統合

#### 4.1 サービス実装
```typescript
// src/services/gemini-music.ts
export class GeminiMusicService {
  private genAI: GoogleGenAI | null = null;
  private initialized = false;

  private initialize() {
    if (this.initialized) return;
    
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.genAI = new GoogleGenAI({
        apiKey: apiKey,
        apiVersion: 'v1alpha'  // Lyria requires v1alpha
      });
    }
    this.initialized = true;
  }

  async generateMusic(params: GenerateMusicParams): Promise<Buffer> {
    this.initialize();
    
    if (!this.genAI) {
      throw new GeminiError('GEMINI_API_KEY environment variable is not set');
    }

    const session = await this.genAI.live.music.connect({
      model: 'models/lyria-realtime-exp',
      callbacks: {
        onmessage: this.handleMessage.bind(this),
        onerror: this.handleError.bind(this),
        onclose: this.handleClose.bind(this)
      }
    });

    // 音楽生成処理...
    const audioBuffer = await this.generateWithSession(session, params);
    
    return audioBuffer;
  }
}
```

#### 4.2 型定義の拡張
```typescript
// src/types/index.ts に追加
export interface BackgroundMusic {
  src: string | GenerateMusicSource;
  volume: number;
  fadeIn?: number;
  fadeOut?: number;
}

export interface GenerateMusicSource {
  type: 'generate';
  prompts?: WeightedPrompt[];  // 詳細形式
  prompt?: string;  // シンプル形式
  config?: MusicGenerationConfig;
  duration?: number;
  seed?: number;
}

export interface WeightedPrompt {
  text: string;
  weight: number;
}

export interface MusicGenerationConfig {
  bpm?: number;
  temperature?: number;
  guidance?: number;
  density?: number;
  brightness?: number;
  scale?: string;
  mute_bass?: boolean;
  mute_drums?: boolean;
  only_bass_and_drums?: boolean;
}
```

### 5. 動画生成への統合

#### 5.1 FFmpeg統合
生成されたBGMを動画に統合する際の処理：

```typescript
// src/services/ffmpeg.ts の拡張
async addBackgroundMusic(
  videoPath: string,
  musicPath: string,
  outputPath: string,
  options: {
    volume: number;
    fadeIn?: number;
    fadeOut?: number;
    duration: number;
  }
): Promise<void> {
  const filterComplex = this.buildAudioFilters(options);
  
  await this.run([
    '-i', videoPath,
    '-i', musicPath,
    '-filter_complex', filterComplex,
    '-map', '0:v',
    '-map', '[mixed]',
    '-c:v', 'copy',
    '-c:a', 'aac',
    '-shortest',
    outputPath
  ]);
}
```

### 6. プロンプト例とベストプラクティス

#### 6.1 推奨プロンプト例

**ジャンル別:**
- プレゼンテーション: "ambient piano, corporate, calm, professional"
- 製品デモ: "upbeat electronic, modern, tech, inspiring"
- チュートリアル: "light acoustic guitar, friendly, educational"
- プロモーション: "epic orchestral, cinematic, powerful"

**雰囲気別:**
- リラックス: "meditation music, peaceful, slow tempo"
- エネルギッシュ: "upbeat dance, high energy, motivating"
- 神秘的: "ethereal ambient, mystical, atmospheric"
- 楽しい: "cheerful ukulele, playful, happy"

#### 6.2 設定の推奨値

**穏やかなBGM:**
```json
{
  "config": {
    "bpm": 60-80,
    "temperature": 0.8,
    "density": 0.3,
    "brightness": 0.4,
    "mute_drums": true
  }
}
```

**活発なBGM:**
```json
{
  "config": {
    "bpm": 120-140,
    "temperature": 1.2,
    "density": 0.8,
    "brightness": 0.9
  }
}
```

### 7. エラーハンドリング

#### 7.1 API制限
- レート制限: 自動リトライとバックオフ
- 生成時間制限: 最大5分までの音楽生成

#### 7.2 フォールバック
- 生成失敗時: エラーメッセージと共に無音で処理継続
- キャッシュ読み込み失敗: 再生成を試行

### 8. 設定

#### 8.1 環境変数
画像生成と同じAPIキーを使用：
```bash
# .env
GEMINI_API_KEY=your-api-key
```

#### 8.2 デフォルト設定
- **キャッシュディレクトリ**: `.kumiki-cache/generated-music/`
- **音楽生成の有効化**: `generate://` プレフィックスで自動的に有効化
- **モデル**: models/lyria-realtime-exp
- **音声フォーマット**: WAV (48kHz, 16bit, ステレオ)
- **デフォルト生成時間**: プロジェクトの総時間
- **デフォルトBPM**: 120
- **デフォルト音階**: C_MAJOR_A_MINOR

## 実装計画

### Phase 1: 基盤整備とGemini API統合
1. 型定義の拡張（BackgroundMusic, GenerateMusicSource）
2. `src/services/gemini-music.ts` の作成
3. Lyria音楽生成APIの統合
4. PCMからWAVへの変換処理

### Phase 2: キャッシュシステム
1. `src/services/music-cache.ts` の作成
2. キャッシュマニフェストの管理
3. 生成済み音楽の再利用

### Phase 3: 動画生成への統合
1. BGM生成URLの検出とパース
2. FFmpegでのBGM統合処理の拡張
3. 音量・フェード処理の実装

### Phase 4: CLI統合
1. キャッシュ管理コマンドの拡張（音楽キャッシュ対応）
2. 生成状況の表示改善
3. エラーメッセージの整備

### Phase 5: テストとドキュメント
1. 単体テストの作成
2. 統合テストの実施
3. ユーザードキュメントの更新

## セキュリティとプライバシー

画像生成機能と同様のセキュリティ対策を実施：
- APIキーの環境変数管理
- ローカルキャッシュのみ（クラウド同期なし）
- プロンプトのハッシュ化によるプライバシー保護

## まとめ

この機能により、Kumikiはより完成度の高いプロトタイプ動画を簡単に作成できるようになります：

1. **迅速なプロトタイピング**: BGM素材なしで即座に動画プレビュー
2. **著作権の心配なし**: 生成された音楽は自由に使用可能
3. **動画に最適化**: プロンプトで雰囲気を細かく調整可能
4. **簡単な置き換え**: プロトタイプから本番への移行が容易

この設計により、クリエイターは動画の内容により集中でき、BGM選びの手間を大幅に削減できます。