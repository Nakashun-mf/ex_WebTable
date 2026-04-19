# Changelog

All notable changes to WebTable Enhancer are documented here.

## [Unreleased]

## [1.1.5] - 2026-04-19
### Fixed
- package.yml に `contents: write` 権限を追加（リリース作成に必要）
- `workflow_call` トリガーを追加: `GITHUB_TOKEN` でのタグpushは他ワークフローをトリガーしないため、auto-tag.yml から package.yml を直接呼び出すよう設計変更
- auto-tag.yml に `release` ジョブを追加し `workflow_call` でリリースを自動作成

## [1.1.4] - 2026-04-19
### Fixed
- GitHub Actions: actions/checkout・setup-node・upload-artifact を有効なバージョン(@v4)に修正
- auto-tag: git describe が同一コミットに複数タグがある場合に古いタグを返すバグを修正
- auto-tag: 算出したタグが既存の場合はスキップして重複タグ作成を防止
- CI (ci.yml) を新規追加: PRとmainへのpushでlint+testを自動実行
- CHANGELOG.md を追加

## [1.1.3] - 2026-04-18
### Fixed
- Revert to PR-based version bump workflow after repository settings change

## [1.1.2] - 2026-04-18
### Fixed
- Auto-tag workflow: switch to direct push approach

## [1.1.1] - 2026-04-18
### Fixed
- Auto-tag workflow: prevent infinite loop on bot commits

## [1.1.0] - 2026-04-17
### Added
- Semantic versioning auto-bump based on Conventional Commits (MAJOR/MINOR/PATCH)

## [1.0.8] - 2026-04-17
### Added
- `workflow_dispatch` trigger to auto-tag workflow for manual execution

## [1.0.7] - 2026-04-17
### Fixed
- Context menu terminology consistency (折りたたみ, フィルター…)
- UI string normalization across source files

## [1.0.0] - Initial release
### Added
- Rich table view with sorting and filtering
- Tree view with collapsible rows
- Context menu with copy/export options
- Chrome Extension Manifest v3 support
