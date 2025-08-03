# Git Hooks with Husky

This directory contains automated git hooks powered by [Husky](https://typicode.github.io/husky/) to ensure code quality and security standards before commits and pushes.

## 🎯 Why We Use Husky

### **Automated Quality Assurance**

- **Prevents broken code** from entering the repository
- **Catches security vulnerabilities** before they reach production
- **Enforces consistent commit standards** across the team
- **Reduces manual code review overhead** by catching issues early

### **Developer Experience**

- **Fast feedback loop** - Issues caught immediately, not in CI/CD
- **Consistent environment** - Same checks run for all developers
- **Educational** - Helps developers learn best practices through immediate feedback

### **Security Benefits**

- **Dependency vulnerability scanning** prevents known security issues
- **TypeScript type checking** prevents runtime errors
- **Input validation** ensures secure coding practices

## 📋 Current Git Hooks

### 1. **Pre-Commit Hook** (`pre-commit`)

Runs before each commit is created

```bash
# What it does:
🔍 TypeScript type checking (only on staged files via lint-staged)
🔒 Security vulnerability audit (high-severity only)
✅ Validates staged file changes
```

**Performance**: Uses `lint-staged` to only check files you're actually committing, making it fast even in large codebases.

### 2. **Commit Message Hook** (`commit-msg`)

Validates commit message format

```bash
# Enforces conventional commits format:
<type>[optional scope]: <description>

# Valid types:
feat, fix, docs, style, refactor, test, chore, security, perf, build, ci, revert

# Examples:
✅ feat: add user authentication
✅ fix(auth): resolve login redirect issue
✅ security: implement CSRF protection
✅ docs: update API documentation

❌ added new feature
❌ fixed bug
❌ WIP: working on stuff
```

### 3. **Pre-Push Hook** (`pre-push`)

Final verification before pushing to remote

```bash
# What it does:
🔍 Full TypeScript type checking (entire project)
🔒 Complete security audit
🏗️ Build verification (ensures deployability)
```

**Purpose**: Catches issues that might have been missed and ensures the remote repository stays clean.

## 🚀 How It Works

### Installation

Husky was installed and configured with:

```bash
npm install --save-dev husky lint-staged
npx husky init
```

### Lint-Staged Configuration

Located in `package.json`:

```json
"lint-staged": {
  "*.{ts,tsx}": ["npm run check"],
  "*.{js,jsx,ts,tsx,json,css,md}": ["echo 'Checking staged files...'"]
}
```

This ensures only staged files are checked, dramatically improving performance.

## ✅ What TO Do

### **When Hooks Pass**

- **Commit normally** - hooks run automatically and silently
- **Push with confidence** - your code has been verified
- **Follow conventional commits** - helps maintain clean history

### **When Hooks Fail**

1. **Read the error message** - it tells you exactly what's wrong
2. **Fix the issue** - address TypeScript errors, security issues, etc.
3. **Stage your fixes** - `git add .`
4. **Try committing again** - hooks will re-run automatically

### **For Commit Message Errors**

```bash
# If your commit message is rejected:
git commit --amend -m "feat: your properly formatted message"
```

### **For TypeScript Errors**

```bash
# Run type checking manually to see all errors:
npm run check

# Fix the errors, then commit again
```

### **For Security Vulnerabilities**

```bash
# See detailed audit report:
npm audit

# Fix high-severity issues:
npm audit fix
```

## ❌ What NOT To Do

### **Never Skip Hooks**

```bash
# ❌ DON'T DO THIS - bypasses all safety checks
git commit --no-verify -m "quick fix"
git push --no-verify

# ✅ Instead: Fix the underlying issue
```

**Why**: Skipping hooks defeats the entire purpose and can introduce bugs or security vulnerabilities into production.

### **Don't Modify Hooks Without Understanding**

```bash
# ❌ DON'T randomly edit hook files
# ❌ DON'T disable security checks to "speed up" development
# ❌ DON'T remove TypeScript checking because it's "annoying"
```

**Why**: These checks exist to prevent production issues. Removing them creates technical debt and security risks.

### **Don't Ignore Hook Failures**

```bash
# ❌ DON'T ignore TypeScript errors with @ts-ignore everywhere
# ❌ DON'T commit broken code "to fix later"
# ❌ DON'T disable security audits because of "false positives"
```

**Why**: Technical debt compounds quickly and becomes much harder to fix later.

### **Don't Use Non-Conventional Commit Messages**

```bash
# ❌ Avoid these patterns:
"fixed stuff"
"WIP"
"asdf"
"quick fix"
"updates"

# ✅ Use these instead:
"fix: resolve authentication timeout issue"
"feat: add user profile management"
"docs: update installation instructions"
```

**Why**: Conventional commits enable automated changelog generation, semantic versioning, and better project history.

## 🔧 Troubleshooting

### **Hook Not Running**

```bash
# Ensure husky is properly installed:
npm run prepare

# Check hook file permissions:
ls -la .husky/
```

### **TypeScript Errors in Hooks**

```bash
# Run checks manually to debug:
npm run check

# For staged files only:
npx lint-staged
```

### **Performance Issues**

- Hooks should be fast due to `lint-staged`
- If slow, check if you're running full project scans instead of staged files
- Consider excluding large generated files from TypeScript checking

### **Security Audit Failures**

```bash
# See full audit report:
npm audit

# Fix automatically (may cause breaking changes):
npm audit fix --force

# Update specific packages:
npm update package-name
```

## 🛠️ Customization

### **Adding New Checks**

To add ESLint, Prettier, or other tools:

1. **Install the tool**: `npm install --save-dev eslint`
2. **Update lint-staged** in `package.json`:

   ```json
   "lint-staged": {
     "*.{ts,tsx}": ["npm run check", "eslint --fix"],
     "*.{js,jsx,ts,tsx,json,css,md}": ["prettier --write"]
   }
   ```

3. **Test the hook**: Make a commit to verify it works

### **Modifying Existing Hooks**

- Edit the hook files directly (`.husky/pre-commit`, etc.)
- Test thoroughly before committing changes
- Document any modifications in this README

## 📚 Additional Resources

- [Husky Documentation](https://typicode.github.io/husky/)
- [Conventional Commits](https://www.conventionalcommits.org/)
- [Lint-Staged Documentation](https://github.com/okonet/lint-staged)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)

## 🤝 Team Guidelines

### **For New Team Members**

1. **Clone the repository** - hooks are automatically installed via `npm install`
2. **Read this README** - understand why hooks exist and how to work with them
3. **Make a test commit** - verify your environment is set up correctly
4. **Ask questions** - better to clarify than to bypass safety measures

### **For Code Reviews**

- **Verify hooks passed** - if someone bypassed hooks, ask why
- **Check commit message quality** - ensure conventional format is followed
- **Review security audit results** - address any new vulnerabilities

---

**Remember**: These hooks are here to help you write better, safer code. They're not obstacles—they're safety nets that catch issues before they become problems in production. 🛡️
