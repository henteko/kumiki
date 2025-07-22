# Kumiki ナレーション自動音声化機能

このドキュメントは、Kumikiに追加予定のナレーション自動音声化機能の仕様と実装計画を記載しています。

## 機能概要

ナレーション自動音声化機能は、各シーンに記載されたテキストを Google Gemini API の Text-to-Speech (TTS) 機能を使用して音声化し、動画に自動的に追加する機能です。これにより、説明動画やプレゼンテーション動画の制作が大幅に効率化されます。

## 主な特徴

### 1. シーンレベルでのナレーション管理
- 各シーンに独立したナレーションを設定可能
- シーンごとに異なる音声設定（声質、速度、ピッチ）を適用可能
- 複数言語のサポート

### 2. Google Gemini API との統合
- Gemini 2.5 Flash/Pro の TTS 機能を活用（@google/genai v1.10.0）
- 24言語、30以上の音声バリエーションをサポート
- 単一話者・複数話者の音声生成に対応
- 自然な音声イントネーションと感情表現

### 3. タイミング制御
- シーンの duration に合わせた音声速度の自動調整
- 音声の開始/終了タイミングの細かな制御
- 既存の BGM との音量バランス調整

## JSON スキーマ設計

### シーンレベルのナレーション定義

```json
{
  "scenes": [
    {
      "id": "scene1",
      "type": "text",
      "duration": 5,
      "content": {
        "text": "Welcome to Kumiki",
        "fontSize": 48
      },
      "narration": {
        "text": "クミキへようこそ。この動画生成ツールで素晴らしい動画を作成しましょう。",
        "voice": {
          "languageCode": "ja-JP",
          "name": "ja-JP-Neural2-B",
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
  ]
}
```

### ナレーション設定の詳細

#### narration オブジェクト
- `text` (string, required): 音声化するテキスト
- `voice` (object, optional): 音声設定
- `timing` (object, optional): タイミング設定

#### voice オブジェクト
- `languageCode` (string): 言語コード（例: "ja-JP", "en-US"）- 24言語対応
- `name` (string): 音声名（例: "Kore", "Puck", "Leda"）- 30以上の音声から選択
- `speakingRate` (number): 話速（0.25-4.0、デフォルト: 1.0）
- `pitch` (number): ピッチ（-20.0-20.0、デフォルト: 0）
- `volumeGainDb` (number): 音量ゲイン（-96.0-16.0、デフォルト: 0）

#### timing オブジェクト
- `delay` (number): ナレーション開始の遅延時間（秒）
- `fadeIn` (number): フェードイン時間（秒）
- `fadeOut` (number): フェードアウト時間（秒）

### プロジェクトレベルのデフォルト設定

```json
{
  "project": {
    "name": "説明動画",
    "version": "1.0.0",
    "settings": {
      "resolution": { "width": 1920, "height": 1080 },
      "fps": 30,
      "narrationDefaults": {
        "voice": {
          "languageCode": "ja-JP",
          "name": "ja-JP-Neural2-C",
          "speakingRate": 1.0
        },
        "volumeMix": {
          "narration": 0.8,
          "bgm": 0.3
        }
      }
    }
  }
}
```

## 実装計画

### フェーズ1: 基本実装

#### 1.1 Gemini API 統合
- [ ] Gemini TTS API クライアントの実装
- [ ] 音声生成サービス（GeminiTTSService）の作成
- [ ] API キー管理と環境変数設定
- [ ] エラーハンドリングとリトライ機構

#### 1.2 スキーマ拡張
- [ ] TypeSpec モデルへの narration フィールド追加
- [ ] Zod バリデーションスキーマの更新
- [ ] 型定義の更新

#### 1.3 音声生成パイプライン
- [ ] ナレーションテキストの抽出
- [ ] 音声ファイルの生成とキャッシング
- [ ] シーンごとの音声ファイル管理

### フェーズ2: 音声統合

#### 2.1 音声ミキシング
- [ ] ナレーション音声と BGM の合成
- [ ] 音量バランスの自動調整
- [ ] FFmpeg による音声トラック統合

#### 2.2 タイミング制御
- [ ] シーン duration に基づく音声速度調整
- [ ] 遅延とフェード効果の適用
- [ ] 音声とビジュアルの同期

### フェーズ3: 高度な機能

#### 3.1 複数話者対応
- [ ] シーンごとに異なる話者の設定
- [ ] 会話形式のナレーション対応

#### 3.2 感情表現
- [ ] SSML (Speech Synthesis Markup Language) サポート
- [ ] 強調、ポーズ、感情表現の制御

#### 3.3 字幕生成
- [ ] ナレーションテキストから字幕の自動生成
- [ ] タイミング同期された字幕ファイル出力

## 技術的考慮事項

### 1. パフォーマンス
- 音声生成のキャッシング機構
- 並列処理による高速化
- プログレッシブ生成（シーンごとの逐次処理）

### 2. エラーハンドリング
- API レート制限への対応
- ネットワークエラーのリトライ
- 音声生成失敗時のフォールバック

### 3. 互換性
- 既存の音声処理との統合
- BGM フェード機能との連携
- トランジション時の音声継続性

### 4. 品質管理
- 音声品質の検証
- 音量レベルの正規化
- ノイズ除去とクリーンアップ

## 使用例

### 例1: 製品紹介動画

```json
{
  "scenes": [
    {
      "id": "intro",
      "type": "composite",
      "duration": 8,
      "layers": [
        {
          "type": "image",
          "content": { "source": "product.jpg" }
        },
        {
          "type": "text",
          "content": { "text": "革新的な新製品" }
        }
      ],
      "narration": {
        "text": "私たちの新製品は、従来の常識を覆す革新的な機能を搭載しています。",
        "timing": { "delay": 1.0 }
      }
    }
  ]
}
```

### 例2: 教育コンテンツ

```json
{
  "scenes": [
    {
      "id": "lesson1",
      "type": "text",
      "duration": 10,
      "content": {
        "text": "第1章: 基礎知識"
      },
      "narration": {
        "text": "今日は基礎知識について学びます。まず最初に重要な概念を理解しましょう。",
        "voice": {
          "speakingRate": 0.9,
          "pitch": -2
        }
      }
    }
  ]
}
```

## API 使用量の見積もり

- 1分の音声: 約300-500文字（日本語）
- API コスト: Gemini API の料金体系に準拠
- 音声フォーマット: audio/L16;codec=pcm;rate=24000（変換が必要）
- キャッシング効果: 同一テキスト・設定での再生成を回避
- モデル: Gemini 2.5 Flash Preview（高速・低コスト）推奨

## セキュリティ考慮事項

1. **API キー管理**
   - 環境変数での管理
   - キーの暗号化保存
   - アクセス権限の制限

2. **コンテンツフィルタリング**
   - 不適切なコンテンツの検出
   - 音声生成前の内容検証

3. **プライバシー保護**
   - 生成音声の一時ファイル管理
   - ユーザーデータの適切な削除

## まとめ

ナレーション自動音声化機能により、Kumiki は単なる動画生成ツールから、完全な動画制作プラットフォームへと進化します。この機能により、以下のメリットが期待できます：

1. **制作効率の向上**: ナレーション録音の手間を削減
2. **品質の統一**: 一貫した音声品質の維持
3. **多言語対応**: 簡単な多言語コンテンツ制作
4. **柔軟性**: シーンごとの細かな音声制御

この機能は、教育コンテンツ、製品紹介、プレゼンテーションなど、幅広い用途での動画制作を強力にサポートします。

## 開発タスク一覧

### フェーズ1: 基盤実装（推定工数: 3-4日）

#### 1. TypeSpec/Zodスキーマ拡張
- [ ] `src/schemas/project.tsp` に Narration, Voice, NarrationTiming モデルを追加
- [ ] `src/schemas/project.schema.ts` の Zod スキーマを更新
- [ ] `src/types/index.ts` に型定義を追加
- [ ] プロジェクト設定に narrationDefaults を追加

#### 2. Gemini TTS API 統合
- [ ] `@google/genai` パッケージを使用（v1.10.0 インストール済み）
- [ ] `src/services/gemini-tts.ts` の新規作成
  - [ ] GeminiTTSService クラスの実装
  - [ ] generateSpeech メソッドの実装
    - [ ] モデル指定: "gemini-2.5-flash-preview-tts"
    - [ ] responseModalities: ["AUDIO"] の設定
    - [ ] VoiceConfig の実装（音声名、言語設定）
  - [ ] 音声データ変換処理（PCM → WAV/MP3）
  - [ ] エラーハンドリングとリトライロジック
- [ ] 環境変数 GEMINI_API_KEY の確認（既存）

#### 3. ナレーションキャッシュシステム
- [ ] `src/services/narration-cache.ts` の新規作成
- [ ] キャッシュキーの生成ロジック（テキスト+音声設定のハッシュ）
- [ ] キャッシュディレクトリの管理
- [ ] キャッシュヒット/ミスの判定

### フェーズ2: レンダリング統合（推定工数: 4-5日）

#### 4. ナレーション処理サービス
- [ ] `src/services/narration.ts` の新規作成
  - [ ] NarrationService クラスの実装
  - [ ] processSceneNarration メソッド（シーン単位の処理）
  - [ ] デフォルト設定のマージロジック
  - [ ] 音声ファイルの一時保存管理

#### 5. 各シーンレンダラーの拡張
- [ ] `src/renderers/base.ts` に narration 処理の基本メソッドを追加
- [ ] `src/renderers/text-scene.ts` の拡張
- [ ] `src/renderers/image-scene.ts` の拡張
- [ ] `src/renderers/video-scene.ts` の拡張
- [ ] `src/renderers/composite-scene.ts` の拡張

#### 6. FFmpeg 音声統合
- [ ] `src/services/ffmpeg.ts` に音声ミキシングメソッドを追加
  - [ ] addNarrationTrack メソッドの実装
  - [ ] 音声レベル調整（narration/BGM バランス）
  - [ ] タイミング制御（delay、fadeIn、fadeOut）
  - [ ] 複数音声トラックのマージ

### フェーズ3: 高度な機能実装（推定工数: 3-4日）

#### 7. タイミング最適化
- [ ] `src/services/narration-timing.ts` の新規作成
- [ ] 音声長とシーン duration の調整ロジック
- [ ] 話速の自動調整計算
- [ ] オーバーフロー時の警告機能

#### 8. レンダラー統合
- [ ] `src/renderer.ts` の拡張
  - [ ] ナレーション生成ステップの追加
  - [ ] 並列処理の最適化
  - [ ] プログレス表示の更新
- [ ] シーン結合時のナレーショントラック処理

#### 9. CLI コマンド拡張
- [ ] `src/commands/generate.ts` にナレーション関連オプション追加
  - [ ] --no-narration フラグ（ナレーション無効化）
  - [ ] --narration-cache-dir オプション
- [ ] プレビューモードでのナレーション対応

### フェーズ4: テストと品質保証（推定工数: 2-3日）

#### 10. サンプルファイル作成
- [ ] `examples/narration-basic.json` - 基本的なナレーション例
- [ ] `examples/narration-advanced.json` - 高度な設定例
- [ ] `examples/narration-multilingual.json` - 多言語対応例

#### 11. エラーハンドリング強化
- [ ] Gemini API エラーの適切な処理
- [ ] 音声生成失敗時のフォールバック
- [ ] ユーザーへの分かりやすいエラーメッセージ

#### 12. ドキュメント更新
- [ ] README.md にナレーション機能の説明を追加
- [ ] 環境変数の説明更新
- [ ] トラブルシューティングガイド

### フェーズ5: 最適化と拡張（オプション）

#### 13. パフォーマンス最適化
- [ ] 並列音声生成の実装
- [ ] ストリーミング処理の検討
- [ ] メモリ使用量の最適化

#### 14. 高度な機能
- [ ] SSML サポートの追加
- [ ] 字幕ファイル（SRT/VTT）の自動生成
- [ ] 音声認識による同期精度向上

### 実装順序の推奨

1. **スキーマ定義から開始**（タスク1）- 全体の基盤となるため最優先
2. **Gemini TTS 統合**（タスク2-3）- API 接続の確立
3. **基本的な音声生成**（タスク4）- シンプルなケースから実装
4. **FFmpeg 統合**（タスク6）- 音声の動画への組み込み
5. **各レンダラーの拡張**（タスク5）- 段階的に対応
6. **高度な機能**（タスク7-14）- 基本機能の完成後に実装

### 開発時の注意事項

- 各タスク完了後は必ず `npm run lint` と `npm run typecheck` を実行
- 新機能追加時は examples/ にサンプルファイルを作成
- エラーメッセージはユーザーフレンドリーに
- 既存機能との後方互換性を維持（narration フィールドはオプショナル）