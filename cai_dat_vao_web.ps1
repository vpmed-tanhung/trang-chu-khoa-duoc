param([string]$RepoPath = "")
$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Select-RepoFolder {
    Add-Type -AssemblyName System.Windows.Forms
    $dialog = New-Object System.Windows.Forms.FolderBrowserDialog
    $dialog.Description = "Chọn thư mục gốc trang-chu-khoa-duoc (thư mục có index.html)"
    $dialog.ShowNewFolderButton = $false
    if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) {
        return $dialog.SelectedPath
    }
    throw "Chưa chọn thư mục web."
}

if ([string]::IsNullOrWhiteSpace($RepoPath)) {
    if (Test-Path (Join-Path $ScriptDir "index.html")) {
        $RepoPath = $ScriptDir
    } else {
        $RepoPath = Select-RepoFolder
    }
}
$RepoPath = (Resolve-Path $RepoPath).Path
$IndexPath = Join-Path $RepoPath "index.html"
if (-not (Test-Path $IndexPath)) { throw "Không tìm thấy index.html trong: $RepoPath" }

$SourceModule = Join-Path $ScriptDir "canh-bao-duoc"
$TargetModule = Join-Path $RepoPath "canh-bao-duoc"
if (-not (Test-Path (Join-Path $SourceModule "index.html"))) { throw "Thiếu canh-bao-duoc\index.html" }
if ((Resolve-Path $SourceModule).Path -ne $TargetModule) {
    if (Test-Path $TargetModule) { Remove-Item $TargetModule -Recurse -Force }
    Copy-Item $SourceModule $TargetModule -Recurse -Force
}

$Utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$Text = [System.IO.File]::ReadAllText($IndexPath, [System.Text.Encoding]::UTF8)
$Original = $Text
$Eol = if ($Text.Contains("`r`n")) { "`r`n" } else { "`n" }
$ModuleRel = 'canh-bao-duoc/index.html'
$Title = 'Cảnh báo dược về sử dụng thuốc'
$Card = '<a class="feature-card pharmacovigilance-feature" href="canh-bao-duoc/index.html"><span class="feature-icon">🛡️</span><b>Cảnh báo dược về sử dụng thuốc</b><small>Tra cứu cảnh báo ADR, tương tác, thuốc nguy cơ cao, sai sót sử dụng, theo dõi xét nghiệm và biện pháp giảm thiểu nguy cơ.</small><em>Cập nhật 11/07/2026</em></a>'
$Hero = '<li><strong>Cảnh báo dược về sử dụng thuốc:</strong> Tra cứu cảnh báo ADR, tương tác, thuốc nguy cơ cao và biện pháp giảm thiểu nguy cơ.</li>'

if (-not $Text.Contains($ModuleRel)) {
    $Pattern = '(?m)^(\s*)(<button class="feature-card" data-open="sources" data-intro-exclude="true">)'
    if (-not [regex]::IsMatch($Text, $Pattern)) { throw "Không tìm thấy thẻ Nguồn dữ liệu hệ thống để chèn thẻ mới." }
    $Text = [regex]::Replace($Text, $Pattern, { param($m) $m.Groups[1].Value + $Card + $Eol + $m.Value }, 1)
}

if (-not $Text.Contains('<strong>Cảnh báo dược về sử dụng thuốc:')) {
    $Start = $Text.IndexOf('id="heroFeatureList"')
    if ($Start -ge 0) {
        $Close = $Text.IndexOf('</ul>', $Start)
        if ($Close -ge 0) {
            $LineStart = $Text.LastIndexOf("`n", $Close) + 1
            $Indent = $Text.Substring($LineStart, $Close - $LineStart)
            $Text = $Text.Substring(0, $LineStart) + $Indent + $Hero + $Eol + $Text.Substring($LineStart)
        }
    }
}

if ($Text -ne $Original) {
    $Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
    $Backup = Join-Path $RepoPath "index.backup_truoc_canh_bao_duoc_$Stamp.html"
    Copy-Item $IndexPath $Backup -Force
    [System.IO.File]::WriteAllText($IndexPath, $Text, $Utf8NoBom)
    Write-Host "ĐÃ SAO LƯU: $(Split-Path -Leaf $Backup)" -ForegroundColor Yellow
} else {
    Write-Host "index.html đã có thẻ Cảnh báo dược; không tạo bản trùng lặp." -ForegroundColor Yellow
}

$CheckText = [System.IO.File]::ReadAllText($IndexPath, [System.Text.Encoding]::UTF8)
if ((Test-Path (Join-Path $TargetModule "index.html")) -and $CheckText.Contains($ModuleRel)) {
    Write-Host "HOÀN TẤT: Đã tích hợp Cảnh báo dược vào mục Ứng dụng chính." -ForegroundColor Green
    Write-Host "Sau khi upload/commit, đường dẫn là:"
    Write-Host "https://vpmed-tanhung.github.io/trang-chu-khoa-duoc/canh-bao-duoc/" -ForegroundColor Cyan
} else {
    throw "Kiểm tra sau cài đặt không đạt."
}
