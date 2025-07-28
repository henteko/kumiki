# 字幕生成機能 要件定義書

## 1. 機能概要

Kumikiプロジェクトにおいて、動画コンテンツに対する字幕を自動生成し、WebVTT形式で出力する機能を実装する。

## 2. 機能要件

### 2.1 基本要件

- **字幕形式**: WebVTT (Web Video Text Tracks) 形式で出力
- **文字エンコーディング**: UTF-8
- **タイムスタンプ精度**: ミリ秒単位

### 2.2 生成方法

#### 2.2.1 generateコマンドでの自動生成
- `kumiki generate`実行時に、MP4ファイルと同じディレクトリに`.vtt`ファイルを自動生成
- ファイル名規則: `{動画ファイル名}.vtt`
  - 例: `output.mp4` → `output.vtt`

#### 2.2.2 subtitleコマンドでの個別生成
- 新規コマンド `kumiki subtitle` を追加
- プロジェクトファイル（JSON）から字幕のみを生成
- コマンド例:
  ```bash
  kumiki subtitle project.json
  kumiki subtitle project.json --output custom-subtitles.vtt
  ```

### 2.3 字幕の内容

#### 2.3.1 データソース
- プロジェクトファイル内のテキストコンテンツから字幕を生成
  - シーン内のテキスト要素
  - ナレーション情報
  - 説明文

#### 2.3.2 タイミング制御
- 各シーンの表示時間に基づいて字幕の表示タイミングを決定
- シーン遷移時の字幕切り替え
- 適切な表示時間の確保（最小表示時間: 1秒）

## 3. 技術要件

### 3.1 WebVTTファイル仕様

```vtt
WEBVTT

00:00.000 --> 00:03.000
最初の字幕テキスト

00:03.000 --> 00:06.000
次の字幕テキスト
```

### 3.2 実装上の考慮事項

- 改行処理: 長いテキストの適切な改行
- 文字数制限: 1行あたり最大40文字（日本語）
- 行数制限: 1つの字幕あたり最大2行

### 3.3 エラーハンドリング

- プロジェクトファイルにテキストコンテンツがない場合の処理
- 生成失敗時の適切なエラーメッセージ出力

## 4. インターフェース仕様

### 4.1 コマンドラインインターフェース

#### generateコマンド拡張
```bash
kumiki generate project.json [options]
  --no-subtitles    字幕生成をスキップ
```

#### subtitleコマンド
```bash
kumiki subtitle <project.json> [options]
  -o, --output <path>     出力ファイルパス（デフォルト: {プロジェクト名}.vtt）
```

### 4.2 プログラマティックインターフェース

```typescript
interface SubtitleOptions {
  maxLineLength?: number;
  maxLines?: number;
  minDuration?: number;
}

class SubtitleGenerator {
  generate(project: KumikiProject, options?: SubtitleOptions): string;
  save(content: string, outputPath: string): Promise<void>;
}
```

## 5. ファイル構成

```
src/
├── commands/
│   └── subtitle.ts       # subtitleコマンドの実装
├── generators/
│   └── subtitle/
│       ├── index.ts      # 字幕生成メインロジック
│       ├── webvtt.ts     # WebVTT形式の出力処理
│       └── timing.ts     # タイミング計算ロジック
└── types/
    └── subtitle.ts       # 字幕関連の型定義
```

## 6. 実装順序

1. **Phase 1**: 基本的なWebVTT生成機能
   - WebVTTフォーマッタの実装
   - シンプルなタイミング計算

2. **Phase 2**: subtitleコマンドの実装
   - 独立したコマンドとしての実装
   - 柔軟なオプション対応

3. **Phase 3**: generateコマンドへの統合
   - 既存のgenerateフローへの組み込み
   - オプション処理の実装

## 7. テスト要件

### 7.1 単体テスト
- WebVTTフォーマットの妥当性検証
- タイミング計算の正確性
- エッジケースの処理

### 7.2 統合テスト
- generateコマンドでの字幕生成確認
- subtitleコマンドの動作確認
- 生成されたVTTファイルのプレイヤーでの再生確認

## 8. 将来的な拡張

- 多言語字幕対応
- 字幕スタイリング（WebVTTのスタイル機能）
- 音声認識との連携（将来的な音声コンテンツ対応）

## 9. 参考資料

- [WebVTT: The Web Video Text Tracks Format](https://www.w3.org/TR/webvtt1/)
- [MDN: WebVTT](https://developer.mozilla.org/en-US/docs/Web/API/WebVTT_API)