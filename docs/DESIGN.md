# WebTable Enhancer — 設計書

## 概要

WebTable Enhancer は、任意の Webサイト上の HTML `<table>` を**右クリックメニュー**から変換できる Chrome 拡張機能です。
2 つの主要機能を提供します。

| 機能 | 右クリックメニュー | 内容 |
|--------|-----------------|------|
| リッチ表示 | テーブルをリッチ表示に変換 | モダン UI・ソート・フィルター・列操作・CSV エクスポート |
| ツリー表示 | テーブルをツリー表示に変換（レベル列） | 階層展開/折りたたみ |
| リセット | テーブルを元に戻す | 変換前に復元 |

---

## ファイル構成

```
ex_webtable/
├── manifest.json          # Chrome Extension Manifest V3
├── background.js          # Service Worker — コンテキストメニュー登録・メッセージ中継
├── content.js             # Content Script（esbuild による src/ のバンドル出力）
├── styles.css             # Content Script CSS（.wte-* 名前空間）
├── generate-icons.js      # PNG アイコン自動生成スクリプト
├── package.json           # npm スクリプト・devDependencies
├── eslint.config.js       # ESLint 設定
├── src/                   # ソースモジュール（esbuild でバンドル）
│   ├── index.js           #   エントリーポイント（イベントリスナー登録）
│   ├── utils.js           #   DOM 共通ユーティリティ
│   ├── sort.js            #   列ソート
│   ├── remap.js           #   列インデックス再マッピング（純粋関数）
│   ├── filters.js         #   列フィルターパネル・グローバル検索
│   ├── colvis.js          #   列の表示/非表示
│   ├── csv.js             #   CSV エクスポート
│   ├── resize.js          #   列リサイズ（ドラッグ）
│   ├── reorder.js         #   列並替（ドラッグ&ドロップ）
│   ├── interaction.js     #   行選択・ハイライト
│   ├── tree.js            #   ツリー表示変換・展開/折畳み
│   ├── rich.js            #   リッチ表示変換
│   ├── reset.js           #   テーブルリセット
│   └── menu.js            #   カスタムコンテキストメニュー
├── icons/                 # 拡張機能アイコン（16/48/128 px PNG）
└── docs/
    ├── DESIGN.md          # 本ドキュメント
    └── privacy-policy.html
```

### モジュール依存関係

```
utils ◄── sort
utils ◄── remap ◄── colvis ◄── reorder
                 └──────────── reorder
utils ◄── filters
utils ◄── colvis ◄── csv
utils ◄── resize
utils ◄── interaction
utils ◄── tree  ──► resize, reorder, interaction
utils ◄── rich  ──► sort, filters, resize, reorder, interaction
       ◄── reset ──► filters, colvis
       ◄── menu  ──► colvis, filters, csv, rich, tree, reset, interaction
index ──► utils, rich, tree, reset, menu
```

---

## 機能詳細

### 機能 1 : リッチ表示変換

**変換前**
- ブラウザデフォルトのスタイルのみ
- ソート・フィルター機能なし

**変換後**
- モダン UI（ストライプ行・ホバーハイライト・ダークヘッダー）
- グローバル検索フィルター（キーワードで行を絞り込み + 件数表示）
- 列ソート（クリックで昇順→降順→リセット）
- 列フィルター（列ごとのチェックボックスパネル、Excel ライク）
- 列リサイズ（ドラッグハンドルで列幅を変更）
- 列並替（ヘッダーをドラッグ&ドロップで移動）
- 列の表示/非表示（右クリックメニューまたはパネルで管理）
- CSV エクスポート（表示中の行・列のみ出力）
- 行選択（クリック・Shift 範囲・Ctrl トグル）
- 行コピー（選択行をタブ区切りでクリップボードへ）
- ハイライト（ダブルクリックまたは右クリックメニュー）
- テキスト折り返しトグル（はみ出し表示 ↔ 改行あり）

#### ソートロジック

| 優先度 | 判定方法 | 例 |
|---------|---------|----|
| 1 | 数値（カンマ・通貨記号除去） | `1,000` → 1000 |
| 2 | 日付（`Date.parse`） | `2024-01-15` |
| 3 | 日本語対応テキスト（`localeCompare('ja')`） | 「あいう」順 |

#### 全 `<td>` テーブルへの対応

`<th>` がなくすべて `<td>` で書かれたテーブルも対応しています。
`ensureStructure()` が先頭行を `<thead>` に昇格させ、導出されたヘッダーセル（`<td>` でも可）にソート機能を付与します。

#### 列フィルターの仕組み

1. フィルターボタン（▼）をクリックするとパネルを表示
2. 列のユニーク値をチェックボックスで選択/解除
3. 適用ボタンで `table._wteColFilters` にフィルター状態を保存
4. `applyAllFilters()` がグローバル検索 + 全列フィルターを統合適用

#### 列並替後の状態同期

列をドラッグ移動した後、以下の内部状態を `shiftIndex()` で再マッピング:
- `table._wteColFilters` のキー（列インデックス）
- `table._wteHiddenCols` のインデックス集合
- `table._wteLvColIdx`（ツリービューのレベル列インデックス）
- `table._wteCols`（colgroup の col 要素配列）

---

### 機能 2 : ツリー表示変換

**対象テーブルの条件（いずれか）**

1. **レベル列モード**: ヘッダー行に下記のいずれかの列名が存在し、その列に整数値が入っている
   `Level` / `レベル` / `階層` / `Lv` / `Lv.` / `depth` / `深さ`（大小文字不問）

2. **アンダースコアインデントモード**: 先頭列の値が `_` / 全角スペース / `\u00a0` の連続で字下げされている
   例: `"root"` → レベル 1、`"_child"` → レベル 2、`"__grand"` → レベル 3

**階層構造の解釈例（レベル列モード）**

```
| Level | 項目     | 金額 |
|-------|----------|------|
| 1     | 売上合計  | 1000 |  ← ルート（トグルボタン付き）
| 2     |   商品A  |  600 |  ← 売上合計の子
| 3     |     明細1 |  300 |  ← 商品Aの子
| 3     |     明細2 |  300 |  ← 商品Aの子
| 2     |   商品B  |  400 |  ← 売上合計の子
```

**展開/折畳み操作**

- `−` ボタンをクリック → 子・孫を非表示（折りたたむ）
- `+` ボタンをクリック → 子を表示（孫は各ノードの open 状態に従う）
- 右クリックメニュー → 全展開・全折畳み・レベル N まで展開

**アルゴリズム**

1. スタックを使った O(n) 親子関係構築（`transformToTree` 内）
2. `cells[0]` にトグルボタンを挿入、葉ノードにはスペーサーを挿入（文字位置を揃える）
3. CSS カスタムプロパティ `--wte-indent` でインデント量を制御（8 + (level − 1) × 20 px）
4. 表示/非表示は `HTMLTableRowElement.hidden` で制御

---

### 機能 3 : リセット

`table.dataset.wteSnap` に保存した innerHTML スナップショットを復元し、すべての内部状態（`_wteNodes`, `_wteColFilters`, `_wteHiddenCols` 等）を削除します。

---

## テーブル状態管理

変換済みテーブルは、`table` 要素のプロパティに状態を直接保持します。

| プロパティ | 型 | 内容 |
|---|---|---|
| `dataset.wteSnap` | string | 変換前の innerHTML スナップショット |
| `dataset.wteStyle` | string | 変換前の style 属性 |
| `_wteNodes` | Node[] | ツリーノード配列（展開状態・親子関係を保持） |
| `_wteColFilters` | Object | 列フィルター状態 `{colIdx: {checkedValues: Set}}` |
| `_wteSearchQuery` | string | グローバル検索クエリ |
| `_wteHiddenCols` | Set\<number\> | 非表示列のインデックス集合 |
| `_wteCols` | HTMLElement[] | colgroup の col 要素配列（リサイズ用） |
| `_wteLvColIdx` | number | ツリービューのレベル列インデックス |
| `_wteOriginalOrder` | HTMLTableRowElement[] | ソート前の行順序（リセット用） |
| `_wteApplyStripes` | function | ストライプ再計算関数 |
| `_wteRefreshCount` | function | 件数表示更新関数 |
| `_wteInteractionSetup` | boolean | 行インタラクションのセットアップ済みフラグ |
| `_wteLastClickedRow` | HTMLTableRowElement | Shift 範囲選択の起点行 |
| `_wteDragColIdx` | number | 列並替ドラッグ中の列インデックス |

---

## 権限

| 権限 | 用途 |
|------|------|
| `contextMenus` | 右クリックメニューへの項目追加 |
| `clipboardWrite` | 選択行のタブ区切りテキストをクリップボードへコピー |

Content Script はすべての URL (`<all_urls>`) に自動注入されます。

---

## インストール・開発環境

### 必要環境

- Node.js 18 以上
- npm

### セットアップ

```bash
git clone https://github.com/nakashun-mf/ex_webtable.git
cd ex_webtable
npm install
npm run build
```

`npm run build` が `src/index.js` を起点に依存を解決し、IIFE 形式の `content.js` を生成します。

### 開発コマンド

| コマンド | 内容 |
|---|---|
| `npm run build` | `src/` を `content.js` にバンドル |
| `npm run watch` | ファイル変更を監視して自動ビルド |
| `npm run lint` | ESLint でソースコードをチェック |

### Chrome への読み込み

1. `chrome://extensions` を開く
2. 「デベロッパーモード」を ON
3. 「パッケージ化されていない拡張機能を読み込む」→ リポジトリのルートフォルダを選択
4. ソース変更後は `npm run build` を再実行し、拡張機能の更新ボタンをクリック

---

## 対応テーブルの形式

| 形式 | 対応状況 |
|------|----------|
| `<thead>` + `<tbody>` | ✅ そのまま使用 |
| `<tbody>` のみ（`<thead>` なし） | ✅ 先頭行を `<thead>` に自動昇格 |
| 全セル `<td>`（ヘッダーに `<th>` なし） | ✅ 先頭行を `<thead>` に自動昇格 |
| 複数 `<tbody>` | ✅ 全 `<tbody>` の行を列挙 |
| `<iframe>` 内のテーブル | ❌ 未対応 |

---

## 制限事項 / 既知の問題

- リッチ変換とツリー変換の同時適用は不可（一方を先に「元に戻す」する必要あり）
- JavaScript で動的生成されるテーブルは、生成後に右クリックする必要あり
- `iframe` 内のテーブルは非対応

---

## 今後の拡張候補

- [ ] ページネーション（1ページあたり N 行表示）
- [ ] リッチ変換 + ツリー変換の同時適用
- [ ] ダークモード対応
- [ ] 複数言語対応（現在は日本語のみ）
