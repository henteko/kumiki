# Kumiki プロトタイプ画像生成機能仕様

## 概要

プロトタイプ動画制作時に、素材画像を用意せずともGemini APIを利用して画像を自動生成する機能を提供します。生成された画像はキャッシュされ、後から実際の画像に簡単に置き換えることができます。

## 背景と目的

### 課題
- プロトタイプ制作時に適切な素材画像を用意するのが面倒
- イメージを伝えるための仮画像を探す時間がもったいない
- プレースホルダー画像では最終的なイメージが伝わりにくい

### 解決策
- テキストプロンプトから画像を自動生成
- 生成した画像をキャッシュして再利用
- 簡単に実画像に置き換え可能なインターフェース

## 機能仕様

### 1. 画像生成機能

#### 1.1 プロンプト定義方式
```json
{
  "type": "image",
  "duration": 5,
  "content": {
    "src": "generate://A beautiful sunset over the ocean with orange sky",
    "fit": "cover",
    "position": { "x": "center", "y": "center" }
  }
}
```

または、より詳細な設定：
```json
{
  "type": "image",
  "duration": 5,
  "content": {
    "src": {
      "type": "generate",
      "prompt": "A beautiful sunset over the ocean with orange sky",
      "style": "photorealistic",
      "aspectRatio": "16:9",
      "seed": 12345
    },
    "fit": "cover",
    "position": { "x": "center", "y": "center" }
  }
}
```

#### 1.2 生成パラメータ
- **prompt**: 生成したい画像の説明（必須）
- **style**: 画像スタイル（optional）
  - `photorealistic`: 写実的
  - `illustration`: イラスト風
  - `anime`: アニメ風
  - `sketch`: スケッチ風
- **aspectRatio**: アスペクト比（optional、デフォルト: 16:9）
- **seed**: 再現性のためのシード値（optional）

### 2. キャッシュシステム

#### 2.1 キャッシュ構造
```
.kumiki-cache/
├── generated-images/
│   ├── manifest.json
│   ├── a1b2c3d4e5f6.png
│   ├── b2c3d4e5f6g7.png
│   └── ...
└── cache-info.json
```

#### 2.2 キャッシュキー生成
```typescript
interface CacheKey {
  prompt: string;
  style?: string;
  aspectRatio?: string;
  seed?: number;
  model?: string;  // Geminiモデルバージョン
}

// SHA256ハッシュでキーを生成
function generateCacheKey(params: CacheKey): string {
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
        "prompt": "A beautiful sunset over the ocean with orange sky",
        "style": "photorealistic",
        "aspectRatio": "16:9"
      },
      "metadata": {
        "generatedAt": "2024-01-20T10:00:00Z",
        "model": "gemini-pro-vision",
        "fileSize": 1024000,
        "mimeType": "image/png"
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

### 3. 画像の置き換え方法

#### 3.1 JSONの直接編集
生成された画像から実際の画像への置き換えは、JSONファイルを直接編集するだけで完了します。

**置き換え前（プロトタイプ）:**
```json
{
  "type": "image",
  "duration": 5,
  "content": {
    "src": "generate://A beautiful sunset over the ocean with orange sky",
    "fit": "cover"
  }
}
```

**置き換え後（本番用）:**
```json
{
  "type": "image",
  "duration": 5,
  "content": {
    "src": "./assets/real-sunset.jpg",
    "fit": "cover"
  }
}
```

#### 3.2 生成画像の確認方法
生成時のログ出力で、どのプロンプトがどのキャッシュファイルに対応しているかを確認できます：

```
[INFO] Generating image for scene-1
[INFO] Prompt: "A beautiful sunset over the ocean with orange sky"
[INFO] Cached at: .kumiki-cache/generated-images/a1b2c3d4e5f6.png
[INFO] To replace: Change src to your actual image path in the JSON file
```

#### 3.3 混在利用
同じプロジェクト内で、生成画像と実画像を混在させることも可能です：

```json
{
  "scenes": [
    {
      "id": "scene-1",
      "type": "image",
      "content": {
        "src": "generate://Modern office interior",  // プロトタイプ用
        "fit": "cover"
      }
    },
    {
      "id": "scene-2",
      "type": "image",
      "content": {
        "src": "./assets/company-logo.png",  // 既に用意済みの画像
        "fit": "contain"
      }
    }
  ]
}
```

### 4. Gemini API統合

#### 4.1 サービス実装
```typescript
// src/services/gemini.ts
export class GeminiImageService {
  private client: GoogleGenerativeAI;
  private cache: ImageCache;

  async generateImage(params: GenerateImageParams): Promise<string> {
    // 1. キャッシュチェック
    const cacheKey = generateCacheKey(params);
    const cached = await this.cache.get(cacheKey);
    if (cached) {
      logger.info('Using cached image', { cacheKey, prompt: params.prompt });
      return cached;
    }

    // 2. API キーチェック
    if (!process.env.GEMINI_API_KEY) {
      throw new GeminiError('GEMINI_API_KEY environment variable is not set');
    }

    // 3. Gemini APIコール
    logger.info('Generating new image', { prompt: params.prompt });
    const imageData = await this.callGeminiAPI(params);

    // 4. キャッシュ保存
    const imagePath = await this.cache.save(cacheKey, imageData, params);
    
    return imagePath;
  }

  private async callGeminiAPI(params: GenerateImageParams): Promise<Buffer> {
    // Gemini APIを使用して画像生成
    // 詳細な実装は後日
  }
}
```

#### 4.2 エラーハンドリング
```typescript
export class GeminiError extends KumikiError {
  constructor(message: string, details?: any) {
    super(message, 'GEMINI_ERROR', details);
  }
}

// レート制限対応
export class RateLimitHandler {
  async executeWithRetry<T>(
    fn: () => Promise<T>, 
    maxRetries: number = 3
  ): Promise<T> {
    // 指数バックオフでリトライ
  }
}
```

### 5. 設定

#### 5.1 環境変数
必要な環境変数は1つのみです：
```bash
# .env
GEMINI_API_KEY=your-api-key
```

#### 5.2 デフォルト設定
その他の設定はすべてデフォルト値を使用します：
- **キャッシュディレクトリ**: `.kumiki-cache/generated-images/`
- **画像生成の有効化**: `generate://` プレフィックスで自動的に有効化
- **モデル**: Gemini Pro Vision（最新版を自動選択）
- **画像フォーマット**: PNG
- **デフォルトスタイル**: photorealistic
- **デフォルトアスペクト比**: 16:9

## 実装計画

### フェーズ1: 基本機能（MVP）
1. Gemini API統合
2. 基本的な画像生成機能
3. シンプルなファイルベースキャッシュ

### フェーズ2: キャッシュシステム
1. 高度なキャッシュ管理
2. キャッシュクリーンアップ
3. 使用統計

### フェーズ3: 開発支援機能
1. 生成画像の使用状況ログ
2. キャッシュ管理コマンド
3. デバッグモード

### フェーズ4: 高度な機能
1. バッチ生成
2. 画像バリエーション
3. スタイル転送

## セキュリティとプライバシー

### APIキー管理
- 環境変数での管理を推奨
- .envファイルは.gitignoreに追加
- キー漏洩時の警告機能

### キャッシュセキュリティ
- ローカルキャッシュのみ（クラウド同期なし）
- ユーザー固有のプロンプトはハッシュ化
- キャッシュディレクトリのアクセス権限制御

## パフォーマンス考慮

### 並列生成
```typescript
// 複数画像の並列生成
const images = await Promise.all(
  scenes
    .filter(s => s.type === 'image' && isGenerateUrl(s.content.src))
    .map(s => generateImage(s.content.src))
);
```

### プリフェッチ
```typescript
// プレビュー時に事前生成
kumiki preview --prefetch-images example.json
```

## エラーケースと対処

### 1. API制限
- レート制限: 自動リトライとバックオフ
- クォータ超過: キャッシュ優先モード

### 2. ネットワークエラー
- オフラインモード: キャッシュのみ使用
- タイムアウト: 設定可能なタイムアウト時間

### 3. 生成失敗
- フォールバック: デフォルト画像を使用
- エラーレポート: 失敗した生成のログ

## 使用例

### 基本的な使用
```bash
# プロトタイプ作成（generate://が含まれていれば自動的に画像生成）
kumiki generate prototype.json

# キャッシュ状況確認
kumiki cache status
```

### JSONファイルの編集例
```json
// プロトタイプ段階
{
  "scenes": [
    {
      "type": "image",
      "duration": 3,
      "content": {
        "src": "generate://Futuristic city skyline at night"
      }
    }
  ]
}

// 本番用に置き換え後
{
  "scenes": [
    {
      "type": "image",
      "duration": 3,
      "content": {
        "src": "./assets/tokyo-night.jpg"
      }
    }
  ]
}
```

### キャッシュ管理
```bash
# キャッシュクリア
kumiki cache clear --older-than 30d

# キャッシュサイズ確認
kumiki cache size
```

## まとめ

この機能により、Kumikiはより効率的なプロトタイプ制作ツールとなります：

1. **迅速なプロトタイピング**: 画像素材なしで即座に動画プレビュー
2. **コスト効率**: キャッシュによるAPI呼び出しの最小化
3. **柔軟な置き換え**: プロトタイプから本番への移行が容易
4. **拡張性**: 将来的に他のAI画像生成サービスにも対応可能

この設計により、クリエイターはアイデアの具現化により集中でき、素材準備の手間を大幅に削減できます。

## 開発タスクリスト

### Phase 1: 基盤整備とGemini API統合

#### 1.1 Geminiサービスの実装
- [ ] `src/services/gemini.ts` を作成
- [ ] Google Generative AI SDKをインストール (`@google/generative-ai`)
- [ ] `GeminiImageService` クラスの基本実装
- [ ] 環境変数からAPIキーを読み込む処理
- [ ] エラーハンドリング（APIキー未設定、API呼び出しエラー）

#### 1.2 画像生成URLパーサーの実装
- [ ] `generate://` プレフィックスの検出処理を `src/scenes/image.ts` に追加
- [ ] URLからプロンプトを抽出する関数の実装
- [ ] 詳細設定（オブジェクト形式）のパース処理

#### 1.3 キャッシュシステムの基礎実装
- [ ] `src/services/image-cache.ts` を作成
- [ ] キャッシュキー生成関数の実装（SHA256ハッシュ）
- [ ] キャッシュディレクトリの作成・管理
- [ ] キャッシュの読み込み・保存処理

### Phase 2: 画像シーンへの統合

#### 2.1 ImageSceneRendererの拡張
- [ ] `src/scenes/image.ts` の `render` メソッドを更新
- [ ] `generate://` URLの場合は `GeminiImageService` を呼び出す
- [ ] 通常のファイルパスとの分岐処理
- [ ] キャッシュされた画像の利用

#### 2.2 エラーハンドリングとフォールバック
- [ ] Gemini API呼び出し失敗時のエラーメッセージ改善
- [ ] ネットワークエラー時の適切なハンドリング
- [ ] レート制限エラーの検出と対処

#### 2.3 ログ出力の実装
- [ ] 画像生成時の詳細ログ（プロンプト、キャッシュパス）
- [ ] キャッシュヒット/ミス時のログ
- [ ] 置き換え方法の案内メッセージ

### Phase 3: キャッシュ管理機能

#### 3.1 キャッシュマニフェスト
- [ ] `manifest.json` の読み書き処理
- [ ] キャッシュエントリのメタデータ管理
- [ ] 使用統計の記録

#### 3.2 CLIコマンドの追加
- [ ] `kumiki cache status` コマンドの実装
- [ ] `kumiki cache clear` コマンドの実装
- [ ] `kumiki cache size` コマンドの実装

#### 3.3 キャッシュクリーンアップ
- [ ] 古いキャッシュの自動削除機能
- [ ] キャッシュサイズの計算
- [ ] 手動クリーンアップのオプション

### Phase 4: テストとドキュメント

#### 4.1 単体テスト
- [ ] `GeminiImageService` のテスト
- [ ] キャッシュシステムのテスト
- [ ] URLパーサーのテスト
- [ ] モックを使用したAPI呼び出しテスト

#### 4.2 統合テスト
- [ ] `generate://` URLを含むプロジェクトの動画生成テスト
- [ ] キャッシュの動作確認テスト
- [ ] エラーケースのテスト

#### 4.3 ドキュメント更新
- [ ] READMEに画像生成機能の説明を追加
- [ ] 使用例とベストプラクティスの記載
- [ ] トラブルシューティングガイド

### Phase 5: 最適化と改善

#### 5.1 パフォーマンス最適化
- [ ] 並列画像生成の実装
- [ ] メモリ使用量の最適化
- [ ] キャッシュアクセスの高速化

#### 5.2 UX改善
- [ ] プログレスバーでの生成状況表示
- [ ] より詳細なエラーメッセージ
- [ ] 生成画像のプレビュー機能（将来）

#### 5.3 追加機能（オプション）
- [ ] 画像スタイルのバリエーション対応
- [ ] アスペクト比の自動調整
- [ ] バッチ生成モード

### 実装順序と優先度

1. **最優先**: Phase 1 と Phase 2 - 基本的な画像生成機能を動作させる
2. **高優先**: Phase 3.1-3.2 - キャッシュ機能を完成させる
3. **中優先**: Phase 4 - テストとドキュメントで品質を確保
4. **低優先**: Phase 5 - 使い勝手の向上

### 開発時の注意事項

- **CLAUDE.mdの遵守**: 各実装後は必ず `npm run lint` と `npm run typecheck` を実行
- **段階的リリース**: 各Phaseが完了したら動作確認を行う
- **後方互換性**: 既存の画像シーン機能を壊さないよう注意
- **エラーメッセージ**: ユーザーフレンドリーなメッセージを心がける