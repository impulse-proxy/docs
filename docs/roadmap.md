# Roadmap

This roadmap is intentionally practical. It describes possible future
direction, not shipped behavior or a release commitment. Use
[Status and Limitations](/docs/reference/status-and-limitations) as the
authority for current maturity, capability support, limitations, and GA
blockers.

## Near-Term Priorities

These are the highest-value areas for the next phase of maturity.

### 1. Close Restart-Only Configuration Gaps

- listener removal and bind-address changes (listener *addition* is already live)
- startup-owned settings: log file/format, tracing config, control-plane thread counts
  (`log.level` already reloads live)

### 2. Strengthen Dynamic Configuration Safety

- configurable generation retention
- automatic rollback policy for post-activation health regression
- stronger fleet-level coordination and change attribution

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

These areas make Impulse far more competitive as a general production reverse proxy.

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

- stronger fleet-level quota and state operations
- broader capacity evidence across representative workloads
- deeper runtime attribution for why requests were shed, retried, or rerouted
- safer automated remediation for known failure classes

### 8. Auth And Policy Features

- broader JOSE algorithm coverage (`RS384`/`RS512`, additional ECDSA curves) and discovery-based JWKS resolution
- stronger route-level policy controls and layered/chained auth providers

## Longer-Term Competitive Priorities

These areas are what move Impulse from “strong specialized edge proxy” toward “top-tier proxy platform.”

### 9. Discovery And Platform Integration

- richer service discovery beyond DNS refresh
- better Kubernetes-native deployment integration
- stronger fleet-management story

### 10. Extensibility

- a safe extension model
- clearer internal subsystem boundaries that make feature growth sustainable

### 11. Ecosystem Proof

- interoperability validation across more clients and upstream stacks
- broader production history
- stronger release-process guarantees

## Related Pages

- [Production Readiness](/docs/deployment/production#production-readiness-and-fit)
- [Status and Limitations](/docs/reference/status-and-limitations)
