#!/bin/bash
# Quick verification script for backend deployment

echo "🔍 Backend Deployment Verification"
echo "=================================="
echo ""

# Check 1: Database connection
echo "1️⃣  Testing database connection..."
npx prisma db execute --stdin <<'EOF' 2>/dev/null && echo "✅ Database OK" || echo "❌ Database connection failed"
SELECT 1 as connection_test;
EOF

# Check 2: Migration status
echo ""
echo "2️⃣  Checking migration status..."
npx prisma migrate status 2>&1 | grep -E "Database schema|migrations found" || echo "⚠️  Migration check incomplete"

# Check 3: Admin table columns
echo ""
echo "3️⃣  Verifying Admin table schema..."
npx prisma db execute --stdin 2>/dev/null <<'EOF' && echo "✅ Admin table has new columns" || echo "❌ Admin table check failed"
SELECT tgUsername, tgChatId FROM Admin LIMIT 1;
EOF

# Check 4: TypeScript compilation
echo ""
echo "4️⃣  Checking TypeScript compilation..."
npx tsc -p tsconfig.json --noEmit 2>&1 | grep -i "error" && echo "❌ TypeScript errors found" || echo "✅ TypeScript OK"

echo ""
echo "✨ Verification complete!"
echo "=================================="
echo ""
echo "Next steps:"
echo "1. Set ADMIN_SEED_TELEGRAM_USERNAME in .env"
echo "2. Run: npm run seed"
echo "3. Admin must /start the bot to sync chat_id"
echo "4. Test support notifications"
echo ""
