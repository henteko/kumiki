# GitHub Issue #1: ナレーション音声ファイルのキャッシュ管理問題

## 問題の概要

**Issue番号**: #1  
**タイトル**: narrationで生成した音声ファイルがcacheコマンドで管理できていない  
**報告者**: henteko  
**状態**: OPEN  

### 問題の詳細
現在、Kumikiプロジェクトでは画像（images）と音楽（music）のキャッシュは`cache`コマンドで管理できるが、ナレーション機能で生成された音声ファイル（.wavファイル）はキャッシュコマンドの対象になっていない。

## 現状の分析

### 1. 既存のキャッシュシステム

#### 管理対象のキャッシュ
- **画像キャッシュ** (`ImageCache`): Geminiで生成された画像
- **音楽キャッシュ** (`MusicCache`): 生成されたBGM

#### キャッシュコマンドの機能
```bash
# キャッシュの状態確認
kumiki cache status [--type <all|images|music>]

# キャッシュのクリア
kumiki cache clear [--type <all|images|music>] [--older-than <days>]

# キャッシュサイズの確認
kumiki cache size [--type <all|images|music>]
```

### 2. ナレーションキャッシュの実装状況

#### NarrationCacheServiceの現在の実装
- **ファイル**: `src/services/narration-cache.ts`
- **機能**:
  - テキストと音声設定をキーとしたキャッシュの保存・取得
  - SHA256ハッシュによるキャッシュキーの生成
  - `.wav`ファイルの管理
  - 基本的な統計情報の取得（`getCacheStats()`）

#### 使用状況
- `NarrationService`内で使用されており、同じテキストと音声設定の組み合わせに対して音声を再生成しないよう最適化されている
- ただし、CLIコマンドからは管理できない状態

### 3. 問題点の整理

1. **ユーザビリティの問題**
   - ナレーションキャッシュが蓄積されても、ユーザーが確認・管理する手段がない
   - ディスク容量を圧迫する可能性がある

2. **一貫性の欠如**
   - 他のキャッシュタイプ（画像、音楽）は管理可能だが、ナレーションだけ管理できない
   - ユーザー体験の一貫性が損なわれている

3. **実装の不完全性**
   - `NarrationCacheService`は存在するが、他のキャッシュサービスと比べてインターフェースが統一されていない

### 4. 既存キャッシュサービスのインターフェース分析

現在の各キャッシュサービスのインターフェース状況：

| メソッド | ImageCache | MusicCache | NarrationCache | 備考 |
|---------|------------|------------|----------------|------|
| `initialize()` | ✅ | ✅ | ❌ (要追加) | キャッシュディレクトリの初期化 |
| `get()` | ✅ | ✅ | ✅ | キャッシュからアイテムを取得 |
| `save()/set()` | ✅ | ✅ | ✅ (set) | キャッシュにアイテムを保存 |
| `clear()` | ✅ | ✅ | ✅ | キャッシュをクリア |
| `getStats()` | ❌ | ✅ | ✅ (getCacheStats) | 基本統計情報の取得 |
| `getStatus()` | ✅ | ❌ | ❌ (要追加) | 詳細なステータス情報の取得 |
| `getSize()` | ✅ | ❌ | ❌ | キャッシュサイズの取得 |

**観察事項**：
- `ImageCache`は最も包括的なインターフェースを持つ
- `MusicCache`は`getStats()`のみ実装し、`cache.ts`側で追加処理を行っている
- `NarrationCache`は基本機能はあるが、CLIとの統合に必要なメソッドが不足

## 解決策の詳細設計

### 1. `src/commands/cache.ts`の修正

#### 必要な変更点

```typescript
// インポートの追加
import { narrationCacheService } from '@/services/narration-cache.js';

// オプションの拡張
// --type オプションに 'narration' を追加
.option('--type <type>', 'Cache type to show (all, images, music, narration)', 'all')
```

#### 各サブコマンドへの統合

**1. status サブコマンド**
```typescript
const showNarration = options.type === 'all' || options.type === 'narration';

if (showNarration) {
  await narrationCacheService.initialize();
  const narrationStatus = await narrationCacheService.getStatus();
  
  logger.info('\nNarration Cache Status:');
  logger.info(`Total files: ${narrationStatus.totalFiles}`);
  logger.info(`Total size: ${formatBytes(narrationStatus.totalSize)}`);
  
  if (narrationStatus.oldestEntry) {
    logger.info(`Oldest entry: ${narrationStatus.oldestEntry.toLocaleString()}`);
  }
  if (narrationStatus.newestEntry) {
    logger.info(`Newest entry: ${narrationStatus.newestEntry.toLocaleString()}`);
  }
}
```

**2. clear サブコマンド**
```typescript
const clearNarration = options.type === 'all' || options.type === 'narration';

if (clearNarration) {
  await narrationCacheService.initialize();
  const clearedCount = await narrationCacheService.clear(clearOptions);
  logger.info(`Narration cache cleared (${clearedCount} files)`);
  totalCleared++;
}
```

**3. size サブコマンド**
```typescript
const showNarration = options.type === 'all' || options.type === 'narration';

if (showNarration) {
  await narrationCacheService.initialize();
  const narrationStats = await narrationCacheService.getStats();
  logger.info(`\nNarration cache size: ${formatBytes(narrationStats.totalSize)}`);
  logger.info(`Narration file count: ${narrationStats.totalFiles}`);
  totalSize += narrationStats.totalSize;
  totalFiles += narrationStats.totalFiles;
}
```

### 2. `src/services/narration-cache.ts`の拡張

#### 追加が必要なメソッド

**1. initialize()メソッド**
```typescript
private initialized = false;

async initialize(): Promise<void> {
  if (this.initialized) return;
  await this.ensureCacheDir();
  this.initialized = true;
}
```

**2. getStatus()メソッド**

**注**: `ImageCacheService`には既に`getStatus()`メソッドが実装されており、キャッシュの統計情報と最古・最新エントリの日時を返します。`MusicCacheService`には`getStats()`のみがあり、`cache.ts`側で追加の処理を行っています。

今回の実装では、`NarrationCacheService`に`ImageCacheService`と同様の`getStatus()`メソッドを実装し、インターフェースの一貫性を高めます。これにより、`cache.ts`のロジックがよりシンプルになります。

```typescript
async getStatus(): Promise<{
  totalFiles: number;
  totalSize: number;
  oldestEntry?: Date;
  newestEntry?: Date;
}> {
  const stats = await this.getStats();
  
  if (stats.totalFiles === 0) {
    return {
      totalFiles: 0,
      totalSize: 0
    };
  }

  // ファイルの作成日時を取得して最古・最新を判定
  const files = await fs.readdir(this.cacheDir);
  let oldestTime: number | null = null;
  let newestTime: number | null = null;

  for (const file of files) {
    if (file.endsWith('.wav')) {
      const filePath = path.join(this.cacheDir, file);
      const fileStat = await fs.stat(filePath);
      const time = fileStat.mtimeMs;
      
      if (oldestTime === null || time < oldestTime) {
        oldestTime = time;
      }
      if (newestTime === null || time > newestTime) {
        newestTime = time;
      }
    }
  }

  return {
    totalFiles: stats.totalFiles,
    totalSize: stats.totalSize,
    oldestEntry: oldestTime ? new Date(oldestTime) : undefined,
    newestEntry: newestTime ? new Date(newestTime) : undefined
  };
}
```

**将来的な改善提案**: `MusicCacheService`にも`getStatus()`メソッドを実装することで、3つのキャッシュサービスのインターフェースを完全に統一し、`cache.ts`のコードをさらに簡潔にすることができます。

**3. clear()メソッドの拡張**
```typescript
async clear(options?: { olderThan?: number }): Promise<number> {
  try {
    const files = await fs.readdir(this.cacheDir);
    let clearedCount = 0;
    
    for (const file of files) {
      if (file.endsWith('.wav')) {
        const filePath = path.join(this.cacheDir, file);
        
        if (options?.olderThan) {
          const stats = await fs.stat(filePath);
          const age = Date.now() - stats.mtimeMs;
          
          if (age > options.olderThan) {
            await fs.unlink(filePath);
            clearedCount++;
          }
        } else {
          await fs.unlink(filePath);
          clearedCount++;
        }
      }
    }
    
    logger.info(`Narration cache cleared: ${clearedCount} files`);
    return clearedCount;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
    return 0;
  }
}
```

**4. getStats()メソッド（getCacheStats()のリネーム）**
```typescript
async getStats(): Promise<{ totalFiles: number; totalSize: number }> {
  try {
    const files = await fs.readdir(this.cacheDir);
    let totalSize = 0;
    let totalFiles = 0;
    
    for (const file of files) {
      if (file.endsWith('.wav')) {
        const filePath = path.join(this.cacheDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;
        totalFiles++;
      }
    }
    
    return { totalFiles, totalSize };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { totalFiles: 0, totalSize: 0 };
    }
    throw error;
  }
}
```

### 3. 実装の優先順位

1. **Phase 1**: 基本機能の実装
   - `NarrationCacheService`の拡張
   - `cache`コマンドへの統合

2. **Phase 2**: テストと検証
   - 各コマンドの動作確認
   - エラーハンドリングの確認

3. **Phase 3**: ドキュメント更新
   - READMEへの機能追加の記載
   - コマンドヘルプの更新

## テスト計画

### 1. 単体テスト

#### NarrationCacheServiceのテスト
- `initialize()`が正しくディレクトリを作成するか
- `getStatus()`が正確な統計情報を返すか
- `clear()`が指定された条件でファイルを削除するか
- `getStats()`が正しいファイル数とサイズを返すか

### 2. 統合テスト

#### CLIコマンドのテスト

```bash
# 1. ナレーション付きプロジェクトを生成
# 実際に存在するサンプルファイルを使用
npm run dev -- generate examples/narration-basic.json
# または、より高度な機能をテストする場合
npm run dev -- generate examples/narration-advanced.json

# 2. キャッシュ状態の確認
npm run dev -- cache status --type narration
# 期待: ナレーションキャッシュのファイル数とサイズが表示される

# 3. 全体のキャッシュ状態確認
npm run dev -- cache status --type all
# 期待: 画像、音楽、ナレーションすべてのキャッシュ情報が表示される

# 4. キャッシュサイズの確認
npm run dev -- cache size --type narration
# 期待: ナレーションキャッシュのサイズとファイル数が表示される

# 5. 古いキャッシュのクリア
npm run dev -- cache clear --type narration --older-than 7
# 期待: 7日以上古いナレーションキャッシュが削除される

# 6. すべてのナレーションキャッシュをクリア
npm run dev -- cache clear --type narration
# 期待: すべてのナレーションキャッシュが削除される
```

### 3. 品質保証チェックリスト

- [ ] `npm run lint`がエラーなく完了する
- [ ] `npm run typecheck`がエラーなく完了する
- [ ] 各キャッシュタイプ（images, music, narration）が独立して管理できる
- [ ] `--type all`オプションですべてのキャッシュが一括管理できる
- [ ] エラーハンドリングが適切に実装されている
- [ ] ログメッセージが適切で一貫性がある

## 実装のメリット

1. **ユーザビリティの向上**
   - すべての生成コンテンツのキャッシュを統一的に管理可能
   - ディスク容量の管理が容易に

2. **開発効率の向上**
   - キャッシュの状態を可視化できることで、デバッグが容易に
   - 不要なキャッシュを定期的にクリアできる

3. **システムの一貫性**
   - すべてのキャッシュサービスが同じインターフェースを持つ
   - 将来的な拡張が容易

## 今後の拡張可能性

1. **キャッシュの自動管理**
   - 一定期間使用されていないキャッシュの自動削除
   - キャッシュサイズの上限設定

2. **キャッシュの最適化**
   - 音声ファイルの圧縮（WAV → MP3変換）
   - 使用頻度に基づいたキャッシュの優先度管理

3. **統計情報の拡張**
   - キャッシュヒット率の表示
   - プロジェクトごとのキャッシュ使用状況

## まとめ

GitHub Issue #1の解決により、Kumikiプロジェクトのキャッシュ管理システムが完全なものとなり、ユーザーはすべての生成コンテンツ（画像、音楽、ナレーション）を統一的に管理できるようになる。この実装は既存のアーキテクチャと一貫性を保ちながら、最小限の変更で最大の効果を得られる設計となっている。