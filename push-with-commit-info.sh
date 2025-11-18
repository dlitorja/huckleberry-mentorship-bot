#!/bin/bash
# Script to push changes with relevant commit information
# Analyzes changes and suggests appropriate commit messages

# Change to the directory containing this script (project root)
cd "$(dirname "$0")"

# Check if there are any changes to commit
if [ -z "$(git status --porcelain)" ]; then
    echo "No changes to commit. Working directory is clean."
    exit 0
fi

# Function to analyze changes and suggest commit type
analyze_changes() {
    local staged_files=$(git diff --cached --name-only 2>/dev/null)
    local unstaged_files=$(git diff --name-only 2>/dev/null)
    local all_files="$staged_files $unstaged_files"
    
    # Count different types of changes
    local fix_count=0
    local feat_count=0
    local refactor_count=0
    local test_count=0
    local docs_count=0
    local style_count=0
    local chore_count=0
    
    # Analyze file patterns and content
    for file in $all_files; do
        if [[ "$file" == *"test"* ]] || [[ "$file" == *"spec"* ]] || [[ "$file" == *"__tests__"* ]]; then
            ((test_count++))
        elif [[ "$file" == *".md" ]] || [[ "$file" == *"README"* ]] || [[ "$file" == *"docs"* ]]; then
            ((docs_count++))
        elif [[ "$file" == *".css" ]] || [[ "$file" == *"style"* ]]; then
            ((style_count++))
        elif [[ "$file" == *"fix"* ]] || [[ "$file" == *"bug"* ]] || [[ "$file" == *"error"* ]]; then
            ((fix_count++))
        elif [[ "$file" == *"feat"* ]] || [[ "$file" == *"feature"* ]] || [[ "$file" == *"add"* ]]; then
            ((feat_count++))
        elif [[ "$file" == *"refactor"* ]] || [[ "$file" == *"optimize"* ]]; then
            ((refactor_count++))
        else
            ((chore_count++))
        fi
    done
    
    # Check git diff for keywords
    local diff_content=$(git diff HEAD 2>/dev/null | head -100)
    
    if echo "$diff_content" | grep -qiE "(fix|bug|error|issue|broken)"; then
        ((fix_count++))
    fi
    if echo "$diff_content" | grep -qiE "(add|new|feature|implement)"; then
        ((feat_count++))
    fi
    if echo "$diff_content" | grep -qiE "(refactor|optimize|improve|clean)"; then
        ((refactor_count++))
    fi
    
    # Determine commit type
    if [ $fix_count -gt $feat_count ] && [ $fix_count -gt $refactor_count ]; then
        echo "fix"
    elif [ $feat_count -gt $refactor_count ]; then
        echo "feat"
    elif [ $refactor_count -gt 0 ]; then
        echo "refactor"
    elif [ $test_count -gt 0 ]; then
        echo "test"
    elif [ $docs_count -gt 0 ]; then
        echo "docs"
    elif [ $style_count -gt 0 ]; then
        echo "style"
    else
        echo "chore"
    fi
}

# Show detailed status
echo "=========================================="
echo "  Git Status Summary"
echo "=========================================="
echo ""
git status --short
echo ""

# Show what files changed
echo "=========================================="
echo "  Changed Files"
echo "=========================================="
git status --porcelain | awk '{print $2}' | while read file; do
    if [ -f "$file" ]; then
        status=$(git status --porcelain "$file" | awk '{print $1}')
        case "$status" in
            "M") echo "  Modified: $file" ;;
            "A") echo "  Added:    $file" ;;
            "D") echo "  Deleted:  $file" ;;
            "??") echo "  Untracked: $file" ;;
            *) echo "  $status:   $file" ;;
        esac
    fi
done
echo ""

# Stage all changes
echo "Staging all changes..."
git add -A
echo ""

# Analyze changes to suggest commit type
commit_type=$(analyze_changes)

# Generate suggested commit message based on changed files
suggested_message=""
changed_files_list=$(git diff --cached --name-only 2>/dev/null | head -5)

# Create a more specific message based on file patterns
if echo "$changed_files_list" | grep -qiE "(page\.tsx|component)"; then
    if echo "$changed_files_list" | grep -qi "sessions"; then
        suggested_message="$commit_type: Fix TypeScript error in sessions page"
    elif echo "$changed_files_list" | grep -qi "assets"; then
        suggested_message="$commit_type: Update assets page"
    else
        suggested_message="$commit_type: Update web portal components"
    fi
elif echo "$changed_files_list" | grep -qiE "\.(ts|tsx)$"; then
    suggested_message="$commit_type: Update TypeScript files"
elif echo "$changed_files_list" | grep -qiE "\.(sh|ps1)$"; then
    suggested_message="$commit_type: Update scripts"
elif echo "$changed_files_list" | grep -qiE "\.(md|txt)$"; then
    suggested_message="$commit_type: Update documentation"
elif echo "$changed_files_list" | grep -qiE "(package\.json|tsconfig|next\.config)"; then
    suggested_message="$commit_type: Update configuration"
else
    suggested_message="$commit_type: Update project files"
fi

# Show diff summary
echo "=========================================="
echo "  Change Summary"
echo "=========================================="
added_lines=$(git diff --cached --numstat 2>/dev/null | awk '{sum+=$1} END {print sum+0}')
removed_lines=$(git diff --cached --numstat 2>/dev/null | awk '{sum+=$2} END {print sum+0}')
echo "  Files changed: $(git diff --cached --name-only 2>/dev/null | wc -l | tr -d ' ')"
echo "  Lines added:   ${added_lines:-0}"
echo "  Lines removed: ${removed_lines:-0}"
echo ""

# Get commit message
if [ -z "$1" ]; then
    echo "=========================================="
    echo "  Suggested Commit Message"
    echo "=========================================="
    echo "  $suggested_message"
    echo ""
    echo "Enter commit message (press Enter to use suggested, or type your own):"
    read -r commit_message
    if [ -z "$commit_message" ]; then
        commit_message="$suggested_message"
    fi
else
    commit_message="$1"
fi

# Commit changes
echo ""
echo "=========================================="
echo "  Committing Changes"
echo "=========================================="
echo "Commit message: $commit_message"
echo ""
git commit -m "$commit_message"

# Push to GitHub
echo ""
echo "=========================================="
echo "  Pushing to GitHub"
echo "=========================================="
git push origin main

echo ""
echo "✅ Done! Changes have been pushed to origin/main"
echo ""

