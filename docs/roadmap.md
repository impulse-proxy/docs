# Roadmap

This roadmap describes possible future direction, not shipped behavior or a
release commitment. Use
[Status and Limitations](/docs/reference/status-and-limitations) as the
authority for current maturity, capability support, limitations, and
general-availability (GA)
blockers.

## Near-Term Priorities

These are the near-term maturity priorities.

### 1. Close Restart-Only Configuration Gaps

- listener removal and bind-address changes (listener *addition* is already live)
- startup-owned settings: log file/format, tracing config, control-plane thread counts
  (`log.level` already reloads live)

### 2. Strengthen Dynamic Configuration Safety

- configurable generation retention
- automatic rollback policy for post-activation health regression
- fleet-level coordination and change attribution

### 3. Edge Runtime Refactor

Break the large edge runtime into smaller subsystems so future work is safer:

- ingress worker layer
- connection/CID management
- request validation
- routing and backend selection
- admission and overload control
- upstream dispatch
- response streaming
- drain and shutdown control

### 4. Security Hardening

Increase trust in the critical-path parser and protocol handling with:

- fuzzing
- deeper negative-case coverage
- tighter admin-plane guidance
- explicit trust-boundary validation

## Medium-Term Priorities

These priorities broaden the reverse-proxy feature set.

### 5. Broader Upstream Compatibility

- better CONNECT handling
- broader WebSocket and upgrade support
- upstream HTTP/3 if it becomes part of the intended product contract

### 6. Traffic-Management Depth

- weighted route splitting
- request mirroring
- richer release controls
- better policy-driven request routing

### 7. Operator Features

- fleet-level quota and state operations
- broader capacity evidence across representative workloads
- deeper runtime attribution for why requests were shed, retried, or rerouted
- safer automated remediation for known failure classes

### 8. Authentication and Policy Features

- broader JOSE algorithm coverage (`RS384`/`RS512`, additional ECDSA curves) and discovery-based JWKS resolution
- route-level policy controls and layered or chained authentication providers

## Longer-Term Priorities

These areas broaden Impulse beyond its current specialized edge-proxy scope.

### 9. Discovery and Platform Integration

- richer service discovery beyond DNS refresh
- better Kubernetes-native deployment integration
- fleet-management workflows

### 10. Extensibility

- a safe extension model
- clearer internal subsystem boundaries that make feature growth sustainable

### 11. Ecosystem Proof

- interoperability validation across more clients and upstream stacks
- broader production history
- documented release-process guarantees

## Related Pages

- [Production Readiness](/docs/deployment/production#production-readiness-and-fit)
- [Status and Limitations](/docs/reference/status-and-limitations)
