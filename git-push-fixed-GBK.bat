@echo off
chcp 936 >nul
setlocal EnableDelayedExpansion
title GitHub 一键上传工具

:: ========== 全局配置区 ==========
set "CONFIG_FILE=%USERPROFILE%\.git_push_config.ini"

:: ========== 环境检测 ==========
call :CHECK_ENV
if errorlevel 1 exit /b

:: ========== 初始化/读取配置 ==========
if not exist "!CONFIG_FILE!" (
    cls
    echo ================================================
    echo          GitHub 一键上传工具 - 首次配置
    echo ================================================
    echo.
    echo 请输入你的 Git 用户名（GitHub 昵称）：
    set /p "GIT_NAME="
    echo.
    echo 请输入你的 Git 邮箱（GitHub 绑定邮箱）：
    set /p "GIT_EMAIL="
    echo.
    echo GIT_NAME=!GIT_NAME!> "!CONFIG_FILE!"
    echo GIT_EMAIL=!GIT_EMAIL!>> "!CONFIG_FILE!"
    echo 配置已保存，下次运行无需重复输入！
    pause
) else (
    for /f "tokens=1,2 delims==" %%a in (!CONFIG_FILE!) do (
        if "%%a"=="GIT_NAME" set "GIT_NAME=%%b"
        if "%%a"=="GIT_EMAIL" set "GIT_EMAIL=%%b"
    )
)
goto :MENU

:: ========== 环境检查 ==========
:CHECK_ENV
set "NEED_INSTALL=0"
echo.
echo 正在检查运行环境...
echo.
where git >nul 2>&1
if errorlevel 1 (
    echo [FAIL] Git 未安装
    set "NEED_INSTALL=1"
) else (
    for /f "tokens=3" %%v in ('git --version 2^>nul') do echo [OK] Git 已安装 ^(%%v^)
)
where gh >nul 2>&1
if errorlevel 1 (
    echo [FAIL] GitHub CLI ^(gh^) 未安装
    set "NEED_INSTALL=1"
) else (
    set "GH_VER="
    for /f "tokens=3" %%v in ('gh --version 2^>nul') do if not defined GH_VER set "GH_VER=%%v"
    if defined GH_VER (echo [OK] GitHub CLI ^(gh^) 已安装 ^(!GH_VER!^)) else (echo [OK] GitHub CLI ^(gh^) 已安装)
)
if "!NEED_INSTALL!"=="0" (
    echo.
    echo [OK] 环境检查通过
    exit /b 0
)
echo.
echo ================================================
echo           缺少依赖，需要安装
echo ================================================
echo.
echo [1] 使用 winget 安装（推荐，Windows 11 自带）
echo [2] 使用 Chocolatey 安装
echo [3] 手动下载安装
echo [0] 退出
echo.
set "ic="
set /p "ic= 请选择安装方式: "
if "!ic!"=="1" (
    where winget >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [!] 未检测到 winget！请先安装或选择其他方式
        echo    下载地址: https://aka.ms/getwinget
        pause
        exit /b 1
    )
    echo.
    echo 正在安装 Git...
    winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
    echo.
    echo 正在安装 GitHub CLI...
    winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
    echo.
    echo [OK] 安装完成！请关闭窗口重新打开脚本
    pause
    exit /b 1
)
if "!ic!"=="2" (
    where choco >nul 2>&1
    if errorlevel 1 (
        echo.
        echo [!] 未检测到 Chocolatey！请先安装或选择其他方式
        pause
        exit /b 1
    )
    echo.
    echo 正在安装 Git...
    choco install git -y
    echo.
    echo 正在安装 GitHub CLI...
    choco install gh -y
    echo.
    echo [OK] 安装完成！请关闭窗口重新打开脚本
    pause
    exit /b 1
)
if "!ic!"=="3" (
    echo.
    echo 正在打开下载页面...
    start https://git-scm.com/download/win
    start https://cli.github.com/
    echo 请手动安装 Git 和 GitHub CLI 后重新运行脚本
    pause
    exit /b 1
)
exit /b 1

:: ========== 主菜单 ==========
:MENU
cls
echo.
echo ================================================
echo          GitHub 一键上传工具 - fuwawas
echo ================================================
echo.
echo 当前目录: %cd%
echo.
if exist .git (echo [仓库状态] 已初始化) else (echo [仓库状态] 未初始化)
echo.
echo [1] 上传代码
echo [2] 查看仓库状态
echo [3] 登录 GitHub
echo [4] 绑定远程仓库
echo [5] 修改 Git 账号配置
echo [6] 删除远程仓库
echo [7] 取消 Star 项目
echo [0] 退出工具
echo.
set "choice="
set /p "choice= 请输入选项: "
if "!choice!"=="1" goto :UPLOAD
if "!choice!"=="2" goto :STATUS
if "!choice!"=="3" goto :LOGIN
if "!choice!"=="4" goto :SETREMOTE
if "!choice!"=="5" goto :RECONFIG
if "!choice!"=="6" goto :DELETE_REPO
if "!choice!"=="7" goto :UNSTAR
if "!choice!"=="0" exit /b
goto :MENU


:: ========== 登录 GitHub ==========
:LOGIN
cls
echo ================================================
echo          登录 GitHub
echo ================================================
echo.
echo 当前登录状态：
gh auth status 2>&1
echo.
echo ================================================
echo [1] 通过 Token 登录（推荐，无需浏览器）
echo [2] 通过浏览器登录（需要能访问 github.com）
echo [0] 返回菜单
echo ================================================
echo.
set "login_choice="
set /p "login_choice= 请选择: "

if "!login_choice!"=="0" goto :MENU

if "!login_choice!"=="1" (
    echo.
    echo 请粘贴你的 GitHub Personal Access Token：
    echo （ghp_ 开头，可在 GitHub Settings - Developer Settings - Tokens 生成）
    echo.
    set /p "GH_TOKEN="
    if "!GH_TOKEN!"=="" (
        echo [FAIL] Token 不能为空！
        pause
        goto :LOGIN
    )
    echo.
    echo 正在通过 Token 登录...
    echo !GH_TOKEN!| gh auth login --with-token
    if errorlevel 1 (
        echo.
        echo [FAIL] Token 登录失败！请检查 Token 是否正确
        pause
        goto :LOGIN
    )
    echo.
    echo [OK] Token 登录成功！
)

if "!login_choice!"=="2" (
    echo.
    echo 正在通过浏览器登录...
    echo 如果长时间无响应，请检查网络或尝试 Token 登录
    echo.
    gh auth login -w -p https -h github.com
    if errorlevel 1 (
        echo.
        echo [FAIL] 浏览器登录失败！
        echo    可能原因：无法访问 github.com
        echo    建议：使用 Token 登录（选项1）
        pause
        goto :LOGIN
    )
    echo.
    echo [OK] 登录成功！
)

if "!login_choice!"=="" (
    echo [FAIL] 未选择操作
    pause
    goto :LOGIN
)

gh config set git_protocol https
pause
goto :MENU


:: ========== 上传代码（核心功能） ==========
:UPLOAD
cls
echo === 上传代码 ===
echo.

:: 配置 Git 协议
gh config set git_protocol https

:: 检查登录状态
gh auth status >nul 2>&1
if errorlevel 1 (
    echo [WARN] 尚未登录 GitHub！
    echo.
    set /p "do_login= 是否现在登录？(y/n): "
    if /i "!do_login!"=="y" goto :LOGIN
    echo [FAIL] 未登录，无法推送代码
    pause
    goto :MENU
)

:: 初始化仓库（如果不存在）
if not exist .git (
    git init
    git branch -M main
    echo [OK] 已初始化本地 Git 仓库（默认分支 main）
)

:: 应用用户配置
git config user.name "!GIT_NAME!"
git config user.email "!GIT_EMAIL!"
echo [OK] Git 账号配置完成（!GIT_NAME! / !GIT_EMAIL!）
echo.

:: 获取当前分支
for /f "tokens=1" %%b in ('git branch --show-current 2^>nul') do set "BR=%%b"
if "!BR!"=="" set "BR=main"

:: ========== 远程仓库处理 ==========
:: 检查是否已有远程绑定
set "HAS_REMOTE=0"
set "CURRENT_REMOTE="
git remote get-url origin >nul 2>&1
if not errorlevel 1 (
    set "HAS_REMOTE=1"
    for /f "tokens=*" %%u in ('git remote get-url origin 2^>nul') do set "CURRENT_REMOTE=%%u"
)

if "!HAS_REMOTE!"=="1" (
    echo [当前远程] !CURRENT_REMOTE!
    echo.
    echo [1] 推送到当前远程仓库
    echo [2] 创建新的远程仓库并绑定
    echo [3] 绑定其他远程仓库地址
    echo [0] 返回菜单
    echo.
    set "repo_choice="
    set /p "repo_choice= 请选择: "

    if "!repo_choice!"=="0" goto :MENU

    if "!repo_choice!"=="2" (
        goto :CREATE_REPO
    )

    if "!repo_choice!"=="3" (
        goto :SETREMOTE
    )

    if "!repo_choice!"=="" goto :PUSH
    if "!repo_choice!"=="1" goto :PUSH
)

:: 无远程，创建新仓库
goto :CREATE_REPO

:CREATE_REPO
set /p "RNAME= 请输入新仓库名称: "
if "!RNAME!"=="" (
    echo [FAIL] 错误：仓库名称不能为空！
    pause
    goto :MENU
)
echo.
echo [1] 公开仓库（所有人可见）
echo [2] 私有仓库（仅自己可见）
set /p "PUB= 请选择仓库类型: "
set "VF=--public"
if "!PUB!"=="2" set "VF=--private"

:: 先移除旧远程（如果有的话）
git remote remove origin >nul 2>&1

echo.
echo 正在 GitHub 创建仓库 !RNAME! ...
powershell -NoProfile -Command "$r='%RNAME%'; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; gh repo create $r %VF% --source=. --remote=origin" 2>&1
chcp 936 >nul
if errorlevel 1 (
    echo.
    echo [FAIL] 仓库创建失败！
    echo    GitHub 返回：名称 "!RNAME!" 不可用
    echo.
    echo    可能原因：
    echo    - 你（或组织下）已有同名仓库（包括已删除的）
    echo    - 仓库名被 GitHub 保留
    echo    - 权限不足
    echo.
    echo    建议操作：
    echo    - 换一个名字重试
    echo    - 或选 [4] 手动绑定已有仓库地址
    pause
    goto :MENU
)
echo [OK] 仓库创建成功！
goto :PUSH

:: ========== 提交并推送代码 ==========
:PUSH
echo.
:: 自动生成 .gitignore（如果不存在）
if not exist .gitignore (
    echo Thumbs.db> .gitignore
    echo desktop.ini>> .gitignore
    echo .DS_Store>> .gitignore
    echo [OK] 已自动生成 .gitignore，忽略系统垃圾文件
)

:: 暂存所有文件
git add -A

:: 检查暂存区是否有新内容需要提交
git diff --cached --quiet >nul 2>&1
if not errorlevel 1 (
    :: 暂存区为空，检查是否有本地提交可以推送
    git log origin/"!BR!" -1 >nul 2>&1
    if errorlevel 1 (
        :: 远程分支不存在（新仓库），检查本地是否有提交
        git log -1 >nul 2>&1
        if errorlevel 1 (
            echo [FAIL] 本地没有任何提交，且没有新文件可提交
            echo        请先添加文件到当前文件夹后再试
            pause
            goto :MENU
        )
        echo [OK] 本地有提交，远程为空，准备推送...
        goto :DO_SYNC_PUSH
    )
    :: 比较本地和远程的提交差异
    set "AHEAD=0"
    for /f %%c in ('git rev-list --count origin/"!BR!"..HEAD 2^>nul') do set "AHEAD=%%c"
    if "!AHEAD!"=="0" (
        if "!AHEAD!"=="" goto :HAS_CHANGES
        echo 本地和远程已是最新，无需推送
        pause
        goto :MENU
    )
    echo [OK] 本地有 !AHEAD! 个提交待推送
    goto :DO_SYNC_PUSH
)

:HAS_CHANGES
echo [OK] 已暂存所有修改文件
echo.

:: 提交说明
set /p "MSG= 请输入本次提交说明（直接回车默认「更新代码」）: "
if "!MSG!"=="" set "MSG=更新代码"
powershell -NoProfile -Command "$m='%MSG%'; [Console]::OutputEncoding=[System.Text.Encoding]::UTF8; git commit -m $m"
chcp 936 >nul
if errorlevel 1 (
    echo [FAIL] 提交失败！
    pause
    goto :MENU
)

:DO_SYNC_PUSH
:: 获取当前分支
for /f "tokens=1" %%b in ('git branch --show-current 2^>nul') do set "BR=%%b"
if "!BR!"=="" set "BR=main"

:: ========== 开始同步推送（修复版）==========:: ========== 开始同步推送（修复版）==========
echo.
echo 正在同步推送到远程仓库（分支: !BR!）...
echo.

:: 先尝试 fetch 远程（探测网络+获取远程状态）
git fetch origin "!BR!" >nul 2>&1
set "FETCH_OK=!errorlevel!"

if !FETCH_OK! neq 0 (
    echo [WARN] 无法连接远程仓库，网络可能不通
    echo        直接尝试推送...
    goto :DO_PUSH
)

:: 比较本地分支与远程分支的差异
set "BEHIND=0"
for /f %%c in ('git rev-list --count HEAD..origin/"!BR!" 2^>nul') do set "BEHIND=%%c"

:: 如果远程有本地没有的提交，提示选择同步方式
if not "!BEHIND!"=="0" (
    if not "!BEHIND!"=="" (
        echo [INFO] 远程分支有 !BEHIND! 个本地没有的提交
        echo.
        echo 请选择同步方式：
        echo [1] 用 rebase 同步（推荐）
        echo [2] 用 merge 合并
        echo [3] 强制覆盖（危险）
        echo [0] 取消，返回菜单
        echo.
        set "sync_choice="
        set /p "sync_choice= 请选择: "

        if "!sync_choice!"=="0" goto :MENU

        if "!sync_choice!"=="1" (
            echo.
            echo 正在执行 git pull --rebase ...
            git pull --rebase origin "!BR!" 2>&1
            if errorlevel 1 (
                echo.
                echo [FAIL] Rebase 过程中出现冲突！
                echo.
                echo 冲突文件：
                git diff --name-only --diff-filter=U 2>nul
                echo.
                echo 请选择：
                echo [1] 取消 rebase，回到提交前状态
                echo [2] 退出脚本，手动解决冲突
                echo.
                set "rb_choice="
                set /p "rb_choice= 请选择: "
                if "!rb_choice!"=="1" (
                    git rebase --abort >nul 2>&1
                    echo [OK] Rebase 已取消
                    pause
                    goto :MENU
                )
                echo.
                echo 请手动解决冲突后执行：
                echo   git rebase --continue
                echo   git push -u origin "!BR!"
                echo.
                pause
                exit /b
            )
        )

        if "!sync_choice!"=="2" (
            echo.
            echo 正在执行 git pull --no-rebase ...
            git pull --no-rebase origin "!BR!" 2>&1
            if errorlevel 1 (
                echo.
                echo [FAIL] Merge 过程中出现冲突！
                echo.
                echo 冲突文件：
                git diff --name-only --diff-filter=U 2>nul
                echo.
                echo 请手动解决冲突后执行：
                echo   git add .
                echo   git commit -m "resolve merge conflicts"
                echo   git push -u origin "!BR!"
                echo.
                pause
                exit /b
            )
        )

        if "!sync_choice!"=="3" (
            echo.
            echo [WARN] 强制覆盖，远程历史将被覆盖！
            set /p "force_confirm= 确认覆盖远程历史？(yes/no): "
            if not "!force_confirm!"=="yes" (
                echo [OK] 已取消
                pause
                goto :MENU
            )
        )

        if "!sync_choice!"=="" (
            echo [FAIL] 未选择操作，返回菜单
            pause
            goto :MENU
        )
    )
)

:DO_PUSH
if "!sync_choice!"=="3" (
    git push --force -u origin "!BR!" 2>&1
) else (
    git push -u origin "!BR!" 2>&1
)
set "PUSH_RESULT=!errorlevel!"

if !PUSH_RESULT! neq 0 (
    echo.
    echo [FAIL] 推送失败！
    echo.
    echo 常见原因：
    echo 1. 网络：ping github.com 看是否通
    echo 2. 登录：gh auth status
    echo 3. 权限：确认有仓库写权限
    echo.
    echo 尝试重新登录：
    echo   选菜单 [3] 登录 GitHub - 选项 [1] Token 登录
    echo.
    pause
    goto :MENU
)

echo.
echo ================================================
echo          [OK] 代码上传完成！
echo ================================================
pause
goto :MENU


:: ========== 查看仓库状态 ==========
:STATUS
cls
echo === 仓库状态 ===
git status
echo.
echo === 最近5条提交记录 ===
git log --oneline -5 2>nul
pause
goto :MENU


:: ========== 绑定远程仓库 ==========
:SETREMOTE
cls
set /p "URL= 请输入远程仓库地址（HTTPS/SSH 均可）: "
git remote remove origin 2>nul
git remote add origin "!URL!"
echo [OK] 远程仓库绑定成功！
pause
goto :MENU


:: ========== 重新配置账号 ==========
:RECONFIG
cls
echo ================================================
echo          修改 Git 账号配置
echo ================================================
echo.
echo 当前配置：
echo 用户名: !GIT_NAME!
echo 邮箱: !GIT_EMAIL!
echo.
echo 请输入新的 Git 用户名：
set /p "NEW_NAME="
echo.
echo 请输入新的 Git 邮箱：
set /p "NEW_EMAIL="
echo.
echo GIT_NAME=!NEW_NAME!> "!CONFIG_FILE!"
echo GIT_EMAIL=!NEW_EMAIL!>> "!CONFIG_FILE!"
set "GIT_NAME=!NEW_NAME!"
set "GIT_EMAIL=!NEW_EMAIL!"
echo [OK] 账号配置已更新！
pause
goto :MENU


:: ========== 删除远程仓库 ==========
:DELETE_REPO
cls
echo ================================================
echo          删除远程仓库
echo ================================================
echo.

:: 检查登录状态
gh auth status >nul 2>&1
if errorlevel 1 (
    echo [WARN] 尚未登录 GitHub！
    echo.
    set /p "do_login= 是否现在登录？(y/n): "
    if /i "!do_login!"=="y" goto :LOGIN
    echo [FAIL] 未登录，无法操作
    pause
    goto :MENU
)

:: 获取当前登录用户名
set "GH_USER="
for /f "tokens=*" %%u in ('gh api user --jq ".login" 2^>nul') do set "GH_USER=%%u"
if "!GH_USER!"=="" (
    echo [FAIL] 无法获取 GitHub 用户名，请检查登录状态
    pause
    goto :MENU
)

echo 当前账号: !GH_USER!
echo.

REM 检查 delete_repo 权限
gh auth status -h github.com 2>&1 | findstr "delete_repo" >nul 2>&1
if errorlevel 1 (
    echo [提示] Token 缺少 delete_repo 权限，删除仓库需要此权限
    set /p "pre_refresh= 是否立即授权？(y/n): "
    if /i "!pre_refresh!"=="y" (
        echo.
        echo 正在打开浏览器授权...
        gh auth refresh -h github.com -s delete_repo
        echo.
        echo [OK] 权限已更新！
    ) else (
        echo [提示] 未授权，删除操作可能会失败
    )
    echo.
)
echo 请选择操作方式：
echo [1] 输入仓库名称删除
echo [2] 从已有仓库列表中选择
echo [3] 粘贴列表批量删除
echo [0] 返回菜单
echo.
set "del_choice="
set /p "del_choice= 请选择: "

if "!del_choice!"=="0" goto :MENU

if "!del_choice!"=="1" (
    echo.
    set /p "DEL_REPO= 请输入要删除的仓库名称（格式: 用户名/仓库名）: "
    if "!DEL_REPO!"=="" (
        echo [FAIL] 仓库名称不能为空！
        pause
        goto :DELETE_REPO
    )
    goto :CONFIRM_DELETE
)

if "!del_choice!"=="2" (
    echo.
    echo 正在获取仓库列表...
    echo.
    set "IDX=0"
    for /f "tokens=*" %%r in ('gh repo list !GH_USER! --limit 30 --json nameWithOwner -q ".[].nameWithOwner" 2^>nul') do (
        set /a IDX+=1
        echo [!IDX!] %%r
        set "REPO_!IDX!=%%r"
    )
    if "!IDX!"=="0" (
        echo [INFO] 没有找到仓库
        pause
        goto :DELETE_REPO
    )
    echo.
    set /p "REPO_NUM= 请输入仓库编号: "
    if "!REPO_NUM!"=="" (
        echo [FAIL] 未输入编号
        pause
        goto :DELETE_REPO
    )
    set "REPO_NUM_TMP=!REPO_NUM!"
    call set "DEL_REPO=%%REPO_!REPO_NUM_TMP!%%"
    if "!DEL_REPO!"=="" (
        echo [FAIL] 编号无效
        pause
        goto :DELETE_REPO
    )
    goto :CONFIRM_DELETE
)

if "!del_choice!"=="3" (
    echo.
    echo 请粘贴仓库列表（格式: [编号] 用户名/仓库名），粘贴完后输入 done 确认：
    echo.
    set "BIDX=0"
    goto :PASTE_START
)


:: ========== 粘贴列表循环 ==========
:PASTE_START
:PASTE_LOOP
set "PLINE="
set /p "PLINE= > "
if /i "!PLINE!"=="done" goto :PARSE_BATCH
if "!PLINE!"=="" goto :PASTE_LOOP
set /a BIDX+=1
set "REPO_LINE_!BIDX!=!PLINE!"
goto :PASTE_LOOP

:: ========== 解析粘贴内容 ==========

for /l %%d in (1,1,!BIDX!) do (
)
echo.
:PARSE_BATCH
if "!BIDX!"=="0" (
    echo [FAIL] 未输入任何内容
    pause
    goto :DELETE_REPO
)

set "REPO_COUNT=0"
for /l %%i in (1,1,!BIDX!) do (
    set "BLINE=!REPO_LINE_%%i!"
    set "BLINE=!BLINE: =!"
    if not "!BLINE!"=="" (
        if "!BLINE:~0,1!"=="[" (
            REM 去掉 [ 前缀
            set "BTMP=!BLINE:~1!"
            REM 提取 ] 后面的内容
            set "BREPO=!BTMP:*]=!"
            if not "!BREPO!"=="" (
                set /a REPO_COUNT+=1
                set "BATCH_REPO_!REPO_COUNT!=!BREPO!"
            )
        ) else (
            set /a REPO_COUNT+=1
            set "BATCH_REPO_!REPO_COUNT!=!BLINE!"
        )
    )
)

if "!REPO_COUNT!"=="0" (
    echo [FAIL] 未解析到有效仓库名
    pause
    goto :DELETE_REPO
)

echo.
echo ================================================
echo  共解析到 !REPO_COUNT! 个仓库，即将全部删除：
echo ================================================
for /l %%i in (1,1,!REPO_COUNT!) do (
    echo  [%%i] !BATCH_REPO_%%i!
)
echo.
echo  此操作不可恢复！
set /p "confirm_batch= 确认删除以上全部仓库？输入 DELETE 确认: "
if not "!confirm_batch!"=="DELETE" (
    echo [OK] 已取消
    pause
    goto :MENU
)
echo.
set "BATCH_OK=0"
set "BATCH_FAIL=0"
set "NEED_REFRESH=0"
for /l %%i in (1,1,!REPO_COUNT!) do (
    set "DEL_OUTPUT="
    for /f "tokens=*" %%o in ('gh repo delete !BATCH_REPO_%%i! --yes 2^>^&1') do set "DEL_OUTPUT=%%o"
    if errorlevel 1 (
        echo   [FAIL] !DEL_OUTPUT!
        set /a BATCH_FAIL+=1
        echo !DEL_OUTPUT! | findstr "delete_repo" >nul 2>&1
        if not errorlevel 1 set "NEED_REFRESH=1"
    ) else (
        echo   [OK]
        set /a BATCH_OK+=1
    )
)
if "!NEED_REFRESH!"=="1" (
    echo.
    echo [提示] 部分删除因权限不足失败，需要 refresh Token 权限
    set /p "do_refresh= 是否立即授权 delete_repo 权限？(y/n): "
    if /i "!do_refresh!"=="y" (
        gh auth refresh -h github.com -s delete_repo
        echo [OK] 权限已更新，请重新执行删除操作
    )
)
echo.
echo [OK] 完成！成功: !BATCH_OK!  失败: !BATCH_FAIL!
pause
goto :MENU

:CONFIRM_DELETE
echo.
echo ================================================
echo  即将删除仓库: !DEL_REPO!
echo  此操作不可恢复！
echo ================================================
echo.
set /p "confirm_del= 确认删除？请输入仓库名称以确认: "
if not "!confirm_del!"=="!DEL_REPO!" (
    echo [OK] 输入不匹配，已取消删除
    pause
    goto :MENU
)

echo.
echo 正在删除 !DEL_REPO! ...
set "SINGLE_OUT="
for /f "tokens=*" %%o in ('gh repo delete !DEL_REPO! --yes 2^>^&1') do set "SINGLE_OUT=%%o"
if errorlevel 1 (
    echo.
    echo [FAIL] 删除失败！
    if not "!SINGLE_OUT!"=="" echo    原因: !SINGLE_OUT!
    echo !SINGLE_OUT! | findstr "delete_repo" >nul 2>&1
    if not errorlevel 1 (
        echo.
        set /p "do_refresh2= 是否立即授权 delete_repo 权限？(y/n): "
        if /i "!do_refresh2!"=="y" (
            gh auth refresh -h github.com -s delete_repo
            echo [OK] 权限已更新，请重新执行删除操作
        )
    )
    pause
    goto :MENU
)

echo.
echo [OK] 仓库 !DEL_REPO! 已删除！

:: 如果当前本地仓库绑定的是被删除的远程，清除绑定
for /f "tokens=*" %%u in ('git remote get-url origin 2^>nul') do set "CUR_REMOTE=%%u"
echo !CUR_REMOTE! | findstr /i "!DEL_REPO!" >nul 2>&1
if not errorlevel 1 (
    git remote remove origin >nul 2>&1
    echo [OK] 已清除本地远程绑定
)
pause
goto :MENU


:: ========== 取消 Star 项目 ==========
:UNSTAR
cls
echo ================================================
echo          取消 Star 项目
echo ================================================
echo.

:: 检查登录状态
gh auth status >nul 2>&1
if errorlevel 1 (
    echo [WARN] 尚未登录 GitHub！
    echo.
    set /p "do_login= 是否现在登录？(y/n): "
    if /i "!do_login!"=="y" goto :LOGIN
    echo [FAIL] 未登录，无法操作
    pause
    goto :MENU
)

:: 获取当前登录用户名
set "GH_USER="
for /f "tokens=*" %%u in ('gh api user --jq ".login" 2^>nul') do set "GH_USER=%%u"
if "!GH_USER!"=="" (
    echo [FAIL] 无法获取 GitHub 用户名，请检查登录状态
    pause
    goto :MENU
)

echo 当前账号: !GH_USER!
echo.
echo 正在获取 Star 列表...
echo.

:: 列出已 star 的仓库
set "IDX=0"
for /f "tokens=*" %%r in ('gh api users/!GH_USER!/starred --paginate --jq ".[].full_name" 2^>nul') do (
    set /a IDX+=1
    echo [!IDX!] %%r
    set "STAR_!IDX!=%%r"
)

if "!IDX!"=="0" (
    echo [INFO] 你还没有 Star 任何仓库
    pause
    goto :MENU
)

echo.
echo ================================================
echo [1-N] 输入编号取消对应 Star
echo [a]   取消全部 Star
echo [0]   返回菜单
echo ================================================
echo.
set /p "star_choice= 请选择: "

if "!star_choice!"=="0" goto :MENU

if /i "!star_choice!"=="a" (
    echo.
    echo [WARN] 即将取消全部 !IDX! 个 Star！
    set /p "confirm_all= 确认？(yes/no): "
    if not "!confirm_all!"=="yes" (
        echo [OK] 已取消
        pause
        goto :UNSTAR
    )
    echo.
    set "UNSTARRED=0"
    set "FAILED=0"
    for /l %%i in (1,1,!IDX!) do (
        set "TARGET=!STAR_%%i!"
        echo 取消 Star: !TARGET! ...
        gh api -X DELETE "user/starred/!TARGET!" --silent 2>nul
        if errorlevel 1 (
            echo   [FAIL] 失败
            set /a FAILED+=1
        ) else (
            echo   [OK]
            set /a UNSTARRED+=1
        )
    )
    echo.
    echo [OK] 完成！成功: !UNSTARRED!  失败: !FAILED!
    pause
    goto :MENU
)

:: 单个取消
set "STAR_CHOICE_TMP=!star_choice!"
call set "TARGET=%%STAR_!STAR_CHOICE_TMP!%%"
if "!TARGET!"=="" (
    echo [FAIL] 编号无效
    pause
    goto :UNSTAR
)

echo.
echo 正在取消 Star: !TARGET! ...
gh api -X DELETE "user/starred/!TARGET!" --silent 2>&1
if errorlevel 1 (
    echo [FAIL] 取消 Star 失败！
) else (
    echo [OK] 已取消 Star: !TARGET!
)
pause
goto :MENU
