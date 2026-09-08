# Roadmap — MCP-agentintegratie

- [ ] Database: service identities (profiel + capabilities + tenantbinding) en idempotency-sleutel op reserveringen
- [ ] Gedeelde grote-groephelper; gebruiken in book_reservation en manage_reservation (klein→groot en groot→klein)
- [ ] Idempotency in book_reservation
- [ ] MCP identity-laag: human OAuth + service identity, tenantbinding, capability-check
- [ ] Nieuwe MCP-tools: check_availability, find_reservation, create_reservation, update_reservation, cancel_reservation, set_reservation_status, resolve_large_group, add_waitlist_entry
- [ ] Bestaande MCP-tools achter capabilities
- [ ] Typecheck, manifest opnieuw genereren, functies uitrollen
- [ ] Tests: normale boeking, grote groep pending, klein→groot, idempotency, capability-denial, tenant-isolatie
