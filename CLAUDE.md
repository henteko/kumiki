# CLAUDE.md - Kumiki開発ルール

## 開発の基本原則

### 1. コード品質の維持

#### 必須: Lintチェック
- **すべてのコード変更後、必ずlintを実行する**
- コマンド: `npm run lint`
- Lintエラーがある状態でのコミットは禁止
- 自動修正可能な場合: `npm run lint:fix`

#### 必須: TypeScriptの型チェック
- コマンド: `npm run typecheck`
- 型エラーがある状態での実装完了は禁止

### 2. 動作確認の徹底

#### 必須: 影響を受けたコマンドの動作確認
- コード変更後、関連するCLIコマンドを必ず実行して動作を確認
- 例：
  - `validate.ts`を変更 → `npm run dev -- validate examples/sample.json`
  - `preview.ts`を変更 → `npm run dev -- preview examples/sample.json`
  - `generate.ts`を変更 → `npm run dev -- generate examples/sample.json`

#### 動作確認チェックリスト
- [ ] 正常系: 期待通りの動作をするか
- [ ] 異常系: エラーメッセージが適切か
- [ ] 既存機能への影響: 他のコマンドが正常に動作するか

### 3. 開発フロー

1. **実装前**
   - 関連ファイルの現状を`Read`で確認
   - 既存のコード規約やパターンを理解

2. **実装中**
   - 小さな変更ごとにlintを実行
   - TypeScriptの型エラーをこまめに解消

3. **実装後**
   - `npm run lint` で最終チェック
   - `npm run typecheck` で型チェック
   - 影響を受けたコマンドの動作確認
   - 必要に応じてサンプルファイルで検証

### 4. コード規約

#### インポート順序
```typescript
// 1. Node.js標準モジュール
import fs from 'node:fs';
import path from 'node:path';

// 2. 外部ライブラリ
import { Command } from 'commander';
import winston from 'winston';

// 3. 内部モジュール（絶対パス）
import { KumikiProject } from '@/types';
import { logger } from '@/utils/logger';

// 4. 相対パス
import { validateScene } from './validator';
```

#### エラーハンドリング
```typescript
// カスタムエラーを使用
throw new ValidationError('Invalid scene type', 'INVALID_SCENE_TYPE', {
  sceneId: scene.id,
  type: scene.type
});
```

#### ログ出力
```typescript
// 構造化ログを使用
logger.info('Processing scene', { sceneId: scene.id, type: scene.type });
logger.error('Failed to render', { error, sceneId: scene.id });
```

### 5. ファイル構成

#### 各モジュールの責務を明確に
- 1ファイル1責務
- exportは必要最小限
- インターフェースと実装を分離

#### 命名規則
- ファイル名: kebab-case (`scene-factory.ts`)
- クラス名: PascalCase (`SceneFactory`)
- 関数名: camelCase (`renderScene`)
- 定数: UPPER_SNAKE_CASE (`MAX_DURATION`)

### 6. コミット前チェックリスト

- [ ] `npm run lint` がパスする
- [ ] `npm run typecheck` がパスする
- [ ] 変更したコマンドの動作確認完了
- [ ] 不要なconsole.logやデバッグコードを削除
- [ ] エラーメッセージがユーザーフレンドリー

### 7. 推奨事項（必須ではない）

#### テスト
- 複雑なロジックにはテストを書くことを推奨
- ただし、MVPフェーズでは必須ではない

#### ドキュメント
- 複雑な処理にはコメントを追加
- publicなAPIにはJSDocコメントを推奨

### 8. 禁止事項

- [ ] Lintエラーを無視するコメント（`// eslint-disable`）の濫用
- [ ] `any`型の使用（やむを得ない場合は理由をコメント）
- [ ] エラーの握りつぶし（catch節で何もしない）
- [ ] ハードコードされたパス（環境依存を避ける）

## 開発環境のセットアップ

```bash
# 依存関係のインストール
npm install

# 開発モードでの実行
npm run dev -- validate examples/sample.json

# Lintの実行
npm run lint
npm run lint:fix

# 型チェック
npm run typecheck
```

## トラブルシューティング

### Lintエラーが解決できない場合
1. `npm run lint:fix` で自動修正を試す
2. エラーメッセージを読んで手動で修正
3. 本当に必要な場合のみ、理由を明記して無効化

### 型エラーが解決できない場合
1. 型定義が正しいか確認
2. `tsconfig.json`の設定を確認
3. 必要に応じて型アサーションを使用（ただし最小限に）

---

このルールに従って開発を進めることで、品質の高いコードベースを維持します。