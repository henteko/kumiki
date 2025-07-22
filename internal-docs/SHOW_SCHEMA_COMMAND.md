# Kumiki show-schema コマンド仕様書

このドキュメントは、Kumikiプロジェクトに追加する `show-schema` コマンドの仕様と実装計画を記載しています。

**実装状況: 🔴 未実装**

## 概要

`show-schema` コマンドは、KumikiプロジェクトのJSON Schema形式の構造を標準出力に表示するコマンドです。このコマンドにより、Claude CodeやGemini CLIなどのAIツールがKumikiのプロジェクト構造を理解し、有効なプロジェクトJSONファイルを生成できるようになります。

## 目的

1. **AI支援開発の促進**: AIツールがKumikiプロジェクトの構造を正確に理解できるようにする
2. **ドキュメンテーション**: 開発者がプロジェクト構造を素早く確認できる
3. **検証ツール**: 外部ツールがスキーマを使用してJSONファイルを検証できる
4. **自動生成**: AIツールが有効なプロジェクトファイルを自動生成できる

## コマンド仕様

### 基本使用方法

```bash
kumiki show-schema [options]
```

### オプション

- `--include-examples`: 各フィールドの使用例を含める（オプション）

### 出力例

```bash
$ kumiki show-schema
```

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "title": "KumikiProject",
  "type": "object",
  "required": ["version", "name", "settings", "scenes"],
  "properties": {
    "version": {
      "type": "string",
      "description": "プロジェクトファイルのバージョン",
      "example": "1.0.0"
    },
    "name": {
      "type": "string",
      "description": "プロジェクト名",
      "example": "My Awesome Video"
    },
    "settings": {
      "type": "object",
      "description": "プロジェクト全体の設定",
      "required": ["resolution", "fps"],
      "properties": {
        "resolution": {
          "type": "string",
          "pattern": "^\\d+x\\d+$",
          "description": "動画の解像度",
          "example": "1920x1080"
        },
        "fps": {
          "type": "number",
          "minimum": 1,
          "maximum": 120,
          "description": "フレームレート",
          "example": 30
        },
        "narrationDefaults": {
          "$ref": "#/definitions/narrationDefaults"
        }
      }
    },
    "scenes": {
      "type": "array",
      "minItems": 1,
      "description": "シーンの配列",
      "items": {
        "$ref": "#/definitions/scene"
      }
    },
    "audio": {
      "$ref": "#/definitions/audioSettings"
    }
  },
  "definitions": {
    // ... 各種定義
  }
}
```

## 実装計画

### 基本実装

1. **コマンドの追加**
   - `src/commands/show-schema.ts` の作成
   - Commander.jsへのコマンド登録

2. **スキーマ生成ロジック**
   - TypeSpecから生成されたZodスキーマを活用
   - zod-to-json-schemaライブラリを使用してJSON Schemaに変換

3. **オプション機能**
   - `--include-examples` オプションの実装
   - 使用例をスキーマに含める機能

## AI連携のベストプラクティス

### Claude Codeでの使用例

```bash
# スキーマを理解させる
kumiki show-schema --include-examples > schema.json

# Claude Codeへの指示例
"Please create a Kumiki project JSON file for a 30-second product introduction video 
with 3 scenes using the schema from schema.json"
```

### Gemini CLIでの使用例

```bash
# スキーマを取得
kumiki show-schema > kumiki-schema.json

# Gemini CLIへの指示例
"Generate a Kumiki project configuration following the JSON Schema in kumiki-schema.json"
```

## 技術的実装詳細

### 1. スキーマソース

- 既存のTypeSpecモデル（`src/schemas/kumiki.tsp`）を基準とする
- 生成されたZodスキーマ（`src/schemas/generated/`）を活用
- zod-to-json-schemaライブラリを使用してJSON Schemaに変換

### 2. 使用例の追加

`--include-examples` オプションが指定された場合、各プロパティに `examples` フィールドを追加：

```json
{
  "properties": {
    "version": {
      "type": "string",
      "description": "プロジェクトファイルのバージョン",
      "examples": ["1.0.0"]
    },
    "settings": {
      "type": "object",
      "description": "プロジェクト全体の設定",
      "examples": [
        {
          "resolution": "1920x1080",
          "fps": 30
        }
      ]
    }
  }
}
```

## 期待される効果

1. **開発効率の向上**
   - AIツールによる正確なコード生成
   - プロジェクトファイルの自動作成

2. **学習曲線の緩和**
   - 新規ユーザーがスキーマを理解しやすい
   - インタラクティブな探索が可能

3. **エコシステムの拡大**
   - サードパーティツールの開発促進
   - プラグインやエクステンションの作成容易化

4. **品質向上**
   - スキーマベースの検証
   - 型安全性の確保

## 実装タスク

- [ ] Commander.jsへの `show-schema` コマンド追加
- [ ] 基本的なJSON Schema出力機能の実装
- [ ] zod-to-json-schemaライブラリの統合
- [ ] `--include-examples` オプションの実装
- [ ] エラーハンドリングとヘルプメッセージ

## 使用例集

### 1. 基本的な使用

```bash
# JSON Schemaを表示
kumiki show-schema

# 使用例付きで表示
kumiki show-schema --include-examples

# ファイルに保存
kumiki show-schema > kumiki-schema.json
```

### 2. AI開発での活用

```bash
# Claude Codeに理解させる
kumiki show-schema --include-examples | pbcopy
# クリップボードの内容をClaude Codeに貼り付け

# スクリプトで活用
#!/bin/bash
SCHEMA=$(kumiki show-schema)
echo "Create a Kumiki project with this schema: $SCHEMA" | ai-cli
```

### 3. 検証ツールとの連携

```bash
# ajvでの検証
kumiki show-schema > schema.json
ajv validate -s schema.json -d my-project.json

# Node.jsスクリプトでの活用
const schema = JSON.parse(execSync('kumiki show-schema').toString());
// スキーマを使った検証処理
```

## まとめ

`show-schema` コマンドは、KumikiプロジェクトのJSON Schema形式の構造を提供することで、AI支援開発を大幅に改善します。このコマンドにより、開発者とAIツールの両方がプロジェクト構造を正確に理解し、効率的に作業できるようになります。

シンプルな実装により、JSON Schema形式での出力に特化し、オプションで使用例を含めることができます。