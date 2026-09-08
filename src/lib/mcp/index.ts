import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRestaurants from "./tools/list-restaurants";
import listReservations from "./tools/list-reservations";
import getReservation from "./tools/get-reservation";
import findReservation from "./tools/find-reservation";
import searchGuests from "./tools/search-guests";
import listWaitlist from "./tools/list-waitlist";
import addReservationNote from "./tools/add-reservation-note";
import checkAvailability from "./tools/check-availability";
import createReservation from "./tools/create-reservation";
import updateReservation from "./tools/update-reservation";
import cancelReservation from "./tools/cancel-reservation";
import setReservationStatus from "./tools/set-reservation-status";
import resolveLargeGroup from "./tools/resolve-large-group";
import addWaitlistEntry from "./tools/add-waitlist-entry";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "tx-tablewise",
  title: "TX TableWise",
  version: "0.2.0",
  instructions: [
    "Tools for TX TableWise, a reservation and floor management system for restaurants.",
    "Every call runs as the connected account, inside one restaurant, and is checked against that connection's permissions before anything happens. A tool may answer that the connection is not allowed to do something; accept that and explain it, do not retry with different wording.",
    "Booking flow: call check_availability first, then create_reservation with a stable idempotency_key. TableWise decides the table, applies opening hours, closures, pacing and large-group rules. When the answer says requires_manual_approval is true, the reservation is NOT confirmed yet — tell the guest the request goes to the restaurant for approval.",
    "Changing or cancelling: use find_reservation to identify the booking (confirmation code, phone, email, or name plus date), read the details back to the guest, and only then call update_reservation or cancel_reservation with confirmed set to true.",
    "Never invent guest details, times, tables or confirmations. Report the status you actually got back.",
  ].join(" "),
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listRestaurants,
    checkAvailability,
    listReservations,
    getReservation,
    findReservation,
    createReservation,
    updateReservation,
    cancelReservation,
    setReservationStatus,
    resolveLargeGroup,
    searchGuests,
    listWaitlist,
    addWaitlistEntry,
    addReservationNote,
  ],
});
