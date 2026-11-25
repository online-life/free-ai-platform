# Architecture Test Requirements

Automate checks that:
- domain modules do not import framework or infrastructure packages;
- modules do not import other modules' private internals;
- provider SDKs are absent before provider approval;
- API code does not execute user-supplied code;
- contracts remain framework-neutral;
- execution workers do not share the API process security identity;
- project scope is mandatory for project-owned access.
