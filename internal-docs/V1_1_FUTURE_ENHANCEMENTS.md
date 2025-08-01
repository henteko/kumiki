# Kumiki 拡張機能開発状況

このドキュメントは、MVP完成後の機能拡張に関する開発状況とタスクリストです。

## ✅ 1. トランジション機能 (完了済み) 

**実装完了日: 2025-07-20**

### 1.1 トランジション基盤 ✅
- [x] TransitionService の実装 ✅
- [x] シーン間の中間フレーム生成 ✅ 
- [x] トランジション用の一時ファイル管理 ✅

### 1.2 各トランジションタイプの実装 ✅
- [x] **fade** - フェードトランジション ✅
  - [x] クロスフェード処理 ✅
  - [x] 持続時間の設定 ✅
  - [x] 音声のクロスフェード対応 ✅
- [x] **wipe** - ワイプトランジション ✅
  - [x] 方向指定（上下左右すべて対応） ✅
  - [x] FFmpeg xfadeフィルター使用 ✅
  - [x] left, right, up, down 方向対応 ✅
- [x] **dissolve** - ディゾルブトランジション ✅
  - [x] FFmpeg dissolveフィルター使用 ✅
  - [x] 持続時間の設定 ✅

### 1.3 トランジション統合 ✅
- [x] Rendererへのトランジション処理組み込み ✅
- [x] シーン結合時の自動適用 ✅
- [x] 逆順処理による正確なトランジション適用 ✅
- [x] 音声なし動画への対応 ✅
- [x] 動画時長の自動検出とオフセット計算 ✅

### 1.4 実装された機能詳細
- **TransitionService**: シングルトンパターンでトランジション処理を管理
- **FFmpegService拡張**: transition専用メソッド（fade/wipe/dissolve）追加
- **音声対応**: 音声ストリーム検出と適切なフィルター選択
- **エラーハンドリング**: 音声なし動画への適切な対応
- **テスト済み**: すべてのシーンタイプ（text/image/video）間でのトランジション

### 1.5 作成されたExample
- `transition-test.json`: 全トランジションタイプと方向のテスト
- `with-media.json`: 実際のメディアファイルを使用したトランジション
- `comprehensive-demo.json`: 包括的なデモンストレーション

## 2. 音声処理の拡張 (実装中)

### ✅ 2.1 音声フェードイン/アウト (完了済み)
**実装完了日: 2025-07-20**

- [x] **フェードイン/アウト** ✅
  - [x] BGMの自動フェードイン ✅
  - [x] BGMの自動フェードアウト ✅
  - [x] 動画時長に基づく自動タイミング計算 ✅
  - [x] FFmpeg afadeフィルターの活用 ✅
  - [x] スキーマのfadeIn/fadeOutフィールド対応 ✅

#### 2.1.1 実装詳細
- **FFmpegService拡張**: `addAudioWithFade()`メソッドを追加
- **afadeフィルター**: フェードイン（t=in）とフェードアウト（t=out）の適用
- **自動計算**: 動画時長からフェードアウト開始時刻を自動計算
- **後方互換性**: フェード値なしの場合は従来のaddAudioを使用

#### 2.1.2 作成されたExample
- `audio-fade-test.json`: フェードイン/アウトの基本テスト
- `audio-complete-demo.json`: トランジションと音声フェードの統合デモ

### 2.2 高度な音声機能 (未実装)
- [ ] **複数音声トラック**のサポート
  - [ ] 音声ミキシング
  - [ ] トラック別音量調整
- [ ] **シーン切り替え時の音声処理**
  - [ ] シーンごとの音声フェード
  - [ ] トランジション時の音声ブレンド
- [ ] **音声エフェクト**
  - [ ] エコー、リバーブ等の基本エフェクト
  - [ ] 音声フィルターの適用

### 2.3 音声同期 (未実装)
- [ ] シーンタイミングとの同期
- [ ] 音声遅延の調整

## 3. 新しいシーンタイプ (実装済み)

### ✅ 3.1 複合シーンタイプ (完了済み)
**実装完了日: 2025-07-20**

- [x] **composite** - 複数要素の組み合わせシーン ✅
  - [x] テキスト＋画像の重ね合わせ ✅
  - [x] レイヤー管理 ✅
  - [x] Z-index対応 ✅
  - [x] 透明度制御 (opacity) ✅
  - [x] CompositeSceneRenderer実装 ✅
  - [x] TypeSpec/Zodスキーマ対応 ✅

#### 3.1.1 実装詳細
- **レイヤーシステム**: TextLayerとImageLayerをサポート
- **Z-index順序処理**: レイヤーの重なり順序を正確に制御
- **透明度制御**: 各レイヤーの透明度を個別に設定可能
- **位置制御**: 各レイヤーの位置を精密に指定可能
- **背景対応**: gradient、color、imageの背景をサポート

#### 3.1.2 作成されたExample
- `composite-demo.json`: 複合シーンタイプの包括的デモ
  - タイトルシーン: 画像背景上にテキストオーバーレイ
  - オーバーレイデモ: 画像の上に半透明テキスト
  - クレジットシーン: グラデーション背景に複数テキストレイヤー

## 4. CLI改善 (低優先度)

### 4.1 使いやすさの向上
- [ ] インタラクティブモード
- [ ] プロジェクトテンプレート
- [ ] 設定ウィザード

### 4.2 追加コマンド
- [ ] `kumiki init` - プロジェクト初期化
- [ ] `kumiki template` - テンプレート管理
- [ ] `kumiki config` - 設定管理

## 5. ドキュメント (継続的)

### 5.1 ユーザードキュメント
- [ ] APIリファレンス（TypeDoc）
- [ ] ユーザーガイド（日本語/英語）
- [ ] サンプルプロジェクト集
- [ ] ビデオチュートリアル

### 5.2 サンプルとテンプレート
- [ ] 基本的なテキスト動画サンプル
- [ ] 画像スライドショーサンプル
- [ ] 複雑なアニメーションサンプル
- [ ] 業界別テンプレート（プレゼン、広告、教育等）

## 実装優先順位

1. **フェーズ1** ✅ **完了済み** (2025-07-20)
   - ✅ トランジション機能の実装

2. **フェーズ2** (一部完了)
   - ✅ 音声フェードイン/アウト (完了済み)
   - ✅ 複合シーンタイプ (完了済み)
   - 高度な音声機能 (未実装)

3. **フェーズ3** (継続的)
   - CLI改善
   - ドキュメント整備
   - サンプル作成

## v1.1 開発完了サマリー

### 実装済み機能
- ✅ **完全なトランジションシステム**: fade、wipe（4方向）、dissolve
- ✅ **音声フェードイン/アウト**: BGMの自動フェード効果
- ✅ **複合シーンタイプ**: テキストと画像のレイヤー式合成
- ✅ **クロスプラットフォーム対応**: 音声ありなし両方の動画に対応
- ✅ **全シーンタイプ対応**: text、image、video、composite間のシームレストランジション
- ✅ **高品質レンダリング**: FFmpeg xfade/afadeフィルターによる品質保証
- ✅ **包括的テスト**: 複数のexampleファイルによる動作検証

### 技術的成果
- TypeSpec スキーマへのTransition/CompositeScene/Layerモデル統合
- TransitionService の設計と実装
- CompositeSceneRenderer の実装
- FFmpegService の拡張（音声検出、時長検出、フェード処理）
- Renderer への逆順トランジション処理統合
- 音声フェードイン/アウトの自動タイミング計算
- レイヤーシステムとZ-index管理
- 完全なエラーハンドリングと堅牢性

### 次回開発推奨事項
1. **複数音声トラック**: 音声ミキシング、トラック別音量調整
2. **音声エフェクト**: エコー、リバーブ等の基本エフェクト
3. **パフォーマンス最適化**: 大容量ファイル処理の改善
4. **動的コンテンツ**: データバインディング、テンプレート機能
5. **高度なレイヤー機能**: ビデオレイヤー、エフェクトレイヤー

## 技術的考慮事項

### 依存関係
- トランジション: FFmpegのトランジションフィルター機能
- 音声処理: FFmpegの音声フィルター活用

### 互換性
- 既存APIとの後方互換性維持
- 段階的な機能追加によるスムーズな移行
- TypeSpecスキーマの適切な拡張

### 実装方針
- 各機能は独立したモジュールとして実装
- 既存コードへの影響を最小限に抑制
- 設定はオプショナルとし、デフォルト動作を保証