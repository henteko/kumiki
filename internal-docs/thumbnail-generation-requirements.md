# 動画サムネイル自動生成機能 要件定義書

## 1. 機能概要

Kumikiプロジェクトから生成される動画コンテンツに対して、Gemini APIを活用した自動サムネイル生成機能を実装する。動画の内容を分析し、最も重要または印象的な部分を強調したサムネイル画像を生成する。

## 2. 機能要件

### 2.1 基本要件

- **画像形式**: PNG形式で出力
- **画像サイズ**: 1280x720px（16:9、YouTube推奨サイズ）
- **ファイル名規則**: 
  - generateコマンド: `{動画ファイル名}_thumbnail.png`
  - previewコマンド: `thumbnail.png`

### 2.2 生成方法

#### 2.2.1 generateコマンドでの自動生成
- `kumiki generate`実行時に、MP4ファイルと同じディレクトリにサムネイル画像を自動生成
- 字幕ファイル（.vtt）と同様に、オプションで無効化可能

#### 2.2.2 previewコマンドでの生成
- 既存の`kumiki preview`コマンド実行時に、プレビューディレクトリに`thumbnail.png`として生成
- プレビュー用の静的サムネイルとして利用可能

### 2.3 サムネイル生成ロジック

#### 2.3.1 コンテンツ分析
- プロジェクトファイル内の以下の要素を分析:
  - 各シーンのテキストコンテンツ
  - ナレーションテキスト
  - シーンの重要度（duration、順序など）
  - 画像・動画コンテンツのメタデータ

#### 2.3.2 Gemini APIによる分析
- 動画の内容をテキストベースでサマライズ
- 最も強調すべきキーポイントを抽出
- サムネイルに含めるべき要素を決定

#### 2.3.3 サムネイル構成要素
- **メインビジュアル**: 最も重要なシーンの画像または生成画像
- **タイトルテキスト**: 動画の主要メッセージ（最大2行）
- **アクセント要素**: 
  - 背景グラデーション
  - 枠線やアイコン
  - 強調色の使用

## 3. 技術要件

### 3.1 Gemini API統合

```typescript
interface ThumbnailAnalysisRequest {
  scenes: Scene[];
  projectName: string;
  narrations?: string[];
}

interface ThumbnailAnalysisResponse {
  mainMessage: string;
  subMessage?: string;
  keySceneId: string;
  suggestedStyle: 'bold' | 'minimal' | 'colorful';
  emphasisPoints: string[];
}
```

### 3.2 画像生成パイプライン

1. **シーン画像の抽出**
   - 指定されたキーシーンから画像を抽出
   - 動画シーンの場合は代表フレームを抽出

2. **テキストオーバーレイ**
   - Puppeteerを使用してHTML/CSSベースのオーバーレイを生成
   - フォント: Noto Sans JP（日本語対応）
   - テキストシャドウで可読性確保

3. **画像合成**
   - Canvas APIまたはSharpライブラリで最終合成
   - 必要に応じて画像フィルタ適用

### 3.3 デザインテンプレート

```typescript
interface ThumbnailTemplate {
  layout: 'center' | 'split' | 'corner';
  textPosition: 'top' | 'center' | 'bottom';
  overlay: {
    opacity: number;
    gradient?: string;
  };
  border?: {
    width: number;
    color: string;
  };
}
```

## 4. インターフェース仕様

### 4.1 コマンドラインインターフェース

#### generateコマンド拡張
```bash
kumiki generate project.json [options]
  --no-thumbnail    サムネイル生成をスキップ
```

#### previewコマンド拡張
- previewコマンド実行時は自動的にサムネイルが生成される（デフォルト動作）
- 特別なオプションは不要

### 4.2 プログラマティックインターフェース

```typescript
interface ThumbnailOptions {
  template?: ThumbnailTemplate;
  outputPath?: string;
  size?: { width: number; height: number };
  quality?: number; // PNG圧縮品質
}

class ThumbnailGenerator {
  constructor(private geminiService: GeminiService);
  
  async analyze(project: KumikiProject): Promise<ThumbnailAnalysisResponse>;
  async generate(
    project: KumikiProject, 
    analysis: ThumbnailAnalysisResponse,
    options?: ThumbnailOptions
  ): Promise<Buffer>;
  async save(buffer: Buffer, outputPath: string): Promise<void>;
}
```

## 5. ファイル構成

```
src/
├── generators/
│   └── thumbnail/
│       ├── index.ts          # サムネイル生成メインロジック
│       ├── analyzer.ts       # Gemini API連携・分析ロジック
│       ├── composer.ts       # 画像合成ロジック
│       ├── templates.ts      # デザインテンプレート定義
│       └── extractor.ts      # シーン画像抽出ロジック
├── services/
│   └── gemini-thumbnail.ts   # Gemini APIサービス拡張
└── types/
    └── thumbnail.ts          # サムネイル関連の型定義
```

## 6. 実装順序

1. **Phase 1**: 基本的なサムネイル生成機能
   - シーン画像の抽出
   - シンプルなテキストオーバーレイ
   - 固定テンプレートでの生成

2. **Phase 2**: Gemini API統合
   - コンテンツ分析機能の実装
   - 動的なメッセージ生成
   - スタイル推奨機能

3. **Phase 3**: コマンド統合
   - previewコマンドへの統合
   - generateコマンドへの統合
   - オプション処理の実装

4. **Phase 4**: 高度な機能
   - 複数テンプレートのサポート
   - カスタムテンプレート機能
   - バッチ処理対応

## 7. エラーハンドリング

- Gemini APIエラー時はフォールバック処理
- 画像抽出失敗時はデフォルト背景を使用
- サムネイル生成失敗は警告として扱い、メイン処理は継続

## 8. パフォーマンス考慮事項

- サムネイル生成は非同期で実行
- キャッシュ機構の実装（同一プロジェクトの再生成を高速化）
- 画像処理の最適化（メモリ使用量の管理）

## 9. テスト要件

### 9.1 単体テスト
- Gemini API分析ロジックのテスト
- 画像合成処理のテスト
- テンプレート適用のテスト

### 9.2 統合テスト
- generateコマンドでのサムネイル生成確認
- previewコマンドでのサムネイル生成確認
- 各種エラーケースの処理確認

## 10. 将来的な拡張

- A/Bテスト用の複数サムネイル生成
- 動的サムネイル（GIFアニメーション）
- ソーシャルメディア別の最適化（Instagram、Twitter等）
- ユーザー定義のカスタムテンプレート
- サムネイルプレビュー機能

## 11. 依存関係

- Gemini API（コンテンツ分析）
- Puppeteer（HTML/CSSレンダリング）
- Sharp または Canvas（画像処理）
- 既存のシーン生成機能

