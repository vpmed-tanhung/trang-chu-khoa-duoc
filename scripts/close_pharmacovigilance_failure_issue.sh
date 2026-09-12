#!/usr/bin/env bash
# Tự đóng Issue lỗi (nếu có) khi một lượt chạy tiếp theo của workflow cập
# nhật cảnh báo dược thành công. Chạy vô hại nếu không có issue nào đang mở.
#
# Dùng: bash scripts/close_pharmacovigilance_failure_issue.sh
# Yêu cầu: biến môi trường GH_TOKEN (hoặc GITHUB_TOKEN), quyền "issues: write".

set -euo pipefail

LABEL="canh-bao-duoc-loi-tu-dong"
REPO="${GITHUB_REPOSITORY:?thiếu biến GITHUB_REPOSITORY}"

OPEN_ISSUES="$(gh issue list --repo "$REPO" --label "$LABEL" --state open --json number --jq '.[].number' || true)"

if [ -z "$OPEN_ISSUES" ]; then
  exit 0
fi

while IFS= read -r ISSUE; do
  [ -z "$ISSUE" ] && continue
  gh issue comment "$ISSUE" --repo "$REPO" \
    --body "✅ Lượt chạy $(date -u +'%Y-%m-%d %H:%M UTC') đã thành công. Tự động đóng issue này."
  gh issue close "$ISSUE" --repo "$REPO"
done <<< "$OPEN_ISSUES"
