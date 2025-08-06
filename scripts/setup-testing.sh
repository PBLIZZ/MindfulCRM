#!/bin/bash

# MindfulCRM Testing Environment Setup Script
# This script sets up the complete testing environment for development

set -e  # Exit on any error

echo "🚀 Setting up MindfulCRM Testing Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
print_status "Checking prerequisites..."

# Check Node.js version
if ! command -v node &> /dev/null; then
    print_error "Node.js is not installed. Please install Node.js 20 or later."
    exit 1
fi

NODE_VERSION=$(node -v | sed 's/v//')
REQUIRED_VERSION="20.0.0"

if [ "$(printf '%s\n' "$REQUIRED_VERSION" "$NODE_VERSION" | sort -V | head -n1)" = "$REQUIRED_VERSION" ]; then
    print_success "Node.js version $NODE_VERSION is compatible"
else
    print_error "Node.js version $NODE_VERSION is not compatible. Please install Node.js 20 or later."
    exit 1
fi

# Check PostgreSQL
if ! command -v psql &> /dev/null; then
    print_warning "PostgreSQL is not installed or not in PATH. Tests will use in-memory database."
fi

# Check if we're in the project root
if [ ! -f "package.json" ] || [ ! -f "tsconfig.json" ]; then
    print_error "This script must be run from the project root directory."
    exit 1
fi

# Install dependencies
print_status "Installing dependencies..."
npm ci

if [ $? -eq 0 ]; then
    print_success "Dependencies installed successfully"
else
    print_error "Failed to install dependencies"
    exit 1
fi

# Set up environment files
print_status "Setting up environment files..."

if [ ! -f ".env.test" ]; then
    if [ -f ".env.example" ]; then
        cp .env.example .env.test
        print_success "Created .env.test from .env.example"
    else
        cat > .env.test << 'EOF'
# Test Environment Configuration
NODE_ENV=test
DATABASE_URL=postgresql://localhost/mindfulcrm_test

# Test API Keys (not used in tests, but required for validation)
OPENAI_API_KEY=test_key_not_used
OPENROUTER_API_KEY=test_key_not_used
GEMINI_API_KEY=test_key_not_used
MISTRAL_API_KEY=test_key_not_used

# Google OAuth (test values)
GOOGLE_CLIENT_ID=test_client_id
GOOGLE_CLIENT_SECRET=test_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5173/auth/google/callback

# Session configuration
SESSION_SECRET=test_session_secret_for_testing_only

# Test-specific settings
TEST_VERBOSE=false
PLAYWRIGHT_BASE_URL=http://localhost:5173
EOF
        print_success "Created .env.test with default values"
    fi
else
    print_success ".env.test already exists"
fi

# Set up test database (if PostgreSQL is available)
if command -v psql &> /dev/null && command -v createdb &> /dev/null; then
    print_status "Setting up test database..."

    # Check if database exists
    if psql -lqt | cut -d \| -f 1 | grep -qw mindfulcrm_test; then
        print_warning "Test database 'mindfulcrm_test' already exists"

        read -p "Do you want to recreate it? This will delete all test data. (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            dropdb mindfulcrm_test 2>/dev/null || true
            createdb mindfulcrm_test
            print_success "Test database recreated"
        fi
    else
        createdb mindfulcrm_test
        print_success "Test database 'mindfulcrm_test' created"
    fi

    # Run migrations
    print_status "Running database migrations..."
    DATABASE_URL=postgresql://localhost/mindfulcrm_test npm run db:push
    print_success "Database migrations completed"
else
    print_warning "PostgreSQL not available. Tests will use alternative database setup."
fi

# Install Playwright browsers
print_status "Installing Playwright browsers..."
npx playwright install --with-deps
print_success "Playwright browsers installed"

# Set up pre-commit hooks
if command -v pre-commit &> /dev/null; then
    print_status "Setting up pre-commit hooks..."
    pre-commit install
    pre-commit install --hook-type pre-push
    print_success "Pre-commit hooks installed"
else
    print_warning "pre-commit not available. Install with: pip install pre-commit"
fi

# Run initial tests to verify setup
print_status "Running initial test verification..."

# Type check
print_status "Checking TypeScript compilation..."
npm run type-check
if [ $? -eq 0 ]; then
    print_success "TypeScript compilation passed"
else
    print_error "TypeScript compilation failed"
    exit 1
fi

# Lint check
print_status "Running lint check..."
npm run lint:check
if [ $? -eq 0 ]; then
    print_success "Lint check passed"
else
    print_error "Lint check failed"
    exit 1
fi

# Run a sample unit test
print_status "Running sample unit tests..."
npm run test:unit -- --testNamePattern="should" --passWithNoTests
if [ $? -eq 0 ]; then
    print_success "Unit tests are working"
else
    print_error "Unit tests failed"
    exit 1
fi

# Create test run script
print_status "Creating test run helpers..."

cat > scripts/run-tests.sh << 'EOF'
#!/bin/bash
# Quick test runner script

case "$1" in
    "unit")
        echo "Running unit tests..."
        npm run test:unit
        ;;
    "integration")
        echo "Running integration tests..."
        npm run test:integration
        ;;
    "e2e")
        echo "Running E2E tests..."
        npm run test:e2e
        ;;
    "performance")
        echo "Running performance tests..."
        npm run test:performance
        ;;
    "all")
        echo "Running all tests..."
        npm run test:all
        ;;
    "watch")
        echo "Running tests in watch mode..."
        npm run test:watch
        ;;
    "coverage")
        echo "Running tests with coverage..."
        npm run test:coverage
        ;;
    *)
        echo "Usage: $0 {unit|integration|e2e|performance|all|watch|coverage}"
        echo ""
        echo "Available test commands:"
        echo "  unit        - Run unit tests only"
        echo "  integration - Run integration tests only"
        echo "  e2e         - Run end-to-end tests"
        echo "  performance - Run performance tests"
        echo "  all         - Run all test suites"
        echo "  watch       - Run tests in watch mode"
        echo "  coverage    - Run tests with coverage report"
        exit 1
        ;;
esac
EOF

chmod +x scripts/run-tests.sh
print_success "Created test runner script at scripts/run-tests.sh"

# Summary
print_success "🎉 Testing environment setup completed successfully!"
echo ""
echo "Next steps:"
echo "1. Run tests with: npm test or ./scripts/run-tests.sh"
echo "2. Watch mode: npm run test:watch"
echo "3. Coverage: npm run test:coverage"
echo "4. E2E tests: npm run test:e2e"
echo ""
echo "Available test commands:"
echo "• npm test              - Run all unit and integration tests"
echo "• npm run test:unit     - Run unit tests only"
echo "• npm run test:integration - Run integration tests only"
echo "• npm run test:e2e      - Run end-to-end tests"
echo "• npm run test:performance - Run performance tests"
echo "• npm run test:all      - Run complete test suite"
echo "• npm run test:watch    - Watch mode for development"
echo "• npm run test:coverage - Generate coverage reports"
echo ""
echo "Test files are organized as:"
echo "• tests/unit/           - Unit tests"
echo "• tests/integration/    - Integration tests"
echo "• tests/e2e/           - End-to-end tests"
echo "• tests/performance/    - Performance tests"
echo "• tests/mocks/         - Mock implementations"
echo "• tests/fixtures/      - Test data and utilities"
echo ""
print_status "Happy testing! 🧪"
