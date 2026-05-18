#!/bin/bash
# Test-Coverage Drift Monitor Agent "Coverage"
vitest run --coverage || echo "Coverage failed or dropped below threshold"
