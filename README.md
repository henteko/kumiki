# Kumiki

KumikiはJSONベースの設定ファイルから動画を自動生成するCLIツールです。シンプルな構成ファイルを使用して、テキスト、画像、動画、複合シーンを組み合わせた動画を作成できます。

## 特徴

- 📝 **JSONベースの設定**: 人間が読みやすいJSON形式で動画の構成を定義
- 🎬 **多様なシーンタイプ**: テキスト、画像、動画、複合シーンをサポート
- 🎵 **音声サポート**: BGM、ナレーション機能
- 🔄 **シーントランジション**: フェード、ワイプ、ディゾルブ効果
- 🗣️ **AI音声合成**: Google Gemini APIによるナレーション自動音声化
- 🔍 **スキーマ検証**: 設定ファイルの構文チェックと検証
- 📋 **AI支援開発**: JSON Schemaを出力してAIツールと連携

## 必要条件

- Node.js 18.0.0以上
- FFmpeg（システムにインストール済みであること）
- Google Chrome（プレビュー機能用）

## インストール

```bash
# リポジトリをクローン
git clone https://github.com/henteko/kumiki.git
cd kumiki

# 依存関係をインストール
npm install

# ビルドとグローバルインストール
npm run build
npm link

kumiki --version
```

## 使い方

### 基本的なコマンド

#### 1. プロジェクトファイルの検証

```bash
kumiki validate <project.json>
```

設定ファイルの構文と内容を検証します。

#### 2. プレビュー

```bash
kumiki preview <project.json>
```

ブラウザで動画のプレビューを表示します（インタラクティブ）。

#### 3. 動画生成

```bash
kumiki generate <project.json> --output video.mp4
```

設定ファイルから動画を生成します。

オプション:
- `-o, --output <path>`: 出力ファイルパス（デフォルト: output.mp4）
- `-t, --temp-dir <path>`: 一時ファイルディレクトリ
- `-c, --concurrency <number>`: 並列処理数（デフォルト: 2）
- `--keep-temp`: 一時ファイルを保持

#### 4. スキーマ表示

```bash
kumiki show-schema [--include-examples]
```

KumikiプロジェクトのJSON Schemaを表示します。AIツールとの連携に便利です。

#### 5. キャッシュ管理

```bash
kumiki cache clear
```

生成された画像やナレーションのキャッシュをクリアします。

## プロジェクトファイルの構造

### 基本的な例

```json
{
  "version": "1.0.0",
  "name": "サンプル動画",
  "settings": {
    "resolution": "1920x1080",
    "fps": 30
  },
  "scenes": [
    {
      "id": "intro",
      "type": "text",
      "duration": 5,
      "content": {
        "text": "Welcome to Kumiki",
        "style": {
          "fontSize": 48,
          "color": "#FFFFFF",
          "fontFamily": "Arial"
        },
        "position": {
          "x": "center",
          "y": "center"
        }
      },
      "background": {
        "type": "gradient",
        "value": "linear-gradient(45deg, #667eea 0%, #764ba2 100%)"
      }
    }
  ]
}
```

### シーンタイプ

#### テキストシーン

```json
{
  "id": "text-1",
  "type": "text",
  "duration": 5,
  "content": {
    "text": "Hello World",
    "style": {
      "fontSize": 48,
      "color": "#FFFFFF",
      "fontFamily": "Arial",
      "fontWeight": "bold",
      "textAlign": "center"
    },
    "position": {
      "x": "center",
      "y": "center"
    }
  }
}
```

#### 画像シーン

```json
{
  "id": "image-1",
  "type": "image",
  "duration": 3,
  "content": {
    "src": "assets/logo.png",
    "fit": "contain",
    "position": {
      "x": "center",
      "y": "center"
    }
  }
}
```

#### 動画シーン

```json
{
  "id": "video-1",
  "type": "video",
  "duration": 10,
  "content": {
    "src": "assets/intro.mp4",
    "trim": {
      "start": 0,
      "end": 10
    }
  }
}
```

#### 複合シーン

```json
{
  "id": "composite-1",
  "type": "composite",
  "duration": 5,
  "layers": [
    {
      "type": "image",
      "content": {
        "src": "assets/background.jpg",
        "fit": "cover",
        "position": { "x": "center", "y": "center" }
      }
    },
    {
      "type": "text",
      "content": {
        "text": "Overlay Text",
        "style": {
          "fontSize": 36,
          "color": "#FFFFFF",
          "fontFamily": "Arial"
        },
        "position": { "x": "center", "y": 100 }
      },
      "opacity": 0.9,
      "zIndex": 1
    }
  ]
}
```

### 背景設定

```json
{
  "background": {
    "type": "color",
    "value": "#1a1a1a"
  }
}

{
  "background": {
    "type": "gradient",
    "value": "linear-gradient(45deg, #667eea 0%, #764ba2 100%)"
  }
}

{
  "background": {
    "type": "image",
    "value": "assets/background.jpg"
  }
}
```

### トランジション

```json
{
  "transition": {
    "type": "fade",
    "duration": 1.0
  }
}

{
  "transition": {
    "type": "wipe",
    "duration": 0.5,
    "direction": "left"
  }
}
```

### 音声設定

```json
{
  "audio": {
    "backgroundMusic": {
      "src": "assets/bgm.mp3",
      "volume": 0.5,
      "fadeIn": 2,
      "fadeOut": 2
    }
  }
}
```

### ナレーション

各シーンにナレーションを追加できます。音声は自動的にキャッシュされ、同じテキストと設定での再生成を避けます。

```json
{
  "narration": {
    "text": "この動画では新機能を紹介します。",
    "voice": {
      "languageCode": "ja-JP",
      "name": "Kore",
      "speakingRate": 1.0,
      "pitch": 0,
      "volumeGainDb": 0
    },
    "timing": {
      "delay": 0.5,
      "fadeIn": 0.3,
      "fadeOut": 0.3
    }
  }
}
```

## AI支援開発

### Claude CodeやGemini CLIとの連携

```bash
# JSON Schemaを取得
kumiki show-schema --include-examples > schema.json

# AIツールに渡して動画構成を生成
# 例: "30秒の製品紹介動画を作成してください"
```

### スキーマ検証

```bash
# ajvを使用した検証例
kumiki show-schema > schema.json
ajv validate -s schema.json -d my-project.json
```

## 高度な使い方

### プロジェクト設定

```json
{
  "settings": {
    "resolution": "1920x1080",
    "fps": 30,
    "narrationDefaults": {
      "voice": {
        "languageCode": "ja-JP",
        "name": "Kore",
        "speakingRate": 1.0
      },
      "volumeMix": {
        "narration": 0.8,
        "bgm": 0.3
      }
    }
  }
}
```

### 画像生成（AI）

```json
{
  "content": {
    "src": {
      "type": "generate",
      "prompt": "夕日に染まる富士山",
      "style": "photorealistic",
      "aspectRatio": "16:9"
    }
  }
}
```

## 開発

### セットアップ

```bash
# 依存関係のインストール
npm install

# スキーマの生成
npm run generate:schema

# 開発モードで実行
npm run dev

# ビルド
npm run build

# Lint
npm run lint

# 型チェック
npm run typecheck
```

### プロジェクト構造

```
kumiki/
├── src/
│   ├── cli.ts              # CLIエントリーポイント
│   ├── commands/           # CLIコマンド
│   ├── core/              # コア機能
│   ├── scenes/            # シーンレンダラー
│   ├── services/          # 外部サービス連携
│   ├── schemas/           # TypeSpec定義
│   └── utils/             # ユーティリティ
├── examples/              # サンプルプロジェクト
└── internal-docs/         # 内部ドキュメント
```

## トラブルシューティング

### FFmpegが見つからない

```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Windows
# FFmpeg公式サイトからダウンロードしてPATHに追加
```

### メモリ不足エラー

大きな動画を処理する場合：

```bash
NODE_OPTIONS="--max-old-space-size=8192" kumiki generate large-project.json
```

### キャッシュの問題

```bash
# キャッシュをクリア
kumiki cache clear

# 一時ファイルを確認
kumiki generate project.json --keep-temp
```

## ライセンス

Apache License 2.0

## 貢献

プルリクエストを歓迎します。大きな変更を行う場合は、まずissueを作成して変更内容について議論してください。