#!/usr/bin/env bash
# Ghi hoặc cập nhật MỘT GitHub Issue duy nhất khi workflow cập nhật cảnh báo
# dược tự động chạy lỗi — để khi quay lại sau nhiều tháng chỉ cần xem tab
# Issues thay vì lục log của từng lượt chạy.
#
# Dùng: bash scripts/report_pharmacovigilance_failure.sh
# Yêu cầu: biến môi trường GH_TOKEN (hoặc GITHUB_TOKEN) đã được set, quyền
# "issues: write" trong workflow, và các biến ngữ cảnh mặc định của GitHub
# Actions (GITHUB_REPOSITORY, GITHUB_RUN_ID, GITHUB_REF_NAME, GITHUB_WORKFLOW,
# GITHUB_SERVER_URL).

set -euo pipefail

LABEL="canh-bao-duoc-loi-tu-dong"
TITLE="⚠️ Lỗi tự động cập nhật cảnh báo dược"
REPO="${GITHUB_REPOSITORY:?thiếu biến GITHUB_REPOSITORY}"
RUN_URL="${GITHUB_SERVER_URL}/${REPO}/actions/runs/${GITHUB_RUN_ID}"

# Tạo nhãn nếu chưa có; --force cho phép chạy lại an toàn nếu nhãn đã tồn tại.
gh label create "$LABEL" \
  --repo "$REPO" \
  --color "D93F0B" \
  --description "Gắn tự động khi workflow cập nhật cảnh báo dược chạy lỗi" \
  --force >/dev/null 2>&1 || true

BODY="Workflow **${GITHUB_WORKFLOW}** thất bại lúc $(date -u +'%Y-%m-%d %H:%M UTC').

- Lượt chạy: ${RUN_URL}
- Nhánh: \`${GITHUB_REF_NAME}\`

Issue này sẽ tự đóng khi có một lượt chạy kế tiếp thành công (dù là lịch tự
động hay chạy tay). Nếu lỗi lặp lại nhiều ngày liên tiếp, cần kiểm tra thủ
công: cấu trúc trang nguồn có thay đổi không, hoặc quyền ghi của repo tại
Settings → Actions → General → Workflow permissions."

EXISTING_ISSUE="$(gh issue list --repo "$REPO" --label "$LABEL" --state open --json number --jq '.[0].number // empty')"

if [ -n "$EXISTING_ISSUE" ]; then
  gh issue comment "$EXISTING_ISSUE" --repo "$REPO" --body "$BODY"
else
  gh issue create --repo "$REPO" --title "$TITLE" --label "$LABEL" --body "$BODY"
fi
