#!/data/data/com.termux/files/usr/bin/bash
# ================================================
# GitHub 一键上传工具 - Termux 版
# 制作作者：酷安@爱你么么哒qcjl哟
# 未经授权禁止商用、牟利或非法使用。侵权请联系删除。
# ================================================
# 功能：前置工程文件夹路径选择 + 自动修复Git权限问题 + 空文件夹优化
# 使用前: pkg install git gh
# ================================================

set -o pipefail
# 注意：不使用 set -e，交互式脚本中过于激进，会导致非关键命令失败时直接退出
# 错误处理由各函数自行完成

# 确保 Termux 的 bin 目录在 PATH 中
TERMUX_PREFIX="/data/data/com.termux/files/usr"
[[ ":$PATH:" != *":$TERMUX_PREFIX/bin:"* ]] && export PATH="$TERMUX_PREFIX/bin:$PATH"
[[ ":$PATH:" != *":$TERMUX_PREFIX/sbin:"* ]] && export PATH="$TERMUX_PREFIX/sbin:$PATH"

# 确保 HOME 指向 Termux 用户目录（有些环境 HOME 会变成 /）
if [[ "$HOME" == "/" || ! -w "$HOME" ]]; then
    export HOME="/data/data/com.termux/files/home"
fi

# ========== 颜色定义 ==========
RED='\033[1;31m'
GREEN='\033[1;32m'
YELLOW='\033[1;33m'
CYAN='\033[1;36m'
RESET='\033[0m'

# ========== 全局配置 ==========
CONFIG_FILE="/sdcard/.git_push_config.ini"
PROJECT_DIR="" # 工程文件夹路径全局变量

# ========== 工具函数 ==========
ok()   { echo -e "${GREEN}✅ $1${RESET}"; }
fail() { echo -e "${RED}❌ $1${RESET}"; }
warn() { echo -e "${YELLOW}⚠️ $1${RESET}"; }
info() { echo -e "${CYAN}$1${RESET}"; }
divider() { echo "================================================"; }
pause()  { echo; read -rp "按回车键继续..." _; }

# ========== 自动修复Git环境（解决安全目录+分支提示问题） ==========
fix_git_env() {
    echo
    echo "正在初始化Git环境配置..."
    # 信任所有目录，解决Termux访问/sdcard的权限校验问题
    git config --global --add safe.directory '*' >/dev/null 2>&1 || true
    # 设置默认分支为main，关闭分支命名提示
    git config --global init.defaultBranch main >/dev/null 2>&1 || true
    git config --global advice.defaultBranchName false >/dev/null 2>&1 || true
    ok "Git环境配置初始化完成！"
}

# ========== 选择工程文件夹路径 ==========
select_project_dir() {
    clear
    divider
    echo "          选择上传的工程文件夹"
    divider
    echo
    echo "📌 提示：支持手机存储卡路径（如/sdcard/我的项目/）、绝对路径、相对路径"
    echo "📌 示例：/sdcard/Download/MyProject 或 ~/test 或 ./project"
    echo
    while true; do
        read -rp "请输入工程文件夹完整路径: " INPUT_DIR
        # 去除路径前后空格
        INPUT_DIR=$(echo "$INPUT_DIR" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')
        # 路径为空则提示
        if [[ -z "$INPUT_DIR" ]]; then
            fail "路径不能为空！"
            echo
            continue
        fi
        # 展开 ~ 为 HOME 目录
        INPUT_DIR="${INPUT_DIR/#\~/$HOME}"
        # 解析路径（获取绝对路径）
        RESOLVED_DIR=$(cd "$INPUT_DIR" 2>/dev/null && pwd) || true
        if [[ -z "$RESOLVED_DIR" || ! -d "$RESOLVED_DIR" ]]; then
            fail "路径不存在或不是文件夹！请重新输入"
            echo
            continue
        fi
        # 确认路径
        PROJECT_DIR="$RESOLVED_DIR"
        echo
        ok "路径验证成功！"
        info "当前选择的工程文件夹：$PROJECT_DIR"
        echo
        read -rp "是否确认使用该路径？(y/n，默认y): " CONFIRM
        CONFIRM="${CONFIRM,,}" # 转小写统一处理
        [[ -z "$CONFIRM" || "$CONFIRM" == "y" ]] && break
        echo
    done
    # 进入工程文件夹
    cd "$PROJECT_DIR" || { fail "进入工程文件夹失败！"; pause; exit 1; }
    ok "已成功进入工程文件夹：$PROJECT_DIR"
    pause
}

# ========== 环境检测 ==========
check_env() {
    while true; do
        local need_install=0

        echo
        echo "正在检查运行环境..."
        echo

        if command -v git &>/dev/null; then
            ok "Git 已安装 ($(git --version | awk '{print $3}'))"
        else
            fail "Git 未安装"
            need_install=1
        fi

        if command -v gh &>/dev/null; then
            ok "GitHub CLI 已安装 ($(gh --version | head -1 | awk '{print $3}'))"
        else
            fail "GitHub CLI (gh) 未安装"
            need_install=1
        fi

        if [[ $need_install -eq 0 ]]; then
            fix_git_env
            echo
            ok "环境检查通过"
            return
        fi

        echo
        divider
        echo "          缺少依赖，需要安装"
        divider
        echo
        echo "[1] 自动安装（推荐）"
        echo "[2] 重新检测"
        echo "[0] 退出"
        echo
        read -rp "请选择: " ic
        case "$ic" in
            1)
                echo
                # 在子 shell 中执行安装，彻底隔绝 set -e 影响
                (
                    set +e
                    set +o pipefail
                    # 选择包管理器：优先 pkg，回退 apt，兜底用绝对路径
                    if command -v pkg &>/dev/null; then
                        PKG="pkg"
                    elif command -v apt &>/dev/null; then
                        PKG="apt"
                    elif [[ -x "$TERMUX_PREFIX/bin/pkg" ]]; then
                        PKG="$TERMUX_PREFIX/bin/pkg"
                    elif [[ -x "$TERMUX_PREFIX/bin/apt" ]]; then
                        PKG="$TERMUX_PREFIX/bin/apt"
                    else
                        echo "找不到包管理器（pkg/apt），请确认在 Termux 中运行"
                        exit 1
                    fi

                    echo "正在更新源（使用 $PKG）..."
                    $PKG update -y
                    $PKG upgrade -y

                    if ! command -v git &>/dev/null && ! [[ -x "$TERMUX_PREFIX/bin/git" ]]; then
                        echo "正在安装 Git..."
                        $PKG install git -y
                        if ! command -v git &>/dev/null && ! [[ -x "$TERMUX_PREFIX/bin/git" ]]; then
                            echo "Git 安装失败！"
                            exit 1
                        fi
                    fi

                    if ! command -v gh &>/dev/null && ! [[ -x "$TERMUX_PREFIX/bin/gh" ]]; then
                        echo "正在安装 GitHub CLI..."
                        $PKG install gh -y
                        if ! command -v gh &>/dev/null && ! [[ -x "$TERMUX_PREFIX/bin/gh" ]]; then
                            echo "GitHub CLI 安装失败！"
                            exit 1
                        fi
                    fi

                    exit 0
                )
                local install_status=$?
                if [[ $install_status -eq 0 ]]; then
                    fix_git_env
                    echo
                    ok "安装完成！正在重新检测..."
                else
                    fail "安装过程中出现错误，请检查上方输出"
                fi
                pause
                sleep 1
                # 回到循环顶部重新检测
                ;;
            2)
                echo
                info "重新检测环境中..."
                sleep 1
                ;;
            0)
                exit 0
                ;;
            *)
                warn "无效选项，请重新选择"
                ;;
        esac
    done
}

# ========== 读取配置 ==========
load_config() {
    if [[ ! -f "$CONFIG_FILE" ]]; then
        clear
        divider
        echo "          GitHub 一键上传工具 - 首次配置"
        divider
        echo
        read -rp "请输入你的 Git 用户名（GitHub 昵称）: " GIT_NAME
        echo
        read -rp "请输入你的 Git 邮箱（GitHub 绑定邮箱）: " GIT_EMAIL
        echo
        cat > "$CONFIG_FILE" <<EOF
GIT_NAME=$GIT_NAME
GIT_EMAIL=$GIT_EMAIL
EOF
        echo "配置已保存到: $CONFIG_FILE"
        echo "下次运行无需重复输入！"
        pause
    else
        # shellcheck source=/dev/null
        source "$CONFIG_FILE"
    fi
}

# ========== 主菜单 ==========
show_menu() {
    clear
    echo
    divider
    echo "     GitHub 一键上传工具 - 酷安@爱你么么哒qcjl哟"
    divider
    echo "     未经授权禁止商用、牟利或非法使用。侵权请联系删除。"
    echo
    echo "🎯 当前工程文件夹: $PROJECT_DIR"
    echo
    if [[ -d .git ]]; then
        echo -e "[仓库状态] ${GREEN}已初始化${RESET}"
    else
        echo -e "[仓库状态] ${YELLOW}未初始化${RESET}"
    fi
    echo
    echo "[1] 上传代码"
    echo "[2] 查看仓库状态"
    echo "[3] 登录 GitHub"
    echo "[4] 绑定远程仓库"
    echo "[5] 修改 Git 账号配置"
    echo "[6] 重新选择工程文件夹"
    echo "[7] 删除远程仓库"
    echo "[8] 取消 Star 项目"
    echo "[0] 退出工具"
    echo
    read -rp "请输入选项: " choice
}

# ========== 登录 GitHub ==========
do_login() {
    clear
    echo "=== 登录 GitHub ==="
    echo
    gh auth login -p https -h github.com 2>&1
    gh config set git_protocol https 2>/dev/null || true
    echo
    ok "登录完成！"
    pause
}

# ========== 上传代码 ==========
do_upload() {
    clear
    echo "=== 上传代码 ==="
    echo

    gh config set git_protocol https

    if [[ ! -d .git ]]; then
        git init
        git branch -M main
        ok "已初始化本地 Git 仓库（默认分支 main）"
    fi

    git config user.name "$GIT_NAME"
    git config user.email "$GIT_EMAIL"
    ok "Git 账号配置完成（$GIT_NAME / $GIT_EMAIL）"
    echo

    if git remote get-url origin &>/dev/null; then
        ok "已绑定远程仓库，直接进入推送流程"
        do_push
        return
    fi

    read -rp "请输入新仓库名称: " RNAME
    if [[ -z "$RNAME" ]]; then
        fail "仓库名称不能为空！"
        pause; return
    fi

    echo
    echo "[1] 公开仓库（所有人可见）"
    echo "[2] 私有仓库（仅自己可见）"
    read -rp "请选择仓库类型: " PUB
    if [[ "$PUB" == "2" ]]; then
        VF="--private"
    else
        VF="--public"
    fi

    echo
    echo "正在 GitHub 创建仓库 $RNAME ..."
    if ! gh repo create "$RNAME" $VF --source=. --remote=origin 2>/dev/null; then
        fail "仓库创建失败！请检查网络或账号权限"
        pause; return
    fi
    ok "仓库创建成功！"

    do_push
}

# ========== 提交并推送 ==========
do_push() {
    echo

    if [[ ! -f .gitignore ]]; then
        cat > .gitignore <<'IGEOF'
Thumbs.db
desktop.ini
.DS_Store
IGEOF
        ok "已自动生成 .gitignore，忽略系统垃圾文件"
    fi

    git add -A

    # 优化空文件检测逻辑，明确提示
    if [[ -z "$(git status --porcelain 2>/dev/null)" ]]; then
        warn "当前文件夹无任何可提交的文件（空文件夹/文件未修改）"
        info "请在文件夹中添加文件后，重新执行上传操作"
        pause; return
    fi
    ok "已暂存所有修改文件"
    echo

    read -rp "请输入本次提交说明（直接回车默认「更新代码」）: " MSG
    [[ -z "$MSG" ]] && MSG="更新代码"

    if ! git commit -m "$MSG" 2>/dev/null; then
        fail "提交失败！"
        pause; return
    fi

    BR=$(git branch --show-current 2>/dev/null)
    [[ -z "$BR" ]] && BR="main"

    echo
    echo "正在推送代码到远程仓库（分支: $BR）..."
    if ! git push -u origin "$BR" 2>/dev/null; then
        echo "检测到远程有更新，正在自动拉取合并..."
        if ! git pull --rebase origin "$BR" 2>/dev/null; then
            fail "自动合并失败！请手动解决冲突后重试"
            pause; return
        fi
        if ! git push -u origin "$BR" 2>/dev/null; then
            fail "推送失败！请检查网络或权限后重试"
            pause; return
        fi
    fi

    echo
    divider
    echo "          ✅ 代码上传完成！"
    divider
    pause
}

# ========== 查看仓库状态 ==========
do_status() {
    clear
    echo "=== 仓库状态 ==="
    git status 2>/dev/null || echo "当前目录不是 Git 仓库"
    echo
    echo "=== 最近5条提交记录 ==="
    git log --oneline -5 2>/dev/null || echo "暂无提交记录"
    pause
}

# ========== 绑定远程仓库 ==========
do_setremote() {
    clear
    read -rp "请输入远程仓库地址（HTTPS/SSH 均可）: " URL
    git remote remove origin 2>/dev/null
    git remote add origin "$URL"
    ok "远程仓库绑定成功！"
    pause
}

# ========== 修改账号 ==========
do_reconfig() {
    clear
    divider
    echo "          修改 Git 账号配置"
    divider
    echo
    echo "当前配置："
    echo "用户名: $GIT_NAME"
    echo "邮箱: $GIT_EMAIL"
    echo "配置文件: $CONFIG_FILE"
    echo
    read -rp "请输入新的 Git 用户名: " NEW_NAME
    echo
    read -rp "请输入新的 Git 邮箱: " NEW_EMAIL
    echo
    cat > "$CONFIG_FILE" <<EOF
GIT_NAME=$NEW_NAME
GIT_EMAIL=$NEW_EMAIL
EOF
    GIT_NAME="$NEW_NAME"
    GIT_EMAIL="$NEW_EMAIL"
    ok "账号配置已更新！"
    pause
}

# ========== 检查登录状态（公共函数） ==========
ensure_logged_in() {
    if ! gh auth status &>/dev/null; then
        warn "尚未登录 GitHub！"
        echo
        read -rp "是否现在登录？(y/n): " do_login_confirm
        do_login_confirm="${do_login_confirm,,}"
        if [[ "$do_login_confirm" == "y" ]]; then
            do_login
        else
            fail "未登录，无法操作"
            pause
            return 1
        fi
    fi
    return 0
}

# ========== 获取 GitHub 用户名（公共函数） ==========
get_gh_user() {
    GH_USER=$(gh api user --jq ".login" 2>/dev/null)
    if [[ -z "$GH_USER" ]]; then
        fail "无法获取 GitHub 用户名，请检查登录状态"
        pause
        return 1
    fi
    return 0
}

# ========== 删除远程仓库 ==========
do_delete_repo() {
    clear
    divider
    echo "          删除远程仓库"
    divider
    echo

    ensure_logged_in || return
    get_gh_user || return

    echo "当前账号: $GH_USER"
    echo

    # 检查 delete_repo 权限
    if ! gh auth status -h github.com 2>&1 | grep -q "delete_repo"; then
        warn "Token 缺少 delete_repo 权限，删除仓库需要此权限"
        echo
        read -rp "是否立即授权？(y/n): " pre_refresh
        pre_refresh="${pre_refresh,,}"
        if [[ "$pre_refresh" == "y" ]]; then
            echo
            echo "正在打开浏览器授权..."
            gh auth refresh -h github.com -s delete_repo
            echo
            ok "权限已更新！"
        else
            warn "未授权，删除操作可能会失败"
        fi
        echo
    fi

    echo "请选择操作方式："
    echo "[1] 输入仓库名称删除"
    echo "[2] 从已有仓库列表中选择"
    echo "[3] 粘贴列表批量删除"
    echo "[0] 返回菜单"
    echo
    read -rp "请选择: " del_choice

    case "$del_choice" in
        0) return ;;
        1)
            echo
            read -rp "请输入要删除的仓库名称（格式: 用户名/仓库名）: " DEL_REPO
            if [[ -z "$DEL_REPO" ]]; then
                fail "仓库名称不能为空！"
                pause; return
            fi
            confirm_delete_single "$DEL_REPO"
            ;;
        2)
            echo
            echo "正在获取仓库列表..."
            echo
            local repos=()
            local idx=0
            while IFS= read -r repo; do
                ((idx++)) || true
                echo "[$idx] $repo"
                repos+=("$repo")
            done < <(gh repo list "$GH_USER" --limit 30 --json nameWithOwner -q '.[].nameWithOwner' 2>/dev/null)

            if [[ $idx -eq 0 ]]; then
                info "没有找到仓库"
                pause; return
            fi

            echo
            read -rp "请输入仓库编号: " repo_num
            if [[ -z "$repo_num" ]]; then
                fail "未输入编号"
                pause; return
            fi

            if [[ "$repo_num" -lt 1 || "$repo_num" -gt $idx ]] 2>/dev/null; then
                fail "编号无效"
                pause; return
            fi

            DEL_REPO="${repos[$((repo_num - 1))]}"
            confirm_delete_single "$DEL_REPO"
            ;;
        3)
            batch_delete_repos
            ;;
        *)
            do_delete_repo
            ;;
    esac
}

# ========== 确认删除单个仓库 ==========
confirm_delete_single() {
    local repo="$1"
    echo
    divider
    echo "  即将删除仓库: $repo"
    echo "  此操作不可恢复！"
    divider
    echo
    read -rp "确认删除？请输入仓库名称以确认: " confirm_del
    if [[ "$confirm_del" != "$repo" ]]; then
        ok "输入不匹配，已取消删除"
        pause; return
    fi

    echo
    echo "正在删除 $repo ..."
    local del_output
    del_output=$(gh repo delete "$repo" --yes 2>&1)
    if [[ $? -eq 0 ]]; then
        ok "仓库 $repo 已删除！"

        # 如果当前本地仓库绑定的是被删除的远程，清除绑定
        local cur_remote
        cur_remote=$(git remote get-url origin 2>/dev/null || true)
        if [[ "$cur_remote" == *"$repo"* ]]; then
            git remote remove origin &>/dev/null
            ok "已清除本地远程绑定"
        fi
    else
        fail "删除失败！"
        echo "  原因: $del_output"
        if echo "$del_output" | grep -q "delete_repo"; then
            echo
            read -rp "是否立即授权 delete_repo 权限？(y/n): " do_refresh
            do_refresh="${do_refresh,,}"
            if [[ "$do_refresh" == "y" ]]; then
                gh auth refresh -h github.com -s delete_repo
                ok "权限已更新，请重新执行删除操作"
            fi
        fi
    fi
    pause
}

# ========== 粘贴列表批量删除 ==========
batch_delete_repos() {
    echo
    echo "请粘贴仓库列表（格式: [编号] 用户名/仓库名 或 纯 用户名/仓库名）"
    echo "粘贴完后输入 done 确认："
    echo

    # 使用数组代替 eval，避免命令注入
    local lines=()
    local line

    while true; do
        read -rp "> " line
        if [[ "$line" == "done" || "$line" == "DONE" ]]; then
            break
        fi
        [[ -z "$line" ]] && continue
        lines+=("$line")
    done

    local line_count=${#lines[@]}
    if [[ $line_count -eq 0 ]]; then
        fail "未输入任何内容"
        pause; return
    fi

    # 解析仓库名
    local repos=()
    local repo
    for line in "${lines[@]}"; do
        # 去空格
        line=$(echo "$line" | tr -d ' ')
        [[ -z "$line" ]] && continue

        if [[ "$line" =~ ^\[ ]]; then
            # 带编号格式: [1]owner/repo → 提取 ] 后的内容
            repo="${line#*]}"
        elif [[ "$line" =~ ^[^/]+/[^/]+$ ]]; then
            # 纯格式: owner/repo
            repo="$line"
        else
            continue
        fi

        [[ -n "$repo" ]] && repos+=("$repo")
    done

    local count=${#repos[@]}
    if [[ $count -eq 0 ]]; then
        fail "未解析到有效仓库名"
        pause; return
    fi

    echo
    divider
    echo "  共解析到 $count 个仓库，即将全部删除："
    divider
    for i in "${!repos[@]}"; do
        echo "  [$((i+1))] ${repos[$i]}"
    done
    echo
    echo "  此操作不可恢复！"
    read -rp "确认删除以上全部仓库？输入 DELETE 确认: " confirm_batch
    if [[ "$confirm_batch" != "DELETE" ]]; then
        ok "已取消"
        pause; return
    fi

    echo
    local ok_count=0
    local fail_count=0
    local need_refresh=0
    for repo in "${repos[@]}"; do
        local batch_out
        batch_out=$(gh repo delete "$repo" --yes 2>&1)
        if [[ $? -eq 0 ]]; then
            echo -n "删除 $repo ... "
            ok "OK"
            ((ok_count++)) || true
        else
            echo -n "删除 $repo ... "
            fail "FAIL $batch_out"
            ((fail_count++)) || true
            if echo "$batch_out" | grep -q "delete_repo"; then
                need_refresh=1
            fi
        fi
    done

    echo
    ok "完成！成功: $ok_count  失败: $fail_count"

    if [[ $need_refresh -eq 1 ]]; then
        echo
        warn "部分删除因权限不足失败，需要 refresh Token 权限"
        read -rp "是否立即授权 delete_repo 权限？(y/n): " do_refresh
        do_refresh="${do_refresh,,}"
        if [[ "$do_refresh" == "y" ]]; then
            gh auth refresh -h github.com -s delete_repo
            ok "权限已更新，请重新执行删除操作"
        fi
    fi
    pause
}

# ========== 取消 Star 项目 ==========
do_unstar() {
    clear
    divider
    echo "          取消 Star 项目"
    divider
    echo

    ensure_logged_in || return
    get_gh_user || return

    echo "当前账号: $GH_USER"
    echo
    echo "正在获取 Star 列表..."
    echo

    local repos=()
    local idx=0
    while IFS= read -r repo; do
        ((idx++)) || true
        echo "[$idx] $repo"
        repos+=("$repo")
    done < <(gh api "users/$GH_USER/starred" --paginate --jq '.[].full_name' 2>/dev/null)

    if [[ $idx -eq 0 ]]; then
        info "你还没有 Star 任何仓库"
        pause; return
    fi

    echo
    divider
    echo "[1-$idx] 输入编号取消对应 Star"
    echo "[a]   取消全部 Star"
    echo "[0]   返回菜单"
    divider
    echo
    read -rp "请选择: " star_choice

    case "$star_choice" in
        0) return ;;
        [Aa])
            echo
            warn "即将取消全部 $idx 个 Star！"
            read -rp "确认？(yes/no): " confirm_all
            if [[ "$confirm_all" != "yes" ]]; then
                ok "已取消"
                pause; return
            fi

            echo
            local ok_count=0
            local fail_count=0
            for repo in "${repos[@]}"; do
                echo -n "取消 Star: $repo ... "
                if gh api -X DELETE "user/starred/$repo" --silent 2>/dev/null; then
                    ok "OK"
                    ((ok_count++)) || true
                else
                    fail "FAIL"
                    ((fail_count++)) || true
                fi
            done

            echo
            ok "完成！成功: $ok_count  失败: $fail_count"
            pause
            ;;
        *)
            if [[ "$star_choice" =~ ^[0-9]+$ ]] && [[ "$star_choice" -ge 1 && "$star_choice" -le $idx ]]; then
                local target="${repos[$((star_choice - 1))]}"
                echo
                echo "正在取消 Star: $target ..."
                if gh api -X DELETE "user/starred/$target" --silent 2>/dev/null; then
                    ok "已取消 Star: $target"
                else
                    fail "取消 Star 失败！"
                fi
                pause
            else
                fail "无效选项"
                pause
                do_unstar
            fi
            ;;
    esac
}

# ========== 主循环 ==========
main() {
    # 第一步：选择工程文件夹
    select_project_dir
    # 第二步：环境检测（自动修复Git配置）
    check_env
    # 第三步：读取配置
    load_config
    # 第四步：主菜单循环
    while true; do
        show_menu
        case "$choice" in
            1) do_upload ;;
            2) do_status ;;
            3) do_login ;;
            4) do_setremote ;;
            5) do_reconfig ;;
            6) select_project_dir ;;
            7) do_delete_repo ;;
            8) do_unstar ;;
            0) echo "再见！"; exit 0 ;;
            *) echo "无效选项，请重新选择"; sleep 1 ;;
        esac
    done
}

main
