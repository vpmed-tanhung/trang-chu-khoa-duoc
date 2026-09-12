import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MAIN_WORKFLOW = ROOT / ".github" / "workflows" / "cap-nhat-canh-bao-duoc.yml"
BACKUP_WORKFLOW = ROOT / ".github" / "workflows" / "du-phong-cap-nhat-canh-bao-duoc.yml"
REPORT_SCRIPT = ROOT / "scripts" / "report_pharmacovigilance_failure.sh"
CLOSE_SCRIPT = ROOT / "scripts" / "close_pharmacovigilance_failure_issue.sh"


def _concurrency_group(source: str) -> str:
    match = re.search(r"(?m)^concurrency:\s*\n(?:^\s+.*\n)+", source)
    assert match, "Không tìm thấy khối concurrency."
    block = match.group(0)
    group_match = re.search(r"(?m)^\s+group:\s*(\S+)\s*$", block)
    assert group_match, "Khối concurrency phải khai báo group."
    return group_match.group(1)


def test_both_workflows_share_one_concurrency_group_so_they_never_race():
    main_source = MAIN_WORKFLOW.read_text(encoding="utf-8")
    backup_source = BACKUP_WORKFLOW.read_text(encoding="utf-8")

    main_group = _concurrency_group(main_source)
    backup_group = _concurrency_group(backup_source)

    assert main_group == backup_group == "cap-nhat-canh-bao-duoc", (
        "Workflow chính và workflow dự phòng phải dùng chung 1 nhóm "
        "concurrency, để chạy tay lúc lịch tự động đang chạy không bị "
        "đè lên nhau."
    )
    assert "cancel-in-progress: false" in main_source
    assert "cancel-in-progress: false" in backup_source


def test_both_workflows_grant_issues_write_permission():
    for workflow in (MAIN_WORKFLOW, BACKUP_WORKFLOW):
        source = workflow.read_text(encoding="utf-8")
        assert re.search(r"(?m)^\s{2}issues:\s*write\s*$", source), (
            f"{workflow.name} cần quyền issues: write để tự tạo/đóng "
            "Issue theo dõi lỗi."
        )
        assert re.search(r"(?m)^\s{2}contents:\s*write\s*$", source), (
            f"{workflow.name} vẫn phải giữ quyền contents: write để "
            "commit/push dữ liệu."
        )


def test_both_workflows_report_and_clear_failures_via_shared_scripts():
    for workflow in (MAIN_WORKFLOW, BACKUP_WORKFLOW):
        source = workflow.read_text(encoding="utf-8")

        failure_step = re.search(
            r"if:\s*failure\(\)\s*\n(?:.*\n)*?\s*run:\s*bash scripts/report_pharmacovigilance_failure\.sh",
            source,
        )
        assert failure_step, (
            f"{workflow.name} phải gọi report_pharmacovigilance_failure.sh "
            "khi job lỗi, để tự mở/ghi tiếp Issue theo dõi."
        )

        success_step = re.search(
            r"if:\s*success\(\)\s*\n(?:.*\n)*?\s*run:\s*bash scripts/close_pharmacovigilance_failure_issue\.sh",
            source,
        )
        assert success_step, (
            f"{workflow.name} phải gọi close_pharmacovigilance_failure_issue.sh "
            "khi job thành công, để tự đóng Issue lỗi trước đó."
        )

        assert "GH_TOKEN: ${{ github.token }}" in source, (
            f"{workflow.name} cần truyền GH_TOKEN cho gh CLI ở 2 bước trên."
        )


def test_failure_and_close_scripts_track_the_same_issue_label():
    assert REPORT_SCRIPT.exists() and CLOSE_SCRIPT.exists(), (
        "Thiếu 1 trong 2 script tạo/đóng Issue theo dõi lỗi."
    )

    report_source = REPORT_SCRIPT.read_text(encoding="utf-8")
    close_source = CLOSE_SCRIPT.read_text(encoding="utf-8")

    report_label = re.search(r'(?m)^LABEL="([^"]+)"', report_source)
    close_label = re.search(r'(?m)^LABEL="([^"]+)"', close_source)
    assert report_label and close_label, "Mỗi script phải khai báo hằng LABEL."
    assert report_label.group(1) == close_label.group(1), (
        "2 script phải dùng chung 1 nhãn Issue, nếu không sẽ không nhận ra "
        "issue của nhau và có thể tạo trùng issue mỗi ngày lỗi."
    )

    # Không tạo issue mới nếu đã có issue lỗi đang mở (tránh spam mỗi ngày).
    assert "EXISTING_ISSUE" in report_source
    assert "gh issue comment" in report_source and "gh issue create" in report_source

    # set -euo pipefail để lỗi trong bước này không bị nuốt lặng lẽ.
    assert "set -euo pipefail" in report_source
    assert "set -euo pipefail" in close_source
