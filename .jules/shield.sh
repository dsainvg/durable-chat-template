#!/bin/bash
# Security/Vulnerability Scanner Agent "Shield"
npm audit --audit-level=high || echo "Found vulnerabilities"
npx trufflehog filesystem . --fail || echo "Found secrets"
