#!/bin/bash
set -e

echo "🔍 Running Health Check..."
echo ""

# Directory to scan
SRC_DIR="${1:-src}"

# =============================================================================
echo "📋 Step 1: TypeScript type check..."
npx tsc --noEmit
echo "✅ TypeScript check passed."

# =============================================================================
echo ""
echo "📋 Step 2: ESLint with zero warnings..."
npx eslint . --ext .ts,.tsx --max-warnings 0
echo "✅ ESLint check passed."

# =============================================================================
echo ""
echo "📋 Step 3: Checking for ignore directives..."
if grep -rE "eslint-disable|@ts-ignore|@ts-nocheck|@ts-expect-error" "$SRC_DIR" 2>/dev/null; then
  echo "❌ FOUND: Ignore directives. Please remove them."
  exit 1
fi
echo "✅ No ignore directives found."

# =============================================================================
echo ""
echo "📋 Step 4: Checking for 'any' type usage..."
if grep -rE ":\s*any\b|<any>|as\s+any" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ FOUND: 'any' type usage. Use proper types instead."
  exit 1
fi
echo "✅ No 'any' type usage found."

# =============================================================================
echo ""
echo "📋 Step 5: Checking for console statements..."
if grep -rE "console\.(log|warn|error|info|debug)" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ FOUND: Console statements. Use proper logging instead."
  exit 1
fi
echo "✅ No console statements found."

# =============================================================================
echo ""
echo "📋 Step 6: Checking for TODO/FIXME markers..."
if grep -rE "TODO|FIXME" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ FOUND: TODO/FIXME markers. Resolve before committing."
  exit 1
fi
echo "✅ No TODO/FIXME markers found."

# =============================================================================
echo ""
echo "📋 Step 7: Checking for mutable declarations (let/var)..."
if grep -rE "^\s*(let|var)\s+" "$SRC_DIR" --include="*.ts" --include="*.tsx" 2>/dev/null; then
  echo "❌ FOUND: Mutable declarations. Use const instead."
  exit 1
fi
echo "✅ No mutable declarations found."

# =============================================================================
echo ""
echo "📋 Step 8: Running tests with coverage..."
npx vitest run --coverage --coverage.thresholds.lines=80 --coverage.thresholds.functions=80 --coverage.thresholds.branches=80
echo "✅ Tests passed with sufficient coverage."

# =============================================================================
echo ""
echo "🎉 All health checks passed! Code is production-ready."
exit 0
